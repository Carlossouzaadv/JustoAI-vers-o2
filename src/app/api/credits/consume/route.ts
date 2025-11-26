import { NextRequest } from 'next/server'
import { z } from 'zod'
import { successResponse, errorResponse, validateBody, requireAuth, withErrorHandler } from '@/lib/api-utils'
import { getCreditManager } from '@/lib/credit-system'
import { PlanService } from '@/lib/services/planService'
import { ICONS } from '@/lib/icons'
import { checkRateLimitWithConfig, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rate-limit-middleware'

// Consumption request validation schema
const consumeSchema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  reportCredits: z.number().min(0).default(0),
  fullCredits: z.number().min(0).default(0),
  reason: z.string().min(1, 'Reason is required'),
  resourceType: z.enum(['report', 'analysis', 'full_analysis']),
  resourceId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({})
})

export const POST = withErrorHandler(async (request: NextRequest) => {
  // Auth check
  const { user, error: authError } = await requireAuth(request)
  if (authError) return authError

  // Validate request body
  const { data, error: validationError } = await validateBody(request, consumeSchema)
  if (validationError) return validationError

  const { workspaceId, reportCredits, fullCredits, reason, resourceType, resourceId, metadata } = data

  // Validate that at least one credit type is being consumed
  if (reportCredits === 0 && fullCredits === 0) {
    return errorResponse('Must consume at least one credit', 400)
  }

  // Rate limiting: 20 consumption requests per minute per workspace
  const isRateLimited = await checkRateLimitWithConfig(workspaceId, RATE_LIMIT_CONFIGS.CREDIT_CONSUMPTION)
  if (isRateLimited) {
    return errorResponse(
      'Too many credit consumption requests. Please wait before trying again.',
      429
    )
  }

  console.log(`${ICONS.PROCESS} Processing credit consumption: ${reportCredits} report + ${fullCredits} full credits for workspace ${workspaceId}`)

  try {
    const creditSystem = getCreditManager()

    // Check available credits first
    const balance = await creditSystem.getCreditBalance(workspaceId)

    // Check if sufficient credits are available
    if (balance.reportCreditsAvailable < reportCredits) {
      return errorResponse(
        `Insufficient report credits. Required: ${reportCredits}, Available: ${balance.reportCreditsAvailable}`,
        402 // Payment Required
      )
    }

    if (balance.fullCreditsAvailable < fullCredits) {
      return errorResponse(
        `Insufficient FULL credits. Required: ${fullCredits}, Available: ${balance.fullCreditsAvailable}`,
        402 // Payment Required
      )
    }

    // Debit the credits
    const debitResult = await creditSystem.debitCredits(
      workspaceId,
      reportCredits,
      fullCredits,
      reason,
      {
        ...metadata,
        resourceType,
        resourceId,
        userId: user.id,
        timestamp: new Date().toISOString()
      }
    )

    if (!debitResult.success) {
      return errorResponse(debitResult.error || 'Failed to debit credits', 500)
    }

    // Get updated balance
    const updatedBalance = await creditSystem.getCreditBalance(workspaceId)

    console.log(`${ICONS.SUCCESS} Credit consumption completed: ${reportCredits}R + ${fullCredits}F credits`)

    return successResponse({
      consumption: {
        reportCreditsConsumed: reportCredits,
        fullCreditsConsumed: fullCredits,
        totalConsumed: reportCredits + fullCredits,
        reason,
        resourceType,
        resourceId
      },
      transactionIds: debitResult.transactionIds,
      updatedBalance: {
        reportCreditsBalance: updatedBalance.reportCreditsBalance,
        fullCreditsBalance: updatedBalance.fullCreditsBalance,
        totalBalance: updatedBalance.reportCreditsBalance + updatedBalance.fullCreditsBalance
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error(`${ICONS.ERROR} Credit consumption failed:`, error)
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to consume credits',
      500
    )
  }
})

// GET endpoint to estimate credit cost for different operations
// Uses unified credit system from SSOT (src/config/plans.ts)
export const GET = withErrorHandler(async (request: NextRequest) => {
  const { error: authError } = await requireAuth(request)
  if (authError) return authError

  const { searchParams } = new URL(request.url)
  const processCount = parseInt(searchParams.get('processCount') || '1')
  const operationType = searchParams.get('type') || 'report' // report or full_analysis

  try {
    const estimatedCost = { totalCredits: 0, unifiedCredits: 0 }

    if (operationType === 'report') {
      // Unified rate: 1 credit per ~50 processes
      estimatedCost.unifiedCredits = PlanService.calculateReportCost(processCount)
      estimatedCost.totalCredits = estimatedCost.unifiedCredits
    } else if (operationType === 'full_analysis') {
      // Full analysis: 1 credit per analysis (regardless of process count)
      estimatedCost.unifiedCredits = PlanService.calculateFullAnalysisCost()
      estimatedCost.totalCredits = estimatedCost.unifiedCredits
    }

    return successResponse({
      operationType,
      processCount,
      estimatedCost: {
        unifiedCredits: estimatedCost.unifiedCredits,
        totalCredits: estimatedCost.totalCredits
      },
      creditRates: {
        reportCost: 'Unified: 1 credit per ~50 processes',
        fullAnalysisCost: 'Unified: 1 credit per analysis',
        examples: {
          report50Processes: '1 credit',
          report100Processes: '2 credits',
          report150Processes: '3 credits',
          fullAnalysis: '1 credit'
        }
      },
      systemInfo: {
        creditSystem: 'Unified credits system',
        description: 'One credit type for both reports and full analyses'
      }
    })

  } catch (error) {
    console.error(`${ICONS.ERROR} Credit estimation failed:`, error)
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to estimate credit cost',
      500
    )
  }
})