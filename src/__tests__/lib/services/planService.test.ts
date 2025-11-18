/**
 * Test Suite: PlanService
 *
 * Tests the backend service layer that exposes SSOT plan configuration
 * to API endpoints and other backend services.
 */

import { PlanService, type PlanId } from '@/lib/services/planService';

describe('PlanService', () => {
  describe('Plan Configuration Methods', () => {
    it('should get plan config for valid plan ID', () => {
      const gestao = PlanService.getPlanConfig('gestao');
      expect(gestao.name).toBe('Gestão');
      expect(gestao.monthlyCredits).toBe(10);

      const performance = PlanService.getPlanConfig('performance');
      expect(performance.name).toBe('Performance');
      expect(performance.monthlyCredits).toBe(30);
    });

    it('should throw on invalid plan ID', () => {
      expect(() => PlanService.getPlanConfig('invalid' as PlanId)).toThrow();
    });

    it('should get plan config safely', () => {
      const valid = PlanService.getPlanConfigSafe('gestao');
      expect(valid).not.toBeNull();
      expect(valid?.name).toBe('Gestão');

      const invalid = PlanService.getPlanConfigSafe('invalid');
      expect(invalid).toBeNull();
    });

    it('should validate plan ID', () => {
      expect(PlanService.isValidPlan('gestao')).toBe(true);
      expect(PlanService.isValidPlan('performance')).toBe(true);
      expect(PlanService.isValidPlan('invalid')).toBe(false);
    });

    it('should get all plans', () => {
      const plans = PlanService.getAllPlans();
      expect(plans).toHaveLength(2);
      expect(plans.map(p => p.id)).toContain('gestao');
      expect(plans.map(p => p.id)).toContain('performance');
    });
  });

  describe('Credit Allocation Methods', () => {
    it('should get monthly credits for each plan', () => {
      expect(PlanService.getMonthlyCredits('gestao')).toBe(10);
      expect(PlanService.getMonthlyCredits('performance')).toBe(30);
    });

    it('should get onboarding credits', () => {
      const gestaoOnboarding = PlanService.getOnboardingCredits('gestao');
      expect(gestaoOnboarding.amount).toBe(50);
      expect(gestaoOnboarding.expiryDays).toBe(30);

      const performanceOnboarding = PlanService.getOnboardingCredits('performance');
      expect(performanceOnboarding.amount).toBe(150);
      expect(performanceOnboarding.expiryDays).toBe(30);
    });

    it('should calculate first month total credits', () => {
      // First month = onboarding + monthly
      const gestaoTotal = PlanService.getFirstMonthTotalCredits('gestao');
      expect(gestaoTotal).toBe(50 + 10); // 60

      const performanceTotal = PlanService.getFirstMonthTotalCredits('performance');
      expect(performanceTotal).toBe(150 + 30); // 180
    });
  });

  describe('Credit Consumption Methods', () => {
    it('should calculate report cost correctly', () => {
      // 1 credit per ~50 processes
      expect(PlanService.calculateReportCost(1)).toBe(1);
      expect(PlanService.calculateReportCost(50)).toBe(1);
      expect(PlanService.calculateReportCost(51)).toBe(2);
      expect(PlanService.calculateReportCost(100)).toBe(2);
      expect(PlanService.calculateReportCost(150)).toBe(3);
    });

    it('should calculate full analysis cost as 1 credit', () => {
      expect(PlanService.calculateFullAnalysisCost()).toBe(1);
    });
  });

  describe('Plan Feature Methods', () => {
    it('should check if plan has feature', () => {
      const gestao = 'gestao';
      expect(PlanService.hasFeature(gestao, 'reportsUnlimited')).toBe(true);
      expect(PlanService.hasFeature(gestao, 'strategicRevalidation')).toBe(true);
      expect(PlanService.hasFeature(gestao, 'csvImport')).toBe(true);

      const performance = 'performance';
      expect(PlanService.hasFeature(performance, 'reportsUnlimited')).toBe(true);
      expect(PlanService.hasFeature(performance, 'csvImport')).toBe(true);
    });

    it('should check if plan supports strategic revalidation', () => {
      expect(PlanService.supportsStrategicRevalidation('gestao')).toBe(true);
      expect(PlanService.supportsStrategicRevalidation('performance')).toBe(true);
    });

    it('should get support channels for plan', () => {
      const gestaoChannels = PlanService.getSupportChannels('gestao');
      expect(gestaoChannels).toContain('Email');
      expect(gestaoChannels).toContain('IA');

      const performanceChannels = PlanService.getSupportChannels('performance');
      expect(performanceChannels).toContain('Email');
      expect(performanceChannels).toContain('IA');
      expect(performanceChannels).toContain('WhatsApp');
    });
  });

  describe('Plan Limit Methods', () => {
    it('should get max users for plan', () => {
      expect(PlanService.getMaxUsers('gestao')).toBe(3);
      expect(PlanService.getMaxUsers('performance')).toBe(10);
    });

    it('should get max processes for plan', () => {
      expect(PlanService.getMaxProcesses('gestao')).toBe(200);
      expect(PlanService.getMaxProcesses('performance')).toBe(500);
    });

    it('should check if within user limit', () => {
      expect(PlanService.isWithinUserLimit('gestao', 2)).toBe(true);
      expect(PlanService.isWithinUserLimit('gestao', 3)).toBe(true);
      expect(PlanService.isWithinUserLimit('gestao', 4)).toBe(false);

      expect(PlanService.isWithinUserLimit('performance', 10)).toBe(true);
      expect(PlanService.isWithinUserLimit('performance', 11)).toBe(false);
    });

    it('should check if within process limit', () => {
      expect(PlanService.isWithinProcessLimit('gestao', 200)).toBe(true);
      expect(PlanService.isWithinProcessLimit('gestao', 201)).toBe(false);

      expect(PlanService.isWithinProcessLimit('performance', 500)).toBe(true);
      expect(PlanService.isWithinProcessLimit('performance', 501)).toBe(false);
    });

    it('should get remaining user quota', () => {
      expect(PlanService.getRemainingUserQuota('gestao', 0)).toBe(3);
      expect(PlanService.getRemainingUserQuota('gestao', 2)).toBe(1);
      expect(PlanService.getRemainingUserQuota('gestao', 3)).toBe(0);
      expect(PlanService.getRemainingUserQuota('gestao', 5)).toBe(0); // Should not be negative

      expect(PlanService.getRemainingUserQuota('performance', 5)).toBe(5);
      expect(PlanService.getRemainingUserQuota('performance', 10)).toBe(0);
    });

    it('should get remaining process quota', () => {
      expect(PlanService.getRemainingProcessQuota('gestao', 0)).toBe(200);
      expect(PlanService.getRemainingProcessQuota('gestao', 100)).toBe(100);
      expect(PlanService.getRemainingProcessQuota('gestao', 200)).toBe(0);
      expect(PlanService.getRemainingProcessQuota('gestao', 300)).toBe(0); // Should not be negative

      expect(PlanService.getRemainingProcessQuota('performance', 250)).toBe(250);
      expect(PlanService.getRemainingProcessQuota('performance', 500)).toBe(0);
    });
  });

  describe('Billing Methods', () => {
    it('should get monthly price formatted', () => {
      const gestaoPrice = PlanService.getMonthlyPriceFormatted('gestao');
      expect(gestaoPrice).toBe('R$ 497,00');

      const performancePrice = PlanService.getMonthlyPriceFormatted('performance');
      expect(performancePrice).toBe('R$ 1.197,00');
    });

    it('should get monthly price in centavos', () => {
      expect(PlanService.getMonthlyPriceCents('gestao')).toBe(49700);
      expect(PlanService.getMonthlyPriceCents('performance')).toBe(119700);
    });

    it('should calculate annual price with discount', () => {
      // 15% discount = 85% of original
      // Monthly: 497 * 12 * 0.85 = 5060.40 = 506040 centavos
      const gestaoAnnual = PlanService.getAnnualPriceCents('gestao', 15);
      expect(gestaoAnnual).toBeCloseTo(497 * 100 * 12 * 0.85, -2);

      const performanceAnnual = PlanService.getAnnualPriceCents('performance', 15);
      expect(performanceAnnual).toBeCloseTo(1197 * 100 * 12 * 0.85, -2);
    });

    it('should get annual price formatted', () => {
      const gestaoAnnual = PlanService.getAnnualPriceFormatted('gestao', 15);
      expect(gestaoAnnual).toMatch(/R\$ \d+,\d{2}/); // Format: R$ XXX,XX

      const performanceAnnual = PlanService.getAnnualPriceFormatted('performance', 15);
      expect(performanceAnnual).toMatch(/R\$ \d+,\d{2}/);
    });
  });

  describe('Credit Pack Methods', () => {
    it('should get all credit packs', () => {
      const packs = PlanService.getAllCreditPacks();
      expect(packs).toHaveLength(3);
      expect(packs.map(p => p.id)).toContain('pack-credits-small');
      expect(packs.map(p => p.id)).toContain('pack-credits-medium');
      expect(packs.map(p => p.id)).toContain('pack-credits-large');
    });

    it('should get credit pack by ID', () => {
      const small = PlanService.getCreditPackById('pack-credits-small');
      expect(small).not.toBeNull();
      expect(small?.credits).toBe(10);

      const notFound = PlanService.getCreditPackById('invalid-id');
      expect(notFound).toBeNull();
    });

    it('should format credit pack price', () => {
      const price = PlanService.getCreditPackPriceFormatted(5000);
      expect(price).toBe('R$ 50,00');

      const largePrice = PlanService.getCreditPackPriceFormatted(119700);
      expect(largePrice).toBe('R$ 1.197,00');
    });

    it('should get effective price with discount info', () => {
      const medium = PlanService.getCreditPackById('pack-credits-medium');
      if (!medium) {
        throw new Error('Pack not found');
      }

      const priceInfo = PlanService.getCreditPackEffectivePrice(medium);
      expect(priceInfo.discountedPriceCents).toBe(medium.priceCents);
      expect(priceInfo.discountedFormatted).toBe('R$ 135,00');
      expect(priceInfo.savingsFormatted).toMatch(/R\$ \d+,\d{2}/);
    });

    it('should validate credit pack ID', () => {
      expect(PlanService.isValidCreditPackId('pack-credits-small')).toBe(true);
      expect(PlanService.isValidCreditPackId('pack-credits-medium')).toBe(true);
      expect(PlanService.isValidCreditPackId('pack-credits-large')).toBe(true);
      expect(PlanService.isValidCreditPackId('invalid-pack')).toBe(false);
    });
  });

  describe('Integration Tests', () => {
    it('should maintain consistency between plans and prices', () => {
      const plans = PlanService.getAllPlans();

      plans.forEach(plan => {
        const monthlyPrice = PlanService.getMonthlyPriceCents(plan.id as PlanId);
        expect(monthlyPrice).toBeGreaterThan(0);

        const monthlyCredits = PlanService.getMonthlyCredits(plan.id as PlanId);
        expect(monthlyCredits).toBeGreaterThan(0);

        // Credit cost should be reasonable
        const costPerCredit = monthlyPrice / monthlyCredits;
        expect(costPerCredit).toBeGreaterThan(0);
      });
    });

    it('should support complete workflow: get plan -> check features -> calculate costs', () => {
      // Workflow: Get plan -> Check features -> Calculate credit needs
      const gestao = PlanService.getPlanConfig('gestao');
      expect(gestao).toBeDefined();

      // Check features
      const hasReports = PlanService.hasFeature('gestao', 'reportsUnlimited');
      expect(hasReports).toBe(true);

      // Calculate monthly credits and costs
      const monthlyCredits = PlanService.getMonthlyCredits('gestao');
      expect(monthlyCredits).toBe(10);

      // Estimate report costs
      const report50Processes = PlanService.calculateReportCost(50);
      expect(report50Processes).toBe(1);

      // Check if enough credits for operation
      const canAfford = monthlyCredits >= report50Processes;
      expect(canAfford).toBe(true);
    });
  });
});
