/**
 * Slack Service - Webhook Integration for JustoAI Alerts
 * Sends critical alerts and notifications to Slack
 */

import { ICONS } from './icons';

export interface SlackMessage {
  channel?: string;
  text: string;
  blocks?: unknown[];
}

export interface SlackAlertOptions {
  title: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  details?: Record<string, string>;
  actions?: Array<{ text: string; url: string }>;
}

export interface SlackResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Slack Service using Webhooks
 * Sends alerts and notifications to Slack channels
 */
export class SlackService {
  private readonly webhookUrl: string;

  constructor() {
    this.webhookUrl = process.env.SLACK_WEBHOOK_URL || '';

    if (!this.webhookUrl) {
      console.warn(`${ICONS.WARNING} Slack webhook URL not configured - alerts will be simulated`);
    }
  }

  /**
   * Send alert to Slack
   */
  async sendAlert(options: SlackAlertOptions): Promise<SlackResult> {
    console.log(`${ICONS.ALERT} Enviando alerta para Slack: ${options.title}`);

    if (!this.webhookUrl) {
      console.log(`${ICONS.WARNING} Simulando envio para Slack (webhook URL não configurada)`);
      return { success: true, messageId: 'simulated-' + Date.now() };
    }

    try {
      const severity = this.getSeverityEmoji(options.severity);
      const color = this.getSeverityColor(options.severity);

      const blocks = this.buildSlackBlocks(severity, options);

      const payload = {
        blocks,
        text: `${severity} ${options.title}`
      };

      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Slack API error: ${response.statusText} - ${errorText}`);
      }

      console.log(`${ICONS.SUCCESS} Alerta enviado para Slack`);
      return {
        success: true,
        messageId: Date.now().toString()
      };

    } catch (error) {
      console.error(`${ICONS.ERROR} Erro ao enviar alerta para Slack:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Send critical error alert
   */
  async sendCriticalAlert(
    title: string,
    description: string,
    error?: Error,
    context?: Record<string, unknown>
  ): Promise<SlackResult> {
    return this.sendAlert({
      title,
      description,
      severity: 'critical',
      details: {
        'Erro': error?.message || 'N/A',
        'Stack': error?.stack?.split('\n')[0] || 'N/A',
        'Timestamp': new Date().toISOString(),
        ...(context || {})
      }
    });
  }

  /**
   * Send job success notification
   */
  async sendJobSuccess(
    jobName: string,
    results?: Record<string, unknown>
  ): Promise<SlackResult> {
    return this.sendAlert({
      title: `✅ Job Completado: ${jobName}`,
      description: `Job '${jobName}' foi executado com sucesso`,
      severity: 'info',
      details: {
        'Timestamp': new Date().toISOString(),
        ...(results || {})
      }
    });
  }

  /**
   * Send job failure alert
   */
  async sendJobFailure(
    jobName: string,
    error: Error,
    results?: Record<string, unknown>
  ): Promise<SlackResult> {
    return this.sendCriticalAlert(
      `❌ Job Falhou: ${jobName}`,
      `Job '${jobName}' falhou durante execução`,
      error,
      {
        'Timestamp': new Date().toISOString(),
        ...(results || {})
      }
    );
  }

  /**
   * Send process alert
   */
  async sendProcessAlert(
    processNumber: string,
    alertType: string,
    description: string,
    urgency: 'high' | 'medium' | 'low' = 'medium'
  ): Promise<SlackResult> {
    const severityMap = {
      'high': 'critical' as const,
      'medium': 'warning' as const,
      'low': 'info' as const
    };

    return this.sendAlert({
      title: `Alerta de Processo: ${processNumber}`,
      description,
      severity: severityMap[urgency],
      details: {
        'Processo': processNumber,
        'Tipo': alertType,
        'Urgência': urgency.toUpperCase(),
        'Timestamp': new Date().toISOString()
      }
    });
  }

  /**
   * Send daily check summary
   */
  async sendDailyCheckSummary(
    total: number,
    successful: number,
    failed: number,
    withNewMovements: number,
    duration: number
  ): Promise<SlackResult> {
    const successRate = ((successful / total) * 100).toFixed(2);

    return this.sendAlert({
      title: '📊 Daily JUDIT Check Summary',
      description: `Daily JUDIT check foi executado com sucesso`,
      severity: failed > 0 ? 'warning' : 'info',
      details: {
        'Total de Processos': total.toString(),
        'Bem-sucedidos': successful.toString(),
        'Falhados': failed.toString(),
        'Taxa de Sucesso': `${successRate}%`,
        'Com Novas Movimentações': withNewMovements.toString(),
        'Duração': `${(duration / 60000).toFixed(2)} minutos`
      }
    });
  }

  /**
   * Build Slack block format
   */
  private buildSlackBlocks(severity: string, options: SlackAlertOptions): unknown[] {
    const color = this.getSeverityColor(options.severity);
    const blocks: unknown[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${severity} ${options.title}`,
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${options.description}`
        }
      }
    ];

    // Add details if provided
    if (options.details && Object.keys(options.details).length > 0) {
      const detailsText = Object.entries(options.details)
        .map(([key, value]) => `*${key}:* ${value}`)
        .join('\n');

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: detailsText
        }
      });
    }

    // Add actions if provided
    if (options.actions && options.actions.length > 0) {
      const elements = options.actions.map(action => ({
        type: 'button',
        text: {
          type: 'plain_text',
          text: action.text,
          emoji: true
        },
        url: action.url
      }));

      blocks.push({
        type: 'actions',
        elements
      });
    }

    // Add divider and footer
    blocks.push({
      type: 'divider'
    });

    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `_JustoAI Alert System • ${new Date().toISOString()}_`
        }
      ]
    });

    return blocks;
  }

  private getSeverityEmoji(severity: string): string {
    switch (severity) {
      case 'critical': return '🔴';
      case 'warning': return '🟡';
      case 'info': return '🟢';
      default: return '❓';
    }
  }

  private getSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical': return 'danger';
      case 'warning': return 'warning';
      case 'info': return 'good';
      default: return '#808080';
    }
  }

  /**
   * Test Slack connectivity
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.webhookUrl) {
      return { success: false, error: 'Webhook URL not configured' };
    }

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: '🧪 JustoAI Slack Integration Test - Connection Successful'
        })
      });

      return { success: response.ok };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

/**
 * Singleton instance
 */
let slackServiceInstance: SlackService | null = null;

export function getSlackService(): SlackService {
  if (!slackServiceInstance) {
    slackServiceInstance = new SlackService();
  }
  return slackServiceInstance;
}

/**
 * Quick helper functions
 */
export const sendSlackAlert = (
  title: string,
  description: string,
  severity: 'critical' | 'warning' | 'info' = 'warning',
  details?: Record<string, string>
) =>
  getSlackService().sendAlert({
    title,
    description,
    severity,
    details
  });

export const sendSlackCriticalAlert = (
  title: string,
  description: string,
  error?: Error,
  context?: Record<string, unknown>
) =>
  getSlackService().sendCriticalAlert(title, description, error, context);

export const sendSlackJobSuccess = (
  jobName: string,
  results?: Record<string, unknown>
) =>
  getSlackService().sendJobSuccess(jobName, results);

export const sendSlackJobFailure = (
  jobName: string,
  error: Error,
  results?: Record<string, unknown>
) =>
  getSlackService().sendJobFailure(jobName, error, results);
