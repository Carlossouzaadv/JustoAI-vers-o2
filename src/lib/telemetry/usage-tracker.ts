
// ================================================================
// SISTEMA DE TELEMETRIA - Coletores de Uso
// ================================================================

import { prisma } from '../prisma';
import { ICONS } from '../icons';

// ================================================================
// TIPOS E INTERFACES
// ================================================================

interface UsageEvent {
  workspaceId: string;
  eventType: string;
  payload: Record<string, unknown>;
  timestamp?: Date;
}

interface TelemetryConfig {
  JUDIT_UNIT_COST: number;
  JUDIT_DOC_RETRIEVE_COST: number;
  IA_COST_FAST: number;
  IA_COST_MID: number;
  IA_COST_FULL: number;
  REPORT_CPU_COST_ESTIMATE: number;
}

interface UsageMetrics {
  juditCallsTotal: number;
  juditDocsRetrieved: number;
  iaCallsFast: number;
  iaCallsMid: number;
  iaCallsFull: number;
  reportsScheduledGenerated: number;
  reportsOnDemandGenerated: number;
  fullCreditsConsumedMonth: number;
}

interface BillingEstimate {
  juditCosts: number;
  iaCosts: number;
  reportCosts: number;
  totalEstimated: number;
  breakdown: Record<string, number>;
}

// ================================================================
// CONFIGURAÇÃO
// ================================================================

const TELEMETRY_CONFIG: TelemetryConfig = {
  JUDIT_UNIT_COST: parseFloat(process.env.JUDIT_UNIT_COST || '3.50'),
  JUDIT_DOC_RETRIEVE_COST: parseFloat(process.env.JUDIT_DOC_RETRIEVE_COST || '0.25'),
  IA_COST_FAST: parseFloat(process.env.IA_COST_FAST || '0.05'),
  IA_COST_MID: parseFloat(process.env.IA_COST_MID || '0.25'),
  IA_COST_FULL: parseFloat(process.env.IA_COST_FULL || '1.50'),
  REPORT_CPU_COST_ESTIMATE: parseFloat(process.env.REPORT_CPU_COST_ESTIMATE || '0.10'),
};

// ================================================================
// CLASSE PRINCIPAL DE TELEMETRIA
// ================================================================

export class UsageTracker {
  private static instance: UsageTracker;
  private config: TelemetryConfig;

  static getInstance(): UsageTracker {
    if (!UsageTracker.instance) {
      UsageTracker.instance = new UsageTracker();
    }
    return UsageTracker.instance;
  }

  constructor() {
    this.config = TELEMETRY_CONFIG;
  }

  // ================================================================
  // COLETORES DE EVENTOS
  // ================================================================

  /**
   * Registra chamada para API Judit
   */
  async trackJuditCall(workspaceId: string, options: {
    processNumber?: string;
    requestType: 'search' | 'tracking' | 'polling';
    docsRetrieved?: number;
    responseTime?: number;
    success: boolean;
    cost?: number;
  }): Promise<void> {
    try {
      const event: UsageEvent = {
        workspaceId,
        eventType: 'judit_call',
        payload: {
          processNumber: options.processNumber,
          requestType: options.requestType,
          docsRetrieved: options.docsRetrieved || 0,
          responseTime: options.responseTime,
          success: options.success,
          cost: options.cost || this.config.JUDIT_UNIT_COST
        }
      };

      await this.recordUsageEvent(event);

      console.log(`${ICONS.TELEMETRY} Judit call tracked:`, {
        workspace: workspaceId,
        type: options.requestType,
        docs: options.docsRetrieved,
        success: options.success
      });

    } catch (error) {
      console.error(`${ICONS.ERROR} Failed to track Judit call:`, error);
    }
  }

  /**
   * Registra chamada para IA (Gemini)
   */
  async trackIACall(workspaceId: string, options: {
    model: 'fast' | 'mid' | 'full';
    tokens?: number;
    responseTime?: number;
    success: boolean;
    purpose: string;
    cost?: number;
  }): Promise<void> {
    try {
      const costMap = {
        fast: this.config.IA_COST_FAST,
        mid: this.config.IA_COST_MID,
        full: this.config.IA_COST_FULL
      };

      const event: UsageEvent = {
        workspaceId,
        eventType: 'ia_call',
        payload: {
          model: options.model,
          tokens: options.tokens,
          responseTime: options.responseTime,
          success: options.success,
          purpose: options.purpose,
          cost: options.cost || costMap[options.model]
        }
      };

      await this.recordUsageEvent(event);

      console.log(`${ICONS.AI} IA call tracked:`, {
        workspace: workspaceId,
        model: options.model,
        purpose: options.purpose,
        success: options.success
      });

    } catch (error) {
      console.error(`${ICONS.ERROR} Failed to track IA call:`, error);
    }
  }

