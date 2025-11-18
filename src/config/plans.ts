/**
 * =====================================================
 * SINGLE SOURCE OF TRUTH (SSOT) FOR PLANS & CREDITS
 * =====================================================
 * This is the authoritative configuration for:
 * - Plan definitions (names, prices, features, limits)
 * - Credit allocation rules (monthly, onboarding)
 * - Credit consumption rates (Full analysis, Reports)
 *
 * Changes here propagate to:
 * - Backend: API endpoints, credit verification
 * - Frontend: Pricing page, dashboard, UX messages
 * - Database: Plan configurations stored in DB reference this
 *
 * DO NOT hardcode plan values elsewhere. Always import from here.
 */

/**
 * Plan IDs - Used throughout the system
 */
export const PLAN_IDS = {
  GESTAO: 'gestao',
  PERFORMANCE: 'performance',
} as const;

export type PlanId = (typeof PLAN_IDS)[keyof typeof PLAN_IDS];

/**
 * Onboarding Credit Configuration
 */
export interface OnboardingCredits {
  /** Amount of credits granted at onboarding */
  amount: number;
  /** Days until credits expire (FIFO cleanup) */
  expiryDays: number;
}

/**
 * Feature Set for a Plan
 */
export interface PlanFeatures {
  /** Unlimited reports statement */
  reportsUnlimited: boolean;
  /** Strategic AI revalidation available */
  strategicRevalidation: boolean;
  /** CSV/Excel import available */
  csvImport: boolean;
  /** Report template customization */
  reportTemplateType: 'standard' | 'branded'; // 'standard' = Padrão JustoAI, 'branded' = Logo e Cores do Cliente
  /** Support channels available */
  supportChannels: string[];
}

/**
 * Complete Plan Configuration
 */
export interface PlanConfig {
  /** Plan identifier */
  id: PlanId;
  /** Display name in Portuguese */
  name: string;
  /** Monthly price in BRL centavos (to avoid floating point) */
  monthlyPriceCents: number;
  /** User limits */
  maxUsers: number;
  /** Monitored process limits */
  maxProcesses: number;
  /** Onboarding bonus credits */
  onboardingCredits: OnboardingCredits;
  /** Monthly recurring credits */
  monthlyCredits: number;
  /** Features available in this plan */
  features: PlanFeatures;
}

/**
 * =====================================================
 * CORE PLANS CONFIGURATION
 * =====================================================
 */
export const PLANS: Record<PlanId, PlanConfig> = {
  [PLAN_IDS.GESTAO]: {
    id: PLAN_IDS.GESTAO,
    name: 'Gestão',
    monthlyPriceCents: 49700, // R$ 497,00
    maxUsers: 3,
    maxProcesses: 200,
    onboardingCredits: {
      amount: 50,
      expiryDays: 30,
    },
    monthlyCredits: 10,
    features: {
      reportsUnlimited: true,
      strategicRevalidation: true,
      csvImport: true,
      reportTemplateType: 'standard',
      supportChannels: ['Email', 'IA'],
    },
  },
  [PLAN_IDS.PERFORMANCE]: {
    id: PLAN_IDS.PERFORMANCE,
    name: 'Performance',
    monthlyPriceCents: 119700, // R$ 1.197,00
    maxUsers: 10,
    maxProcesses: 500,
    onboardingCredits: {
      amount: 150,
      expiryDays: 30,
    },
    monthlyCredits: 30,
    features: {
      reportsUnlimited: true,
      strategicRevalidation: true,
      csvImport: true,
      reportTemplateType: 'branded',
      supportChannels: ['Email', 'IA', 'WhatsApp'],
    },
  },
};

/**
 * =====================================================
 * CREDIT CONSUMPTION RULES (UNIFIED CREDIT SYSTEM)
 * =====================================================
 * A unified credit system where the same credits can be used for:
 * - Full analysis (detailed IA processing)
 * - Reports (agendados and avulsos)
 */
export const CREDIT_RATES = {
  /**
   * Full Analysis Cost
   * Each complete/full analysis costs 1 credit
   * (Revalidação Estratégica da IA)
   */
  FULL_ANALYSIS_COST: 1,

  /**
   * Report Cost (Unified System)
   * Based on number of monitored processes in the report
   * Formula: Math.ceil(processCount / 50)
   * Examples:
   * - 1-50 processes = 1 credit
   * - 51-100 processes = 2 credits
   * - 101-150 processes = 3 credits
   */
  REPORT_COST_PER_50_PROCESSES: 50,
} as const;

/**
 * =====================================================
 * CREDIT PACK DEFINITIONS (Extra Credit Purchases)
 * =====================================================
 * Users can purchase additional credits when monthly allocation runs out
 */
export interface CreditPackConfig {
  id: string;
  name: string;
  description: string;
  credits: number;
  priceCents: number; // Price in centavos (BRL) to avoid floating point
  discount: number; // Discount percentage (0-1)
  validityDays: number; // How long credits last before expiry
}

