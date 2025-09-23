// ================================================================
// API ENDPOINT - Upload de Excel
// ================================================================
// Implementa upload de Excel conforme especificação completa

import { NextRequest, NextResponse } from 'next/server';
import { ExcelUploadService, DEFAULT_CONFIG } from '@/lib/excel-upload-service';
import { prisma } from '@/lib/prisma';
import { ICONS } from '@/lib/icons';

const uploadService = new ExcelUploadService();

/**
 * POST /api/upload/excel
 * Processamento de arquivo Excel (apenas Judit, sem IA)
 */
export async function POST(request: NextRequest) {
  console.log(`${ICONS.PROCESS} Iniciando processamento de Excel...`);

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

    console.log(`${ICONS.PROCESS} Arquivo recebido: ${file.name} (${file.size} bytes)`);

    // FASE 1: Parsing e validação inicial (síncrono rápido)
    const parseResult = await uploadService.parseAndValidate(
      buffer,
      file.name,
      workspaceId
    );

    if (!parseResult.success) {
      console.log(`${ICONS.ERROR} Falha no parsing:`, parseResult.errors);

      return NextResponse.json({
        success: false,
        error: 'Erro na validação do arquivo',
        details: parseResult.errors
      }, { status: 400 });
    }

    const { parseResult: parsed, estimate, preview } = parseResult;

    // Verificar se há linhas válidas para processar
    if (parsed!.summary.valid === 0) {
      return NextResponse.json({
        success: false,
        error: 'Nenhum processo válido encontrado no arquivo',
        summary: parsed!.summary
      }, { status: 400 });
    }

    // FASE 2: Criação do batch (imediato)
    // Salvar arquivo temporariamente
    const timestamp = Date.now();
    const filePath = `/tmp/excel_uploads/${workspaceId}/${timestamp}_${file.name}`;

    // TODO: Implementar salvamento real do arquivo
    // await saveFileToStorage(buffer, filePath);

    const batchInfo = await uploadService.createBatch(
      parsed!,
      file.name,
      filePath,
      file.size,
      workspaceId,
      prisma
    );

    console.log(`${ICONS.SUCCESS} Batch criado: ${batchInfo.batchId}`);

    // FASE 3: Iniciar processamento em background (não-bloqueante)
    // Não aguardar - retornar imediatamente
    setImmediate(() => {
      uploadService.processInBackground(
        batchInfo.batchId,
        parsed!,
        workspaceId,
        prisma
      ).catch(error => {
        console.error(`${ICONS.ERROR} Erro no processamento background:`, error);
      });
    });

    // Retornar resposta imediata com batch_id e preview
    return NextResponse.json({
      success: true,
      batchId: batchInfo.batchId,
      preview: batchInfo.preview,
      summary: parsed!.summary,
      consumption: {
        juditQueries: estimate!.validRows,
        message: `${estimate!.validRows} consultas ao judiciário serão realizadas`
      },
      processing: {
        status: 'PROCESSING',
        totalProcesses: estimate!.validRows,
        estimatedTime: `${estimate!.estimatedTime} minuto${estimate!.estimatedTime !== 1 ? 's' : ''}`,
        message: `Processamento iniciado em background. ${estimate!.validRows} processos serão enriquecidos com dados do judiciário.`
      },
      config: {
        pageSize: DEFAULT_CONFIG.PAGE_SIZE,
        subbatch: DEFAULT_CONFIG.SUBBATCH,
        concurrency: DEFAULT_CONFIG.CONCURRENCY
      }
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro no upload de Excel:`, error);

    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}

/**
 * GET /api/upload/excel
 * Retorna template de exemplo
 */
export async function GET() {
  try {
    // TODO: Implementar geração de template
    const templateUrl = '/templates/excel_upload_template.xlsx';

    return NextResponse.json({
      success: true,
      templateUrl,
      documentation: {
        requiredColumns: ['numeroProcesso', 'tribunal', 'nomeCliente'],
        optionalColumns: ['observacoes', 'frequenciaSync', 'alertasAtivos', 'emailsAlerta'],
        maxRows: DEFAULT_CONFIG.MAX_ROWS,
        supportedFormats: ['.xlsx', '.xls'],
        maxFileSize: '10MB'
      }
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro ao gerar template:`, error);

    return NextResponse.json({
      success: false,
      error: 'Erro ao gerar template'
    }, { status: 500 });
  }
}