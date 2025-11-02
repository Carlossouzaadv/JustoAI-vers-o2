// ================================================================
// JOB SCHEDULER
// Configuração de jobs agendados usando node-cron
// ================================================================

import cron from 'node-cron';
import { executeDailyCheck } from './dailyJuditCheck';
import { sendJobSuccess, sendJobFailure } from '@/lib/notification-service';

// ================================================================
// TIPOS
// ================================================================

interface JobConfig {
  name: string;
  schedule: string;
  enabled: boolean;
  task: () => Promise<any>;
  onError?: (error: any) => void;
  onSuccess?: (result: any) => void;
}

// ================================================================
// LOGS
// ================================================================

const log = {
  info: (message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [SCHEDULER] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [SCHEDULER ERROR] ${message}`, error || '');
  },
  success: (message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [SCHEDULER ✓] ${message}`, data || '');
  },
};

// ================================================================
// CONFIGURAÇÃO DOS JOBS
// ================================================================

const JOBS: JobConfig[] = [
  {
    name: 'Daily JUDIT Check',
    schedule: '0 2 * * *', // 2:00 AM todos os dias
    enabled: true,
    task: executeDailyCheck,
    onSuccess: (result) => {
      log.success('Daily JUDIT Check concluído', {
        total: result.total,
        successful: result.successful,
        withNewMovements: result.withNewMovements,
        duration: `${(result.duration / 60000).toFixed(2)} min`,
      });

      // ✅ Enviar notificação de sucesso
      sendJobSuccess('Daily JUDIT Check', {
        'Total': result.total,
        'Bem-sucedidos': result.successful,
        'Falhados': result.failed || 0,
        'Com Novas Movimentações': result.withNewMovements,
        'Duração (minutos)': (result.duration / 60000).toFixed(2)
      }).catch((err) => {
        log.error('Erro ao enviar notificação de sucesso', err);
      });
    },
    onError: (error) => {
      log.error('Daily JUDIT Check falhou', error);

      // ✅ Enviar alerta crítico via email/Slack
      sendJobFailure('Daily JUDIT Check', error as Error, {
        'Timestamp': new Date().toISOString()
      }).catch((err) => {
        log.error('Erro ao enviar alerta de falha', err);
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
 * Inicia todos os jobs agendados
 */
export function startScheduler() {
  log.info('========================================');
  log.info('INICIANDO SCHEDULER DE JOBS');
  log.info('========================================');

  for (const jobConfig of JOBS) {
    if (!jobConfig.enabled) {
      log.info(`Job desabilitado: ${jobConfig.name}`);
      continue;
    }

    try {
      const task = cron.schedule(jobConfig.schedule, async () => {
        log.info(`Executando job: ${jobConfig.name}`);
        const startTime = Date.now();

        try {
          const result = await jobConfig.task();
          const duration = Date.now() - startTime;

          log.success(`Job concluído: ${jobConfig.name}`, {
            duration: `${(duration / 1000).toFixed(2)}s`,
          });

          if (jobConfig.onSuccess) {
            jobConfig.onSuccess(result);
          }

        } catch (error) {
          log.error(`Job falhou: ${jobConfig.name}`, error);

          if (jobConfig.onError) {
            jobConfig.onError(error);
          }
        }
      });

      scheduledJobs.set(jobConfig.name, task);

      log.success(`Job agendado: ${jobConfig.name}`, {
        schedule: jobConfig.schedule,
        nextRun: getNextRunTime(jobConfig.schedule),
      });

    } catch (error) {
      log.error(`Erro ao agendar job: ${jobConfig.name}`, error);
    }
  }

  log.info('========================================');
  log.info(`${scheduledJobs.size} jobs ativos`);
  log.info('========================================');
}

/**
 * Para todos os jobs agendados
 */
export function stopScheduler() {
  log.info('Parando scheduler...');

  for (const [name, task] of scheduledJobs.entries()) {
    task.stop();
    log.info(`Job parado: ${name}`);
  }

  scheduledJobs.clear();
  log.success('Scheduler parado');
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

  log.info(`Executando job manualmente: ${jobName}`);

  try {
    const result = await job.task();
    log.success(`Job manual concluído: ${jobName}`);
    return result;
  } catch (error) {
    log.error(`Job manual falhou: ${jobName}`, error);
    throw error;
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

  } catch (error) {
    return 'Erro ao calcular';
  }
}

// ================================================================
// INICIALIZAÇÃO AUTOMÁTICA (se executado diretamente)
// ================================================================

if (require.main === module) {
  log.info('Iniciando scheduler em modo standalone...');

  startScheduler();

  // Manter processo vivo
  process.on('SIGINT', () => {
    log.info('Recebido SIGINT, parando scheduler...');
    stopScheduler();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    log.info('Recebido SIGTERM, parando scheduler...');
    stopScheduler();
    process.exit(0);
  });

  log.info('Scheduler rodando. Pressione Ctrl+C para parar.');
}
