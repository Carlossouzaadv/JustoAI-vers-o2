import { NextRequest } from 'next/server'
import { errorResponse, withErrorHandler, paginatedResponse } from '@/lib/api-utils'
import { getAuthenticatedUser } from '@/lib/auth-helper'
import { prisma } from '@/lib/prisma'
import { ICONS } from '@/lib/icons'

// Type guard: Validate user workspace relationship
interface UserWithWorkspace {
  id: string
  workspaceId: string
}

function isUserWithWorkspace(data: unknown): data is UserWithWorkspace {
  if (typeof data !== 'object' || data === null) return false
  const user = data as Record<string, unknown>
  return (
    'id' in user &&
    typeof user.id === 'string' &&
    'workspaceId' in user &&
    typeof user.workspaceId === 'string'
  )
}

// Activity feed item: Either a credit transaction or case analysis version
interface ActivityItem {
  id: string
  type: 'credit_debit' | 'credit_credit' | 'case_analysis'
  title: string
  description?: string
  creditAmount?: number
  creditCategory?: 'REPORT' | 'FULL'
  caseId?: string
  caseName?: string
  analysisVersion?: number
  status?: string
  timestamp: string
  icon: string
}

/**
 * GET /api/user/activity
 *
 * Returns combined activity feed for authenticated user:
 * - Credit transactions (debit/credit)
 * - Case analysis versions (completions, errors)
 *
 * NO query params for workspaceId - extracts from authenticated user.
 * Workspace filtering is automatic and mandatory.
 *
 * Query params:
 * - page: number (default 1)
 * - limit: number (default 20, max 100)
 * - type: 'all' | 'credits' | 'cases' (default 'all')
 *
 * Authentication: Standard auth (getAuthenticatedUser)
 * Workspace Filtering: Automatic via user's workspace (CRITICAL for security)
 *
 * Response:
 * {
 *   success: true,
 *   data: ActivityItem[];
 *   pagination: {
 *     page: number;
 *     limit: number;
 *     total: number;
 *     hasMore: boolean;
 *   };
 *   message: string;
 * }
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  // 1. Authenticate user using standard auth (NOT admin)
  const user = await getAuthenticatedUser(request)
  if (!user) {
    return errorResponse('Unauthorized', 401)
  }

  console.log(`${ICONS.PROCESS} Fetching activity for user ${user.id}`)

  try {
    // 2. Get user's workspace from database with type guard
    const userRecord = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        workspaces: {
          select: {
            workspaceId: true
          },
          take: 1
        }
      }
    })

    if (!userRecord || !userRecord.workspaces[0]) {
      console.warn(`${ICONS.WARNING} User ${user.id} not found or missing workspace`)
      return errorResponse('User workspace not found', 404)
    }

    const workspaceId = userRecord.workspaces[0].workspaceId

    // 3. Parse and validate query parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const activityType = (searchParams.get('type') as 'all' | 'credits' | 'cases') || 'all'

    // Validate pagination
    if (page < 1 || limit < 1 || limit > 100) {
      return errorResponse(
        'Invalid pagination parameters. Page must be >= 1, limit between 1-100',
        400
      )
    }

    console.log(
      `${ICONS.PROCESS} Fetching activity for workspace ${workspaceId} (page ${page}, limit ${limit}, type ${activityType})`
    )

    const activities: ActivityItem[] = []

    // 4. Fetch credit transactions (if requested) - CRITICAL: Filter by workspaceId
    if (activityType === 'all' || activityType === 'credits') {
      const transactions = await prisma.creditTransaction.findMany({
        where: {
          workspaceId // MANDATORY: Workspace isolation
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          type: true,
          creditCategory: true,
          amount: true,
          reason: true,
          metadata: true,
          createdAt: true
        },
        take: limit * 2 // Fetch extra to account for merging with case data
      })

      // Transform transactions to activity items (type-safe)
      for (const tx of transactions) {
        activities.push({
          id: `credit-${tx.id}`,
          type: tx.type === 'DEBIT' ? 'credit_debit' : 'credit_credit',
          title:
            tx.type === 'DEBIT'
              ? `Crédito Utilizado: ${tx.creditCategory === 'REPORT' ? 'Análise' : 'Relatório Completo'}`
              : `Créditos Adicionados: ${tx.creditCategory === 'REPORT' ? 'Análise' : 'Relatório Completo'}`,
          description: tx.reason || undefined,
          creditAmount: Number(tx.amount),
          creditCategory: (tx.creditCategory as 'REPORT' | 'FULL') || undefined,
          timestamp: tx.createdAt.toISOString(),
          icon: tx.type === 'DEBIT' ? '📊' : '✅'
        })
      }
    }

    // 5. Fetch case analysis versions (if requested) - CRITICAL: Filter by workspaceId
    if (activityType === 'all' || activityType === 'cases') {
      const analyses = await prisma.caseAnalysisVersion.findMany({
        where: {
          workspaceId // MANDATORY: Workspace isolation
        },
        select: {
          id: true,
          version: true,
          status: true,
          createdAt: true,
          case: {
            select: {
              id: true,
              title: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limit * 2 // Fetch extra to account for merging with credit data
      })

      // Transform analyses to activity items (type-safe)
      for (const analysis of analyses) {
        const statusLabel =
          analysis.status === 'COMPLETED'
            ? 'Concluída'
            : analysis.status === 'FAILED'
              ? 'Erro'
              : 'Processando'

        activities.push({
          id: `case-${analysis.id}`,
          type: 'case_analysis',
          title: `Análise ${statusLabel}: ${analysis.case.title}`,
          description: `Versão ${analysis.version}`,
          caseId: analysis.case.id,
          caseName: analysis.case.title,
          analysisVersion: analysis.version,
          status: analysis.status,
          timestamp: analysis.createdAt.toISOString(),
          icon:
            analysis.status === 'COMPLETED'
              ? '✅'
              : analysis.status === 'FAILED'
                ? '❌'
                : '⏳'
        })
      }
    }

    // 6. Sort combined activities by timestamp (newest first)
    const sortedActivities = activities.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )

    // 7. Get total count before pagination
    const totalCount = sortedActivities.length

    // 8. Apply pagination to combined results
    const paginatedActivities = sortedActivities.slice((page - 1) * limit, page * limit)

    console.log(`${ICONS.SUCCESS} Activity fetched: ${paginatedActivities.length} items (total ${totalCount})`)

    return paginatedResponse(
      paginatedActivities,
      page,
      limit,
      totalCount,
      `Retrieved ${paginatedActivities.length} activity items`
    )
  } catch (_error) {
    console.error(`${ICONS.ERROR} Failed to fetch activity:`, error)
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to fetch activity',
      500
    )
  }
})
