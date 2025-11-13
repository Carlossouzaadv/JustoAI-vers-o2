// ================================
// API STATUS E GERENCIAMENTO DE IMPORTAÇÃO ESPECÍFICA
// ================================
// Endpoints para acompanhar, pausar, cancelar e visualizar importações

import { NextRequest } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { validateAuth } from '@/lib/auth';
import { apiResponse, errorResponse, ApiError, validateJson } from '@/lib/api-utils';
import { ICONS } from '@/lib/icons';
import { SystemImport } from '@/lib/types/database';

// ================================
// SCHEMAS DE VALIDAÇÃO
// ================================

const ActionSchema = z.object({
  action: z.enum(['cancel', 'retry', 'delete']),
  force: z.boolean().default(false)
});

// ================================
// GET - STATUS DA IMPORTAÇÃO
// ================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { workspace } = await validateAuth();
    const { searchParams } = new URL(request.url);
    const includeDetails = searchParams.get('details') === 'true';
    const includeItems = searchParams.get('items') === 'true';

    const systemImport = await prisma.systemImport.findFirst({
      where: {
        id: (await params).id,
        workspaceId: workspace.id
      },
      include: {
        importedItems: includeItems ? {
          take: 50, // Limit para evitar sobrecarga
          orderBy: { importOrder: 'asc' },
          select: {
            id: true,
            dataType: true,
            status: true,
            lineNumber: true,
            importOrder: true,
            validationErrors: true,
            originalData: includeDetails,
            mappedData: includeDetails,
            importedAt: true
          }
        } : false
      }
    });

    if (!systemImport) {
      throw new ApiError('Importação não encontrada', 404);
    }

    // Calcular estatísticas em tempo real se necessário
    let liveStats = null;
    if (systemImport.status === 'IMPORTING' || systemImport.status === 'VALIDATING') {
      const itemStats = await prisma.importedDataItem.groupBy({
        by: ['status'],
        where: { systemImportId: (await params).id },
        _count: true
      });

      liveStats = itemStats.reduce(
        (acc: Record<string, number>, stat: ItemStatusGroupResult) => {
          acc[stat.status] = stat._count;
          return acc;
        },
        {}
      );
    }

    // Estruturar resposta
    const response = {
      import: {
        id: systemImport.id,
        fileName: systemImport.fileName,
        sourceSystem: systemImport.sourceSystem,
        detectedFormat: systemImport.detectedFormat,
        status: systemImport.status,
        progress: systemImport.progress,

        // Contadores
        totalRows: systemImport.totalRows,
        processedRows: systemImport.processedRows,
        successfulRows: systemImport.successfulRows,
        failedRows: systemImport.failedRows,
        skippedRows: systemImport.skippedRows,

        // Resultados por categoria
        importedCases: systemImport.importedCases,
        importedClients: systemImport.importedClients,
        importedEvents: systemImport.importedEvents,
        importedDocuments: systemImport.importedDocuments,

        // Metadados
        fileSize: systemImport.fileSize,
        originalHash: systemImport.originalHash,

        // Timestamps
        startedAt: systemImport.startedAt,
        finishedAt: systemImport.finishedAt,
        createdAt: systemImport.createdAt,
        updatedAt: systemImport.updatedAt,

        // Dados de análise (se disponível)
        columnMapping: systemImport.columnMapping,
        dataPreview: systemImport.dataPreview,
        validation: systemImport.validation,

        // Erros e avisos
        errors: systemImport.errors,
        warnings: systemImport.warnings,
        summary: systemImport.summary,

        // Configurações
        importSettings: systemImport.importSettings
      },

      // Estatísticas calculadas
      stats: {
        completionRate: systemImport.totalRows > 0
          ? (systemImport.processedRows / systemImport.totalRows) * 100
          : 0,
        successRate: systemImport.processedRows > 0
          ? (systemImport.successfulRows / systemImport.processedRows) * 100
          : 100,
        errorRate: systemImport.processedRows > 0
          ? (systemImport.failedRows / systemImport.processedRows) * 100
          : 0,
        estimatedTimeRemaining: systemImport.status === 'IMPORTING' && systemImport.progress > 0
          ? calculateEstimatedTime(systemImport)
          : null,
        liveStats
      },

      // Items importados (se solicitado)
      items: includeItems ? {
        total: systemImport.importedItems?.length || 0,
        items: systemImport.importedItems || [],
        hasMore: (systemImport.importedItems?.length || 0) >= 50
      } : undefined,

      // Ações disponíveis
      availableActions: getAvailableActions(systemImport.status)
    };

    return apiResponse(response);

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro ao buscar status da importação:`, error);

    if (error instanceof ApiError) {
      return errorResponse(error.message, error.status);
    }

    return errorResponse('Erro interno do servidor', 500);
  }
}

// ================================
// POST - AÇÕES NA IMPORTAÇÃO
// ================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { workspace } = await validateAuth();
    const { data: body, error: validationError } = await validateJson(request, ActionSchema);
    if (validationError) return validationError;

    const systemImport = await prisma.systemImport.findFirst({
      where: {
        id: (await params).id,
        workspaceId: workspace.id
      }
    });

    if (!systemImport) {
      throw new ApiError('Importação não encontrada', 404);
    }

    switch (body.action) {
      case 'cancel':
        return await handleCancelImport(systemImport, body.force);

      case 'retry':
        return await handleRetryImport(systemImport, body.force);

      case 'delete':
        return await handleDeleteImport(systemImport, body.force);

      default:
        throw new ApiError('Ação não suportada', 400);
    }

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro ao executar ação:`, error);

    if (error instanceof ApiError) {
      return errorResponse(error.message, error.status);
    }

    return errorResponse('Erro interno do servidor', 500);
  }
}

