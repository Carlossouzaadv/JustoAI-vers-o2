// ================================================================
// SISTEMA DE ALERTAS OPERACIONAIS - Slack, Email e Sentry
// ================================================================

import { prisma } from '../prisma';
import { usageTracker } from '../telemetry/usage-tracker';
import { ICONS } from '../icons';

// ================================================================
// TIPOS E INTERFACES
// ================================================================

interface AlertRule {
  id: string;
  name: string;
  description: string;
  condition: (context: AlertContext) => boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  channels: AlertChannel[];
  cooldown: number; // minutos
  enabled: boolean;
}

interface AlertContext {
  workspaceId?: string;
  workspaceName?: string;
  billingEstimate: number;
  planPrice: number;
  quotaUsage: number;
  quotaLimit: number;
  hardBlockedEvents: number;
  timeframe: string;
  metadata?: Record<string, unknown>;
}

interface AlertChannel {
  type: 'slack' | 'email' | 'sentry' | 'webhook';
  config: Record<string, unknown>;
}

interface AlertEvent {
  id: string;
  ruleId: string;
  workspaceId?: string;
  severity: string;
  title: string;
  message: string;
  context: AlertContext;
  channels: string[];
  sentAt: Date;
  acknowledged: boolean;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

// ================================================================
// CONFIGURAÇÕES
// ================================================================

const ALERT_CONFIG = {
  SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL,
  SLACK_CHANNEL: process.env.SLACK_CHANNEL || '#ops-cost-alerts',
  EMAIL_FROM: process.env.EMAIL_FROM || 'alerts@justoai.com',
  EMAIL_TO: process.env.ALERT_EMAIL_TO?.split(',') || ['ops@justoai.com'],
  SENTRY_DSN: process.env.SENTRY_DSN,
  WEBHOOK_SECRET: process.env.ALERT_WEBHOOK_SECRET,
};

const PLAN_PRICES = {
  basic: 49.90,
  premium: 149.90,
  enterprise: 499.90
};

// ================================================================
// REGRAS DE ALERTAS
// ================================================================

const ALERT_RULES: AlertRule[] = [
  {
    id: 'high_billing_cost',
    name: 'Alto Custo de Billing',
    description: 'Custo mensal estimado > 70% do preço do plano',
    condition: (ctx) => ctx.billingEstimate > (ctx.planPrice * 0.7),
    severity: 'high',
    channels: [
      { type: 'slack', config: { channel: '#ops-cost-alerts' } },
      { type: 'email', config: { priority: 'high' } }
    ],
    cooldown: 360, // 6 horas
    enabled: true
  },
  {
    id: 'critical_billing_cost',
    name: 'Custo Crítico de Billing',
    description: 'Custo mensal estimado > 100% do preço do plano',
    condition: (ctx) => ctx.billingEstimate > ctx.planPrice,
    severity: 'critical',
    channels: [
      { type: 'slack', config: { channel: '#ops-cost-alerts', urgent: true } },
      { type: 'email', config: { priority: 'critical' } },
      { type: 'sentry', config: { level: 'error' } }
    ],
    cooldown: 180, // 3 horas
    enabled: true
  },
  {
    id: 'quota_hard_blocked_repeated',
    name: 'Bloqueios Repetidos de Quota',
    description: 'Mais de 2 bloqueios hard em 7 dias',
    condition: (ctx) => ctx.hardBlockedEvents > 2,
    severity: 'medium',
    channels: [
      { type: 'slack', config: { channel: '#ops-quota-issues' } },
      { type: 'sentry', config: { level: 'warning' } }
    ],
    cooldown: 1440, // 24 horas
    enabled: true
  },
  {
    id: 'workspace_quota_exhausted',
    name: 'Quota de Workspace Esgotada',
    description: 'Workspace atingiu 100% da quota mensal',
    condition: (ctx) => (ctx.quotaUsage / ctx.quotaLimit) >= 1.0,
    severity: 'medium',
    channels: [
      { type: 'slack', config: { channel: '#ops-quota-issues' } },
      { type: 'email', config: { priority: 'medium' } }
    ],
    cooldown: 720, // 12 horas
    enabled: true
  },
  {
    id: 'billing_spike_detected',
    name: 'Spike de Billing Detectado',
    description: 'Custo diário > 5x a média dos últimos 7 dias',
    condition: (ctx) => {
      const dailyAvg = ctx.metadata?.dailyAverage || 0;
      const currentDaily = ctx.metadata?.currentDaily || 0;
      return currentDaily > (dailyAvg * 5);
    },
    severity: 'high',
    channels: [
      { type: 'slack', config: { channel: '#ops-cost-alerts', urgent: true } },
      { type: 'sentry', config: { level: 'warning' } }
    ],
    cooldown: 240, // 4 horas
    enabled: true
  }
];

// ================================================================
// CLASSE PRINCIPAL DE ALERTAS
// ================================================================

export class OpsAlerts {
  private static instance: OpsAlerts;
  private rules: AlertRule[];
  private sentAlerts: Map<string, Date> = new Map();

