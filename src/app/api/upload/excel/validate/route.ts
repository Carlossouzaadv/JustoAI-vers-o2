// ================================================================
// API ENDPOINT - Upload Excel Validation (Dry-Run)
// ================================================================
// POST /upload/excel/validate
// Validação local rápida com preview de 10 linhas + resumo amigável

import { NextRequest, NextResponse } from 'next/server';
import { ExcelUploadService } from '../../../../../lib/excel-upload-service';
import { prisma } from '../../../../../lib/prisma';
import { ICONS } from '../../../../../lib/icons';

const uploadService = new ExcelUploadService();

export async function POST(request: NextRequest) {
  console.log(`${ICONS.PROCESS} Iniciando validação Excel (dry-run)...`);

  try {
    // Verificar Content-Type
    const contentType = request.headers.get('content-type') || '';

    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Content-Type deve ser multipart/form-data'
        },
        { status: 400 }
      );
    }

    // Extrair dados do FormData
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const workspaceId = formData.get('workspaceId') as string;

    // Validações básicas
    if (!file) {
      return NextResponse.json(
        {
          success: false,
          error: 'Arquivo não fornecido'
        },
        { status: 400 }
      );
    }

    if (!workspaceId) {
      return NextResponse.json(
        {
          success: false,
          error: 'WorkspaceId é obrigatório'
        },
        { status: 400 }
      );
    }

    // Validar tipo do arquivo
    if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Arquivo deve ser Excel (.xlsx ou .xls)'
        },
        { status: 400 }
      );
    }

    // Validar tamanho (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        {
          success: false,
          error: 'Arquivo muito grande (máximo 10MB)'
        },
        { status: 400 }
      );
    }

    // Converter arquivo para buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(`${ICONS.PROCESS} Validando arquivo: ${file.name} (${file.size} bytes)`);

    // Parsing e validação (dry-run automático)
    const parseResult = await uploadService.parseAndValidate(
      buffer,
      file.name,
      workspaceId
    );

    if (!parseResult.success) {
      console.log(`${ICONS.ERROR} Falha na validação:`, parseResult.errors);

      return NextResponse.json({
        success: false,
        error: 'Erro na validação do arquivo',
        details: parseResult.errors
      }, { status: 400 });
    }

    const { parseResult: parsed, estimate, preview } = parseResult;

    // Verificar processos existentes no workspace (para duplicatas)
    const existingProcesses = await checkExistingProcesses(
      parsed!.validRows.map(row => row.numeroProcesso),
      workspaceId
    );

    // Categorizar erros para UX amigável
    const errorsByType = categorizeValidationErrors(parsed!.errors);

    // Gerar resumo amigável
    const friendlySummary = generateFriendlySummary(
      parsed!.summary,
      existingProcesses.length,
      estimate!
    );

    console.log(`${ICONS.SUCCESS} Validação concluída: ${parsed!.summary.valid} linhas válidas`);

    return NextResponse.json({
      success: true,
      validation: true,
      file: {
        name: file.name,
        size: file.size,
        sizeFormatted: formatFileSize(file.size)
      },
      summary: friendlySummary,
      preview: preview!.slice(0, 10), // Exatamente 10 linhas conforme spec
      details: {
        totalLines: parsed!.summary.total,
        validLines: parsed!.summary.valid,
        invalidLines: parsed!.summary.invalid,
        duplicateLines: parsed!.summary.duplicates,
        existingInWorkspace: existingProcesses.length,
        newProcesses: parsed!.summary.valid - existingProcesses.length
      },
      consumption: {
        juditQueries: parsed!.summary.valid - existingProcesses.length,
        message: `Este arquivo consumirá ${parsed!.summary.valid - existingProcesses.length} consultas ao judiciário`
      },
      errors: errorsByType,
      canProceed: parsed!.summary.valid > 0 && errorsByType.critical.length === 0,
      validationReport: {
        downloadUrl: null, // TODO: Implementar geração de CSV com erros
        hasErrors: parsed!.errors.length > 0
      }
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro na validação de Excel:`, error);

    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}

/**
 * Verifica processos existentes no workspace
 */
async function checkExistingProcesses(
  processNumbers: string[],
  workspaceId: string
): Promise<string[]> {
  try {
    const existing = await prisma.monitoredProcess.findMany({
      where: {
        workspaceId,
        number: {
          in: processNumbers
        }
      },
      select: {
        number: true
      }
    });

    return existing.map(p => p.number);

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro ao verificar processos existentes:`, error);
    return [];
  }
}

