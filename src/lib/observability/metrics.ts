// ================================================================
// METRICS COLLECTION SERVICE
// Rastreamento de performance, latência e throughput
// ================================================================

import { metricsLogger } from './logger';

// ================================================================
// TYPES
// ================================================================

interface MetricValue {
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
  p50?: number;
  p95?: number;
  p99?: number;
  values: number[]; // For percentile calculation
}

interface MetricEntry {
  timestamp: Date;
  value: number;
  tags?: Record<string, string>;
}

// ================================================================
// IN-MEMORY METRICS STORE
// ================================================================

class MetricsCollector {
  private metrics: Map<string, MetricValue> = new Map();
  private timeSeries: Map<string, MetricEntry[]> = new Map();
  private readonly MAX_TIME_SERIES_LENGTH = 1000;

  /**
   * Incrementa um contador
   */
  increment(metricName: string, value: number = 1, tags?: Record<string, string>): void {
    const key = this.getMetricKey(metricName, tags);
    const metric = this.getOrCreateMetric(key);

    metric.count += value;
    metric.sum += value;

    this.recordTimeSeries(key, value, tags);

    metricsLogger.debug({
      action: 'increment',
      metric: metricName,
      value,
      tags,
    });
  }

  /**
   * Define um valor gauge (medida instantânea)
   */
  gauge(metricName: string, value: number, tags?: Record<string, string>): void {
    const key = this.getMetricKey(metricName, tags);
    const metric = this.getOrCreateMetric(key);

    metric.count = 1;
    metric.sum = value;
    metric.min = value;
    metric.max = value;
    metric.avg = value;

    this.recordTimeSeries(key, value, tags);

    metricsLogger.debug({
      action: 'gauge',
      metric: metricName,
      value,
      tags,
    });
  }

  /**
   * Registra uma medição de histograma (para latências, tamanhos, etc)
   */
  histogram(metricName: string, value: number, tags?: Record<string, string>): void {
    const key = this.getMetricKey(metricName, tags);
    const metric = this.getOrCreateMetric(key);

    metric.count++;
    metric.sum += value;
    metric.min = Math.min(metric.min, value);
    metric.max = Math.max(metric.max, value);
    metric.avg = metric.sum / metric.count;
    metric.values.push(value);

    // Keep only last 1000 values for percentile calculation
    if (metric.values.length > 1000) {
      metric.values.shift();
    }

    this.recordTimeSeries(key, value, tags);

    metricsLogger.debug({
      action: 'histogram',
      metric: metricName,
      value,
      tags,
    });
  }

  /**
   * Registra duração de uma operação (timer)
   */
  timing(metricName: string, durationMs: number, tags?: Record<string, string>): void {
    this.histogram(`${metricName}.duration_ms`, durationMs, tags);
  }

  /**
   * Helper para medir duração de operações
   */
  startTimer(metricName: string, tags?: Record<string, string>) {
    const startTime = Date.now();

    return {
      end: () => {
        const duration = Date.now() - startTime;
        this.timing(metricName, duration, tags);
        return duration;
      },
    };
  }

  /**
   * Busca métricas agregadas
   */
  getMetric(metricName: string, tags?: Record<string, string>): MetricValue | null {
    const key = this.getMetricKey(metricName, tags);
    const metric = this.metrics.get(key);

    if (!metric) return null;

    // Calculate percentiles if we have values
    if (metric.values.length > 0) {
      const sorted = [...metric.values].sort((a, b) => a - b);
      metric.p50 = this.calculatePercentile(sorted, 50);
      metric.p95 = this.calculatePercentile(sorted, 95);
      metric.p99 = this.calculatePercentile(sorted, 99);
    }

    return metric;
  }

  /**
   * Busca todas as métricas
   */
  getAllMetrics(): Record<string, MetricValue> {
    const result: Record<string, MetricValue> = {};

    for (const [key, metric] of this.metrics.entries()) {
      if (metric.values.length > 0) {
        const sorted = [...metric.values].sort((a, b) => a - b);
        metric.p50 = this.calculatePercentile(sorted, 50);
        metric.p95 = this.calculatePercentile(sorted, 95);
        metric.p99 = this.calculatePercentile(sorted, 99);
      }

      result[key] = metric;
    }

    return result;
  }

  /**
   * Busca série temporal de uma métrica
   */
  getTimeSeries(
    metricName: string,
    tags?: Record<string, string>,
    since?: Date
  ): MetricEntry[] {
    const key = this.getMetricKey(metricName, tags);
    const series = this.timeSeries.get(key) || [];

    if (since) {
      return series.filter((entry) => entry.timestamp >= since);
    }

    return series;
  }

  /**
   * Reseta todas as métricas
   */
  reset(): void {
    this.metrics.clear();
    this.timeSeries.clear();
    metricsLogger.info({ action: 'reset_metrics' });
  }

