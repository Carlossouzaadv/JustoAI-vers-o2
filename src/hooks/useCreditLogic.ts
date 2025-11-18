/**
 * =====================================================
 * useCreditLogic Hook
 * =====================================================
 * Exposes credit consumption rules and communication messages
 * derived from the SSOT (src/config/plans.ts)
 *
 * Used in frontend components to:
 * - Show cost previews before actions
 * - Display credit usage in dashboards
 * - Format messages for end users
 */

'use client';

import { useMemo } from 'react';
import {
  CREDIT_RATES,
  CREDIT_COMMUNICATION,
  calculateReportCostInCredits,
  getPlanConfig,
  type PlanId,
} from '@/config/plans';

/**
 * =====================================================
 * TYPE DEFINITIONS
 * =====================================================
 */

export interface CreditCost {
  fullAnalysis: number;
  reportForProcessCount: (processCount: number) => number;
}

export interface CreditMessages {
  fullAnalysisDescription: string;
  reportsDescription: string;
  estimatedReportsPerMonth: (planId: PlanId) => number;
  reportCostExplanation: string;
}

export interface CreditLogic {
  costs: CreditCost;
  messages: CreditMessages;
  /**
   * Calculate cost and format a user-friendly message
   */
  formatReportCostMessage: (processCount: number) => string;
  /**
   * Calculate cost and format a user-friendly message for full analysis
   */
  formatFullAnalysisCostMessage: () => string;
  /**
   * Get average monthly consumption based on plan
   */
  getMonthlyAverageMessage: (planId: PlanId) => string;
}

/**
 * =====================================================
 * HOOK IMPLEMENTATION
 * =====================================================
 */

export function useCreditLogic(): CreditLogic {
  return useMemo(() => {
    const costs: CreditCost = {
      fullAnalysis: CREDIT_RATES.FULL_ANALYSIS_COST,
      reportForProcessCount: (processCount: number) => calculateReportCostInCredits(processCount),
    };

    const messages: CreditMessages = {
      fullAnalysisDescription: CREDIT_COMMUNICATION.FULL_ANALYSIS_DESCRIPTION,
      reportsDescription: CREDIT_COMMUNICATION.REPORTS_DESCRIPTION,
      estimatedReportsPerMonth: (planId: PlanId) => {
        return CREDIT_COMMUNICATION.ESTIMATED_REPORTS_PER_MONTH[planId];
      },
      reportCostExplanation:
        `Cada relatório custa ${CREDIT_RATES.REPORT_COST_PER_50_PROCESSES} créditos por até 50 processos. ` +
        `Por exemplo: um relatório com 50 processos = 1 crédito, 100 processos = 2 créditos.`,
    };

    return {
      costs,
      messages,

      /**
       * Format report cost as user-friendly message
       * Example: "Este relatório vai custar 4 créditos"
       */
      formatReportCostMessage: (processCount: number) => {
        const cost = calculateReportCostInCredits(processCount);
        if (cost === 0) {
          return 'Este relatório não custa créditos';
        }
        const creditWord = cost === 1 ? 'crédito' : 'créditos';
        return `Este relatório vai custar ${cost} ${creditWord}`;
      },

      /**
       * Format full analysis cost message
       */
      formatFullAnalysisCostMessage: () => {
        return `Esta análise completa vai custar ${CREDIT_RATES.FULL_ANALYSIS_COST} crédito`;
      },

      /**
       * Get estimated monthly usage message
       * Example: "Até ~4 relatórios/mês em média (baseado em 50 processos por relatório)"
       */
      getMonthlyAverageMessage: (planId: PlanId) => {
        const estimatedReports = CREDIT_COMMUNICATION.ESTIMATED_REPORTS_PER_MONTH[planId];
        const plan = getPlanConfig(planId);
        const monthlyCredits = plan.monthlyCredits;

        return (
          `Até ~${estimatedReports} relatórios/mês em média ` +
          `(${monthlyCredits} créditos/mês, baseado em ~50 processos por relatório)`
        );
      },
    };
  }, []);
}

/**
 * =====================================================
 * UTILITY EXPORTS (for non-hook usage)
 * =====================================================
 */

/**
 * Calculate report cost without hook
 * Use this in server components or outside React
 */
export const getReportCostInCredits = calculateReportCostInCredits;

/**
 * Get full analysis cost
 */
export const getFullAnalysisCost = () => CREDIT_RATES.FULL_ANALYSIS_COST;

/**
 * Format report cost message without hook
 */
export function formatReportCostMessage(processCount: number): string {
  const cost = calculateReportCostInCredits(processCount);
  if (cost === 0) {
    return 'Este relatório não custa créditos';
  }
  const creditWord = cost === 1 ? 'crédito' : 'créditos';
  return `Este relatório vai custar ${cost} ${creditWord}`;
}

/**
 * Get estimated monthly reports for a plan
 */
export function getEstimatedMonthlyReports(planId: PlanId): number {
  return CREDIT_COMMUNICATION.ESTIMATED_REPORTS_PER_MONTH[planId];
}

/**
 * Get credit system explanation
 */
export function getCreditSystemExplanation(): string {
  return (
    `Sistema de créditos unificado: um único tipo de crédito para análises completas e relatórios. ` +
    `Análise Completa = 1 crédito. Relatórios = 1 crédito por ~50 processos. ` +
    `Créditos iniciais (onboarding) expiram em 30 dias se não usados. ` +
    `Créditos mensais renovam todo mês.`
  );
}
