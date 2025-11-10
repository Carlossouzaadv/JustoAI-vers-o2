// ================================================================
// API ROUTE: GET/POST /api/judit/observability/alerts
// Gerenciamento de alertas da integração JUDIT
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getUnresolvedAlerts, resolveAlert } from '@/lib/observability/costTracking';
import { PrismaClient, AlertSeverity } from '@prisma/client';

const prisma = new PrismaClient();

// Type guard for AlertSeverity enum - validates exact enum values without casting
function isAlertSeverity(value: unknown): value is AlertSeverity {
  if (typeof value !== 'string') return false;
  return (
    value === 'LOW' ||
    value === 'MEDIUM' ||
    value === 'HIGH' ||
    value === 'CRITICAL'
  );
}

// ================================================================
// GET - List Alerts
// ================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const workspaceId = searchParams.get('workspaceId') || undefined;
    const resolvedParam = searchParams.get('resolved');
    const severityParam = searchParams.get('severity');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Build Prisma where clause with proper type safety
    interface PrismaAlertWhere {
      workspaceId?: string;
      resolved?: boolean;
      severity?: AlertSeverity;
    }

    const where: PrismaAlertWhere = {};

    if (workspaceId) {
      where.workspaceId = workspaceId;
    }

    if (resolvedParam !== null) {
      where.resolved = resolvedParam === 'true';
    }

    // Safely convert and validate severity using type guard (ZERO 'as')
    if (severityParam) {
      const upperSeverity = typeof severityParam === 'string' ? severityParam.toUpperCase() : '';

      // Apply type guard - after this, upperSeverity is guaranteed to be AlertSeverity
      if (isAlertSeverity(upperSeverity)) {
        where.severity = upperSeverity; // 100% type-safe, no casting needed
      }
    }

    // Fetch alerts
    const alerts = await prisma.juditAlert.findMany({
      where,
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });

    // Get counts by severity (with proper type narrowing for _count)
    const counts = await prisma.juditAlert.groupBy({
      by: ['severity'],
      where: {
        ...where,
        resolved: false,
      },
      _count: {
        id: true,
      },
    });

    const countsBySeverity = counts.reduce(
      (acc, item) => {
        const countValue = item._count.id;
        acc[item.severity.toLowerCase()] = countValue;
        return acc;
      },
      { critical: 0, high: 0, medium: 0, low: 0 } as Record<string, number>
    );

    return NextResponse.json({
      success: true,
      data: {
        alerts,
        counts: countsBySeverity,
        total: alerts.length,
      },
    });
  } catch (error) {
    console.error('[API] Error fetching alerts:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error fetching alerts',
      },
      { status: 500 }
    );
  }
}

// ================================================================
// POST - Resolve Alert
// ================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { alertId, action } = body;

    if (!alertId) {
      return NextResponse.json(
        {
          success: false,
          error: 'alertId is required',
        },
        { status: 400 }
      );
    }

    if (action === 'resolve') {
      await resolveAlert(alertId);

      return NextResponse.json({
        success: true,
        message: 'Alert resolved successfully',
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Invalid action. Use "resolve"',
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('[API] Error managing alert:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error managing alert',
      },
      { status: 500 }
    );
  }
}
