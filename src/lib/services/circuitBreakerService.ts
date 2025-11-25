import { EventEmitter } from 'eventemitter3'
import { logger, queueLogger } from '../observability/logger'
import { getErrorMessage } from '../types/type-guards'

export enum CircuitBreakerState {
  CLOSED = 'CLOSED', // All systems operational
  OPEN = 'OPEN', // Quota exceeded, queue paused
  HALF_OPEN = 'HALF_OPEN', // Attempting recovery
}

export interface CircuitBreakerConfig {
  autoRetryInterval: 'DISABLED' | '30MIN' | '1HOUR' // 30 minutes or 1 hour
  lastErrorTime?: Date
  errorMessage?: string
}

export interface CircuitBreakerStatus {
  state: CircuitBreakerState
  config: CircuitBreakerConfig
  nextRetryAttempt?: Date
  upstashQuotaExceeded: boolean
  queuePaused: boolean
}

/**
 * CircuitBreakerService - Detects Upstash quota limits and prevents cascading retries
 * When quota is hit, automatically pauses the queue and optionally attempts recovery
 */
class CircuitBreakerService extends EventEmitter {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED
  private config: CircuitBreakerConfig = {
    autoRetryInterval: 'DISABLED',
  }
  private queuePausedFlag = false
  private retryTimeoutId: NodeJS.Timeout | null = null
  private retryAttemptCount = 0
  private lastQuotaErrorTime: Date | null = null

  constructor() {
    super()
    this.initializeFromEnv()
  }

  /**
   * Initialize config from environment variables
   * Default: 1HOUR auto-retry (enabled by default for production resilience)
   */
  private initializeFromEnv() {
    const autoRetry = process.env.CIRCUIT_BREAKER_AUTO_RETRY || '1HOUR'
    if (['DISABLED', '30MIN', '1HOUR'].includes(autoRetry)) {
      this.config.autoRetryInterval = autoRetry as
        | 'DISABLED'
        | '30MIN'
        | '1HOUR'
    }
    logger.info({
      action: 'circuit_breaker_initialized',
      component: 'circuit-breaker',
      config: this.config,
      message: `Auto-retry set to ${this.config.autoRetryInterval}`,
    })
  }

  /**
   * Detect if error is Upstash quota exceeded
   * Uses safe error extraction with type narrowing
   */
  isQuotaExceededError(error: unknown): boolean {
    if (!error) return false

    // Use safe error message extraction helper (Padrão-Ouro)
    const errorStr = getErrorMessage(error)
    return (
      errorStr.includes('ERR max requests limit exceeded') ||
      errorStr.includes('max_requests_limit') ||
      errorStr.includes('quota')
    )
  }

  /**
   * Trigger circuit breaker when quota is detected
   * Uses safe error extraction with type narrowing
   */
  triggerQuotaExceeded(error: unknown) {
    if (this.state === CircuitBreakerState.OPEN) {
      // Already open, don't spam logs
      return
    }

    this.lastQuotaErrorTime = new Date()
    // Use safe error message extraction helper (Padrão-Ouro)
    this.config.errorMessage = getErrorMessage(error)
    this.config.lastErrorTime = new Date()

    queueLogger.error({
      action: 'upstash_quota_exceeded',
      component: 'circuit-breaker',
      message: this.config.errorMessage,
      state: 'OPENING_CIRCUIT',
    })

    this.state = CircuitBreakerState.OPEN
    this.emit('circuit-opened', {
      state: this.state,
      error: this.config.errorMessage,
    })

    // Pause the queue immediately
    this.pauseQueue()

    // Start recovery if enabled
    if (this.config.autoRetryInterval !== 'DISABLED') {
      this.scheduleRetry()
    }
  }

  /**
   * Pause the queue to prevent more Redis requests
   */
  private pauseQueue() {
    if (this.queuePausedFlag) return

    queueLogger.warn({
      action: 'queue_paused',
      component: 'circuit-breaker',
      reason: 'Upstash quota exceeded',
    })

    this.queuePausedFlag = true
    this.emit('queue-paused', { reason: 'Upstash quota exceeded' })
  }

