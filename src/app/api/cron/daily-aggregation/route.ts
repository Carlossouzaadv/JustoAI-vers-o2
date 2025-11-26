// ================================================================
// API ROUTE: /api/cron/daily-aggregation
// Daily telemetry aggregation and alert triggering
// Scheduled to run daily at 23:00 UTC
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { aggregationService } from '@/lib/aggregation-service';
import { ICONS } from '@/lib/icons';

// ================================================================
// VERIFICATION HEADERS
// ================================================================

/**
 * Verify cron request authenticity
 * CRITICAL: CRON_SECRET must be defined in production
 */
function verifyCronRequest(request: NextRequest): boolean {
  // In development, allow requests without auth
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  // In production, require CRON_SECRET to be defined
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error(`${ICONS.ERROR} [Cron] CRON_SECRET not defined in production - rejecting request`);
    return false;
  }

  // Verify request has valid secret
  const authHeader = request.headers.get('authorization') || request.headers.get('x-cron-secret');
  if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
    console.warn(`${ICONS.WARNING} [Cron] Unauthorized aggregation request`);
    return false;
  }

  return true;
}

// ================================================================
// HANDLER
// ================================================================

export async function POST(request: NextRequest) {
  try {
    // Verify cron request
    if (!verifyCronRequest(request)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log(`${ICONS.PROCESS} [Cron] Daily aggregation started at ${new Date().toISOString()}`);

    // Run daily aggregation
    const result = await aggregationService.runDailyAggregation();

    console.log(`${ICONS.SUCCESS} [Cron] Daily aggregation completed:`, {
      workspacesProcessed: result.workspacesProcessed,
      alertsCreated: result.alertsCreated,
      duration: `${result.duration}ms`,
      errors: result.errors?.length || 0,
    });

    return NextResponse.json({
      success: result.success,
      message: 'Daily aggregation completed',
      data: {
        date: result.date,
        workspacesProcessed: result.workspacesProcessed,
        alertsCreated: result.alertsCreated,
        duration: result.duration,
        errors: result.errors,
      },
    });
  } catch (error) {
    console.error(`${ICONS.ERROR} [Cron] Aggregation failed:`, error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ================================================================
// GET HANDLER - For manual triggering and monitoring
// ================================================================

export async function GET(request: NextRequest) {
  try {
    // Verify cron request
    if (!verifyCronRequest(request)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Run aggregation
    const result = await aggregationService.runDailyAggregation();

    return NextResponse.json({
      success: result.success,
      message: 'Daily aggregation executed',
      data: {
        date: result.date,
        workspacesProcessed: result.workspacesProcessed,
        alertsCreated: result.alertsCreated,
        duration: result.duration,
        errors: result.errors,
      },
    });
  } catch (error) {
    console.error(`${ICONS.ERROR} [Cron] Aggregation failed:`, error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
