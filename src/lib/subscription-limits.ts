/**
 * ⚠️  DEPRECATED: This file is superseded by src/config/plans.ts (SSOT)
 *
 * The single source of truth for plan configurations is now:
 * - src/config/plans.ts - Plan definitions (GESTAO, PERFORMANCE)
 * - src/lib/services/planService.ts - Service layer to access plans
 *
 * Plan names have changed:
 * - 'starter' → 'gestao'
 * - 'professional' → 'performance'
 * - 'enterprise' → 'enterprise' (kept for backwards compatibility)
 *
 * This file is kept for backwards compatibility. New code should use:
 * import { PlanService } from '@/lib/services/planService'
 */

export type SubscriptionPlan = 'starter' | 'professional' | 'enterprise';

export interface PlanLimits {
  name: string;
  maxUsers: number;
  maxProcesses: number;
  completeAnalysisFirst: number; // First month
  completeAnalysisMonthly: number; // Monthly after first month
  features: string[];
  supportChannels: string[];
}

export const PLAN_LIMITS: Record<SubscriptionPlan, PlanLimits> = {
  starter: {
    name: 'Plano Starter',
    maxUsers: 2,
    maxProcesses: 100,
    completeAnalysisFirst: 25,
    completeAnalysisMonthly: 5,
    features: [
      'Análise Essencial (IA Flash 8B)',
      'Análise Estratégica (IA Flash)',
      'Dashboard básico',
      'Importação de dados (CSV/Excel)',
      'Alertas de prazos',
    ],
    supportChannels: ['Email', 'Assistente IA']
  },
  professional: {
    name: 'Plano Professional',
    maxUsers: 5,
    maxProcesses: 300,
    completeAnalysisFirst: 75,
    completeAnalysisMonthly: 15,
    features: [
      'Análise Essencial (IA Flash 8B)',
      'Análise Estratégica (IA Flash)',
      'Análise Completa (IA Pro)',
      'Dashboard completo com timeline',
      'Importação de dados (CSV/Excel)',
      'Integração APIs (Judit/Codilo)',
      'Relatórios personalizados',
      'Alertas inteligentes 24/7',
    ],
    supportChannels: ['Email', 'Assistente IA', 'WhatsApp']
  },
  enterprise: {
    name: 'Plano Enterprise',
    maxUsers: -1, // Unlimited
    maxProcesses: -1, // Unlimited
    completeAnalysisFirst: -1, // Unlimited
    completeAnalysisMonthly: -1, // Unlimited
    features: [
      'Todas as análises de IA',
      'Dashboard white-label',
      'Relatórios personalizados',
      'Integrações customizadas',
      'API própria',
      'Treinamento da equipe',
      'SLA garantido',
    ],
    supportChannels: ['Email', 'Assistente IA', 'WhatsApp', 'Suporte Dedicado']
  }
};

export interface UsageStats {
  currentUsers: number;
  currentProcesses: number;
  completeAnalysisUsed: number;
  completeAnalysisRemaining: number;
  isFirstMonth: boolean;
  resetDate: string; // When monthly credits reset
}

export function getPlanLimits(plan: SubscriptionPlan): PlanLimits {
  return PLAN_LIMITS[plan];
}

export function checkUserLimit(plan: SubscriptionPlan, currentUsers: number): boolean {
  const limits = getPlanLimits(plan);
  return limits.maxUsers === -1 || currentUsers < limits.maxUsers;
}

export function checkProcessLimit(plan: SubscriptionPlan, currentProcesses: number): boolean {
  const limits = getPlanLimits(plan);
  return limits.maxProcesses === -1 || currentProcesses < limits.maxProcesses;
}

export function checkAnalysisLimit(plan: SubscriptionPlan, usage: UsageStats): boolean {
  const limits = getPlanLimits(plan);

  if (limits.completeAnalysisFirst === -1) return true; // Unlimited

  const maxAllowed = usage.isFirstMonth
    ? limits.completeAnalysisFirst
    : limits.completeAnalysisMonthly;

  return usage.completeAnalysisUsed < maxAllowed;
}

export function getAnalysisRemaining(plan: SubscriptionPlan, usage: UsageStats): number {
  const limits = getPlanLimits(plan);

  if (limits.completeAnalysisFirst === -1) return -1; // Unlimited

  const maxAllowed = usage.isFirstMonth
    ? limits.completeAnalysisFirst
    : limits.completeAnalysisMonthly;

  return Math.max(0, maxAllowed - usage.completeAnalysisUsed);
}

export function shouldShowLimitWarning(plan: SubscriptionPlan, usage: UsageStats): boolean {
  const remaining = getAnalysisRemaining(plan, usage);
  if (remaining === -1) return false; // Unlimited

  const limits = getPlanLimits(plan);
  const maxAllowed = usage.isFirstMonth
    ? limits.completeAnalysisFirst
    : limits.completeAnalysisMonthly;

  // Show warning when 80% used or 3 or less remaining
  const threshold = Math.min(3, Math.ceil(maxAllowed * 0.2));
  return remaining <= threshold;
}

export function formatLimitMessage(plan: SubscriptionPlan, usage: UsageStats): string {
  const remaining = getAnalysisRemaining(plan, usage);

  if (remaining === -1) {
    return 'Análises ilimitadas';
  }

  if (remaining === 0) {
    return `Limite mensal atingido. Renova em ${new Date(usage.resetDate).toLocaleDateString('pt-BR')}`;
  }

  return `${remaining} análise${remaining !== 1 ? 's' : ''} restante${remaining !== 1 ? 's' : ''} este mês`;
}

export function canPerformAction(
  plan: SubscriptionPlan,
  action: 'add_user' | 'add_process' | 'complete_analysis',
  usage: UsageStats
): { allowed: boolean; reason?: string } {
  switch (action) {
    case 'add_user':
      const userAllowed = checkUserLimit(plan, usage.currentUsers);
      return {
        allowed: userAllowed,
        reason: userAllowed ? undefined : `Limite de ${getPlanLimits(plan).maxUsers} usuários atingido`
      };

    case 'add_process':
      const processAllowed = checkProcessLimit(plan, usage.currentProcesses);
      return {
        allowed: processAllowed,
        reason: processAllowed ? undefined : `Limite de ${getPlanLimits(plan).maxProcesses} processos atingido`
      };

    case 'complete_analysis':
      const analysisAllowed = checkAnalysisLimit(plan, usage);
      return {
        allowed: analysisAllowed,
        reason: analysisAllowed ? undefined : formatLimitMessage(plan, usage)
      };

    default:
      return { allowed: false, reason: 'Ação não reconhecida' };
  }
}