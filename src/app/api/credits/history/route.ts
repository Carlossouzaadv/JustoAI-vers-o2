import { NextRequest } from 'next/server'
import type { CreditTransactionFindManyArgs } from '@/lib/types/database';
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { successResponse, errorResponse, validateQuery, requireAuth, withErrorHandler, paginatedResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'
import { ICONS } from '@/lib/icons'

// ================================================================
// TYPE GUARDS & HELPERS (Padrão-Ouro - Type Safety)
// ================================================================

/**
 * Type for transaction history filters
 */
type TransactionFilters = {
  workspaceId: string;
  type?: 'debit' | 'credit';
  creditCategory?: 'report' | 'full';
  startDate?: Date;
  endDate?: Date;
};

/**
 * Type guard: Validates transaction type enum
 */
function isValidTransactionType(type: unknown): type is 'debit' | 'credit' {
  return type === 'debit' || type === 'credit';
}

/**
 * Type guard: Validates credit category enum
 */
function isValidTransactionCategory(category: unknown): category is 'report' | 'full' {
  return category === 'report' || category === 'full';
}

/**
 * Type guard: Validates filters object structure
 */
function isValidTransactionFilters(data: unknown): data is TransactionFilters {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const f = data as Record<string, unknown>;
  return (
    'workspaceId' in f &&
    typeof f.workspaceId === 'string' &&
    (f.type === undefined || isValidTransactionType(f.type)) &&
    (f.creditCategory === undefined || isValidTransactionCategory(f.creditCategory)) &&
    (f.startDate === undefined || f.startDate instanceof Date) &&
    (f.endDate === undefined || f.endDate instanceof Date)
  );
}

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
    // Build filters with type safety using type guards (NO casting)
    const filterInput: TransactionFilters = { workspaceId }

    if (type !== 'all' && isValidTransactionType(type)) {
      filterInput.type = type;
    }

    if (creditCategory !== 'all' && isValidTransactionCategory(creditCategory)) {
      filterInput.creditCategory = creditCategory;
    }

    if (startDate) {
      filterInput.startDate = new Date(startDate)
    }

    if (endDate) {
      filterInput.endDate = new Date(endDate)
    }

    // Validate filters object
    if (!isValidTransactionFilters(filterInput)) {
      return errorResponse('Invalid transaction filters', 400)
    }

    // Build Prisma where clause with type safety
    type WhereClause = CreditTransactionFindManyArgs['where'];
    const where: WhereClause = {
      workspaceId: filterInput.workspaceId,
    }

    if (filterInput.type) {
      where.type = filterInput.type === 'debit' ? 'DEBIT' : 'CREDIT'
    }

    if (filterInput.creditCategory) {
      where.creditCategory = filterInput.creditCategory === 'report' ? 'REPORT' : 'FULL'
    }

    // Handle date filtering safely
    if (filterInput.startDate || filterInput.endDate) {
      type DateFilter = { gte?: Date; lte?: Date };
      const dateFilter: DateFilter = {}

      if (filterInput.startDate) {
        dateFilter.gte = filterInput.startDate
      }
      if (filterInput.endDate) {
        dateFilter.lte = filterInput.endDate
      }

      where.createdAt = dateFilter
    }

    // Get paginated transaction history
    const transactions = await prisma.creditTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      select: {
        id: true,
        workspaceId: true,
        type: true,
        creditCategory: true,
        amount: true,
        reason: true,
        metadata: true,
        createdAt: true,
      },
    })

    // Get total count for pagination
    const totalCount = await prisma.creditTransaction.count({ where })

    console.log(`${ICONS.SUCCESS} Credit history fetched: ${transactions.length} transactions`)

    return paginatedResponse(
      transactions,
      pageNum,
      limitNum,
      totalCount,
      `Retrieved ${transactions.length} credit transactions`
    )

  } catch (error) {
    console.error(`${ICONS.ERROR} Failed to fetch credit history:`, error)
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to fetch credit history',
      500
    )
  }
})