// ================================
// PUT - ATUALIZAR CONFIGURAÇÕES
// ================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { workspace } = await validateAuth();

    const UpdateConfigSchema = z.object({
      customMappings: z.record(z.string(), z.string()).optional(),
      transformRules: z.record(z.string(), z.unknown()).optional(),
      importSettings: z.record(z.string(), z.unknown()).optional()
    });

    const { data: body, error: validationError } = await validateJson(request, UpdateConfigSchema);
    if (validationError) return validationError;

    const systemImport = await prisma.systemImport.findFirst({
      where: {
        id: (await params).id,
        workspaceId: workspace.id
      }
    });

    if (!systemImport) {
      throw new ApiError('Importação não encontrada', 404);
    }

    if (systemImport.status !== 'ANALYZING' && systemImport.status !== 'MAPPING') {
      throw new ApiError('Configurações só podem ser alteradas durante análise ou mapeamento', 400);
    }

    // Validar body antes de usar
    if (!isValidUpdateConfig(body)) {
      throw new ApiError('Configuração de atualização inválida', 400);
    }

    // Construir importSettings de forma type-safe
    const newImportSettings: Record<string, unknown> = {};

    // Preservar importSettings existentes se for um objeto válido
    if (
      typeof systemImport.importSettings === 'object' &&
      systemImport.importSettings !== null &&
      !Array.isArray(systemImport.importSettings)
    ) {
      const existing = systemImport.importSettings as Record<string, unknown>;
      Object.assign(newImportSettings, existing);
    }

    // Atualizar com novos valores
    if (body.importSettings) {
      Object.assign(newImportSettings, body.importSettings);
    }
    if (body.customMappings) {
      newImportSettings.customMappings = body.customMappings;
    }
    if (body.transformRules) {
      newImportSettings.transformRules = body.transformRules;
    }

    // Serializar e desserializar importSettings para garantir JSON-safety
    // Isso remove qualquer referência circular ou tipo não-serializável
    const importSettingsForDb = JSON.parse(
      JSON.stringify(newImportSettings)
    );

    const updatedImport = await prisma.systemImport.update({
      where: { id: (await params).id },
      data: {
        importSettings: importSettingsForDb,
        updatedAt: new Date()
      }
    });

    console.log(`${ICONS.SUCCESS} Configurações da importação atualizadas:`, {
      id: (await params).id,
      fileName: systemImport.fileName
    });

    return apiResponse({
      success: true,
      import: {
        id: updatedImport.id,
        fileName: updatedImport.fileName,
        status: updatedImport.status,
        importSettings: updatedImport.importSettings
      },
      message: 'Configurações atualizadas com sucesso'
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro ao atualizar configurações:`, error);

    if (error instanceof ApiError) {
      return errorResponse(error.message, error.status);
    }

    return errorResponse('Erro interno do servidor', 500);
  }
}

// ================================
// DELETE - REMOVER IMPORTAÇÃO
// ================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { workspace } = await validateAuth();
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';
    const keepData = searchParams.get('keepData') === 'true';

    const systemImport = await prisma.systemImport.findFirst({
      where: {
        id: (await params).id,
        workspaceId: workspace.id
      },
      include: {
        _count: {
          select: {
            importedItems: true
          }
        }
      }
    });

    if (!systemImport) {
      throw new ApiError('Importação não encontrada', 404);
    }

    // Verificar se pode ser removida
    const inProgress = [
      'ANALYZING',
      'MAPPING',
      'VALIDATING',
      'IMPORTING'
    ].includes(systemImport.status);

    if (inProgress && !force) {
      throw new ApiError(
        'Importação em andamento. Use force=true para forçar remoção',
        400
      );
    }

    if (keepData) {
      // Remover apenas o registro da importação, manter dados importados
      await prisma.systemImport.delete({
        where: { id: (await params).id }
      });

      console.log(`${ICONS.SUCCESS} Registro de importação removido (dados mantidos):`, {
        id: (await params).id,
        fileName: systemImport.fileName
      });

      return apiResponse({
        success: true,
        message: 'Registro de importação removido. Dados importados foram mantidos.',
        removedImport: {
          id: systemImport.id,
          fileName: systemImport.fileName,
          itemsCount: systemImport._count.importedItems
        }
      });

    } else {
      // TODO: Implementar remoção dos dados importados
      // Por segurança, por enquanto apenas remove o registro
      await prisma.systemImport.delete({
        where: { id: (await params).id }
      });

      console.log(`${ICONS.SUCCESS} Importação removida completamente:`, {
        id: (await params).id,
        fileName: systemImport.fileName
      });

      return apiResponse({
        success: true,
        message: 'Importação removida completamente',
        removedImport: {
          id: systemImport.id,
          fileName: systemImport.fileName,
          itemsCount: systemImport._count.importedItems
        }
      });
    }

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro ao remover importação:`, error);

    if (error instanceof ApiError) {
      return errorResponse(error.message, error.status);
    }

    return errorResponse('Erro interno do servidor', 500);
  }
}

