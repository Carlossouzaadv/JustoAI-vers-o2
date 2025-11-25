// ================================================================
// DAILY JUDIT CHECK - CRON JOB
// Verifica diariamente todos os monitoramentos ativos
// ================================================================

import {
  listActiveMonitorings,
  checkTrackingUpdates,
  updateProcessWithMovements,
  analyzeMovementsAndFetchAttachmentsIfNeeded,
  type Processo,
} from '@/lib/services/juditMonitoringService';
import { sendDailyCheckSummary } from '@/lib/notification-service';

// ================================================================
// TIPOS E INTERFACES
// ================================================================

interface CheckResult {
  trackingId: string;
  processoId: string;
  numeroCnj: string;
  success: boolean;
  hasNewMovements: boolean;
  movementsCount: number;
  requiresAttachmentCheck?: boolean; // Para próximo prompt
  error?: string;
}

interface BatchResult {
  total: number;
  successful: number;
  failed: number;
  withNewMovements: number;
  withAttachmentsFetched: number; // Processos que tiveram anexos buscados
  duration: number;
  errors: Array<{ cnj: string; error: string }>;
}

// ================================================================
// TYPE GUARDS - PADRÃO-OURO
// ================================================================

/**
 * Valida se um objeto desconhecido é uma estrutura de monitoramento válida
 * Requisitos: trackingId (string), processoId (string), processo (object)
 * Use isMonitoringComplete() para validação completa com Processo
 */
function isMonitoringBasic(data: unknown): data is {
  trackingId: string;
  processoId: string;
  processo: unknown;
} {
  return (
    typeof data === 'object' &&
    data !== null &&
    'trackingId' in data &&
    typeof (data as { trackingId: unknown }).trackingId === 'string' &&
    'processoId' in data &&
    typeof (data as { processoId: unknown }).processoId === 'string' &&
    'processo' in data
  );
}

/**
 * Valida estrutura de monitoramento completa com Processo válido
 * Padrão-Ouro: Composição de type guards
 */
function isMonitoringComplete(data: unknown): data is {
  trackingId: string;
  processoId: string;
  processo: Processo;
} {
  return isMonitoringBasic(data) && isProcesso(data.processo);
}

/**
 * Valida apenas que o objeto tem numeroCnj (para extração de texto)
 */
// eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
function hasNumeroCnj(data: unknown): data is { numeroCnj: string } {
  return (
    typeof data === 'object' &&
    data !== null &&
    'numeroCnj' in data &&
    typeof (data as { numeroCnj: unknown }).numeroCnj === 'string'
  );
}

/**
 * Valida se o objeto é um Processo válido (com id e numeroCnj mínimos)
 */
function isProcesso(data: unknown): data is Processo {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    typeof (data as { id: unknown }).id === 'string' &&
    'numeroCnj' in data &&
    typeof (data as { numeroCnj: unknown }).numeroCnj === 'string'
  );
}

// ================================================================
// CONFIGURAÇÕES
// ================================================================

const CRON_CONFIG = {
  // Batch processing
  BATCH_SIZE: 50, // Processos por lote
  CONCURRENT_CHECKS: 5, // Verificações paralelas por lote
  BATCH_DELAY_MS: 2000, // Delay entre lotes (rate limiting)

  // Timestamp
  LOOKBACK_HOURS: 24, // Buscar mudanças nas últimas 24h

  // Error handling
  MAX_RETRIES_PER_PROCESS: 2,
  RETRY_DELAY_MS: 3000,

  // Logging
  LOG_PROGRESS_INTERVAL: 10, // Log a cada N processos
} as const;

// ================================================================
// LOGS
// ================================================================

const log = {
  info: (message: string, data?: unknown) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [DAILY JUDIT CHECK] ${message}`, data || '');
  },
  error: (message: string, error?: unknown) => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [DAILY JUDIT CHECK ERROR] ${message}`, error || '');
  },
  warn: (message: string, data?: unknown) => {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] [DAILY JUDIT CHECK WARN] ${message}`, data || '');
  },
  success: (message: string, data?: unknown) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [DAILY JUDIT CHECK ✓] ${message}`, data || '');
  },
};

