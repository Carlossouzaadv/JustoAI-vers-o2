/**
 * Winston Logger Configuration
 * Sistema de logs estruturados para produção
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import type { Request as ExpressRequest, Response as ExpressResponse, NextFunction as ExpressNextFunction } from 'express';

// Augment Express namespace for compatibility
declare global {
  namespace Express {
    interface Request extends ExpressRequest {}
    interface Response extends ExpressResponse {}
    interface NextFunction extends ExpressNextFunction {}
  }
}

// === TIPOS ===

export interface LogContext {
  userId?: string;
  workspaceId?: string;
  requestId?: string;
  correlationId?: string;
  userAgent?: string;
  ip?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  duration?: number;
  error?: Error | string;
  [key: string]: unknown;
}

export interface StructuredLog {
  level: string;
  message: string;
  timestamp: string;
  service: string;
  environment: string;
  context?: LogContext;
  metadata?: Record<string, unknown>;
}

// === CONFIGURAÇÕES ===

const LOG_CONFIG = {
  // Níveis de log
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
  },

  // Cores para console
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'cyan',
  },

  // Configuração de arquivos
  files: {
    error: {
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
    },
    combined: {
      filename: 'logs/combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '7d',
    },
    http: {
      filename: 'logs/http-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '7d',
    },
    performance: {
      filename: 'logs/performance-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '10m',
      maxFiles: '3d',
    },
  },

  // Configuração do ambiente
  service: 'justoai-v2',
  environment: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
};

// === FORMATTERS ===

/**
 * Formatter personalizado para desenvolvimento
 */
const developmentFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, service, context, metadata }) => {
    let log = `[${timestamp}] ${level}: ${message}`;

    if (context) {
      const contextStr = Object.entries(context)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => `${key}=${value}`)
        .join(' ');

      if (contextStr) {
        log += ` | ${contextStr}`;
      }
    }

    if (metadata && Object.keys(metadata).length > 0) {
      log += `\\n${JSON.stringify(metadata, null, 2)}`;
    }

    return log;
  })
);

/**
 * Formatter para produção (JSON estruturado)
 */
const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf((info) => {
    const infoRecord = info as Record<string, unknown>;
    const logEntry: StructuredLog = {
      level: info.level as string,
      message: info.message as string,
      timestamp: info.timestamp as string,
      service: LOG_CONFIG.service,
      environment: LOG_CONFIG.environment,
      context: infoRecord.context as LogContext | undefined,
      metadata: infoRecord.metadata as Record<string, unknown> | undefined,
    };

    // Incluir stack trace para erros
    if (info.stack) {
      logEntry.metadata = {
        ...logEntry.metadata,
        stack: info.stack,
      };
    }

    return JSON.stringify(logEntry);
  })
);

// === TRANSPORTS ===

const transports: winston.transport[] = [];

// Console transport
transports.push(
  new winston.transports.Console({
    format: LOG_CONFIG.environment === 'production' ? productionFormat : developmentFormat,
    level: LOG_CONFIG.logLevel,
  })
);

// File transports para produção
if (LOG_CONFIG.environment === 'production') {
  // Log de erros
  transports.push(
    new DailyRotateFile({
      ...LOG_CONFIG.files.error,
      level: 'error',
      format: productionFormat,
    })
  );

  // Log combinado
  transports.push(
    new DailyRotateFile({
      ...LOG_CONFIG.files.combined,
      format: productionFormat,
    })
  );

  // Log HTTP
  transports.push(
    new DailyRotateFile({
      ...LOG_CONFIG.files.http,
      level: 'http',
      format: productionFormat,
    })
  );

  // Log de performance
  transports.push(
    new DailyRotateFile({
      ...LOG_CONFIG.files.performance,
      level: 'info',
      format: productionFormat,
    })
  );
}

// === LOGGER PRINCIPAL ===

winston.addColors(LOG_CONFIG.colors);

export const logger = winston.createLogger({
  levels: LOG_CONFIG.levels,
  level: LOG_CONFIG.logLevel,
  transports,
  exitOnError: false,

  // Tratamento de exceções não capturadas
  exceptionHandlers: LOG_CONFIG.environment === 'production' ? [
    new DailyRotateFile({
      filename: 'logs/exceptions-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      format: productionFormat,
    })
  ] : [],

  // Tratamento de promise rejections
  rejectionHandlers: LOG_CONFIG.environment === 'production' ? [
    new DailyRotateFile({
      filename: 'logs/rejections-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      format: productionFormat,
    })
  ] : [],
});

// === LOGGERS ESPECIALIZADOS ===

/**
 * Logger para requests HTTP
 */
export const httpLogger = logger.child({ component: 'http' });

/**
 * Logger para performance
 */
export const performanceLogger = logger.child({ component: 'performance' });

/**
 * Logger para workers
 */
export const workerLogger = logger.child({ component: 'worker' });

/**
 * Logger para AI operations
 */
export const aiLogger = logger.child({ component: 'ai' });

/**
 * Logger para database operations
 */
export const dbLogger = logger.child({ component: 'database' });

// === FUNÇÕES UTILITÁRIAS ===

/**
 * Log estruturado com contexto
 */
function logWithContext(
  level: keyof typeof LOG_CONFIG.levels,
  message: string,
  context?: LogContext,
  metadata?: Record<string, unknown>
) {
  logger.log(level, message, { context, metadata });
}

