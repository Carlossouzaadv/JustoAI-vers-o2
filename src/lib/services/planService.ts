/**
 * =====================================================
 * PLAN SERVICE - Backend service layer
 * =====================================================
 * Exposes plan configuration and utilities to backend APIs, middleware, and services
 * All plan-related business logic derives from src/config/plans.ts (SSOT)
 *
 * Usage:
 * - Verifying plan membership before allowing actions
 * - Calculating credit allocations
 * - Enforcing subscription limits
 * - Generating billing information
 */

import {
  PLANS,
  PLAN_IDS,
  CREDIT_PACKS,
  getPlanConfig,
  calculateReportCostInCredits,
  getPlanPriceInBRL,
  getAllPlans,
  getAllCreditPacks,
  getCreditPackById,
  formatCreditPackPrice,
  getCreditPackEffectivePrice,
  isValidPlanId,
  type PlanId,
  type PlanConfig,
  type CreditPackConfig,
} from '@/config/plans';

/**
 * =====================================================
 * PLAN SERVICE CLASS
 * =====================================================
 */
export class PlanService {
  /**
   * Get full plan configuration
   * @throws Error if plan doesn't exist
   */
  static getPlanConfig(planId: PlanId): PlanConfig {
    return getPlanConfig(planId);
  }

  /**
   * Validate plan ID
   */
  static isValidPlan(planId: unknown): planId is PlanId {
    return isValidPlanId(planId);
  }

  /**
   * Get all available plans
   */
  static getAllPlans(): PlanConfig[] {
    return getAllPlans();
  }

  /**
   * Get plan by ID with safe error handling
   * @returns Plan config or null if not found
   */
  static getPlanConfigSafe(planId: unknown): PlanConfig | null {
    if (!this.isValidPlan(planId)) {
      return null;
    }
    try {
      return this.getPlanConfig(planId);
    } catch {
      return null;
    }
  }

  /**
   * =====================================================
   * CREDIT ALLOCATION UTILITIES
   * =====================================================
   */

  /**
   * Get monthly credit allocation for a plan
   */
  static getMonthlyCredits(planId: PlanId): number {
    const plan = this.getPlanConfig(planId);
    return plan.monthlyCredits;
  }

  /**
   * Get onboarding credit configuration
   */
  static getOnboardingCredits(planId: PlanId) {
    const plan = this.getPlanConfig(planId);
    return plan.onboardingCredits;
  }

  /**
   * Calculate total credits for first month (onboarding + monthly)
   */
  static getFirstMonthTotalCredits(planId: PlanId): number {
    const plan = this.getPlanConfig(planId);
    return plan.onboardingCredits.amount + plan.monthlyCredits;
  }

  /**
   * =====================================================
   * CREDIT CONSUMPTION UTILITIES
   * =====================================================
   */

  /**
   * Calculate cost of a report in credits
   */
  static calculateReportCost(processCount: number): number {
    return calculateReportCostInCredits(processCount);
  }

  /**
   * Calculate cost of a full analysis in credits
   * (Always 1 credit, but we expose it as a function for consistency)
   */
  static calculateFullAnalysisCost(): number {
    return 1; // Per src/config/plans.ts CREDIT_RATES.FULL_ANALYSIS_COST
  }

  /**
   * =====================================================
   * PLAN FEATURE UTILITIES
   * =====================================================
   */

  /**
   * Check if plan supports a specific feature
   */
  static hasFeature(planId: PlanId, feature: keyof PlanConfig['features']): boolean {
    const plan = this.getPlanConfig(planId);
    const featureValue = plan.features[feature];

    // For boolean features
    if (typeof featureValue === 'boolean') {
      return featureValue;
    }

    // For string features (like reportTemplateType), just check if it exists
    return featureValue !== undefined;
  }

  /**
   * Check if plan supports strategic revalidation (all our plans do)
   */
  static supportsStrategicRevalidation(planId: PlanId): boolean {
    return this.hasFeature(planId, 'strategicRevalidation');
  }

