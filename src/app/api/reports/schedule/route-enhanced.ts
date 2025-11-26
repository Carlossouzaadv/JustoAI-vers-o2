// ================================================================
// API ENDPOINT - Agendamento de Relatórios Avançado
// ================================================================
// POST /api/reports/schedule - Criar novo agendamento
// GET /api/reports/schedule - Listar agendamentos

import { NextRequest, NextResponse } from 'next/server';
import { successResponse, errorResponse, requireAuth, withErrorHandler } from '@/lib/api-utils';
import { QuotaSystem } from '@/lib/quota-system';
import { prisma } from '@/lib/prisma';
import { createHash } from 'crypto';
import { ICONS } from '@/lib/icons';

interface ScheduleRequest {
  workspaceId: string;
  name: string;
  description?: string;
  type: 'COMPLETO' | 'NOVIDADES';
  frequency: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  processIds: string[];
  audienceType: 'CLIENTE' | 'DIRETORIA' | 'USO_INTERNO';
  outputFormats: ('PDF' | 'DOCX')[];
  recipients: string[];
  preferredTime?: string; // "14:30" format
  customTemplate?: string;
}

export const POST = withErrorHandler(async (request: NextRequest) => {
  const { user, error: authError } = await requireAuth(request);
  if (authError) return authError;

  console.log(`${ICONS.PROCESS} Criando agendamento de relatório`);

  try {
    const body: ScheduleRequest = await request.json();

    // Validações básicas
    if (!body.workspaceId || !body.name || !body.processIds?.length) {
      return errorResponse('Campos obrigatórios: workspaceId, name, processIds', 400);
    }

    if (body.processIds.length === 0) {
      return errorResponse('Pelo menos um processo deve ser selecionado', 400);
    }

    if (!body.outputFormats?.includes('PDF')) {
      return errorResponse('PDF é obrigatório nos formatos de saída', 400);
    }

    // Verificar acesso ao workspace
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: body.workspaceId,
        users: {
          some: {
            userId: user.id
          }
        }
      }
    });

    if (!workspace) {
      return errorResponse('Workspace não encontrado ou acesso negado', 404);
    }

    // Validar quotas
    const quotaSystem = new QuotaSystem();
    const quotaValidation = await quotaSystem.validateReportCreation(
      body.workspaceId,
      body.processIds.length
    );

    if (!quotaValidation.allowed) {
      // Narrowing seguro: validar que _error existe antes de usar
      const errorMessage = quotaValidation._error || 'Validação de quota falhou';
      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          quotaStatus: quotaValidation.quotaStatus,
          recommendation: quotaValidation.recommendation,
          upgradeOptions: quotaValidation.upgradeOptions
        },
        { status: 402 }
      );
    }

    // Verificar se processos existem e pertencem ao workspace
    const processCount = await prisma.monitoredProcess.count({
      where: {
        id: { in: body.processIds },
        workspaceId: body.workspaceId
      }
    });

    if (processCount !== body.processIds.length) {
      return errorResponse('Alguns processos não foram encontrados ou não pertencem ao workspace', 400);
    }

    // Calcular hash de distribuição
    const distributionHash = calculateDistributionHash(body.workspaceId);

    // Calcular próxima execução
    const nextRun = calculateNextRun(body.frequency, body.preferredTime);

    // Criar agendamento
    const schedule = await prisma.reportSchedule.create({
      data: {
        workspaceId: body.workspaceId,
        name: body.name,
        description: body.description,
        type: body.type,
        frequency: body.frequency,
        recipients: body.recipients,
        audienceType: body.audienceType,
        outputFormats: body.outputFormats,
        processIds: body.processIds,
        processesLimit: quotaValidation.quotaStatus.limit,
        distributionHash,
        nextRun,
        filters: {
          customTemplate: body.customTemplate
        }
      }
    });

    console.log(`${ICONS.SUCCESS} Agendamento criado: ${schedule.id}`);

    // Preparar resposta
    const responseData = {
      schedule: {
        id: schedule.id,
        name: schedule.name,
        type: schedule.type,
        frequency: schedule.frequency,
        nextRun: schedule.nextRun,
        processCount: body.processIds.length,
        audienceType: schedule.audienceType,
        outputFormats: schedule.outputFormats,
        distributionInfo: {
          hash: distributionHash,
          estimatedExecutionTime: calculateExecutionTime(distributionHash)
        }
      },
      quotaInfo: {
        used: quotaValidation.quotaStatus.used,
        limit: quotaValidation.quotaStatus.limit,
        remaining: quotaValidation.quotaStatus.remaining,
        isNearLimit: quotaValidation.quotaStatus.isNearLimit
      }
    };

    return NextResponse.json({
      success: true,
      data: responseData,
      message: 'Agendamento criado com sucesso'
    }, { status: 201 });

  } catch (error) {
    console._error(`${ICONS.ERROR} Erro ao criar agendamento:`, error);
    return errorResponse(
      error instanceof Error ? error.message : 'Erro interno do servidor',
      500
    );
  }
});

