// ================================
// SISTEMA DE MONITORAMENTO AUTOMÁTICO
// ================================
// Monitoramento diário/horário de processos com sincronização automática

import prisma from './prisma';
import { createProcessApiClient } from './process-apis';
import { ICONS } from './icons';

// ================================
// TIPOS E INTERFACES
// ================================

export interface MonitoringSession {
  id: string;
  startedAt: Date;
  totalProcesses: number;
  processed: number;
  successful: number;
  failed: number;
  errors: MonitoringError[];
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
}

export interface MonitoringError {
  processId: string;
  processNumber: string;
  error: string;
  timestamp: Date;
}

export interface MonitoringStats {
  session: MonitoringSession;
  processesUpdated: string[];
  newMovements: number;
  alertsGenerated: number;
  averageDuration: number;
}

// ================================
// CLASSE PRINCIPAL DO MONITOR
// ================================

export class ProcessMonitor {
  private session: MonitoringSession | null = null;
  private cancelled = false;
  private processApi = createProcessApiClient();

  /**
   * Inicia uma sessão de monitoramento completa
   */
  async startMonitoringSession(): Promise<MonitoringStats> {
    if (this.session?.status === 'RUNNING') {
      throw new Error('Já existe uma sessão de monitoramento em execução');
    }

    console.log(`${ICONS.PROCESS} Iniciando sessão de monitoramento...`);

    // Buscar processos que precisam ser sincronizados
    const processesToSync = await this.getProcessesForSync();

    this.session = {
      id: `monitor_${Date.now()}`,
      startedAt: new Date(),
      totalProcesses: processesToSync.length,
      processed: 0,
      successful: 0,
      failed: 0,
      errors: [],
      status: 'RUNNING'
    };

    console.log(`${ICONS.INFO} Encontrados ${processesToSync.length} processos para sincronizar`);

    const processesUpdated: string[] = [];
    let totalNewMovements = 0;
    let totalAlertsGenerated = 0;
    const durations: number[] = [];

    // Processar cada processo
    for (const process of processesToSync) {
      if (this.cancelled) {
        this.session.status = 'CANCELLED';
        break;
      }

      try {
        const startTime = Date.now();
        const result = await this.syncProcess(process);
        const duration = Date.now() - startTime;

        durations.push(duration);
        processesUpdated.push(process.id);
        totalNewMovements += result.newMovements;
        totalAlertsGenerated += result.alertsGenerated;

        this.session.processed++;
        this.session.successful++;

        // Log de progresso a cada 10 processos
        if (this.session.processed % 10 === 0) {
          console.log(`${ICONS.PROCESS} Progresso: ${this.session.processed}/${this.session.totalProcesses} processos`);
        }

      } catch (error) {
        const errorDetails: MonitoringError = {
          processId: process.id,
          processNumber: process.processNumber,
          error: error instanceof Error ? error.message : 'Erro desconhecido',
          timestamp: new Date()
        };

        this.session.errors.push(errorDetails);
        this.session.processed++;
        this.session.failed++;

        console.error(`${ICONS.ERROR} Erro ao sincronizar processo ${process.processNumber}:`, error);
      }

      // Pequena pausa entre processos para não sobrecarregar APIs
      await this.sleep(100);
    }

    // Finalizar sessão
    this.session.status = this.cancelled ? 'CANCELLED' : 'COMPLETED';

    const stats: MonitoringStats = {
      session: this.session,
      processesUpdated,
      newMovements: totalNewMovements,
      alertsGenerated: totalAlertsGenerated,
      averageDuration: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0
    };

    // Log final
    console.log(`${ICONS.SUCCESS} Sessão de monitoramento concluída:`, {
      processed: this.session.processed,
      successful: this.session.successful,
      failed: this.session.failed,
      newMovements: totalNewMovements,
      alertsGenerated: totalAlertsGenerated
    });

    return stats;
  }

  /**
   * Cancela a sessão atual de monitoramento
   */
  cancelCurrentSession(): void {
    if (this.session?.status === 'RUNNING') {
      this.cancelled = true;
      console.log(`${ICONS.WARNING} Cancelando sessão de monitoramento...`);
    }
  }

  /**
   * Retorna o status da sessão atual
   */
  getCurrentSession(): MonitoringSession | null {
    return this.session;
  }

  // ================================
  // MÉTODOS PRIVADOS
  // ================================

