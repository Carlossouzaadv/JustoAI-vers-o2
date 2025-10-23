import { NextRequest, NextResponse } from 'next/server';
import { circuitBreakerService } from '@/lib/services/circuitBreakerService';

/**
 * GET /api/admin/circuit-breaker
 * Get circuit breaker status
 */
export async function GET() {
  try {
    const status = circuitBreakerService.getStatus();

    return NextResponse.json({
      success: true,
      data: status,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/circuit-breaker/resume
 * Manually attempt to resume the queue
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action || 'resume';

    if (action === 'resume') {
      // Attempt manual recovery
      const recovered = await circuitBreakerService.manualRecoveryAttempt();

      if (recovered) {
        return NextResponse.json({
          success: true,
          message: 'Queue resumed successfully',
          data: circuitBreakerService.getStatus(),
        });
      } else {
        return NextResponse.json(
          {
            success: false,
            message: 'Recovery attempt failed. Queue still paused.',
            data: circuitBreakerService.getStatus(),
          },
          { status: 503 }
        );
      }
    } else if (action === 'force-close') {
      // Force close the circuit (admin action)
      circuitBreakerService.forceClose();

      return NextResponse.json({
        success: true,
        message: 'Circuit breaker force closed',
        data: circuitBreakerService.getStatus(),
      });
    } else if (action === 'config') {
      // Configure auto-retry interval
      const interval = body.interval || 'DISABLED';

      if (!['DISABLED', '30MIN', '1HOUR'].includes(interval)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid interval. Must be DISABLED, 30MIN, or 1HOUR',
          },
          { status: 400 }
        );
      }

      circuitBreakerService.setAutoRetryInterval(
        interval as 'DISABLED' | '30MIN' | '1HOUR'
      );

      return NextResponse.json({
        success: true,
        message: `Auto-retry interval set to ${interval}`,
        data: circuitBreakerService.getStatus(),
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid action. Must be resume, force-close, or config',
        },
        { status: 400 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
