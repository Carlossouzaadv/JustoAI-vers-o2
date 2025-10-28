// ================================================================
// STRUCTURED LOGGING SYSTEM
// Sistema de logs estruturados para debugging e observabilidade
// ================================================================

import pino from 'pino';

// ================================================================
// CONFIGURATION
// ================================================================

const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),

  // Pretty print in development, JSON in production
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,

  // Base fields included in all logs
  base: {
    service: 'justoai-judit-integration',
    environment: process.env.NODE_ENV || 'development',
  },

  // Timestamp format
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
});

// ================================================================
// SPECIALIZED LOGGERS
// ================================================================

/**
 * Logger específico para operações da JUDIT API
 * Prefix: [JUDIT]
 */
export const juditLogger = logger.child({
  module: 'judit-api',
  prefix: '[JUDIT]',
});

/**
 * Logger para operações de queue/worker
 * Prefix: [QUEUE] or [WORKER] (via child logger)
 */
export const queueLogger = logger.child({
  module: 'queue',
  prefix: '[QUEUE]',
});

/**
 * Logger para métricas e performance
 * Prefix: [METRICS]
 */
export const metricsLogger = logger.child({
  module: 'metrics',
  prefix: '[METRICS]',
});

/**
 * Logger para alertas e notificações
 * Prefix: [ALERTS]
 */
export const alertLogger = logger.child({
  module: 'alerts',
  prefix: '[ALERTS]',
});

/**
 * Logger para custos
 * Prefix: [COSTS]
 */
export const costLogger = logger.child({
  module: 'costs',
  prefix: '[COSTS]',
});

// ================================================================
// HELPER FUNCTIONS
// ================================================================

/**
 * Log de início de operação com timer
 */
export function logOperationStart(
  loggerInstance: typeof logger,
  operation: string,
  metadata?: Record<string, unknown>
) {
  const startTime = Date.now();

  loggerInstance.info({
    operation,
    status: 'started',
    ...metadata,
  });

  return {
    startTime,
    finish: (result?: 'success' | 'failure', additionalData?: Record<string, unknown>) => {
      const duration = Date.now() - startTime;

      const logLevel = result === 'failure' ? 'error' : 'info';

      loggerInstance[logLevel]({
        operation,
        status: result || 'completed',
        duration_ms: duration,
        ...metadata,
        ...additionalData,
      });

      return duration;
    },
  };
}

/**
 * Log de erro com contexto completo
 */
export function logError(
  loggerInstance: typeof logger,
  error: Error | unknown,
  context?: Record<string, unknown>
) {
  const errorInfo = error instanceof Error
    ? {
        error_message: error.message,
        error_name: error.name,
        error_stack: error.stack,
      }
    : {
        error_message: String(error),
      };

  loggerInstance.error({
    ...errorInfo,
    ...context,
  });
}

/**
 * Log de API request/response
 */
export function logApiCall(
  method: string,
  endpoint: string,
  statusCode?: number,
  duration?: number,
  metadata?: Record<string, unknown>
) {
  juditLogger.info({
    type: 'api_call',
    method,
    endpoint,
    status_code: statusCode,
    duration_ms: duration,
    ...metadata,
  });
}

/**
 * Log de métrica personalizada
 */
export function logMetric(
  metricName: string,
  value: number,
  unit: string,
  tags?: Record<string, string>
) {
  metricsLogger.info({
    type: 'metric',
    metric_name: metricName,
    value,
    unit,
    tags,
  });
}

// ================================================================
// TYPES
// ================================================================

export type Logger = typeof logger;
export type ChildLogger = ReturnType<typeof logger.child>;
