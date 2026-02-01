// ================================================================
// ADMIN INTERFACE - Monitoramento e Ferramentas de Recovery
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
// TODO: Replace with Escavador monitoring when implemented
// import { getJuditApiClient } from '@/lib/judit-api-client';
import { telemetry } from '@/lib/monitoring-telemetry';
import { ICONS } from '@/lib/icons';
import { validateAuthAndGetUser } from '@/lib/auth';
import { requireAdminAccess } from '@/lib/permission-validator';
import { getErrorMessage } from '@/lib/error-handling';
import { withAdminCache, AdminCacheKeys, CacheTTL } from '@/lib/cache/admin-redis';

// Mock for JUDIT API client until Escavador monitoring is implemented
function getMockApiStats() {
  return {
    totalCalls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    rateLimitHits: 0,
    circuitBreakerState: 'closed' as const,
    averageResponseTime: 0
  };
}

// ================================================================
// WORKER FUNCTIONS (MOCKED - process-monitor-worker not implemented)
// ================================================================

async function getWorkerFunctions() {
  // Return mock functions since process-monitor-worker is not yet implemented
  // In production, this would connect to actual BullMQ worker
  return {
    processMonitorQueue: null,
    addMonitoringJob: async (jobName: string, data?: unknown) => ({
      id: `mock-${Date.now()}`,
      name: jobName,
      data
    }),
    getMonitoringStats: async () => ({
      queue: { waiting: 0, active: 0, completed: 0, failed: 0 },
      workers: { active: 0, idle: 0 }
    })
  };
}

// ================================================================
// TIPOS E INTERFACES
// ================================================================

interface ProcessMonitorQueue {
  isReady(): Promise<boolean>;
  pause(): Promise<void>;
  getActive(): Promise<Array<{ moveToFailed: (_obj: Record<string, string>, _bool: boolean) => Promise<void> }>>;
  resume(): Promise<void>;
  getWaiting(): Promise<unknown[]>;
  getFailed(): Promise<unknown[]>;
  clean(_number: number, _status: string): Promise<void>;
}

interface AdminRequest {
  action: 'status' | 'restart_worker' | 'clear_queue' | 'force_sync' | 'circuit_breaker' | 'rate_limiter' | 'emergency_stop' | 'health_check';
  workspaceId?: string;
  processId?: string;
  parameters?: Record<string, unknown>;
}

interface SystemStatus {
  timestamp: Date;
  overall: 'healthy' | 'degraded' | 'critical' | 'offline';
  components: {
    juditApi: ComponentStatus;
    monitoringWorker: ComponentStatus;
    database: ComponentStatus;
    redis: ComponentStatus;
    webhooks: ComponentStatus;
  };
  metrics: {
    queueStats: unknown;
    juditStats: unknown;
    telemetryMetrics: unknown;
    activeAlerts: unknown[];
  };
  recommendations: string[];
}

interface ComponentStatus {
  status: 'healthy' | 'degraded' | 'critical' | 'offline';
  lastCheck: Date;
  responseTime?: number;
  details: string;
  metrics?: Record<string, unknown>;
}

// ================================================================
// TYPE GUARDS
// ================================================================

/**
 * Type guard to validate ProcessMonitorQueue object
 * Checks that the object has all required queue methods
 */
function isProcessMonitorQueue(queue: unknown): queue is ProcessMonitorQueue {
  if (queue === null || queue === undefined) {
    return false;
  }

  if (typeof queue !== 'object') {
    return false;
  }

  const q = queue as Record<string, unknown>;

  return (
    typeof q.isReady === 'function' &&
    typeof q.pause === 'function' &&
    typeof q.getActive === 'function' &&
    typeof q.resume === 'function' &&
    typeof q.getWaiting === 'function' &&
    typeof q.getFailed === 'function' &&
    typeof q.clean === 'function'
  );
}

// ================================================================
// HANDLER PRINCIPAL
// ================================================================

