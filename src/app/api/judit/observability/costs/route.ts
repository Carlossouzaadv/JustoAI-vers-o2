// ================================================================
// API ROUTE: GET /api/judit/observability/costs
// Dashboard de custos em tempo real da integração JUDIT
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  getCostSummary,
  getCostBreakdown,
  getDailyCosts,
} from '@/lib/observability/costTracking';

// ================================================================
// HANDLER
// ================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const workspaceId = searchParams.get('workspaceId') || undefined;
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const daysParam = searchParams.get('days');

    // Parse dates
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (startDateParam) {
      startDate = new Date(startDateParam);
    }

    if (endDateParam) {
      endDate = new Date(endDateParam);
    }

    // If no dates provided, default to last 30 days
    if (!startDate && !endDate && !daysParam) {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      endDate = new Date();
    }

    // Fetch all cost data in parallel
    const [summary, breakdown, dailyCosts] = await Promise.all([
      getCostSummary(workspaceId, startDate, endDate),
      getCostBreakdown(workspaceId, startDate, endDate),
      getDailyCosts(workspaceId, daysParam ? parseInt(daysParam) : 30),
    ]);

    // Calculate additional insights
    const projectedMonthlyCost = calculateProjectedMonthlyCost(dailyCosts);
    const costTrend = calculateCostTrend(dailyCosts);

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          ...summary,
          projectedMonthlyCost,
          costTrend,
        },
        breakdown,
        dailyCosts,
        period: {
          startDate: startDate?.toISOString(),
          endDate: endDate?.toISOString(),
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[API] Error fetching costs:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error fetching costs',
      },
      { status: 500 }
    );
  }
}

// ================================================================
// HELPERS
// ================================================================

/**
 * Calcula projeção de custo mensal baseado nos últimos dias
 */
function calculateProjectedMonthlyCost(
  dailyCosts: Array<{ date: string; cost: number; operations: number }>
): number {
  if (dailyCosts.length === 0) return 0;

  // Calculate average daily cost
  const totalCost = dailyCosts.reduce((sum, day) => sum + day.cost, 0);
  const avgDailyCost = totalCost / dailyCosts.length;

  // Project to 30 days
  return avgDailyCost * 30;
}

/**
 * Calcula tendência de custo (comparando primeira e segunda metade do período)
 */
function calculateCostTrend(
  dailyCosts: Array<{ date: string; cost: number; operations: number }>
): 'increasing' | 'decreasing' | 'stable' {
  if (dailyCosts.length < 2) return 'stable';

  const midpoint = Math.floor(dailyCosts.length / 2);
  const firstHalf = dailyCosts.slice(0, midpoint);
  const secondHalf = dailyCosts.slice(midpoint);

  const avgFirstHalf =
    firstHalf.reduce((sum, day) => sum + day.cost, 0) / firstHalf.length;
  const avgSecondHalf =
    secondHalf.reduce((sum, day) => sum + day.cost, 0) / secondHalf.length;

  const changePercent = ((avgSecondHalf - avgFirstHalf) / avgFirstHalf) * 100;

  if (changePercent > 10) return 'increasing';
  if (changePercent < -10) return 'decreasing';
  return 'stable';
}
