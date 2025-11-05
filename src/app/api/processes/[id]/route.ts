// ================================
// API PROCESSO MONITORADO ESPECÍFICO
// ================================
// CRUD e ações específicas para um processo monitorado

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { validateAuth } from '@/lib/auth';
import { apiResponse, errorResponse, ApiError, validateJson } from '@/lib/api-utils';
import { createProcessApiClient } from '@/lib/process-apis';
import { ICONS } from '@/lib/icons';

// ================================
// SCHEMAS DE VALIDAÇÃO
// ================================

const UpdateProcessSchema = z.object({
  court: z.string().min(1).optional(),
  clientName: z.string().min(1).optional(),
  caseId: z.string().nullable().optional(),
  monitoringStatus: z.enum(['ACTIVE', 'PAUSED', 'STOPPED', 'ERROR']).optional(),
  syncFrequency: z.enum(['HOURLY', 'DAILY', 'WEEKLY', 'MANUAL']).optional(),
  alertsEnabled: z.boolean().optional(),
  alertRecipients: z.array(z.string().email()).optional()
});

const SyncActionSchema = z.object({
  action: z.literal('sync'),
  force: z.boolean().default(false)
});

// ================================
// GET - BUSCAR PROCESSO ESPECÍFICO
// ================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { workspace } = await validateAuth(request);
    const { searchParams } = new URL(request.url);
    const includeMovements = searchParams.get('includeMovements') === 'true';
    const movementsLimit = parseInt(searchParams.get('movementsLimit') || '50');

    const process = await prisma.monitoredProcess.findFirst({
      where: {
        id: (await params).id,
        workspaceId: workspace.id
      },
      include: {
        case: {
          select: {
            id: true,
            title: true,
            status: true,
            type: true,
            priority: true
          }
        },
        movements: includeMovements ? {
          orderBy: { date: 'desc' },
          take: movementsLimit,
          select: {
            id: true,
            date: true,
            type: true,
            description: true,
            category: true,
            importance: true,
            requiresAction: true,
            deadline: true,
            read: true,
            archived: true,
            aiSummary: true,
            aiTags: true,
            createdAt: true
          }
        } : undefined,
        alerts: {
          where: { read: false },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            title: true,
            message: true,
            type: true,
            severity: true,
            sent: true,
            sentAt: true,
            createdAt: true
          }
        },
        syncLogs: {
          orderBy: { startedAt: 'desc' },
          take: 5,
          select: {
            id: true,
            syncType: true,
            status: true,
            newMovements: true,
            updatedMovements: true,
            duration: true,
            startedAt: true,
            finishedAt: true,
            errors: true
          }
        },
        _count: {
          select: {
            movements: true,
            alerts: true
          }
        }
      }
    });

    if (!process) {
      throw new ApiError('Processo monitorado não encontrado', 404);
    }

    // Estatísticas das movimentações (se incluídas)
    let movementStats = null;
    if (includeMovements && process.movements) {
      const unreadCount = process.movements.filter(m => !m.read).length;
      const actionRequiredCount = process.movements.filter(m => m.requiresAction && !m.archived).length;
      const byCategory = process.movements.reduce((acc, m) => {
        acc[m.category] = (acc[m.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      movementStats = {
        total: process._count.movements,
        unread: unreadCount,
        actionRequired: actionRequiredCount,
        byCategory
      };
    }

    return apiResponse({
      process,
      stats: {
        movements: movementStats,
        alerts: {
          total: process._count.alerts,
          unread: process.alerts.length
        }
      }
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro ao buscar processo:`, error);

    if (error instanceof ApiError) {
      return errorResponse(error.message, error.status);
    }

    return errorResponse('Erro interno do servidor', 500);
  }
}

// ================================
// PUT - ATUALIZAR PROCESSO
// ================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { workspace } = await validateAuth(request);
    const { data: body, error: validationError } = await validateJson(request, UpdateProcessSchema);
    if (validationError) return validationError;

    // Verificar se processo existe
    const existingProcess = await prisma.monitoredProcess.findFirst({
      where: {
        id: (await params).id,
        workspaceId: workspace.id
      }
    });

    if (!existingProcess) {
      throw new ApiError('Processo monitorado não encontrado', 404);
    }

    // Verificar se o caso existe (se fornecido)
    if (body.caseId) {
      const caseExists = await prisma.case.findFirst({
        where: {
          id: body.caseId,
          workspaceId: workspace.id
        }
      });

      if (!caseExists) {
        throw new ApiError('Caso não encontrado ou não pertence ao workspace', 404);
      }
    }

    // Atualizar processo
    const updatedProcess = await prisma.monitoredProcess.update({
      where: { id: (await params).id },
      data: {
        ...body,
        updatedAt: new Date()
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

    console.log(`${ICONS.SUCCESS} Processo atualizado:`, {
      id: (await params).id,
      processNumber: updatedProcess.processNumber,
      changes: Object.keys(body)
    });

    return apiResponse({
      process: updatedProcess,
      message: 'Processo atualizado com sucesso'
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro ao atualizar processo:`, error);

    if (error instanceof ApiError) {
      return errorResponse(error.message, error.status);
    }

    return errorResponse('Erro interno do servidor', 500);
  }
}

// ================================
// POST - AÇÕES NO PROCESSO (SYNC, ETC)
// ================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { workspace } = await validateAuth(request);
    const { data: body, error: validationError } = await validateJson(request, SyncActionSchema);
    if (validationError) return validationError;

    // Verificar se processo existe
    const process = await prisma.monitoredProcess.findFirst({
      where: {
        id: (await params).id,
        workspaceId: workspace.id
      }
    });

    if (!process) {
      throw new ApiError('Processo monitorado não encontrado', 404);
    }

    if (body.action === 'sync') {
      return await handleSyncProcess(process, body.force);
    }

    throw new ApiError('Ação não suportada', 400);

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro na ação do processo:`, error);

    if (error instanceof ApiError) {
      return errorResponse(error.message, error.status);
    }

    return errorResponse('Erro interno do servidor', 500);
  }
}

// ================================
// DELETE - REMOVER PROCESSO
// ================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { workspace } = await validateAuth(request);

    const process = await prisma.monitoredProcess.findFirst({
      where: {
        id: (await params).id,
        workspaceId: workspace.id
      },
      select: {
        id: true,
        processNumber: true,
        clientName: true
      }
    });

    if (!process) {
      throw new ApiError('Processo monitorado não encontrado', 404);
    }

    // Remover processo (cascade automático)
    await prisma.monitoredProcess.delete({
      where: { id: (await params).id }
    });

    console.log(`${ICONS.SUCCESS} Processo removido:`, {
      id: (await params).id,
      processNumber: process.processNumber
    });

    return apiResponse({
      message: 'Processo removido do monitoramento com sucesso',
      process: {
        id: process.id,
        processNumber: process.processNumber,
        clientName: process.clientName
      }
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro ao remover processo:`, error);

    if (error instanceof ApiError) {
      return errorResponse(error.message, error.status);
    }

    return errorResponse('Erro interno do servidor', 500);
  }
}

