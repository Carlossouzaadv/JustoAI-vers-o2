// ================================================================
// MIDDLEWARE DE QUOTA - Enforcement de Limites e Fair Use
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../prisma';
import { usageTracker } from '../telemetry/usage-tracker';
import { ICONS } from '../icons';

// ================================================================
// TIPOS E INTERFACES
// ================================================================

interface QuotaCheckResult {
  allowed: boolean;
  quotaStatus: 'ok' | 'soft_warning' | 'hard_blocked';
  current: number;
  limit: number;
  percentage: number;
  message: string;
  actions?: QuotaAction[];
  metadata?: Record<string, unknown>;
}

interface QuotaAction {
  type: 'upgrade_plan' | 'buy_credits' | 'schedule_night' | 'executive_fallback';
  label: string;
  url?: string;
  description: string;
}

interface QuotaPolicy {
  workspaceId: string;
  planId: string;
  reportsMonthlyLimit: number;
  processesLimit: number;
  fullCreditsIncluded: number;
  softThresholdPct: number;
  hardThresholdPct: number;
}

interface QuotaEnforcementConfig {
  ENABLE_QUOTA_ENFORCEMENT: boolean;
  ALLOW_EXECUTIVE_FALLBACK_ON_BLOCK: boolean;
  SOFT_WARNING_COOLDOWN_HOURS: number;
  ADMIN_BYPASS_HEADER: string;
}

// ================================================================
// CONFIGURAÇÃO
// ================================================================

const QUOTA_CONFIG: QuotaEnforcementConfig = {
  ENABLE_QUOTA_ENFORCEMENT: process.env.ENABLE_QUOTA_ENFORCEMENT === 'true',
  ALLOW_EXECUTIVE_FALLBACK_ON_BLOCK: process.env.ALLOW_EXECUTIVE_FALLBACK_ON_BLOCK === 'true',
  SOFT_WARNING_COOLDOWN_HOURS: parseInt(process.env.SOFT_WARNING_COOLDOWN_HOURS || '24'),
  ADMIN_BYPASS_HEADER: process.env.ADMIN_BYPASS_HEADER || 'x-admin-bypass'
};

// ================================================================
// CLASSE PRINCIPAL
// ================================================================

export class QuotaEnforcement {
  private static instance: QuotaEnforcement;
  private config: QuotaEnforcementConfig;

  static getInstance(): QuotaEnforcement {
    if (!QuotaEnforcement.instance) {
      QuotaEnforcement.instance = new QuotaEnforcement();
    }
    return QuotaEnforcement.instance;
  }

  constructor() {
    this.config = QUOTA_CONFIG;
  }

  // ================================================================
  // MIDDLEWARE PRINCIPAL
  // ================================================================