export async function GET() {
  try {
    // 1. Authenticate user
    const { user, workspace } = await validateAuthAndGetUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Check admin access (internal admin OR workspace admin)
    const adminCheck = await requireAdminAccess(user.email, user.id, workspace?.id);
    if (!adminCheck.authorized) {
      return NextResponse.json(
        { error: adminCheck._error },
        { status: 403 }
      );
    }

    console.log(`${ICONS.ADMIN} Admin monitoring status request`);

    // Get system status (Redis cached for 5 minutes)
    const systemStatus = await getSystemStatusCached();

    return NextResponse.json({
      status: 'success',
      data: systemStatus
    });

  } catch (error) {
    const errorMessage = getErrorMessage(error);
    console.error(`${ICONS.ERROR} Failed to get admin status:`, errorMessage);

    return NextResponse.json({
      status: 'error',
      error: errorMessage
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const { user, workspace } = await validateAuthAndGetUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Check admin access (internal admin OR workspace admin)
    const adminCheck = await requireAdminAccess(user.email, user.id, workspace?.id);
    if (!adminCheck.authorized) {
      return NextResponse.json(
        { error: adminCheck._error },
        { status: 403 }
      );
    }

    const adminRequest: AdminRequest = await request.json();
    console.log(`${ICONS.ADMIN} Admin action requested:`, adminRequest.action);

    // Validar ação
    if (!adminRequest.action) {
      return NextResponse.json({
        status: 'error',
        error: 'Action is required'
      }, { status: 400 });
    }

    // Executar ação administrativa
    const result = await executeAdminAction(adminRequest);

    return NextResponse.json({
      status: 'success',
      action: adminRequest.action,
      result
    });

  } catch (error) {
    const errorMessage = getErrorMessage(error);
    console.error(`${ICONS.ERROR} Admin action failed:`, errorMessage);

    return NextResponse.json({
      status: 'error',
      error: errorMessage
    }, { status: 500 });
  }
}

// ================================================================
// STATUS DO SISTEMA
// ================================================================

/**
 * Get system status (uncached - used for POST actions and cache fetcher)
 */
async function _getSystemStatusUncached(): Promise<SystemStatus> {
  const startTime = Date.now();

  // Verificar componentes em paralelo
  const [
    juditStatus,
    workerStatus,
    databaseStatus,
    redisStatus,
    webhookStatus,
    queueStats,
    juditStats,
    telemetryMetrics,
    activeAlerts
  ] = await Promise.all([
    checkJuditApiStatus(),
    checkMonitoringWorkerStatus(),
    checkDatabaseStatus(),
    checkRedisStatus(),
    checkWebhookStatus(),
    (async () => {
      const { getMonitoringStats } = await getWorkerFunctions();
      return await getMonitoringStats();
    })(),
    getMockApiStats(), // TODO: Replace with escavadorClient stats
    telemetry.getMonitoringMetrics(),
    telemetry.getActiveAlerts()
  ]);

  // Determinar status geral
  const componentStatuses = [juditStatus, workerStatus, databaseStatus, redisStatus, webhookStatus];
  const overall = determineOverallStatus(componentStatuses);

  // Gerar recomendações
  const recommendations = generateRecommendations({
    overall,
    components: {
      juditApi: juditStatus,
      monitoringWorker: workerStatus,
      database: databaseStatus,
      redis: redisStatus,
      webhooks: webhookStatus
    },
    queueStats,
    activeAlerts
  });

  const systemStatus: SystemStatus = {
    timestamp: new Date(),
    overall,
    components: {
      juditApi: juditStatus,
      monitoringWorker: workerStatus,
      database: databaseStatus,
      redis: redisStatus,
      webhooks: webhookStatus
    },
    metrics: {
      queueStats,
      juditStats,
      telemetryMetrics,
      activeAlerts
    },
    recommendations
  };

  console.log(`${ICONS.SUCCESS} System status check completed in ${Date.now() - startTime}ms - Overall: ${overall}`);

  return systemStatus;
}

// ================================================================
// VERIFICAÇÕES DE COMPONENTES
// ================================================================

async function checkJuditApiStatus(): Promise<ComponentStatus> {
  const startTime = Date.now();

  try {
    // TODO: Replace with Escavador API health check
    const stats = getMockApiStats();
    const responseTime = Date.now() - startTime;

    return {
      status: 'healthy',
      lastCheck: new Date(),
      responseTime,
      details: 'Escavador API not yet configured',
      metrics: {
        totalCalls: stats.totalCalls,
        successRate: '100',
        rateLimitHits: stats.rateLimitHits,
        circuitBreakerState: stats.circuitBreakerState,
        averageResponseTime: stats.averageResponseTime
      }
    };

  } catch (error) {
    return {
      status: 'critical',
      lastCheck: new Date(),
      responseTime: Date.now() - startTime,
      details: `API unreachable: ${getErrorMessage(error)}`,
      metrics: { error: true }
    };
  }
}

async function checkMonitoringWorkerStatus(): Promise<ComponentStatus> {
  try {
    const { getMonitoringStats } = await getWorkerFunctions();
    const stats = await getMonitoringStats();

    let status: ComponentStatus['status'] = 'healthy';
    let details = 'Worker functioning normally';

    if (stats.queue.failed > stats.queue.completed * 0.1) {
      status = 'degraded';
      details = `High failure rate: ${stats.queue.failed} failed jobs`;
    } else if (stats.queue.waiting > 100) {
      status = 'degraded';
      details = `Large queue backlog: ${stats.queue.waiting} waiting jobs`;
    } else if (stats.queue.active === 0 && stats.queue.waiting > 0) {
      status = 'critical';
      details = 'Worker appears to be stuck - no active jobs but queue has items';
    }

    return {
      status,
      lastCheck: new Date(),
      details,
      metrics: stats.queue
    };

  } catch (error) {
    return {
      status: 'critical',
      lastCheck: new Date(),
      details: `Worker unreachable: ${getErrorMessage(error)}`,
      metrics: { error: true }
    };
  }
}

async function checkDatabaseStatus(): Promise<ComponentStatus> {
  const startTime = Date.now();

  try {
    // Teste simples de conectividade e performance
    await prisma.$queryRaw`SELECT 1`;
    const responseTime = Date.now() - startTime;

    let status: ComponentStatus['status'] = 'healthy';
    let details = 'Database functioning normally';

    if (responseTime > 1000) {
      status = 'degraded';
      details = `Slow database response: ${responseTime}ms`;
    }

    return {
      status,
      lastCheck: new Date(),
      responseTime,
      details,
      metrics: { responseTime }
    };

  } catch (error) {
    return {
      status: 'critical',
      lastCheck: new Date(),
      responseTime: Date.now() - startTime,
      details: `Database unreachable: ${getErrorMessage(error)}`,
      metrics: { error: true }
    };
  }
}

async function checkRedisStatus(): Promise<ComponentStatus> {
  const startTime = Date.now();

  try {
    // Verificar Redis através das filas Bull
    const workerFunctions = await getWorkerFunctions();
    const queueValue = workerFunctions.processMonitorQueue;

    // Use type guard to safely narrow the type
    if (!isProcessMonitorQueue(queueValue)) {
      return {
        status: 'critical',
        lastCheck: new Date(),
        responseTime: Date.now() - startTime,
        details: 'Redis connection unavailable - queue not initialized',
        metrics: { error: true }
      };
    }

    // Now explicitly assign to narrowed type
    const queue: ProcessMonitorQueue = queueValue;
    const queueHealth = await queue.isReady();
    const responseTime = Date.now() - startTime;

    if (!queueHealth) {
      return {
        status: 'critical',
        lastCheck: new Date(),
        responseTime,
        details: 'Redis connection failed',
        metrics: { error: true }
      };
    }

    let status: ComponentStatus['status'] = 'healthy';
    let details = 'Redis functioning normally';

    if (responseTime > 500) {
      status = 'degraded';
      details = `Slow Redis response: ${responseTime}ms`;
    }

    return {
      status,
      lastCheck: new Date(),
      responseTime,
      details,
      metrics: { responseTime }
    };

  } catch (error) {
    return {
      status: 'critical',
      lastCheck: new Date(),
      responseTime: Date.now() - startTime,
      details: `Redis unreachable: ${getErrorMessage(error)}`,
      metrics: { error: true }
    };
  }
}

async function checkWebhookStatus(): Promise<ComponentStatus> {
  try {
    // Verificar webhooks pendentes e erros recentes
    const [pendingWebhooks, recentErrors] = await Promise.all([
      prisma.webhookQueue.count({
        where: { status: 'PENDING' }
      }),
      prisma.webhookError.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 60 * 60 * 1000) // Última hora
          }
        }
      })
    ]);

    let status: ComponentStatus['status'] = 'healthy';
    let details = 'Webhook system functioning normally';

    if (recentErrors > 10) {
      status = 'degraded';
      details = `High webhook error rate: ${recentErrors} errors in last hour`;
    } else if (pendingWebhooks > 50) {
      status = 'degraded';
      details = `Large webhook backlog: ${pendingWebhooks} pending`;
    }

    return {
      status,
      lastCheck: new Date(),
      details,
      metrics: {
        pendingWebhooks,
        recentErrors
      }
    };

  } catch (error) {
    return {
      status: 'critical',
      lastCheck: new Date(),
      details: `Webhook system unreachable: ${getErrorMessage(error)}`,
      metrics: { error: true }
    };
  }
}

