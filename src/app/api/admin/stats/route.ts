/**
 * Admin Statistics API
 * Retorna dados de saúde do sistema (Padrão-Ouro)
 * - Total de Workspaces
 * - Total de Análises criadas hoje
 * - Total de créditos reembolsados hoje
 * - Total de Alertas CRITICAL não resolvidos
 *
 * Acessível apenas por: Internal admins (@justoai.com.br)
 * Rota: GET /api/admin/stats
 */

import { NextResponse } from 'next/server';
import { validateAuthAndGetUser } from '@/lib/auth';
import { isInternalAdmin } from '@/lib/permission-validator';
import { prisma } from '@/lib/prisma';
import { getErrorMessage } from '@/lib/error-handling';

interface AdminStats {
  totalWorkspaces: number;
  analysisCreatedToday: number;
  refundsToday: {
    count: number;
    totalAmount: string;
  };
  criticalAlertsUnresolved: number;
  timestamp: string;
}

// Type guards para safe narrowing (Mandato Inegociável)
function isValidStats(data: unknown): data is AdminStats {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const obj = data as Record<string, unknown>;

  return (
    'totalWorkspaces' in obj && typeof obj.totalWorkspaces === 'number' &&
    'analysisCreatedToday' in obj && typeof obj.analysisCreatedToday === 'number' &&
    'refundsToday' in obj && typeof obj.refundsToday === 'object' &&
    'criticalAlertsUnresolved' in obj && typeof obj.criticalAlertsUnresolved === 'number' &&
    'timestamp' in obj && typeof obj.timestamp === 'string'
  );
}

export async function GET() {
  try {
    // 1. Authenticate
    const { user } = await validateAuthAndGetUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Check if user is internal admin
    if (!isInternalAdmin(user.email)) {
      return NextResponse.json(
        { error: 'Forbidden - This endpoint is restricted to internal admins only' },
        { status: 403 }
      );
    }

    // 3. Calculate today's start (00:00 UTC)
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // 4. Execute all queries in parallel
    const [
      workspacesCount,
      analysesCreatedToday,
      refundsData,
      criticalAlerts
    ] = await Promise.all([
      // Total workspaces
      prisma.workspace.count(),

      // Analyses created today
      prisma.caseAnalysisVersion.count({
        where: {
          createdAt: {
            gte: today
          }
        }
      }),

      // Refunds today (CREDIT type with reason containing "reembolso" or "refund")
      prisma.creditTransaction.findMany({
        where: {
          type: 'CREDIT',
          createdAt: {
            gte: today
          },
          OR: [
            { reason: { contains: 'Reembolso', mode: 'insensitive' } },
            { reason: { contains: 'Refund', mode: 'insensitive' } }
          ]
        },
        select: {
          amount: true
        }
      }),

      // Critical alerts unresolved
      prisma.juditAlert.count({
        where: {
          severity: 'CRITICAL',
          resolved: false
        }
      })
    ]);

    // 5. Calculate refunds total
    const refundsTotal = refundsData.reduce((sum, tx) => {
      return sum + Number(tx.amount);
    }, 0);

    const stats: AdminStats = {
      totalWorkspaces: workspacesCount,
      analysisCreatedToday: analysesCreatedToday,
      refundsToday: {
        count: refundsData.length,
        totalAmount: refundsTotal.toFixed(2)
      },
      criticalAlertsUnresolved: criticalAlerts,
      timestamp: new Date().toISOString()
    };

    // 6. Validate stats shape
    if (!isValidStats(stats)) {
      throw new Error('Invalid stats shape generated');
    }

    return NextResponse.json({
      success: true,
      stats,
      message: 'Admin statistics fetched successfully'
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=60' // Cache for 1 minute
      }
    });
  } catch (_error) {
    console.error('Error fetching admin stats:', error);
    return NextResponse.json(
      {
        success: false,
        error: getErrorMessage(error),
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
