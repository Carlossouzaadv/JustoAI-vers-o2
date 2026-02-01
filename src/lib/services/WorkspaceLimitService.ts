import { prisma } from '@/lib/prisma';
import { PLANS, PlanId } from '@/config/plans';

// ============================================
// WORKSPACE LIMIT SERVICE
// Sistema de Soft Limits para processos
// ============================================

export type LimitType = 'PROCESS' | 'USER' | 'CREDITS';
export type AlertLevel = 'INFO' | 'WARNING_80' | 'WARNING_90' | 'CRITICAL' | 'BLOCKED';

export interface LimitCheck {
  allowed: boolean;
  currentValue: number;
  limitValue: number;
  percentage: number;
  alertLevel: AlertLevel;
  canContinue: boolean;
  gracePeriodActive: boolean;
  gracePeriodEndsAt?: Date;
  message?: string;
}

export class WorkspaceLimitService {
  
  /**
   * Verifica limite de processos
   */
  async checkProcessLimit(workspaceId: string): Promise<LimitCheck> {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        plan: true,
        processCount: true,
        processLimit: true,
        isInGracePeriod: true,
        gracePeriodEndsAt: true
      }
    });
    
    if (!workspace) {
      throw new Error('Workspace não encontrado');
    }
    
    // Buscar limite do plano
    const planId = workspace.plan?.toLowerCase() as PlanId | undefined;
    const planConfig = planId && PLANS[planId] ? PLANS[planId] : null;
    const limit = workspace.processLimit || planConfig?.maxProcesses || 999999;
    const current = workspace.processCount;
    const percentage = limit > 0 ? (current / limit) * 100 : 0;
    
    // Determinar alert level
    let alertLevel: AlertLevel;
    let allowed: boolean;
    let canContinue: boolean;
    let message: string | undefined;
    
    if (percentage < 80) {
      alertLevel = 'INFO';
      allowed = true;
      canContinue = true;
    } else if (percentage < 90) {
      alertLevel = 'WARNING_80';
      allowed = true;
      canContinue = true;
      message = `Você está usando ${current} de ${limit} processos (${Math.round(percentage)}%). Considere fazer upgrade.`;
    } else if (percentage < 100) {
      alertLevel = 'WARNING_90';
      allowed = true;
      canContinue = true;
      message = `Atenção: ${current} de ${limit} processos usados (${Math.round(percentage)}%). Próximo do limite!`;
    } else {
      // Atingiu 100%
      if (workspace.isInGracePeriod && workspace.gracePeriodEndsAt) {
        const now = new Date();
        const graceExpired = now > workspace.gracePeriodEndsAt;
        
        if (graceExpired) {
          alertLevel = 'BLOCKED';
          allowed = false;
          canContinue = false;
          message = 'Limite de processos atingido. Faça upgrade ou remova processos inativos.';
        } else {
          alertLevel = 'CRITICAL';
          allowed = false;
          canContinue = true; // Ainda em grace period
          const daysLeft = Math.ceil((workspace.gracePeriodEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          message = `Período de teste: ${current} processos (limite ${limit}). ${daysLeft} dias restantes.`;
        }
      } else {
        // Limite atingido, SEM grace period ativo
        alertLevel = 'BLOCKED';
        allowed = false;
        canContinue = false;
        message = 'Limite de processos atingido. Faça upgrade ou remova processos inativos.';
      }
    }
    
    return {
      allowed,
      currentValue: current,
      limitValue: limit,
      percentage,
      alertLevel,
      canContinue,
      gracePeriodActive: workspace.isInGracePeriod,
      gracePeriodEndsAt: workspace.gracePeriodEndsAt || undefined,
      message
    };
  }
  
  /**
   * Inicia grace period
   */
  async startGracePeriod(workspaceId: string): Promise<void> {
    const gracePeriodDays = 7;
    const endsAt = new Date();
    endsAt.setDate(endsAt.getDate() + gracePeriodDays);
    
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        isInGracePeriod: true,
        gracePeriodStartedAt: new Date(),
        gracePeriodEndsAt: endsAt,
        gracePeriodReason: 'Limite de processos excedido'
      }
    });
    
    console.log(`[Limits] Grace period iniciado para workspace ${workspaceId} até ${endsAt.toISOString()}`);
  }
  
  /**
   * Incrementa contador de processos
   */
  async incrementProcessCount(workspaceId: string): Promise<void> {
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        processCount: { increment: 1 }
      }
    });
  }
  
  /**
   * Decrementa contador de processos
   */
  async decrementProcessCount(workspaceId: string): Promise<void> {
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        processCount: { decrement: 1 }
      }
    });
  }
  
  /**
   * Finaliza grace period
   */
  async endGracePeriod(workspaceId: string): Promise<void> {
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        isInGracePeriod: false,
        gracePeriodStartedAt: null,
        gracePeriodEndsAt: null,
        gracePeriodReason: null
      }
    });
    
    console.log(`[Limits] Grace period finalizado para workspace ${workspaceId}`);
  }
}

// Singleton
export const workspaceLimitService = new WorkspaceLimitService();
