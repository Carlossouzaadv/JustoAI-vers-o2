// ================================================================
// SISTEMA DE TELEMETRIA E TRACKING DE CUSTOS - Monitoramento Judit
// ================================================================

import { prisma } from './prisma';
import { ICONS } from './icons';

// ================================================================
// TIPOS E INTERFACES
// ================================================================

interface TelemetryEvent {
  type: 'api_call' | 'tracking_created' | 'webhook_received' | 'batch_processed' | 'error' | 'cost_incurred';
  source: 'polling' | 'tracking' | 'webhook' | 'batch' | 'system';
  workspaceId?: string;
  processId?: string;
  processNumber?: string;
  trackingId?: string;
  metadata: Record<string, any>;
  timestamp: Date;
  cost?: number;
  success: boolean;
  duration?: number;
  error?: string;
}

interface CostTracking {
  workspaceId: string;
  service: 'judit';
  operation: 'tracking_creation' | 'polling_check' | 'attachment_download' | 'webhook_processing';
  cost: number;
  currency: 'BRL';
  processCount?: number;
  attachmentCount?: number;
  metadata: Record<string, any>;
  timestamp: Date;
}

interface MonitoringMetrics {
  daily: {
    date: string;
    totalApiCalls: number;
    totalWebhooks: number;
    totalCost: number;
    successRate: number;
    avgResponseTime: number;
    processesMonitored: number;
    trackingsActive: number;
    errorsCount: number;
  };
  realTime: {
    activeTrackings: number;
    pendingWebhooks: number;
    rateLimitStatus: number;
    circuitBreakerStatus: 'closed' | 'open' | 'half-open';
    currentCostBurn: number;
    lastError?: string;
  };
  workspace: Record<string, {
    processesMonitored: number;
    trackingsActive: number;
    dailyCost: number;
    monthlyProjection: number;
    lastActivity: Date;
    errorRate: number;
  }>;
}

interface CostAlert {
  type: 'daily_limit' | 'monthly_projection' | 'unusual_spike' | 'rate_limit_approaching';
  severity: 'low' | 'medium' | 'high' | 'critical';
  workspaceId?: string;
  currentValue: number;
  threshold: number;
  message: string;
  timestamp: Date;
  metadata: Record<string, any>;
}

// ================================================================
// CLASSE PRINCIPAL DE TELEMETRIA
// ================================================================

export class MonitoringTelemetry {
  private static instance: MonitoringTelemetry;
  private metricsCache: Map<string, any> = new Map();
  private costAccumulator: Map<string, number> = new Map();
  private alertsBuffer: CostAlert[] = [];

  // Configurações de limites
  private readonly COST_LIMITS = {
    DAILY_WARNING: 50.00,      // R$ 50/dia warning
    DAILY_CRITICAL: 100.00,    // R$ 100/dia critical
    MONTHLY_WARNING: 1000.00,  // R$ 1000/mês warning
    MONTHLY_CRITICAL: 2000.00, // R$ 2000/mês critical
    SPIKE_THRESHOLD: 5.0,      // 5x normal usage = spike
  };

  private readonly CACHE_TTL = {
    METRICS: 60 * 1000,        // 1 minuto
    WORKSPACE_STATS: 5 * 60 * 1000, // 5 minutos
    DAILY_SUMMARY: 30 * 60 * 1000,  // 30 minutos
  };

  static getInstance(): MonitoringTelemetry {
    if (!MonitoringTelemetry.instance) {
      MonitoringTelemetry.instance = new MonitoringTelemetry();
    }
    return MonitoringTelemetry.instance;
  }

  // ================================================================
  // RECORDING DE EVENTOS
  // ================================================================