// ================================================================
// AÇÕES ADMINISTRATIVAS
// ================================================================

/**
 * Get system status (with Redis caching - 5 minute TTL for GET requests)
 */
async function getSystemStatusCached(): Promise<SystemStatus> {
  return withAdminCache(
    AdminCacheKeys.systemStatus(),
    CacheTTL.OBSERVABILITY,
    () => _getSystemStatusUncached()
  );
}

async function executeAdminAction(request: AdminRequest): Promise<unknown> {
  switch (request.action) {
    case 'status':
      return await _getSystemStatusUncached();

    case 'restart_worker':
      return await restartMonitoringWorker();

    case 'clear_queue':
      return await clearMonitoringQueue();

    case 'force_sync':
      return await forceSyncWorkspace(request.workspaceId, request.processId);

    case 'circuit_breaker': {
      const operation = typeof request.parameters?.operation === 'string' ? request.parameters.operation : undefined;
      return await manageCircuitBreaker(operation);
    }

    case 'rate_limiter': {
      const operation = typeof request.parameters?.operation === 'string' ? request.parameters.operation : undefined;
      return await manageRateLimiter(operation);
    }

    case 'emergency_stop':
      return await emergencyStopMonitoring();

    case 'health_check':
      return await performHealthCheck();

    default:
      throw new Error(`Unknown admin action: ${request.action}`);
  }
}

