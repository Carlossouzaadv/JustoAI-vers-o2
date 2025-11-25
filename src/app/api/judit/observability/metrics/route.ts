// ================================================================
// API ROUTE: GET /api/judit/observability/metrics
// Retorna métricas de performance da integração JUDIT
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { metrics } from '@/lib/observability/metrics';

// ================================================================
// HANDLER
// ================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const metricName = searchParams.get('name');

    // If specific metric requested
    if (metricName) {
      const metric = metrics.getMetric(metricName);

      if (!metric) {
        return NextResponse.json(
          {
            success: false,
            error: `Metric '${metricName}' not found`,
          },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          metric: metricName,
          ...metric,
        },
      });
    }

    // Return all metrics
    const allMetrics = metrics.getAllMetrics();

    // Extract key JUDIT metrics
    const juditMetrics = Object.entries(allMetrics)
      .filter(([key]) => key.startsWith('judit.'))
      .reduce((acc, [key, value]) => {
        acc[key] = value;
        return acc;
      }, {} as Record<string, unknown>);

    // Calculate summary stats
    const summary = {
      totalApiCalls: sumMetric(juditMetrics, 'judit.api.calls.total'),
      totalErrors: sumMetric(juditMetrics, 'judit.api.errors.total'),
      avgLatency: avgMetric(juditMetrics, 'judit.api.latency_ms'),
      totalOnboardings: sumMetric(juditMetrics, 'judit.onboarding.total'),
      totalMonitoringChecks: sumMetric(juditMetrics, 'judit.monitoring.checks.total'),
      attachmentFetchesTriggered: sumMetric(
        juditMetrics,
        'judit.attachment_fetch.triggered.total'
      ),
      queueJobsTotal: sumMetric(juditMetrics, 'judit.queue.jobs.total'),
    };

    return NextResponse.json({
      success: true,
      data: {
        summary,
        metrics: juditMetrics,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (_error) {
    console.error('[API] Error fetching metrics:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error fetching metrics',
      },
      { status: 500 }
    );
  }
}

// ================================================================
// HELPERS
// ================================================================

function isMetricValue(data: unknown): data is { count?: number; avg?: number } {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    (obj.count === undefined || typeof obj.count === 'number') &&
    (obj.avg === undefined || typeof obj.avg === 'number')
  );
}

function sumMetric(metrics: Record<string, unknown>, pattern: string): number {
  return Object.entries(metrics)
    .filter(([key]) => key.includes(pattern))
    .reduce((sum, [, value]) => {
      if (!isMetricValue(value)) return sum;
      return sum + (value.count || 0);
    }, 0);
}

function avgMetric(metrics: Record<string, unknown>, pattern: string): number {
  const matching = Object.entries(metrics).filter(([key]) => key.includes(pattern));

  if (matching.length === 0) return 0;

  const total = matching.reduce((sum, [, value]) => {
    if (!isMetricValue(value)) return sum;
    return sum + (value.avg || 0);
  }, 0);
  return total / matching.length;
}
