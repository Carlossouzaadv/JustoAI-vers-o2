import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { successResponse, errorResponse, validateBody, requireAuth, withErrorHandler } from '@/lib/api-utils'
import { getCreditManager } from '@/lib/credit-system'
import { PlanService, type CreditPackConfig } from '@/lib/services/planService'
import { ICONS } from '@/lib/icons'
import { checkRateLimitWithConfig, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rate-limit-middleware'

type PaymentMethod = 'STRIPE' | 'PIX' | 'BOLETO';

function isValidPaymentMethod(value: unknown): value is PaymentMethod {
  if (typeof value !== 'string') return false;
  const validMethods: readonly string[] = ['STRIPE', 'PIX', 'BOLETO'];
  return validMethods.includes(value);
}

function isValidPackId(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  return PlanService.isValidCreditPackId(value);
}

// Purchase request validation schema
const purchaseSchema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  packId: z.string().min(1, 'Invalid pack ID'),
  paymentMethod: z.string().optional(),
  sourceDescription: z.string().optional()
}).refine(
  (data) => isValidPackId(data.packId),
  { message: 'Invalid credit pack ID', path: ['packId'] }
).refine(
  (data) => !data.paymentMethod || isValidPaymentMethod(data.paymentMethod),
  { message: 'Invalid payment method', path: ['paymentMethod'] }
);

type PurchaseRequest = z.infer<typeof purchaseSchema> & { packId: string; paymentMethod?: PaymentMethod }

export const POST = withErrorHandler(async (request: NextRequest) => {
  // Auth check
  const { error: authError } = await requireAuth(request)
  if (authError) return authError

  // Validate request body
  const { data, error: validationError } = await validateBody(request, purchaseSchema)
  if (validationError) return validationError

  // Type-safe narrowing
  const validatedData = data as PurchaseRequest
  const { workspaceId, packId, paymentMethod, sourceDescription } = validatedData

  // Rate limiting: 5 purchases per minute per workspace
  const isRateLimited = await checkRateLimitWithConfig(workspaceId, RATE_LIMIT_CONFIGS.PAYMENT)
  if (isRateLimited) {
    return errorResponse(
      'Too many purchase requests. Please wait before trying again.',
      429
    )
  }

  console.log(`${ICONS.PROCESS} Processing credit purchase: ${packId} for workspace ${workspaceId}`)

  try {
    const creditSystem = getCreditManager()

    // Get pack configuration from SSOT
    const packConfig = PlanService.getCreditPackById(packId)

    if (!packConfig) {
      return errorResponse(`Invalid credit pack: ${packId}`, 400)
    }

    // Calculate expiration date
    const expiresAt = new Date(Date.now() + packConfig.validityDays * 24 * 60 * 60 * 1000)

    // Create the credit allocation using unified credit system
    // All credits are unified - same type for both reports and full analysis
    await creditSystem.creditCredits(
      workspaceId,
      packConfig.credits, // Unified credit system: all credits are the same type
      0, // No separate "full" credits
      'PACK',
      sourceDescription || `${packConfig.name} - ${packConfig.description}`,
      expiresAt
    )

    console.log(`${ICONS.SUCCESS} Credit purchase completed: ${packConfig.name}`)

    // Return response with purchase details
    const purchaseId = `pack_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const priceFormatted = PlanService.getCreditPackPriceFormatted(packConfig.priceCents)

    return successResponse({
      purchaseId,
      packId,
      packName: packConfig.name,
      credits: packConfig.credits,
      pricing: {
        priceBRL: priceFormatted,
        priceCents: packConfig.priceCents,
      },
      discount: {
        percentage: Math.round(packConfig.discount * 100),
        amount: packConfig.discount > 0 ? 'Included' : 'None'
      },
      validity: {
        expiresAt: expiresAt.toISOString(),
        validityDays: packConfig.validityDays,
      },
      description: packConfig.description,
      purchaseDate: new Date().toISOString(),
      paymentMethod: paymentMethod || undefined
    })

  } catch (_error) {
    console.error(`${ICONS.ERROR} Credit purchase failed:`, error)
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to process credit purchase',
      500
    )
  }
})

// GET endpoint to list available credit packs from SSOT
export const GET = withErrorHandler(async (request: NextRequest) => {
  const { error: authError } = await requireAuth(request)
  if (authError) return authError

  const availablePacks = PlanService.getAllCreditPacks().map(pack => {
    const priceInfo = PlanService.getCreditPackEffectivePrice(pack)

    return {
      packId: pack.id,
      name: pack.name,
      description: pack.description,
      credits: pack.credits,
      pricing: {
        priceBRL: priceInfo.discountedFormatted,
        priceCents: pack.priceCents,
        originalPrice: priceInfo.originalFormatted,
        savings: priceInfo.savingsFormatted
      },
      discount: {
        percentage: Math.round(pack.discount * 100),
        hasDiscount: pack.discount > 0
      },
      validity: {
        validityDays: pack.validityDays
      }
    }
  })

  return successResponse({
    availablePacks,
    info: {
      creditSystem: 'Unified credits system',
      creditDescription: 'One credit can be used for: Full Analysis (1 credit) OR Report (~50 processes = 1 credit)'
    }
  })
})