  /**
   * Registra geração de relatório
   */
  async trackReportGeneration(workspaceId: string, options: {
    type: 'scheduled' | 'on_demand';
    reportFormat: 'executive' | 'detailed' | 'legal';
    processCount: number;
    fileFormats: string[];
    duration?: number;
    success: boolean;
    cacheHit?: boolean;
    cost?: number;
  }): Promise<void> {
    try {
      const event: UsageEvent = {
        workspaceId,
        eventType: 'report_generation',
        payload: {
          type: options.type,
          reportFormat: options.reportFormat,
          processCount: options.processCount,
          fileFormats: options.fileFormats,
          duration: options.duration,
          success: options.success,
          cacheHit: options.cacheHit || false,
          cost: options.cost || (options.processCount * this.config.REPORT_CPU_COST_ESTIMATE)
        }
      };

      await this.recordUsageEvent(event);

      // Atualizar snapshot mensal de relatórios
      await this.updateMonthlyReportSnapshot(workspaceId, options.type);

      console.log(`${ICONS.REPORT} Report generation tracked:`, {
        workspace: workspaceId,
        type: options.type,
        format: options.reportFormat,
        processes: options.processCount,
        success: options.success
      });

    } catch (error) {
      console.error(`${ICONS.ERROR} Failed to track report generation:`, error);
    }
  }

  /**
   * Registra consumo de créditos FULL
   */
  async trackCreditConsumption(workspaceId: string, options: {
    amount: number;
    reason: string;
    relatedReportId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      // Registrar transação de crédito
      await prisma.creditTransaction.create({
        data: {
          workspaceId,
          type: 'DEBIT',
          creditCategory: 'FULL',
          amount: options.amount,
          reason: options.reason,
          metadata: {
            reason: options.reason,
            relatedReportId: options.relatedReportId,
            ...options.metadata
          }
        }
      });

      // Registrar evento de uso
      const event: UsageEvent = {
        workspaceId,
        eventType: 'credit_consumption',
        payload: {
          amount: options.amount,
          reason: options.reason,
          relatedReportId: options.relatedReportId,
          metadata: options.metadata
        }
      };

      await this.recordUsageEvent(event);

      console.log(`${ICONS.COST} Credit consumption tracked:`, {
        workspace: workspaceId,
        amount: options.amount,
        reason: options.reason
      });

    } catch (error) {
      console.error(`${ICONS.ERROR} Failed to track credit consumption:`, error);
    }
  }

  /**
   * Registra compra/adição de créditos
   */
  async trackCreditPurchase(workspaceId: string, options: {
    amount: number;
    source: 'purchase' | 'bonus' | 'admin' | 'refund';
    transactionId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      // Registrar transação de crédito
      await prisma.creditTransaction.create({
        data: {
          workspaceId,
          type: 'CREDIT',
          creditCategory: 'FULL',
          amount: options.amount,
          reason: `Credit ${options.source}`,
          metadata: {
            source: options.source,
            transactionId: options.transactionId,
            ...options.metadata
          }
        }
      });

      // Registrar evento de uso
      const event: UsageEvent = {
        workspaceId,
        eventType: 'credit_purchase',
        payload: {
          amount: options.amount,
          source: options.source,
          transactionId: options.transactionId,
          metadata: options.metadata
        }
      };

      await this.recordUsageEvent(event);

      console.log(`${ICONS.COST} Credit purchase tracked:`, {
        workspace: workspaceId,
        amount: options.amount,
        source: options.source
      });

    } catch (error) {
      console.error(`${ICONS.ERROR} Failed to track credit purchase:`, error);
    }
  }

  // ================================================================
  // AGREGAÇÃO E CÁLCULOS
  // ================================================================

  /**
   * Calcula estimativa de billing baseada no uso
   */
  calculateBillingEstimate(metrics: UsageMetrics): BillingEstimate {
    const juditCosts =
      (metrics.juditCallsTotal * this.config.JUDIT_UNIT_COST) +
      (metrics.juditDocsRetrieved * this.config.JUDIT_DOC_RETRIEVE_COST);

    const iaCosts =
      (metrics.iaCallsFast * this.config.IA_COST_FAST) +
      (metrics.iaCallsMid * this.config.IA_COST_MID) +
      (metrics.iaCallsFull * this.config.IA_COST_FULL);

    const reportCosts =
      ((metrics.reportsScheduledGenerated + metrics.reportsOnDemandGenerated) * this.config.REPORT_CPU_COST_ESTIMATE);

    const totalEstimated = juditCosts + iaCosts + reportCosts;

    return {
      juditCosts,
      iaCosts,
      reportCosts,
      totalEstimated,
      breakdown: {
        judit_calls: metrics.juditCallsTotal * this.config.JUDIT_UNIT_COST,
        judit_docs: metrics.juditDocsRetrieved * this.config.JUDIT_DOC_RETRIEVE_COST,
        ia_fast: metrics.iaCallsFast * this.config.IA_COST_FAST,
        ia_mid: metrics.iaCallsMid * this.config.IA_COST_MID,
        ia_full: metrics.iaCallsFull * this.config.IA_COST_FULL,
        reports: reportCosts
      }
    };
  }