  async recordTelemetryEvent(event: Omit<TelemetryEvent, 'timestamp'>): Promise<void> {
    const fullEvent: TelemetryEvent = {
      ...event,
      timestamp: new Date()
    };

    try {
      // Salvar no banco
      await prisma.monitoringTelemetry.create({
        data: {
          type: fullEvent.type,
          source: fullEvent.source,
          workspaceId: fullEvent.workspaceId,
          processId: fullEvent.processId,
          processNumber: fullEvent.processNumber,
          trackingId: fullEvent.trackingId,
          metadata: fullEvent.metadata as any,
          cost: fullEvent.cost,
          success: fullEvent.success,
          duration: fullEvent.duration,
          error: fullEvent.error,
          timestamp: fullEvent.timestamp
        }
      });

      // Atualizar métricas em tempo real se houver custo
      if (fullEvent.cost && fullEvent.workspaceId) {
        await this.updateCostTracking(fullEvent.workspaceId, fullEvent.cost);
      }

      // Verificar alertas
      if (fullEvent.cost) {
        await this.checkCostAlerts(fullEvent);
      }

      // Log estruturado
      console.log(`${ICONS.TELEMETRY} ${fullEvent.type}:`, {
        source: fullEvent.source,
        workspace: fullEvent.workspaceId,
        process: fullEvent.processNumber,
        cost: fullEvent.cost,
        success: fullEvent.success,
        duration: fullEvent.duration
      });

    } catch (error) {
      console.error(`${ICONS.ERROR} Failed to record telemetry:`, error);
      // Não falhar a operação principal por erro de telemetria
    }
  }

  async recordCostEvent(cost: Omit<CostTracking, 'timestamp'>): Promise<void> {
    const fullCost: CostTracking = {
      ...cost,
      timestamp: new Date()
    };

    try {
      await prisma.monitoringCosts.create({
        data: {
          workspaceId: fullCost.workspaceId,
          service: fullCost.service,
          operation: fullCost.operation,
          cost: fullCost.cost,
          currency: fullCost.currency,
          processCount: fullCost.processCount,
          attachmentCount: fullCost.attachmentCount,
          metadata: fullCost.metadata as any,
          timestamp: fullCost.timestamp
        }
      });

      // Atualizar acumulador de custos
      const key = `${fullCost.workspaceId}:${this.getDateKey()}`;
      const current = this.costAccumulator.get(key) || 0;
      this.costAccumulator.set(key, current + fullCost.cost);

      console.log(`${ICONS.COST} Cost recorded: R$ ${fullCost.cost.toFixed(2)} for ${fullCost.operation}`);

    } catch (error) {
      console.error(`${ICONS.ERROR} Failed to record cost:`, error);
    }
  }

  // ================================================================
  // MÉTRICAS E ESTATÍSTICAS
  // ================================================================

  async getMonitoringMetrics(workspaceId?: string): Promise<MonitoringMetrics> {
    const cacheKey = `metrics:${workspaceId || 'global'}`;
    const cached = this.metricsCache.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL.METRICS) {
      return cached.data;
    }

