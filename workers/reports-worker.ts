/**
 * Reports Worker - Geração Automática de Relatórios
 * Worker responsável por gerar relatórios executivos agendados
 * Executa automaticamente domingos às 23h
 */

import { Job } from 'bull';
import { reportsQueue } from '@/lib/queues';
import { prisma } from '@/lib/prisma';
import PDFGenerator from '@/lib/pdf-generator';
import { ReportDataCollector } from '@/lib/report-data-collector';
import { getRedisClient } from '@/lib/redis';
import { addNotificationJob } from '@/lib/queues';
import { addIndividualReportJob } from './individual-reports-worker';
import { ICONS } from '@/lib/icons';

// Get Redis client and create utility wrapper
const redis = getRedisClient();
const redisUtils = {
  async get(key: string) {
    return redis.get(key);
  },
  async setWithTTL(key: string, value: any, ttlSeconds: number) {
    await redis.setex(key, ttlSeconds, typeof value === 'string' ? value : JSON.stringify(value));
  },
  async healthCheck() {
    try {
      await redis.ping();
      return true;
    } catch {
      return false;
    }
  }
};

// === TIPOS E INTERFACES ===

interface ReportsJobData {
  type: 'weekly-reports' | 'scheduled-report' | 'manual-report';
  scheduleId?: string;
  workspaceId?: string;
  forceGenerate?: boolean;
}

interface ReportGenerationResult {
  success: boolean;
  generatedCount: number;
  failedCount: number;
  totalSchedules: number;
  errors: Array<{
    scheduleId: string;
    error: string;
    clientName?: string;
  }>;
  duration: number;
  timestamp: string;
  reports: Array<{
    scheduleId: string;
    clientName: string;
    reportPath: string;
    processCount: number;
    fileSize: number;
  }>;
}

// === CONFIGURAÇÕES ===

const REPORTS_CONFIG = {
  MAX_CONCURRENT: 3,                 // Máximo de relatórios simultâneos
  BATCH_SIZE: 10,                   // Agendamentos por lote
  RETRY_DELAY: 60000,               // 1 minuto entre tentativas
  REPORT_TIMEOUT: 300000,           // 5 minutos timeout por relatório
  MAX_PROCESSES_PER_REPORT: 50,     // Máximo de processos por relatório
  DELIVERY_RETRY_ATTEMPTS: 3,       // Tentativas de entrega
};

// === WORKER PROCESSOR - RELATÓRIOS SEMANAIS ===

reportsQueue().process('generate-scheduled-reports', async (job: Job<ReportsJobData>) => {
  const startTime = Date.now();
  console.log(`${ICONS.REPORT} Starting weekly reports generation...`);

  try {
    await job.progress(5);

    // Buscar todos os agendamentos ativos
    const activeSchedules = await getActiveReportSchedules();

    console.log(`${ICONS.INFO} Found ${activeSchedules.length} active report schedules`);
    await job.progress(10);

    if (activeSchedules.length === 0) {
      return createEmptyResult(startTime);
    }

    // Filtrar agendamentos que devem ser executados
    const schedulesToProcess = filterSchedulesForExecution(activeSchedules);

    console.log(`${ICONS.CALENDAR} ${schedulesToProcess.length} schedules ready for execution`);
    await job.progress(15);

    // Processar agendamentos em lotes
    const result = await processScheduleBatches(schedulesToProcess, job);

    // Salvar resultado
    await saveReportGenerationResult(result);

    console.log(`${ICONS.CHECK} Reports generation completed: ${result.generatedCount}/${result.totalSchedules} generated`);
    return result;

  } catch (error) {
    console.error(`${ICONS.ERROR} Reports generation failed:`, error);

    const errorResult = createErrorResult(startTime, error);
    await saveReportGenerationResult(errorResult);
    throw error;
  }
});

// === WORKER PROCESSOR - RELATÓRIO INDIVIDUAL ===

