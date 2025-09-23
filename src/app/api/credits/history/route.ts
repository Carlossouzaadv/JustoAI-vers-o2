import { NextRequest } from 'next/server'
import { z } from 'zod'
import { successResponse, errorResponse, validateQuery, requireAuth, withErrorHandler, paginatedResponse } from '@/lib/api-utils'
import { getCreditManager } from '@/lib/credit-system'
import { ICONS } from '@/lib/icons'

// Query params validation schema
const historyQuerySchema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  type: z.enum(['debit', 'credit', 'all']).optional().default('all'),
  creditCategory: z.enum(['report', 'full', 'all']).optional().default('all'),
  startDate: z.string().optional(), // ISO date string
  endDate: z.string().optional()    // ISO date string
})

export const GET = withErrorHandler(async (request: NextRequest) => {
  // Auth check
  const { user, error: authError } = await requireAuth(request)
  if (authError) return authError

  // Validate query parameters
  const { data, error: validationError } = validateQuery(request, historyQuerySchema)
  if (validationError) return validationError

  const { workspaceId, page, limit, type, creditCategory, startDate, endDate } = data

  const pageNum = parseInt(page)
  const limitNum = parseInt(limit)

  // Validate pagination
  if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
    return errorResponse('Invalid pagination parameters. Page must be >= 1, limit between 1-100', 400)
  }

  console.log(`${ICONS.PROCESS} Fetching credit history for workspace ${workspaceId} (page ${pageNum}, limit ${limitNum})`)

  try {
    const creditSystem = getCreditManager()

    // Build filters
    const filters: any = { workspaceId }

    if (type !== 'all') {
      filters.type = type
    }

    if (creditCategory !== 'all') {
      filters.creditCategory = creditCategory
    }

    if (startDate) {
      filters.startDate = new Date(startDate)
    }

    if (endDate) {
      filters.endDate = new Date(endDate)
    }

    // Get paginated transaction history
    const historyResult = await creditSystem.getTransactionHistory(
      workspaceId,
      limitNum,
      (pageNum - 1) * limitNum,
      filters
    )

    if (!historyResult.success) {
      return errorResponse(historyResult.error || 'Failed to get transaction history', 500)
    }

    // Get total count for pagination
    const countResult = await creditSystem.getTransactionCount(workspaceId, filters)
    const totalCount = countResult.success ? countResult.count! : 0

    console.log(`${ICONS.SUCCESS} Credit history fetched: ${historyResult.transactions!.length} transactions`)

    return paginatedResponse(
      historyResult.transactions!,
      pageNum,
      limitNum,
      totalCount,
      `Retrieved ${historyResult.transactions!.length} credit transactions`
    )

  } catch (error) {
    console.error(`${ICONS.ERROR} Failed to fetch credit history:`, error)
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to fetch credit history',
      500
    )
  }
})