/**
 * GET /api/reports/schedule - Listar agendamentos
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  const { user, error: authError } = await requireAuth(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId');

  if (!workspaceId) {
    return errorResponse('workspaceId é obrigatório', 400);
  }

  console.log(`${ICONS.PROCESS} Listando agendamentos para workspace: ${workspaceId}`);

  try {
    // Verificar acesso ao workspace
    const hasAccess = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        users: {
          some: { userId: user.id }
        }
      }
    });

    if (!hasAccess) {
      return errorResponse('Workspace não encontrado ou acesso negado', 404);
    }

    // Buscar agendamentos
    const schedules = await prisma.reportSchedule.findMany({
      where: { workspaceId },
      include: {
        executions: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            status: true,
            startedAt: true,
            completedAt: true,
            error: true
          }
        },
        _count: {
          select: {
            executions: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Obter estatísticas de quota
    const quotaSystem = new QuotaSystem();
    const quotaStats = await quotaSystem.getUsageStatistics(workspaceId);

    // Type alias para schedules com relações (inferido do Prisma query)
    type ScheduleWithRelations = typeof schedules[number];

    const responseData = {
      schedules: schedules.map((schedule: ScheduleWithRelations) => ({
        id: schedule.id,
        name: schedule.name,
        description: schedule.description,
        type: schedule.type,
        frequency: schedule.frequency,
        enabled: schedule.enabled,
        nextRun: schedule.nextRun,
        lastRun: schedule.lastRun,
        audienceType: schedule.audienceType,
        outputFormats: schedule.outputFormats,
        processCount: schedule.processIds.length,
        executionCount: schedule._count.executions,
        recentExecutions: schedule.executions,
        monthlyQuotaUsed: schedule.monthlyQuotaUsed,
        createdAt: schedule.createdAt
      })),
      quotaInfo: quotaStats.quota,
      statistics: {
        totalSchedules: schedules.length,
        activeSchedules: schedules.filter((s: ScheduleWithRelations) => s.enabled).length,
        thisMonthExecutions: quotaStats.thisMonth.reports,
        successRate: quotaStats.thisMonth.successRate
      }
    };

    return successResponse(responseData);

  } catch (error) {
    console._error(`${ICONS.ERROR} Erro ao listar agendamentos:`, error);
    return errorResponse(
      error instanceof Error ? error.message : 'Erro interno do servidor',
      500
    );
  }
});

/**
 * Calcula hash de distribuição
 */
function calculateDistributionHash(workspaceId: string): number {
  const hash = createHash('sha256')
    .update(workspaceId)
    .digest('hex');

  return parseInt(hash.substring(0, 8), 16) % 300;
}

/**
 * Calcula próxima execução
 */
function calculateNextRun(frequency: string, preferredTime?: string): Date {
  const next = new Date();

  // Se há horário preferido, aplicar
  if (preferredTime) {
    const [hours, minutes] = preferredTime.split(':').map(Number);
    next.setHours(hours, minutes, 0, 0);
  } else {
    // Usar janela padrão (23:00-04:00)
    next.setHours(23, 0, 0, 0);
  }

  // Ajustar para próxima execução baseada na frequência
  switch (frequency) {
    case 'WEEKLY':
      next.setDate(next.getDate() + 7);
      break;
    case 'BIWEEKLY':
      next.setDate(next.getDate() + 14);
      break;
    case 'MONTHLY':
      next.setMonth(next.getMonth() + 1);
      break;
    default:
      next.setDate(next.getDate() + 7);
  }

  return next;
}

/**
 * Calcula horário estimado de execução baseado no hash
 */
function calculateExecutionTime(distributionHash: number): string {
  const baseHour = 23;
  const minutes = distributionHash % 300; // 0-299 minutes

  const totalMinutes = baseHour * 60 + minutes;
  const hours = Math.floor(totalMinutes / 60) % 24;
  const mins = totalMinutes % 60;

  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}