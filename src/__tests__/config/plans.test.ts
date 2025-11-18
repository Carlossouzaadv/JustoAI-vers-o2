/**
 * Test Suite: SSOT Plans Configuration
 *
 * Validates that src/config/plans.ts (Single Source of Truth) is properly
 * configured with all plan definitions, credit rates, and credit packs.
 */

import {
  PLANS,
  PLAN_IDS,
  CREDIT_RATES,
  CREDIT_PACKS,
  calculateReportCostInCredits,
  getPlanConfig,
  getAllPlans,
  formatCreditPackPrice,
  isValidPlanId,
  getAllCreditPacks,
  getCreditPackById,
  type PlanId,
} from '@/config/plans';

describe('SSOT Plans Configuration', () => {
  describe('Plan IDs', () => {
    it('should define plan IDs for gestao and performance', () => {
      expect(PLAN_IDS.GESTAO).toBe('gestao');
      expect(PLAN_IDS.PERFORMANCE).toBe('performance');
    });
  });

  describe('Plans Configuration', () => {
    it('should have GESTAO plan configured correctly', () => {
      const gestao = PLANS.gestao;
      expect(gestao).toBeDefined();
      expect(gestao.name).toBe('Gestão');
      expect(gestao.monthlyPriceCents).toBe(49700); // R$ 497,00
      expect(gestao.maxUsers).toBe(3);
      expect(gestao.maxProcesses).toBe(200);
      expect(gestao.monthlyCredits).toBe(10);
      expect(gestao.onboardingCredits.amount).toBe(50);
      expect(gestao.onboardingCredits.expiryDays).toBe(30);
    });

    it('should have PERFORMANCE plan configured correctly', () => {
      const performance = PLANS.performance;
      expect(performance).toBeDefined();
      expect(performance.name).toBe('Performance');
      expect(performance.monthlyPriceCents).toBe(119700); // R$ 1.197,00
      expect(performance.maxUsers).toBe(10);
      expect(performance.maxProcesses).toBe(500);
      expect(performance.monthlyCredits).toBe(30);
      expect(performance.onboardingCredits.amount).toBe(150);
      expect(performance.onboardingCredits.expiryDays).toBe(30);
    });

    it('should have correct features for each plan', () => {
      const gestao = PLANS.gestao;
      expect(gestao.features.reportsUnlimited).toBe(true);
      expect(gestao.features.strategicRevalidation).toBe(true);
      expect(gestao.features.csvImport).toBe(true);
      expect(gestao.features.reportTemplateType).toBe('standard');
      expect(gestao.features.supportChannels).toContain('Email');
      expect(gestao.features.supportChannels).toContain('IA');

      const performance = PLANS.performance;
      expect(performance.features.reportTemplateType).toBe('branded');
      expect(performance.features.supportChannels).toContain('WhatsApp');
    });
  });

  describe('Credit Rates (Unified System)', () => {
    it('should define full analysis cost as 1 credit', () => {
      expect(CREDIT_RATES.FULL_ANALYSIS_COST).toBe(1);
    });

    it('should define report cost per 50 processes', () => {
      expect(CREDIT_RATES.REPORT_COST_PER_50_PROCESSES).toBe(50);
    });
  });

  describe('Report Cost Calculation', () => {
    it('should calculate 1-50 processes as 1 credit', () => {
      expect(calculateReportCostInCredits(1)).toBe(1);
      expect(calculateReportCostInCredits(25)).toBe(1);
      expect(calculateReportCostInCredits(50)).toBe(1);
    });

    it('should calculate 51-100 processes as 2 credits', () => {
      expect(calculateReportCostInCredits(51)).toBe(2);
      expect(calculateReportCostInCredits(75)).toBe(2);
      expect(calculateReportCostInCredits(100)).toBe(2);
    });

    it('should calculate 101-150 processes as 3 credits', () => {
      expect(calculateReportCostInCredits(101)).toBe(3);
      expect(calculateReportCostInCredits(125)).toBe(3);
      expect(calculateReportCostInCredits(150)).toBe(3);
    });

    it('should return 0 for 0 or negative processes', () => {
      expect(calculateReportCostInCredits(0)).toBe(0);
      expect(calculateReportCostInCredits(-5)).toBe(0);
    });
  });

  describe('Credit Packs', () => {
    it('should define 3 credit packs', () => {
      expect(Object.keys(CREDIT_PACKS)).toHaveLength(3);
      expect(CREDIT_PACKS.SMALL).toBeDefined();
      expect(CREDIT_PACKS.MEDIUM).toBeDefined();
      expect(CREDIT_PACKS.LARGE).toBeDefined();
    });

    it('should have correct configuration for SMALL pack', () => {
      const pack = CREDIT_PACKS.SMALL;
      expect(pack.credits).toBe(10);
      expect(pack.priceCents).toBe(5000); // R$ 50,00
      expect(pack.discount).toBe(0);
      expect(pack.validityDays).toBe(90);
    });

    it('should have correct configuration for MEDIUM pack', () => {
      const pack = CREDIT_PACKS.MEDIUM;
      expect(pack.credits).toBe(30);
      expect(pack.priceCents).toBe(13500); // R$ 135,00
      expect(pack.discount).toBe(0.1); // 10% discount
      expect(pack.validityDays).toBe(90);
    });

    it('should have correct configuration for LARGE pack', () => {
      const pack = CREDIT_PACKS.LARGE;
      expect(pack.credits).toBe(75);
      expect(pack.priceCents).toBe(30000); // R$ 300,00
      expect(pack.discount).toBe(0.2); // 20% discount
      expect(pack.validityDays).toBe(90);
    });

    it('should have unique pack IDs', () => {
      const ids = Object.values(CREDIT_PACKS).map(p => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe('Utility Functions', () => {
    it('getPlanConfig should return plan by ID', () => {
      const gestao = getPlanConfig('gestao');
      expect(gestao.name).toBe('Gestão');

      const performance = getPlanConfig('performance');
      expect(performance.name).toBe('Performance');
    });

    it('getPlanConfig should throw on invalid ID', () => {
      expect(() => getPlanConfig('invalid' as PlanId)).toThrow();
    });

    it('getAllPlans should return both plans', () => {
      const plans = getAllPlans();
      expect(plans).toHaveLength(2);
      expect(plans.map(p => p.id)).toContain('gestao');
      expect(plans.map(p => p.id)).toContain('performance');
    });

    it('isValidPlanId should validate plan IDs', () => {
      expect(isValidPlanId('gestao')).toBe(true);
      expect(isValidPlanId('performance')).toBe(true);
      expect(isValidPlanId('invalid')).toBe(false);
      expect(isValidPlanId(123)).toBe(false);
      expect(isValidPlanId(null)).toBe(false);
    });

    it('formatCreditPackPrice should format prices correctly', () => {
      expect(formatCreditPackPrice(5000)).toBe('R$ 50,00');
      expect(formatCreditPackPrice(13500)).toBe('R$ 135,00');
      expect(formatCreditPackPrice(119700)).toBe('R$ 1.197,00');
    });

    it('getAllCreditPacks should return all packs', () => {
      const packs = getAllCreditPacks();
      expect(packs).toHaveLength(3);
      expect(packs.map(p => p.id)).toContain('pack-credits-small');
      expect(packs.map(p => p.id)).toContain('pack-credits-medium');
      expect(packs.map(p => p.id)).toContain('pack-credits-large');
    });

    it('getCreditPackById should find pack by ID', () => {
      const small = getCreditPackById('pack-credits-small');
      expect(small).toBeDefined();
      expect(small?.credits).toBe(10);

      const notFound = getCreditPackById('invalid-pack-id');
      expect(notFound).toBeNull();
    });
  });

  describe('Type Safety', () => {
    it('should have strongly typed plan IDs', () => {
      // This test passes if TypeScript compilation succeeds
      // It validates that PlanId type is properly constrained
      const gestaoId: PlanId = 'gestao';
      const performanceId: PlanId = 'performance';

      expect(gestaoId).toBe('gestao');
      expect(performanceId).toBe('performance');
    });
  });

  describe('Integration Tests', () => {
    it('should maintain consistency between plans and configurations', () => {
      const allPlans = getAllPlans();

      // Each plan should have unique ID and name
      const ids = allPlans.map(p => p.id);
      const names = allPlans.map(p => p.name);

      expect(new Set(ids).size).toBe(ids.length);
      expect(new Set(names).size).toBe(names.length);

      // Each plan should be accessible by ID
      allPlans.forEach(plan => {
        const retrieved = getPlanConfig(plan.id);
        expect(retrieved.id).toBe(plan.id);
      });
    });

    it('should have valid credit pack configurations', () => {
      const packs = getAllCreditPacks();

      packs.forEach(pack => {
        // Credits should be positive
        expect(pack.credits).toBeGreaterThan(0);

        // Price should be positive
        expect(pack.priceCents).toBeGreaterThan(0);

        // Discount should be 0-1
        expect(pack.discount).toBeGreaterThanOrEqual(0);
        expect(pack.discount).toBeLessThanOrEqual(1);

        // Validity should be positive
        expect(pack.validityDays).toBeGreaterThan(0);

        // Should be retrievable by ID
        const retrieved = getCreditPackById(pack.id);
        expect(retrieved).not.toBeNull();
        expect(retrieved?.id).toBe(pack.id);
      });
    });
  });
});
