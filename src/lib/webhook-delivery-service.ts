// ================================================================
// WEBHOOK DELIVERY SERVICE - Track and retry webhook deliveries
// ================================================================

import { createHmac } from 'crypto';
import { ICONS } from '@/lib/icons';
import { prisma } from '@/lib/prisma';
import type { WebhookDeliveryStatus } from '@prisma/client';
import { log, logError } from '@/lib/services/logger';

interface WebhookDeliveryData {
  workspaceId: string;
  webhookType: string;
  eventType: string;
  processNumber: string;
  payload: Record<string, unknown>;
  signature?: string;
}

interface WebhookDeliveryLog {
  id: string;
  status: 'pending' | 'processing' | 'success' | 'failed' | 'retrying' | 'skipped';
  statusCode?: number;
  error?: string;
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: Date;
  lastAttemptAt?: Date;
  deliveredAt?: Date;
}

// Exponential backoff: 5s → 30s → 5m → 30m → 24h
const RETRY_DELAYS = [
  5 * 1000,        // 5 seconds
  30 * 1000,       // 30 seconds
  5 * 60 * 1000,   // 5 minutes
  30 * 60 * 1000,  // 30 minutes
  24 * 60 * 60 * 1000, // 24 hours
];

/**
 * Convert log status string to database enum
 */
function statusToEnum(status: string): WebhookDeliveryStatus {
  const statusMap: Record<string, WebhookDeliveryStatus> = {
    pending: 'PENDING',
    processing: 'PROCESSING',
    success: 'SUCCESS',
    failed: 'FAILED',
    retrying: 'RETRYING',
    skipped: 'SKIPPED',
  };
  return statusMap[status] as WebhookDeliveryStatus;
}

