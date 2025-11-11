import { NextRequest } from 'next/server'
import { z } from 'zod'
import { successResponse, errorResponse, validateBody, requireAuth, withErrorHandler } from '@/lib/api-utils'
import { getCreditManager } from '@/lib/credit-system'
import { ICONS } from '@/lib/icons'

// Type-safe pack type validation using narrowing
type PackType = 'REPORT_5' | 'REPORT_20' | 'REPORT_50' | 'FULL_5' | 'FULL_15' | 'FULL_35';
type PaymentMethod = 'STRIPE' | 'PIX' | 'BOLETO';

function isValidPackType(value: unknown): value is PackType {
  if (typeof value !== 'string') return false;
  // Array as readonly string[] for type-safe comparison (string-to-string)
  const validTypes: readonly string[] = ['REPORT_5', 'REPORT_20', 'REPORT_50', 'FULL_5', 'FULL_15', 'FULL_35'];
  return validTypes.includes(value); // 100% safe: string.includes(string), ZERO 'as'
}

function isValidPaymentMethod(value: unknown): value is PaymentMethod {
  if (typeof value !== 'string') return false;
  // Array as readonly string[] for type-safe comparison (string-to-string)
  const validMethods: readonly string[] = ['STRIPE', 'PIX', 'BOLETO'];
  return validMethods.includes(value); // 100% safe: string.includes(string), ZERO 'as'
}

// Purchase request validation schema
const purchaseSchema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  packType: z.string().min(1, 'Invalid pack type'),
  paymentMethod: z.string().optional(),
  sourceDescription: z.string().optional()
}).refine(
  (data) => isValidPackType(data.packType),
  { message: 'Invalid pack type', path: ['packType'] }
).refine(
  (data) => !data.paymentMethod || isValidPaymentMethod(data.paymentMethod),
  { message: 'Invalid payment method', path: ['paymentMethod'] }
);

type PurchaseRequest = z.infer<typeof purchaseSchema> & { packType: PackType; paymentMethod?: PaymentMethod }

// Credit pack configurations with pricing
const CREDIT_PACKS = {
  // Report Credit Packs
  REPORT_5: {
    reportCredits: 5,
    fullCredits: 0,
    priceUSD: 4.99,
    priceBRL: 25.00,
    description: '5 Report Credits',
    neverExpires: false,
    validityDays: 90
  },
  REPORT_20: {
    reportCredits: 20,
    fullCredits: 0,
    priceUSD: 18.99,
    priceBRL: 95.00,
    description: '20 Report Credits',
    neverExpires: false,
    validityDays: 90
  },
  REPORT_50: {
    reportCredits: 50,
    fullCredits: 0,
    priceUSD: 44.99,
    priceBRL: 225.00,
    description: '50 Report Credits',
    neverExpires: false,
    validityDays: 90
  },

  // FULL Credit Packs
  FULL_5: {
    reportCredits: 0,
    fullCredits: 5,
    priceUSD: 9.99,
    priceBRL: 50.00,
    description: '5 FULL Credits',
    neverExpires: false,
    validityDays: 90
  },
  FULL_15: {
    reportCredits: 0,
    fullCredits: 15,
    priceUSD: 28.99,
    priceBRL: 145.00,
    description: '15 FULL Credits',
    neverExpires: false,
    validityDays: 90
  },
  FULL_35: {
    reportCredits: 0,
    fullCredits: 35,
    priceUSD: 64.99,
    priceBRL: 325.00,
    description: '35 FULL Credits',
    neverExpires: false,
    validityDays: 90
  }
}

export const POST = withErrorHandler(async (request: NextRequest) => {
  // Auth check
  const { user, error: authError } = await requireAuth(request)
  if (authError) return authError

  // Validate request body
  const { data, error: validationError } = await validateBody(request, purchaseSchema)
  if (validationError) return validationError

  // Type-safe narrowing: at this point, data has been validated
  const validatedData = data as PurchaseRequest
  const { workspaceId, packType, paymentMethod, sourceDescription } = validatedData

  console.log(`${ICONS.PROCESS} Processing credit purchase: ${packType} for workspace ${workspaceId}`)

  try {
    const creditSystem = getCreditManager()

    // Get pack configuration - type-safe access since packType is narrowed to PackType
    const packConfig = CREDIT_PACKS[packType]

    // Calculate expiration date
    const expiresAt = packConfig.neverExpires
      ? null
      : new Date(Date.now() + packConfig.validityDays * 24 * 60 * 60 * 1000)

    // Create the credit allocation using creditCredits method
    // This method creates allocations and transactions atomically
    await creditSystem.creditCredits(
      workspaceId,
      packConfig.reportCredits,
      packConfig.fullCredits,
      'PACK',
      sourceDescription || `${packConfig.description} - Pack Purchase`,
      expiresAt || undefined
    )

    console.log(`${ICONS.SUCCESS} Credit purchase completed: ${packConfig.description}`)

    // Return response with purchase details
    const purchaseId = `pack_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    return successResponse({
      purchaseId,
      packType,
      credits: {
        reportCredits: packConfig.reportCredits,
        fullCredits: packConfig.fullCredits
      },
      pricing: {
        priceUSD: packConfig.priceUSD,
        priceBRL: packConfig.priceBRL
      },
      validity: {
        expiresAt: expiresAt?.toISOString(),
        validityDays: packConfig.validityDays,
        neverExpires: packConfig.neverExpires
      },
      description: packConfig.description,
      purchaseDate: new Date().toISOString(),
      paymentMethod: paymentMethod || undefined
    })

  } catch (error) {
    console.error(`${ICONS.ERROR} Credit purchase failed:`, error)
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to process credit purchase',
      500
    )
  }
})

// GET endpoint to list available credit packs
export const GET = withErrorHandler(async (request: NextRequest) => {
  const { user, error: authError } = await requireAuth(request)
  if (authError) return authError

  return successResponse({
    availablePacks: Object.entries(CREDIT_PACKS).map(([key, config]) => ({
      packType: key,
      description: config.description,
      reportCredits: config.reportCredits,
      fullCredits: config.fullCredits,
      pricing: {
        priceUSD: config.priceUSD,
        priceBRL: config.priceBRL
      },
      validity: {
        validityDays: config.validityDays,
        neverExpires: config.neverExpires
      }
    }))
  })
})