reportsQueue().process('generate-report', async (job: Job<ReportsJobData>) => {
  const { scheduleId } = job.data;
  const startTime = Date.now();

  console.log(`${ICONS.REPORT} Generating individual report for schedule: ${scheduleId}`);

  try {
    await job.progress(10);

    // Buscar agendamento específico
    const schedule = await getReportScheduleById(scheduleId!);
    if (!schedule) {
      throw new Error(`Schedule not found: ${scheduleId}`);
    }

    await job.progress(20);

    // Gerar relatório
    const reportResult = await generateSingleReport(schedule, job);

    // Entregar relatório
    await deliverReport(schedule, reportResult.reportPath, job);

    await job.progress(100);

    const result: ReportGenerationResult = {
      success: true,
      generatedCount: 1,
      failedCount: 0,
      totalSchedules: 1,
      errors: [],
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      reports: [reportResult]
    };

    return result;

  } catch (error) {
    console.error(`${ICONS.ERROR} Individual report generation failed:`, error);

    const errorResult: ReportGenerationResult = {
      success: false,
      generatedCount: 0,
      failedCount: 1,
      totalSchedules: 1,
      errors: [{
        scheduleId: scheduleId || 'unknown',
        error: error instanceof Error ? error.message : 'Unknown error'
      }],
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      reports: []
    };

    throw error;
  }
});

// === FUNÇÕES AUXILIARES ===

/**
 * Busca agendamentos ativos
 */
async function getActiveReportSchedules() {
  return await prisma.reportSchedule.findMany({});
}

/**
 * Busca agendamento por ID
 */
async function getReportScheduleById(scheduleId: string) {
  return await prisma.reportSchedule.findUnique({
    where: { id: scheduleId }
  });
}

/**
 * Filtra agendamentos que devem ser executados
 */
function filterSchedulesForExecution(schedules: any[]) {
  const now = new Date();
  const currentDay = now.getDay(); // 0 = domingo
  const currentHour = now.getHours();

  return schedules.filter(schedule => {
    const nextExecution = new Date(schedule.nextRun);

    // Verifica se está na janela de execução (domingo 23h - segunda 1h)
    const isInExecutionWindow = (
      (currentDay === 0 && currentHour >= 23) || // Domingo após 23h
      (currentDay === 1 && currentHour <= 1)     // Segunda antes das 1h
    );

    // Verifica se deve executar baseado na data
    const shouldExecuteToday = nextExecution <= now;

    return isInExecutionWindow && shouldExecuteToday;
  });
}

/**
 * Processa agendamentos em lotes
 */
async function processScheduleBatches(schedules: any[], job: Job<ReportsJobData>): Promise<ReportGenerationResult> {
  const startTime = Date.now();
  const result: ReportGenerationResult = {
    success: true,
    generatedCount: 0,
    failedCount: 0,
    totalSchedules: schedules.length,
    errors: [],
    duration: 0,
    timestamp: new Date().toISOString(),
    reports: []
  };

  const batches = chunkArray(schedules, REPORTS_CONFIG.BATCH_SIZE);
  const totalBatches = batches.length;

  for (let i = 0; i < totalBatches; i++) {
    const batch = batches[i];

    console.log(`${ICONS.BATCH} Processing batch ${i + 1}/${totalBatches} (${batch.length} schedules)`);

    // Processar lote atual
    const batchResult = await processBatch(batch, job);

    // Acumular resultados
    result.generatedCount += batchResult.generatedCount;
    result.failedCount += batchResult.failedCount;
    result.errors.push(...batchResult.errors);
    result.reports.push(...batchResult.reports);

    // Atualizar progresso (15% inicial + 80% processamento + 5% finalização)
    const progress = 15 + Math.round((i + 1) / totalBatches * 80);
    await job.progress(progress);

    // Delay entre lotes
    if (i < totalBatches - 1) {
      await sleep(2000);
    }
  }

  result.duration = Date.now() - startTime;
  result.success = result.failedCount === 0;

  return result;
}

/**
 * Processa um lote de agendamentos
 */
async function processBatch(schedules: any[], job: Job<ReportsJobData>) {
  const result = {
    generatedCount: 0,
    failedCount: 0,
    errors: [] as Array<{ scheduleId: string; error: string; clientName?: string }>,
    reports: [] as Array<any>
  };

  // Processar até MAX_CONCURRENT agendamentos simultaneamente
  const chunks = chunkArray(schedules, REPORTS_CONFIG.MAX_CONCURRENT);

  for (const chunk of chunks) {
    const promises = chunk.map(schedule => generateAndDeliverReport(schedule));
    const results = await Promise.allSettled(promises);

    results.forEach((promiseResult, index) => {
      const schedule = chunk[index];

      if (promiseResult.status === 'fulfilled') {
        result.generatedCount++;
        result.reports.push(promiseResult.value);
      } else {
        result.failedCount++;
        result.errors.push({
          scheduleId: schedule.id,
          error: promiseResult.reason?.message || 'Unknown error',
          clientName: schedule.client?.name
        });
      }
    });

    // Delay entre chunks
    await sleep(1000);
  }

  return result;
}

