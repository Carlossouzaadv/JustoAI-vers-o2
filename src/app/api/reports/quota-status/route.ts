import { NextRequest, NextResponse } from 'next/server'
import { PlanService } from '@/lib/services/planService'

/**
 * GET /api/reports/quota-status?workspaceId=xxx
 *
 * Returns quota status for reports based on the workspace's plan.
 * Uses SSOT (Single Source of Truth) from src/config/plans.ts
 *
 * TODO: In the future, integrate with database to get actual workspace plan
 * and track actual report counts. For now, returns plan-based limits.
 */
export async function GET(request: NextRequest) {
  try {
    // Get workspaceId from query
    const workspaceId = request.nextUrl.searchParams.get('workspaceId')
    if (!workspaceId) {
      return NextResponse.json(
        { error: 'workspaceId is required' },
        { status: 400 }
      )
    }

    // TODO: Fetch actual workspace plan from database
    // For now, use default plan (GESTAO) - this should be retrieved from DB
    const defaultPlanId = 'gestao'

    const plan = PlanService.getPlanConfigSafe(defaultPlanId)

    if (!plan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 500 }
      )
    }

    // Calculate estimated quota based on monthly credits
    // Reports cost: 1 credit per ~50 processes
    // Assuming average report of 50 processes for quota calculation
    const estimatedReportsPerMonth = plan.monthlyCredits
    const estimatedReportsAvailable = estimatedReportsPerMonth

    // TODO: Get actual report count from database
    const quotaUsed = 0 // Placeholder - should be fetched from DB
    const quotaPercentage = estimatedReportsAvailable > 0
      ? Math.round((quotaUsed / estimatedReportsAvailable) * 100)
      : 0

    return NextResponse.json({
      success: true,
      data: {
        workspaceId,
        plan: {
          id: plan.id,
          name: plan.name,
          monthlyCredits: plan.monthlyCredits,
        },
        quota: {
          limit: estimatedReportsAvailable,
          used: quotaUsed,
          remaining: Math.max(0, estimatedReportsAvailable - quotaUsed),
          percentage: quotaPercentage,
        },
        creditInfo: {
          system: 'Unified credits',
          costPerReport: '1 credit per ~50 processes',
          costPerFullAnalysis: '1 credit per analysis',
          estimatedReportsPerMonth: Math.floor(plan.monthlyCredits),
        },
        note: 'Quota calculated based on monthly credit allocation. Actual usage tracked separately.',
      },
    })
  } catch (error) {
    console.error('Error getting quota status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
