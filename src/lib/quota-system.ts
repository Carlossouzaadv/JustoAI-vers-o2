// ================================================================
// SISTEMA DE QUOTAS E FAIR-USE - Relatórios Agendados
// ================================================================

import { prisma } from '@/lib/prisma';
import { Plan } from '@/lib/types/database';
import { ICONS } from '@/lib/icons';

export interface QuotaLimits {
  reportsMonthlyLimit: number;
  reportProcessesLimit: number;
}

export interface QuotaStatus {
  used: number;
  limit: number;
  remaining: number;
  percentage: number;
  isNearLimit: boolean;    // >= 80%
  isAtLimit: boolean;      // >= 100%
}

export interface QuotaValidationResult {
  allowed: boolean;
  quotaStatus: QuotaStatus;
  error?: string;
  recommendation?: string;
  upgradeOptions?: string[];
}

// Limites padrão por plano
const PLAN_LIMITS: Record<Plan, QuotaLimits> = {
  FREE: {
    reportsMonthlyLimit: 5,
    reportProcessesLimit: 50
  },
  STARTER: {
    reportsMonthlyLimit: 20,
    reportProcessesLimit: 100
  },
  PROFESSIONAL: {
    reportsMonthlyLimit: 50,
    reportProcessesLimit: 300
  }
};

export class QuotaSystem {
  /**
   * Obtém ou cria quotas para um workspace
   */
  async getWorkspaceQuota(workspaceId: string): Promise<{
    id: string;
    workspaceId: string;
    plan: Plan;
    reportsMonthlyLimit: number;
    reportProcessesLimit: number;
    reportsUsedThisMonth: number;
    quotaResetDate: Date;
    overrideLimits?: Record<string, unknown>;
  }> {
    let quota = await prisma.workspaceQuota.findUnique({
      where: { workspaceId }
    });

    if (!quota) {
      // Buscar plano do workspace
      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { plan: true }
      });

      if (!workspace) {
        throw new Error('Workspace não encontrado');
      }

      // Type guard to ensure plan is a valid Plan enum value
      function isValidPlan(plan: unknown): plan is Plan {
        return typeof plan === 'string' && plan in PLAN_LIMITS;
      }

      if (!isValidPlan(workspace.plan)) {
        throw new Error(`Invalid plan: ${workspace.plan}`);
      }

      // After type guard, workspace.plan is narrowed to Plan
      const validPlan: Plan = workspace.plan;
      const limits = PLAN_LIMITS[validPlan];

      // Criar quota inicial
      quota = await prisma.workspaceQuota.create({
        data: {
          workspaceId,
          plan: workspace.plan,
          reportsMonthlyLimit: limits.reportsMonthlyLimit,
          reportProcessesLimit: limits.reportProcessesLimit,
          reportsUsedThisMonth: 0,
          quotaResetDate: new Date()
        }
      });