const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

// ================================================================
// FUNÇÃO PRINCIPAL DO CRON JOB
// ================================================================

/**
 * Executa verificação diária de todos os monitoramentos ativos
 */
export async function runDailyJuditCheck(): Promise<BatchResult> {
  const startTime = Date.now();

  log.info('========================================');
  log.info('INICIANDO VERIFICAÇÃO DIÁRIA JUDIT');
  log.info('========================================');

  try {
    // ============================================================
    // ETAPA 1: BUSCAR MONITORAMENTOS ATIVOS
    // ============================================================

    log.info('Buscando monitoramentos ativos...');

    const activeMonitorings = await listActiveMonitorings();

    log.info(`Encontrados ${activeMonitorings.length} monitoramentos ativos`);

    if (activeMonitorings.length === 0) {
      log.warn('Nenhum monitoramento ativo encontrado. Finalizando.');
      return {
        total: 0,
        successful: 0,
        failed: 0,
        withNewMovements: 0,
        withAttachmentsFetched: 0,
        duration: Date.now() - startTime,
        errors: [],
      };
    }

    // ============================================================
    // ETAPA 2: CALCULAR TIMESTAMP DE LOOKBACK
    // ============================================================

    const lookbackTimestamp = calculateLookbackTimestamp(CRON_CONFIG.LOOKBACK_HOURS);

    log.info('Verificando mudanças desde:', lookbackTimestamp);

    // ============================================================
    // ETAPA 3: PROCESSAR EM LOTES
    // ============================================================

    const result = await processMonitoringsInBatches(
      activeMonitorings,
      lookbackTimestamp
    );

    // ============================================================
    // ETAPA 4: LOG FINAL
    // ============================================================

    const duration = Date.now() - startTime;
    const durationMinutes = (duration / 60000).toFixed(2);

    log.info('========================================');
    log.success('VERIFICAÇÃO DIÁRIA CONCLUÍDA');
    log.info('========================================');
    log.info('Estatísticas:', {
      total: result.total,
      successful: result.successful,
      failed: result.failed,
      withNewMovements: result.withNewMovements,
      withAttachmentsFetched: result.withAttachmentsFetched,
      successRate: `${((result.successful / result.total) * 100).toFixed(1)}%`,
      attachmentRate: result.withNewMovements > 0
        ? `${((result.withAttachmentsFetched / result.withNewMovements) * 100).toFixed(1)}%`
        : '0%',
      duration: `${durationMinutes} min`,
    });

    if (result.errors.length > 0) {
      log.warn(`${result.errors.length} processos com erro:`, result.errors);
    }

    return result;

  } catch (_error) {
    log.error('Erro crítico na verificação diária', error);

    return {
      total: 0,
      successful: 0,
      failed: 0,
      withNewMovements: 0,
      withAttachmentsFetched: 0,
      duration: Date.now() - startTime,
      errors: [{ cnj: 'N/A', error: error instanceof Error ? error.message : 'Erro crítico' }],
    };
  }
}

// ================================================================
// PROCESSAMENTO EM LOTES
// ================================================================

