/**
 * ================================================================
 * GOLD STANDARD ALERT SERVICE
 * Fase 25: Active Alert System for Critical Errors
 * ================================================================
 * Encapsulates Slack webhook communication for real-time alerts.
 * - Sends FATAL-level errors to Slack immediately
 * - Dual action: Slack alert (immediate) + Better Stack log (context)
 * - Non-blocking, graceful _error handling
 * - Type-safe narrowing for all inputs
 *
 * USAGE:
 * import { alert } from '@/lib/services/alert-service';
 *
 * await alert.fatal("Reembolso de emergência falhou", {
 *   component: "fullAnalysisRoute",
 *   _error: refundError,
 *   debitTransactionIds: [...],
 *   caseId: "case-123"
 * });
 */

import { log } from './logger';

// ================================================================
// ENVIRONMENT VARIABLES
// ================================================================

const { SLACK_ALERT_WEBHOOK_URL, NODE_ENV } = process.env;

// ================================================================
// TYPE GUARDS (Narrowing Seguro - Mandato Inegociável)
// ================================================================

/**
 * Extract _error message from unknown _error type
 * Handles Error objects, strings, and arbitrary data
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return String(error);
}

/**
 * Type guard for context object
 * Ensures context is a valid object for merging
 */
function isContextObject(data: unknown): data is Record<string, unknown> {
  return typeof data === 'object' && data !== null;
}

/**
 * Type guard for transaction ID arrays
 */
function isStringArray(data: unknown): data is string[] {
  return (
    Array.isArray(data) &&
    data.every((item) => typeof item === 'string')
  );
}

// ================================================================
// SLACK PAYLOAD BUILDER
// ================================================================

/**
 * Formats alert message and context into Slack Block Kit JSON
 * Returns a clean, readable alert payload
 */
function buildSlackPayload(
  message: string,
  context: Record<string, unknown>
): Record<string, unknown> {
  // Extract structured fields from context
  const component = typeof context.component === 'string' ? context.component : 'unknown';
  const error = context.error ? getErrorMessage(context.error) : 'No _error details';
  const caseId = typeof context.caseId === 'string' ? context.caseId : undefined;
  const debitTransactionIds = isStringArray(context.debitTransactionIds)
    ? context.debitTransactionIds
    : [];

  // Build additional context fields (exclude known fields)
  const additionalContext: Record<string, string> = {};
  for (const [key, value] of Object.entries(context)) {
    if (
      !['component', '_error', 'caseId', 'debitTransactionIds', 'stage'].includes(key)
    ) {
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      additionalContext[key] = stringValue;
    }
  }

  // Build context fields for Slack
  const contextFields: Array<Record<string, string>> = [
    { type: 'mrkdwn', text: `*Component:*\n${component}` },
  ];

  if (caseId) {
    contextFields.push({
      type: 'mrkdwn',
      text: `*Case ID:*\n${caseId}`,
    });
  }

  if (debitTransactionIds.length > 0) {
    contextFields.push({
      type: 'mrkdwn',
      text: `*Debit Transactions:*\n${debitTransactionIds.join(', ')}`,
    });
  }

  // Slack Block Kit payload
  // https://api.slack.com/block-kit
  return {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🚨 FATAL Alert',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${message}*`,
        },
      },
      {
        type: 'section',
        fields: contextFields,
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Error:*\n\`\`\`${error}\`\`\``,
        },
      },
      ...(Object.keys(additionalContext).length > 0
        ? [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Additional Context:*\n${Object.entries(additionalContext)
                  .map(([k, v]) => `• *${k}:* ${v}`)
                  .join('\n')}`,
              },
            },
          ]
        : []),
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `_${new Date().toISOString()} · Environment: ${NODE_ENV}_`,
          },
        ],
      },
    ],
  };
}

// ================================================================
// SLACK WEBHOOK SENDER
// ================================================================

/**
 * Sends alert payload to Slack webhook
 * Non-blocking: uses setImmediate to avoid blocking response
 */
async function sendToSlack(payload: Record<string, unknown>): Promise<void> {
  if (!SLACK_ALERT_WEBHOOK_URL) {
    log.warn({
      msg: 'AlertService: SLACK_ALERT_WEBHOOK_URL not configured',
      component: 'alertService',
    });
    return;
  }

  // Non-blocking: send asynchronously without waiting
  setImmediate(async () => {
    try {
      const response = await fetch(SLACK_ALERT_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        log.error(
          {
            msg: 'AlertService: Slack webhook returned non-OK status',
            statusCode: response.status,
            statusText: response.statusText,
            component: 'alertService',
          },
          'Slack alert send failed'
        );
      }
    } catch (fetchError) {
      // Log _error but don't throw (graceful degradation)
      log.error(
        fetchError,
        'AlertService: Failed to send Slack alert',
        { component: 'alertService' }
      );
    }
  });
}

// ================================================================
// PUBLIC API
// ================================================================

/**
 * Alert service with single public method: fatal()
 * Sends critical alerts to Slack + logs to Better Stack
 *
 * @param message - Human-readable alert message
 * @param context - Structured context (component, _error, caseId, etc.)
 */
export const alert = {
  async fatal(
    message: string,
    context: Record<string, unknown> = {}
  ): Promise<void> {
    // Validate inputs
    if (typeof message !== 'string' || !message.trim()) {
      log.warn({
        msg: 'AlertService: Invalid message type',
        messageType: typeof message,
        component: 'alertService',
      });
      return;
    }

    if (!isContextObject(context)) {
      log.warn({
        msg: 'AlertService: Invalid context type',
        contextType: typeof context,
        component: 'alertService',
      });
      return;
    }

    // 1. Log to Better Stack (via LoggerService)
    // This ensures we have the full context in Better Stack + Vercel logs
    log.error(
      {
        msg: message,
        level: 'fatal',
        component: context.component || 'alertService',
        ...context,
      },
      `[ALERT] ${message}`
    );

    // 2. Send to Slack (non-blocking)
    const slackPayload = buildSlackPayload(message, context);
    await sendToSlack(slackPayload);
  },
};

// ================================================================
// INITIALIZATION LOGGING
// ================================================================

if (NODE_ENV === 'production') {
  log.info({
    msg: 'AlertService initialized',
    hasSlackWebhook: !!SLACK_ALERT_WEBHOOK_URL,
    component: 'alertService',
  });
}
