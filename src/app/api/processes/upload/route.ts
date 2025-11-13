// ================================
// API UPLOAD EXCEL DE PROCESSOS
// ================================
// Endpoint para upload em lote de processos via arquivo Excel

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { validateAuth } from '@/lib/auth';
import { apiResponse, errorResponse, ApiError } from '@/lib/api-utils';
import {
  createProductionParser,
  ExcelTemplateGenerator
} from '@/lib/excel-parser';
import {
  createProcessApiClient,
  normalizeProcessNumber
} from '@/lib/process-apis';
import { ICONS } from '@/lib/icons';

// ================================
// TYPE GUARDS & TYPE DEFINITIONS
// ================================

/**
 * Type guard for FormData file value
 * Validates that an unknown value is a valid File object
 */
function isFile(value: unknown): value is File {
  return value instanceof File;
}

/**
 * Valid SyncFrequency values from Prisma schema
 */
type SyncFrequencyValue = 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MANUAL';

/**
 * Type guard for SyncFrequency validation
 * Validates that a string is a valid SyncFrequency enum value
 */
function isSyncFrequency(value: unknown): value is SyncFrequencyValue {
  return (
    typeof value === 'string' &&
    ['HOURLY', 'DAILY', 'WEEKLY', 'MANUAL'].includes(value)
  );
}

/**
 * Helper to get a valid SyncFrequency value
 * Uses default if invalid or missing
 */
function getSyncFrequency(value: unknown): SyncFrequencyValue {
  if (isSyncFrequency(value)) {
    return value;
  }
  return 'DAILY'; // Default as per schema
}

/**
 * Type guard for ProcessApiData validation
 * Ensures the API response data has the expected structure
 */
function isProcessApiData(data: unknown): data is ProcessApiData {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const d = data as ProcessApiData;

  // Check for optional movements array
  if ('movements' in d && d.movements !== undefined) {
    if (!Array.isArray(d.movements)) {
      return false;
    }
    // Validate each movement has the required structure
    return d.movements.every(isProcessMovement);
  }

  return true;
}

/**
 * Type guard for ProcessMovement validation
 */
function isProcessMovement(movement: unknown): movement is ProcessMovement {
  if (typeof movement !== 'object' || movement === null) {
    return false;
  }

  const m = movement as ProcessMovement;
  return (
    typeof m.date === 'string' &&
    typeof m.type === 'string' &&
    typeof m.description === 'string' &&
    (m.category === undefined || typeof m.category === 'string') &&
    (m.importance === undefined || typeof m.importance === 'string') &&
    (m.requiresAction === undefined || typeof m.requiresAction === 'boolean') &&
    (m.deadline === undefined || typeof m.deadline === 'string')
  );
}

/**
 * Helper to safely extract error message from unknown error
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Erro desconhecido';
}

/**
 * Valid MovementCategory enum values from Prisma schema
 */
type MovementCategoryValue =
  | 'HEARING'
  | 'DECISION'
  | 'PETITION'
  | 'DOCUMENT_REQUEST'
  | 'DEADLINE'
  | 'NOTIFICATION'
  | 'APPEAL'
  | 'SETTLEMENT'
  | 'OTHER';

/**
 * Type guard for MovementCategory validation
 */
function isMovementCategory(value: unknown): value is MovementCategoryValue {
  return (
    typeof value === 'string' &&
    [
      'HEARING',
      'DECISION',
      'PETITION',
      'DOCUMENT_REQUEST',
      'DEADLINE',
      'NOTIFICATION',
      'APPEAL',
      'SETTLEMENT',
      'OTHER'
    ].includes(value)
  );
}

/**
 * Helper to get a valid MovementCategory value
 */
function getMovementCategory(value: unknown): MovementCategoryValue {
  if (isMovementCategory(value)) {
    return value;
  }
  return 'OTHER'; // Default
}

/**
 * Valid Priority enum values from Prisma schema
 */
type PriorityValue = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

/**
 * Type guard for Priority validation
 */
