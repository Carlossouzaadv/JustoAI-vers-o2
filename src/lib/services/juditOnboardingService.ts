// ================================================================
// JUDIT ONBOARDING SERVICE
// Serviço completo para consultas assíncronas à API JUDIT
// ================================================================

import { getJuditApiClient } from '@/lib/judit-api-client';
import { prisma } from '@/lib/prisma';

// Observability stubs - inline to avoid external dependencies that may not be in container
const juditLogger = {
  info: (msg: any, data?: any) => console.log(`[JUDIT]`, msg, data || ''),
  error: (msg: any, data?: any) => console.error(`[JUDIT-ERROR]`, msg, data || ''),
  warn: (msg: any, data?: any) => console.warn(`[JUDIT-WARN]`, msg, data || ''),
  debug: (msg: any, data?: any) => console.debug(`[JUDIT-DEBUG]`, msg, data || ''),
};
const logOperationStart = (logger: any, name: string, data?: any) => {
  const startTime = Date.now();
  logger.debug?.(`[OPERATION] Starting ${name}`, data || '');

  return {
    finish: (status: string, details?: any) => {
      const duration = Date.now() - startTime;
      logger.info?.(`[OPERATION] ${name} finished: ${status}`, { duration_ms: duration, ...details });
      return duration;
    }
  };
};
const juditMetrics = {
  recordMetric: (name: any, value: any) => {},
  recordOnboarding: (status: 'success' | 'failure', durationMs: number) => {
    console.log(`[JUDIT-METRICS] Onboarding ${status}:`, { durationMs });
  },
};
const trackJuditCost = (data: any) => console.log(`[COST]`, data);
const alertApiError = (error: any, context?: any) => console.error(`[ALERT-API-ERROR]`, error, context || '');
const alertTimeout = (duration: any) => console.warn(`[ALERT-TIMEOUT]`, duration);

// ================================================================
// TIPOS E INTERFACES
// ================================================================

export type Finalidade = 'ONBOARDING' | 'BUSCA_ANEXOS';

export interface ProcessRequestResult {
  success: boolean;
  processoId: string;
  requestId: string;
  numeroCnj: string;
  dadosCompletos?: any;
  error?: string;
  attemptCount?: number;
  duration?: number;
}

interface JuditRequestPayload {
  search: {
    search_type: 'lawsuit_cnj';
    search_key: string;
    on_demand: boolean;
  };
  with_attachments: boolean;
}

interface JuditRequestResponse {
  request_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  [key: string]: any;
}

interface JuditResponseData {
  request_id: string;
  all_pages_count?: number;
  page?: number;
  data?: any;
  [key: string]: any;
}

// ================================================================
// CONFIGURAÇÕES
// ================================================================

const POLLING_CONFIG = {
  INTERVAL_MS: 20000, // 20 segundos entre verificações
  MAX_ATTEMPTS: 30, // 10 minutos total (30 * 20s) - reduzido de 90 para não consumir quota
  TIMEOUT_MS: 600000, // 10 minutos - reduzido de 30min
  RETRY_ON_ERROR_DELAY_MS: 5000, // 5 segundos após erro
  MAX_ERROR_RETRIES: 3,
} as const;

const PAGINATION_CONFIG = {
  MAX_PAGES: 50, // Limite de segurança
  CONCURRENT_PAGE_REQUESTS: 3, // Requisições paralelas
} as const;

// ================================================================
// LOGS E UTILITÁRIOS
// ================================================================

const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

// ================================================================
// FUNÇÃO PRINCIPAL
// ================================================================

/**
 * Realiza uma consulta completa e assíncrona à API JUDIT
 *
 * @param cnj - Número CNJ do processo
 * @param finalidade - Tipo de consulta (ONBOARDING ou BUSCA_ANEXOS)
 * @returns Resultado completo da operação
 */
