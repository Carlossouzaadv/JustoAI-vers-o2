// ================================
// API CRUD PROCESSOS MONITORADOS
// ================================
// Gerenciamento completo de processos em monitoramento

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { validateAuth } from '@/lib/auth';
import { apiResponse, ApiError, validateJson } from '@/lib/api-utils';
import {
  createProcessApiClient,
  validateProcessNumber,
  normalizeProcessNumber
} from '@/lib/process-apis';
import { ICONS } from '@/lib/icons';

// ================================
// SCHEMAS DE VALIDAÇÃO
// ================================

const CreateProcessSchema = z.object({
  processNumber: z.string().min(1, 'Número do processo é obrigatório'),
  court: z.string().min(1, 'Tribunal é obrigatório'),
  clientName: z.string().min(1, 'Nome do cliente é obrigatório'),
  caseId: z.string().optional(),
  syncFrequency: z.enum(['HOURLY', 'DAILY', 'WEEKLY', 'MANUAL']).default('DAILY'),
  alertsEnabled: z.boolean().default(true),
  alertRecipients: z.array(z.string().email()).default([]),
  fetchInitialData: z.boolean().default(true)
});

const UpdateProcessSchema = z.object({
  court: z.string().min(1).optional(),
  clientName: z.string().min(1).optional(),
  caseId: z.string().nullable().optional(),
  monitoringStatus: z.enum(['ACTIVE', 'PAUSED', 'STOPPED', 'ERROR']).optional(),
  syncFrequency: z.enum(['HOURLY', 'DAILY', 'WEEKLY', 'MANUAL']).optional(),
  alertsEnabled: z.boolean().optional(),
  alertRecipients: z.array(z.string().email()).optional()
});

const QuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  status: z.enum(['ACTIVE', 'PAUSED', 'STOPPED', 'ERROR']).optional(),
  court: z.string().optional(),
  hasCase: z.enum(['true', 'false']).optional(),
  sortBy: z.enum(['createdAt', 'processNumber', 'clientName', 'lastSync']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

// ================================
// GET - LISTAR PROCESSOS MONITORADOS
// ================================

export async function GET(request: NextRequest) {
  try {
    const { workspace } = await validateAuth(request);
    const { searchParams } = new URL(request.url);

    // Validar query parameters
    const query = QuerySchema.parse({
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '20',
      search: searchParams.get('search') || undefined,
      status: searchParams.get('status') || undefined,
      court: searchParams.get('court') || undefined,
      hasCase: searchParams.get('hasCase') || undefined,
      sortBy: searchParams.get('sortBy') || 'createdAt',
      sortOrder: searchParams.get('sortOrder') || 'desc'
    });

    const offset = (query.page - 1) * query.limit;

    // Construir filtros
    const where: any = {
      workspaceId: workspace.id
    };

    if (query.search) {
      where.OR = [
        { processNumber: { contains: query.search, mode: 'insensitive' } },
        { clientName: { contains: query.search, mode: 'insensitive' } },
        { court: { contains: query.search, mode: 'insensitive' } }
      ];
    }

    if (query.status) {
      where.monitoringStatus = query.status;
    }

    if (query.court) {
      where.court = { contains: query.court, mode: 'insensitive' };
    }

    if (query.hasCase === 'true') {
      where.caseId = { not: null };
    } else if (query.hasCase === 'false') {
      where.caseId = null;
    }

    // Buscar processos com contagem total
    const [processes, total] = await Promise.all([
      prisma.monitoredProcess.findMany({
        where,
        skip: offset,
        take: query.limit,
        orderBy: { [query.sortBy]: query.sortOrder },
        include: {
          case: {
            select: {
              id: true,
              title: true,
              status: true,
              type: true
            }
          },
          movements: {
            take: 5,
            orderBy: { date: 'desc' },
            select: {
              id: true,
              date: true,
              type: true,
              description: true,
              category: true,
              importance: true,
              requiresAction: true,
              read: true
            }
          },
          alerts: {
            where: { read: false },
            take: 3,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              title: true,
              type: true,
              severity: true,
              createdAt: true
            }
          },
          _count: {
            select: {
              movements: true,
              alerts: true
            }
          }
        }
      }),
      prisma.monitoredProcess.count({ where })
    ]);

    // Calcular estatísticas
    const stats = await prisma.monitoredProcess.groupBy({
      by: ['monitoringStatus'],
      where: { workspaceId: workspace.id },
      _count: true
    });

    const statusStats = stats.reduce((acc, stat) => {
      acc[stat.monitoringStatus] = stat._count;
      return acc;
    }, {} as Record<string, number>);

    return apiResponse({
      processes,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit)
      },
      stats: {
        total,
        byStatus: statusStats
      }
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro ao listar processos:`, error);

    if (error instanceof ApiError) {
      return apiResponse({ error: error.message }, error.statusCode);
    }

    return apiResponse({
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, 500);
  }
}

// ================================
// POST - CRIAR NOVO PROCESSO MONITORADO
// ================================

export async function POST(request: NextRequest) {
  try {
    const { user, workspace } = await validateAuth(request);
    const body = await validateJson(request, CreateProcessSchema);

    // Normalizar e validar número do processo
    const normalizedNumber = normalizeProcessNumber(body.processNumber);

    if (!validateProcessNumber(normalizedNumber)) {
      throw new ApiError('Número de processo inválido (formato CNJ esperado)', 400);
    }

    // Verificar se já existe
    const existing = await prisma.monitoredProcess.findUnique({
      where: {
        workspaceId_processNumber: {
          workspaceId: workspace.id,
          processNumber: normalizedNumber
        }
      }
    });

    if (existing) {
      throw new ApiError('Processo já está sendo monitorado neste workspace', 409);
    }

    // Verificar se o caso existe (se fornecido)
    let caseExists = null;
    if (body.caseId) {
      caseExists = await prisma.case.findFirst({
        where: {
          id: body.caseId,
          workspaceId: workspace.id
        }
      });

      if (!caseExists) {
        throw new ApiError('Caso não encontrado ou não pertence ao workspace', 404);
      }
    }

    // Buscar dados iniciais do processo (se solicitado)
    let processData = null;
    let initialMovements: any[] = [];

    if (body.fetchInitialData) {
      try {
        const processApi = createProcessApiClient();
        const apiResult = await processApi.searchProcess({
          processNumber: normalizedNumber,
          court: body.court,
          clientName: body.clientName,
          includeMovements: true,
          includeParties: true
        });

        if (apiResult.success && apiResult.data) {
          processData = apiResult.data;
          initialMovements = apiResult.data.movements.slice(0, 50); // Limite inicial
        }
      } catch (apiError) {
        console.warn(`${ICONS.WARNING} Erro ao buscar dados iniciais:`, apiError);
        // Continua sem os dados da API
      }
    }

    // Criar processo monitorado
    const monitoredProcess = await prisma.monitoredProcess.create({
      data: {
        workspaceId: workspace.id,
        caseId: body.caseId,
        processNumber: normalizedNumber,
        court: body.court,
        clientName: body.clientName,
        processData: processData ? JSON.parse(JSON.stringify(processData)) : null,
        monitoringStatus: 'ACTIVE',
        syncFrequency: body.syncFrequency,
        alertsEnabled: body.alertsEnabled,
        alertRecipients: body.alertRecipients,
        source: processData ? 'JUDIT_API' : 'MANUAL_INPUT',
        extractionMethod: 'API',
        lastSync: processData ? new Date() : null
      },
      include: {
        case: {
          select: {
            id: true,
            title: true,
            status: true
          }
        }
      }
    });

    // Criar movimentações iniciais (se existem)
    if (initialMovements.length > 0) {
      await prisma.processMovement.createMany({
        data: initialMovements.map(movement => ({
          monitoredProcessId: monitoredProcess.id,
          date: new Date(movement.date),
          type: movement.type,
          description: movement.description,
          category: movement.category,
          importance: movement.importance,
          requiresAction: movement.requiresAction,
          deadline: movement.deadline ? new Date(movement.deadline) : null,
          rawData: JSON.parse(JSON.stringify(movement))
        }))
      });
    }

    // Log de criação
    console.log(`${ICONS.SUCCESS} Processo monitorado criado:`, {
      id: monitoredProcess.id,
      processNumber: normalizedNumber,
      workspace: workspace.name,
      initialMovements: initialMovements.length
    });

    return apiResponse({
      process: monitoredProcess,
      initialMovements: initialMovements.length,
      message: 'Processo adicionado ao monitoramento com sucesso'
    }, 201);

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro ao criar processo monitorado:`, error);

    if (error instanceof ApiError) {
      return apiResponse({ error: error.message }, error.statusCode);
    }

    return apiResponse({
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, 500);
  }
}

