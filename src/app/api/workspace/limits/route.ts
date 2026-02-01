import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { workspaceLimitService } from '@/lib/services/WorkspaceLimitService';

// ============================================
// API ROUTE: Workspace Limits Status
// GET /api/workspace/limits?workspaceId=xxx
// ============================================

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    
    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId required' }, { status: 400 });
    }
    
    const check = await workspaceLimitService.checkProcessLimit(workspaceId);
    
    return NextResponse.json({
      limits: {
        processes: {
          current: check.currentValue,
          limit: check.limitValue,
          percentage: Math.round(check.percentage),
          alertLevel: check.alertLevel,
          message: check.message
        },
        gracePeriod: check.gracePeriodActive ? {
          active: true,
          endsAt: check.gracePeriodEndsAt
        } : {
          active: false
        }
      }
    });
    
  } catch (error) {
    console.error('[API Limits] Erro:', error);
    const message = error instanceof Error ? error.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
