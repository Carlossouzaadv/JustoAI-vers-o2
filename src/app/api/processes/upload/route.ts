// ================================
// API UPLOAD EXCEL DE PROCESSOS
// ================================
// Endpoint para upload em lote de processos via arquivo Excel

import { NextRequest, NextResponse } from 'next/server';
import multer from 'multer';
import { promisify } from 'util';
import prisma from '@/lib/prisma';
import { validateAuth } from '@/lib/auth';
import { apiResponse, errorResponse, ApiError } from '@/lib/api-utils';
import {
  ExcelProcessParser,
  createProductionParser,
  ExcelTemplateGenerator
} from '@/lib/excel-parser';
import {
  createProcessApiClient,
  validateProcessNumber,
  normalizeProcessNumber
} from '@/lib/process-apis';
import { ICONS } from '@/lib/icons';

// ================================
// CONFIGURAÇÃO MULTER
// ================================

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos Excel (.xlsx, .xls) são permitidos'));
    }
  }
});

const uploadSingle = promisify(upload.single('file'));

// ================================
// POST - UPLOAD DE ARQUIVO EXCEL
// ================================

export async function POST(request: NextRequest) {
  try {
    // Autenticação
    const { user, workspace } = await validateAuth(request);

    // Processar upload
    const req = request as unknown;
    const res = {} as unknown;

    await uploadSingle(req, res);

    if (!req.file) {
      throw new ApiError('Arquivo não encontrado', 400);
    }

    const file = req.file;
    console.log(`${ICONS.UPLOAD} Upload iniciado:`, {
      filename: file.originalname,
      size: file.size,
      workspace: workspace.name
    });

    // Parse do Excel
    const parser = createProductionParser();
    const parseResult = await parser.parseExcelBuffer(file.buffer, file.originalname);

    // Criar registro de batch upload
    const batchUpload = await prisma.processBatchUpload.create({
      data: {
        workspaceId: workspace.id,
        fileName: file.originalname,
        filePath: `uploads/${workspace.id}/${Date.now()}-${file.originalname}`,
        fileSize: file.size,
        status: parseResult.success ? 'PROCESSING' : 'FAILED',
        totalRows: parseResult.totalRows,
        processed: 0,
        successful: 0,
        failed: parseResult.errors.filter(e => e.tipo === 'ERROR').length,
        errors: JSON.parse(JSON.stringify(parseResult.errors)),
        summary: {
          parseResult: parseResult.summary,
          timestamp: new Date().toISOString()
        }
      }
    });

    // Se há erros críticos no parse, retornar imediatamente
    if (!parseResult.success) {
      await prisma.processBatchUpload.update({
        where: { id: batchUpload.id },
        data: { status: 'FAILED' }
      });

      return NextResponse.json({
        success: false,
        data: {
          batchId: batchUpload.id,
          parseResult
        },
        message: `Parse falhou: ${parseResult.errors.length} erros encontrados`
      }, { status: 400 });
    }

    // Processar linhas válidas em background
    processValidRowsInBackground(batchUpload.id, parseResult.validRows, workspace.id);

    return apiResponse({
      success: true,
      batchId: batchUpload.id,
      parseResult: {
        ...parseResult,
        message: 'Arquivo processado com sucesso. Processos sendo adicionados em background.'
      }
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro no upload:`, error);

    if (error instanceof ApiError) {
      return errorResponse(error.message, error.status);
    }

    return errorResponse('Erro interno do servidor', 500);
  }
}

// ================================
// GET - BAIXAR TEMPLATE EXCEL
// ================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'template') {
      const generator = new ExcelTemplateGenerator();
      const templateBuffer = await generator.generateTemplate();

      return new NextResponse(templateBuffer as unknown as BodyInit, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename="template_processos.xlsx"'
        }
      });
    }

    if (action === 'documentation') {
      const generator = new ExcelTemplateGenerator();
      const docs = generator.generateDocumentation();

      return apiResponse({
        documentation: docs,
        template_url: `/api/processes/upload?action=template`
      });
    }

    // Autenticação para outras ações
    const { workspace } = await validateAuth(request);

    // Listar uploads recentes
    const recentUploads = await prisma.processBatchUpload.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        fileName: true,
        status: true,
        totalRows: true,
        successful: true,
        failed: true,
        createdAt: true,
        summary: true
      }
    });

    return apiResponse({
      recentUploads,
      actions: {
        download_template: `/api/processes/upload?action=template`,
        view_documentation: `/api/processes/upload?action=documentation`
      }
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro ao processar GET:`, error);

    if (error instanceof ApiError) {
      return errorResponse(error.message, error.status);
    }

    return errorResponse('Erro interno do servidor', 500);
  }
}

// ================================
// PROCESSAMENTO EM BACKGROUND
// ================================

interface ValidRow {
  linha: number;
  numeroProcesso: string;
  tribunal?: string;
  nomeCliente?: string;
  frequenciaSync?: string;
  alertasAtivos?: boolean;
  emailsAlerta?: string[];
}

interface ProcessMovement {
  date: string;
  type: string;
  description: string;
  category?: string;
  importance?: string;
  requiresAction?: boolean;
  deadline?: string;
}

interface ProcessApiData {
  movements?: ProcessMovement[];
  [key: string]: unknown;
}

interface ProcessingError {
  linha: number;
  processo: string;
  erro: string;
}

async function processValidRowsInBackground(
  batchId: string,
  validRows: ValidRow[],
  workspaceId: string
) {

  try {
    const processApi = createProcessApiClient();
    let successful = 0;
    let failed = 0;
    const errors: ProcessingError[] = [];

    console.log(`${ICONS.PROCESS} Processando ${validRows.length} processos em background`);

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];

      try {
        // Normalizar número do processo
        const normalizedNumber = normalizeProcessNumber(row.numeroProcesso);

        // Verificar se já existe
        const existing = await prisma.monitoredProcess.findUnique({
          where: {
            workspaceId_processNumber: {
              workspaceId: workspaceId,
              processNumber: normalizedNumber
            }
          }
        });

        if (existing) {
          console.log(`${ICONS.WARNING} Processo já existe: ${normalizedNumber}`);
          errors.push({
            linha: row.linha,
            processo: normalizedNumber,
            erro: 'Processo já está sendo monitorado'
          });
          failed++;
          continue;
        }

        // Buscar dados do processo via API
        let processData: ProcessApiData | null = null;
        try {
          const apiResult = await processApi.searchProcess({
            processNumber: normalizedNumber,
            court: row.tribunal,
            clientName: row.nomeCliente,
            includeMovements: true,
            includeParties: true
          });

          if (apiResult.success) {
            processData = apiResult.data as ProcessApiData;
          }
        } catch (apiError) {
          console.log(`${ICONS.WARNING} API falhou para processo ${normalizedNumber}:`, apiError);
          // Continua sem os dados da API
        }

        // Criar processo monitorado
        const monitoredProcess = await prisma.monitoredProcess.create({
          data: {
            workspaceId,
            processNumber: normalizedNumber,
            court: row.tribunal,
            clientName: row.nomeCliente,
            processData: processData ? JSON.parse(JSON.stringify(processData)) : null,
            monitoringStatus: 'ACTIVE',
            syncFrequency: row.frequenciaSync || 'DAILY',
            alertsEnabled: row.alertasAtivos ?? true,
            alertRecipients: row.emailsAlerta || [],
            source: processData ? 'JUDIT_API' : 'EXCEL_UPLOAD',
            extractionMethod: 'API'
          }
        });

        // Se temos movimentações da API, criar registros
        if (processData?.movements && processData.movements.length > 0) {
          await Promise.all(
            processData.movements.slice(0, 20).map(async (movement: ProcessMovement) => {
              return prisma.processMovement.create({
                data: {
                  monitoredProcessId: monitoredProcess.id,
                  date: new Date(movement.date),
                  type: movement.type,
                  description: movement.description,
                  category: movement.category,
                  importance: movement.importance,
                  requiresAction: movement.requiresAction,
                  deadline: movement.deadline ? new Date(movement.deadline) : null,
                  rawData: JSON.parse(JSON.stringify(movement))
                }
              });
            })
          );
        }

        console.log(`${ICONS.SUCCESS} Processo criado: ${normalizedNumber}`);
        successful++;

      } catch (rowError) {
        console.error(`${ICONS.ERROR} Erro ao processar linha ${row.linha}:`, rowError);
        errors.push({
          linha: row.linha,
          processo: row.numeroProcesso,
          erro: rowError instanceof Error ? rowError.message : 'Erro desconhecido'
        });
        failed++;
      }

      // Atualizar progresso a cada 10 processos
      if ((i + 1) % 10 === 0) {
        await prisma.processBatchUpload.update({
          where: { id: batchId },
          data: {
            processed: i + 1,
            successful,
            failed
          }
        });
      }
    }

    // Atualização final
    await prisma.processBatchUpload.update({
      where: { id: batchId },
      data: {
        status: 'COMPLETED',
        processed: validRows.length,
        successful,
        failed,
        errors: errors,
        summary: {
          parseResult: { valid: successful, invalid: failed },
          processingErrors: errors,
          timestamp: new Date().toISOString()
        }
      }
    });

    console.log(`${ICONS.SUCCESS} Batch processado: ${successful} sucessos, ${failed} falhas`);

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro crítico no processamento:`, error);

    await prisma.processBatchUpload.update({
      where: { id: batchId },
      data: {
        status: 'FAILED',
        errors: [{
          erro: error instanceof Error ? error.message : 'Erro crítico no processamento'
        }]
      }
    });
  }
}

// ================================
// CONFIGURAÇÃO EXPERIMENTAL NEXT.JS
// ================================

// Para suportar upload de arquivos no Next.js 13+
export const config = {
  api: {
    bodyParser: false,
  },
};