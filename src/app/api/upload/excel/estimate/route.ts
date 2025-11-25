// ================================================================
// API ENDPOINT - Estimativa de Custo e Dry Run
// ================================================================
// Endpoint para calcular estimativa sem processar arquivo

import { NextRequest, NextResponse } from 'next/server';
import { ExcelUploadService } from '@/lib/excel-upload-service';
import { prisma } from '@/lib/prisma';
import { ICONS } from '@/lib/icons';

const uploadService = new ExcelUploadService();

/**
 * POST /api/upload/excel/estimate
 * Calcula estimativa de consultas Judit e tempo sem processar
 */
export async function POST(request: NextRequest) {
  console.log(`${ICONS.PROCESS} Calculando estimativa de custo...`);

  try {
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

    // Converter arquivo para buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(`${ICONS.PROCESS} Analisando arquivo: ${file.name}`);

    // Parsing e validação (modo dry run)
    const parseResult = await uploadService.parseAndValidate(
      buffer,
      file.name,
      workspaceId
    );

    if (!parseResult.success) {
      return NextResponse.json({
        success: false,
        error: 'Erro na validação do arquivo',
        details: parseResult.errors
      }, { status: 400 });
    }

    const { parseResult: parsed, estimate, preview } = parseResult;

    // Verificar duplicatas existentes no workspace
    const existingProcesses = await checkExistingProcesses(
      parsed!.validRows.map(row => row.numeroProcesso),
      workspaceId
    );

    // Calcular estimativa refinada (apenas consultas Judit)
    const newProcesses = estimate!.validRows - existingProcesses.length;
    const refinedEstimate = {
      ...estimate!,
      existingProcesses: existingProcesses.length,
      newProcesses,
      juditQueries: newProcesses,
      estimatedTime: Math.ceil(newProcesses / 60), // ~1 consulta por segundo
      consumption: {
        message: `${newProcesses} consulta${newProcesses !== 1 ? 's' : ''} ao judiciário`,
        description: 'Enriquecimento via API Judit (dados oficiais dos tribunais)'
      }
    };

    // Categorizar erros por tipo
    const errorCategories = categorizeErrors(parsed!.errors);

    console.log(`${ICONS.SUCCESS} Estimativa calculada: ${refinedEstimate.newProcesses} novos processos`);

    return NextResponse.json({
      success: true,
      fileName: file.name,
      fileSize: file.size,
      summary: parsed!.summary,
      estimate: refinedEstimate,
      preview: preview!.slice(0, 5), // Mostrar apenas 5 para estimativa
      existingProcesses: existingProcesses.slice(0, 10), // Primeiros 10 duplicados
      errorCategories,
      recommendation: generateRecommendation(refinedEstimate, errorCategories),
      confirmationMessage: generateConfirmationMessage(refinedEstimate)
    });

  } catch (_error) {
    console.error(`${ICONS.ERROR} Erro na estimativa:`, error);

    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}

interface MonitoredProcessSelect {
  processNumber: string;
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
        processNumber: {
          in: processNumbers
        }
      },
      select: {
        processNumber: true
      }
    });

    return existing.map((p: MonitoredProcessSelect) => p.processNumber);

  } catch (_error) {
    console.error(`${ICONS.ERROR} Erro ao verificar processos existentes:`, error);
    return [];
  }
}

interface ParseError {
  tipo: string;
  erro: string;
  linha?: number;
}

interface ErrorCategory {
  count: number;
  errors: ParseError[];
}

interface CategorizedErrors {
  critical: ErrorCategory;
  validation: ErrorCategory;
  warning: ErrorCategory;
  duplicate: ErrorCategory;
}

/**
 * Categoriza erros por tipo para melhor UX
 */
function categorizeErrors(errors: ParseError[]): CategorizedErrors {
  const categories = {
    critical: [] as ParseError[],
    validation: [] as ParseError[],
    warning: [] as ParseError[],
    duplicate: [] as ParseError[]
  };

  errors.forEach(error => {
    if (error.tipo === 'ERROR') {
      if (error.erro.includes('obrigatório') || error.erro.includes('formato')) {
        categories.critical.push(error);
      } else {
        categories.validation.push(error);
      }
    } else if (error.erro.includes('duplicado')) {
      categories.duplicate.push(error);
    } else {
      categories.warning.push(error);
    }
  });

  return {
    critical: {
      count: categories.critical.length,
      errors: categories.critical.slice(0, 5)
    },
    validation: {
      count: categories.validation.length,
      errors: categories.validation.slice(0, 5)
    },
    warning: {
      count: categories.warning.length,
      errors: categories.warning.slice(0, 5)
    },
    duplicate: {
      count: categories.duplicate.length,
      errors: categories.duplicate.slice(0, 5)
    }
  };
}

interface Estimate {
  existingProcesses: number;
  newProcesses: number;
  juditQueries: number;
  estimatedTime: number;
  [key: string]: unknown;
}

interface Recommendation {
  type: 'error' | 'warning' | 'info';
  message: string;
  action: string;
}

interface RecommendationResult {
  canProceed: boolean;
  recommendations: Recommendation[];
}

/**
 * Gera recomendação baseada na análise (sem referências a custo)
 */
function generateRecommendation(estimate: Estimate, errorCategories: CategorizedErrors): RecommendationResult {
  const recommendations: Recommendation[] = [];

  // Verificar se há muitos erros críticos
  if (errorCategories.critical.count > 0) {
    recommendations.push({
      type: 'error',
      message: `Há ${errorCategories.critical.count} erro(s) crítico(s) que impedem o processamento`,
      action: 'Corrija os erros obrigatórios antes de continuar'
    });
  }

  // Verificar se há muitos processos existentes
  if (estimate.existingProcesses > estimate.newProcesses) {
    recommendations.push({
      type: 'warning',
      message: `${estimate.existingProcesses} processos já existem no workspace`,
      action: 'Considere revisar a lista para evitar duplicatas'
    });
  }

  // Verificar número de consultas Judit
  if (estimate.juditQueries > 500) {
    recommendations.push({
      type: 'info',
      message: `${estimate.juditQueries} consultas ao judiciário serão realizadas`,
      action: 'Processamento em lotes para melhor performance'
    });
  }

  // Verificar tempo estimado
  if (estimate.estimatedTime > 30) {
    recommendations.push({
      type: 'info',
      message: `Tempo estimado: ${estimate.estimatedTime} minutos`,
      action: 'O processamento continuará em background'
    });
  }

  return {
    canProceed: errorCategories.critical.count === 0,
    recommendations
  };
}

/**
 * Gera mensagem de confirmação personalizada (sem referências a custo)
 */
function generateConfirmationMessage(estimate: Estimate): string {
  const messages: string[] = [];

  if (estimate.newProcesses > 0) {
    messages.push(`${estimate.newProcesses} novos processos serão adicionados`);
  }

  if (estimate.existingProcesses > 0) {
    messages.push(`${estimate.existingProcesses} processos já existem e serão ignorados`);
  }

  if (estimate.juditQueries > 0) {
    messages.push(`${estimate.juditQueries} consultas ao judiciário serão realizadas`);
  }

  if (estimate.estimatedTime > 0) {
    messages.push(`Tempo estimado: ${estimate.estimatedTime} minutos`);
  }

  const baseMessage = messages.join('. ') + '.';

  return `${baseMessage} Deseja continuar com o processamento?`;
}