      console.log(`${ICONS.SUCCESS} Quota criada para workspace ${workspaceId}: ${limits.reportsMonthlyLimit} relatórios/mês`);
    }

    // Filtrar campos para corresponder ao tipo esperado
    const { createdAt, updatedAt, ...quotaData } = quota;
    return quotaData as unknown as Awaited<ReturnType<typeof prisma.quotaManagement.findUnique>>;
  }

  /**
   * Valida se um novo relatório pode ser criado
   */
  async validateReportCreation(
    workspaceId: string,
    processCount: number
  ): Promise<QuotaValidationResult> {
    const quota = await this.getWorkspaceQuota(workspaceId);

    // Verificar se é mês novo (reset automático)
    await this.checkAndResetMonthlyQuota(workspaceId);

    // Validar número de processos
    if (processCount > quota.reportProcessesLimit) {
      return {
        allowed: false,
        quotaStatus: this.calculateQuotaStatus(quota.reportsUsedThisMonth, quota.reportsMonthlyLimit),
        error: `Limite de processos excedido`,
        recommendation: `Máximo ${quota.reportProcessesLimit} processos por relatório no plano ${quota.plan}`,
        upgradeOptions: this.getUpgradeOptions(quota.plan)
      };
    }

    // Validar quota mensal
    const quotaStatus = this.calculateQuotaStatus(quota.reportsUsedThisMonth, quota.reportsMonthlyLimit);

    if (quotaStatus.isAtLimit) {
      return {
        allowed: false,
        quotaStatus,
        error: 'Limite mensal de relatórios atingido',
        recommendation: `Você usou ${quotaStatus.used}/${quotaStatus.limit} relatórios este mês`,
        upgradeOptions: this.getUpgradeOptions(quota.plan)
      };
    }

    // Warning se próximo ao limite
    const result: QuotaValidationResult = {
      allowed: true,
      quotaStatus
    };

    if (quotaStatus.isNearLimit) {
      result.recommendation = `Atenção: ${quotaStatus.remaining} relatórios restantes neste mês`;
    }

    return result;
  }

  /**
   * Consome quota ao criar um relatório
   */
  async consumeQuota(workspaceId: string, reportCount: number = 1): Promise<void> {
    await prisma.workspaceQuota.update({
      where: { workspaceId },
      data: {
        reportsUsedThisMonth: {
          increment: reportCount
        },
        updatedAt: new Date()
      }
    });

    console.log(`${ICONS.SUCCESS} Quota consumida: ${reportCount} relatório(s) para workspace ${workspaceId}`);
  }

  /**
   * Reverte quota em caso de falha
   */
  async refundQuota(workspaceId: string, reportCount: number = 1): Promise<void> {
    await prisma.workspaceQuota.update({
      where: { workspaceId },
      data: {
        reportsUsedThisMonth: {
          decrement: reportCount
        },
        updatedAt: new Date()
      }
    });

    console.log(`${ICONS.SUCCESS} Quota devolvida: ${reportCount} relatório(s) para workspace ${workspaceId}`);
  }

  /**
   * Aplica override administrativo de limites
   */
  async setOverrideLimits(
    workspaceId: string,
    overrides: Partial<QuotaLimits>,
    reason: string,
    adminUserId: string
  ): Promise<void> {
    await prisma.workspaceQuota.update({
      where: { workspaceId },
      data: {
        overrideLimits: {
          ...overrides,
          reason,
          appliedBy: adminUserId,
          appliedAt: new Date().toISOString()
        },
        updatedAt: new Date()
      }
    });

    console.log(`${ICONS.SUCCESS} Override aplicado ao workspace ${workspaceId}: ${JSON.stringify(overrides)}`);
  }

  /**
   * Verifica e reseta quota se necessário
   */
  private async checkAndResetMonthlyQuota(workspaceId: string): Promise<void> {
    const quota = await prisma.workspaceQuota.findUnique({
      where: { workspaceId }
    });

    if (!quota) return;

    const now = new Date();
    const lastReset = new Date(quota.quotaResetDate);
    const currentMonth = now.getMonth();
    const lastResetMonth = lastReset.getMonth();

    // Se mudou o mês, reseta quota
    if (currentMonth !== lastResetMonth || now.getFullYear() !== lastReset.getFullYear()) {
      await prisma.workspaceQuota.update({
        where: { workspaceId },
        data: {
          reportsUsedThisMonth: 0,
          quotaResetDate: now,
          updatedAt: now
        }
      });

      console.log(`${ICONS.SUCCESS} Quota mensal resetada para workspace ${workspaceId}`);
    }
  }

  /**
   * Calcula status da quota
   */
  private calculateQuotaStatus(used: number, limit: number): QuotaStatus {
    const remaining = Math.max(0, limit - used);
    const percentage = limit > 0 ? (used / limit) * 100 : 0;

    return {
      used,
      limit,
      remaining,
      percentage,
      isNearLimit: percentage >= 80,
      isAtLimit: percentage >= 100
    };
  }

  /**
   * Sugestões de upgrade baseadas no plano atual
   */
  private getUpgradeOptions(currentPlan: Plan): string[] {
    const upgrades: Record<Plan, string[]> = {
      FREE: ['STARTER - 20 relatórios/mês', 'PROFESSIONAL - 50 relatórios/mês'],
      STARTER: ['PROFESSIONAL - 50 relatórios/mês'],
      PROFESSIONAL: ['Contate suporte para limites customizados']
    };

    return upgrades[currentPlan] || [];
  }

  /**
   * Obter estatísticas de uso para dashboard
   */
  async getUsageStatistics(workspaceId: string): Promise<{
    quota: QuotaStatus;
    thisMonth: {
      reports: number;
      successRate: number;
      avgProcessesPerReport: number;
    };
    trend: {
      lastMonth: number;
      growth: number;
    };
  }> {
    const quota = await this.getWorkspaceQuota(workspaceId);
    const quotaStatus = this.calculateQuotaStatus(quota.reportsUsedThisMonth, quota.reportsMonthlyLimit);

    // Estatísticas do mês atual
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const thisMonthStats = await prisma.reportExecution.aggregate({
      where: {
        workspaceId,
        createdAt: { gte: monthStart }
      },
      _count: { id: true },
      _avg: { processCount: true }
    });

    const successCount = await prisma.reportExecution.count({
      where: {
        workspaceId,
        createdAt: { gte: monthStart },
        status: 'COMPLETED'
      }
    });

    // Estatísticas do mês anterior
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const lastMonthCount = await prisma.reportExecution.count({
      where: {
        workspaceId,
        createdAt: {
          gte: lastMonthStart,
          lte: lastMonthEnd
        }
      }
    });

    const growth = lastMonthCount > 0
      ? ((thisMonthStats._count.id - lastMonthCount) / lastMonthCount) * 100
      : 0;

    return {
      quota: quotaStatus,
      thisMonth: {
        reports: thisMonthStats._count.id,
        successRate: thisMonthStats._count.id > 0
          ? (successCount / thisMonthStats._count.id) * 100
          : 0,
        avgProcessesPerReport: thisMonthStats._avg.processCount || 0
      },
      trend: {
        lastMonth: lastMonthCount,
        growth: Math.round(growth)
      }
    };
  }

  /**
   * Bulk reset de quotas mensais (para cron job)
   */
  async resetAllMonthlyQuotas(): Promise<number> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const result = await prisma.workspaceQuota.updateMany({
      where: {
        quotaResetDate: {
          lt: monthStart
        }
      },
      data: {
        reportsUsedThisMonth: 0,
        quotaResetDate: now,
        updatedAt: now
      }
    });

    console.log(`${ICONS.SUCCESS} Reset mensal: ${result.count} workspaces atualizados`);
    return result.count;
  }
}