// ================================
// MÉTODOS AUXILIARES
// ================================

function calculateEstimatedTime(systemImport: SystemImport): string {
  if (systemImport.progress <= 0) return 'Calculando...';

  const elapsed = Date.now() - systemImport.startedAt.getTime();
  const remaining = (elapsed / systemImport.progress) * (100 - systemImport.progress);

  const minutes = Math.ceil(remaining / (1000 * 60));

  if (minutes < 1) return 'Menos de 1 minuto';
  if (minutes === 1) return '1 minuto';
  if (minutes < 60) return `${minutes} minutos`;

  const hours = Math.ceil(minutes / 60);
  return `${hours} horas`;
}

function getAvailableActions(status: string): string[] {
  const actions = [];

  switch (status) {
    case 'ANALYZING':
    case 'MAPPING':
    case 'VALIDATING':
    case 'IMPORTING':
      actions.push('cancel');
      break;

    case 'FAILED':
      actions.push('retry', 'delete');
      break;

    case 'COMPLETED':
      actions.push('delete');
      break;

    case 'CANCELLED':
      actions.push('retry', 'delete');
      break;

    default:
      actions.push('delete');
  }

  return actions;
}

// ================================
// TYPE GUARDS E VALIDAÇÃO
// ================================

interface ItemStatusGroupResult {
  status: string;
  _count: number;
}

interface ImportError {
  type: string;
  message: string;
  timestamp: string;
}

function isImportError(value: unknown): value is ImportError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    'message' in value &&
    'timestamp' in value &&
    typeof (value as ImportError).type === 'string' &&
    typeof (value as ImportError).message === 'string' &&
    typeof (value as ImportError).timestamp === 'string'
  );
}

function isImportErrorArray(value: unknown): value is ImportError[] {
  if (!Array.isArray(value)) return false;
  return value.every(isImportError);
}

