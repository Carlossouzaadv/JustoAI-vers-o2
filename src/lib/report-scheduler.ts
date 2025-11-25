// ================================================================
// SCHEDULER DE RELATÓRIOS - Distribuição em Janelas Noturnas
// ================================================================

import { prisma } from '@/lib/prisma';
import { createHash } from 'crypto';
import { QuotaSystem } from '@/lib/quota-system';
import { ReportGenerator } from '@/lib/report-generator';
import { ICONS } from '@/lib/icons';
import { sendReportReady } from '@/lib/notification-service';
import { getWebSocketManager } from '@/lib/websocket-manager';
import { ReportType, AudienceType, OutputFormat } from '@/lib/types/database';
import { log, logError } from '@/lib/services/logger';

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

/**
 * Interface para ReportExecution com Schedule incluído (do Prisma)
 */
interface ReportExecutionWithSchedule {
  id: string;
  workspaceId: string;
  scheduleId: string | null;
  reportType: ReportType;
  parameters: Record<string, unknown>;
  recipients: string[];
  status: string;
  audienceType: AudienceType;
  outputFormats: OutputFormat[];
  processCount: number;
  scheduledFor: Date | null;
  quotaConsumed: number;
  startedAt: Date;
  completedAt: Date | null;
  duration: number | null;
  result: Record<string, unknown> | null;
  fileUrls: Record<string, unknown> | null;
  tokensUsed: number | null;
  cacheHit: boolean | null;
  cacheKey: string | null;
  error: string | null;
  retryCount: number;
  schedule: {
    id: string;
    workspaceId: string;
    name: string;
    description: string | null;
    type: ReportType;
    frequency: string;
    processIds: string[];
    filters: Record<string, unknown> | null;
    audienceType: AudienceType;
    outputFormats: OutputFormat[];
    recipients: string[];
    enabled: boolean;
    lastRun: Date | null;
    nextRun: Date | null;
    monthlyQuotaUsed: number;
    createdAt: Date;
    updatedAt: Date;
  } | null;
}

/**
 * Type guard: Valida se um valor é um ReportType válido
 */
function isValidReportType(value: unknown): value is ReportType {
  return typeof value === 'string' && Object.values(ReportType).includes(value as ReportType);
}

/**
 * Type guard: Valida se um valor é um AudienceType válido
 */
function isValidAudienceType(value: unknown): value is AudienceType {
  return typeof value === 'string' && Object.values(AudienceType).includes(value as AudienceType);
}

/**
 * Type guard: Valida se um valor é um array de OutputFormat válido
 */