export async function performFullProcessRequest(
  cnj: string,
  finalidade: Finalidade = 'ONBOARDING',
  workspaceId?: string
): Promise<ProcessRequestResult> {
  // Start operation timer
  const operation = logOperationStart(juditLogger, 'performFullProcessRequest', {
    cnj,
    finalidade,
  });

  const startTime = Date.now();
  const juditClient = getJuditApiClient();
  let requestId = '';
  let processoId = '';
  let documentsRetrieved = 0;

  try {
    // ============================================================
    // ETAPA 1: INICIAR REQUISIÇÃO
    // ============================================================

    const initResult = await initiateRequest(cnj, finalidade);
    processoId = initResult.processoId;
    requestId = initResult.requestId;

    juditLogger.info({
      action: 'request_initiated',
      cnj,
      request_id: requestId,
      processo_id: processoId,
    });

    // ============================================================
    // ETAPA 2: POLLING DO STATUS
    // ============================================================

    const pollingResult = await pollRequestStatus(requestId, processoId, cnj);

    if (!pollingResult.success) {
      // Record failure metrics
      const duration = Date.now() - startTime;
      juditMetrics.recordOnboarding('failure', duration);

      // Track cost (even for failures)
      await trackJuditCost({
        workspaceId,
        operationType: 'ONBOARDING',
        numeroCnj: cnj,
        requestId,
        durationMs: duration,
        status: 'failed',
        errorMessage: pollingResult.error,
      });

      operation.finish('failure', { error: pollingResult.error });

      return {
        success: false,
        processoId,
        requestId,
        numeroCnj: cnj,
        error: pollingResult.error,
        attemptCount: pollingResult.attemptCount,
        duration,
      };
    }

    // ============================================================
    // ETAPA 3: RECUPERAR E PERSISTIR DADOS
    // ============================================================

    const dadosCompletos = await retrieveAndPersistData(requestId, processoId, cnj);

    // Extract metrics from response
    documentsRetrieved = extractDocumentCount(dadosCompletos);
    const movementsCount = extractMovementsCount(dadosCompletos);

    const duration = Date.now() - startTime;

    // Record success metrics
    juditMetrics.recordOnboarding('success', duration);

    // Track costs
    await trackJuditCost({
      workspaceId,
      operationType: finalidade === 'ONBOARDING' ? 'ONBOARDING' : 'ATTACHMENT_FETCH',
      numeroCnj: cnj,
      documentsRetrieved,
      movementsCount,
      requestId,
      durationMs: duration,
      status: 'success',
    });

    juditLogger.info({
      action: 'onboarding_completed',
      cnj,
      request_id: requestId,
      duration_ms: duration,
      documents_retrieved: documentsRetrieved,
      movements_count: movementsCount,
      pages: dadosCompletos?.all_pages_count || 1,
    });

    operation.finish('success', {
      documents_retrieved: documentsRetrieved,
      duration_ms: duration,
    });

    return {
      success: true,
      processoId,
      requestId,
      numeroCnj: cnj,
      dadosCompletos,
      attemptCount: pollingResult.attemptCount,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    juditLogger.error({
      action: 'onboarding_failed',
      cnj,
      error: error instanceof Error ? error.message : 'Unknown error',
      error_stack: error instanceof Error ? error.stack : undefined,
      duration_ms: duration,
    });

    // Record failure metrics
    juditMetrics.recordOnboarding('failure', duration);

    // Track failed cost
    await trackJuditCost({
      workspaceId,
      operationType: 'ONBOARDING',
      numeroCnj: cnj,
      requestId,
      durationMs: duration,
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });

    // Send alert for error
    await alertApiError(error as Error, {
      endpoint: '/requests',
      method: 'POST',
      numeroCnj: cnj,
      requestId,
    });

    operation.finish('failure', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return {
      success: false,
      processoId,
      requestId,
      numeroCnj: cnj,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      duration,
    };
  }
}

// ================================================================
// ETAPA 1: INICIAR REQUISIÇÃO
// ================================================================

async function initiateRequest(
  cnj: string,
  finalidade: Finalidade
): Promise<{ processoId: string; requestId: string }> {
  const juditClient = getJuditApiClient();

  // Verificar/criar Processo no banco
  let processo = await prisma.processo.findUnique({
    where: { numeroCnj: cnj },
  });

  if (!processo) {
    juditLogger.info({
      action: 'create_processo',
      cnj,
    });
    processo = await prisma.processo.create({
      data: {
        numeroCnj: cnj,
      },
    });
  }

  // Montar payload da requisição
  const payload: JuditRequestPayload = {
    search: {
      search_type: 'lawsuit_cnj',
      search_key: cnj,
      on_demand: true,
    },
    with_attachments: true,
  };

  juditLogger.info({
    action: 'send_judit_request',
    cnj,
    with_attachments: true,
  });

  // Fazer requisição POST para /requests
  const response = await juditClient.post<JuditRequestResponse>(
    'requests',
    '/requests',
    payload
  );

  const requestId = response.request_id;

  if (!requestId) {
    throw new Error('JUDIT não retornou request_id');
  }

  // Salvar registro da requisição no banco
  await prisma.juditRequest.create({
    data: {
      requestId,
      status: response.status || 'pending',
      finalidade,
      processoId: processo.id,
    },
  });

  juditLogger.info({
    action: 'request_saved_to_db',
    cnj,
    request_id: requestId,
  });

  return {
    processoId: processo.id,
    requestId,
  };
}

// ================================================================
// ETAPA 2: POLLING DO STATUS
// ================================================================

interface PollingResult {
  success: boolean;
  error?: string;
  attemptCount: number;
}

async function pollRequestStatus(
  requestId: string,
  processoId: string,
  cnj: string
): Promise<PollingResult> {
  const juditClient = getJuditApiClient();
  let attemptCount = 0;
  let consecutiveErrors = 0;

  juditLogger.info({
    action: 'start_polling',
    request_id: requestId,
    cnj,
  });

  while (attemptCount < POLLING_CONFIG.MAX_ATTEMPTS) {
    attemptCount++;

    try {
      juditLogger.debug({
        action: 'polling_attempt',
        request_id: requestId,
        cnj,
        attempt: attemptCount,
        max_attempts: POLLING_CONFIG.MAX_ATTEMPTS,
      });

      // Verificar status da requisição
      const statusResponse = await juditClient.get<JuditRequestResponse>(
        'requests',
        `/requests/${requestId}`
      );

      const status = statusResponse.status;

      juditLogger.debug({
        action: 'polling_status_update',
        request_id: requestId,
        cnj,
        status,
        attempt: attemptCount,
      });

      // Atualizar status no banco
      await prisma.juditRequest.updateMany({
        where: { requestId },
        data: { status },
      });

      // Verificar se completou
      if (status === 'completed') {
        juditLogger.info({
          action: 'request_completed',
          request_id: requestId,
          cnj,
          attempts: attemptCount,
        });
        return {
          success: true,
          attemptCount,
        };
      }

      // Verificar se falhou
      if (status === 'failed') {
        const errorMessage = statusResponse.error || 'Requisição falhou na JUDIT';
        juditLogger.error({
          action: 'request_failed',
          request_id: requestId,
          cnj,
          error: errorMessage,
        });

        await prisma.juditRequest.updateMany({
          where: { requestId },
          data: { status: 'failed' },
        });

        return {
          success: false,
          error: errorMessage,
          attemptCount,
        };
      }

      // Reset contador de erros consecutivos (requisição bem-sucedida)
      consecutiveErrors = 0;

      // Aguardar antes da próxima verificação
      if (attemptCount < POLLING_CONFIG.MAX_ATTEMPTS) {
        await sleep(POLLING_CONFIG.INTERVAL_MS);
      }

    } catch (error) {
      consecutiveErrors++;
      juditLogger.error({
        action: 'polling_error',
        request_id: requestId,
        cnj,
        attempt: attemptCount,
        consecutive_errors: consecutiveErrors,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Se muitos erros consecutivos, falhar
      if (consecutiveErrors >= POLLING_CONFIG.MAX_ERROR_RETRIES) {
        const errorMessage = error instanceof Error ? error.message : 'Múltiplos erros de polling';

        await prisma.juditRequest.updateMany({
          where: { requestId },
          data: { status: 'failed' },
        });

        return {
          success: false,
          error: errorMessage,
          attemptCount,
        };
      }

      // Aguardar menos tempo após erro
      await sleep(POLLING_CONFIG.RETRY_ON_ERROR_DELAY_MS);
    }
  }

  // Timeout atingido
  const timeoutDuration = (POLLING_CONFIG.MAX_ATTEMPTS * POLLING_CONFIG.INTERVAL_MS) / 1000;

  juditLogger.error({
    action: 'polling_timeout',
    request_id: requestId,
    cnj,
    attempts: attemptCount,
    duration_seconds: timeoutDuration,
  });

  // Send timeout alert
  await alertTimeout({
    operation: 'JUDIT Request Polling',
    duration: attemptCount * POLLING_CONFIG.INTERVAL_MS,
    maxDuration: POLLING_CONFIG.MAX_ATTEMPTS * POLLING_CONFIG.INTERVAL_MS,
    requestId,
    numeroCnj: cnj,
  });

  await prisma.juditRequest.updateMany({
    where: { requestId },
    data: { status: 'timeout' },
  });

  return {
    success: false,
    error: `Timeout após ${attemptCount} tentativas (${timeoutDuration}s)`,
    attemptCount,
  };
}

// ================================================================
// ETAPA 3: RECUPERAR E PERSISTIR DADOS
// ================================================================

async function retrieveAndPersistData(
  requestId: string,
  processoId: string,
  cnj: string
): Promise<any> {
  const juditClient = getJuditApiClient();

  juditLogger.info({
    action: 'retrieve_response_data',
    request_id: requestId,
    cnj,
  });

  // Buscar primeira página
  const firstPageResponse = await juditClient.get<JuditResponseData>(
    'requests',
    `/responses?request_id=${requestId}&page=1&page_size=100`
  );

  const totalPages = firstPageResponse.all_pages_count || 1;

  juditLogger.info({
    action: 'first_page_retrieved',
    request_id: requestId,
    cnj,
    total_pages: totalPages,
  });

  let dadosCompletos: any;

  if (totalPages === 1) {
    // Apenas uma página - extrair process data
    const processos = (firstPageResponse.page_data || []).map(
      (item: any) => item.response_data
    );

    dadosCompletos = {
      request_id: requestId,
      request_status: firstPageResponse.request_status,
      pagination: {
        page: firstPageResponse.page,
        page_count: firstPageResponse.page_count,
        all_pages_count: firstPageResponse.all_pages_count,
        all_count: firstPageResponse.all_count,
      },
      processos,
    };
  } else {
    // Múltiplas páginas - buscar e consolidar todas
    dadosCompletos = await retrieveAllPages(requestId, firstPageResponse, totalPages);
  }

  // Persistir dados completos no banco
  juditLogger.info({
    action: 'persist_data',
    request_id: requestId,
    cnj,
  });

  await prisma.processo.update({
    where: { id: processoId },
    data: {
      dadosCompletos,
      ultimaAtualizacao: new Date(),
    },
  });

  // Marcar requisição como completed
  await prisma.juditRequest.updateMany({
    where: { requestId },
    data: { status: 'completed' },
  });

  juditLogger.info({
    action: 'data_persisted',
    request_id: requestId,
    cnj,
    total_pages: totalPages,
  });

  return dadosCompletos;
}

// ================================================================
// PAGINAÇÃO
// ================================================================

async function retrieveAllPages(
  requestId: string,
  firstPageResponse: JuditResponseData,
  totalPages: number
): Promise<any> {
  const juditClient = getJuditApiClient();

  juditLogger.info({
    action: 'retrieve_all_pages',
    request_id: requestId,
    total_pages: totalPages,
  });

  if (totalPages > PAGINATION_CONFIG.MAX_PAGES) {
    juditLogger.warn({
      action: 'pages_exceed_limit',
      request_id: requestId,
      total_pages: totalPages,
      max_pages: PAGINATION_CONFIG.MAX_PAGES,
    });
    totalPages = PAGINATION_CONFIG.MAX_PAGES;
  }

  // Inicializar com dados da primeira página
  const allProcessos: any[] = (firstPageResponse.page_data || []).map(
    (item: any) => item.response_data
  );

  // Criar array de páginas para buscar (1 já foi buscada)
  const pagesToFetch = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);

  // Buscar páginas em lotes paralelos
  const allPagesData: JuditResponseData[] = [];

  for (let i = 0; i < pagesToFetch.length; i += PAGINATION_CONFIG.CONCURRENT_PAGE_REQUESTS) {
    const batch = pagesToFetch.slice(i, i + PAGINATION_CONFIG.CONCURRENT_PAGE_REQUESTS);

    juditLogger.debug({
      action: 'fetch_page_batch',
      request_id: requestId,
      pages: batch,
      progress: `${i + batch.length}/${totalPages}`,
    });

    const batchPromises = batch.map((pageNumber) =>
      juditClient.get<JuditResponseData>(
        'requests',
        `/responses?request_id=${requestId}&page=${pageNumber}&page_size=100`
      )
    );

    const batchResults = await Promise.allSettled(batchPromises);

    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        allPagesData.push(result.value);
        // Extrair process data desta página
        const pageProcessos = (result.value.page_data || []).map(
          (item: any) => item.response_data
        );
        allProcessos.push(...pageProcessos);
      } else {
        juditLogger.error({
          action: 'fetch_page_failed',
          request_id: requestId,
          page: batch[index],
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        });
      }
    });
  }

  // Consolidar todas as páginas com estrutura normalizada
  juditLogger.info({
    action: 'consolidate_pages',
    request_id: requestId,
    pages_count: allPagesData.length + 1,
    total_processes: allProcessos.length,
  });

  const consolidated = {
    request_id: requestId,
    request_status: firstPageResponse.request_status,
    pagination: {
      page: firstPageResponse.page,
      page_count: firstPageResponse.page_count,
      all_pages_count: totalPages,
      all_count: firstPageResponse.all_count,
    },
    processos: allProcessos,
  };

  return consolidated;
}

