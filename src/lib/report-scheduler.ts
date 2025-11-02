// ================================================================
// SCHEDULER DE RELATÓRIOS - Distribuição em Janelas Noturnas
// ================================================================

import { prisma } from '@/lib/prisma';
import { createHash } from 'crypto';
import { QuotaSystem } from '@/lib/quota-system';
import { ReportGenerator } from '@/lib/report-generator';
import { ICONS } from '@/lib/icons';
import { sendReportReady } from '@/lib/notification-service';

export interface ScheduleConfig {
  windowStart: string;    // "23:00"
  windowEnd: string;      // "04:00"
  maxConcurrent: number;  // Máximo de relatórios simultâneos
}

export interface DistributionResult {
  workspaceId: string;
  scheduleId: string;
  assignedTime: Date;
  distributionHash: number;
}

export class ReportScheduler {
  private quotaSystem = new QuotaSystem();
  private reportGenerator = new ReportGenerator();

  private config: ScheduleConfig = {
    windowStart: '23:00',
    windowEnd: '04:00',
    maxConcurrent: 10
  };

  /**
   * Roda o scheduler principal (chamado diariamente às 23h)
   */
  async runDailyScheduler(): Promise<{
    processed: number;
    scheduled: number;
    errors: number;
    distributions: DistributionResult[];
  }> {
    console.log(`${ICONS.PROCESS} Iniciando scheduler diário de relatórios`);

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Buscar agendamentos para hoje
    const schedules = await this.findSchedulesToRun(today);
    console.log(`${ICONS.INFO} Encontrados ${schedules.length} agendamentos para processar`);

    const distributions: DistributionResult[] = [];
    let processed = 0;
    let scheduled = 0;
    let errors = 0;

    for (const schedule of schedules) {
      try {
        // Validar quota
        const quotaValidation = await this.quotaSystem.validateReportCreation(
          schedule.workspaceId,
          schedule.processIds.length,
          schedule.type
        );

        if (!quotaValidation.allowed) {
          console.log(`${ICONS.WARNING} Quota excedida para workspace ${schedule.workspaceId}: ${quotaValidation.error}`);

          // Criar execução com status de erro
          await this.createFailedExecution(schedule.id, schedule.workspaceId, quotaValidation.error || 'Quota excedida');
          errors++;
          continue;
        }

        // Calcular horário distribuído
        const distributionHash = this.calculateDistributionHash(schedule.workspaceId);
        const assignedTime = this.calculateExecutionTime(distributionHash);

        // Criar execução agendada
        const execution = await prisma.reportExecution.create({
          data: {
            workspaceId: schedule.workspaceId,
            scheduleId: schedule.id,
            reportType: schedule.type,
            parameters: schedule.filters || {},
            recipients: schedule.recipients,
            status: 'AGENDADO',
            audienceType: schedule.audienceType,
            outputFormats: schedule.outputFormats,
            processCount: schedule.processIds.length,
            scheduledFor: assignedTime,
            quotaConsumed: 1
          }
        });

        // Consumir quota
        await this.quotaSystem.consumeQuota(schedule.workspaceId, 1);

        // Atualizar próxima execução do schedule
        const nextRun = this.calculateNextRun(schedule);
        await prisma.reportSchedule.update({
          where: { id: schedule.id },
          data: {
            lastRun: today,
            nextRun,
            monthlyQuotaUsed: { increment: 1 }
          }
        });

        distributions.push({
          workspaceId: schedule.workspaceId,
          scheduleId: schedule.id,
          assignedTime,
          distributionHash
        });

        scheduled++;
        processed++;

        console.log(`${ICONS.SUCCESS} Agendado relatório ${execution.id} para ${assignedTime.toLocaleTimeString()}`);

      } catch (error) {
        console.error(`${ICONS.ERROR} Erro ao processar schedule ${schedule.id}:`, error);
        errors++;
      }
    }

    console.log(`${ICONS.SUCCESS} Scheduler concluído: ${scheduled} agendados, ${errors} erros`);

    return {
      processed,
      scheduled,
      errors,
      distributions
    };
  }

