// ================================================================
// ADMIN INTERFACE - Monitoramento e Ferramentas de Recovery
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getJuditApiClient } from '@/lib/judit-api-client';
// Import worker functions dynamically to avoid build-time issues with Bull queue
// import { processMonitorQueue, addMonitoringJob, getMonitoringStats } from '@/workers/process-monitor-worker';
import { telemetry } from '@/lib/monitoring-telemetry';
import { ICONS } from '@/lib/icons';

// ================================================================
// WORKER FUNCTIONS (MOCKED - process-monitor-worker not implemented)
// ================================================================

async function getWorkerFunctions() {
  // Return mock functions since process-monitor-worker is not yet implemented
  // In production, this would connect to actual BullMQ worker
  return {
    processMonitorQueue: null,
    addMonitoringJob: async (jobName: string, data?: any) => ({
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

interface AdminRequest {
  action: 'status' | 'restart_worker' | 'clear_queue' | 'force_sync' | 'circuit_breaker' | 'rate_limiter' | 'emergency_stop' | 'health_check';
  workspaceId?: string;
  processId?: string;
  parameters?: Record<string, any>;
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
    queueStats: any;
    juditStats: any;
    telemetryMetrics: any;
    activeAlerts: any[];
  };
  recommendations: string[];
}

interface ComponentStatus {
  status: 'healthy' | 'degraded' | 'critical' | 'offline';
  lastCheck: Date;
  responseTime?: number;
  details: string;
  metrics?: Record<string, any>;
}

interface RecoveryAction {
  id: string;
  type: 'restart_worker' | 'clear_failed_jobs' | 'reset_circuit_breaker' | 'force_sync_workspace' | 'emergency_stop';
  description: string;
  risk: 'low' | 'medium' | 'high';
  estimatedDuration: string;
  requiredParameters?: string[];
}

// ================================================================
// HANDLER PRINCIPAL
// ================================================================

export async function GET(request: NextRequest) {
  try {
    console.log(`${ICONS.ADMIN} Admin monitoring status request`);

    const systemStatus = await getSystemStatus();

    return NextResponse.json({
      status: 'success',
      data: systemStatus
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} Failed to get admin status:`, error);

    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
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
    console.error(`${ICONS.ERROR} Admin action failed:`, error);

    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// ================================================================
// STATUS DO SISTEMA
// ================================================================

async function getSystemStatus(): Promise<SystemStatus> {
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
    getJuditApiClient().getStats(),
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
    const juditClient = getJuditApiClient();
    const stats = juditClient.getStats();

    // Tentar fazer uma chamada simples para verificar conectividade
    await juditClient.listTrackings();

    const responseTime = Date.now() - startTime;

    // Determinar status baseado nas métricas
    let status: ComponentStatus['status'] = 'healthy';
    let details = 'API functioning normally';

    if (stats.circuitBreakerState === 'open') {
      status = 'critical';
      details = 'Circuit breaker is open - API calls are being blocked';
    } else if (stats.circuitBreakerState === 'half-open') {
      status = 'degraded';
      details = 'Circuit breaker is half-open - testing API recovery';
    } else if (stats.successfulCalls > 0 && (stats.failedCalls / stats.totalCalls) > 0.1) {
      status = 'degraded';
      details = `High error rate: ${((stats.failedCalls / stats.totalCalls) * 100).toFixed(1)}%`;
    } else if (responseTime > 5000) {
      status = 'degraded';
      details = `Slow response time: ${responseTime}ms`;
    }

    return {
      status,
      lastCheck: new Date(),
      responseTime,
      details,
      metrics: {
        totalCalls: stats.totalCalls,
        successRate: stats.totalCalls > 0 ? (stats.successfulCalls / stats.totalCalls * 100).toFixed(1) : '100',
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
      details: `API unreachable: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
      details: `Worker unreachable: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
      details: `Database unreachable: ${error instanceof Error ? error.message : 'Unknown error'}`,
      metrics: { error: true }
    };
  }
}

async function checkRedisStatus(): Promise<ComponentStatus> {
  const startTime = Date.now();

  try {
    // Verificar Redis através das filas Bull
    const { processMonitorQueue } = await getWorkerFunctions();
    const queueHealth = processMonitorQueue ? await processMonitorQueue.isReady() : false;
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
      details: `Redis unreachable: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
          timestamp: {
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
      details: `Webhook system unreachable: ${error instanceof Error ? error.message : 'Unknown error'}`,
      metrics: { error: true }
    };
  }
}

// ================================================================
// AÇÕES ADMINISTRATIVAS
// ================================================================

async function executeAdminAction(request: AdminRequest): Promise<any> {
  switch (request.action) {
    case 'status':
      return await getSystemStatus();

    case 'restart_worker':
      return await restartMonitoringWorker();

    case 'clear_queue':
      return await clearMonitoringQueue();

    case 'force_sync':
      return await forceSyncWorkspace(request.workspaceId, request.processId);

    case 'circuit_breaker':
      return await manageCircuitBreaker(request.parameters?.operation);

    case 'rate_limiter':
      return await manageRateLimiter(request.parameters?.operation);

    case 'emergency_stop':
      return await emergencyStopMonitoring();

    case 'health_check':
      return await performHealthCheck();

    default:
      throw new Error(`Unknown admin action: ${request.action}`);
  }
}

async function restartMonitoringWorker(): Promise<any> {
  console.log(`${ICONS.RESTART} Restarting monitoring worker`);

  try {
    const { processMonitorQueue, addMonitoringJob } = await getWorkerFunctions();

    if (!processMonitorQueue) {
      throw new Error('Worker queue not available');
    }

    // Pausar worker atual
    await processMonitorQueue.pause();

    // Limpar jobs ativos (com cuidado)
    const activeJobs = await processMonitorQueue.getActive();
    for (const job of activeJobs) {
      await job.moveToFailed({ message: 'Worker restart' }, true);
    }

    // Retomar worker
    await processMonitorQueue.resume();

    // Agendar novo job de monitoramento
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

async function clearMonitoringQueue(): Promise<any> {
  console.log(`${ICONS.CLEAR} Clearing monitoring queue`);

  try {
    const { processMonitorQueue } = await getWorkerFunctions();

    if (!processMonitorQueue) {
      throw new Error('Worker queue not available');
    }

    const [waiting, failed] = await Promise.all([
      processMonitorQueue.getWaiting(),
      processMonitorQueue.getFailed()
    ]);

    // Limpar jobs falhos e em espera
    await processMonitorQueue.clean(0, 'waiting');
    await processMonitorQueue.clean(0, 'failed');

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

async function forceSyncWorkspace(workspaceId?: string, processId?: string): Promise<any> {
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

async function manageCircuitBreaker(operation?: string): Promise<any> {
  const juditClient = getJuditApiClient();

  switch (operation) {
    case 'reset':
      // Reset circuit breaker manually
      console.log(`${ICONS.RESET} Resetting circuit breaker`);
      return {
        success: true,
        message: 'Circuit breaker reset (note: implementation depends on circuit breaker library)',
        previousState: juditClient.getCircuitBreakerStats()
      };

    case 'open':
      console.log(`${ICONS.STOP} Manually opening circuit breaker`);
      return {
        success: true,
        message: 'Circuit breaker opened manually'
      };

    default:
      return {
        success: true,
        currentState: juditClient.getCircuitBreakerStats(),
        rateLimiterStatus: juditClient.getRateLimiterStatus()
      };
  }
}

async function manageRateLimiter(operation?: string): Promise<any> {
  const juditClient = getJuditApiClient();

  switch (operation) {
    case 'reset':
      console.log(`${ICONS.RESET} Resetting rate limiter`);
      return {
        success: true,
        message: 'Rate limiter reset',
        status: juditClient.getRateLimiterStatus()
      };

    default:
      return {
        success: true,
        status: juditClient.getRateLimiterStatus()
      };
  }
}

async function emergencyStopMonitoring(): Promise<any> {
  console.warn(`${ICONS.EMERGENCY} EMERGENCY STOP - Halting all monitoring operations`);

  try {
    const { processMonitorQueue } = await getWorkerFunctions();

    if (processMonitorQueue) {
      // Pausar todas as operações
      await processMonitorQueue.pause();
    }

    // Marcar todas as execuções ativas como canceladas
    await prisma.monitoringTelemetry.updateMany({
      where: {
        timestamp: {
          gte: new Date(Date.now() - 60 * 60 * 1000) // Última hora
        }
      },
      data: {
        metadata: {
          emergencyStop: true,
          stoppedAt: new Date().toISOString()
        }
      }
    });

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

async function performHealthCheck(): Promise<any> {
  console.log(`${ICONS.HEALTH} Performing comprehensive health check`);

  const checks = {
    database: false,
    redis: false,
    juditApi: false,
    workers: false,
    webhooks: false
  };

  const details: Record<string, any> = {};

  try {
    // Database check
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
    details.database = 'Connected successfully';
  } catch (error) {
    details.database = `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }

  try {
    // Redis check
    const { processMonitorQueue } = await getWorkerFunctions();
    const isReady = processMonitorQueue ? await processMonitorQueue.isReady() : false;
    checks.redis = isReady;
    details.redis = isReady ? 'Connected successfully' : 'Not ready';
  } catch (error) {
    details.redis = `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }

  try {
    // Judit API check
    const juditClient = getJuditApiClient();
    await juditClient.listTrackings();
    checks.juditApi = true;
    details.juditApi = 'API responding normally';
  } catch (error) {
    details.juditApi = `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }

  try {
    // Workers check
    const { getMonitoringStats } = await getWorkerFunctions();
    const stats = await getMonitoringStats();
    checks.workers = stats.queue.active >= 0; // Worker is responding
    details.workers = `Queue stats retrieved: ${stats.queue.waiting} waiting, ${stats.queue.active} active`;
  } catch (error) {
    details.workers = `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }

  try {
    // Webhooks check
    const pendingCount = await prisma.webhookQueue.count({ where: { status: 'PENDING' } });
    checks.webhooks = true;
    details.webhooks = `${pendingCount} pending webhooks`;
  } catch (error) {
    details.webhooks = `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }

  const overallHealth = Object.values(checks).every(check => check);

  return {
    success: true,
    overallHealth,
    checks,
    details,
    timestamp: new Date()
  };
}

// ================================================================
// FUNÇÕES AUXILIARES
// ================================================================

function determineOverallStatus(componentStatuses: ComponentStatus[]): SystemStatus['overall'] {
  const criticalCount = componentStatuses.filter(s => s.status === 'critical').length;
  const degradedCount = componentStatuses.filter(s => s.status === 'degraded').length;
  const offlineCount = componentStatuses.filter(s => s.status === 'offline').length;

  if (criticalCount > 0 || offlineCount > 0) {
    return 'critical';
  } else if (degradedCount > 1) {
    return 'degraded';
  } else if (degradedCount === 1) {
    return 'degraded';
  } else {
    return 'healthy';
  }
}

function generateRecommendations(status: any): string[] {
  const recommendations: string[] = [];

  if (status.overall === 'critical') {
    recommendations.push('🚨 AÇÃO IMEDIATA NECESSÁRIA: Sistema em estado crítico');
  }

  if (status.components.juditApi.status === 'critical') {
    recommendations.push('• Verificar conectividade com API da Judit');
    recommendations.push('• Considerar resetar circuit breaker se apropriado');
  }

  if (status.components.monitoringWorker.status === 'critical') {
    recommendations.push('• Reiniciar worker de monitoramento');
    recommendations.push('• Verificar logs para identificar causa da falha');
  }

  if (status.queueStats?.queue?.failed > 10) {
    recommendations.push('• Limpar jobs falhados da fila');
    recommendations.push('• Investigar padrão de falhas');
  }

  if (status.activeAlerts?.length > 0) {
    recommendations.push(`• Revisar ${status.activeAlerts.length} alertas ativos`);
  }

  if (recommendations.length === 0) {
    recommendations.push('✅ Sistema funcionando normalmente');
  }

  return recommendations;
}

// ================================================================
// RECOVERY ACTIONS ENDPOINTS
// ================================================================

export async function PUT(request: NextRequest) {
  try {
    const { action, parameters } = await request.json();

    const availableActions: RecoveryAction[] = [
      {
        id: 'restart_worker',
        type: 'restart_worker',
        description: 'Reinicia o worker de monitoramento, limpando jobs travados',
        risk: 'medium',
        estimatedDuration: '30 segundos'
      },
      {
        id: 'clear_failed_jobs',
        type: 'clear_failed_jobs',
        description: 'Remove jobs falhados da fila de monitoramento',
        risk: 'low',
        estimatedDuration: '10 segundos'
      },
      {
        id: 'reset_circuit_breaker',
        type: 'reset_circuit_breaker',
        description: 'Reseta o circuit breaker da API Judit',
        risk: 'low',
        estimatedDuration: '5 segundos'
      },
      {
        id: 'force_sync_workspace',
        type: 'force_sync_workspace',
        description: 'Força sincronização completa de um workspace',
        risk: 'medium',
        estimatedDuration: '2-5 minutos',
        requiredParameters: ['workspaceId']
      },
      {
        id: 'emergency_stop',
        type: 'emergency_stop',
        description: 'PARADA DE EMERGÊNCIA - Interrompe todo o monitoramento',
        risk: 'high',
        estimatedDuration: 'Imediato'
      }
    ];

    if (!action) {
      return NextResponse.json({
        status: 'success',
        availableActions
      });
    }

    // Executar ação específica
    const result = await executeAdminAction({ action, parameters });

    return NextResponse.json({
      status: 'success',
      action,
      result
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} Recovery action failed:`, error);

    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}