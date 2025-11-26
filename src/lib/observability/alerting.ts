// ================================================================
// ALERTING SYSTEM
// Sistema de alertas para falhas na API e eventos críticos
// ================================================================

import { AlertSeverity } from '@/lib/types/database';
import { alertLogger } from './logger';
import { createAlert, type AlertType } from './costTracking';

// ================================================================
// CONFIGURATION
// ================================================================

const ALERT_CONFIG = {
  // Email settings (configure via environment variables)
  EMAIL_ENABLED: process.env.ALERTS_EMAIL_ENABLED === 'true',
  EMAIL_FROM: process.env.ALERTS_EMAIL_FROM || 'noreply@justoai.com',
  EMAIL_TO: process.env.ALERTS_EMAIL_TO?.split(',') || [],

  // Webhook settings
  WEBHOOK_ENABLED: process.env.ALERTS_WEBHOOK_ENABLED === 'true',
  WEBHOOK_URL: process.env.ALERTS_WEBHOOK_URL,

  // Slack settings
  SLACK_ENABLED: process.env.ALERTS_SLACK_ENABLED === 'true',
  SLACK_WEBHOOK_URL: process.env.ALERTS_SLACK_WEBHOOK_URL,

  // Thresholds
  RATE_LIMIT_THRESHOLD: 10, // Alert after 10 rate limits in 5 minutes
  ERROR_RATE_THRESHOLD: 0.1, // Alert if _error rate > 10%
  HIGH_COST_THRESHOLD: 50, // Alert if daily cost > R$50
} as const;

// ================================================================
// TYPES
// ================================================================

export interface AlertOptions {
  workspaceId?: string;
  type: AlertType;
  severity?: AlertSeverity;
  title: string;
  message: string;
  errorCode?: string;
  numeroCnj?: string;
  requestId?: string;
  trackingId?: string;
  jobId?: string;
  metadata?: Record<string, unknown>;
  notify?: boolean; // Whether to send notifications
}

export interface NotificationChannel {
  name: string;
  enabled: boolean;
  send: (_alert: AlertOptions) => Promise<void>;
}

// ================================================================
// ALERT HANDLERS
// ================================================================

/**
 * Envia um alerta
 */
export async function sendAlert(options: AlertOptions): Promise<void> {
  const {
    workspaceId,
    type,
    severity = AlertSeverity.MEDIUM,
    title,
    message,
    errorCode,
    numeroCnj,
    requestId,
    trackingId,
    jobId,
    metadata,
    notify = true,
  } = options;

  alertLogger.warn({
    action: 'alert_triggered',
    alert_type: type,
    severity,
    title,
    message,
    cnj: numeroCnj,
    request_id: requestId,
  });

  // Save alert to database
  await createAlert({
    workspaceId,
    alertType: type,
    severity,
    title,
    message,
    errorCode,
    numeroCnj,
    requestId,
    trackingId,
    jobId,
    metadata,
  });

  // Send notifications if enabled
  if (notify) {
    await notifyChannels(options);
  }
}

/**
 * Notifica canais configurados
 */
async function notifyChannels(alert: AlertOptions): Promise<void> {
  const channels = getEnabledChannels();

  const notifications = channels.map((channel) =>
    channel.send(alert).catch((error) => {
      alertLogger.error({
        action: 'notification_failed',
        channel: channel.name,
        error: error instanceof Error ? error.message : String(error),
      });
    })
  );

  await Promise.allSettled(notifications);
}

/**
 * Retorna canais de notificação habilitados
 */
function getEnabledChannels(): NotificationChannel[] {
  const channels: NotificationChannel[] = [];

  if (ALERT_CONFIG.EMAIL_ENABLED) {
    channels.push({
      name: 'email',
      enabled: true,
      send: sendEmailNotification,
    });
  }

  if (ALERT_CONFIG.SLACK_ENABLED) {
    channels.push({
      name: 'slack',
      enabled: true,
      send: sendSlackNotification,
    });
  }

  if (ALERT_CONFIG.WEBHOOK_ENABLED) {
    channels.push({
      name: 'webhook',
      enabled: true,
      send: sendWebhookNotification,
    });
  }

  return channels;
}

// ================================================================
// NOTIFICATION CHANNELS
// ================================================================

