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
    const balance = await creditSystem.getCreditBalance(workspaceId)

    // Build response object with type safety
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

    // Include breakdown by allocation type if requested
    const responseData: Record<string, unknown> = { ...response }

    if (includeBreakdown === 'true') {
      const breakdown = await creditSystem.getCreditBreakdown(workspaceId)
      responseData.breakdown = breakdown
    }

    // Note: getTransactionHistory not implemented in CreditManager
    // Kept for future extensibility, currently commented
    // if (includeHistory === 'true') {
    //   const history = await creditSystem.getTransactionHistory(workspaceId, 20)
    //   responseData.recentTransactions = history
    // }

    console.log(`${ICONS.SUCCESS} Credit balance fetched: ${balance.reportCreditsBalance}R + ${balance.fullCreditsBalance}F`)

    return successResponse(responseData)

  } catch (error) {
    console.error(`${ICONS.ERROR} Failed to fetch credit balance:`, error)
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to fetch credit balance',
      500
    )
  }
})