/**
 * Admin Observability API
 * Aggregates data from Sentry, Bull Board, Redis, and other monitoring sources
 * Only accessible to workspace admins
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateAuthAndGetUser } from '@/lib/auth';
import { requireWorkspaceAdmin } from '@/lib/permission-validator';
import { getSentryProjectStats, getSentryReleases, getSentryHealth } from '@/lib/sentry-api-client';
import { getBullBoardStats, systemHealthCheck } from '@/lib/bull-board';

export async function GET(req: NextRequest) {
  try {
    // 1. Authenticate and check admin permissions
    const { user, workspace } = await validateAuthAndGetUser();

    if (!user || !workspace) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const adminCheck = await requireWorkspaceAdmin(user.id, workspace.id);
    if (!adminCheck.authorized) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // 2. Fetch observability data
    const [sentryStats, sentryReleases, sentryHealth, bullStats, systemHealth] = await Promise.allSettled([
      getSentryProjectStats(),
      getSentryReleases(5),
      getSentryHealth(),
      getBullBoardStats(),
      systemHealthCheck(),
    ]);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      observability: {
        // Sentry Error Tracking
        sentry: {
          errors: sentryStats.status === 'fulfilled' ? {
            total: sentryStats.value.totalErrors,
            rate: sentryStats.value.errorRate,
            recent: sentryStats.value.recentErrors.slice(0, 5),
            top: sentryStats.value.topErrors.slice(0, 5),
            sessions: sentryStats.value.sessionData,
          } : null,
          health: sentryHealth.status === 'fulfilled' ? sentryHealth.value : null,
          releases: sentryReleases.status === 'fulfilled' ? sentryReleases.value : [],
          performance: sentryStats.status === 'fulfilled' ? {
            p50: sentryStats.value.performance.p50,
            p95: sentryStats.value.performance.p95,
            p99: sentryStats.value.performance.p99,
          } : null,
        },
        // Bull Queue Monitoring
        queues: bullStats.status === 'fulfilled' ? bullStats.value : null,
        // System Health
        system: systemHealth.status === 'fulfilled' ? systemHealth.value : null,
      },
      links: {
        sentryDashboard: 'https://sentry.io/organizations/justoai/issues/',
        queueDashboard: 'http://localhost:3000/admin/queues',
        documentation: '/admin/docs/observability',
      },
    });
  } catch (error) {
    console.error('Error fetching observability data:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch observability data',
      },
      { status: 500 }
    );
  }
}
