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
  callback_url?: string; // Webhook callback URL para receber respostas assincronamente
  cache_ttl_in_days?: number; // Cache JUDIT por N dias (evita reconsultas desnecessárias)
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
// CONFIGURAÇÕES OTIMIZADAS PARA WEBHOOK
// ================================================================
// NOTA: Polling foi REMOVIDO completamente. JUDIT envia respostas via webhook.
// Veja: /api/webhook/judit/callback para processar as respostas assíncronamente.
//
// Otimizações de API JUDIT:
// 1. cache_ttl_in_days: 7 - JUDIT cache de 7 dias evita reconsultas desnecessárias
// 2. webhook callbacks: respostas incrementais conforme disponíveis (much more efficient!)
// 3. on_demand: true - prioridade alta na fila JUDIT

const JUDIT_REQUEST_CONFIG = {
  CACHE_TTL_DAYS: 7, // Usar cache JUDIT por até 7 dias (otimização de JUDIT)
  CALLBACK_TIMEOUT_SECONDS: 3600, // 1 hora para receber callbacks (sem polling!)
  WITH_ATTACHMENTS: true, // Sempre buscar anexos
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
 * Realiza uma consulta assíncrona à API JUDIT via webhook callback
 *
 * NOVO FLUXO (WEBHOOK-BASED):
 * 1. Inicia requisição com callback_url apontando para /api/webhook/judit/callback
 * 2. Retorna IMEDIATAMENTE com requestId (sem bloquear)
 * 3. JUDIT envia respostas incrementalmente via webhook conforme encontra dados
 * 4. Webhook processa e atualiza case progressivamente
 *
 * @param cnj - Número CNJ do processo
 * @param finalidade - Tipo de consulta (ONBOARDING ou BUSCA_ANEXOS)
 * @returns Status inicial da requisição (dados completos vêm via webhook)
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
  let requestId = '';
  let processoId = '';

  try {
    // ============================================================
    // ETAPA ÚNICA: INICIAR REQUISIÇÃO COM WEBHOOK CALLBACK
    // ============================================================
    // NOTA: Polling foi removido! JUDIT envia dados via webhook.

    const initResult = await initiateRequest(cnj, finalidade);
    processoId = initResult.processoId;
    requestId = initResult.requestId;

    const duration = Date.now() - startTime;

    juditLogger.info({
      action: 'request_initiated_webhook',
      cnj,
      request_id: requestId,
      processo_id: processoId,
      duration_ms: duration,
      note: 'Webhook callback configured - responses will be delivered asynchronously',
    });

    // Record success of request initiation
    juditMetrics.recordOnboarding('success', duration);

    operation.finish('success', {
      request_initiated: true,
      webhook_enabled: true,
    });

    return {
      success: true,
      processoId,
      requestId,
      numeroCnj: cnj,
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

  // ================================================================
  // VINCULAR PROCESSO AO CASE SE EXISTIR
  // ================================================================
  // Procurar por Case que tenha esse CNJ detectado
  const associatedCase = await prisma.case.findFirst({
    where: {
      detectedCnj: cnj,
    },
  });

  if (associatedCase && !associatedCase.processoId) {
    // Vincular o Case ao Processo
    await prisma.case.update({
      where: { id: associatedCase.id },
      data: {
        processoId: processo.id,
      },
    });

    juditLogger.info({
      action: 'case_linked_to_processo',
      cnj,
      case_id: associatedCase.id,
      processo_id: processo.id,
    });
  }

  // Montar payload da requisição COM OTIMIZAÇÕES DE API JUDIT
  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://api.justoai.com.br'}/api/webhook/judit/callback`;

  const payload: JuditRequestPayload = {
    search: {
      search_type: 'lawsuit_cnj',
      search_key: cnj,
      on_demand: true, // Prioridade alta na fila JUDIT
    },
    with_attachments: true, // Sempre trazer anexos para enriquecimento
    callback_url: webhookUrl, // Webhook para respostas assincronamente
    cache_ttl_in_days: JUDIT_REQUEST_CONFIG.CACHE_TTL_DAYS, // Cache 7 dias (evita reconsultas)
  };

  juditLogger.info({
    action: 'send_judit_request',
    cnj,
    with_attachments: true,
    webhook_callback_url: webhookUrl,
    cache_ttl_days: JUDIT_REQUEST_CONFIG.CACHE_TTL_DAYS,
    optimizations: 'webhook_callback + cache_ttl + on_demand',
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

// NOTA: ETAPA 3 (RECUPERAR E PERSISTIR DADOS) foi removida
// Agora os dados são processados assincronamente via webhook em /api/webhook/judit/callback
// O webhook processa respostas incrementais conforme JUDIT envia, muito mais eficiente!

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
    // Check if data has attachments array (JUDIT API returns "attachments", not "documents")
    if (dadosCompletos.data?.attachments) {
      return Array.isArray(dadosCompletos.data.attachments)
        ? dadosCompletos.data.attachments.length
        : 0;
    }

    // Also check response_data (alternative structure)
    if (dadosCompletos.response_data?.attachments) {
      return Array.isArray(dadosCompletos.response_data.attachments)
        ? dadosCompletos.response_data.attachments.length
        : 0;
    }

    // Check pages array
    if (dadosCompletos.pages && Array.isArray(dadosCompletos.pages)) {
      return dadosCompletos.pages.reduce((total: number, page: any) => {
        const pageDocs = page.data?.attachments || page.response_data?.attachments || [];
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
    // Check if data has steps array (JUDIT API returns "steps", not "movements")
    if (dadosCompletos.data?.steps) {
      return Array.isArray(dadosCompletos.data.steps)
        ? dadosCompletos.data.steps.length
        : 0;
    }

    // Also check response_data (alternative structure)
    if (dadosCompletos.response_data?.steps) {
      return Array.isArray(dadosCompletos.response_data.steps)
        ? dadosCompletos.response_data.steps.length
        : 0;
    }

    // Check pages array
    if (dadosCompletos.pages && Array.isArray(dadosCompletos.pages)) {
      return dadosCompletos.pages.reduce((total: number, page: any) => {
        const pageMovements = page.data?.steps || page.response_data?.steps || [];
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