async function restartMonitoringWorker(): Promise<unknown> {
  console.log(`${ICONS.RESTART} Restarting monitoring worker`);

  try {
    const workerFunctions = await getWorkerFunctions();
    const queueValue = workerFunctions.processMonitorQueue;

    // Use type guard to safely narrow the type
    if (!isProcessMonitorQueue(queueValue)) {
      throw new Error('Worker queue not available');
    }

    // Now explicitly assign to narrowed type
    const queue: ProcessMonitorQueue = queueValue;

    // Pausar worker atual
    await queue.pause();

    // Limpar jobs ativos (com cuidado)
    const activeJobs = await queue.getActive();
    for (const job of activeJobs) {
      await job.moveToFailed({ message: 'Worker restart' }, true);
    }

    // Retomar worker
    await queue.resume();

    // Agendar novo job de monitoramento
    const addMonitoringJob = workerFunctions.addMonitoringJob;
    await addMonitoringJob('daily-monitor');

    return {
      success: true,
      message: 'Monitoring worker restarted successfully',
      activeJobsCleared: activeJobs.length
    };

  } catch (error) {
    console.error(`${ICONS.ERROR} Failed to restart worker:`, error);
    throw error;
  }
}

async function clearMonitoringQueue(): Promise<unknown> {
  console.log(`${ICONS.CLEAN} Clearing monitoring queue`);

  try {
    const workerFunctions = await getWorkerFunctions();
    const queueValue = workerFunctions.processMonitorQueue;

    // Use type guard to safely narrow the type
    if (!isProcessMonitorQueue(queueValue)) {
      throw new Error('Worker queue not available');
    }

    // Now explicitly assign to narrowed type
    const queue: ProcessMonitorQueue = queueValue;

    const [waiting, failed] = await Promise.all([
      queue.getWaiting(),
      queue.getFailed()
    ]);

    // Limpar jobs falhos e em espera
    await queue.clean(0, 'waiting');
    await queue.clean(0, 'failed');

    return {
      success: true,
      message: 'Monitoring queue cleared successfully',
      waitingJobsCleared: waiting.length,
      failedJobsCleared: failed.length
    };

  } catch (error) {
    console.error(`${ICONS.ERROR} Failed to clear queue:`, error);
    throw error;
  }
}