  /**
   * Middleware para verificar quota de relatórios
   */
  async checkReportQuota(
    workspaceId: string,
    reportType: 'scheduled' | 'on_demand',
    options: {
      processCount?: number;
      scheduledFor?: Date;
      reportFormat?: 'executive' | 'detailed' | 'legal';
      adminBypass?: boolean;
    } = {}
  ): Promise<QuotaCheckResult> {
    try {
      console.log(`${ICONS.SHIELD} Checking report quota for workspace: ${workspaceId}`);

      // Verificar se enforcement está habilitado
      if (!this.config.ENABLE_QUOTA_ENFORCEMENT) {
        return {
          allowed: true,
          quotaStatus: 'ok',
          current: 0,
          limit: 999999,
          percentage: 0,
          message: 'Quota enforcement disabled'
        };
      }

      // Verificar bypass de admin
      if (options.adminBypass) {
        console.log(`${ICONS.USER} Admin bypass enabled for workspace: ${workspaceId}`);
        return {
          allowed: true,
          quotaStatus: 'ok',
          current: 0,
          limit: 999999,
          percentage: 0,
          message: 'Admin bypass enabled'
        };
      }

      // Obter política de quota
      const policy = await this.getWorkspaceQuotaPolicy(workspaceId);
      if (!policy) {
        throw new Error(`Quota policy not found for workspace: ${workspaceId}`);
      }

      // Obter uso atual
      const usage = await this.getCurrentMonthlyUsage(workspaceId, options.scheduledFor);

      // Calcular percentual de uso
      const currentReports = usage.reportsTotal;
      const limit = policy.reportsMonthlyLimit;
      const percentage = (currentReports / limit) * 100;

      console.log(`${ICONS.INFO} Quota check:`, {
        workspace: workspaceId,
        current: currentReports,
        limit,
        percentage: percentage.toFixed(1) + '%'
      });

      // Verificar hard threshold
      if (percentage >= (policy.hardThresholdPct * 100)) {
        const result = await this.handleHardBlock(policy, currentReports, limit, options);

        // Registrar evento de bloqueio
        await this.recordQuotaEvent(workspaceId, 'quota_hard_blocked', {
          reportType,
          currentReports,
          limit,
          percentage,
          ...options
        });

        return result;
      }

      // Verificar soft threshold
      if (percentage >= (policy.softThresholdPct * 100)) {
        const result = await this.handleSoftWarning(policy, currentReports, limit, percentage, options);

        // Registrar evento de warning (se não for duplicado)
        const shouldSendWarning = await this.shouldSendSoftWarning(workspaceId);
        if (shouldSendWarning) {
          await this.recordQuotaEvent(workspaceId, 'quota_soft_warning_sent', {
            reportType,
            currentReports,
            limit,
            percentage,
            ...options
          });
        }

        return result;
      }

      // Quota OK
      return {
        allowed: true,
        quotaStatus: 'ok',
        current: currentReports,
        limit,
        percentage,
        message: `Você usou ${currentReports} de ${limit} relatórios este mês (${percentage.toFixed(1)}%)`
      };

    } catch (error) {
      console.error(`${ICONS.ERROR} Quota check failed:`, error);

      // Em caso de erro, permitir (fail-open) mas logar
      return {
        allowed: true,
        quotaStatus: 'ok',
        current: 0,
        limit: 0,
        percentage: 0,
        message: 'Erro na verificação de quota - operação permitida',
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  /**
   * Verificar quota de créditos
   */
  async checkCreditQuota(workspaceId: string, requiredCredits: number): Promise<QuotaCheckResult> {
    try {
      const creditBalance = await usageTracker.getCreditBalance(workspaceId);

      if (creditBalance.balance < requiredCredits) {
        return {
          allowed: false,
          quotaStatus: 'hard_blocked',
          current: creditBalance.balance,
          limit: requiredCredits,
          percentage: 100,
          message: `Créditos insuficientes. Você tem ${creditBalance.balance} créditos, mas precisa de ${requiredCredits}.`,
          actions: [
            {
              type: 'buy_credits',
              label: 'Comprar Créditos',
              url: '/billing/credits',
              description: 'Adquira mais créditos para continuar'
            }
          ]
        };
      }

      const percentage = ((requiredCredits / creditBalance.balance) * 100);

      return {
        allowed: true,
        quotaStatus: 'ok',
        current: creditBalance.balance,
        limit: requiredCredits,
        percentage,
        message: `Créditos suficientes: ${creditBalance.balance} disponíveis`
      };

    } catch (error) {
      console.error(`${ICONS.ERROR} Credit quota check failed:`, error);

      return {
        allowed: false,
        quotaStatus: 'hard_blocked',
        current: 0,
        limit: requiredCredits,
        percentage: 100,
        message: 'Erro na verificação de créditos',
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  // ================================================================
  // HANDLERS DE QUOTA
  // ================================================================

  private async handleHardBlock(
    policy: QuotaPolicy,
    current: number,
    limit: number,
    options: unknown
  ): Promise<QuotaCheckResult> {
    const percentage = (current / limit) * 100;

    // Type guard: safely narrow options to check for reportType and reportFormat
    function isOptionsWithReportType(data: unknown): data is { reportType?: string } {
      return typeof data === 'object' && data !== null;
    }

    function isOptionsWithReportFormat(data: unknown): data is { reportFormat?: string } {
      return typeof data === 'object' && data !== null;
    }

    // Ações disponíveis baseadas no contexto
    const actions: QuotaAction[] = [
      {
        type: 'upgrade_plan',
        label: 'Fazer Upgrade do Plano',
        url: '/billing/upgrade',
        description: 'Aumente seu limite mensal de relatórios'
      },
      {
        type: 'buy_credits',
        label: 'Comprar Relatórios Extras',
        url: '/billing/credits',
        description: 'Compre relatórios adicionais para este mês'
      }
    ];

    // Opção de agendamento para mês seguinte (narrowing seguro)
    if (isOptionsWithReportType(options) && options.reportType === 'scheduled') {
      actions.push({
        type: 'schedule_night',
        label: 'Agendar para Próximo Mês',
        description: 'Agende para quando sua cota for renovada'
      });
    }

    // Fallback para relatório executivo (narrowing seguro)
    if (isOptionsWithReportFormat(options) && this.config.ALLOW_EXECUTIVE_FALLBACK_ON_BLOCK && options.reportFormat !== 'executive') {
      actions.push({
        type: 'executive_fallback',
        label: 'Gerar Versão Executiva',
        description: 'Relatório simplificado que consome menos quota'
      });
    }

    return {
      allowed: false,
      quotaStatus: 'hard_blocked',
      current,
      limit,
      percentage,
      message: `Você atingiu o limite de ${limit} relatórios do seu plano ${policy.planId.toUpperCase()}.`,
      actions
    };
  }

  private async handleSoftWarning(
    policy: QuotaPolicy,
    current: number,
    limit: number,
    percentage: number,
    options: unknown
  ): Promise<QuotaCheckResult> {
    const remaining = limit - current - 1; // -1 para o relatório atual

    const actions: QuotaAction[] = [];

    // Sugerir upgrade se próximo do limite
    if (remaining <= 2) {
      actions.push({
        type: 'upgrade_plan',
        label: 'Considere Upgrade',
        url: '/billing/upgrade',
        description: 'Evite bloqueios futuros com mais relatórios'
      });
    }

    return {
      allowed: true,
      quotaStatus: 'soft_warning',
      current,
      limit,
      percentage,
      message: `Atenção: Você já usou ${current} de ${limit} relatórios (${percentage.toFixed(1)}%). Restam apenas ${remaining} relatórios este mês.`,
      actions: actions.length > 0 ? actions : undefined
    };
  }

  // ================================================================
  // FUNÇÕES AUXILIARES
  // ================================================================

  private async getWorkspaceQuotaPolicy(workspaceId: string): Promise<QuotaPolicy | null> {
    const policy = await prisma.workspaceQuota.findUnique({
      where: { workspaceId }
    });

    if (!policy) {
      return null;
    }

    return {
      workspaceId: policy.workspaceId,
      planId: policy.plan,
      reportsMonthlyLimit: policy.reportsMonthlyLimit,
      processesLimit: policy.reportProcessesLimit,
      fullCreditsIncluded: 100, // Default value since not in schema
      softThresholdPct: 0.8, // 80% soft threshold
      hardThresholdPct: 1.0 // 100% hard threshold
    };
  }

  private async getCurrentMonthlyUsage(workspaceId: string, scheduledFor?: Date): Promise<{
    reportsTotal: number;
    creditsConsumed: number;
  }> {
    try {
      // Get quota info which has current usage
      const quota = await prisma.workspaceQuota.findUnique({
        where: { workspaceId }
      });

      if (!quota) {
        return { reportsTotal: 0, creditsConsumed: 0 };
      }

      // Use the tracked usage from the quota table
      return {
        reportsTotal: quota.reportsUsedThisMonth,
        creditsConsumed: 0 // Can be calculated if needed
      };
    } catch (error) {
      console.error('Error getting monthly usage:', error);
      return { reportsTotal: 0, creditsConsumed: 0 };
    }
  }

  private async shouldSendSoftWarning(workspaceId: string): Promise<boolean> {
    const cooldownHours = this.config.SOFT_WARNING_COOLDOWN_HOURS;
    const cutoffTime = new Date(Date.now() - cooldownHours * 60 * 60 * 1000);

    const recentWarning = await prisma.usageEvent.findFirst({
      where: {
        workspaceId,
        eventType: 'quota_soft_warning_sent',
        createdAt: {
          gte: cutoffTime
        }
      }
    });

    return !recentWarning;
  }

  private async recordQuotaEvent(
    workspaceId: string,
    eventType: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    await prisma.usageEvent.create({
      data: {
        workspaceId,
        eventType,
        resourceType: 'quota_check',
        // JSON.parse(JSON.stringify()) ensures JSON-safety for InputJsonValue
        metadata: JSON.parse(JSON.stringify(payload))
      }
    });
  }

  // ================================================================
  // API PÚBLICA
  // ================================================================

  /**
   * Middleware Express/Next.js para verificação automática
   */
  async middleware(req: NextRequest): Promise<NextResponse | null> {
    const workspaceId = req.headers.get('x-workspace-id');
    const adminBypass = req.headers.get(this.config.ADMIN_BYPASS_HEADER);

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace ID required' },
        { status: 400 }
      );
    }

    // Verificar se é endpoint de relatório
    const isReportEndpoint = req.url.includes('/api/reports/');

    if (!isReportEndpoint) {
      return null; // Não aplicar quota
    }

    // Determinar tipo de relatório baseado na URL
    const reportType = req.url.includes('/scheduled') ? 'scheduled' : 'on_demand';

    const quotaCheck = await this.checkReportQuota(workspaceId, reportType, {
      adminBypass: !!adminBypass
    });

    if (!quotaCheck.allowed) {
      return NextResponse.json({
        code: 'QUOTA_EXCEDIDA',
        message: quotaCheck.message,
        quotaStatus: quotaCheck.quotaStatus,
        current: quotaCheck.current,
        limit: quotaCheck.limit,
        percentage: quotaCheck.percentage,
        actions: quotaCheck.actions
      }, { status: 403 });
    }

    // Se há soft warning, adicionar headers
    if (quotaCheck.quotaStatus === 'soft_warning') {
      const response = NextResponse.next();
      response.headers.set('X-Quota-Warning', 'true');
      response.headers.set('X-Quota-Message', quotaCheck.message);
      response.headers.set('X-Quota-Percentage', quotaCheck.percentage.toString());
      return response;
    }

    return null; // Permitir continuação
  }

  /**
   * Obter status de quota para dashboard
   */
  async getQuotaStatus(workspaceId: string): Promise<{
    reports: QuotaCheckResult;
    credits: { balance: number; includedCredits: number; purchasedCredits: number; consumedCredits: number };
    policy: QuotaPolicy | null;
  }> {
    const policy = await this.getWorkspaceQuotaPolicy(workspaceId);
    const usage = await this.getCurrentMonthlyUsage(workspaceId);
    const credits = await usageTracker.getCreditBalance(workspaceId);

    const reports = await this.checkReportQuota(workspaceId, 'on_demand');

    return {
      reports,
      credits,
      policy
    };
  }

  /**
   * Atualizar política de quota (admin)
   */
  async updateQuotaPolicy(
    workspaceId: string,
    updates: Partial<QuotaPolicy>
  ): Promise<QuotaPolicy> {
    // Build data object with only defined fields (narrowing seguro)
    const updateData: Record<string, unknown> = {};

    if (updates.planId && typeof updates.planId === 'string') {
      updateData.plan = updates.planId;
    }
    if (updates.reportsMonthlyLimit !== undefined) {
      updateData.reportsMonthlyLimit = updates.reportsMonthlyLimit;
    }
    if (updates.processesLimit !== undefined) {
      updateData.reportProcessesLimit = updates.processesLimit;
    }

    const updated = await prisma.workspaceQuota.update({
      where: { workspaceId },
      data: updateData
    });

    return {
      workspaceId: updated.workspaceId,
      planId: updated.plan,
      reportsMonthlyLimit: updated.reportsMonthlyLimit,
      processesLimit: updated.reportProcessesLimit,
      fullCreditsIncluded: 100,
      softThresholdPct: 0.8,
      hardThresholdPct: 1.0
    };
  }

  getConfig(): QuotaEnforcementConfig {
    return { ...this.config };
  }
}

// ================================================================
// INSTÂNCIA SINGLETON
// ================================================================

export const quotaEnforcement = QuotaEnforcement.getInstance();

// ================================================================
// HELPER FUNCTIONS PARA ENDPOINTS
// ================================================================

/**
 * Helper para verificar quota em endpoints de relatório
 */
export async function quotaCheckReport(
  workspaceId: string,
  reportType: 'scheduled' | 'on_demand',
  options: {
    processCount?: number;
    scheduledFor?: Date;
    reportFormat?: 'executive' | 'detailed' | 'legal';
    adminBypass?: boolean;
  } = {}
): Promise<QuotaCheckResult> {
  return await quotaEnforcement.checkReportQuota(workspaceId, reportType, options);
}

/**
 * Response helper para erros de quota
 */
export function createQuotaErrorResponse(quotaResult: QuotaCheckResult): NextResponse {
  return NextResponse.json({
    code: 'QUOTA_EXCEDIDA',
    message: quotaResult.message,
    quotaStatus: quotaResult.quotaStatus,
    current: quotaResult.current,
    limit: quotaResult.limit,
    percentage: Math.round(quotaResult.percentage),
    actions: quotaResult.actions
  }, { status: 403 });
}