  /**
   * Get support channels for a plan
   */
  static getSupportChannels(planId: PlanId): string[] {
    const plan = this.getPlanConfig(planId);
    return plan.features.supportChannels;
  }

  /**
   * =====================================================
   * PLAN LIMIT UTILITIES
   * =====================================================
   */

  /**
   * Get maximum users for a plan
   */
  static getMaxUsers(planId: PlanId): number {
    const plan = this.getPlanConfig(planId);
    return plan.maxUsers;
  }

  /**
   * Get maximum processes for a plan
   */
  static getMaxProcesses(planId: PlanId): number {
    const plan = this.getPlanConfig(planId);
    return plan.maxProcesses;
  }

  /**
   * Check if user count is within plan limits
   */
  static isWithinUserLimit(planId: PlanId, currentUsers: number): boolean {
    const maxUsers = this.getMaxUsers(planId);
    return currentUsers <= maxUsers;
  }

  /**
   * Check if process count is within plan limits
   */
  static isWithinProcessLimit(planId: PlanId, currentProcesses: number): boolean {
    const maxProcesses = this.getMaxProcesses(planId);
    return currentProcesses <= maxProcesses;
  }

  /**
   * Get remaining users quota
   */
  static getRemainingUserQuota(planId: PlanId, currentUsers: number): number {
    const maxUsers = this.getMaxUsers(planId);
    return Math.max(0, maxUsers - currentUsers);
  }

  /**
   * Get remaining processes quota
   */
  static getRemainingProcessQuota(planId: PlanId, currentProcesses: number): number {
    const maxProcesses = this.getMaxProcesses(planId);
    return Math.max(0, maxProcesses - currentProcesses);
  }

  /**
   * =====================================================
   * BILLING UTILITIES
   * =====================================================
   */

  /**
   * Get monthly price in BRL formatted string
   */
  static getMonthlyPriceFormatted(planId: PlanId): string {
    return getPlanPriceInBRL(planId);
  }

  /**
   * Get monthly price in centavos
   */
  static getMonthlyPriceCents(planId: PlanId): number {
    const plan = this.getPlanConfig(planId);
    return plan.monthlyPriceCents;
  }

  /**
   * Calculate annual price with 15% discount
   */
  static getAnnualPriceCents(planId: PlanId, discountPercent: number = 15): number {
    const monthlyPrice = this.getMonthlyPriceCents(planId);
    const discountMultiplier = 1 - discountPercent / 100;
    return Math.round(monthlyPrice * 12 * discountMultiplier);
  }

  /**
   * Get annual price formatted
   */
  static getAnnualPriceFormatted(planId: PlanId, discountPercent: number = 15): string {
    const annualPrice = this.getAnnualPriceCents(planId, discountPercent) / 100;
    return `R$ ${annualPrice.toFixed(2).replace('.', ',')}`;
  }

  /**
   * =====================================================
   * CREDIT PACK UTILITIES
   * =====================================================
   */

  /**
   * Get all available credit packs
   */
  static getAllCreditPacks(): CreditPackConfig[] {
    return getAllCreditPacks();
  }

  /**
   * Get credit pack by ID
   */
  static getCreditPackById(packId: string): CreditPackConfig | null {
    return getCreditPackById(packId);
  }

  /**
   * Get credit pack price formatted
   */
  static getCreditPackPriceFormatted(priceCents: number): string {
    return formatCreditPackPrice(priceCents);
  }

  /**
   * Get effective price including discount information
   */
  static getCreditPackEffectivePrice(pack: CreditPackConfig) {
    return getCreditPackEffectivePrice(pack);
  }

  /**
   * Check if pack ID is valid
   */
  static isValidCreditPackId(packId: unknown): boolean {
    return typeof packId === 'string' && getCreditPackById(packId) !== null;
  }
}

/**
 * =====================================================
 * EXPORT ALL PLAN DATA FOR EXTERNAL USE
 * =====================================================
 */
export { PLANS, PLAN_IDS, CREDIT_PACKS };
export type { PlanId, PlanConfig, CreditPackConfig };