// ================================================================
// FUNÇÕES AUXILIARES PÚBLICAS
// ================================================================

/**
 * Verifica o status atual de uma requisição
 */
export async function checkRequestStatus(requestId: string): Promise<string | null> {
  const request = await prisma.juditRequest.findUnique({
    where: { requestId },
    select: { status: true },
  });

  return request?.status || null;
}

/**
 * Busca dados completos de um processo já consultado
 */
export async function getProcessoData(cnj: string): Promise<any | null> {
  const processo = await prisma.processo.findUnique({
    where: { numeroCnj: cnj },
    select: {
      id: true,
      numeroCnj: true,
      dadosCompletos: true,
      dataOnboarding: true,
      ultimaAtualizacao: true,
    },
  });

  return processo;
}

/**
 * Lista todas as requisições de um processo
 */
export async function listProcessRequests(cnj: string) {
  const processo = await prisma.processo.findUnique({
    where: { numeroCnj: cnj },
    include: {
      requisicoes: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  return processo?.requisicoes || [];
}

// ================================================================
// HELPERS FOR OBSERVABILITY
// ================================================================

/**
 * Extract document count from JUDIT response
 */
function extractDocumentCount(dadosCompletos: any): number {
  if (!dadosCompletos) return 0;

  try {
    // Check if data has documents array
    if (dadosCompletos.data?.documents) {
      return Array.isArray(dadosCompletos.data.documents)
        ? dadosCompletos.data.documents.length
        : 0;
    }

    // Check pages array
    if (dadosCompletos.pages && Array.isArray(dadosCompletos.pages)) {
      return dadosCompletos.pages.reduce((total: number, page: any) => {
        const pageDocs = page.data?.documents || [];
        return total + (Array.isArray(pageDocs) ? pageDocs.length : 0);
      }, 0);
    }

    return 0;
  } catch (error) {
    juditLogger.warn({
      action: 'extract_document_count_failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return 0;
  }
}

/**
 * Extract movements count from JUDIT response
 */
function extractMovementsCount(dadosCompletos: any): number {
  if (!dadosCompletos) return 0;

  try {
    // Check if data has movements array
    if (dadosCompletos.data?.movements) {
      return Array.isArray(dadosCompletos.data.movements)
        ? dadosCompletos.data.movements.length
        : 0;
    }

    // Check pages array
    if (dadosCompletos.pages && Array.isArray(dadosCompletos.pages)) {
      return dadosCompletos.pages.reduce((total: number, page: any) => {
        const pageMovements = page.data?.movements || [];
        return total + (Array.isArray(pageMovements) ? pageMovements.length : 0);
      }, 0);
    }

    return 0;
  } catch (error) {
    juditLogger.warn({
      action: 'extract_movements_count_failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return 0;
  }
}
