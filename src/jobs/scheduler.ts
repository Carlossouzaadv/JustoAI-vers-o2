// ================================================================
// JOB SCHEDULER
// Configuração de jobs agendados usando node-cron
// ================================================================

import * as cron from 'node-cron';
import { log, logError } from '@/lib/services/logger';
import { executeDailyCheck } from './dailyJuditCheck';
import { sendJobSuccess, sendJobFailure } from '@/lib/notification-service';

// ================================================================
// TIPOS
// ================================================================

/**
 * Resultado esperado do Daily Check Job
 */
interface DailyCheckResult {
  total: number;
  successful: number;
  failed: number;
  withNewMovements: number;
  withAttachmentsFetched?: number;
  duration: number;
  errors?: Array<{ cnj: string; error: string }>;
}

/**
 * Type Guard para validar DailyCheckResult
 */
function isDailyCheckResult(data: unknown): data is DailyCheckResult {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const obj = data as Record<string, unknown>;

  return (
    typeof obj.total === 'number' &&
    typeof obj.successful === 'number' &&
    typeof obj.failed === 'number' &&
    typeof obj.withNewMovements === 'number' &&
    typeof obj.duration === 'number'
  );
}

/**
 * Configuração genérica de um job
 * Aceita task com retorno de qualquer tipo, validação feita via callback
 */
interface JobConfig<T = unknown> {
  name: string;
  schedule: string;
  enabled: boolean;
  task: () => Promise<T>;
  onError?: (_error: Error) => void;
  onSuccess?: (_result: T) => void;
}


// ================================================================
// CONFIGURAÇÃO DOS JOBS
// ================================================================

const JOBS: JobConfig<DailyCheckResult>[] = [
  {
    name: 'Daily JUDIT Check',
    schedule: '0 2 * * *', // 2:00 AM todos os dias
    enabled: true,
    task: executeDailyCheck,
    onSuccess: (result) => {
      // ✅ Validação segura via type guard (narrowing)
      if (!isDailyCheckResult(result)) {
        log.warn({
          msg: 'Daily JUDIT Check retornou resultado inválido',
          component: 'scheduler',
          job: 'Daily JUDIT Check',
          type: typeof result,
          keys: typeof result === 'object' && result !== null ? Object.keys(result) : 'N/A',
        });
        return;
      }

      // ✅ Agora é 100% seguro acessar todas as propriedades
      log.info({
        msg: 'Daily JUDIT Check concluído',
        component: 'scheduler',
        job: 'Daily JUDIT Check',
        total: result.total,
        successful: result.successful,
        withNewMovements: result.withNewMovements,
        duration_minutes: (result.duration / 60000).toFixed(2),
      });

      // ✅ Enviar notificação de sucesso
      sendJobSuccess('Daily JUDIT Check', {
        'Total': result.total,
        'Bem-sucedidos': result.successful,
        'Falhados': result.failed,
        'Com Novas Movimentações': result.withNewMovements,
        'Duração (minutos)': (result.duration / 60000).toFixed(2),
      }).catch((err) => {
        logError(err, 'Erro ao enviar notificação de sucesso do Daily JUDIT Check', { component: 'scheduler' });
      });
    },
    onError: (error) => {
      // ✅ error agora é do tipo Error (não unknown)
      logError(error, 'Daily JUDIT Check falhou', { component: 'scheduler', job: 'Daily JUDIT Check' });

      // ✅ Enviar alerta crítico via email/Slack
      sendJobFailure('Daily JUDIT Check', error, {
        'Timestamp': new Date().toISOString(),
      }).catch((err) => {
        logError(err, 'Erro ao enviar alerta de falha do Daily JUDIT Check', { component: 'scheduler' });
      });
    },
  },

  // Adicione mais jobs aqui conforme necessário
  // Exemplo:
  // {
  //   name: 'Weekly Report Generator',
  //   schedule: '0 9 * * 1', // Segunda-feira às 9:00
  //   enabled: false,
  //   task: generateWeeklyReport,
  // },
];

// ================================================================
// SCHEDULER
// ================================================================

const scheduledJobs: Map<string, cron.ScheduledTask> = new Map();

/**
 * Extrai mensagem de erro de forma segura
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Erro desconhecido';
}

/**
 * Converte erro unknown para Error com segurança
 */
function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(getErrorMessage(error));
}

/**
 * Inicia todos os jobs agendados
 */