/**
 * Gera e entrega um relatório
 */
async function generateAndDeliverReport(schedule: any) {
  console.log(`${ICONS.GENERATE} Generating report for client: ${schedule.client?.name}`);

  // Gerar relatório
  const reportResult = await generateSingleReport(schedule);

  // Entregar relatório
  await deliverReport(schedule, reportResult.reportPath);

  // Atualizar próxima execução
  await updateNextExecution(schedule.id, schedule.frequency);

  return reportResult;
}

/**
 * Gera um único relatório
 */
async function generateSingleReport(schedule: any, job?: Job<ReportsJobData>) {
  const { id: scheduleId, clientId, reportType, processIds } = schedule;

  // Buscar dados para o relatório
  const collector = new ReportDataCollector();
  const reportData = await collector.collectReportData({
    type: reportType,
    filters: {
      workspaceId: schedule.workspaceId,
      clientIds: [clientId],
      processIds: JSON.parse(processIds)
    },
    includeAIInsights: true,
    includeCharts: true
  });

  if (job) await job.progress(50);

  // Gerar PDF
  const reportOptions = {
    type: reportType,
    clientName: schedule.client.name,
    workspaceName: schedule.workspace.name,
    includeAiInsights: true,
    customization: await getReportCustomization(schedule.workspaceId)
  };

  const pdfGenerator = new PDFGenerator();
  const pdfBuffer = await pdfGenerator.generatePDF(reportType, reportData.data, await getReportCustomization(schedule.workspaceId));

  if (job) await job.progress(80);

  // Criar resultado do PDF
  const pdfResult = {
    filePath: `/tmp/reports/${scheduleId}_${Date.now()}.pdf`,
    fileSize: pdfBuffer.length,
    generationTime: Date.now() - Date.now(),
    processCount: reportData.data.processes?.length || 0
  };

  // Salvar o arquivo (você pode implementar a lógica de salvamento aqui)
  // await fs.writeFile(pdfResult.filePath, pdfBuffer);

  // Registrar execução
  await recordReportExecution(scheduleId, pdfResult, schedule.workspaceId, reportType);

  return {
    scheduleId,
    clientName: schedule.client.name,
    reportPath: pdfResult.filePath,
    processCount: reportData.data.processes?.length || 0,
    fileSize: pdfResult.fileSize
  };
}

/**
 * Entrega relatório por email/whatsapp
 */