/**
 * Categoriza erros por tipo para UX amigável
 */
function categorizeValidationErrors(errors: any[]): any {
  const critical = [];
  const warnings = [];
  const info = [];

  for (const error of errors) {
    if (error.tipo === 'ERROR') {
      if (error.erro.includes('obrigatório') || error.erro.includes('formato inválido')) {
        critical.push({
          line: error.linha,
          field: error.campo,
          value: error.valor,
          message: error.erro
        });
      } else {
        warnings.push({
          line: error.linha,
          field: error.campo,
          value: error.valor,
          message: error.erro
        });
      }
    } else {
      info.push({
        line: error.linha,
        field: error.campo,
        value: error.valor,
        message: error.erro
      });
    }
  }

  return {
    critical,
    warnings,
    info,
    totalErrors: critical.length + warnings.length + info.length
  };
}

/**
 * Gera resumo amigável para o usuário
 */
function generateFriendlySummary(
  summary: any,
  existingCount: number,
  estimate: any
): any {
  const newProcesses = summary.valid - existingCount;

  return {
    message: generateSummaryMessage(summary, existingCount, newProcesses),
    stats: {
      totalFound: summary.total,
      validProcesses: summary.valid,
      newToAdd: newProcesses,
      alreadyExists: existingCount,
      hasErrors: summary.invalid > 0
    },
    recommendation: generateRecommendation(summary, newProcesses),
    estimatedTime: estimate.estimatedTime > 0
      ? `Aproximadamente ${estimate.estimatedTime} minuto${estimate.estimatedTime !== 1 ? 's' : ''}`
      : 'Menos de 1 minuto'
  };
}

/**
 * Gera mensagem de resumo amigável
 */
function generateSummaryMessage(
  summary: any,
  existingCount: number,
  newProcesses: number
): string {
  const messages = [];

  if (summary.total > 0) {
    messages.push(`${summary.total} linha${summary.total !== 1 ? 's' : ''} encontrada${summary.total !== 1 ? 's' : ''}`);
  }

  if (summary.valid > 0) {
    messages.push(`${summary.valid} processo${summary.valid !== 1 ? 's' : ''} válido${summary.valid !== 1 ? 's' : ''}`);
  }

  if (newProcesses > 0) {
    messages.push(`${newProcesses} novo${newProcesses !== 1 ? 's' : ''} para adicionar`);
  }

  if (existingCount > 0) {
    messages.push(`${existingCount} já existe${existingCount !== 1 ? 'm' : ''} no workspace`);
  }

  if (summary.invalid > 0) {
    messages.push(`${summary.invalid} com erro${summary.invalid !== 1 ? 's' : ''}`);
  }

  return messages.join(', ') + '.';
}

/**
 * Gera recomendação baseada nos dados
 */
function generateRecommendation(summary: any, newProcesses: number): string {
  if (summary.invalid > summary.valid) {
    return 'Arquivo contém muitos erros. Recomendamos revisar antes de processar.';
  }

  if (newProcesses === 0) {
    return 'Todos os processos já existem no workspace. Nenhum novo processo será adicionado.';
  }

  if (newProcesses > 500) {
    return 'Arquivo grande detectado. O processamento será feito em lotes para melhor performance.';
  }

  if (summary.valid > 0) {
    return 'Arquivo válido e pronto para processamento.';
  }

  return 'Revise os erros encontrados antes de continuar.';
}

/**
 * Formata tamanho do arquivo
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}