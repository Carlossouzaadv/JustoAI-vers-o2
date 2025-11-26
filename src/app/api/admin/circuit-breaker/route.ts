import { NextRequest, NextResponse } from 'next/server';
import { circuitBreakerService } from '@/lib/services/circuitBreakerService';
import { validateAuthAndGetUser } from '@/lib/auth';
import { requireAdminAccess } from '@/lib/permission-validator';

/**
 * GET /api/admin/circuit-breaker
 * Get circuit breaker status
 * Accessible to: Internal admins (@justoai.com.br) OR workspace admins
 */
export async function GET() {
  try {
    // 1. Authenticate user
    const { user, workspace } = await validateAuthAndGetUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Check admin access (internal admin OR workspace admin)
    const adminCheck = await requireAdminAccess(user.email, user.id, workspace?.id);
    if (!adminCheck.authorized) {
      return NextResponse.json(
        { error: adminCheck._error },
        { status: 403 }
      );
    }

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
 * Accessible to: Internal admins (@justoai.com.br) OR workspace admins
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const { user, workspace } = await validateAuthAndGetUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Check admin access (internal admin OR workspace admin)
    const adminCheck = await requireAdminAccess(user.email, user.id, workspace?.id);
    if (!adminCheck.authorized) {
      return NextResponse.json(
        { error: adminCheck._error },
        { status: 403 }
      );
    }

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