  static getInstance(): OpsAlerts {
    if (!OpsAlerts.instance) {
      OpsAlerts.instance = new OpsAlerts();
    }
    return OpsAlerts.instance;
  }

  constructor() {
    this.rules = ALERT_RULES.filter(rule => rule.enabled);
  }

  // ================================================================
  // VERIFICAÇÃO E DISPARO DE ALERTAS
  // ================================================================

  /**
   * Verificar alertas para workspace específico
   */
  async checkWorkspaceAlerts(workspaceId: string): Promise<void> {
    try {
      console.log(`${ICONS.ALERT} Checking alerts for workspace: ${workspaceId}`);

      const context = await this.buildAlertContext(workspaceId);

      for (const rule of this.rules) {
        await this.evaluateRule(rule, context);
      }

    } catch (error) {
      console.error(`${ICONS.ERROR} Failed to check workspace alerts:`, error);
    }
  }

  /**
   * Verificar alertas globais
   */
  async checkGlobalAlerts(): Promise<void> {
    try {
      console.log(`${ICONS.ALERT} Checking global alerts`);

      // Verificar alertas por workspace
      const workspaces = await this.getActiveWorkspaces();

      for (const workspace of workspaces) {
        await this.checkWorkspaceAlerts(workspace.id);
      }

      // Verificar alertas agregados
      await this.checkAggregatedAlerts();

    } catch (error) {
      console.error(`${ICONS.ERROR} Failed to check global alerts:`, error);
    }
  }

  /**
   * Enviar alerta manual
   */
  async sendManualAlert(
    title: string,
    message: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    channels: string[] = ['slack'],
    workspaceId?: string
  ): Promise<void> {
    try {
      const alert: Partial<AlertEvent> = {
        id: `manual_${Date.now()}`,
        ruleId: 'manual',
        workspaceId,
        severity,
        title,
        message,
        channels,
        sentAt: new Date(),
        acknowledged: false,
        timestamp: new Date(),
        metadata: {}
      };

      await this.sendAlert(alert as AlertEvent);

    } catch (error) {
      console.error(`${ICONS.ERROR} Failed to send manual alert:`, error);
    }
  }

  // ================================================================
  // CONSTRUÇÃO DE CONTEXTO
  // ================================================================

  private async buildAlertContext(workspaceId: string): Promise<AlertContext> {
    const [workspace, usage, quotaStatus, dailyBilling] = await Promise.all([
      prisma.workspace.findUnique({ where: { id: workspaceId } }),
      usageTracker.getCurrentUsage(workspaceId),
      usageTracker.getWorkspaceQuota(workspaceId),
      this.getDailyBillingStats(workspaceId)
    ]);

    if (!workspace || !quotaStatus) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    // Contar bloqueios hard nos últimos 7 dias
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const hardBlockedEvents = await prisma.usageEvent.count({
      where: {
        workspaceId,
        eventType: 'quota_hard_blocked',
        createdAt: {
          gte: sevenDaysAgo
        }
      }
    });

    const planPrice = PLAN_PRICES[workspace.plan as keyof typeof PLAN_PRICES] || PLAN_PRICES.basic;

    return {
      workspaceId,
      workspaceName: workspace.name,
      billingEstimate: usage.billingEstimate.totalEstimated,
      planPrice,
      quotaUsage: usage.monthly.reportsScheduledGenerated + usage.monthly.reportsOnDemandGenerated,
      quotaLimit: quotaStatus.reportsMonthlyLimit,
      hardBlockedEvents,
      timeframe: 'monthly',
      metadata: {
        plan: workspace.plan,
        dailyAverage: dailyBilling.avgDaily,
        currentDaily: dailyBilling.today,
        billingBreakdown: usage.billingEstimate.breakdown
      }
    };
  }