export class WebhookDeliveryService {
  private readonly MAX_RETRIES = 5;
  private readonly DEDUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Log webhook delivery attempt
   * Tracks status, retries, and scheduling for automatic retry
   */
  async logWebhookDelivery(
    data: WebhookDeliveryData,
    attempt: number = 0,
    error?: string,
    statusCode?: number
  ): Promise<WebhookDeliveryLog> {
    try {
      const isSuccess = statusCode === 200 || statusCode === 202;
      const status = isSuccess ? 'success' :
        attempt < this.MAX_RETRIES ? 'retrying' : 'failed';

      const log: WebhookDeliveryLog = {
        id: `webhook-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        status,
        statusCode,
        error,
        retryCount: attempt,
        maxRetries: this.MAX_RETRIES,
        lastAttemptAt: new Date(),
      };

      if (isSuccess) {
        log.deliveredAt = new Date();
      } else if (attempt < this.MAX_RETRIES) {
        const delayMs = RETRY_DELAYS[attempt] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
        log.nextRetryAt = new Date(Date.now() + delayMs);
      }

      // Persist to database
      try {
        await prisma.webhookDelivery.create({
          data: {
            workspaceId: data.workspaceId,
            webhookType: data.webhookType,
            eventType: data.eventType,
            processNumber: data.processNumber,
            payload: JSON.parse(JSON.stringify(data.payload)),
            signature: data.signature,
            status: statusToEnum(status),
            statusCode: statusCode || undefined,
            error: error || undefined,
            retryCount: attempt,
            maxRetries: this.MAX_RETRIES,
            lastAttemptAt: log.lastAttemptAt,
            deliveredAt: log.deliveredAt,
            nextRetryAt: log.nextRetryAt,
          },
        });
      } catch (dbError) {
        logError(dbError, '${ICONS.ERROR} Failed to persist webhook to database:', { component: 'refactored' });
        // Don't throw - we still want to return the log even if persistence fails
        // This ensures graceful degradation if database is temporarily unavailable
      }

      // Log to console with structured format
      console.log(
        `${ICONS.WEBHOOK} Webhook delivery tracked`,
        {
          webhookType: data.webhookType,
          eventType: data.eventType,
          processNumber: data.processNumber,
          status,
          attempt: `${attempt}/${this.MAX_RETRIES}`,
          statusCode,
          error: error?.substring(0, 100),
          nextRetry: log.nextRetryAt?.toISOString(),
        }
      );

      return log;
    } catch (err) {
      logError(err, '${ICONS.ERROR} Failed to log webhook delivery', { component: 'refactored' });
      throw err;
    }
  }

  /**
   * Check for duplicate webhooks within dedup window
   * Prevents processing the same event twice
   */
  async isDuplicate(
    webhookType: string,
    processNumber: string,
    timestamp: string
  ): Promise<boolean> {
    try {
      const webhookTime = new Date(timestamp).getTime();
      const now = Date.now();
      const dedupWindow = this.DEDUP_WINDOW_MS;

      // Check if we've seen this webhook recently with successful delivery
      const recent = await prisma.webhookDelivery.findFirst({
        where: {
          webhookType,
          processNumber,
          status: 'SUCCESS',
          createdAt: {
            gte: new Date(now - dedupWindow),
          },
        },
        select: { id: true, createdAt: true },
      });

      if (recent) {
        console.log(
          `${ICONS.WARNING} Duplicate webhook detected`,
          {
            webhookType,
            processNumber,
            previousDelivery: recent.createdAt.toISOString(),
            age: now - webhookTime,
          }
        );
        return true;
      }

      return false;
    } catch (err) {
      logError(err, '${ICONS.ERROR} Error checking webhook duplicate', { component: 'refactored' });
      // Fail open: if we can't check for duplicates, allow the webhook through
      return false;
    }
  }

  /**
   * Get pending retries and reschedule them
   */
  async processPendingRetries(): Promise<{
    processed: number;
    failed: number;
  }> {
    try {
      log.info({ msg: 'Processing pending webhook retries' });

      // Query database for pending retries that are ready
      const pending = await prisma.webhookDelivery.findMany({
        where: {
          status: 'RETRYING',
          nextRetryAt: {
            lte: new Date(),
          },
          retryCount: {
            lt: 5, // Don't retry if max retries exceeded
          },
        },
        take: 100,
        orderBy: { nextRetryAt: 'asc' },
      });

      log.info({ msg: 'Found  webhooks ready for retry' });

      let processedCount = 0;
      let failedCount = 0;

      // Process each pending retry
      for (const webhook of pending) {
        try {
          // Mark as processing
          await prisma.webhookDelivery.update({
            where: { id: webhook.id },
            data: { status: 'PROCESSING' },
          });
          processedCount++;
        } catch (updateErr) {
          logError(updateErr, '${ICONS.ERROR} Failed to process webhook retry ${webhook.id}:', { component: 'refactored' });
          failedCount++;
        }
      }

      log.info({ msg: 'Processed  webhook retries ( failed)' });

      return {
        processed: processedCount,
        failed: failedCount,
      };
    } catch (err) {
      logError(err, '${ICONS.ERROR} Error processing pending retries', { component: 'refactored' });
      return { processed: 0, failed: 1 };
    }
  }

  /**
   * Generate HMAC signature for webhook verification
   */
  generateSignature(
    payload: Record<string, unknown>,
    secret: string
  ): string {
    const body = JSON.stringify(payload);
    return createHmac('sha256', secret)
      .update(body)
      .digest('hex');
  }

  /**
   * Verify webhook signature
   */
  verifySignature(
    payload: Record<string, unknown>,
    signature: string,
    secret: string
  ): boolean {
    const expectedSignature = this.generateSignature(payload, secret);
    return expectedSignature === signature;
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  getRetryDelay(attemptNumber: number): number {
    if (attemptNumber >= RETRY_DELAYS.length) {
      return RETRY_DELAYS[RETRY_DELAYS.length - 1];
    }
    return RETRY_DELAYS[attemptNumber];
  }

  /**
   * Get human-readable retry delay description
   */
  getRetryDelayDescription(attemptNumber: number): string {
    const ms = this.getRetryDelay(attemptNumber);
    const minutes = Math.floor(ms / (60 * 1000));
    const hours = Math.floor(ms / (60 * 60 * 1000));
    const days = Math.floor(ms / (24 * 60 * 60 * 1000));

    if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    return `${Math.floor(ms / 1000)} second${Math.floor(ms / 1000) > 1 ? 's' : ''}`;
  }
}

// Singleton instance
export const webhookDeliveryService = new WebhookDeliveryService();