async function processMonitoringsInBatches(
  monitorings: unknown[],
  lookbackTimestamp: string
): Promise<BatchResult> {
  const total = monitorings.length;
  let successful = 0;
  let failed = 0;
  let withNewMovements = 0;
  let withAttachmentsFetched = 0;
  const errors: Array<{ cnj: string; error: string }> = [];

  // Dividir em lotes
  const batches = chunkArray(monitorings, CRON_CONFIG.BATCH_SIZE);

  log.info(`Processando ${total} monitoramentos em ${batches.length} lotes`);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const batchNumber = i + 1;

    log.info(`\n>>> Lote ${batchNumber}/${batches.length} (${batch.length} processos)`);

    // Processar lote com concorrência limitada
    const batchResults = await processBatchWithConcurrency(
      batch,
      lookbackTimestamp,
      CRON_CONFIG.CONCURRENT_CHECKS
    );

    // Agregar resultados
    for (const result of batchResults) {
      if (result.success) {
        successful++;
        if (result.hasNewMovements) {
          withNewMovements++;
          if (result.requiresAttachmentCheck) {
            withAttachmentsFetched++;
          }
        }
      } else {
        failed++;
        errors.push({
          cnj: result.numeroCnj,
          error: result.error || 'Erro desconhecido',
        });
      }
    }

    // Log de progresso
    const processed = (i + 1) * CRON_CONFIG.BATCH_SIZE;
    const progress = Math.min(processed, total);
    const percentage = ((progress / total) * 100).toFixed(1);

    log.info(`Progresso: ${progress}/${total} (${percentage}%) - Novos: ${withNewMovements} | Anexos: ${withAttachmentsFetched}`);

    // Delay entre lotes para rate limiting
    if (i < batches.length - 1) {
      log.info(`Aguardando ${CRON_CONFIG.BATCH_DELAY_MS}ms antes do próximo lote...`);
      await sleep(CRON_CONFIG.BATCH_DELAY_MS);
    }
  }

  return {
    total,
    successful,
    failed,
    withNewMovements,
    withAttachmentsFetched,
    duration: 0, // Será preenchido pela função principal
    errors,
  };
}

// ================================================================
// PROCESSAMENTO COM CONCORRÊNCIA LIMITADA
// ================================================================

async function processBatchWithConcurrency(
  batch: unknown[],
  lookbackTimestamp: string,
  concurrency: number
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // Processar em grupos de 'concurrency'
  for (let i = 0; i < batch.length; i += concurrency) {
    const chunk = batch.slice(i, i + concurrency);

    const chunkPromises = chunk.map((monitoring) =>
      checkSingleProcess(monitoring, lookbackTimestamp)
    );

    const chunkResults = await Promise.allSettled(chunkPromises);

    // Extrair resultados
    for (let j = 0; j < chunkResults.length; j++) {
      const result = chunkResults[j];
      const monitoring = chunk[j];

      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        // Tratamento de erro - validar estrutura do monitoring com type guard
        if (isMonitoringComplete(monitoring)) {
          results.push({
            trackingId: monitoring.trackingId,
            processoId: monitoring.processoId,
            numeroCnj: monitoring.processo.numeroCnj,
            success: false,
            hasNewMovements: false,
            movementsCount: 0,
            error: result.reason instanceof Error ? result.reason.message : 'Erro no processamento',
          });
        } else {
          // Fallback se estrutura inválida
          results.push({
            trackingId: 'unknown',
            processoId: 'unknown',
            numeroCnj: 'unknown',
            success: false,
            hasNewMovements: false,
            movementsCount: 0,
            error: `Estrutura de monitoramento inválida. ${result.reason instanceof Error ? result.reason.message : 'Erro no processamento'}`,
          });
        }
      }
    }
  }

  return results;
}

// ================================================================
// VERIFICAÇÃO DE PROCESSO INDIVIDUAL
// ================================================================