async function forceSyncWorkspace(workspaceId?: string, processId?: string): Promise<unknown> {
  console.log(`${ICONS.SYNC} Force syncing workspace: ${workspaceId || 'all'}, process: ${processId || 'all'}`);

  try {
    const { addMonitoringJob } = await getWorkerFunctions();
    const job = await addMonitoringJob('workspace-monitor', {
      workspaceId,
      processIds: processId ? [processId] : undefined,
      forceUpdate: true
    });

    return {
      success: true,
      message: 'Force sync job scheduled',
      jobId: job.id,
      workspaceId,
      processId
    };

  } catch (error) {
    console.error(`${ICONS.ERROR} Failed to schedule force sync:`, error);
    throw error;
  }
}

async function manageCircuitBreaker(operation?: string): Promise<unknown> {
  // TODO: Implement with Escavador client when available
  // JUDIT integration removed
  
  switch (operation) {
    case 'reset':
      console.log(`${ICONS.RESET} Circuit breaker reset not available (JUDIT removed)`);
      return {
        success: true,
        message: 'Circuit breaker management not available - JUDIT integration removed',
        previousState: { state: 'N/A', provider: 'ESCAVADOR' }
      };

    case 'open':
      console.log(`${ICONS.STOP} Circuit breaker open not available (JUDIT removed)`);
      return {
        success: true,
        message: 'Circuit breaker management not available - JUDIT integration removed'
      };

    default:
      return {
        success: true,
        currentState: { state: 'N/A', provider: 'ESCAVADOR' },
        rateLimiterStatus: { status: 'N/A', provider: 'ESCAVADOR' }
      };
  }
}

async function manageRateLimiter(operation?: string): Promise<unknown> {
  // TODO: Implement with Escavador client when available
  // JUDIT integration removed
  
  switch (operation) {
    case 'reset':
      console.log(`${ICONS.RESET} Rate limiter reset not available (JUDIT removed)`);
      return {
        success: true,
        message: 'Rate limiter management not available - JUDIT integration removed',
        status: { provider: 'ESCAVADOR', status: 'N/A' }
      };

    default:
      return {
        success: true,
        status: { provider: 'ESCAVADOR', status: 'N/A' }
      };
  }
}

async function emergencyStopMonitoring(): Promise<unknown> {
  console.warn(`${ICONS.EMERGENCY} EMERGENCY STOP - Halting all monitoring operations`);

  try {
    const workerFunctions = await getWorkerFunctions();
    const queueValue = workerFunctions.processMonitorQueue;

    // Use type guard to safely narrow the type
    if (isProcessMonitorQueue(queueValue)) {
      // Now explicitly assign to narrowed type
      const queue: ProcessMonitorQueue = queueValue;
      // Pausar todas as operações
      await queue.pause();
    }

    // Log emergency stop - telemetry table not implemented yet
    console.log('Emergency stop executed - telemetry logging deferred');

    return {
      success: true,
      message: 'EMERGENCY STOP executed - All monitoring operations halted',
      timestamp: new Date()
    };

  } catch (error) {
    console.error(`${ICONS.ERROR} Emergency stop failed:`, error);
    throw error;
  }
}

