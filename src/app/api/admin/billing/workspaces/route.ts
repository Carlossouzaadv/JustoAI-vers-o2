/**
 * Admin Endpoint - Get Workspace Billing Data
 * GET /api/admin/billing/workspaces
 *
 * Fetches all workspaces with their billing info: plan, credits, trial status
 * Protected: Internal admins (@justoai.com.br) only
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateAuthAndGetUser } from '@/lib/auth';
import { isInternalDivinityAdmin } from '@/lib/permission-validator';
import { prisma } from '@/lib/prisma';

interface WorkspaceBillingInfo {
  id: string;
  name: string;
  plan: string;
  status: string;
  trialEndsAt: string | null;
  daysUntilTrialExpires: number | null;
  credits: {
    reportCreditsBalance: number;
    fullCreditsBalance: number;
    totalBalance: number;
  };
  users: {
    count: number;
    admin: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate user
    const { user } = await validateAuthAndGetUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Check if internal admin ONLY
    if (!isInternalDivinityAdmin(user.email)) {
      return NextResponse.json(
        { error: 'Only internal admins can view billing data' },
        { status: 403 }
      );
    }

    // 3. Get query parameters
    const url = new URL(request.url);
    const planFilter = url.searchParams.get('plan');
    const searchTerm = url.searchParams.get('search');
    const sortBy = url.searchParams.get('sort') || 'createdAt';
    const sortOrder = url.searchParams.get('order') || 'desc';

    // 4. Build where clause
    const whereClause: Record<string, unknown> = {};

    if (planFilter && planFilter !== 'ALL') {
      whereClause.plan = planFilter;
    }

    if (searchTerm) {
      whereClause.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { id: { contains: searchTerm } }
      ];
    }

    // 5. Fetch workspaces with relations
    const workspaces = await prisma.workspace.findMany({
      where: whereClause,
      include: {
        credits: true,
        users: {
          include: {
            user: {
              select: { email: true, name: true }
            }
          }
        }
      },
      orderBy: {
        [sortBy]: sortOrder.toLowerCase() === 'asc' ? 'asc' : 'desc'
      }
    });

    // 6. Transform data
    const billingData: WorkspaceBillingInfo[] = workspaces.map((workspace) => {
      const now = new Date();
      const daysUntilExpires = workspace.trialEndsAt
        ? Math.ceil((workspace.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      const adminUser = workspace.users.find(uw => uw.role === 'ADMIN');

      // Convert Decimal values to numbers for credit balances
      const reportCreditsBalance = workspace.credits?.reportCreditsBalance
        ? Number(workspace.credits.reportCreditsBalance)
        : 0;
      const fullCreditsBalance = workspace.credits?.fullCreditsBalance
        ? Number(workspace.credits.fullCreditsBalance)
        : 0;

      return {
        id: workspace.id,
        name: workspace.name,
        plan: workspace.plan,
        status: workspace.status,
        trialEndsAt: workspace.trialEndsAt?.toISOString() || null,
        daysUntilTrialExpires: daysUntilExpires,
        credits: {
          reportCreditsBalance,
          fullCreditsBalance,
          totalBalance: reportCreditsBalance + fullCreditsBalance
        },
        users: {
          count: workspace.users.length,
          admin: adminUser?.user?.email || null
        },
        createdAt: workspace.createdAt.toISOString(),
        updatedAt: workspace.updatedAt.toISOString()
      };
    });

    // 7. Calculate summary statistics
    const summary = {
      totalWorkspaces: billingData.length,
      byPlan: {
        TRIAL: billingData.filter(w => w.plan === 'TRIAL').length,
        FREE: billingData.filter(w => w.plan === 'FREE').length,
        GESTAO: billingData.filter(w => w.plan === 'GESTAO').length,
        PERFORMANCE: billingData.filter(w => w.plan === 'PERFORMANCE').length,
        ENTERPRISE: billingData.filter(w => w.plan === 'ENTERPRISE').length
      },
      byStatus: {
        ACTIVE: billingData.filter(w => w.status === 'ACTIVE').length,
        INACTIVE: billingData.filter(w => w.status === 'INACTIVE').length,
        SUSPENDED: billingData.filter(w => w.status === 'SUSPENDED').length
      },
      trialsExpiringIn7Days: billingData.filter(
        w => w.plan === 'TRIAL' && w.daysUntilTrialExpires !== null && w.daysUntilTrialExpires <= 7
      ).length,
      totalCreditsAllocated: billingData.reduce((sum, w) => sum + w.credits.totalBalance, 0)
    };

    return NextResponse.json({
      success: true,
      data: {
        workspaces: billingData,
        summary
      },
      meta: {
        count: billingData.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[ADMIN BILLING] Error fetching workspaces:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch workspaces'
      },
      { status: 500 }
    );
  }
}
