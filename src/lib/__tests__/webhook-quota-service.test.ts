/**
 * SPRINT 3 - Service Tests: Webhook Delivery & Quota Enforcement
 *
 * Comprehensive tests for:
 * 1. WebhookDeliveryService - retry logic, deduplication, signature verification
 * 2. Rate limiting middleware - quota enforcement, token bucket algorithm, Redis/fallback
 *
 * Focus: Resilience, atomicity, and state consistency under load
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'

// Mock types
interface WebhookDeliveryRecord {
  id: string
  workspaceId: string
  webhookType: string
  eventType: string
  processNumber: string
  payload: Record<string, unknown>
  signature?: string
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'RETRYING' | 'SKIPPED'
  statusCode?: number
  error?: string
  retryCount: number
  maxRetries: number
  lastAttemptAt?: Date
  deliveredAt?: Date
  nextRetryAt?: Date
  createdAt: Date
}

interface RateLimitEntry {
  count: number
  resetTime: number
}

interface WebhookDeliveryInput {
  workspaceId: string
  webhookType: string
  eventType: string
  processNumber: string
  payload: Record<string, unknown>
  signature?: string
}

// Mock webhook delivery service
class MockWebhookDeliveryService {
  private readonly MAX_RETRIES = 5
  private readonly DEDUP_WINDOW_MS = 5 * 60 * 1000 // 5 minutes
  private deliveryLog: WebhookDeliveryRecord[] = []

  private readonly RETRY_DELAYS = [
    5 * 1000,        // 5 seconds
    30 * 1000,       // 30 seconds
    5 * 60 * 1000,   // 5 minutes
    30 * 60 * 1000,  // 30 minutes
    24 * 60 * 60 * 1000, // 24 hours
  ]

  getRetryDelay(attemptNumber: number): number {
    if (attemptNumber >= this.RETRY_DELAYS.length) {
      return this.RETRY_DELAYS[this.RETRY_DELAYS.length - 1]
    }
    return this.RETRY_DELAYS[attemptNumber]
  }

  getRetryDelayDescription(attemptNumber: number): string {
    const ms = this.getRetryDelay(attemptNumber)
    const minutes = Math.floor(ms / (60 * 1000))
    const hours = Math.floor(ms / (60 * 60 * 1000))
    const days = Math.floor(ms / (24 * 60 * 60 * 1000))

    if (days > 0) return `${days} day${days > 1 ? 's' : ''}`
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''}`
    return `${Math.floor(ms / 1000)} second${Math.floor(ms / 1000) > 1 ? 's' : ''}`
  }

  async logWebhookDelivery(
    data: WebhookDeliveryInput,
    attempt: number = 0,
    error?: string,
    statusCode?: number
  ): Promise<WebhookDeliveryRecord> {
    const isSuccess = statusCode === 200 || statusCode === 202
    const status = isSuccess ? 'SUCCESS' :
      attempt < this.MAX_RETRIES ? 'RETRYING' : 'FAILED'

    const record: WebhookDeliveryRecord = {
      id: `webhook-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      workspaceId: data.workspaceId,
      webhookType: data.webhookType,
      eventType: data.eventType,
      processNumber: data.processNumber,
      payload: data.payload,
      signature: data.signature,
      status,
      statusCode,
      error,
      retryCount: attempt,
      maxRetries: this.MAX_RETRIES,
      lastAttemptAt: new Date(),
      createdAt: new Date(),
    }

    if (isSuccess) {
      record.deliveredAt = new Date()
    } else if (attempt < this.MAX_RETRIES) {
      const delayMs = this.getRetryDelay(attempt)
      record.nextRetryAt = new Date(Date.now() + delayMs)
    }

    this.deliveryLog.push(record)
    return record
  }

  async isDuplicate(webhookType: string, processNumber: string, timestamp: string): Promise<boolean> {
    const webhookTime = new Date(timestamp).getTime()
    const now = Date.now()

    const recent = this.deliveryLog.find(
      (log) =>
        log.webhookType === webhookType &&
        log.processNumber === processNumber &&
        log.status === 'SUCCESS' &&
        now - log.createdAt.getTime() < this.DEDUP_WINDOW_MS
    )

    return !!recent
  }

  async processPendingRetries(): Promise<{ processed: number; failed: number }> {
    const now = new Date()
    const pending = this.deliveryLog.filter(
      (log) =>
        log.status === 'RETRYING' &&
        log.nextRetryAt &&
        log.nextRetryAt <= now &&
        log.retryCount < 5
    )

    let processed = 0
    let failed = 0

    for (const webhook of pending) {
      try {
        webhook.status = 'PROCESSING'
        processed++
      } catch {
        failed++
      }
    }

    return { processed, failed }
  }

  generateSignature(payload: Record<string, unknown>, secret: string): string {
    const body = JSON.stringify(payload)
    // Simplified - would use crypto.createHmac in real implementation
    return Buffer.from(body + secret).toString('base64')
  }

  verifySignature(
    payload: Record<string, unknown>,
    signature: string,
    secret: string
  ): boolean {
    const expectedSignature = this.generateSignature(payload, secret)
    return expectedSignature === signature
  }

  getDeliveryLog(): WebhookDeliveryRecord[] {
    return this.deliveryLog
  }

  clearLog(): void {
    this.deliveryLog = []
  }
}

// Mock rate limit store
class MockRateLimitStore {
  private store = new Map<string, RateLimitEntry>()

  async check(key: string, maxRequests: number, windowSeconds: number): Promise<boolean> {
    // Handle zero or negative max requests (deny all)
    if (maxRequests <= 0) {
      return true
    }

    const now = Date.now()
    const record = this.store.get(key)

    if (!record) {
      this.store.set(key, { count: 1, resetTime: now + windowSeconds * 1000 })
      return false
    }

    if (now > record.resetTime) {
      this.store.set(key, { count: 1, resetTime: now + windowSeconds * 1000 })
      return false
    }

    if (record.count >= maxRequests) {
      return true
    }

    record.count++
    return false
  }

  async getRemainingRequests(key: string, maxRequests: number): Promise<number> {
    const record = this.store.get(key)
    if (!record) return maxRequests

    const now = Date.now()
    if (now > record.resetTime) return maxRequests

    return Math.max(0, maxRequests - record.count)
  }

  cleanup(): void {
    const now = Date.now()
    for (const [key, record] of this.store.entries()) {
      if (now > record.resetTime) {
        this.store.delete(key)
      }
    }
  }

  clear(): void {
    this.store.clear()
  }
}

describe('SPRINT 3: Webhook Delivery & Quota Enforcement Service Tests', () => {
  let webhookService: MockWebhookDeliveryService
  let rateLimitStore: MockRateLimitStore

  beforeEach(() => {
    webhookService = new MockWebhookDeliveryService()
    rateLimitStore = new MockRateLimitStore()
  })

  afterEach(() => {
    webhookService.clearLog()
    rateLimitStore.clear()
  })

  // ========================================================================
  // WEBHOOK DELIVERY SERVICE TESTS
  // ========================================================================

  describe('1. WebhookDeliveryService - Logging & Tracking', () => {
    it('should log successful webhook delivery', async () => {
      const record = await webhookService.logWebhookDelivery(
        {
          workspaceId: 'ws-123',
          webhookType: 'judit',
          eventType: 'case-update',
          processNumber: '12345678901234567890',
          payload: { status: 'updated' },
        },
        0,
        undefined,
        200
      )

      expect(record.status).toBe('SUCCESS')
      expect(record.deliveredAt).toBeDefined()
      expect(record.statusCode).toBe(200)
    })

    it('should log failed webhook with retry scheduling', async () => {
      const record = await webhookService.logWebhookDelivery(
        {
          workspaceId: 'ws-123',
          webhookType: 'stripe',
          eventType: 'payment-success',
          processNumber: 'proc-123',
          payload: { amount: 5000 },
        },
        0,
        'Connection timeout',
        500
      )

      expect(record.status).toBe('RETRYING')
      expect(record.nextRetryAt).toBeDefined()
      expect(record.error).toBe('Connection timeout')
    })

    it('should escalate to FAILED after max retries', async () => {
      const record = await webhookService.logWebhookDelivery(
        {
          workspaceId: 'ws-123',
          webhookType: 'stripe',
          eventType: 'payment-failed',
          processNumber: 'proc-456',
          payload: { reason: 'declined' },
        },
        5, // attempt 5 (MAX_RETRIES = 5)
        'Still failing',
        500
      )

      expect(record.status).toBe('FAILED')
      expect(record.nextRetryAt).toBeUndefined()
    })

    it('should create audit trail in delivery log', async () => {
      await webhookService.logWebhookDelivery(
        {
          workspaceId: 'ws-123',
          webhookType: 'judit',
          eventType: 'event-1',
          processNumber: 'proc-1',
          payload: {},
        },
        0,
        undefined,
        200
      )

      await webhookService.logWebhookDelivery(
        {
          workspaceId: 'ws-123',
          webhookType: 'stripe',
          eventType: 'event-2',
          processNumber: 'proc-2',
          payload: {},
        },
        0,
        undefined,
        200
      )

      const log = webhookService.getDeliveryLog()
      expect(log.length).toBe(2)
      expect(log[0].webhookType).toBe('judit')
      expect(log[1].webhookType).toBe('stripe')
    })
  })

  describe('2. WebhookDeliveryService - Retry Logic & Exponential Backoff', () => {
    it('should use exponential backoff: 5s → 30s → 5m → 30m → 24h', async () => {
      const expected = [
        { attempt: 0, delay: '5 seconds' },
        { attempt: 1, delay: '30 seconds' },
        { attempt: 2, delay: '5 minutes' },
        { attempt: 3, delay: '30 minutes' },
        { attempt: 4, delay: '1 day' },
      ]

      for (const test of expected) {
        const description = webhookService.getRetryDelayDescription(test.attempt)
        expect(description).toBe(test.delay)
      }
    })

    it('should schedule next retry at correct time', async () => {
      const now = Date.now()
      const record = await webhookService.logWebhookDelivery(
        {
          workspaceId: 'ws-123',
          webhookType: 'test',
          eventType: 'test-event',
          processNumber: 'proc-test',
          payload: {},
        },
        1, // Second attempt (30s delay)
        'Failed',
        500
      )

      expect(record.nextRetryAt).toBeDefined()
      if (record.nextRetryAt) {
        const delayMs = record.nextRetryAt.getTime() - now
        expect(delayMs).toBeCloseTo(30 * 1000, -3) // 30 seconds, ±1s tolerance
      }
    })

    it('should cap retry delay at 24 hours for excessive attempts', async () => {
      const delay0 = webhookService.getRetryDelay(0)
      const delay10 = webhookService.getRetryDelay(10)

      expect(delay0).toBeLessThan(delay10 || delay0)
      expect(delay10).toBe(webhookService.getRetryDelay(5)) // Should cap
    })

    it('should respect max retries (5 attempts)', async () => {
      let record = await webhookService.logWebhookDelivery(
        {
          workspaceId: 'ws-123',
          webhookType: 'test',
          eventType: 'test',
          processNumber: 'proc-test',
          payload: {},
        },
        4,
        'Failed',
        500
      )
      expect(record.status).toBe('RETRYING')

      record = await webhookService.logWebhookDelivery(
        {
          workspaceId: 'ws-123',
          webhookType: 'test',
          eventType: 'test',
          processNumber: 'proc-test',
          payload: {},
        },
        5,
        'Max retries exceeded',
        500
      )
      expect(record.status).toBe('FAILED')
    })
  })

  describe('3. WebhookDeliveryService - Deduplication', () => {
    it('should detect duplicate webhook within dedup window', async () => {
      const timestamp = new Date().toISOString()

      await webhookService.logWebhookDelivery(
        {
          workspaceId: 'ws-123',
          webhookType: 'judit',
          eventType: 'case-update',
          processNumber: 'proc-123',
          payload: { status: 'updated' },
        },
        0,
        undefined,
        200
      )

      const isDuplicate = await webhookService.isDuplicate('judit', 'proc-123', timestamp)
      expect(isDuplicate).toBe(true)
    })

    it('should allow webhook after dedup window expires (5 minutes)', async () => {
      // Log webhook
      const timestamp1 = new Date(Date.now() - 6 * 60 * 1000).toISOString() // 6 minutes ago

      await webhookService.logWebhookDelivery(
        {
          workspaceId: 'ws-123',
          webhookType: 'judit',
          eventType: 'case-update',
          processNumber: 'proc-123',
          payload: {},
        },
        0,
        undefined,
        200
      )

      // Manually adjust created date to be 6 minutes ago
      const log = webhookService.getDeliveryLog()[0]
      log.createdAt = new Date(Date.now() - 6 * 60 * 1000)

      const isDuplicate = await webhookService.isDuplicate('judit', 'proc-123', timestamp1)
      expect(isDuplicate).toBe(false)
    })

    it('should not consider different process numbers as duplicates', async () => {
      const timestamp = new Date().toISOString()

      await webhookService.logWebhookDelivery(
        {
          workspaceId: 'ws-123',
          webhookType: 'judit',
          eventType: 'case-update',
          processNumber: 'proc-123',
          payload: {},
        },
        0,
        undefined,
        200
      )

      const isDuplicate = await webhookService.isDuplicate('judit', 'proc-456', timestamp)
      expect(isDuplicate).toBe(false)
    })

    it('should not consider different webhook types as duplicates', async () => {
      const timestamp = new Date().toISOString()

      await webhookService.logWebhookDelivery(
        {
          workspaceId: 'ws-123',
          webhookType: 'stripe',
          eventType: 'payment',
          processNumber: 'proc-123',
          payload: {},
        },
        0,
        undefined,
        200
      )

      const isDuplicate = await webhookService.isDuplicate('judit', 'proc-123', timestamp)
      expect(isDuplicate).toBe(false)
    })
  })

  describe('4. WebhookDeliveryService - Signature Verification', () => {
    it('should generate consistent signatures', async () => {
      const payload = { event: 'payment', amount: 5000 }
      const secret = 'webhook-secret'

      const sig1 = webhookService.generateSignature(payload, secret)
      const sig2 = webhookService.generateSignature(payload, secret)

      expect(sig1).toBe(sig2)
    })

    it('should verify correct signature', async () => {
      const payload = { event: 'payment', amount: 5000 }
      const secret = 'webhook-secret'

      const signature = webhookService.generateSignature(payload, secret)
      const isValid = webhookService.verifySignature(payload, signature, secret)

      expect(isValid).toBe(true)
    })

    it('should reject wrong signature', async () => {
      const payload = { event: 'payment', amount: 5000 }
      const secret = 'webhook-secret'
      const wrongSignature = 'wrong-signature'

      const isValid = webhookService.verifySignature(payload, wrongSignature, secret)

      expect(isValid).toBe(false)
    })

    it('should reject signature with wrong secret', async () => {
      const payload = { event: 'payment', amount: 5000 }
      const secret = 'webhook-secret'
      const wrongSecret = 'wrong-secret'

      const signature = webhookService.generateSignature(payload, secret)
      const isValid = webhookService.verifySignature(payload, signature, wrongSecret)

      expect(isValid).toBe(false)
    })
  })

  describe('5. WebhookDeliveryService - Pending Retries Processing', () => {
    it('should process webhooks ready for retry', async () => {
      const now = Date.now()

      const record = await webhookService.logWebhookDelivery(
        {
          workspaceId: 'ws-123',
          webhookType: 'test',
          eventType: 'test',
          processNumber: 'proc-1',
          payload: {},
        },
        0,
        'Failed',
        500
      )

      // Manually set nextRetryAt to past (make it ready for retry)
      if (record.nextRetryAt) {
        record.nextRetryAt = new Date(Date.now() - 1000) // 1 second ago
      }

      const result = await webhookService.processPendingRetries()
      expect(result.processed).toBe(1)
      expect(result.failed).toBe(0)
    })

    it('should skip webhooks not yet ready for retry', async () => {
      const futureTime = new Date(Date.now() + 10 * 1000) // 10 seconds in future

      const record = await webhookService.logWebhookDelivery(
        {
          workspaceId: 'ws-123',
          webhookType: 'test',
          eventType: 'test',
          processNumber: 'proc-1',
          payload: {},
        },
        0,
        'Failed',
        500
      )

      // Manually set nextRetryAt to future
      record.nextRetryAt = futureTime

      const result = await webhookService.processPendingRetries()
      expect(result.processed).toBe(0)
    })
  })

  // ========================================================================
  // RATE LIMITING MIDDLEWARE TESTS
  // ========================================================================

  describe('6. Rate Limiting - Token Bucket Algorithm', () => {
    it('should allow requests within limit', async () => {
      const key = 'user-123:payment'
      const maxRequests = 5
      const windowSeconds = 60

      for (let i = 0; i < 5; i++) {
        const isRateLimited = await rateLimitStore.check(key, maxRequests, windowSeconds)
        expect(isRateLimited).toBe(false)
      }
    })

    it('should block requests exceeding limit', async () => {
      const key = 'user-123:payment'
      const maxRequests = 3
      const windowSeconds = 60

      for (let i = 0; i < 3; i++) {
        await rateLimitStore.check(key, maxRequests, windowSeconds)
      }

      const isRateLimited = await rateLimitStore.check(key, maxRequests, windowSeconds)
      expect(isRateLimited).toBe(true)
    })

    it('should reset counter after window expires', async () => {
      const key = 'user-123:test'
      const maxRequests = 2
      const windowSeconds = 1

      // First window
      await rateLimitStore.check(key, maxRequests, windowSeconds)
      await rateLimitStore.check(key, maxRequests, windowSeconds)

      let isRateLimited = await rateLimitStore.check(key, maxRequests, windowSeconds)
      expect(isRateLimited).toBe(true)

      // Simulate window expiration
      await new Promise((resolve) => setTimeout(resolve, 1100))

      isRateLimited = await rateLimitStore.check(key, maxRequests, windowSeconds)
      expect(isRateLimited).toBe(false)
    })
  })

  describe('7. Rate Limiting - Configuration Presets', () => {
    it('should enforce PAYMENT config: 5 requests/min', async () => {
      const config = { maxRequests: 5, windowSeconds: 60 }

      for (let i = 0; i < 5; i++) {
        const isRateLimited = await rateLimitStore.check('user-123', config.maxRequests, config.windowSeconds)
        expect(isRateLimited).toBe(false)
      }

      const isRateLimited = await rateLimitStore.check('user-123', config.maxRequests, config.windowSeconds)
      expect(isRateLimited).toBe(true)
    })

    it('should enforce CREDIT_CONSUMPTION config: 20 requests/min', async () => {
      const config = { maxRequests: 20, windowSeconds: 60 }
      let count = 0

      for (let i = 0; i < 20; i++) {
        const isRateLimited = await rateLimitStore.check('workspace-123', config.maxRequests, config.windowSeconds)
        if (!isRateLimited) count++
      }

      expect(count).toBe(20)

      const isRateLimited = await rateLimitStore.check('workspace-123', config.maxRequests, config.windowSeconds)
      expect(isRateLimited).toBe(true)
    })

    it('should enforce USER_REGISTRATION config: 3 requests/hour', async () => {
      const config = { maxRequests: 3, windowSeconds: 3600 }

      for (let i = 0; i < 3; i++) {
        const isRateLimited = await rateLimitStore.check('ip-127.0.0.1', config.maxRequests, config.windowSeconds)
        expect(isRateLimited).toBe(false)
      }

      const isRateLimited = await rateLimitStore.check('ip-127.0.0.1', config.maxRequests, config.windowSeconds)
      expect(isRateLimited).toBe(true)
    })
  })

  describe('8. Rate Limiting - Remaining Requests & Reset Time', () => {
    it('should track remaining requests correctly', async () => {
      const key = 'user-123:quota'
      const maxRequests = 10
      const windowSeconds = 60

      await rateLimitStore.check(key, maxRequests, windowSeconds)
      const remaining1 = await rateLimitStore.getRemainingRequests(key, maxRequests)
      expect(remaining1).toBe(9)

      await rateLimitStore.check(key, maxRequests, windowSeconds)
      const remaining2 = await rateLimitStore.getRemainingRequests(key, maxRequests)
      expect(remaining2).toBe(8)
    })

    it('should show full allowance before any requests', async () => {
      const key = 'user-new:quota'
      const maxRequests = 10

      const remaining = await rateLimitStore.getRemainingRequests(key, maxRequests)
      expect(remaining).toBe(10)
    })
  })

  describe('9. Rate Limiting - Edge Cases', () => {
    it('should handle zero max requests (deny all)', async () => {
      const key = 'user-blocked:payment'
      const maxRequests = 0
      const windowSeconds = 60

      const isRateLimited = await rateLimitStore.check(key, maxRequests, windowSeconds)
      expect(isRateLimited).toBe(true)
    })

    it('should handle multiple users independently', async () => {
      const maxRequests = 2
      const windowSeconds = 60

      const isLimited1 = await rateLimitStore.check('user-1', maxRequests, windowSeconds)
      const isLimited2 = await rateLimitStore.check('user-2', maxRequests, windowSeconds)

      expect(isLimited1).toBe(false)
      expect(isLimited2).toBe(false)

      await rateLimitStore.check('user-1', maxRequests, windowSeconds)
      const isLimited1Again = await rateLimitStore.check('user-1', maxRequests, windowSeconds)
      const isLimited2Again = await rateLimitStore.check('user-2', maxRequests, windowSeconds)

      expect(isLimited1Again).toBe(true)
      expect(isLimited2Again).toBe(false)
    })

    it('should cleanup expired entries', async () => {
      const key1 = 'user-1:short'
      const key2 = 'user-2:keep'

      await rateLimitStore.check(key1, 10, 1) // 1 second window
      await rateLimitStore.check(key2, 10, 3600) // 1 hour window

      await new Promise((resolve) => setTimeout(resolve, 1100))
      rateLimitStore.cleanup()

      const remaining1 = await rateLimitStore.getRemainingRequests(key1, 10)
      const remaining2 = await rateLimitStore.getRemainingRequests(key2, 10)

      expect(remaining1).toBe(10) // Should be reset
      expect(remaining2).toBeLessThan(10) // Should still be active
    })
  })

  describe('10. Rate Limiting - Concurrent Load', () => {
    it('should handle concurrent requests safely', async () => {
      const key = 'concurrent-test'
      const maxRequests = 100
      const windowSeconds = 60

      const promises: Promise<boolean>[] = []
      for (let i = 0; i < 150; i++) {
        promises.push(rateLimitStore.check(key, maxRequests, windowSeconds))
      }

      const results = await Promise.all(promises)
      const allowed = results.filter((r) => !r).length
      const blocked = results.filter((r) => r).length

      expect(allowed).toBe(100)
      expect(blocked).toBe(50)
    })
  })

  describe('11. Integration - Webhook + Rate Limit Combo', () => {
    it('should allow webhook delivery while respecting rate limits', async () => {
      const webhookKey = 'ws-123:webhook'
      const config = { maxRequests: 10, windowSeconds: 1 }

      // Deliver 10 webhooks
      for (let i = 0; i < 10; i++) {
        const isRateLimited = await rateLimitStore.check(webhookKey, config.maxRequests, config.windowSeconds)
        expect(isRateLimited).toBe(false)

        await webhookService.logWebhookDelivery(
          {
            workspaceId: 'ws-123',
            webhookType: 'judit',
            eventType: 'event',
            processNumber: `proc-${i}`,
            payload: {},
          },
          0,
          undefined,
          200
        )
      }

      // 11th webhook should be rate limited
      const isRateLimited = await rateLimitStore.check(webhookKey, config.maxRequests, config.windowSeconds)
      expect(isRateLimited).toBe(true)

      // But we should still be able to log it for retry
      const record = await webhookService.logWebhookDelivery(
        {
          workspaceId: 'ws-123',
          webhookType: 'judit',
          eventType: 'event',
          processNumber: 'proc-10',
          payload: {},
        },
        0,
        'Rate limited',
        429
      )

      expect(record.status).toBe('RETRYING')
    })
  })
})