  /**
   * Busca processos que precisam ser sincronizados
   */
  private async getProcessesForSync() {
    const now = new Date();

    return await prisma.monitoredProcess.findMany({
      where: {
        monitoringStatus: 'ACTIVE',
        OR: [
          // Nunca sincronizados
          { lastSync: null },
          // HOURLY - última sync há mais de 1 hora
          {
            syncFrequency: 'HOURLY',
            lastSync: {
              lt: new Date(now.getTime() - 60 * 60 * 1000)
            }
          },
          // DAILY - última sync há mais de 1 dia
          {
            syncFrequency: 'DAILY',
            lastSync: {
              lt: new Date(now.getTime() - 24 * 60 * 60 * 1000)
            }
          },
          // WEEKLY - última sync há mais de 1 semana
          {
            syncFrequency: 'WEEKLY',
            lastSync: {
              lt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
            }
          }
        ]
      },
      orderBy: [
        { lastSync: 'asc' }, // Processos nunca sincronizados primeiro
        { createdAt: 'asc' }  // Depois os mais antigos
      ],
      take: 500 // Limite de segurança
    });
  }

  /**
   * Sincroniza um processo individual
   */
  private async syncProcess(process: any): Promise<{ newMovements: number; alertsGenerated: number }> {
    // Criar log de sincronização
    const syncLog = await prisma.processSyncLog.create({
      data: {
        monitoredProcessId: process.id,
        syncType: 'FULL',
        status: 'SUCCESS',
        startedAt: new Date(),
        apiSource: 'JUDIT_API'
      }
    });

    try {
      // Buscar movimentações recentes
      const recentMovements = await this.processApi.getRecentMovements(
        process.processNumber,
        process.lastSync
      );

      let newMovementsCount = 0;
      let alertsGenerated = 0;

      if (recentMovements.length > 0) {
        // Verificar movimentações existentes
        const existingMovements = await prisma.processMovement.findMany({
          where: {
            monitoredProcessId: process.id,
            date: {
              in: recentMovements.map(m => new Date(m.date))
            }
          },
          select: { date: true, description: true }
        });

        const existingKeys = new Set(
          existingMovements.map(m => `${m.date.toISOString()}_${m.description}`)
        );

        const newMovements = recentMovements.filter(movement => {
          const key = `${new Date(movement.date).toISOString()}_${movement.description}`;
          return !existingKeys.has(key);
        });

        if (newMovements.length > 0) {
          // Salvar novas movimentações
          await prisma.processMovement.createMany({
            data: newMovements.map(movement => ({
              monitoredProcessId: process.id,
              date: new Date(movement.date),
              type: movement.type,
              description: movement.description,
              category: movement.category,
              importance: movement.importance,
              requiresAction: movement.requiresAction,
              deadline: movement.deadline ? new Date(movement.deadline) : null,
              rawData: JSON.parse(JSON.stringify(movement))
            }))
          });

          newMovementsCount = newMovements.length;

          // Gerar alertas para movimentações importantes
          if (process.alertsEnabled) {
            const importantMovements = newMovements.filter(m =>
              m.importance === 'HIGH' || m.importance === 'URGENT' || m.requiresAction
            );

            if (importantMovements.length > 0) {
              const alerts = await Promise.all(
                importantMovements.map(movement =>
                  prisma.processAlert.create({
                    data: {
                      monitoredProcessId: process.id,
                      title: `Nova movimentação: ${movement.type}`,
                      message: movement.description,
                      type: 'MOVEMENT',
                      severity: movement.importance,
                      recipients: process.alertRecipients || []
                    }
                  })
                )
              );

              alertsGenerated = alerts.length;
            }
          }
        }
      }

      // Atualizar processo e log
      await Promise.all([
        prisma.monitoredProcess.update({
          where: { id: process.id },
          data: { lastSync: new Date() }
        }),
        prisma.processSyncLog.update({
          where: { id: syncLog.id },
          data: {
            status: 'SUCCESS',
            newMovements: newMovementsCount,
            finishedAt: new Date()
          }
        })
      ]);

      return { newMovements: newMovementsCount, alertsGenerated };

    } catch (error) {
      // Atualizar log com erro
      await prisma.processSyncLog.update({
        where: { id: syncLog.id },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
          errors: [error instanceof Error ? error.message : 'Erro desconhecido']
        }
      });

      throw error;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ================================
// SCHEDULER DE MONITORAMENTO
// ================================

export class ProcessMonitorScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private monitor = new ProcessMonitor();

  /**
   * Inicia o agendador de monitoramento
   */
  start(intervalMinutes: number = 60): void {
    if (this.intervalId) {
      this.stop();
    }

    console.log(`${ICONS.INFO} Iniciando scheduler de monitoramento (intervalo: ${intervalMinutes} minutos)`);

    this.intervalId = setInterval(async () => {
      try {
        console.log(`${ICONS.PROCESS} Executando monitoramento automático...`);
        await this.monitor.startMonitoringSession();
      } catch (error) {
        console.error(`${ICONS.ERROR} Erro no monitoramento automático:`, error);
      }
    }, intervalMinutes * 60 * 1000);

    // Executar uma vez imediatamente
    setTimeout(() => {
      this.monitor.startMonitoringSession().catch(error => {
        console.error(`${ICONS.ERROR} Erro no monitoramento inicial:`, error);
      });
    }, 5000); // Aguardar 5 segundos para inicialização
  }

  /**
   * Para o agendador de monitoramento
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.monitor.cancelCurrentSession();
      console.log(`${ICONS.INFO} Scheduler de monitoramento parado`);
    }
  }

  /**
   * Verifica se o scheduler está rodando
   */
  isRunning(): boolean {
    return this.intervalId !== null;
  }

  /**
   * Força uma execução imediata
   */
  async runNow(): Promise<MonitoringStats> {
    return await this.monitor.startMonitoringSession();
  }

  /**
   * Retorna o status da sessão atual
   */
  getCurrentSession(): MonitoringSession | null {
    return this.monitor.getCurrentSession();
  }
}

// ================================
// INSTÂNCIA SINGLETON GLOBAL
// ================================

// Instância global do scheduler (Singleton pattern)
let globalScheduler: ProcessMonitorScheduler | null = null;

/**
 * Obtém a instância global do scheduler
 */
export function getGlobalScheduler(): ProcessMonitorScheduler {
  if (!globalScheduler) {
    globalScheduler = new ProcessMonitorScheduler();
  }
  return globalScheduler;
}

/**
 * Inicia o monitoramento automático global
 */
export function startGlobalMonitoring(intervalMinutes: number = 60): void {
  const scheduler = getGlobalScheduler();

  if (!scheduler.isRunning()) {
    scheduler.start(intervalMinutes);
  }
}

/**
 * Para o monitoramento automático global
 */
export function stopGlobalMonitoring(): void {
  if (globalScheduler) {
    globalScheduler.stop();
  }
}

// ================================
// UTILITÁRIOS PARA API
// ================================

/**
 * Busca estatísticas de monitoramento do workspace
 */
export async function getMonitoringStatistics(workspaceId: string) {
  const [
    totalProcesses,
    activeProcesses,
    recentSyncs,
    pendingAlerts,
    failedSyncs
  ] = await Promise.all([
    // Total de processos monitorados
    prisma.monitoredProcess.count({
      where: { workspaceId }
    }),

    // Processos ativos
    prisma.monitoredProcess.count({
      where: {
        workspaceId,
        monitoringStatus: 'ACTIVE'
      }
    }),

    // Sincronizações recentes (últimas 24h)
    prisma.processSyncLog.count({
      where: {
        monitoredProcess: { workspaceId },
        startedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }
    }),

    // Alertas não lidos
    prisma.processAlert.count({
      where: {
        monitoredProcess: { workspaceId },
        read: false
      }
    }),

    // Sincronizações falharam (últimas 24h)
    prisma.processSyncLog.count({
      where: {
        monitoredProcess: { workspaceId },
        status: 'FAILED',
        startedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }
    })
  ]);

  return {
    totalProcesses,
    activeProcesses,
    recentSyncs,
    pendingAlerts,
    failedSyncs,
    successRate: recentSyncs > 0 ? ((recentSyncs - failedSyncs) / recentSyncs) * 100 : 100
  };
}

/**
 * Busca processos que precisam de atenção
 */
export async function getProcessesNeedingAttention(workspaceId: string) {
  return await prisma.monitoredProcess.findMany({
    where: {
      workspaceId,
      OR: [
        // Processos com erro
        { monitoringStatus: 'ERROR' },
        // Processos nunca sincronizados há mais de 24h
        {
          monitoringStatus: 'ACTIVE',
          lastSync: null,
          createdAt: {
            lt: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        },
        // Processos com sincronização atrasada
        {
          monitoringStatus: 'ACTIVE',
          syncFrequency: 'DAILY',
          lastSync: {
            lt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 dias
          }
        }
      ]
    },
    include: {
      _count: {
        select: {
          alerts: {
            where: { read: false }
          }
        }
      }
    },
    orderBy: { updatedAt: 'desc' },
    take: 20
  });
}