    try {
      const today = this.getDateKey();
      const whereClause = workspaceId ? { workspaceId } : {};

      // Métricas diárias
      const dailyStats = await prisma.monitoringTelemetry.groupBy({
        by: ['success'],
        where: {
          ...whereClause,
          timestamp: {
            gte: new Date(today + 'T00:00:00.000Z'),
            lt: new Date(today + 'T23:59:59.999Z')
          }
        },
        _count: { id: true },
        _avg: { duration: true },
        _sum: { cost: true }
      });

      // Trackings ativos
      const activeTrackings = await prisma.monitoredProcess.count({
        where: {
          ...whereClause,
          remoteTrackingId: { not: null },
          monitoringStatus: 'ACTIVE'
        }
      });

      // Webhooks pendentes
      const pendingWebhooks = await prisma.webhookQueue.count({
        where: {
          ...whereClause,
          status: 'PENDING'
        }
      });

      // Construir métricas
      const totalCalls = dailyStats.reduce((sum, stat) => sum + stat._count.id, 0);
      const successfulCalls = dailyStats.find(stat => stat.success)?._count.id || 0;
      const totalCost = dailyStats.reduce((sum, stat) => sum + (stat._sum.cost || 0), 0);
      const avgDuration = dailyStats.reduce((sum, stat) => sum + (stat._avg.duration || 0), 0) / dailyStats.length;

      const metrics: MonitoringMetrics = {
        daily: {
          date: today,
          totalApiCalls: totalCalls,
          totalWebhooks: pendingWebhooks,
          totalCost,
          successRate: totalCalls > 0 ? (successfulCalls / totalCalls) * 100 : 100,
          avgResponseTime: avgDuration || 0,
          processesMonitored: await this.getProcessesMonitoredCount(workspaceId),
          trackingsActive: activeTrackings,
          errorsCount: totalCalls - successfulCalls
        },
        realTime: {
          activeTrackings,
          pendingWebhooks,
          rateLimitStatus: await this.getRateLimitStatus(),
          circuitBreakerStatus: await this.getCircuitBreakerStatus(),
          currentCostBurn: this.getCurrentCostBurn(workspaceId),
          lastError: await this.getLastError(workspaceId)
        },
        workspace: await this.getWorkspaceStats()
      };

      // Cachear resultado
      this.metricsCache.set(cacheKey, {
        data: metrics,
        timestamp: Date.now()
      });

      return metrics;

    } catch (error) {
      console.error(`${ICONS.ERROR} Failed to get monitoring metrics:`, error);
      throw error;
    }
  }

  async getDailyCostSummary(workspaceId?: string, days = 30): Promise<any[]> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    const whereClause = workspaceId ? { workspaceId } : {};

    return await prisma.monitoringCosts.groupBy({
      by: ['workspaceId'],
      where: {
        ...whereClause,
        timestamp: {
          gte: startDate,
          lte: endDate
        }
      },
      _sum: { cost: true },
      _count: { id: true },
      orderBy: { _sum: { cost: 'desc' } }
    });
  }

  async getTrackingEfficiencyReport(workspaceId?: string): Promise<any> {
    const whereClause = workspaceId ? { workspaceId } : {};

    // Comparar tracking vs polling
    const trackingStats = await prisma.monitoringTelemetry.groupBy({
      by: ['source'],
      where: {
        ...whereClause,
        type: 'api_call',
        timestamp: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Últimos 7 dias
        }
      },
      _count: { id: true },
      _sum: { cost: true },
      _avg: { duration: true }
    });

    // Webhooks recebidos
    const webhookCount = await prisma.monitoringTelemetry.count({
      where: {
        ...whereClause,
        type: 'webhook_received',
        timestamp: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        }
      }
    });

    return {
      trackingStats,
      webhookCount,
      efficiency: this.calculateTrackingEfficiency(trackingStats, webhookCount)
    };
  }

  // ================================================================
  // ALERTAS E MONITORAMENTO
  // ================================================================

  private async checkCostAlerts(event: TelemetryEvent): Promise<void> {
    if (!event.cost || !event.workspaceId) return;

    const dailyCost = await this.getDailyCostForWorkspace(event.workspaceId);
    const monthlyCost = await this.getMonthlyCostForWorkspace(event.workspaceId);

    // Verificar limite diário
    if (dailyCost >= this.COST_LIMITS.DAILY_CRITICAL) {
      await this.createCostAlert({
        type: 'daily_limit',
        severity: 'critical',
        workspaceId: event.workspaceId,
        currentValue: dailyCost,
        threshold: this.COST_LIMITS.DAILY_CRITICAL,
        message: `Custo diário crítico atingido: R$ ${dailyCost.toFixed(2)}`,
        timestamp: new Date(),
        metadata: { event }
      });
    } else if (dailyCost >= this.COST_LIMITS.DAILY_WARNING) {
      await this.createCostAlert({
        type: 'daily_limit',
        severity: 'medium',
        workspaceId: event.workspaceId,
        currentValue: dailyCost,
        threshold: this.COST_LIMITS.DAILY_WARNING,
        message: `Custo diário alto: R$ ${dailyCost.toFixed(2)}`,
        timestamp: new Date(),
        metadata: { event }
      });
    }

    // Verificar projeção mensal
    const monthlyProjection = monthlyCost * (30 / new Date().getDate());
    if (monthlyProjection >= this.COST_LIMITS.MONTHLY_CRITICAL) {
      await this.createCostAlert({
        type: 'monthly_projection',
        severity: 'high',
        workspaceId: event.workspaceId,
        currentValue: monthlyProjection,
        threshold: this.COST_LIMITS.MONTHLY_CRITICAL,
        message: `Projeção mensal crítica: R$ ${monthlyProjection.toFixed(2)}`,
        timestamp: new Date(),
        metadata: { currentMonth: monthlyCost, event }
      });
    }

    // Verificar spike de uso
    const avgDailyCost = await this.getAvgDailyCostForWorkspace(event.workspaceId);
    if (avgDailyCost > 0 && dailyCost > avgDailyCost * this.COST_LIMITS.SPIKE_THRESHOLD) {
      await this.createCostAlert({
        type: 'unusual_spike',
        severity: 'medium',
        workspaceId: event.workspaceId,
        currentValue: dailyCost,
        threshold: avgDailyCost * this.COST_LIMITS.SPIKE_THRESHOLD,
        message: `Spike de custo detectado: ${(dailyCost / avgDailyCost).toFixed(1)}x acima da média`,
        timestamp: new Date(),
        metadata: { avgDailyCost, spike: dailyCost / avgDailyCost, event }
      });
    }
  }

  private async createCostAlert(alert: CostAlert): Promise<void> {
    try {
      await prisma.monitoringAlert.create({
        data: {
          type: alert.type,
          severity: alert.severity,
          workspaceId: alert.workspaceId,
          currentValue: alert.currentValue,
          threshold: alert.threshold,
          message: alert.message,
          metadata: alert.metadata as any,
          timestamp: alert.timestamp,
          status: 'ACTIVE'
        }
      });

      console.warn(`${ICONS.ALERT} Cost Alert [${alert.severity.toUpperCase()}]: ${alert.message}`);

      // Adicionar ao buffer para notificações
      this.alertsBuffer.push(alert);

    } catch (error) {
      console.error(`${ICONS.ERROR} Failed to create cost alert:`, error);
    }
  }

  // ================================================================
  // FUNÇÕES AUXILIARES
  // ================================================================

  private async updateCostTracking(workspaceId: string, cost: number): Promise<void> {
    const key = `${workspaceId}:${this.getDateKey()}`;
    const current = this.costAccumulator.get(key) || 0;
    this.costAccumulator.set(key, current + cost);
  }

  private getCurrentCostBurn(workspaceId?: string): number {
    const today = this.getDateKey();

    if (workspaceId) {
      return this.costAccumulator.get(`${workspaceId}:${today}`) || 0;
    }

    // Somar todos os workspaces para hoje
    let total = 0;
    for (const [key, cost] of this.costAccumulator.entries()) {
      if (key.endsWith(`:${today}`)) {
        total += cost;
      }
    }
    return total;
  }

  private getDateKey(date = new Date()): string {
    return date.toISOString().split('T')[0];
  }

  private async getDailyCostForWorkspace(workspaceId: string): Promise<number> {
    const today = this.getDateKey();

    const result = await prisma.monitoringCosts.aggregate({
      where: {
        workspaceId,
        timestamp: {
          gte: new Date(today + 'T00:00:00.000Z'),
          lt: new Date(today + 'T23:59:59.999Z')
        }
      },
      _sum: { cost: true }
    });

    return result._sum.cost || 0;
  }

  private async getMonthlyCostForWorkspace(workspaceId: string): Promise<number> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const result = await prisma.monitoringCosts.aggregate({
      where: {
        workspaceId,
        timestamp: {
          gte: startOfMonth,
          lt: now
        }
      },
      _sum: { cost: true }
    });

    return result._sum.cost || 0;
  }

  private async getAvgDailyCostForWorkspace(workspaceId: string): Promise<number> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const result = await prisma.monitoringCosts.aggregate({
      where: {
        workspaceId,
        timestamp: { gte: thirtyDaysAgo }
      },
      _sum: { cost: true }
    });

    return (result._sum.cost || 0) / 30;
  }

  private async getProcessesMonitoredCount(workspaceId?: string): Promise<number> {
    const whereClause = workspaceId ? { workspaceId } : {};

    return await prisma.monitoredProcess.count({
      where: {
        ...whereClause,
        monitoringStatus: 'ACTIVE'
      }
    });
  }

  private async getRateLimitStatus(): Promise<number> {
    // TODO: Integrar com rate limiter do Judit client
    return 80; // Porcentagem de uso do rate limit
  }

  private async getCircuitBreakerStatus(): Promise<'closed' | 'open' | 'half-open'> {
    // TODO: Integrar com circuit breaker do Judit client
    return 'closed';
  }

  private async getLastError(workspaceId?: string): Promise<string | undefined> {
    const whereClause = workspaceId ? { workspaceId } : {};

    const lastError = await prisma.monitoringTelemetry.findFirst({
      where: {
        ...whereClause,
        success: false,
        error: { not: null }
      },
      orderBy: { timestamp: 'desc' }
    });

    return lastError?.error || undefined;
  }

  private async getWorkspaceStats(): Promise<Record<string, any>> {
    // TODO: Implementar estatísticas detalhadas por workspace
    return {};
  }

  private calculateTrackingEfficiency(trackingStats: any[], webhookCount: number): any {
    const trackingCalls = trackingStats.find(s => s.source === 'tracking')?._count.id || 0;
    const pollingCalls = trackingStats.find(s => s.source === 'polling')?._count.id || 0;

    const trackingCost = trackingStats.find(s => s.source === 'tracking')?._sum.cost || 0;
    const pollingCost = trackingStats.find(s => s.source === 'polling')?._sum.cost || 0;

    return {
      trackingRatio: trackingCalls / (trackingCalls + pollingCalls),
      costSavings: pollingCost - trackingCost,
      webhookEfficiency: webhookCount / Math.max(trackingCalls, 1),
      recommendation: trackingCalls > pollingCalls ? 'Ótima eficiência' : 'Considere mais tracking'
    };
  }

  // ================================================================
  // API PÚBLICA
  // ================================================================

  async getActiveAlerts(workspaceId?: string): Promise<CostAlert[]> {
    const whereClause = workspaceId ? { workspaceId } : {};

    const alerts = await prisma.monitoringAlert.findMany({
      where: {
        ...whereClause,
        status: 'ACTIVE',
        timestamp: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Últimas 24h
        }
      },
      orderBy: { timestamp: 'desc' }
    });

    return alerts.map(alert => ({
      type: alert.type as any,
      severity: alert.severity as any,
      workspaceId: alert.workspaceId || undefined,
      currentValue: alert.currentValue,
      threshold: alert.threshold,
      message: alert.message,
      timestamp: alert.timestamp,
      metadata: alert.metadata as any
    }));
  }

  async markAlertAsRead(alertId: string): Promise<void> {
    await prisma.monitoringAlert.update({
      where: { id: alertId },
      data: { status: 'READ' }
    });
  }

  flushAlertsBuffer(): CostAlert[] {
    const alerts = [...this.alertsBuffer];
    this.alertsBuffer = [];
    return alerts;
  }
}

// ================================================================
// INSTÂNCIA SINGLETON
// ================================================================

export const telemetry = MonitoringTelemetry.getInstance();