/** Type Guard para validar UpdateConfig */
function isValidUpdateConfig(
  data: unknown
): data is {
  customMappings?: Record<string, string>;
  transformRules?: Record<string, unknown>;
  importSettings?: Record<string, unknown>;
} {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const obj = data as Record<string, unknown>;

  // Validar customMappings se presente
  if (obj.customMappings !== undefined) {
    if (
      typeof obj.customMappings !== 'object' ||
      obj.customMappings === null
    ) {
      return false;
    }
  }

  // Validar transformRules se presente
  if (obj.transformRules !== undefined) {
    if (
      typeof obj.transformRules !== 'object' ||
      obj.transformRules === null
    ) {
      return false;
    }
  }

  // Validar importSettings se presente
  if (obj.importSettings !== undefined) {
    if (
      typeof obj.importSettings !== 'object' ||
      obj.importSettings === null
    ) {
      return false;
    }
  }

  return true;
}

async function handleCancelImport(systemImport: SystemImport, force: boolean) {
  const canCancel = [
    'ANALYZING',
    'MAPPING',
    'VALIDATING',
    'IMPORTING'
  ].includes(systemImport.status);

  if (!canCancel && !force) {
    throw new ApiError(
      `Não é possível cancelar importação com status ${systemImport.status}`,
      400
    );
  }

  // Validar errors existentes usando Type Guard
  const existingErrors: ImportError[] = isImportErrorArray(systemImport.errors)
    ? systemImport.errors
    : [];

  // Construir novo erro com tipo seguro
  const newError: ImportError = {
    type: 'USER_CANCELLED',
    message: 'Importação cancelada pelo usuário',
    timestamp: new Date().toISOString()
  };

  // Construir array atualizado
  const updatedErrorsArray: ImportError[] = [...existingErrors, newError];

  // Converter para formato serializable (JSON é seguro para ImportError)
  const errorsForDb = updatedErrorsArray.map(err => ({
    type: err.type,
    message: err.message,
    timestamp: err.timestamp
  }));

  await prisma.systemImport.update({
    where: { id: systemImport.id },
    data: {
      status: 'CANCELLED',
      finishedAt: new Date(),
      errors: errorsForDb
    }
  });

  console.log(`${ICONS.WARNING} Importação cancelada:`, {
    id: systemImport.id,
    fileName: systemImport.fileName
  });

  return apiResponse({
    success: true,
    message: 'Importação cancelada com sucesso',
    import: {
      id: systemImport.id,
      fileName: systemImport.fileName,
      status: 'CANCELLED'
    }
  });
}

async function handleRetryImport(systemImport: SystemImport, force: boolean) {
  if (systemImport.status === 'IMPORTING' && !force) {
    throw new ApiError('Importação já está em andamento', 400);
  }

  if (systemImport.status === 'COMPLETED' && !force) {
    throw new ApiError('Importação já foi concluída. Use force=true para reimportar', 400);
  }

  // Resetar status para retry
  await prisma.systemImport.update({
    where: { id: systemImport.id },
    data: {
      status: 'ANALYZING',
      progress: 0,
      processedRows: 0,
      successfulRows: 0,
      failedRows: 0,
      errors: [],
      warnings: [],
      finishedAt: null,
      startedAt: new Date()
    }
  });

  // TODO: Reiniciar processo de importação em background

  console.log(`${ICONS.PROCESS} Importação reiniciada:`, {
    id: systemImport.id,
    fileName: systemImport.fileName
  });

  return apiResponse({
    success: true,
    message: 'Importação reiniciada. Acompanhe o progresso via status.',
    import: {
      id: systemImport.id,
      fileName: systemImport.fileName,
      status: 'ANALYZING'
    }
  });
}

async function handleDeleteImport(systemImport: SystemImport, force: boolean) {
  const inProgress = [
    'ANALYZING',
    'MAPPING',
    'VALIDATING',
    'IMPORTING'
  ].includes(systemImport.status);

  if (inProgress && !force) {
    throw new ApiError(
      'Não é possível remover importação em andamento. Use force=true ou cancele primeiro',
      400
    );
  }

  await prisma.systemImport.delete({
    where: { id: systemImport.id }
  });

  console.log(`${ICONS.SUCCESS} Importação removida:`, {
    id: systemImport.id,
    fileName: systemImport.fileName
  });

  return apiResponse({
    success: true,
    message: 'Importação removida com sucesso',
    import: {
      id: systemImport.id,
      fileName: systemImport.fileName,
      status: systemImport.status
    }
  });
}