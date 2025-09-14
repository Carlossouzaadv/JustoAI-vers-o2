// ================================
// API GERENCIAMENTO DE ALERTAS
// ================================
// Endpoints para visualizar e gerenciar alertas de processos

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { validateAuth } from '@/lib/auth';
import { apiResponse, ApiError, validateJson } from '@/lib/api-utils';
import { getGlobalAlertManager } from '@/lib/process-alerts';
import { ICONS } from '@/lib/icons';

// ================================
// SCHEMAS DE VALIDAÇÃO
// ================================

const QuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  read: z.enum(['true', 'false', 'all']).default('all'),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  type: z.enum(['MOVEMENT', 'DEADLINE', 'ERROR', 'SYNC_FAILURE', 'IMPORTANT_DECISION']).optional(),
  processId: z.string().optional(),
  sortBy: z.enum(['createdAt', 'severity', 'type']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

const MarkReadSchema = z.object({
  alertIds: z.array(z.string()).min(1, 'Pelo menos um alerta deve ser fornecido'),
  markAsRead: z.boolean().default(true)
});

const CreateCustomAlertSchema = z.object({
  processId: z.string().min(1, 'ID do processo é obrigatório'),
  title: z.string().min(1, 'Título é obrigatório').max(200),
  message: z.string().min(1, 'Mensagem é obrigatória').max(2000),
  type: z.enum(['MOVEMENT', 'DEADLINE', 'ERROR', 'SYNC_FAILURE', 'IMPORTANT_DECISION']).default('MOVEMENT'),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM')
});

// ================================
// GET - LISTAR ALERTAS
// ================================

export async function GET(request: NextRequest) {
  try {
    const { workspace } = await validateAuth(request);
    const { searchParams } = new URL(request.url);

    // Validar query parameters
    const query = QuerySchema.parse({
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '20',
      read: searchParams.get('read') || 'all',
      severity: searchParams.get('severity') || undefined,
      type: searchParams.get('type') || undefined,
      processId: searchParams.get('processId') || undefined,
      sortBy: searchParams.get('sortBy') || 'createdAt',
      sortOrder: searchParams.get('sortOrder') || 'desc'
    });

    // Verificar se é para estatísticas apenas
    if (searchParams.get('stats') === 'true') {
      const alertManager = getGlobalAlertManager();
      const stats = await alertManager.getAlertStatistics(workspace.id);

      return apiResponse({ stats });
    }

    const offset = (query.page - 1) * query.limit;

    // Construir filtros
    const where: any = {
      monitoredProcess: {
        workspaceId: workspace.id
      }
    };

    if (query.read === 'true') {
      where.read = true;
    } else if (query.read === 'false') {
      where.read = false;
    }

    if (query.severity) {
      where.severity = query.severity;
    }

    if (query.type) {
      where.type = query.type;
    }

    if (query.processId) {
      where.monitoredProcessId = query.processId;
    }

    // Configurar ordenação
    let orderBy: any = {};

    if (query.sortBy === 'severity') {
      // Ordenação especial para severidade (URGENT > HIGH > MEDIUM > LOW)
      orderBy = [
        {
          severity: query.sortOrder === 'desc' ? 'desc' : 'asc'
        },
        { createdAt: 'desc' }
      ];
    } else {
      orderBy = { [query.sortBy]: query.sortOrder };
    }

    // Buscar alertas com contagem total
    const [alerts, total] = await Promise.all([
      prisma.processAlert.findMany({
        where,
        skip: offset,
        take: query.limit,
        orderBy,
        include: {
          monitoredProcess: {
            select: {
              id: true,
              processNumber: true,
              clientName: true,
              court: true
            }
          },
          movement: {
            select: {
              id: true,
              date: true,
              type: true,
              category: true,
              description: true
            }
          }
        }
      }),
      prisma.processAlert.count({ where })
    ]);

    // Estatísticas rápidas
    const quickStats = await prisma.processAlert.groupBy({
      by: ['read'],
      where: {
        monitoredProcess: {
          workspaceId: workspace.id
        }
      },
      _count: true
    });

    const readStats = quickStats.reduce((acc, stat) => {
      acc[stat.read ? 'read' : 'unread'] = stat._count;
      return acc;
    }, { read: 0, unread: 0 } as Record<string, number>);

    return apiResponse({
      alerts,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit)
      },
      stats: {
        total,
        ...readStats
      }
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro ao listar alertas:`, error);

    if (error instanceof ApiError) {
      return apiResponse({ error: error.message }, error.statusCode);
    }

    return apiResponse({
      error: 'Erro interno do servidor'
    }, 500);
  }
}

// ================================
// POST - CRIAR ALERTA CUSTOMIZADO
// ================================

export async function POST(request: NextRequest) {
  try {
    const { workspace } = await validateAuth(request);
    const body = await validateJson(request, CreateCustomAlertSchema);

    // Verificar se o processo existe e pertence ao workspace
    const process = await prisma.monitoredProcess.findFirst({
      where: {
        id: body.processId,
        workspaceId: workspace.id
      }
    });

    if (!process) {
      throw new ApiError('Processo não encontrado ou não pertence ao workspace', 404);
    }

    const alertManager = getGlobalAlertManager();
    const alertId = await alertManager.createCustomAlert(
      body.processId,
      body.title,
      body.message,
      body.type,
      body.severity
    );

    // Buscar o alerta criado para retornar
    const createdAlert = await prisma.processAlert.findUnique({
      where: { id: alertId },
      include: {
        monitoredProcess: {
          select: {
            id: true,
            processNumber: true,
            clientName: true,
            court: true
          }
        }
      }
    });

    console.log(`${ICONS.SUCCESS} Alerta customizado criado:`, {
      id: alertId,
      processNumber: process.processNumber,
      title: body.title
    });

    return apiResponse({
      alert: createdAlert,
      message: 'Alerta criado com sucesso'
    }, 201);

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro ao criar alerta:`, error);

    if (error instanceof ApiError) {
      return apiResponse({ error: error.message }, error.statusCode);
    }

    return apiResponse({
      error: 'Erro interno do servidor'
    }, 500);
  }
}