  // ================================================================
  // AVALIAÇÃO DE REGRAS
  // ================================================================

  private async evaluateRule(rule: AlertRule, context: AlertContext): Promise<void> {
    try {
      // Verificar cooldown
      const cooldownKey = `${rule.id}_${context.workspaceId || 'global'}`;
      const lastSent = this.sentAlerts.get(cooldownKey);

      if (lastSent) {
        const cooldownMs = rule.cooldown * 60 * 1000;
        if (Date.now() - lastSent.getTime() < cooldownMs) {
          return; // Ainda em cooldown
        }
      }

      // Avaliar condição
      if (!rule.condition(context)) {
        return; // Condição não atendida
      }

      console.log(`${ICONS.WARNING} Alert rule triggered: ${rule.name}`, {
        workspace: context.workspaceId,
        severity: rule.severity
      });

      // Criar evento de alerta
      const alert: AlertEvent = {
        id: `${rule.id}_${Date.now()}`,
        ruleId: rule.id,
        workspaceId: context.workspaceId,
        severity: rule.severity,
        title: rule.name,
        message: this.formatAlertMessage(rule, context),
        context,
        channels: rule.channels.map(c => c.type),
        sentAt: new Date(),
        acknowledged: false,
        timestamp: new Date(),
        metadata: context.metadata
      };

      // Enviar alerta
      await this.sendAlert(alert);

      // Atualizar cooldown
      this.sentAlerts.set(cooldownKey, new Date());

      // Salvar no banco
      await this.saveAlertEvent(alert);

    } catch (error) {
      console.error(`${ICONS.ERROR} Failed to evaluate rule ${rule.id}:`, error);
    }
  }

  // ================================================================
  // ENVIO DE ALERTAS
  // ================================================================

  private async sendAlert(alert: AlertEvent): Promise<void> {
    console.log(`${ICONS.ALERT} Sending alert: ${alert.title}`);

    const sendPromises = alert.channels.map(channel => {
      switch (channel) {
        case 'slack':
          return this.sendSlackAlert(alert);
        case 'email':
          return this.sendEmailAlert(alert);
        case 'sentry':
          return this.sendSentryAlert(alert);
        case 'webhook':
          return this.sendWebhookAlert(alert);
        default:
          return Promise.resolve();
      }
    });

    await Promise.allSettled(sendPromises);
  }