export function startScheduler() {
  log.info({ msg: 'Starting scheduler', component: 'scheduler', status: 'starting' });

  for (const jobConfig of JOBS) {
    if (!jobConfig.enabled) {
      log.info({ msg: `Job disabled: ${jobConfig.name}`, component: 'scheduler', job: jobConfig.name });
      continue;
    }

    try {
      const task = cron.schedule(jobConfig.schedule, async () => {
        log.info({ msg: `Running job: ${jobConfig.name}`, component: 'scheduler', job: jobConfig.name });
        const startTime = Date.now();

        try {
          const result = await jobConfig.task();
          const duration = Date.now() - startTime;

          log.info({
            msg: `Job completed: ${jobConfig.name}`,
            component: 'scheduler',
            job: jobConfig.name,
            duration_seconds: (duration / 1000).toFixed(2),
          });

          if (jobConfig.onSuccess) {
            jobConfig.onSuccess(result);
          }
        } catch (error) {
          // ✅ Converter error unknown para Error com segurança
          const errorObj = toError(error);
          logError(errorObj, `Job failed: ${jobConfig.name}`, { component: 'scheduler', job: jobConfig.name });

          if (jobConfig.onError) {
            jobConfig.onError(errorObj);
          }
        }
      });

      scheduledJobs.set(jobConfig.name, task);

      log.info({
        msg: `Job scheduled: ${jobConfig.name}`,
        component: 'scheduler',
        job: jobConfig.name,
        schedule: jobConfig.schedule,
        nextRun: getNextRunTime(jobConfig.schedule),
      });
    } catch (error) {
      // ✅ Converter error unknown para Error com segurança
      const errorObj = toError(error);
      logError(errorObj, `Error scheduling job: ${jobConfig.name}`, { component: 'scheduler', job: jobConfig.name });
    }
  }

  log.info({
    msg: 'Scheduler started',
    component: 'scheduler',
    status: 'running',
    active_jobs: scheduledJobs.size,
  });
}

/**
 * Para todos os jobs agendados
 */
export function stopScheduler() {
  log.info({ msg: 'Stopping scheduler...', component: 'scheduler' });

  for (const [name, task] of scheduledJobs.entries()) {
    task.stop();
    log.info({ msg: `Job stopped: ${name}`, component: 'scheduler', job: name });
  }

  scheduledJobs.clear();
  log.info({ msg: 'Scheduler stopped', component: 'scheduler', status: 'stopped' });
}

/**
 * Lista status de todos os jobs
 */
export function listJobs() {
  const jobStatuses = JOBS.map((job) => ({
    name: job.name,
    schedule: job.schedule,
    enabled: job.enabled,
    nextRun: job.enabled ? getNextRunTime(job.schedule) : 'N/A',
    isRunning: scheduledJobs.has(job.name),
  }));

  return jobStatuses;
}

/**
 * Executa um job manualmente (fora do schedule)
 */
export async function runJobManually(jobName: string) {
  const job = JOBS.find((j) => j.name === jobName);

  if (!job) {
    throw new Error(`Job não encontrado: ${jobName}`);
  }

  log.info({ msg: `Running job manually: ${jobName}`, component: 'scheduler', job: jobName, manual: true });

  try {
    const result = await job.task();
    log.info({ msg: `Manual job completed: ${jobName}`, component: 'scheduler', job: jobName, manual: true });
    return result;
  } catch (error) {
    // ✅ Converter error unknown para Error com segurança
    const errorObj = toError(error);
    logError(errorObj, `Manual job failed: ${jobName}`, { component: 'scheduler', job: jobName, manual: true });
    throw errorObj;
  }
}

// ================================================================
// UTILITÁRIOS
// ================================================================

/**
 * Calcula próximo horário de execução
 */
function getNextRunTime(cronExpression: string): string {
  try {
    // Parse simples do cron (não 100% preciso, mas funciona para a maioria)
    const parts = cronExpression.split(' ');
    const [minute, hour] = parts;

    const now = new Date();
    const next = new Date();

    next.setHours(parseInt(hour), parseInt(minute), 0, 0);

    // Se já passou hoje, agendar para amanhã
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }

    return next.toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });

  } catch (_error) {
    return 'Erro ao calcular';
  }
}

// ================================================================
// INICIALIZAÇÃO AUTOMÁTICA (se executado diretamente)
// ================================================================

if (require.main === module) {
  log.info({ msg: 'Starting scheduler in standalone mode', component: 'scheduler', mode: 'standalone' });

  startScheduler();

  // Manter processo vivo
  process.on('SIGINT', () => {
    log.info({ msg: 'Received SIGINT, stopping scheduler...', component: 'scheduler', signal: 'SIGINT' });
    stopScheduler();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    log.info({ msg: 'Received SIGTERM, stopping scheduler...', component: 'scheduler', signal: 'SIGTERM' });
    stopScheduler();
    process.exit(0);
  });

  log.info({ msg: 'Scheduler running. Press Ctrl+C to stop.', component: 'scheduler', status: 'ready' });
}
