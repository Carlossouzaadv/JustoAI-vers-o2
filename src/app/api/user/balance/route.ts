import { NextRequest, NextResponse } from 'next/server'
import { successResponse, errorResponse, withErrorHandler } from '@/lib/api-utils'
import { getCreditManager } from '@/lib/credit-system'
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

/**
 * GET /api/user/balance
 *
 * Returns the authenticated user's credit balance.
 * NO query params required - extracts workspaceId from authenticated user.
 *
 * Authentication: Standard auth (getAuthenticatedUser)
 * Workspace Filtering: Automatic via user's workspace
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     workspaceId: string;
 *     balance: {
 *       reportCreditsBalance: number;
 *       fullCreditsBalance: number;
 *       reportCreditsAvailable: number;
 *       fullCreditsAvailable: number;
 *     };
 *     breakdown?: CreditAllocationBreakdown[];
 *     lastUpdated: ISO8601 string;
 *   }
 * }
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  // 1. Authenticate user using standard auth (NOT admin)
  const user = await getAuthenticatedUser(request)
  if (!user) {
    return errorResponse('Unauthorized', 401)
  }

  console.log(`${ICONS.PROCESS} Fetching balance for user ${user.id}`)

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

    // Type guard: Ensure user has workspaceId
    if (!userRecord || !userRecord.workspaces[0]) {
      console.warn(`${ICONS.WARNING} User ${user.id} not found or missing workspace`)
      return errorResponse('User workspace not found', 404)
    }

    const workspaceId = userRecord.workspaces[0].workspaceId

    // 3. Get credit balance using CreditManager
    const creditSystem = getCreditManager()
    const balance = await creditSystem.getCreditBalance(workspaceId)

    // 4. Build response
    const response = {
      workspaceId,
      balance: {
        reportCreditsBalance: balance.reportCreditsBalance,
        fullCreditsBalance: balance.fullCreditsBalance,
        reportCreditsAvailable: balance.reportCreditsAvailable,
        fullCreditsAvailable: balance.fullCreditsAvailable
      },
      lastUpdated: new Date().toISOString()
    } as const

    // 5. Include breakdown if requested
    const responseData: Record<string, unknown> = { ...response }

    // Get query params for optional breakdown
    const { searchParams } = new URL(request.url)
    const includeBreakdown = searchParams.get('includeBreakdown') === 'true'

    if (includeBreakdown) {
      const breakdown = await creditSystem.getCreditBreakdown(workspaceId)
      responseData.breakdown = breakdown
    }

    console.log(
      `${ICONS.SUCCESS} Balance fetched for workspace ${workspaceId}: ${balance.reportCreditsBalance}R + ${balance.fullCreditsBalance}F`
    )

    return successResponse(responseData)
  } catch (_error) {
    console.error(`${ICONS.ERROR} Failed to fetch balance:`, error)
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to fetch balance',
      500
    )
  }
})