  /**
   * Reseta métricas antigas (mantém últimas 24h)
   */
  cleanup(olderThan: Date = new Date(Date.now() - 24 * 60 * 60 * 1000)): void {
    let cleaned = 0;

    for (const [key, series] of this.timeSeries.entries()) {
      const filtered = series.filter((entry) => entry.timestamp >= olderThan);

      if (filtered.length !== series.length) {
        this.timeSeries.set(key, filtered);
        cleaned += series.length - filtered.length;
      }

      // Remove metric if no data left
      if (filtered.length === 0) {
        this.metrics.delete(key);
        this.timeSeries.delete(key);
      }
    }

    metricsLogger.info({
      action: 'cleanup_metrics',
      entries_removed: cleaned,
      older_than: olderThan.toISOString(),
    });
  }

  // ================================================================
  // PRIVATE HELPERS
  // ================================================================

  private getMetricKey(metricName: string, tags?: Record<string, string>): string {
    if (!tags || Object.keys(tags).length === 0) {
      return metricName;
    }

    const tagStr = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join(',');

    return `${metricName}{${tagStr}}`;
  }

  private getOrCreateMetric(key: string): MetricValue {
    let metric = this.metrics.get(key);

    if (!metric) {
      metric = {
        count: 0,
        sum: 0,
        min: Infinity,
        max: -Infinity,
        avg: 0,
        values: [],
      };
      this.metrics.set(key, metric);
    }

    return metric;
  }

  private recordTimeSeries(key: string, value: number, tags?: Record<string, string>): void {
    let series = this.timeSeries.get(key);

    if (!series) {
      series = [];
      this.timeSeries.set(key, series);
    }

    series.push({
      timestamp: new Date(),
      value,
      tags,
    });

    // Keep only last N entries
    if (series.length > this.MAX_TIME_SERIES_LENGTH) {
      series.shift();
    }
  }

  private calculatePercentile(sortedValues: number[], percentile: number): number {
    const index = (percentile / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    if (upper >= sortedValues.length) {
      return sortedValues[sortedValues.length - 1];
    }

    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }
}

// ================================================================
// SINGLETON INSTANCE
// ================================================================

export const metrics = new MetricsCollector();

// Auto-cleanup every hour
if (typeof setInterval !== 'undefined') {
  setInterval(
    () => {
      metrics.cleanup();
    },
    60 * 60 * 1000
  ); // 1 hour
}

// ================================================================
// JUDIT-SPECIFIC METRICS HELPERS
// ================================================================

/**
 * Métricas específicas da JUDIT API
 */
export const juditMetrics = {
  /**
   * Registra uma chamada à API
   */
  recordApiCall(
    endpoint: string,
    method: string,
    statusCode: number,
    durationMs: number
  ): void {
    metrics.increment('judit.api.calls.total', 1, {
      endpoint,
      method,
      status: String(statusCode),
    });

    metrics.histogram('judit.api.latency_ms', durationMs, {
      endpoint,
      method,
    });

    if (statusCode >= 400) {
      metrics.increment('judit.api.errors.total', 1, {
        endpoint,
        method,
        status: String(statusCode),
      });
    }
  },

  /**
   * Registra rate limiting
   */
  recordRateLimit(): void {
    metrics.increment('judit.api.rate_limited.total');
  },

  /**
   * Registra circuit breaker aberto
   */
  recordCircuitBreakerOpen(): void {
    metrics.increment('judit.circuit_breaker.opened.total');
  },

  /**
   * Registra operação de onboarding
   */
  recordOnboarding(status: 'success' | 'failure', durationMs: number): void {
    metrics.increment('judit.onboarding.total', 1, { status });
    metrics.histogram('judit.onboarding.duration_ms', durationMs);
  },

  /**
   * Registra verificação de monitoramento
   */
  recordMonitoringCheck(hasUpdates: boolean): void {
    metrics.increment('judit.monitoring.checks.total', 1, {
      has_updates: String(hasUpdates),
    });
  },

  /**
   * Registra análise de anexos
   */
  recordAttachmentAnalysis(shouldFetch: boolean, keywordsMatched: number): void {
    metrics.increment('judit.attachment_analysis.total', 1, {
      should_fetch: String(shouldFetch),
    });

    if (shouldFetch) {
      metrics.increment('judit.attachment_fetch.triggered.total');
      metrics.histogram('judit.attachment_analysis.keywords_matched', keywordsMatched);
    }
  },

  /**
   * Registra job na fila
   */
  recordQueueJob(status: 'added' | 'processing' | 'completed' | 'failed'): void {
    metrics.increment('judit.queue.jobs.total', 1, { status });
  },

  /**
   * Registra tamanho da fila
   */
  recordQueueSize(waiting: number, active: number, failed: number): void {
    metrics.gauge('judit.queue.waiting', waiting);
    metrics.gauge('judit.queue.active', active);
    metrics.gauge('judit.queue.failed', failed);
  },
};

// ================================================================
// EXPORT
// ================================================================

export type { MetricValue, MetricEntry };