  /**
   * Resume the queue
   */
  private resumeQueue() {
    if (!this.queuePausedFlag) return

    queueLogger.info({
      action: 'queue_resumed',
      component: 'circuit-breaker',
      reason: 'Circuit breaker recovered',
    })

    this.queuePausedFlag = false
    this.state = CircuitBreakerState.CLOSED
    this.retryAttemptCount = 0

    // Clear unknown pending retry timeout
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId)
      this.retryTimeoutId = null
    }

    this.emit('queue-resumed')
  }

  /**
   * Schedule automatic retry attempt based on config
   */
  private scheduleRetry() {
    // Clear existing timeout if unknown
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId)
    }

    if (this.config.autoRetryInterval === 'DISABLED') {
      return
    }

    const intervalMs =
      this.config.autoRetryInterval === '30MIN' ? 30 * 60 * 1000 : 60 * 60 * 1000

    const nextAttempt = new Date(Date.now() + intervalMs)

    queueLogger.info({
      action: 'auto_retry_scheduled',
      component: 'circuit-breaker',
      interval: this.config.autoRetryInterval,
      nextAttempt: nextAttempt.toISOString(),
      attemptNumber: this.retryAttemptCount + 1,
    })

    this.retryTimeoutId = setTimeout(() => {
      this.attemptRecovery()
    }, intervalMs)

    this.emit('retry-scheduled', { nextAttempt })
  }

  /**
   * Attempt recovery by testing Redis connection
   */
  private async attemptRecovery() {
    this.state = CircuitBreakerState.HALF_OPEN
    this.retryAttemptCount++

    queueLogger.info({
      action: 'recovery_attempt',
      component: 'circuit-breaker',
      attemptNumber: this.retryAttemptCount,
    })

    this.emit('recovery-attempt', { attemptNumber: this.retryAttemptCount })

    try {
      // Try a simple Redis PING
      const { getRedisClient } = await import('../redis')
      const redisClient = getRedisClient()
      if (redisClient && typeof redisClient.ping === 'function') {
        await redisClient.ping()

        queueLogger.info({
          action: 'recovery_successful',
          component: 'circuit-breaker',
          attemptNumber: this.retryAttemptCount,
        })

        this.resumeQueue()
        return
      }
    } catch (_error) {
      queueLogger.warn({
        action: 'recovery_failed',
        component: 'circuit-breaker',
        attemptNumber: this.retryAttemptCount,
        error: String(error),
      })

      // Check if still quota error
      if (this.isQuotaExceededError(error)) {
        // Stay in HALF_OPEN and reschedule
        this.state = CircuitBreakerState.OPEN
        this.scheduleRetry()
      }
    }
  }

  /**
   * Manually trigger recovery attempt (for manual resume)
   */
  async manualRecoveryAttempt(): Promise<boolean> {
    queueLogger.info({
      action: 'manual_recovery_attempt',
      component: 'circuit-breaker',
    })

    try {
      const { getRedisClient } = await import('../redis')
      const redisClient = getRedisClient()
      if (redisClient && typeof redisClient.ping === 'function') {
        await redisClient.ping()

        queueLogger.info({
          action: 'manual_recovery_successful',
          component: 'circuit-breaker',
        })

        this.resumeQueue()
        return true
      }
    } catch (_error) {
      queueLogger.error({
        action: 'manual_recovery_failed',
        component: 'circuit-breaker',
        error: String(error),
      })

      // If still quota error, open circuit
      if (this.isQuotaExceededError(error)) {
        this.state = CircuitBreakerState.OPEN
        return false
      }
    }

    return false
  }

  /**
   * Configure auto-retry interval
   */
  setAutoRetryInterval(interval: 'DISABLED' | '30MIN' | '1HOUR') {
    this.config.autoRetryInterval = interval

    queueLogger.info({
      action: 'auto_retry_config_changed',
      component: 'circuit-breaker',
      newInterval: interval,
    })

    this.emit('config-changed', { autoRetryInterval: interval })

    // If circuit is open and we just enabled auto-retry, schedule it
    if (
      this.state === CircuitBreakerState.OPEN &&
      interval !== 'DISABLED' &&
      !this.retryTimeoutId
    ) {
      this.scheduleRetry()
    }
  }

  /**
   * Get current status
   */
  getStatus(): CircuitBreakerStatus {
    return {
      state: this.state,
      config: this.config,
      nextRetryAttempt: this.retryTimeoutId
        ? new Date(Date.now() + (this.getRetryIntervalMs() || 0))
        : undefined,
      upstashQuotaExceeded: this.state === CircuitBreakerState.OPEN,
      queuePaused: this.queuePausedFlag,
    }
  }

  /**
   * Check if queue is paused
   */
  isQueuePaused(): boolean {
    return this.queuePausedFlag
  }

  /**
   * Get retry interval in milliseconds
   */
  private getRetryIntervalMs(): number {
    if (this.config.autoRetryInterval === '30MIN') {
      return 30 * 60 * 1000
    }
    if (this.config.autoRetryInterval === '1HOUR') {
      return 60 * 60 * 1000
    }
    return 0
  }

  /**
   * Force close circuit manually (reset state)
   */
  forceClose() {
    queueLogger.warn({
      action: 'circuit_breaker_force_closed',
      component: 'circuit-breaker',
      previousState: this.state,
    })

    this.state = CircuitBreakerState.CLOSED
    this.resumeQueue()
    this.config.lastErrorTime = undefined
    this.config.errorMessage = undefined
  }

  /**
   * Cleanup - clear timeouts
   */
  destroy() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId)
      this.retryTimeoutId = null
    }
    this.removeAllListeners()
  }
}

// Export singleton instance
export const circuitBreakerService = new CircuitBreakerService()