async function checkSingleProcess(
  monitoring: unknown,
  lookbackTimestamp: string,
  retryCount = 0
): Promise<CheckResult> {
  // Validar estrutura de monitoramento completa com type guard (Padrão-Ouro)
  if (!isMonitoringComplete(monitoring)) {
    return {
      trackingId: 'unknown',
      processoId: 'unknown',
      numeroCnj: 'unknown',
      success: false,
      hasNewMovements: false,
      movementsCount: 0,
      error: 'Estrutura de monitoramento inválida ou mal formada',
    };
  }

  const { trackingId, processoId, processo } = monitoring;
  const { numeroCnj } = processo;

  try {
    // Verificar se há novos andamentos
    const updateResult = await checkTrackingUpdates(trackingId, lookbackTimestamp);

    if (updateResult.error) {
      throw new Error(updateResult.error);
    }

    // Se não há novos movimentos, retornar sucesso
    if (!updateResult.hasNewMovements) {
      return {
        trackingId,
        processoId,
        numeroCnj,
        success: true,
        hasNewMovements: false,
        movementsCount: 0,
      };
    }

    // Há novos movimentos - processar
    log.info(`Novos andamentos encontrados`, {
      cnj: numeroCnj,
      count: updateResult.movementsCount,
    });

    // Atualizar processo com novos andamentos (texto apenas)
    await updateProcessWithMovements(processoId, updateResult.movements || []);

    // Analisar se precisa buscar anexos (ALTO CUSTO)
    const analysisResult = await analyzeMovementsAndFetchAttachmentsIfNeeded(
      processo,
      updateResult.movements || []
    );

    log.success(`Processo atualizado`, {
      cnj: numeroCnj,
      movements: updateResult.movementsCount,
      attachmentsFetched: analysisResult.shouldFetchAttachments,
      keywords: analysisResult.matchedKeywords,
    });

    return {
      trackingId,
      processoId,
      numeroCnj,
      success: true,
      hasNewMovements: true,
      movementsCount: updateResult.movementsCount,
      requiresAttachmentCheck: analysisResult.shouldFetchAttachments,
    };

  } catch (_error) {
    // Retry logic
    if (retryCount < CRON_CONFIG.MAX_RETRIES_PER_PROCESS) {
      log.warn(`Tentando novamente (${retryCount + 1}/${CRON_CONFIG.MAX_RETRIES_PER_PROCESS})`, {
        cnj: numeroCnj,
        error: error instanceof Error ? error.message : 'Erro',
      });

      await sleep(CRON_CONFIG.RETRY_DELAY_MS);
      return await checkSingleProcess(monitoring, lookbackTimestamp, retryCount + 1);
    }

    // Falha definitiva
    log.error(`Falha definitiva após retries`, {
      cnj: numeroCnj,
      error,
    });

    return {
      trackingId,
      processoId,
      numeroCnj,
      success: false,
      hasNewMovements: false,
      movementsCount: 0,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

// ================================================================
// NOTA: ANÁLISE DE ANEXOS
// ================================================================

/**
 * A análise de necessidade de anexos agora é feita pela função
 * analyzeMovementsAndFetchAttachmentsIfNeeded() no monitoring service.
 *
 * Ela verifica automaticamente palavras-chave nos andamentos e
 * dispara a busca de alto custo apenas quando necessário.
 *
 * Ver: src/lib/services/juditMonitoringService.ts
 */

// ================================================================
// UTILITÁRIOS
// ================================================================

/**
 * Calcula timestamp de lookback (ISO 8601)
 */
function calculateLookbackTimestamp(hours: number): string {
  const now = new Date();
  const lookback = new Date(now.getTime() - hours * 60 * 60 * 1000);
  return lookback.toISOString();
}

/**
 * Divide array em chunks
 */
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

// ================================================================
// EXPORTAÇÕES PARA CRON
// ================================================================

/**
 * Função wrapper para execução via cron
 */
export async function executeDailyCheck() {
  try {
    const result = await runDailyJuditCheck();

    // ✅ Enviar notificação de sucesso com resumo
    if (result.total > 0) {
      sendDailyCheckSummary(
        result.total,
        result.successful,
        result.failed,
        result.withNewMovements,
        result.duration
      ).catch((err) => {
        log.error('Erro ao enviar resumo do Daily Check', err);
      });
    }

    // ✅ Alertas específicos
    if (result.failed > 0) {
      log.warn(`ATENÇÃO: ${result.failed} processos falharam na verificação`);
    }

    if (result.withNewMovements > 0) {
      log.success(`${result.withNewMovements} processos com novos andamentos`);
    }

    return result;

  } catch (_error) {
    log.error('Erro crítico na execução do cron job', error);
    throw error;
  }
}

// ================================================================
// EXECUÇÃO MANUAL (para testes)
// ================================================================

if (require.main === module) {
  log.info('Executando verificação manual...');

  executeDailyCheck()
    .then((result) => {
      log.success('Verificação manual concluída', result);
      process.exit(0);
    })
    .catch((error) => {
      log.error('Verificação manual falhou', error);
      process.exit(1);
    });
}
