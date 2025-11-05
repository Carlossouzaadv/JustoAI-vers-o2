// ================================================================
// API ROUTE: GET /api/judit/observability/health
// Health check e status geral da integração JUDIT
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { metrics } from '@/lib/observability/metrics';
import { getCostSummary } from '@/lib/observability/costTracking';
import { getQueueStats } from '@/lib/queue/juditQueue';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ================================================================
// HANDLER
// ================================================================

export async function GET(request: NextRequest) {
  try {
    // Fetch data in parallel
    const [queueStats, unresolvedAlerts, recentCosts] = await Promise.all([
      getQueueStats().catch(() => null), // Queue might not be running
      prisma.juditAlert.count({ where: { resolved: false } }),
      getCostSummary(undefined, getStartOfDay(), new Date()),
    ]);

    // Get metrics
    const allMetrics = metrics.getAllMetrics();
    const apiCallsMetric = Object.entries(allMetrics).find(([key]) =>
      key.includes('judit.api.calls.total')
    );
    const errorsMetric = Object.entries(allMetrics).find(([key]) =>
      key.includes('judit.api.errors.total')
    );

    const totalApiCalls = apiCallsMetric ? apiCallsMetric[1].count : 0;
    const totalErrors = errorsMetric ? errorsMetric[1].count : 0;

    // Calculate error rate
    const errorRate = totalApiCalls > 0 ? (totalErrors / totalApiCalls) * 100 : 0;

    // Determine overall health
    const health = determineHealth({
      queueStats,
      errorRate,
      unresolvedAlerts,
      recentCosts: recentCosts.totalCost,
    });

    return NextResponse.json({
      success: true,
      data: {
        status: health.status,
        message: health.message,
        components: {
          api: {
            status: errorRate < 5 ? 'healthy' : errorRate < 10 ? 'degraded' : 'unhealthy',
            errorRate: `${errorRate.toFixed(2)}%`,
            totalCalls: totalApiCalls,
            totalErrors,
          },
          queue: queueStats
            ? {
                status:
                  queueStats.waiting < 100 && queueStats.failed < 10
                    ? 'healthy'
                    : 'degraded',
                waiting: queueStats.waiting,
                active: queueStats.active,
                completed: queueStats.completed,
                failed: queueStats.failed,
              }
            : {
                status: 'unknown',
                message: 'Queue not accessible',
              },
          costs: {
            status: recentCosts.totalCost < 50 ? 'healthy' : 'warning',
            todayCost: `R$ ${recentCosts.totalCost.toFixed(2)}`,
            operations: recentCosts.operationsCount,
          },
          alerts: {
            status: unresolvedAlerts === 0 ? 'healthy' : unresolvedAlerts < 5 ? 'warning' : 'critical',
            unresolved: unresolvedAlerts,
          },
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[API] Error checking health:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error checking health',
      },
      { status: 500 }
    );
  }
}

// ================================================================
// HELPERS
// ================================================================

function determineHealth(params: {
  queueStats: unknown;
  errorRate: number;
  unresolvedAlerts: number;
  recentCosts: number;
}): { status: 'healthy' | 'degraded' | 'unhealthy'; message: string } {
  const { queueStats, errorRate, unresolvedAlerts, recentCosts } = params;

  // Critical conditions
  if (errorRate > 20) {
    return {
      status: 'unhealthy',
      message: `High error rate: ${errorRate.toFixed(1)}%`,
    };
  }

  if (unresolvedAlerts > 10) {
    return {
      status: 'unhealthy',
      message: `Too many unresolved alerts: ${unresolvedAlerts}`,
    };
  }

  // Warning conditions
  if (errorRate > 5) {
    return {
      status: 'degraded',
      message: `Elevated error rate: ${errorRate.toFixed(1)}%`,
    };
  }

  if (queueStats && queueStats.failed > 20) {
    return {
      status: 'degraded',
      message: `High number of failed queue jobs: ${queueStats.failed}`,
    };
  }

  if (unresolvedAlerts > 0) {
    return {
      status: 'degraded',
      message: `${unresolvedAlerts} unresolved alert(s)`,
    };
  }

  // All good
  return {
    status: 'healthy',
    message: 'All systems operational',
  };
}

function getStartOfDay(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}