  /**
   * Executa relatórios pendentes na janela atual
   */
  async runExecutionWindow(): Promise<{
    executed: number;
    failed: number;
    executions: string[];
  }> {
    const now = new Date();
    const windowStart = new Date(now);
    windowStart.setMinutes(now.getMinutes() - 5); // 5 min de tolerância

    const windowEnd = new Date(now);
    windowEnd.setMinutes(now.getMinutes() + 5);

    // Buscar execuções agendadas para agora
    const executions = await prisma.reportExecution.findMany({
      where: {
        status: 'AGENDADO',
        scheduledFor: {
          gte: windowStart,
          lte: windowEnd
        }
      },
      include: {
        schedule: true
      },
      take: this.config.maxConcurrent
    });

    console.log(`${ICONS.PROCESS} Executando ${executions.length} relatórios na janela atual`);

    let executed = 0;
    let failed = 0;
    const executionIds: string[] = [];

    // Processar em paralelo com limite
    const promises = executions.map(async (execution) => {
      try {
        await this.executeReport(execution.id);
        executed++;
        executionIds.push(execution.id);
      } catch (error) {
        console.error(`${ICONS.ERROR} Falha na execução ${execution.id}:`, error);
        failed++;

        // Reverter quota se falhou
        await this.quotaSystem.refundQuota(execution.workspaceId, execution.quotaConsumed);
      }
    });

    await Promise.all(promises);

    console.log(`${ICONS.SUCCESS} Janela executada: ${executed} sucessos, ${failed} falhas`);

    return {
      executed,
      failed,
      executions: executionIds
    };
  }

  /**
   * Executa um relatório específico
   */
  private async executeReport(executionId: string): Promise<void> {
    // Marcar como em processamento
    await prisma.reportExecution.update({
      where: { id: executionId },
      data: {
        status: 'RUNNING',
        startedAt: new Date()
      }
    });

    const execution = await prisma.reportExecution.findUnique({
      where: { id: executionId },
      include: {
        schedule: true
      }
    });

    if (!execution || !execution.schedule) {
      throw new Error('Execution ou Schedule não encontrado');
    }

    try {
      // Gerar relatório usando ReportGenerator
      const result = await this.reportGenerator.generateScheduledReport({
        workspaceId: execution.workspaceId,
        reportType: execution.reportType,
        processIds: execution.schedule.processIds,
        audienceType: execution.audienceType,
        outputFormats: execution.outputFormats,
        deltaDataOnly: execution.reportType === 'NOVIDADES'
      });

      // Marcar como concluído
      await prisma.reportExecution.update({
        where: { id: executionId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          duration: Date.now() - execution.startedAt.getTime(),
          result: result.summary,
          fileUrls: result.fileUrls,
          tokensUsed: result.tokensUsed,
          cacheHit: result.cacheHit,
          cacheKey: result.cacheKey
        }
      });

      // Enviar notificação (implementar)
      await this.sendReportNotification(execution, result);

      console.log(`${ICONS.SUCCESS} Relatório ${executionId} concluído com sucesso`);

    } catch (error) {
      // Marcar como falhou
      await prisma.reportExecution.update({
        where: { id: executionId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          duration: Date.now() - execution.startedAt.getTime(),
          error: error instanceof Error ? error.message : 'Erro desconhecido',
          retryCount: { increment: 1 }
        }
      });

      throw error;
    }
  }

  /**
   * Calcula hash de distribuição baseado no workspace ID
   */
  private calculateDistributionHash(workspaceId: string): number {
    const hash = createHash('sha256')
      .update(workspaceId)
      .digest('hex');

    // Converter para número entre 0-299 (5 horas em minutos)
    return parseInt(hash.substring(0, 8), 16) % 300;
  }

  /**
   * Calcula horário de execução baseado no hash
   */
  private calculateExecutionTime(distributionHash: number): Date {
    const baseTime = new Date();
    const [startHour, startMinute] = this.config.windowStart.split(':').map(Number);

    // Começar às 23:00
    baseTime.setHours(startHour, startMinute, 0, 0);

    // Adicionar minutos baseado no hash (0-299 minutos = 0-4h59m)
    baseTime.setMinutes(baseTime.getMinutes() + distributionHash);

    // Se passou para o dia seguinte (depois das 04:00), ajustar
    if (baseTime.getHours() >= 4) {
      baseTime.setDate(baseTime.getDate() + 1);
      baseTime.setHours(23, 0, 0, 0);
      baseTime.setMinutes(baseTime.getMinutes() + (distributionHash % 60));
    }

    return baseTime;
  }

