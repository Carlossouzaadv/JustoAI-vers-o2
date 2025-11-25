/**
 * Notification Service - Centralized notification hub
 * Coordinates Email and Slack notifications for JustoAI
 */

import { getEmailService, EmailNotification, EmailResult } from './email-service';
import { getSlackService, SlackResult } from './slack-service';
import { ICONS } from './icons';

export interface NotificationOptions {
  email?: {
    enabled: boolean;
    recipients: string[];
    template: EmailNotification['template'];
    data?: unknown;
  };
  slack?: {
    enabled: boolean;
    title: string;
    description: string;
    severity: 'critical' | 'warning' | 'info';
    details?: Record<string, string>;
  };
}

export interface NotificationResult {
  success: boolean;
  email?: EmailResult;
  slack?: SlackResult;
  errors?: string[];
}

/**
 * Unified Notification Service
 * Sends notifications via email and/or Slack
 */
export class NotificationService {
  private emailService = getEmailService();
  private slackService = getSlackService();

  /**
   * Send unified notification to email and/or Slack
   */
  async sendNotification(options: NotificationOptions): Promise<NotificationResult> {
    const errors: string[] = [];
    let emailResult: EmailResult | undefined;
    let slackResult: SlackResult | undefined;
    let success = false;

    // Send email if enabled
    if (options.email?.enabled && options.email.recipients.length > 0) {
      try {
        emailResult = await this.emailService.sendNotification({
          to: options.email.recipients,
          subject: '', // Will be set by template
          template: options.email.template,
          data: options.email.data || {}
        });

        if (emailResult.success) {
          success = true;
        } else {
          errors.push(`Email failed: ${emailResult.error}`);
        }
      } catch (_error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Email error: ${errorMsg}`);
      }
    }

    // Send Slack if enabled
    if (options.slack?.enabled) {
      try {
        slackResult = await this.slackService.sendAlert({
          title: options.slack.title,
          description: options.slack.description,
          severity: options.slack.severity,
          details: options.slack.details
        });

        if (slackResult.success) {
          success = true;
        } else {
          errors.push(`Slack failed: ${slackResult.error}`);
        }
      } catch (_error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Slack error: ${errorMsg}`);
      }
    }

