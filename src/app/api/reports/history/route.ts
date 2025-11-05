// ================================================================
// API ENDPOINT - Histórico de Relatórios
// ================================================================
// GET /api/reports/history - Listar execuções e histórico

import { NextRequest, NextResponse } from 'next/server';
import { successResponse, errorResponse, requireAuth, withErrorHandler } from '@/lib/api-utils';
import { prisma } from '@/lib/prisma';
import { ICONS } from '@/lib/icons';

export const GET = withErrorHandler(async (request: NextRequest) => {
  const { user, error: authError } = await requireAuth(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId');
  const scheduleId = searchParams.get('scheduleId');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');
  const status = searchParams.get('status');

  if (!workspaceId) {
    return errorResponse('workspaceId é obrigatório', 400);
  }

  console.log(`${ICONS.PROCESS} Buscando histórico de relatórios para workspace: ${workspaceId}`);

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

    // Construir filtros
    const whereClause: unknown = { workspaceId };

    if (scheduleId) {
      whereClause.scheduleId = scheduleId;
    }

    if (status) {
      whereClause.status = status;
    }

    // Buscar execuções com paginação
    const [executions, totalCount] = await Promise.all([
      prisma.reportExecution.findMany({
        where: whereClause,
        include: {
          schedule: {
            select: {
              id: true,
              name: true,
              type: true,
              audienceType: true
            }
          }
        },
        orderBy: { startedAt: 'desc' },
        take: limit,
        skip: offset
      }),

      prisma.reportExecution.count({
        where: whereClause
      })
    ]);

    // Calcular estatísticas
    const statistics = await calculateExecutionStatistics(workspaceId, scheduleId);

    const responseData = {
      executions: executions.map(execution => ({
        id: execution.id,
        scheduleId: execution.scheduleId,
        scheduleName: execution.schedule?.name || 'Relatório manual',
        reportType: execution.reportType,
        audienceType: execution.audienceType,
        status: execution.status,
        startedAt: execution.startedAt,
        completedAt: execution.completedAt,
        duration: execution.duration,
        processCount: execution.processCount,
        outputFormats: execution.outputFormats,
        fileUrls: execution.fileUrls,
        tokensUsed: execution.tokensUsed,
        cacheHit: execution.cacheHit,
        quotaConsumed: execution.quotaConsumed,
        error: execution.error,
        retryCount: execution.retryCount
      })),
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      },
      statistics
    };

    return successResponse(responseData);

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro ao buscar histórico:`, error);
    return errorResponse(
      error instanceof Error ? error.message : 'Erro interno do servidor',
      500
    );
  }
});

/**
 * Calcula estatísticas de execução
 */
async function calculateExecutionStatistics(workspaceId: string, scheduleId?: string) {
  const whereClause: unknown = { workspaceId };
  if (scheduleId) {
    whereClause.scheduleId = scheduleId;
  }

  // Estatísticas dos últimos 30 dias
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    totalExecutions,
    successfulExecutions,
    failedExecutions,
    avgDuration,
    recentExecutions,
    statusBreakdown,
    monthlyTrend
  ] = await Promise.all([
    // Total de execuções
    prisma.reportExecution.count({ where: whereClause }),

    // Execuções bem-sucedidas
    prisma.reportExecution.count({
      where: { ...whereClause, status: 'CONCLUIDO' }
    }),

    // Execuções falhadas
    prisma.reportExecution.count({
      where: { ...whereClause, status: 'FALHOU' }
    }),

    // Duração média
    prisma.reportExecution.aggregate({
      where: { ...whereClause, status: 'CONCLUIDO' },
      _avg: { duration: true }
    }),

    // Execuções recentes (últimos 30 dias)
    prisma.reportExecution.count({
      where: {
        ...whereClause,
        startedAt: { gte: thirtyDaysAgo }
      }
    }),

    // Breakdown por status
    prisma.reportExecution.groupBy({
      by: ['status'],
      where: whereClause,
      _count: { id: true }
    }),

    // Tendência mensal (últimos 6 meses)
    getMonthlyTrend(workspaceId, scheduleId)
  ]);

  const successRate = totalExecutions > 0
    ? (successfulExecutions / totalExecutions) * 100
    : 0;

  const failureRate = totalExecutions > 0
    ? (failedExecutions / totalExecutions) * 100
    : 0;

  return {
    overview: {
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      successRate: Math.round(successRate * 100) / 100,
      failureRate: Math.round(failureRate * 100) / 100,
      avgDuration: Math.round(avgDuration._avg.duration || 0),
      recentExecutions
    },
    statusBreakdown: statusBreakdown.reduce((acc, item) => {
      acc[item.status] = item._count.id;
      return acc;
    }, {} as Record<string, number>),
    monthlyTrend
  };
}

/**
 * Calcula tendência mensal
 */
async function getMonthlyTrend(workspaceId: string, scheduleId?: string) {
  const whereClause: unknown = { workspaceId };
  if (scheduleId) {
    whereClause.scheduleId = scheduleId;
  }

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const executions = await prisma.reportExecution.findMany({
    where: {
      ...whereClause,
      startedAt: { gte: sixMonthsAgo }
    },
    select: {
      startedAt: true,
      status: true,
      duration: true
    }
  });

  // Agrupar por mês
  const monthlyData: Record<string, {
    total: number;
    successful: number;
    failed: number;
    avgDuration: number;
  }> = {};

  executions.forEach(execution => {
    const monthKey = execution.startedAt.toISOString().substring(0, 7); // YYYY-MM

    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = {
        total: 0,
        successful: 0,
        failed: 0,
        avgDuration: 0
      };
    }

    monthlyData[monthKey].total++;

    if (execution.status === 'CONCLUIDO') {
      monthlyData[monthKey].successful++;
      monthlyData[monthKey].avgDuration += execution.duration || 0;
    } else if (execution.status === 'FALHOU') {
      monthlyData[monthKey].failed++;
    }
  });

  // Calcular médias
  Object.keys(monthlyData).forEach(month => {
    const data = monthlyData[month];
    data.avgDuration = data.successful > 0
      ? Math.round(data.avgDuration / data.successful)
      : 0;
  });

  return monthlyData;
}