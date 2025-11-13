import { NextRequest } from 'next/server'
import { z } from 'zod'
import { successResponse, errorResponse, validateBody, requireAuth, withErrorHandler } from '@/lib/api-utils'
import { getCreditManager } from '@/lib/credit-system'
import { ICONS } from '@/lib/icons'

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
export const GET = withErrorHandler(async (request: NextRequest) => {
  const { error: authError } = await requireAuth(request)
  if (authError) return authError

  const { searchParams } = new URL(request.url)
  const processCount = parseInt(searchParams.get('processCount') || '1')
  const analysisType = searchParams.get('analysisType') || 'FAST' // FAST or FULL

  try {
    const creditSystem = getCreditManager()

    const estimatedCost = { reportCredits: 0, fullCredits: 0 }

    if (analysisType === 'FAST') {
      // Calculate micro-tier pricing for report credits
      estimatedCost.reportCredits = creditSystem.calculateReportCreditCost(processCount)
    } else if (analysisType === 'FULL') {
      // FULL analysis pricing (10 processes per credit)
      estimatedCost.fullCredits = Math.ceil(processCount / 10)
    }

    return successResponse({
      processCount,
      analysisType,
      estimatedCost,
      pricing: {
        reportCreditTiers: [
          { processes: '1-5', creditCost: 0.25 },
          { processes: '6-12', creditCost: 0.5 },
          { processes: '13-25', creditCost: 1.0 }
        ],
        fullCreditTier: {
          processes: 'up to 10 per credit',
          creditCost: 1.0
        }
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