/**
 * Envia notificação por email
 */
async function sendEmailNotification(alert: AlertOptions): Promise<void> {
  // TODO: Integrate with email service (SendGrid, AWS SES, etc.)
  alertLogger.info({
    action: 'email_notification',
    to: ALERT_CONFIG.EMAIL_TO,
    subject: `[${alert.severity}] ${alert.title}`,
    alert_type: alert.type,
  });

  // Placeholder for actual email implementation
  // Example with nodemailer:
  // await transporter.sendMail({
  //   from: ALERT_CONFIG.EMAIL_FROM,
  //   to: ALERT_CONFIG.EMAIL_TO,
  //   subject: `[${alert.severity}] ${alert.title}`,
  //   html: formatEmailBody(alert),
  // });
}

/**
 * Envia notificação para Slack
 */
async function sendSlackNotification(alert: AlertOptions): Promise<void> {
  if (!ALERT_CONFIG.SLACK_WEBHOOK_URL) {
    return;
  }

  const color = getSeverityColor(alert.severity || AlertSeverity.MEDIUM);

  const payload = {
    attachments: [
      {
        color,
        title: alert.title,
        text: alert.message,
        fields: [
          {
            title: 'Severity',
            value: alert.severity,
            short: true,
          },
          {
            title: 'Type',
            value: alert.type,
            short: true,
          },
          ...(alert.numeroCnj
            ? [{ title: 'CNJ', value: alert.numeroCnj, short: true }]
            : []),
          ...(alert.errorCode
            ? [{ title: 'Error Code', value: alert.errorCode, short: true }]
            : []),
        ],
        footer: 'JustoAI JUDIT Integration',
        ts: Math.floor(Date.now() / 1000),
      },
    ],
  };

  const response = await fetch(ALERT_CONFIG.SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Slack notification failed: ${response.statusText}`);
  }

  alertLogger.info({
    action: 'slack_notification_sent',
    alert_type: alert.type,
    severity: alert.severity,
  });
}

/**
 * Envia notificação via webhook genérico
 */
async function sendWebhookNotification(alert: AlertOptions): Promise<void> {
  if (!ALERT_CONFIG.WEBHOOK_URL) {
    return;
  }

  const payload = {
    timestamp: new Date().toISOString(),
    alert: {
      type: alert.type,
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      errorCode: alert.errorCode,
      numeroCnj: alert.numeroCnj,
      requestId: alert.requestId,
      trackingId: alert.trackingId,
      jobId: alert.jobId,
      metadata: alert.metadata,
    },
  };

  const response = await fetch(ALERT_CONFIG.WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Webhook notification failed: ${response.statusText}`);
  }

  alertLogger.info({
    action: 'webhook_notification_sent',
    alert_type: alert.type,
    severity: alert.severity,
  });
}

// ================================================================
// SPECIFIC ALERT TYPES
// ================================================================

/**
 * Alerta de erro na API
 */
export async function alertApiError(
  _error: Error,
  context: {
    endpoint: string;
    method: string;
    statusCode?: number;
    requestId?: string;
    numeroCnj?: string;
  }
): Promise<void> {
  await sendAlert({
    type: 'API_ERROR',
    severity: AlertSeverity.HIGH,
    title: 'JUDIT API Error',
    message: `Error calling ${context.method} ${context.endpoint}: ${_error.message}`,
    errorCode: context.statusCode?.toString(),
    requestId: context.requestId,
    numeroCnj: context.numeroCnj,
    metadata: {
      endpoint: context.endpoint,
      method: context.method,
      statusCode: context.statusCode,
      errorMessage: _error.message,
      errorStack: _error.stack,
    },
  });
}

/**
 * Alerta de rate limit
 */
export async function alertRateLimit(context: {
  endpoint: string;
  retryAfter?: number;
}): Promise<void> {
  await sendAlert({
    type: 'RATE_LIMIT',
    severity: AlertSeverity.MEDIUM,
    title: 'JUDIT API Rate Limit',
    message: `Rate limit hit on ${context.endpoint}. Retry after ${context.retryAfter || 'unknown'}s`,
    metadata: context,
  });
}

/**
 * Alerta de circuit breaker aberto
 */