  /**
   * Encontra schedules que devem rodar hoje
   */
  private async findSchedulesToRun(date: Date): Promise<Array<Record<string, unknown>>> {
    const today = new Date(date);
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return await prisma.reportSchedule.findMany({
      where: {
        enabled: true,
        OR: [
          {
            nextRun: {
              gte: today,
              lt: tomorrow
            }
          },
          {
            nextRun: {
              lte: today
            }
          }
        ]
      },
      include: {
        workspace: {
          select: {
            plan: true,
            status: true
          }
        }
      }
    });
  }

  /**
   * Calcula próxima execução baseada na frequência
   */
  private calculateNextRun(schedule: Record<string, unknown>): Date {
    const next = new Date();

    switch (schedule.frequency) {
      case 'DAILY':
        next.setDate(next.getDate() + 1);
        break;
      case 'WEEKLY':
        next.setDate(next.getDate() + 7);
        break;
      case 'BIWEEKLY':
        next.setDate(next.getDate() + 14);
        break;
      case 'MONTHLY':
        next.setMonth(next.getMonth() + 1);
        break;
      default:
        next.setDate(next.getDate() + 7); // Default semanal
    }

    return next;
  }

  /**
   * Cria execução de falha por quota
   */
  private async createFailedExecution(scheduleId: string, workspaceId: string, error: string): Promise<void> {
    await prisma.reportExecution.create({
      data: {
        workspaceId,
        scheduleId,
        status: 'FAILED',
        error,
        quotaConsumed: 0,
        startedAt: new Date(),
        completedAt: new Date()
      }
    });
  }

  /**
   * Envia notificação do relatório (placeholder)
   */
  private async sendReportNotification(execution: Record<string, unknown>, result: Record<string, unknown>): Promise<void> {
    try {
      const recipients = execution.recipients as string[];
      const schedule = await prisma.reportSchedule.findUnique({
        where: { id: execution.scheduleId as string }
      });

      if (!schedule || !recipients || recipients.length === 0) {
        console.warn(`${ICONS.WARNING} [Report] Sem destinatários ou agendamento para notificação`);
        return;
      }

      // Extrair informações do resultado
      const fileName = (result.fileName as string) || `report-${Date.now()}`;
      const fileSize = (result.fileSize as number) || 0;
      const downloadUrl = (result.publicUrl as string) || '#';
      const expiresAt = result.expiresAt ? new Date(result.expiresAt as string) : undefined;

      // Enviar notificação
      await sendReportReady(
        recipients,
        schedule.name,
        downloadUrl,
        fileSize,
        expiresAt
      );

      console.log(`${ICONS.SUCCESS} [Report] Notificação enviada para: ${recipients.join(', ')}`);
    } catch (error) {
      console.error(`${ICONS.ERROR} [Report] Erro ao enviar notificação:`, error);
      // Não lançar erro para não quebrar o fluxo de execução
    }
  }

  /**
   * Limpeza de execuções antigas
   */
  async cleanupOldExecutions(daysToKeep: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await prisma.reportExecution.deleteMany({
      where: {
        completedAt: {
          lt: cutoffDate
        },
        status: {
          in: ['COMPLETED', 'FAILED', 'CANCELLED']
        }
      }
    });

    console.log(`${ICONS.SUCCESS} Limpeza concluída: ${result.count} execuções removidas`);
    return result.count;
  }

  /**
   * Estatísticas do scheduler
   */
  async getSchedulerStats(): Promise<{
    activeSchedules: number;
    pendingExecutions: number;
    todayExecutions: number;
    successRate: number;
    avgExecutionTime: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [activeSchedules, pendingExecutions, todayStats, successStats] = await Promise.all([
      prisma.reportSchedule.count({
        where: { enabled: true }
      }),

      prisma.reportExecution.count({
        where: { status: 'AGENDADO' }
      }),

      prisma.reportExecution.aggregate({
        where: {
          startedAt: {
            gte: today,
            lt: tomorrow
          }
        },
        _count: { id: true },
        _avg: { duration: true }
      }),

      prisma.reportExecution.count({
        where: {
          startedAt: {
            gte: today,
            lt: tomorrow
          },
          status: 'COMPLETED'
        }
      })
    ]);

    const successRate = todayStats._count.id > 0
      ? (successStats / todayStats._count.id) * 100
      : 0;

    return {
      activeSchedules,
      pendingExecutions,
      todayExecutions: todayStats._count.id,
      successRate: Math.round(successRate),
      avgExecutionTime: Math.round(todayStats._avg.duration || 0)
    };
  }
}