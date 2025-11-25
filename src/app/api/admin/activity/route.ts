/**
 * Admin Activity API
 * Retorna audit trail do sistema (Padrão-Ouro)
 * - Últimas 50 transações de crédito
 * - Últimas 50 análises de casos criadas
 * Combinadas e ordenadas por data DESC
 *
 * Acessível apenas por: Internal admins (@justoai.com.br)
 * Rota: GET /api/admin/activity
 */

import { NextResponse } from 'next/server';
import { validateAuthAndGetUser } from '@/lib/auth';
import { isInternalAdmin } from '@/lib/permission-validator';
import { prisma } from '@/lib/prisma';
import { getErrorMessage } from '@/lib/error-handling';
import { Decimal } from '@prisma/client/runtime/library';

interface ActivityEvent {
  id: string;
  type: 'CREDIT_TRANSACTION' | 'CASE_ANALYSIS';
  action: string;
  workspaceId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  relatedEntity?: {
    id: string;
    name: string;
  };
}

// Type guard for activity events
function isActivityEvent(data: unknown): data is ActivityEvent {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const obj = data as Record<string, unknown>;

  return (
    'id' in obj && typeof obj.id === 'string' &&
    'type' in obj && (obj.type === 'CREDIT_TRANSACTION' || obj.type === 'CASE_ANALYSIS') &&
    'action' in obj && typeof obj.action === 'string' &&
    'workspaceId' in obj && typeof obj.workspaceId === 'string' &&
    'metadata' in obj && typeof obj.metadata === 'object' &&
    'createdAt' in obj && typeof obj.createdAt === 'string'
  );
}

// Helper to convert Decimal to string safely
function decimalToString(value: unknown): string {
  if (value instanceof Decimal) {
    return value.toString();
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return value.toFixed(2);
  }
  return '0.00';
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

    // 3. Fetch credit transactions (últimas 50)
    const creditTransactions = await prisma.creditTransaction.findMany({
      select: {
        id: true,
        workspaceId: true,
        type: true,
        creditCategory: true,
        amount: true,
        reason: true,
        createdAt: true,
        workspace: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    // 4. Fetch case analysis versions (últimas 50)
    const analysisVersions = await prisma.caseAnalysisVersion.findMany({
      select: {
        id: true,
        caseId: true,
        workspaceId: true,
        version: true,
        status: true,
        createdAt: true,
        case: {
          select: {
            id: true,
            number: true
          }
        },
        workspace: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    // 5. Transform credit transactions to activity events
    const creditEvents: ActivityEvent[] = creditTransactions.map(tx => ({
      id: tx.id,
      type: 'CREDIT_TRANSACTION',
      action: `${tx.type === 'CREDIT' ? 'Crédito adicionado' : 'Crédito debitado'} (${tx.creditCategory})`,
      workspaceId: tx.workspaceId,
      metadata: {
        transactionType: tx.type,
        creditCategory: tx.creditCategory,
        amount: decimalToString(tx.amount),
        reason: tx.reason
      },
      createdAt: tx.createdAt.toISOString(),
      relatedEntity: tx.workspace ? {
        id: tx.workspace.id,
        name: tx.workspace.name
      } : undefined
    }));

    // 6. Transform analysis versions to activity events
    const analysisEvents: ActivityEvent[] = analysisVersions.map(av => ({
      id: av.id,
      type: 'CASE_ANALYSIS',
      action: `Análise v${av.version} criada (Status: ${av.status})`,
      workspaceId: av.workspaceId,
      metadata: {
        caseId: av.caseId,
        version: av.version,
        status: av.status,
        caseNumber: av.case?.number || 'N/A'
      },
      createdAt: av.createdAt.toISOString(),
      relatedEntity: av.case ? {
        id: av.caseId,
        name: `Caso ${av.case.number}`
      } : undefined
    }));

    // 7. Combine and sort by date (newest first)
    const allEvents: ActivityEvent[] = [...creditEvents, ...analysisEvents]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // 8. Validate events (filter with type predicate)
    const validEvents: ActivityEvent[] = allEvents.filter((event): event is ActivityEvent => {
      if (!isActivityEvent(event)) {
        console.warn(`Invalid activity event:`, event);
        return false;
      }
      return true;
    });

    return NextResponse.json({
      success: true,
      activity: {
        events: validEvents,
        totalEvents: validEvents.length,
        creditTransactionsCount: creditEvents.length,
        analysisVersionsCount: analysisEvents.length
      },
      timestamp: new Date().toISOString(),
      message: 'Activity feed fetched successfully'
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=30' // Cache for 30 seconds (real-time)
      }
    });
  } catch (_error) {
    console.error('Error fetching admin activity:', error);
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
