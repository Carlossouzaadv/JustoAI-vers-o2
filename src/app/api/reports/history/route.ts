// ================================================================
// API ENDPOINT - Histórico de Relatórios
// ================================================================
// GET /api/reports/history - Listar execuções e histórico

import { NextRequest } from 'next/server';
import { successResponse, errorResponse, requireAuth, withErrorHandler } from '@/lib/api-utils';
import { prisma } from '@/lib/prisma';
import { ICONS } from '@/lib/icons';

/**
 * Type definitions for Prisma query results
 */
interface ReportExecutionWithSchedule {
  id: string;
  workspaceId: string;
  scheduleId: string | null;
  reportType: string;
  audienceType: string;
  status: string;
  startedAt: Date;
  completedAt: Date | null;
  duration: number | null;
  processCount: number;
  outputFormats: string[];
  fileUrls: unknown;
  tokensUsed: number | null;
  cacheHit: boolean;
  quotaConsumed: number;
  error: string | null;
  retryCount: number;
  schedule: {
    id: string;
    name: string;
    type: string;
    audienceType: string;
  } | null;
}

interface StatusBreakdownItem {
  status: string;
  _count: {
    id: number;
  };
}

interface ExecutionForTrend {
  startedAt: Date;
  status: string;
  duration: number | null;
}

interface WhereClauseInput {
  workspaceId: string;
  scheduleId?: string;
  status?: string;
}

/**
 * Type guard para validar ExecutionStatus
 */
function isValidExecutionStatus(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const validStatuses: string[] = ['AGENDADO', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'];
  return validStatuses.includes(value);
}

/**
 * Constrói where clause seguro para ReportExecution
 */
function buildReportExecutionWhereClause(
  workspaceId: string,
  scheduleId?: string | null,
  status?: string | null
): WhereClauseInput {
  const where: WhereClauseInput = { workspaceId };

  if (scheduleId) {
    where.scheduleId = scheduleId;
  }

  // Type narrowing: validar e converter status para ExecutionStatus
  if (status && isValidExecutionStatus(status)) {
    where.status = status;
  }

  return where;
}

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

    // Construir filtros com type safety
    const whereClause = buildReportExecutionWhereClause(workspaceId, scheduleId, status);

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
    const statistics = await calculateExecutionStatistics(whereClause);

    const responseData = {
      executions: (executions as ReportExecutionWithSchedule[]).map((execution: ReportExecutionWithSchedule) => {
        // Type narrowing: schedule é optional na relação include
        const scheduleName = execution.schedule && 'name' in execution.schedule
          ? execution.schedule.name
          : 'Relatório manual';

        return {
          id: execution.id,
          scheduleId: execution.scheduleId,
          scheduleName,
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
        };
      }),
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
async function calculateExecutionStatistics(whereClause: WhereClauseInput) {
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
      where: { ...whereClause, status: 'COMPLETED' }
    }),

    // Execuções falhadas
    prisma.reportExecution.count({
      where: { ...whereClause, status: 'FAILED' }
    }),

    // Duração média
    prisma.reportExecution.aggregate({
      where: { ...whereClause, status: 'COMPLETED' },
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
    getMonthlyTrend(whereClause)
  ]);

  const successRate = totalExecutions > 0
    ? (successfulExecutions / totalExecutions) * 100
    : 0;

  const failureRate = totalExecutions > 0
    ? (failedExecutions / totalExecutions) * 100
    : 0;

  // Type narrowing: avgDuration._avg pode ser undefined
  const avgDurationValue = avgDuration._avg && avgDuration._avg.duration !== null && avgDuration._avg.duration !== undefined
    ? Math.round(avgDuration._avg.duration)
    : 0;

  // Type narrowing: statusBreakdown items têm _count.id quando _count: { id: true }
  const statusBreakdownMap = (statusBreakdown as StatusBreakdownItem[]).reduce(
    (acc: Record<string, number>, item: StatusBreakdownItem) => {
      // Validate that item is an object with expected structure
      if (typeof item !== 'object' || item === null) {
        return acc;
      }
      // Safe type narrowing after typeof validation
      const validatedItem = item as StatusBreakdownItem;
      if (typeof validatedItem._count === 'object' && validatedItem._count !== null && 'id' in validatedItem._count) {
        acc[validatedItem.status] = validatedItem._count.id;
      }
      return acc;
    },
    {} as Record<string, number>
  );

  return {
    overview: {
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      successRate: Math.round(successRate * 100) / 100,
      failureRate: Math.round(failureRate * 100) / 100,
      avgDuration: avgDurationValue,
      recentExecutions
    },
    statusBreakdown: statusBreakdownMap,
    monthlyTrend
  };
}

/**
 * Calcula tendência mensal
 */
async function getMonthlyTrend(whereClause: WhereClauseInput) {
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

  (executions as ExecutionForTrend[]).forEach((execution: ExecutionForTrend) => {
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

    // Type narrowing: validar se status é um dos valores esperados
    if (isValidExecutionStatus(execution.status)) {
      if (execution.status === 'COMPLETED') {
        monthlyData[monthKey].successful++;
        monthlyData[monthKey].avgDuration += execution.duration || 0;
      } else if (execution.status === 'FAILED') {
        monthlyData[monthKey].failed++;
      }
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