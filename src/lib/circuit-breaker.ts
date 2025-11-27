/**
 * Circuit Breaker Pattern Implementation
 * ================================================================
 * Provides fault tolerance and automatic recovery for external service calls
 * Prevents cascading failures when downstream services are unavailable
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service unavailable, requests fail immediately (fast-fail)
 * - HALF_OPEN: Testing if service recovered, limited requests allowed
 */

import { log, logError } from '@/lib/services/logger'

export interface CircuitBreakerConfig {
  // Failure threshold (number of failures before opening)
  failureThreshold: number
  // Time window for counting failures (ms)
  failureWindow: number
  // Timeout for half-open state (ms) - how long to wait before retrying
  halfOpenTimeout: number
  // Maximum concurrent requests in half-open state
  halfOpenRequests: number
  // Custom error handler
  onStateChange?: (newState: CircuitBreakerState) => void
}

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

interface RequestRecord {
  timestamp: number
  success: boolean
}

/**
 * Circuit Breaker Implementation
 * Wraps external service calls with automatic fault tolerance
 */
export class CircuitBreaker {
  private state: CircuitBreakerState = 'CLOSED'
  private failureCount = 0
  private lastFailureTime = 0
  private requestHistory: RequestRecord[] = []
  private halfOpenAttempts = 0
  private readonly config: Required<CircuitBreakerConfig>

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: config.failureThreshold || 5,
      failureWindow: config.failureWindow || 60000, // 1 minute
      halfOpenTimeout: config.halfOpenTimeout || 30000, // 30 seconds
      halfOpenRequests: config.halfOpenRequests || 3,
      onStateChange: config.onStateChange || (() => {}),
    }
  }

  /**
   * Execute a request with circuit breaker protection
   */
  async execute<T>(
    fn: () => Promise<T>,
    fallback?: () => Promise<T> | T
  ): Promise<T> {
    // Check current state
    this.updateState()

    if (this.state === 'OPEN') {
      if (fallback) {
        log.warn({
          msg: 'Circuit breaker OPEN, using fallback',
          component: 'circuitBreaker',
          state: this.state,
        })
        return fallback()
      }

      throw new Error('Circuit breaker is OPEN - service unavailable')
    }

    if (this.state === 'HALF_OPEN') {
      if (this.halfOpenAttempts >= this.config.halfOpenRequests) {
        throw new Error('Circuit breaker HALF_OPEN - max concurrent requests exceeded')
      }
    }

    try {
      const result = await fn()
      this.recordSuccess()
      return result
    } catch (error) {
      this.recordFailure()

      if (fallback) {
        log.warn({
          msg: 'Request failed, using fallback',
          component: 'circuitBreaker',
          error: error instanceof Error ? error.message : String(error),
        })
        return fallback()
      }

      throw error
    }
  }

  /**
   * Update circuit breaker state based on failure history
   */
  private updateState(): void {
    const now = Date.now()

    // Clean up old failures outside the failure window
    this.requestHistory = this.requestHistory.filter(
      (record) => now - record.timestamp < this.config.failureWindow
    )

    const failures = this.requestHistory.filter((r) => !r.success).length

    switch (this.state) {
      case 'CLOSED':
        // Transition to OPEN if failure threshold exceeded
        if (failures >= this.config.failureThreshold) {
          this.setState('OPEN')
          this.lastFailureTime = now
        }
        break

      case 'OPEN':
        // Transition to HALF_OPEN if timeout elapsed
        if (now - this.lastFailureTime >= this.config.halfOpenTimeout) {
          this.setState('HALF_OPEN')
          this.halfOpenAttempts = 0
        }
        break

      case 'HALF_OPEN':
        // Transition back to CLOSED if all recent requests succeed
        const recentRequests = this.requestHistory.slice(-this.config.halfOpenRequests)
        if (recentRequests.length > 0 && recentRequests.every((r) => r.success)) {
          this.setState('CLOSED')
          this.failureCount = 0
        }
        // Transition to OPEN if any request fails
        else if (recentRequests.some((r) => !r.success)) {
          this.setState('OPEN')
          this.lastFailureTime = now
        }
        break
    }
  }

  /**
   * Record successful request
   */
  private recordSuccess(): void {
    this.requestHistory.push({
      timestamp: Date.now(),
      success: true,
    })

    if (this.state === 'HALF_OPEN') {
      this.halfOpenAttempts++
    }

    log.debug({
      msg: 'Circuit breaker request succeeded',
      component: 'circuitBreaker',
      state: this.state,
    })
  }

  /**
   * Record failed request
   */
  private recordFailure(): void {
    this.requestHistory.push({
      timestamp: Date.now(),
      success: false,
    })

    this.failureCount++
    this.lastFailureTime = Date.now()

    log.warn({
      msg: 'Circuit breaker request failed',
      component: 'circuitBreaker',
      state: this.state,
      failureCount: this.failureCount,
    })
  }

  /**
   * Transition to new state
   */
  private setState(newState: CircuitBreakerState): void {
    if (newState !== this.state) {
      const previousState = this.state
      this.state = newState

      log.info({
        msg: 'Circuit breaker state changed',
        component: 'circuitBreaker',
        previousState,
        newState,
      })

      this.config.onStateChange?.(newState)
    }
  }

  /**
   * Get current state
   */
  getState(): CircuitBreakerState {
    this.updateState()
    return this.state
  }

  /**
   * Get metrics
   */
  getMetrics() {
    const now = Date.now()
    const recentRequests = this.requestHistory.filter(
      (r) => now - r.timestamp < this.config.failureWindow
    )

    const successCount = recentRequests.filter((r) => r.success).length
    const failureCount = recentRequests.filter((r) => !r.success).length

    return {
      state: this.state,
      successCount,
      failureCount,
      totalRequests: recentRequests.length,
      successRate: recentRequests.length > 0 ? successCount / recentRequests.length : 0,
    }
  }

  /**
   * Reset circuit breaker to CLOSED state
   */
  reset(): void {
    this.setState('CLOSED')
    this.failureCount = 0
    this.requestHistory = []
    this.halfOpenAttempts = 0
  }
}

/**
 * Create circuit breaker instance for external service
 */
export function createCircuitBreaker(
  serviceName: string,
  config?: Partial<CircuitBreakerConfig>
): CircuitBreaker {
  const breaker = new CircuitBreaker({
    ...config,
    onStateChange: (state) => {
      log.warn({
        msg: `Circuit breaker for ${serviceName} changed state`,
        component: 'circuitBreaker',
        service: serviceName,
        newState: state,
      })
    },
  })

  return breaker
}