export async function alertCircuitBreaker(context: {
  service: string;
  errorRate: number;
  failedCalls: number;
}): Promise<void> {
  await sendAlert({
    type: 'CIRCUIT_BREAKER',
    severity: AlertSeverity.CRITICAL,
    title: 'Circuit Breaker Opened',
    message: `Circuit breaker opened for ${context.service}. Error rate: ${(context.errorRate * 100).toFixed(1)}%, Failed calls: ${context.failedCalls}`,
    metadata: context,
  });
}

/**
 * Alerta de timeout
 */
export async function alertTimeout(context: {
  operation: string;
  duration: number;
  maxDuration: number;
  requestId?: string;
  numeroCnj?: string;
}): Promise<void> {
  await sendAlert({
    type: 'TIMEOUT',
    severity: AlertSeverity.HIGH,
    title: 'Operation Timeout',
    message: `${context.operation} timed out after ${context.duration}ms (max: ${context.maxDuration}ms)`,
    requestId: context.requestId,
    numeroCnj: context.numeroCnj,
    metadata: context,
  });
}

/**
 * Alerta de trigger de busca de anexos
 */
export async function alertAttachmentTrigger(context: {
  numeroCnj: string;
  keywordsMatched: string[];
  estimatedCost: number;
}): Promise<void> {
  await sendAlert({
    type: 'ATTACHMENT_TRIGGER',
    severity: AlertSeverity.LOW,
    title: 'Attachment Fetch Triggered',
    message: `Attachment fetch triggered for ${context.numeroCnj}. Keywords: ${context.keywordsMatched.join(', ')}. Estimated cost: R$${context.estimatedCost.toFixed(2)}`,
    numeroCnj: context.numeroCnj,
    metadata: context,
    notify: false, // Don't notify for routine operations
  });
}

/**
 * Alerta de falha no monitoramento
 */
export async function alertMonitoringFailed(context: {
  numeroCnj: string;
  trackingId: string;
  _error: string;
}): Promise<void> {
  await sendAlert({
    type: 'MONITORING_FAILED',
    severity: AlertSeverity.MEDIUM,
    title: 'Monitoring Check Failed',
    message: `Failed to check monitoring for ${context.numeroCnj}: ${context._error}`,
    numeroCnj: context.numeroCnj,
    trackingId: context.trackingId,
    metadata: context,
  });
}

// ================================================================
// HELPERS
// ================================================================

/**
 * Retorna cor baseada na severidade
 */
function getSeverityColor(severity: AlertSeverity | string): string {
  switch (severity) {
    case 'CRITICAL':
      return '#DC2626'; // Red
    case 'HIGH':
      return '#EA580C'; // Orange
    case 'MEDIUM':
      return '#F59E0B'; // Yellow
    case 'LOW':
      return '#3B82F6'; // Blue
    default:
      return '#6B7280'; // Gray
  }
}

/**
 * Formata corpo do email
 */
// eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
function formatEmailBody(alert: AlertOptions): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: ${getSeverityColor(alert.severity || AlertSeverity.MEDIUM)};">
        [${alert.severity}] ${alert.title}
      </h2>

      <p>${alert.message}</p>

      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
          <td style="padding: 8px; background: #f3f4f6;"><strong>Alert Type:</strong></td>
          <td style="padding: 8px;">${alert.type}</td>
        </tr>
        ${alert.numeroCnj ? `
        <tr>
          <td style="padding: 8px; background: #f3f4f6;"><strong>CNJ:</strong></td>
          <td style="padding: 8px;">${alert.numeroCnj}</td>
        </tr>
        ` : ''}
        ${alert.errorCode ? `
        <tr>
          <td style="padding: 8px; background: #f3f4f6;"><strong>Error Code:</strong></td>
          <td style="padding: 8px;">${alert.errorCode}</td>
        </tr>
        ` : ''}
        ${alert.requestId ? `
        <tr>
          <td style="padding: 8px; background: #f3f4f6;"><strong>Request ID:</strong></td>
          <td style="padding: 8px;">${alert.requestId}</td>
        </tr>
        ` : ''}
      </table>

      <p style="color: #6b7280; font-size: 12px;">
        Generated by JustoAI JUDIT Integration at ${new Date().toISOString()}
      </p>
    </div>
  `;
}

// Note: AlertOptions and NotificationChannel are exported via
// export interface statements above (lines 38, 53)
