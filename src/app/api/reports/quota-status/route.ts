import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { PlanService } from '@/lib/services/planService'

const prisma = new PrismaClient()

/**
 * GET /api/reports/quota-status?workspaceId=xxx
 *
 * Returns quota status for reports based on the workspace's plan.
 * Fetches actual workspace plan and report counts from database.
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

    // Fetch actual workspace plan from database
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        name: true,
        plan: true,
      }
    })

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      )
    }

    // Map database plan to plan service ID
    const planId = workspace.plan?.toLowerCase() || 'free'
    const plan = PlanService.getPlanConfigSafe(planId)

    if (!plan) {
      return NextResponse.json(
        { error: 'Plan configuration not found' },
        { status: 500 }
      )
    }

    // Count actual report executions created this month for this workspace
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

    const quotaUsed = await prisma.reportExecution.count({
      where: {
        workspace: {
          id: workspaceId
        },
        createdAt: {
          gte: monthStart,
          lte: monthEnd
        }
      }
    })

    // Calculate quota limits based on plan
    const estimatedReportsPerMonth = Math.floor(plan.monthlyCredits)
    const quotaPercentage = estimatedReportsPerMonth > 0
      ? Math.round((quotaUsed / estimatedReportsPerMonth) * 100)
      : 0

    return NextResponse.json({
      success: true,
      data: {
        workspaceId,
        plan: {
          id: plan.id,
          name: plan.name,
          monthlyCredits: plan.monthlyCredits,
          databasePlan: workspace.plan,
        },
        quota: {
          limit: estimatedReportsPerMonth,
          used: quotaUsed,
          remaining: Math.max(0, estimatedReportsPerMonth - quotaUsed),
          percentage: quotaPercentage,
        },
        creditInfo: {
          system: 'Unified credits',
          costPerReport: '1 credit per ~50 processes',
          costPerFullAnalysis: '1 credit per analysis',
          estimatedReportsPerMonth: estimatedReportsPerMonth,
        },
        period: {
          start: monthStart.toISOString(),
          end: monthEnd.toISOString(),
        },
        note: 'Quota calculated based on monthly credit allocation. Counts actual report executions.',
      },
    })
  } catch (_error) {
    console.error('Error getting quota status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}