    return {
      success,
      email: emailResult,
      slack: slackResult,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Send critical system alert
   */
  async sendCriticalAlert(
    title: string,
    description: string,
    error?: Error,
    adminEmails?: string[]
  ): Promise<NotificationResult> {
    const errorDetails: Record<string, string> = {
      'Timestamp': new Date().toISOString(),
      'Severity': 'CRITICAL'
    };

    if (error) {
      errorDetails['Error Message'] = error.message;
      errorDetails['Stack Trace'] = error.stack?.split('\n')[0] || 'N/A';
    }

    return this.sendNotification({
      email: {
        enabled: process.env.ALERT_EMAIL_ENABLED !== 'false',
        recipients: adminEmails || this.getAdminEmails(),
        template: 'system-notification',
        data: {
          subject: `🔴 CRITICAL: ${title}`,
          html: `
            <div style="color: #d32f2f; background: #ffebee; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2>🔴 CRITICAL ALERT</h2>
              <p><strong>${title}</strong></p>
              <p>${description}</p>
              ${error ? `<pre style="background: white; padding: 10px; overflow-x: auto;">${error.message}</pre>` : ''}
            </div>
          `,
          message: `[CRITICAL] ${title}: ${description}`
        }
      },
      slack: {
        enabled: process.env.SLACK_WEBHOOK_URL ? true : false,
        title: `🔴 CRITICAL: ${title}`,
        description,
        severity: 'critical',
        details: errorDetails
      }
    });
  }

  /**
   * Send job success notification
   */
  async sendJobSuccess(
    jobName: string,
    results?: Record<string, unknown>,
    adminEmails?: string[]
  ): Promise<NotificationResult> {
    const resultDetails = results || {};

    return this.sendNotification({
      email: {
        enabled: process.env.ALERT_EMAIL_ENABLED !== 'false',
        recipients: adminEmails || this.getAdminEmails(),
        template: 'system-notification',
        data: {
          subject: `✅ Job Success: ${jobName}`,
          html: `
            <div style="color: #2e7d32; background: #e8f5e9; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2>✅ Job Completed Successfully</h2>
              <p><strong>${jobName}</strong></p>
              ${Object.entries(resultDetails).map(([key, value]) => `
                <p><strong>${key}:</strong> ${value}</p>
              `).join('')}
            </div>
          `,
          message: `Job '${jobName}' completed successfully`
        }
      },
      slack: {
        enabled: process.env.SLACK_WEBHOOK_URL ? true : false,
        title: `✅ Job Success: ${jobName}`,
        description: `Job '${jobName}' completed successfully`,
        severity: 'info',
        details: {
          'Timestamp': new Date().toISOString(),
          ...Object.fromEntries(
            Object.entries(resultDetails).map(([k, v]) => [k, String(v)])
          )
        }
      }
    });
  }

  /**
   * Send job failure alert
   */
  async sendJobFailure(
    jobName: string,
    error: Error,
    results?: Record<string, unknown>,
    adminEmails?: string[]
  ): Promise<NotificationResult> {
    return this.sendCriticalAlert(
      `Job Failed: ${jobName}`,
      `Job '${jobName}' failed during execution: ${error.message}`,
      error,
      adminEmails || this.getAdminEmails()
    );
  }

  /**
   * Send process alert via email and Slack
   */
  async sendProcessAlert(
    to: string | string[],
    processNumber: string,
    alertType: string,
    description: string,
    urgency: 'high' | 'medium' | 'low' = 'medium'
  ): Promise<NotificationResult> {
    const severityMap = {
      'high': 'critical' as const,
      'medium': 'warning' as const,
      'low': 'info' as const
    };

    return this.sendNotification({
      email: {
        enabled: process.env.ALERT_EMAIL_ENABLED !== 'false',
        recipients: Array.isArray(to) ? to : [to],
        template: 'process-alert',
        data: {
          processNumber,
          alertType,
          description,
          urgency,
          timestamp: new Date().toLocaleString('pt-BR')
        }
      },
      slack: {
        enabled: process.env.SLACK_WEBHOOK_URL ? true : false,
        title: `Alerta de Processo: ${processNumber}`,
        description,
        severity: severityMap[urgency],
        details: {
          'Processo': processNumber,
          'Tipo': alertType,
          'Urgência': urgency.toUpperCase(),
          'Timestamp': new Date().toISOString()
        }
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
    duration: number,
    adminEmails?: string[]
  ): Promise<NotificationResult> {
    const successRate = ((successful / total) * 100).toFixed(2);
    const hasErrors = failed > 0;
    const severity = hasErrors ? 'warning' : 'info';

    return this.sendNotification({
      email: {
        enabled: process.env.ALERT_EMAIL_ENABLED !== 'false',
        recipients: adminEmails || this.getAdminEmails(),
        template: 'system-notification',
        data: {
          subject: `📊 Daily JUDIT Check Summary`,
          html: `
            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2>📊 Daily JUDIT Check Summary</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr style="border-bottom: 1px solid #ddd;">
                  <td style="padding: 10px; font-weight: bold;">Total de Processos</td>
                  <td style="padding: 10px;">${total}</td>
                </tr>
                <tr style="border-bottom: 1px solid #ddd;">
                  <td style="padding: 10px; font-weight: bold;">Bem-sucedidos</td>
                  <td style="padding: 10px; color: green;">${successful}</td>
                </tr>
                <tr style="border-bottom: 1px solid #ddd;">
                  <td style="padding: 10px; font-weight: bold;">Falhados</td>
                  <td style="padding: 10px; color: ${hasErrors ? 'red' : 'green'};">${failed}</td>
                </tr>
                <tr style="border-bottom: 1px solid #ddd;">
                  <td style="padding: 10px; font-weight: bold;">Taxa de Sucesso</td>
                  <td style="padding: 10px;">${successRate}%</td>
                </tr>
                <tr style="border-bottom: 1px solid #ddd;">
                  <td style="padding: 10px; font-weight: bold;">Com Novas Movimentações</td>
                  <td style="padding: 10px;">${withNewMovements}</td>
                </tr>
                <tr>
                  <td style="padding: 10px; font-weight: bold;">Duração</td>
                  <td style="padding: 10px;">${(duration / 60000).toFixed(2)} minutos</td>
                </tr>
              </table>
            </div>
          `,
          message: `Daily check: ${successful}/${total} successful (${successRate}%)`
        }
      },
      slack: {
        enabled: process.env.SLACK_WEBHOOK_URL ? true : false,
        title: '📊 Daily JUDIT Check Summary',
        description: `Daily JUDIT check completed with ${successRate}% success rate`,
        severity,
        details: {
          'Total de Processos': total.toString(),
          'Bem-sucedidos': successful.toString(),
          'Falhados': failed.toString(),
          'Taxa de Sucesso': `${successRate}%`,
          'Com Novas Movimentações': withNewMovements.toString(),
          'Duração': `${(duration / 60000).toFixed(2)} minutos`
        }
      }
    });
  }

  /**
   * Get admin emails from environment or default
   */
  private getAdminEmails(): string[] {
    const adminEmails = process.env.ADMIN_EMAILS || '';
    return adminEmails
      .split(',')
      .map(email => email.trim())
      .filter(email => email.length > 0);
  }

  /**
   * Send report ready notification when report is generated
   */
  async sendReportReady(
    recipients: string[],
    reportName: string,
    downloadUrl: string,
    fileSize?: number,
    expiresAt?: Date
  ): Promise<NotificationResult> {
    const fileSize_MB = fileSize ? (fileSize / 1024 / 1024).toFixed(2) : 'N/A';
    const expirationText = expiresAt
      ? `Expira em: ${expiresAt.toLocaleString('pt-BR')}`
      : 'Link permanente';

    return this.sendNotification({
      email: {
        enabled: process.env.ALERT_EMAIL_ENABLED !== 'false',
        recipients,
        template: 'report-ready',
        data: {
          reportName,
          downloadUrl,
          fileSize: fileSize_MB,
          expiresAt: expirationText,
          generatedAt: new Date().toLocaleString('pt-BR'),
          timestamp: new Date().toISOString()
        }
      },
      slack: {
        enabled: process.env.SLACK_WEBHOOK_URL ? true : false,
        title: `✅ Relatório Pronto: ${reportName}`,
        description: `Seu relatório foi gerado com sucesso e está pronto para download`,
        severity: 'info',
        details: {
          'Relatório': reportName,
          'Tamanho': `${fileSize_MB} MB`,
          'Expiração': expirationText,
          'Timestamp': new Date().toISOString()
        }
      }
    });
  }

  /**
   * Test all notification channels
   */
  async testConnections(): Promise<{
    email: { success: boolean; error?: string };
    slack: { success: boolean; error?: string };
  }> {
    return {
      email: await this.emailService.testConnection(),
      slack: await this.slackService.testConnection()
    };
  }
}

/**
 * Singleton instance
 */
let notificationServiceInstance: NotificationService | null = null;

export function getNotificationService(): NotificationService {
  if (!notificationServiceInstance) {
    notificationServiceInstance = new NotificationService();
  }
  return notificationServiceInstance;
}

/**
 * Quick helper functions
 */
export const sendCriticalAlert = (
  title: string,
  description: string,
  error?: Error,
  adminEmails?: string[]
) =>
  getNotificationService().sendCriticalAlert(title, description, error, adminEmails);

export const sendJobSuccess = (
  jobName: string,
  results?: Record<string, unknown>,
  adminEmails?: string[]
) =>
  getNotificationService().sendJobSuccess(jobName, results, adminEmails);

export const sendJobFailure = (
  jobName: string,
  error: Error,
  results?: Record<string, unknown>,
  adminEmails?: string[]
) =>
  getNotificationService().sendJobFailure(jobName, error, results, adminEmails);

export const sendProcessAlert = (
  to: string | string[],
  processNumber: string,
  alertType: string,
  description: string,
  urgency?: 'high' | 'medium' | 'low'
) =>
  getNotificationService().sendProcessAlert(to, processNumber, alertType, description, urgency);

export const sendDailyCheckSummary = (
  total: number,
  successful: number,
  failed: number,
  withNewMovements: number,
  duration: number,
  adminEmails?: string[]
) =>
  getNotificationService().sendDailyCheckSummary(
    total,
    successful,
    failed,
    withNewMovements,
    duration,
    adminEmails
  );

export const sendReportReady = (
  recipients: string[],
  reportName: string,
  downloadUrl: string,
  fileSize?: number,
  expiresAt?: Date
) =>
  getNotificationService().sendReportReady(recipients, reportName, downloadUrl, fileSize, expiresAt);