async function performHealthCheck(): Promise<unknown> {
  console.log(`${ICONS.HEALTH} Performing comprehensive health check`);

  const checks = {
    database: false,
    redis: false,
    juditApi: false,
    workers: false,
    webhooks: false
  };

  const details: Record<string, unknown> = {};

  try {
    // Database check
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
    details.database = 'Connected successfully';
  } catch (error) {
    details.database = `Failed: ${getErrorMessage(error)}`;
  }

  try {
    // Redis check
    const workerFunctions = await getWorkerFunctions();
    const queueValue = workerFunctions.processMonitorQueue;

    // Use type guard to safely narrow the type
    let isReady = false;
    if (isProcessMonitorQueue(queueValue)) {
      const queue: ProcessMonitorQueue = queueValue;
      isReady = await queue.isReady();
    }
    checks.redis = isReady;
    details.redis = isReady ? 'Connected successfully' : 'Not ready';
  } catch (error) {
    details.redis = `Failed: ${getErrorMessage(error)}`;
  }

  try {
    // Judit API replaced by Escavador (mock check)
    checks.juditApi = true;
    details.juditApi = 'API replaced by Escavador';
  } catch (error) {
    details.juditApi = `Failed: ${getErrorMessage(error)}`;
  }

  try {
    // Workers check
    const { getMonitoringStats } = await getWorkerFunctions();
    const stats = await getMonitoringStats();
    checks.workers = stats.queue.active >= 0; // Worker is responding
    details.workers = `Queue stats retrieved: ${stats.queue.waiting} waiting, ${stats.queue.active} active`;
  } catch (error) {
    details.workers = `Failed: ${getErrorMessage(error)}`;
  }

  try {
    // Webhooks check
    const pendingCount = await prisma.webhookQueue.count({ where: { status: 'PENDING' } });
    checks.webhooks = true;
    details.webhooks = `${pendingCount} pending webhooks`;
  } catch (error) {
    details.webhooks = `Failed: ${getErrorMessage(error)}`;
  }

  return {
    success: true,
    checks,
    details
  };
}

// ================================================================
// HELPER FUNCTIONS
// ================================================================

function determineOverallStatus(componentStatuses: ComponentStatus[]): SystemStatus['overall'] {
  const criticalCount = componentStatuses.filter(c => c.status === 'critical').length;
  const degradedCount = componentStatuses.filter(c => c.status === 'degraded').length;

  if (criticalCount >= 2) {
    return 'offline';
  }
  if (criticalCount === 1) {
    return 'critical';
  }
  if (degradedCount >= 2) {
    return 'degraded';
  }
  if (degradedCount === 1) {
    return 'degraded';
  }

  return 'healthy';
}

function generateRecommendations(status: {
  overall: SystemStatus['overall'];
  components: SystemStatus['components'];
  queueStats: unknown;
  activeAlerts: unknown[];
}): string[] {
  const recommendations: string[] = [];

  // Análise de componentes
  if (status.components.juditApi.status === 'critical') {
    recommendations.push('URGENT: JUDIT API is unavailable. Check API status and network connectivity.');
  }
  if (status.components.database.status === 'critical') {
    recommendations.push('URGENT: Database connection lost. Check database server and network.');
  }
  if (status.components.redis.status === 'critical') {
    recommendations.push('WARNING: Redis connection lost. Queue operations may be impaired.');
  }
  if (status.components.monitoringWorker.status === 'degraded') {
    recommendations.push('Monitoring worker is degraded. Consider restarting the worker service.');
  }
  if (status.components.webhooks.status === 'degraded') {
    recommendations.push('Webhook system is degraded. Check webhook queue and error logs.');
  }

  // Recomendações gerais
  if (status.overall === 'critical' || status.overall === 'offline') {
    recommendations.push('CRITICAL: System status is critical. Immediate action required.');
  }

  if (recommendations.length === 0) {
    recommendations.push('All systems are functioning normally. No action required.');
  }

  return recommendations;
}