/**
 * Log de erro com stack trace
 */
function logError(
  message: string,
  error: Error | string,
  context?: LogContext
) {
  const errorObj = error instanceof Error ? error : new Error(error);

  logger.error(message, {
    context: {
      ...context,
      error: errorObj.message,
    },
    metadata: {
      stack: errorObj.stack,
      name: errorObj.name,
    },
  });
}

/**
 * Log de performance
 */
function logPerformance(
  operation: string,
  duration: number,
  context?: LogContext,
  metadata?: Record<string, unknown>
) {
  performanceLogger.info(`${operation} completed`, {
    context: {
      ...context,
      duration,
      operation,
    },
    metadata,
  });
}

/**
 * Log de request HTTP
 */
function logHttpRequest(
  method: string,
  url: string,
  statusCode: number,
  duration: number,
  context?: Omit<LogContext, 'method' | 'url' | 'statusCode' | 'duration'>
) {
  const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'http';

  httpLogger.log(level, `${method} ${url}`, {
    context: {
      ...context,
      method,
      url,
      statusCode,
      duration,
    },
  });
}

/**
 * Log de operação AI
 */
function logAIOperation(
  operation: string,
  model: string,
  tokens?: number,
  duration?: number,
  context?: LogContext
) {
  aiLogger.info(`AI ${operation}`, {
    context: {
      ...context,
      operation,
      model,
      tokens,
      duration,
    },
  });
}

/**
 * Log de operação de banco
 */
function logDatabaseOperation(
  operation: string,
  table: string,
  duration?: number,
  context?: LogContext
) {
  dbLogger.debug(`DB ${operation}`, {
    context: {
      ...context,
      operation,
      table,
      duration,
    },
  });
}

// === MIDDLEWARE DE LOGGING ===

/**
 * Middleware Express para logging de requests
 */
function requestLoggingMiddleware() {
  return (req: Express.Request, res: Express.Response, next: Express.NextFunction) => {
    const startTime = Date.now();

    // Gerar ID único para request
    const reqWithId = req as Express.Request & { requestId: string };
    reqWithId.requestId = generateRequestId();

    // Override do res.end para capturar response
    const originalEnd = res.end.bind(res);
    res.end = function(this: Express.Response, ...args: Parameters<Express.Response['end']>) {
      const duration = Date.now() - startTime;

      logHttpRequest(
        req.method,
        req.originalUrl || req.url,
        res.statusCode,
        duration,
        {
          requestId: reqWithId.requestId,
          userId: (req as Express.Request & { user?: { id: string } }).user?.id,
          workspaceId: (req as Express.Request & { workspace?: { id: string } }).workspace?.id,
          userAgent: req.get('User-Agent'),
          ip: req.ip || req.socket?.remoteAddress,
        }
      );

      return originalEnd.apply(this, args) as Express.Response;
    };

    next();
  };
}

/**
 * Middleware para capturar erros não tratados
 */
function errorLoggingMiddleware() {
  return (err: Error, req: Express.Request, res: Express.Response, next: Express.NextFunction) => {
    const reqWithContext = req as Express.Request & {
      requestId?: string;
      user?: { id: string };
      workspace?: { id: string }
    };

    logError(
      `Unhandled error in ${req.method} ${req.originalUrl || req.url}`,
      err,
      {
        requestId: reqWithContext.requestId,
        userId: reqWithContext.user?.id,
        workspaceId: reqWithContext.workspace?.id,
        method: req.method,
        url: req.originalUrl || req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip || req.socket?.remoteAddress,
      }
    );

    next(err);
  };
}

// === UTILITÁRIOS ===

function generateRequestId(): string {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
}

/**
 * Sanitiza dados sensíveis dos logs
 */
function sanitizeLogData(data: unknown): unknown {
  if (!data || typeof data !== 'object') return data;

  const sensitiveFields = [
    'password', 'token', 'secret', 'key', 'auth', 'authorization',
    'cookie', 'session', 'csrf', 'apikey', 'api_key'
  ];

  const sanitized = { ...data as Record<string, unknown> };

  for (const [key, value] of Object.entries(sanitized)) {
    const lowerKey = key.toLowerCase();

    if (sensitiveFields.some(field => lowerKey.includes(field))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeLogData(value);
    }
  }

  return sanitized;
}

/**
 * Função para criar logger filho com contexto específico
 */
function createChildLogger(component: string, context?: LogContext) {
  return logger.child({
    component,
    defaultContext: context,
  });
}

/**
 * Health check do sistema de logging
 */
function loggerHealthCheck() {
  try {
    logger.info('Logger health check', {
      context: { healthCheck: true },
      metadata: {
        transports: logger.transports.length,
        level: logger.level,
        environment: LOG_CONFIG.environment,
      },
    });

    return {
      status: 'healthy',
      transports: logger.transports.length,
      level: logger.level,
      environment: LOG_CONFIG.environment,
    };
  } catch (error) {
    console.error('Logger health check failed:', error);
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// === EXPORTS ===

export default logger;

export {
  LOG_CONFIG,
  logWithContext,
  logError,
  logPerformance,
  logHttpRequest,
  logAIOperation,
  logDatabaseOperation,
  requestLoggingMiddleware,
  errorLoggingMiddleware,
  sanitizeLogData,
  createChildLogger,
  loggerHealthCheck,
};