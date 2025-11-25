// ================================================================
// API ROUTE: /api/telemetry/monthly-usage
// Real monthly usage data from JuditCostTracking
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth-helper';
import { captureApiError, setSentryUserContext } from '@/lib/sentry-error-handler';
import { ICONS } from '@/lib/icons';
import { getErrorMessage } from '@/lib/error-handling';

// Type guard for status field validation
function isSuccessStatus(status: unknown): status is 'success' {
  return status === 'success';
}

// Interface matching Prisma JuditCostTracking schema fields
interface PrismaJuditCostTracking {
  id: string;
  status: string;
  numeroCnj: string | null;
  workspaceId: string | null;
  createdAt: Date;
  requestId: string | null;
  movementsCount: number;
  errorMessage: string | null;
  totalCost: number;
  inputCost: number;
  outputCost: number;
  inputTokens: number;
  outputTokens: number;
  durationMs: number | null;
  documentsRetrieved: number | null;
  operationType: string;
}

// Helper to safely extract numeric totalCost
function getTotalCost(call: PrismaJuditCostTracking): number {
  return typeof call.totalCost === 'number' ? call.totalCost : 0;
}

// Helper to safely extract durationMs
function getDuration(call: PrismaJuditCostTracking): number {
  return typeof call.durationMs === 'number' ? call.durationMs : 0;
}

// Helper to safely extract documentsRetrieved
function getDocumentsRetrieved(call: PrismaJuditCostTracking): number {
  return typeof call.documentsRetrieved === 'number' ? call.documentsRetrieved : 0;
}

// ================================================================
// GET HANDLER: Get monthly usage and costs
// ================================================================

export async function GET(request: NextRequest) {
  // Declare userId outside try-catch to ensure it's available in catch block
  let userId: string | undefined;

  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return unauthorizedResponse('Não autenticado');
    }

    // Set userId after validating user exists (Padrão-Ouro)
    userId = user.id;

    setSentryUserContext(user.id);

    console.log(`${ICONS.INFO} [Telemetry Usage] Fetching monthly usage for user ${user.id}`);

    // Get user's workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: { userId: user.id },
      include: { workspace: true },
    });

    if (!userWorkspace) {
      return NextResponse.json(
        { success: false, error: 'Usuário não possui workspace' },
        { status: 403 }
      );
    }

    const workspaceId = userWorkspace.workspaceId;

    // Calculate date range (this month)
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endDate.setHours(23, 59, 59, 999);

    // Query all metrics
    const [juditCalls, documents, cases, credits] = await Promise.all([
      prisma.juditCostTracking.findMany({
        where: {
          workspaceId,
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
      prisma.caseDocument.count({
        where: {
          case: { workspaceId },
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
      prisma.case.count({
        where: {
          workspaceId,
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
      prisma.workspaceCredits.findUnique({
        where: { workspaceId },
      }),
    ]);

    // Type assertion: Prisma returns JuditCostTracking records
    const typedJuditCalls = juditCalls as unknown as PrismaJuditCostTracking[];

    // Aggregate JUDIT metrics
    const juditMetrics = {
      calls: typedJuditCalls.length,
      successful: typedJuditCalls.filter((c) => isSuccessStatus(c.status)).length,
      failed: typedJuditCalls.filter((c) => !isSuccessStatus(c.status)).length,
      totalCost: typedJuditCalls.reduce((sum, c) => sum + getTotalCost(c), 0),
      avgDuration: typedJuditCalls.length > 0
        ? typedJuditCalls.reduce((sum, c) => sum + getDuration(c), 0) / typedJuditCalls.length
        : 0,
      documentsRetrieved: typedJuditCalls.reduce((sum, c) => sum + getDocumentsRetrieved(c), 0),
      byOperation: {} as Record<string, { count: number; cost: number }>,
    };

    // Aggregate by operation type
    for (const call of typedJuditCalls) {
      const op = call.operationType;
      if (!juditMetrics.byOperation[op]) {
        juditMetrics.byOperation[op] = { count: 0, cost: 0 };
      }
      juditMetrics.byOperation[op].count++;
      juditMetrics.byOperation[op].cost += getTotalCost(call);
    }

    const successRate =
      juditMetrics.calls > 0 ? (juditMetrics.successful / juditMetrics.calls) * 100 : 0;

    const response = {
      success: true,
      period: {
        month: startDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' }),
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      usage: {
        processes: {
          created: cases,
          limit: 100,
          percentage: Math.round((cases / 100) * 100),
        },
        documents: {
          uploaded: documents,
          storageUsed: documents * 5242880,
          storageLimit: 10737418240,
          storagePercentage: Math.round(((documents * 5242880) / 10737418240) * 100),
        },
        api: {
          juditCalls: juditMetrics.calls,
          successfulCalls: juditMetrics.successful,
          failedCalls: juditMetrics.failed,
          successRate: successRate.toFixed(1),
          avgResponseTime: Math.round(juditMetrics.avgDuration),
          documentsRetrieved: juditMetrics.documentsRetrieved,
          estimatedCost: juditMetrics.totalCost.toFixed(2),
          byOperation: juditMetrics.byOperation,
        },
        credits: {
          consumed: 0,
          remaining: credits?.fullCreditsBalance || 0,
          percentage: 0,
          status: 'ok',
        },
      },
    };

    console.log(`${ICONS.SUCCESS} [Telemetry Usage] Monthly usage calculated successfully`);

    return NextResponse.json(response);

  } catch (_error) {
    console.error(`${ICONS.ERROR} [Telemetry Usage] Error:`, error);

    // userId is safely available here (either set in try or undefined)
    captureApiError(error, {
      endpoint: '/api/telemetry/monthly-usage',
      method: 'GET',
      userId,
    });

    return NextResponse.json(
      {
        success: false,
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