// ================================
// PATCH - MARCAR ALERTAS COMO LIDOS
// ================================

export async function PATCH(request: NextRequest) {
  try {
    const { workspace } = await validateAuth(request);
    const body = await validateJson(request, MarkReadSchema);

    const alertManager = getGlobalAlertManager();
    const updatedCount = await alertManager.markAlertsAsRead(
      body.alertIds,
      workspace.id
    );

    if (updatedCount === 0) {
      throw new ApiError('Nenhum alerta foi atualizado. Verifique os IDs fornecidos', 404);
    }

    console.log(`${ICONS.SUCCESS} Alertas marcados como lidos:`, {
      count: updatedCount,
      alertIds: body.alertIds
    });

    return apiResponse({
      updated: updatedCount,
      message: `${updatedCount} alertas marcados como ${body.markAsRead ? 'lidos' : 'não lidos'}`
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro ao atualizar alertas:`, error);

    if (error instanceof ApiError) {
      return apiResponse({ error: error.message }, error.statusCode);
    }

    return apiResponse({
      error: 'Erro interno do servidor'
    }, 500);
  }
}

// ================================
// DELETE - REMOVER ALERTAS
// ================================

export async function DELETE(request: NextRequest) {
  try {
    const { workspace } = await validateAuth(request);
    const { searchParams } = new URL(request.url);

    const alertIds = searchParams.get('ids')?.split(',').filter(Boolean);
    const action = searchParams.get('action');

    if (action === 'cleanup') {
      // Limpeza de alertas antigos
      const daysOld = parseInt(searchParams.get('daysOld') || '90');
      const alertManager = getGlobalAlertManager();
      const deletedCount = await alertManager.cleanupOldAlerts(daysOld);

      return apiResponse({
        deleted: deletedCount,
        message: `${deletedCount} alertas antigos removidos`
      });
    }

    if (!alertIds || alertIds.length === 0) {
      throw new ApiError('IDs dos alertas devem ser fornecidos', 400);
    }

    // Verificar se os alertas pertencem ao workspace
    const alertsToDelete = await prisma.processAlert.findMany({
      where: {
        id: { in: alertIds },
        monitoredProcess: {
          workspaceId: workspace.id
        }
      },
      select: {
        id: true,
        title: true
      }
    });

    if (alertsToDelete.length === 0) {
      throw new ApiError('Nenhum alerta encontrado para remoção', 404);
    }

    // Remover alertas
    const deleted = await prisma.processAlert.deleteMany({
      where: {
        id: { in: alertsToDelete.map(a => a.id) }
      }
    });

    console.log(`${ICONS.SUCCESS} Alertas removidos:`, {
      count: deleted.count,
      ids: alertsToDelete.map(a => a.id)
    });

    return apiResponse({
      deleted: deleted.count,
      alerts: alertsToDelete,
      message: `${deleted.count} alertas removidos`
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro ao remover alertas:`, error);

    if (error instanceof ApiError) {
      return apiResponse({ error: error.message }, error.statusCode);
    }

    return apiResponse({
      error: 'Erro interno do servidor'
    }, 500);
  }
}