// ================================
// DELETE - REMOVER PROCESSOS EM LOTE
// ================================

export async function DELETE(request: NextRequest) {
  try {
    const { workspace } = await validateAuth(request);
    const { searchParams } = new URL(request.url);

    const ids = searchParams.get('ids')?.split(',').filter(Boolean);
    const processNumbers = searchParams.get('processNumbers')?.split(',').filter(Boolean);

    if (!ids && !processNumbers) {
      throw new ApiError('IDs ou números de processo devem ser fornecidos', 400);
    }

    let where: any = {
      workspaceId: workspace.id
    };

    if (ids) {
      where.id = { in: ids };
    } else if (processNumbers) {
      where.processNumber = { in: processNumbers.map(n => normalizeProcessNumber(n)) };
    }

    // Buscar processos que serão removidos
    const processesToDelete = await prisma.monitoredProcess.findMany({
      where,
      select: {
        id: true,
        processNumber: true,
        clientName: true
      }
    });

    if (processesToDelete.length === 0) {
      throw new ApiError('Nenhum processo encontrado para remoção', 404);
    }

    // Remover (cascade automático remove movimentações, alertas, etc.)
    const deleted = await prisma.monitoredProcess.deleteMany({
      where
    });

    console.log(`${ICONS.SUCCESS} Processos removidos:`, {
      count: deleted.count,
      processes: processesToDelete.map(p => p.processNumber)
    });

    return apiResponse({
      deleted: deleted.count,
      processes: processesToDelete,
      message: `${deleted.count} processos removidos do monitoramento`
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro ao remover processos:`, error);

    if (error instanceof ApiError) {
      return apiResponse({ error: error.message }, error.statusCode);
    }

    return apiResponse({
      error: 'Erro interno do servidor'
    }, 500);
  }
}