async function deliverReport(schedule: any, reportPath: string, job?: Job<ReportsJobData>) {
  const { deliveryMethod, deliveryEmail, deliveryPhone } = schedule;

  try {
    if (deliveryMethod === 'email' && deliveryEmail) {
      await addNotificationJob('email-report', {
        to: deliveryEmail,
        clientName: schedule.client.name,
        reportPath,
        scheduleId: schedule.id
      });

      console.log(`${ICONS.MAIL} Email report queued for: ${deliveryEmail}`);

    } else if (deliveryMethod === 'whatsapp' && deliveryPhone) {
      await addNotificationJob('whatsapp-report', {
        phone: deliveryPhone,
        clientName: schedule.client.name,
        reportPath,
        scheduleId: schedule.id
      });

      console.log(`${ICONS.PHONE} WhatsApp report queued for: ${deliveryPhone}`);
    }

    if (job) await job.progress(90);

  } catch (error) {
    console.error(`${ICONS.ERROR} Failed to queue report delivery:`, error);
    throw new Error(`Delivery failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Atualiza próxima execução
 */
async function updateNextExecution(scheduleId: string, frequency: string) {
  const nextRun = calculateNextExecution(frequency);

  await prisma.reportSchedule.update({
    where: { id: scheduleId },
    data: {
      nextRun,
      lastRun: new Date()
    }
  });
}

/**
 * Calcula próxima execução
 */
function calculateNextExecution(frequency: string): Date {
  const now = new Date();

  switch (frequency) {
    case 'weekly':
      // Próximo domingo às 23h
      const nextSunday = new Date(now);
      nextSunday.setDate(now.getDate() + (7 - now.getDay()));
      nextSunday.setHours(23, 0, 0, 0);
      return nextSunday;

    case 'biweekly':
      // A cada 2 semanas no domingo
      const nextBiweekly = new Date(now);
      nextBiweekly.setDate(now.getDate() + 14);
      nextBiweekly.setHours(23, 0, 0, 0);
      return nextBiweekly;

    case 'monthly':
      // 1º de cada mês às 23h
      const nextMonth = new Date(now);
      nextMonth.setMonth(now.getMonth() + 1);
      nextMonth.setDate(1);
      nextMonth.setHours(23, 0, 0, 0);
      return nextMonth;

    default:
      throw new Error(`Unknown frequency: ${frequency}`);
  }
}

/**
 * Registra execução do relatório
 */
async function recordReportExecution(scheduleId: string, pdfResult: any, workspaceId: string, reportType: string) {
  try {
    const { prisma } = await import('@/lib/prisma');

    await prisma.reportExecution.create({
      data: {
        workspaceId,
        scheduleId,
        reportType: reportType as any,
        status: 'COMPLETED',
        filePath: pdfResult.filePath,
        fileSize: pdfResult.fileSize,
        completedAt: new Date(),
        duration: pdfResult.generationTime || 0,
        tokensUsed: pdfResult.tokensUsed || 0,
        estimatedCost: pdfResult.estimatedCost || 0
      }
    });

    console.log(`${ICONS.INFO} Report execution recorded for schedule ${scheduleId}`);
  } catch (error) {
    console.error(`${ICONS.ERROR} Failed to record report execution:`, error);
  }
}

/**
 * Busca customização de relatório
 */
async function getReportCustomization(workspaceId: string) {
  try {
    const { prisma } = await import('@/lib/prisma');

    const customization = await prisma.reportCustomization.findFirst({
      where: {
        workspaceId,
        isDefault: true
      }
    });

    if (customization) {
      return {
        company_name: customization.companyName,
        primary_color: customization.primaryColor,
        secondary_color: customization.secondaryColor,
        accent_color: customization.accentColor,
        show_page_numbers: customization.showPageNumbers,
        logo_url: customization.logoUrl || undefined,
        header_text: customization.headerText || undefined,
        footer_text: customization.footerText || undefined
      };
    }
  } catch (error) {
    console.error(`${ICONS.ERROR} Failed to load customization:`, error);
  }

  // Fallback para valores padrão
  return {
    company_name: 'JustoAI',
    primary_color: '#2563eb',
    secondary_color: '#64748b',
    accent_color: '#10b981',
    show_page_numbers: true
  };
}

/**
 * Salva resultado da geração
 */
async function saveReportGenerationResult(result: ReportGenerationResult) {
  const cacheKey = `reports:execution:${new Date().toISOString().split('T')[0]}`;

  // Cache resultado para dashboard
  await redisUtils.setWithTTL(cacheKey, result, 7 * 24 * 60 * 60); // 7 dias

  // Log estatísticas
  console.log(`${ICONS.CHART} Reports Generation Stats:`, {
    generated: result.generatedCount,
    failed: result.failedCount,
    duration: `${Math.round(result.duration / 1000)}s`,
    errors: result.errors.length
  });
}

// === UTILITY FUNCTIONS ===

function createEmptyResult(startTime: number): ReportGenerationResult {
  return {
    success: true,
    generatedCount: 0,
    failedCount: 0,
    totalSchedules: 0,
    errors: [],
    duration: Date.now() - startTime,
    timestamp: new Date().toISOString(),
    reports: []
  };
}

function createErrorResult(startTime: number, error: any): ReportGenerationResult {
  return {
    success: false,
    generatedCount: 0,
    failedCount: 1,
    totalSchedules: 0,
    errors: [{
      scheduleId: 'system',
      error: error instanceof Error ? error.message : 'Unknown error'
    }],
    duration: Date.now() - startTime,
    timestamp: new Date().toISOString(),
    reports: []
  };
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// === HEALTH CHECK ===

/**
 * Health check do worker
 */
export async function reportsWorkerHealthCheck() {
  try {
    const [waiting, active, completed, failed] = await Promise.all([
      reportsQueue().getWaiting(),
      reportsQueue().getActive(),
      reportsQueue().getCompleted(),
      reportsQueue().getFailed(),
    ]);

    const nextScheduledReports = await prisma.reportSchedule.count({
      where: {
        enabled: true,
        nextRun: {
          lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Próximos 7 dias
        }
      }
    });

    return {
      status: 'healthy',
      queue: {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
      },
      upcomingReports: nextScheduledReports,
      lastRun: completed[0]?.finishedOn ? new Date(completed[0].finishedOn) : null,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

console.log(`${ICONS.WORKER} Reports Worker initialized successfully`);

export default reportsQueue;