  /**
   * Obtém uso atual do workspace
   */
  async getCurrentUsage(workspaceId: string): Promise<{
    daily: UsageMetrics;
    monthly: UsageMetrics;
    billingEstimate: BillingEstimate;
  }> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);

    // Uso diário - model não existe no schema, usando UsageEvent em vez disso
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dailyEvents = await prisma.usageEvent.findMany({
      where: {
        workspaceId,
        createdAt: {
          gte: today,
          lt: tomorrow
        }
      }
    });

    // Uso mensal agregado
    const monthlyEvents = await prisma.usageEvent.findMany({
      where: {
        workspaceId,
        createdAt: {
          gte: startOfMonth
        }
      }
    });

    // Processar eventos diários
    const dailyMetrics = this.processUsageEvents(dailyEvents);
    const daily: UsageMetrics = dailyMetrics;

    // Processar eventos mensais
    const monthlyMetrics = this.processUsageEvents(monthlyEvents);
    const monthly: UsageMetrics = monthlyMetrics;

    const billingEstimate = this.calculateBillingEstimate(monthly);

    return {
      daily,
      monthly,
      billingEstimate
    };
  }

  /**
   * Obtém saldo atual de créditos
   */
  async getCreditBalance(workspaceId: string): Promise<{
    balance: number;
    includedCredits: number;
    purchasedCredits: number;
    consumedCredits: number;
  }> {
    // TODO: Usar modelo WorkspaceCredits para saldos
    const includedCredits = 0;

    // Transações de créditos
    const transactions = await prisma.creditTransaction.groupBy({
      where: { workspaceId },
      by: ['type'],
      _sum: {
        amount: true
      }
    });

    const credits = transactions.reduce((sum: number, t: unknown) => sum + (t.type === 'CREDIT' ? Number(t._sum.amount) || 0 : 0), 0);
    const debits = transactions.reduce((sum: number, t: unknown) => sum + (t.type === 'DEBIT' ? Number(t._sum.amount) || 0 : 0), 0);

    const purchasedCredits = credits;
    const consumedCredits = debits;
    const balance = includedCredits + purchasedCredits - consumedCredits;

    return {
      balance: Math.max(0, balance),
      includedCredits,
      purchasedCredits,
      consumedCredits
    };
  }

  // ================================================================
  // FUNÇÕES AUXILIARES
  // ================================================================

  private async recordUsageEvent(event: UsageEvent): Promise<void> {
    await prisma.usageEvent.create({
      data: {
        workspaceId: event.workspaceId,
        eventType: event.eventType,
        resourceType: 'SYSTEM',
        metadata: event.payload,
        createdAt: event.timestamp || new Date()
      }
    });
  }

  private async updateMonthlyReportSnapshot(_workspaceId: string, _reportType: 'scheduled' | 'on_demand'): Promise<void> {
    // TODO: Implement monthly report snapshot update
    // This method should calculate and store monthly report statistics
    // For now, monthly data is tracked through UsageEvent records
  }

  // ================================================================
  // API PÚBLICA
  // ================================================================

  getConfig(): TelemetryConfig {
    return { ...this.config };
  }

  async getWorkspaceQuota(workspaceId: string) {
    return await prisma.workspaceQuota.findUnique({
      where: { workspaceId }
    });
  }

  async updateWorkspaceQuota(workspaceId: string, updates: Partial<{
    reportsMonthlyLimit: number;
    reportProcessesLimit: number;
  }>) {
    return await prisma.workspaceQuota.update({
      where: { workspaceId },
      data: updates
    });
  }

  // Método helper para processar eventos de uso
  private processUsageEvents(events: unknown[]): UsageMetrics {
    const metrics: UsageMetrics = {
      juditCallsTotal: 0,
      juditDocsRetrieved: 0,
      iaCallsFast: 0,
      iaCallsMid: 0,
      iaCallsFull: 0,
      reportsScheduledGenerated: 0,
      reportsOnDemandGenerated: 0,
      fullCreditsConsumedMonth: 0
    };

    events.forEach((event: unknown) => {
      const payload = event.metadata || {};

      switch (event.eventType) {
        case 'judit_call':
          metrics.juditCallsTotal++;
          metrics.juditDocsRetrieved += payload.docsRetrieved || 0;
          break;
        case 'ia_call':
          switch (payload.model) {
            case 'fast':
              metrics.iaCallsFast++;
              break;
            case 'mid':
              metrics.iaCallsMid++;
              break;
            case 'full':
              metrics.iaCallsFull++;
              break;
          }
          break;
        case 'report_generation':
          if (payload.type === 'scheduled') {
            metrics.reportsScheduledGenerated++;
          } else {
            metrics.reportsOnDemandGenerated++;
          }
          break;
        case 'credit_consumption':
          metrics.fullCreditsConsumedMonth += payload.amount || 0;
          break;
      }
    });

    return metrics;
  }
}

// ================================================================
// INSTÂNCIA SINGLETON
// ================================================================

export const usageTracker = UsageTracker.getInstance();