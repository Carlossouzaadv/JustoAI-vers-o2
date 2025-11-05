import { NextRequest } from 'next/server'
import { z } from 'zod'
import { successResponse, errorResponse, validateQuery, requireAuth, withErrorHandler } from '@/lib/api-utils'
import { getCreditManager } from '@/lib/credit-system'
import { ICONS } from '@/lib/icons'

// Query params validation schema
const balanceQuerySchema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  includeBreakdown: z.enum(['true', 'false']).optional().default('false'),
  includeHistory: z.enum(['true', 'false']).optional().default('false')
})

export const GET = withErrorHandler(async (request: NextRequest) => {
  // Auth check
  const { user, error: authError } = await requireAuth(request)
  if (authError) return authError

  // Validate query parameters
  const { data, error: validationError } = validateQuery(request, balanceQuerySchema)
  if (validationError) return validationError

  const { workspaceId, includeBreakdown, includeHistory } = data

  console.log(`${ICONS.PROCESS} Fetching credit balance for workspace ${workspaceId}`)

  try {
    const creditSystem = getCreditManager()

    // Get basic balance
    const balanceResult = await creditSystem.getWorkspaceCredits(workspaceId)
    if (!balanceResult.success) {
      return errorResponse(balanceResult.error || 'Failed to get workspace credits', 500)
    }

    const response: unknown = {
      workspaceId,
      balance: balanceResult.credits,
      lastUpdated: new Date().toISOString()
    }

    // Include breakdown by allocation type if requested
    if (includeBreakdown === 'true') {
      const breakdownResult = await creditSystem.getCreditBreakdown(workspaceId)
      if (breakdownResult.success) {
        response.breakdown = breakdownResult.breakdown
      }
    }

    // Include recent transaction history if requested
    if (includeHistory === 'true') {
      const historyResult = await creditSystem.getTransactionHistory(workspaceId, 20)
      if (historyResult.success) {
        response.recentTransactions = historyResult.transactions
      }
    }

    console.log(`${ICONS.SUCCESS} Credit balance fetched: ${balanceResult.credits?.reportCreditsBalance}R + ${balanceResult.credits?.fullCreditsBalance}F`)

    return successResponse(response)

  } catch (error) {
    console.error(`${ICONS.ERROR} Failed to fetch credit balance:`, error)
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to fetch credit balance',
      500
    )
  }
})