function isValidOutputFormats(value: unknown): value is OutputFormat[] {
  return (
    Array.isArray(value) &&
    value.every(v => typeof v === 'string' && Object.values(OutputFormat).includes(v as OutputFormat))
  );
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
    log.info({ msg: 'Iniciando scheduler diário de relatórios' });

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Buscar agendamentos para hoje
    const schedules = await this.findSchedulesToRun(today);
    log.info({ msg: 'Encontrados  agendamentos para processar' });

    const distributions: DistributionResult[] = [];
    let processed = 0;
    let scheduled = 0;
    let errors = 0;

    for (const schedule of schedules) {
      try {
        // Validar quota (apenas 2 argumentos)
        const quotaValidation = await this.quotaSystem.validateReportCreation(
          schedule.workspaceId,
          schedule.processIds.length
        );

        if (!quotaValidation.allowed) {
          log.info({ msg: 'Quota excedida para workspace :' });

          // Criar execução com status de erro
          await this.createFailedExecution(schedule.id, schedule.workspaceId, quotaValidation.error || 'Quota excedida');
          errors++;
          continue;
        }

        // Validar tipos de enum antes de usar
        if (!isValidReportType(schedule.type)) {
          throw new Error(`Tipo de relatório inválido: ${schedule.type}`);
        }
        if (!isValidAudienceType(schedule.audienceType)) {
          throw new Error(`Tipo de audiência inválido: ${schedule.audienceType}`);
        }
        if (!isValidOutputFormats(schedule.outputFormats)) {
          throw new Error(`Formatos de saída inválidos: ${JSON.stringify(schedule.outputFormats)}`);
        }

        // Calcular horário distribuído
        const distributionHash = this.calculateDistributionHash(schedule.workspaceId);
        const assignedTime = this.calculateExecutionTime(distributionHash);

        // Criar execução agendada (com tipos validados)
        // Converter parameters para JSON-compatível
        const parametersData = schedule.filters ? JSON.parse(JSON.stringify(schedule.filters)) : {};
        const execution = await prisma.reportExecution.create({
          data: {
            workspaceId: schedule.workspaceId,
            scheduleId: schedule.id,
            reportType: schedule.type,
            parameters: parametersData,
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

        log.info({ msg: 'Agendado relatório  para' });

      } catch (_error) {
        logError(error, '${ICONS.ERROR} Erro ao processar schedule ${schedule.id}:', { component: 'refactored' });
        errors++;
      }
    }

    log.info({ msg: 'Scheduler concluído:  agendados,  erros' });

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

    log.info({ msg: 'Executando  relatórios na janela atual' });

    let executed = 0;
    let failed = 0;
    const executionIds: string[] = [];

    // Processar em paralelo com limite
    const promises = executions.map(async (execution) => {
      try {
        await this.executeReport(execution.id);
        executed++;
        executionIds.push(execution.id);
      } catch (_error) {
        logError(error, '${ICONS.ERROR} Falha na execução ${execution.id}:', { component: 'refactored' });
        failed++;

        // Reverter quota se falhou
        await this.quotaSystem.refundQuota(execution.workspaceId, execution.quotaConsumed);
      }
    });

    await Promise.all(promises);

    log.info({ msg: 'Janela executada:  sucessos,  falhas' });

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
      // Validate enum types before using them
      if (!isValidReportType(execution.reportType)) {
        throw new Error(`Invalid report type: ${execution.reportType}`);
      }
      if (!isValidAudienceType(execution.audienceType)) {
        throw new Error(`Invalid audience type: ${execution.audienceType}`);
      }
      if (!isValidOutputFormats(execution.outputFormats)) {
        throw new Error(`Invalid output formats: ${JSON.stringify(execution.outputFormats)}`);
      }

      // Now the types are narrowed and safe to use
      const reportType = execution.reportType;
      const audienceType = execution.audienceType;
      const outputFormats = execution.outputFormats;

      // Gerar relatório usando ReportGenerator
      const result = await this.reportGenerator.generateScheduledReport({
        workspaceId: execution.workspaceId,
        reportType,
        processIds: execution.schedule.processIds,
        audienceType,
        outputFormats,
        deltaDataOnly: reportType === 'NOVIDADES'
      });

      // Marcar como concluído (converter summary para JSON-compatível)
      const summaryData = result.summary ? JSON.parse(JSON.stringify(result.summary)) : null;
      await prisma.reportExecution.update({
        where: { id: executionId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          duration: Date.now() - execution.startedAt.getTime(),
          result: summaryData,
          fileUrls: result.fileUrls,
          tokensUsed: result.tokensUsed,
          cacheHit: result.cacheHit,
          cacheKey: result.cacheKey
        }
      });

      // Enviar notificação com dados extraídos do result
      const fileUrl = typeof result.fileUrls === 'object' && result.fileUrls !== null
        ? Object.values(result.fileUrls)[0]
        : undefined;

      const fileUrlString = typeof fileUrl === 'string' ? fileUrl : undefined;

      await this.sendReportNotification(execution, {
        fileName: fileUrlString,
        fileSize: 0,
        publicUrl: fileUrlString,
        expiresAt: undefined
      });

      log.info({ msg: 'Relatório  concluído com sucesso' });

    } catch (_error) {
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
   * Retorna o tipo real do Prisma (inferido automaticamente)
   */
  private async findSchedulesToRun(date: Date) {
    const today = new Date(date);
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const schedules = await prisma.reportSchedule.findMany({
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

    return schedules;
  }

  /**
   * Calcula próxima execução baseada na frequência
   * Tipo de schedule inferido do tipo retornado por findSchedulesToRun
   */
  private calculateNextRun(schedule: {
    frequency: string;
  }): Date {
    const next = new Date();

    // Supported frequencies: WEEKLY, BIWEEKLY, MONTHLY (no DAILY)
    switch (schedule.frequency) {
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
  private async sendReportNotification(
    execution: Record<string, unknown>,
    resultData: { fileName?: string; fileSize?: number; publicUrl?: string; expiresAt?: string | Date }
  ): Promise<void> {
    try {
      const recipients = execution.recipients as string[];
      const schedule = await prisma.reportSchedule.findUnique({
        where: { id: execution.scheduleId as string }
      });

      if (!schedule || !recipients || recipients.length === 0) {
        log.warn({ msg: '[Report] Sem destinatários ou agendamento para notificação' });
        return;
      }

      // Extrair informações do resultado com narrowing
      const fileSize = resultData.fileSize || 0;
      const downloadUrl = resultData.publicUrl || '#';
      const expiresAt = resultData.expiresAt ? new Date(resultData.expiresAt) : undefined;

      // Enviar notificação por Email + Slack
      await sendReportReady(
        recipients,
        schedule.name,
        downloadUrl,
        fileSize,
        expiresAt
      );

      // Broadcaster em tempo real via SSE (timestamp é adicionado automaticamente)
      const wsManager = getWebSocketManager();
      wsManager.broadcastToWorkspace(schedule.workspaceId, {
        type: 'report:ready',
        data: {
          scheduleId: schedule.id,
          scheduleName: schedule.name,
          reportType: schedule.type,
          fileSize: fileSize,
          downloadUrl,
          expiresAt: expiresAt?.toISOString(),
          generatedAt: new Date().toISOString()
        }
      });

      log.info({ msg: '[Report] Notificação enviada para:' });
    } catch (_error) {
      logError(error, '${ICONS.ERROR} Report Erro ao enviar notificação:', { component: 'refactored' });
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

    log.info({ msg: 'Limpeza concluída:  execuções removidas' });
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