// ================================
// FUNÇÃO AUXILIAR - SINCRONIZAÇÃO
// ================================

async function handleSyncProcess(process: unknown, force: boolean) {
  // Verificar se não está em cooldown (a menos que force = true)
  if (!force && process.lastSync) {
    const timeSinceLastSync = Date.now() - process.lastSync.getTime();
    const minimumInterval = 5 * 60 * 1000; // 5 minutos

    if (timeSinceLastSync < minimumInterval) {
      throw new ApiError(
        `Sincronização muito recente. Aguarde ${Math.ceil((minimumInterval - timeSinceLastSync) / 60000)} minutos`,
        429
      );
    }
  }

  // Criar log de sincronização
  const syncLog = await prisma.processSyncLog.create({
    data: {
      monitoredProcessId: process.id,
      syncType: 'MANUAL',
      status: 'SUCCESS', // Will be updated
      startedAt: new Date(),
      apiSource: 'JUDIT_API'
    }
  });

  try {
    const processApi = createProcessApiClient();
    const startTime = Date.now();

    // Buscar movimentações recentes
    const recentMovements = await processApi.getRecentMovements(
      process.processNumber,
      process.lastSync
    );

    const duration = Date.now() - startTime;
    let newMovementsCount = 0;

    // Salvar novas movimentações
    if (recentMovements.length > 0) {
      // Buscar movimentações existentes para evitar duplicatas
      const existingMovements = await prisma.processMovement.findMany({
        where: {
          monitoredProcessId: process.id,
          date: {
            in: recentMovements.map(m => new Date(m.date))
          }
        },
        select: { date: true, description: true }
      });

      const existingKeys = new Set(
        existingMovements.map(m => `${m.date.toISOString()}_${m.description}`)
      );

      const newMovements = recentMovements.filter(movement => {
        const key = `${new Date(movement.date).toISOString()}_${movement.description}`;
        return !existingKeys.has(key);
      });

      if (newMovements.length > 0) {
        await prisma.processMovement.createMany({
          data: newMovements.map(movement => ({
            monitoredProcessId: process.id,
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

        newMovementsCount = newMovements.length;

        // Criar alertas para movimentações importantes
        const importantMovements = newMovements.filter(m =>
          m.importance === 'HIGH' || m.importance === 'URGENT' || m.requiresAction
        );

        if (importantMovements.length > 0 && process.alertsEnabled) {
          await Promise.all(
            importantMovements.map(movement =>
              prisma.processAlert.create({
                data: {
                  monitoredProcessId: process.id,
                  title: `Nova movimentação: ${movement.type}`,
                  message: movement.description,
                  type: 'MOVEMENT',
                  severity: movement.importance,
                  recipients: process.alertRecipients
                }
              })
            )
          );
        }
      }
    }

    // Atualizar processo e log de sincronização
    await Promise.all([
      prisma.monitoredProcess.update({
        where: { id: process.id },
        data: { lastSync: new Date() }
      }),
      prisma.processSyncLog.update({
        where: { id: syncLog.id },
        data: {
          status: 'SUCCESS',
          newMovements: newMovementsCount,
          duration,
          finishedAt: new Date(),
          errors: []
        }
      })
    ]);

    console.log(`${ICONS.SUCCESS} Sincronização concluída:`, {
      processId: process.id,
      newMovements: newMovementsCount,
      duration
    });

    return apiResponse({
      success: true,
      sync: {
        newMovements: newMovementsCount,
        duration,
        lastSync: new Date()
      },
      message: newMovementsCount > 0
        ? `Sincronizado com sucesso. ${newMovementsCount} novas movimentações encontradas`
        : 'Sincronizado com sucesso. Nenhuma nova movimentação'
    });

  } catch (syncError) {
    console.error(`${ICONS.ERROR} Erro na sincronização:`, syncError);

    // Atualizar log com erro
    await prisma.processSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'FAILED',
        finishedAt: new Date(),
        errors: [syncError instanceof Error ? syncError.message : 'Erro desconhecido']
      }
    });

    throw new ApiError('Erro ao sincronizar processo', 500);
  }
}