function isPriority(value: unknown): value is PriorityValue {
  return (
    typeof value === 'string' &&
    ['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(value)
  );
}

/**
 * Helper to get a valid Priority value
 */
function getPriority(value: unknown): PriorityValue {
  if (isPriority(value)) {
    return value;
  }
  return 'MEDIUM'; // Default
}

/**
 * Helper to get string value with fallback
 */
function getStringValue(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  return fallback;
}

// ================================
// CONFIGURAÇÃO DE UPLOAD
// ================================

/**
 * Allowed MIME types for Excel files
 */
const ALLOWED_EXCEL_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel'
]);

/**
 * Maximum file size: 10MB
 */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Type guard to validate Excel file MIME type
 */
function isExcelFile(file: File): boolean {
  return ALLOWED_EXCEL_MIMES.has(file.type);
}

/**
 * Type guard to validate file size
 */
function isValidFileSize(file: File): boolean {
  return file.size > 0 && file.size <= MAX_FILE_SIZE;
}

// ================================
// POST - UPLOAD DE ARQUIVO EXCEL
// ================================

export async function POST(request: NextRequest) {
  try {
    // Autenticação
    const { workspace } = await validateAuth();

    // PASSO 1: Obter formData do request (nativo Next.js - 100% type-safe)
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (formError) {
      console.error(`${ICONS.ERROR} Erro ao obter form data:`, getErrorMessage(formError));
      throw new ApiError('Erro ao processar upload: formato inválido', 400);
    }

    // PASSO 2: Extrair arquivo do formData
    const fileValue = formData.get('file');

    // Type guard: validar que obtemos um File
    if (!isFile(fileValue)) {
      throw new ApiError('Nenhum arquivo encontrado no upload', 400);
    }

    // Após type guard, fileValue é seguramente do tipo File
    const file = fileValue;

    // PASSO 3: Validar tipo MIME (Excel)
    if (!isExcelFile(file)) {
      throw new ApiError(
        `Tipo de arquivo inválido. Esperado: Excel (.xlsx, .xls). Recebido: ${file.type || 'desconhecido'}`,
        400
      );
    }

    // PASSO 4: Validar tamanho do arquivo
    if (!isValidFileSize(file)) {
      throw new ApiError(
        `Tamanho de arquivo inválido. Máximo: 10MB. Recebido: ${(file.size / (1024 * 1024)).toFixed(2)}MB`,
        400
      );
    }

    console.log(`${ICONS.UPLOAD} Upload iniciado:`, {
      filename: file.name,
      size: file.size,
      workspace: workspace.name
    });

    // PASSO 5: Converter File para Buffer (necessário para parser)
    let buffer: Buffer;
    try {
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } catch (bufferError) {
      console.error(`${ICONS.ERROR} Erro ao ler arquivo:`, getErrorMessage(bufferError));
      throw new ApiError('Erro ao ler arquivo. Tente novamente.', 400);
    }

    // PASSO 6: Parse do Excel
    const parser = createProductionParser();
    let parseResult;
    try {
      parseResult = await parser.parseExcelBuffer(buffer, file.name);
    } catch (parseError) {
      console.error(`${ICONS.ERROR} Erro ao fazer parse Excel:`, getErrorMessage(parseError));
      throw new ApiError(
        'Erro ao processar arquivo Excel. Verifique o formato.',
        400
      );
    }

    // PASSO 7: Criar registro de batch upload
    const batchUpload = await prisma.processBatchUpload.create({
      data: {
        workspaceId: workspace.id,
        fileName: file.name,
        filePath: `uploads/${workspace.id}/${Date.now()}-${file.name}`,
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

    // PASSO 8: Se há erros críticos no parse, retornar imediatamente
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

    // PASSO 9: Processar linhas válidas em background
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
    console.error(`${ICONS.ERROR} Erro no upload:`, getErrorMessage(error));

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

      // Convert Buffer to Uint8Array for Blob compatibility
      const uint8Array = new Uint8Array(templateBuffer);
      const blob = new Blob([uint8Array], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

      return new NextResponse(blob, {
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
    const { workspace } = await validateAuth();

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
    console.error(`${ICONS.ERROR} Erro ao processar GET:`, getErrorMessage(error));

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

        // Buscar dados do processo via API com type guard
        let processData: ProcessApiData | null = null;
        try {
          const apiResult = await processApi.searchProcess({
            processNumber: normalizedNumber,
            court: row.tribunal,
            clientName: row.nomeCliente,
            includeMovements: true,
            includeParties: true
          });

          // Type guard: validar que apiResult.data é ProcessApiData
          if (apiResult.success && isProcessApiData(apiResult.data)) {
            processData = apiResult.data;
          }
        } catch (apiError) {
          console.log(`${ICONS.WARNING} API falhou para processo ${normalizedNumber}:`, getErrorMessage(apiError));
          // Continua sem os dados da API
        }

        // Validar e usar SyncFrequency com narrowing seguro
        const syncFrequencyValue = getSyncFrequency(row.frequenciaSync);

        // Validar campos obrigatórios com fallbacks seguros
        const courtValue = getStringValue(row.tribunal, 'Não especificado');
        const clientNameValue = getStringValue(row.nomeCliente, 'Importação em Lote');

        // Criar processo monitorado
        const monitoredProcess = await prisma.monitoredProcess.create({
          data: {
            workspaceId,
            processNumber: normalizedNumber,
            court: courtValue,
            clientName: clientNameValue,
            processData: processData ? JSON.parse(JSON.stringify(processData)) : null,
            monitoringStatus: 'ACTIVE',
            syncFrequency: syncFrequencyValue,
            alertsEnabled: row.alertasAtivos ?? true,
            alertRecipients: row.emailsAlerta || [],
            source: processData ? 'JUDIT_API' : 'EXCEL_UPLOAD',
            extractionMethod: 'API'
          }
        });

        // Se temos movimentações da API, criar registros com type narrowing
        if (processData?.movements && Array.isArray(processData.movements) && processData.movements.length > 0) {
          await Promise.all(
            processData.movements
              .slice(0, 20)
              .filter(isProcessMovement) // Filter for valid movements only
              .map(async (movement: ProcessMovement) => {
                // Convert strings to valid enum values using type guards
                const categoryValue = getMovementCategory(movement.category);
                const importanceValue = getPriority(movement.importance);

                return prisma.processMovement.create({
                  data: {
                    monitoredProcessId: monitoredProcess.id,
                    date: new Date(movement.date),
                    type: movement.type,
                    description: movement.description,
                    category: categoryValue,
                    importance: importanceValue,
                    requiresAction: movement.requiresAction ?? false,
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
        console.error(`${ICONS.ERROR} Erro ao processar linha ${row.linha}:`, getErrorMessage(rowError));
        errors.push({
          linha: row.linha,
          processo: row.numeroProcesso,
          erro: getErrorMessage(rowError)
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

    // Atualização final - ensure JSON fields are serializable
    const summaryData = {
      parseResult: { valid: successful, invalid: failed },
      processingErrors: errors,
      timestamp: new Date().toISOString()
    };

    await prisma.processBatchUpload.update({
      where: { id: batchId },
      data: {
        status: 'COMPLETED',
        processed: validRows.length,
        successful,
        failed,
        errors: errors.length > 0 ? JSON.parse(JSON.stringify(errors)) : null,
        summary: JSON.parse(JSON.stringify(summaryData))
      }
    });

    console.log(`${ICONS.SUCCESS} Batch processado: ${successful} sucessos, ${failed} falhas`);

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro crítico no processamento:`, getErrorMessage(error));

    const errorData = JSON.parse(JSON.stringify([{
      erro: getErrorMessage(error)
    }]));

    await prisma.processBatchUpload.update({
      where: { id: batchId },
      data: {
        status: 'FAILED',
        errors: errorData
      }
    });
  }
}

// ================================
// CONFIGURAÇÃO NEXT.JS
// ================================

// Next.js 14 app router nativamente suporta formData parsing
// Nenhuma configuração adicional necessária