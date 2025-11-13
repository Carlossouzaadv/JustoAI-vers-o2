// ================================================================
// SISTEMA DE TELEMETRIA E TRACKING DE CUSTOS - Monitoramento Judit
// ================================================================
// NOTA: Funcionalidade desabilitada temporariamente devido a incompatibilidades do modelo Prisma

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
  metadata: Record<string, unknown>;
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
  metadata: Record<string, unknown>;
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
  metadata: Record<string, unknown>;
}

// ================================================================
// CLASSE PRINCIPAL DE TELEMETRIA (DESABILITADA)
// ================================================================

export class MonitoringTelemetry {
  private static instance: MonitoringTelemetry;
  private metricsCache: Map<string, unknown> = new Map();
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
  // RECORDING DE EVENTOS (DESABILITADO)
  // ================================================================

  async recordTelemetryEvent(event: Omit<TelemetryEvent, 'timestamp'>): Promise<void> {
    // TODO: Implementar quando modelo de telemetria for criado
    console.log(`${ICONS.TELEMETRY} Telemetry disabled - would record:`, {
      type: event.type,
      source: event.source,
      workspace: event.workspaceId,
      process: event.processNumber,
      cost: event.cost,
      success: event.success,
      duration: event.duration
    });
  }

  async recordCostEvent(cost: Omit<CostTracking, 'timestamp'>): Promise<void> {
    // TODO: Implementar quando modelo de custo for criado
    console.log(`${ICONS.COST} Cost tracking disabled - would record:`, {
      workspaceId: cost.workspaceId,
      service: cost.service,
      operation: cost.operation,
      cost: cost.cost,
      currency: cost.currency
    });
  }

  // ================================================================
  // MÉTRICAS E ESTATÍSTICAS (SIMULADAS)
  // ================================================================

  async getMonitoringMetrics(workspaceId?: string): Promise<MonitoringMetrics> {
    console.log(`${ICONS.INFO} Metrics disabled - returning mock data for workspace:`, workspaceId);

    const today = new Date().toISOString().split('T')[0];

    return {
      daily: {
        date: today,
        totalApiCalls: 0,
        totalWebhooks: 0,
        totalCost: 0,
        successRate: 100,
        avgResponseTime: 0,
        processesMonitored: await this.getProcessesMonitoredCount(workspaceId),
        trackingsActive: 0,
        errorsCount: 0
      },
      realTime: {
        activeTrackings: 0,
        pendingWebhooks: 0,
        rateLimitStatus: 80,
        circuitBreakerStatus: 'closed',
        currentCostBurn: 0,
        lastError: undefined
      },
      workspace: {}
    };
  }

  async getDailyCostSummary(workspaceId?: string, _days = 30): Promise<unknown[]> {
    console.log(`${ICONS.COST} Cost summary disabled - would query for workspace:`, workspaceId);
    return [];
  }

  async getTrackingEfficiencyReport(workspaceId?: string): Promise<unknown> {
    console.log(`${ICONS.INFO} Efficiency report disabled - would query for workspace:`, workspaceId);
    return {
      trackingStats: [],
      webhookCount: 0,
      efficiency: {
        trackingRatio: 0,
        costSavings: 0,
        webhookEfficiency: 0,
        recommendation: 'Sistema desabilitado'
      }
    };
  }

  // ================================================================
  // FUNÇÕES AUXILIARES
  // ================================================================

  private async getProcessesMonitoredCount(workspaceId?: string): Promise<number> {
    try {
      const whereClause = workspaceId ? { workspaceId } : {};

      return await prisma.monitoredProcess.count({
        where: {
          ...whereClause,
          monitoringStatus: 'ACTIVE'
        }
      });
    } catch (error) {
      console.error(`${ICONS.ERROR} Failed to get monitored processes count:`, error);
      return 0;
    }
  }

  // ================================================================
  // API PÚBLICA (DESABILITADA)
  // ================================================================

  async getActiveAlerts(workspaceId?: string): Promise<CostAlert[]> {
    console.log(`${ICONS.ALERT} Alerts disabled - would query for workspace:`, workspaceId);
    return [];
  }

  async markAlertAsRead(alertId: string): Promise<void> {
    console.log(`${ICONS.INFO} Alert marking disabled - would mark as read:`, alertId);
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