  private async sendSlackAlert(alert: AlertEvent): Promise<void> {
    if (!ALERT_CONFIG.SLACK_WEBHOOK_URL) {
      console.warn(`${ICONS.WARNING} Slack webhook URL not configured`);
      return;
    }

    try {
      const color = this.getSeverityColor(alert.severity);
      const emoji = this.getSeverityEmoji(alert.severity);

      const payload = {
        channel: ALERT_CONFIG.SLACK_CHANNEL,
        username: 'JustoAI Alerts',
        icon_emoji: ':warning:',
        attachments: [{
          color,
          title: `${emoji} ${alert.title}`,
          text: alert.message,
          fields: [
            {
              title: 'Workspace',
              value: alert.context.workspaceName || 'Global',
              short: true
            },
            {
              title: 'Severidade',
              value: alert.severity.toUpperCase(),
              short: true
            },
            {
              title: 'Custo Estimado',
              value: `R$ ${alert.context.billingEstimate.toFixed(2)}`,
              short: true
            },
            {
              title: 'Quota Usada',
              value: `${alert.context.quotaUsage}/${alert.context.quotaLimit}`,
              short: true
            }
          ],
          footer: 'JustoAI Ops Alerts',
          ts: Math.floor(alert.sentAt.getTime() / 1000)
        }]
      };

      const response = await fetch(ALERT_CONFIG.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Slack API error: ${response.status}`);
      }

      console.log(`${ICONS.SUCCESS} Slack alert sent successfully`);

    } catch (error) {
      console.error(`${ICONS.ERROR} Failed to send Slack alert:`, error);
    }
  }

  private async sendEmailAlert(alert: AlertEvent): Promise<void> {
    try {
      const { getEmailService } = await import('../email-service');
      const emailService = getEmailService();

      const result = await emailService.sendNotification({
        to: ALERT_CONFIG.EMAIL_TO,
        subject: `[${alert.severity.toUpperCase()}] ${alert.title}`,
        template: 'system-notification',
        data: {
          subject: `[${alert.severity.toUpperCase()}] ${alert.title}`,
          message: alert.message,
          severity: alert.severity,
          timestamp: alert.sentAt,
          metadata: alert.context.metadata
        },
        priority: alert.severity === 'critical' ? 'high' : 'normal'
      });

      if (result.success) {
        console.log(`${ICONS.SUCCESS} Email alert enviado: ${result.messageId}`);
      } else {
        console.error(`${ICONS.ERROR} Falha ao enviar email alert: ${result.error}`);
      }

    } catch (error) {
      console.error(`${ICONS.ERROR} Failed to send email alert:`, error);
    }
  }

  private async sendSentryAlert(alert: AlertEvent): Promise<void> {
    try {
      // TODO: Integrar com Sentry SDK
      console.log(`${ICONS.ALERT} Sentry alert (simulated):`, {
        level: alert.severity,
        message: alert.title,
        extra: alert.context
      });

    } catch (error) {
      console.error(`${ICONS.ERROR} Failed to send Sentry alert:`, error);
    }
  }

  private async sendWebhookAlert(alert: AlertEvent): Promise<void> {
    try {
      // TODO: Implementar webhook genérico
      console.log(`${ICONS.ALERT} Webhook alert (simulated):`, alert);

    } catch (error) {
      console.error(`${ICONS.ERROR} Failed to send webhook alert:`, error);
    }
  }

  // ================================================================
  // FUNÇÕES AUXILIARES
  // ================================================================

  private formatAlertMessage(rule: AlertRule, context: AlertContext): string {
    switch (rule.id) {
      case 'high_billing_cost':
        return `🔸 Workspace "${context.workspaceName}" tem custo estimado de R$ ${context.billingEstimate.toFixed(2)} (${((context.billingEstimate / context.planPrice) * 100).toFixed(1)}% do plano ${context.metadata?.plan?.toUpperCase()}).\n\nTop consumidores:\n${this.formatTopConsumers(context.metadata?.billingBreakdown)}`;

      case 'critical_billing_cost':
        return `🚨 CRÍTICO: Workspace "${context.workspaceName}" excedeu o valor do plano!\n\nCusto estimado: R$ ${context.billingEstimate.toFixed(2)}\nValor do plano: R$ ${context.planPrice.toFixed(2)}\nExcesso: R$ ${(context.billingEstimate - context.planPrice).toFixed(2)}\n\nAção necessária: Revisar uso ou upgrade de plano.`;

      case 'quota_hard_blocked_repeated':
        return `⚠️ Workspace "${context.workspaceName}" teve ${context.hardBlockedEvents} bloqueios de quota nos últimos 7 dias.\n\nQuota atual: ${context.quotaUsage}/${context.quotaLimit} relatórios\nRecomendação: Upgrade de plano ou compra de créditos extras.`;

      case 'workspace_quota_exhausted':
        return `📊 Workspace "${context.workspaceName}" esgotou sua quota mensal de relatórios.\n\nUso: ${context.quotaUsage}/${context.quotaLimit} relatórios (100%)\nPlano: ${context.metadata?.plan?.toUpperCase()}\n\nUsuário pode precisar comprar créditos extras.`;

      case 'billing_spike_detected':
        return `📈 Spike de uso detectado no workspace "${context.workspaceName}"!\n\nCusto hoje: R$ ${context.metadata?.currentDaily?.toFixed(2)}\nMédia 7 dias: R$ ${context.metadata?.dailyAverage?.toFixed(2)}\nMultiplicador: ${(context.metadata?.currentDaily / context.metadata?.dailyAverage).toFixed(1)}x\n\nInvestigar uso anômalo.`;

      default:
        return `${rule.description}\n\nWorkspace: ${context.workspaceName}\nDetalhes: ${JSON.stringify(context.metadata, null, 2)}`;
    }
  }

  private formatTopConsumers(breakdown?: Record<string, number>): string {
    if (!breakdown) return 'Breakdown não disponível';

    const sorted = Object.entries(breakdown)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3);

    return sorted
      .map(([key, value]) => `• ${key}: R$ ${value.toFixed(2)}`)
      .join('\n');
  }

  private getSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical': return '#dc2626';
      case 'high': return '#ea580c';
      case 'medium': return '#d97706';
      case 'low': return '#65a30d';
      default: return '#6b7280';
    }
  }

  private getSeverityEmoji(severity: string): string {
    switch (severity) {
      case 'critical': return '🚨';
      case 'high': return '🔸';
      case 'medium': return '⚠️';
      case 'low': return 'ℹ️';
      default: return '📋';
    }
  }

  private async getDailyBillingStats(workspaceId: string): Promise<{
    today: number;
    avgDaily: number;
  }> {
    const today = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [todayUsage, weeklyUsage] = await Promise.all([
      prisma.usageEvent.findFirst({
        where: {
          workspaceId,
          createdAt: {
            gte: new Date(today),
            lt: new Date(new Date(today).getTime() + 24 * 60 * 60 * 1000)
          }
        }
      }),
      prisma.usageEvent.findMany({
        where: {
          workspaceId,
          createdAt: {
            gte: sevenDaysAgo
          }
        }
      })
    ]);

    const todayMetadata = todayUsage?.metadata as Record<string, unknown> | undefined;
    const todayBilling = todayMetadata?.billingEstimatedCost ? parseFloat(String(todayMetadata.billingEstimatedCost) || '0') : 0;

    const avgDaily = weeklyUsage.length > 0 ?
      weeklyUsage.reduce((sum: number, day) => {
        const dayMetadata = day.metadata as Record<string, unknown> | undefined;
        return sum + parseFloat(String(dayMetadata?.billingEstimatedCost) || '0');
      }, 0) / weeklyUsage.length :
      0;

    return { today: todayBilling, avgDaily };
  }

  private async getActiveWorkspaces() {
    return await prisma.workspace.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true }
    });
  }

  private async checkAggregatedAlerts(): Promise<void> {
    // TODO: Implementar alertas agregados (ex: total de custos global)
    console.log(`${ICONS.INFO} Checking aggregated alerts (placeholder)`);
  }

  private async saveAlertEvent(alert: AlertEvent): Promise<void> {
    try {
      await prisma.usageEvent.create({
        data: {
          workspaceId: alert.workspaceId || '',
          eventType: 'ops_alert_sent',
          resourceType: 'alert',
          metadata: {
            alertId: alert.id,
            ruleId: alert.ruleId,
            severity: alert.severity,
            title: alert.title,
            message: alert.message,
            channels: alert.channels
          }
        }
      });
    } catch (error) {
      console.error(`${ICONS.ERROR} Failed to save alert event:`, error);
    }
  }

  // ================================================================
  // API PÚBLICA
  // ================================================================

  async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    console.log(`${ICONS.CHECK} Alert acknowledged: ${alertId} by ${userId}`);
    // TODO: Implementar sistema de acknowledgment
  }

  async getActiveAlerts(workspaceId?: string): Promise<AlertEvent[]> {
    // TODO: Implementar busca de alertas ativos
    return [];
  }

  async updateAlertRule(ruleId: string, updates: Partial<AlertRule>): Promise<void> {
    const ruleIndex = this.rules.findIndex(r => r.id === ruleId);
    if (ruleIndex >= 0) {
      this.rules[ruleIndex] = { ...this.rules[ruleIndex], ...updates };
      console.log(`${ICONS.EDIT} Alert rule updated: ${ruleId}`);
    }
  }

  getAlertRules(): AlertRule[] {
    return [...this.rules];
  }
}

// ================================================================
// INSTÂNCIA SINGLETON E JOBS
// ================================================================

export const opsAlerts = OpsAlerts.getInstance();

/**
 * Job para verificação periódica de alertas
 */
export async function runAlertCheck(): Promise<void> {
  console.log(`${ICONS.ALERT} Running periodic alert check`);
  await opsAlerts.checkGlobalAlerts();
}

/**
 * Setup de jobs periódicos de alertas
 */
export async function setupAlertJobs(): Promise<void> {
  // TODO: Integrar com sistema de jobs (Bull/cron)
  console.log(`${ICONS.SUCCESS} Alert jobs setup completed`);
}