export const CREDIT_PACKS: Record<string, CreditPackConfig> = {
  SMALL: {
    id: 'pack-credits-small',
    name: 'Pacote Pequeno',
    description: 'Para necessidades pontuais',
    credits: 10,
    priceCents: 5000, // R$ 50,00
    discount: 0,
    validityDays: 90,
  },
  MEDIUM: {
    id: 'pack-credits-medium',
    name: 'Pacote Médio',
    description: 'Melhor custo-benefício',
    credits: 30,
    priceCents: 13500, // R$ 135,00 (10% discount from R$ 150)
    discount: 0.1,
    validityDays: 90,
  },
  LARGE: {
    id: 'pack-credits-large',
    name: 'Pacote Grande',
    description: 'Máxima economia',
    credits: 75,
    priceCents: 30000, // R$ 300,00 (20% discount from R$ 375)
    discount: 0.2,
    validityDays: 90,
  },
} as const;

/**
 * Get all available credit packs
 */
export function getAllCreditPacks(): CreditPackConfig[] {
  return Object.values(CREDIT_PACKS);
}

/**
 * Get credit pack by ID
 */
export function getCreditPackById(packId: string): CreditPackConfig | null {
  return Object.values(CREDIT_PACKS).find(pack => pack.id === packId) || null;
}

/**
 * Calculate report cost in credits
 * @param processCount Number of monitored processes in the report
 * @returns Cost in credits
 */
export function calculateReportCostInCredits(processCount: number): number {
  if (processCount <= 0) return 0;
  return Math.ceil(processCount / CREDIT_RATES.REPORT_COST_PER_50_PROCESSES);
}

/**
 * =====================================================
 * CREDIT COMMUNICATION RULES (For UX/Frontend)
 * =====================================================
 * How to communicate credit consumption to end users
 */
export const CREDIT_COMMUNICATION = {
  /**
   * Average reports per month for each plan
   * Calculated based on monthlyCredits / average cost per report
   * Assumptions:
   * - GESTAO: 10 credits/month, ~50 processes per report = ~2 reports/month
   * - PERFORMANCE: 30 credits/month, ~50 processes per report = ~6 reports/month
   * But we round up to be conservative: 4 and 10 respectively
   */
  ESTIMATED_REPORTS_PER_MONTH: {
    [PLAN_IDS.GESTAO]: 4, // Conservative estimate
    [PLAN_IDS.PERFORMANCE]: 10, // Conservative estimate
  },

  /**
   * How to describe the limit to users
   */
  REPORTS_DESCRIPTION: 'Relatórios (agendados e avulsos)',
  FULL_ANALYSIS_DESCRIPTION: 'Análises Completas (Revalidação Estratégica da IA)',
} as const;

/**
 * =====================================================
 * UTILITY FUNCTIONS
 * =====================================================
 */

/**
 * Get plan configuration by ID
 * @throws Error if plan ID is invalid
 */
export function getPlanConfig(planId: PlanId): PlanConfig {
  const plan = PLANS[planId];
  if (!plan) {
    throw new Error(`Invalid plan ID: ${planId}`);
  }
  return plan;
}

/**
 * Get monthly price in BRL (formatted)
 * Formats: 49700 → "R$ 497,00", 119700 → "R$ 1.197,00"
 */
export function getPlanPriceInBRL(planId: PlanId): string {
  const plan = getPlanConfig(planId);
  const realValue = plan.monthlyPriceCents / 100;
  const formatted = realValue.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `R$ ${formatted}`;
}

/**
 * Check if a plan is valid
 */
export function isValidPlanId(planId: unknown): planId is PlanId {
  return typeof planId === 'string' && Object.values(PLAN_IDS).includes(planId as PlanId);
}

/**
 * Get all available plans (for UI dropdowns, iterations)
 */
export function getAllPlans(): PlanConfig[] {
  return Object.values(PLANS);
}

/**
 * Format credit pack price in BRL
 * Formats: 5000 → "R$ 50,00", 119700 → "R$ 1.197,00"
 */
export function formatCreditPackPrice(priceCents: number): string {
  const realValue = priceCents / 100;
  // Use toLocaleString to add thousands separator, then replace . with custom formatting
  const formatted = realValue.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `R$ ${formatted}`;
}

/**
 * Get effective price of a credit pack after discount
 */
export function getCreditPackEffectivePrice(pack: CreditPackConfig): {
  originalPriceCents: number;
  discountedPriceCents: number;
  originalFormatted: string;
  discountedFormatted: string;
  savingsFormatted: string;
} {
  const originalPrice = pack.priceCents / (1 - pack.discount);
  const savingsAmount = originalPrice - pack.priceCents;

  return {
    originalPriceCents: Math.round(originalPrice),
    discountedPriceCents: pack.priceCents,
    originalFormatted: formatCreditPackPrice(Math.round(originalPrice)),
    discountedFormatted: formatCreditPackPrice(pack.priceCents),
    savingsFormatted: formatCreditPackPrice(Math.round(savingsAmount)),
  };
}
