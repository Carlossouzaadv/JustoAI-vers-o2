// ================================================================
// JUDIT ONBOARDING SERVICE
// Serviço completo para consultas assíncronas à API JUDIT
// ================================================================

import { getJuditApiClient } from '@/lib/judit-api-client';
import { prisma } from '@/lib/prisma';
import { recordOnboardingError } from '@/lib/utils/case-onboarding-helper';
import { parseJuditResponse, JuditRequestResponse } from '@/lib/types/external-api';
import { log, logError } from '@/lib/services/logger';

// ================================================================
// TYPE GUARDS AND LOGGING UTILITIES
// ================================================================

type LogMessage = Record<string, string | number | boolean | object | undefined>;

function isLogMessage(value: unknown): value is LogMessage {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// Helper to safely format log messages (Padrão-Ouro)
function formatLogMessage(data: LogMessage | string): string {
  if (typeof data === 'string') {
    return data;
  }

  if (isLogMessage(data)) {
    try {
      return JSON.stringify(data);
    } catch {
      return String(data);
    }
  }

  return String(data);
}

interface Logger {
  info: (_data: LogMessage | string) => void;
  error: (_data: LogMessage | string) => void;
  warn: (_data: LogMessage | string) => void;
  debug: (_data: LogMessage | string) => void;
}

interface OperationTracker {
  finish: (_status: string, _details?: LogMessage) => number;
}

// Observability stubs - inline to avoid external dependencies that may not be in container
const juditLogger: Logger = {
  info: (data: LogMessage | string) => console.log(`[JUDIT]`, formatLogMessage(data)),
  error: (data: LogMessage | string) => console.error(`[JUDIT-ERROR]`, formatLogMessage(data)),
  warn: (data: LogMessage | string) => console.warn(`[JUDIT-WARN]`, formatLogMessage(data)),
  debug: (data: LogMessage | string) => console.debug(`[JUDIT-DEBUG]`, formatLogMessage(data)),
};
const logOperationStart = (logger: Logger, name: string, data?: LogMessage): OperationTracker => {
  const startTime = Date.now();
  logger.debug({
    operation_event: 'start',
    operation_name: name,
    ...data,
  });

  return {
    finish: (_status: string, _details?: LogMessage) => {
      const duration = Date.now() - startTime;
      logger.info({
        operation_event: 'finish',
        operation_name: name,
        status: _status,
        duration_ms: duration,
        ...(_details || {}),
      });
      return duration;
    }
  };
};
const juditMetrics = {
  recordOnboarding: (status: 'success' | 'failure', durationMs: number) => {
    console.log(`[JUDIT-METRICS] Onboarding ${status}:`, { durationMs });
  },
};
const trackJuditCost = (data: LogMessage) => console.log(`[COST]`, formatLogMessage(data));
const alertApiError = (error: unknown, context?: LogMessage) => console.error(`[ALERT-API-ERROR]`, error, context ? formatLogMessage(context) : '');

// ================================================================
// TIPOS E INTERFACES
// ================================================================

export type Finalidade = 'ONBOARDING' | 'BUSCA_ANEXOS';

export interface ProcessRequestResult {
  success: boolean;
  processoId: string;
  requestId: string;
  numeroCnj: string;
  dadosCompletos?: Record<string, unknown>;
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

// JuditRequestResponse is now imported from '@/lib/types/external-api'
// No longer defining it locally to avoid conflicts

// JuditResponseData interface is used for type checking responses
// interface JuditResponseData {
//   request_id: string;
//   all_pages_count?: number;
//   page?: number;
//   data?: Record<string, unknown>;
//   [key: string]: unknown;
// }

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

// Helper function for delays (commented out - not currently used)
// const sleep = (ms: number): Promise<void> => {
//   return new Promise((resolve) => setTimeout(resolve, ms));
// };

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
  workspaceId?: string,
  caseId?: string // Novo: case ID explícito para vincular com webhook
): Promise<ProcessRequestResult> {
  // Start operation timer
  const operation = logOperationStart(juditLogger, 'performFullProcessRequest', {
    cnj,
    finalidade,
    caseId, // Log do case ID para auditoria
  });

  const startTime = Date.now();
  let requestId = '';
  let processoId = '';

  try {
    // ============================================================
    // ETAPA ÚNICA: INICIAR REQUISIÇÃO COM WEBHOOK CALLBACK
    // ============================================================
    // NOTA: Polling foi removido! JUDIT envia dados via webhook.

    const initResult = await initiateRequest(cnj, finalidade, caseId);
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
  } catch (_error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    juditLogger.error({
      action: 'onboarding_failed',
      cnj,
      error: errorMessage,
      error_stack: error instanceof Error ? error.stack : undefined,
      duration_ms: duration,
    });

    // ================================================================
    // REGISTRAR ERRO NO BANCO DE DADOS PARA VISIBILIDADE DO USUÁRIO
    // ================================================================
    try {
      // Se processoId disponível, buscar caseId associado
      if (processoId) {
        const processo = await prisma.processo.findUnique({
          where: { id: processoId },
          select: { case: { select: { id: true } } }
        });

        if (processo?.case) {
          await recordOnboardingError(
            processo.case.id,
            'ENRICHMENT',
            errorMessage,
            'JUDIT_REQUEST_FAILED'
          );
        }
      }
    } catch (dbError) {
      logError(dbError, 'OnboardingError Erro ao registrar erro no banco:', { component: 'refactored' });
    }

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
      errorMessage: errorMessage,
    });

    // Send alert for error
    await alertApiError(error as Error, {
      endpoint: '/requests',
      method: 'POST',
      numeroCnj: cnj,
      requestId,
    });

    operation.finish('failure', {
      error: errorMessage,
    });

    return {
      success: false,
      processoId,
      requestId,
      numeroCnj: cnj,
      error: errorMessage,
      duration,
    };
  }
}

// ================================================================
// ETAPA 1: INICIAR REQUISIÇÃO
// ================================================================

async function initiateRequest(
  cnj: string,
  finalidade: Finalidade,
  explicitCaseId?: string // Novo: case ID explícito (prioritário)
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
  // IMPORTANTE: Se um caseId foi passado explicitamente, usar esse (evita ambiguidade)
  let targetCaseId = explicitCaseId;

  if (!targetCaseId) {
    // Fallback: Procurar por Case que tenha esse CNJ detectado
    // (Apenas se não foi passado um caseId explícito)
    const associatedCase = await prisma.case.findFirst({
      where: {
        detectedCnj: cnj,
      },
    });

    if (associatedCase) {
      targetCaseId = associatedCase.id;
    }
  }

  // Vincular case ao processo se necessário (com type guard)
  if (targetCaseId) {
    // Verificar se o case já está vinculado ao processo através de uma query separada
    const caseToCheck = await prisma.case.findUnique({
      where: { id: targetCaseId },
      select: { processoId: true }
    });

    // Type guard: caseToCheck é definido se o case existe
    if (caseToCheck && !caseToCheck.processoId) {
      // Vincular o Case ao Processo (se ainda não estiver vinculado)
      await prisma.case.update({
        where: { id: targetCaseId },
        data: {
          processoId: processo.id,
        },
      });

      juditLogger.info({
        action: 'case_linked_to_processo',
        cnj,
        case_id: targetCaseId,
        processo_id: processo.id,
        explicit_case_id: !!explicitCaseId, // Log se foi explícito
      });
    }
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
  // A resposta vem como 'unknown' da rede - validar com Zod
  const rawResponse: unknown = await juditClient.post<unknown>(
    'requests',
    '/requests',
    payload
  );

  // ================================================================
  // VALIDAÇÃO ZOD - TIPO-SEGURO EM RUNTIME
  // ================================================================
  // Não usamos 'as JuditRequestResponse' (proibido!)
  // Usamos parseJuditResponse().safeParse() para garantir tipo-segurança
  const validationResult = parseJuditResponse(rawResponse);

  if (!validationResult.success) {
    // Se a API JUDIT mudar o contrato ou a resposta vier corrompida,
    // capturamos aqui antes que o erro se espalhe
    juditLogger.error({
      action: 'judit_response_validation_failed',
      error: validationResult.error,
      rawResponse: JSON.stringify(rawResponse),
    });
    throw new Error(`Resposta da API JUDIT inválida ou malformada: ${validationResult.error}`);
  }

  // A partir desta linha, 'response' é 100% type-safe
  const response: JuditRequestResponse = validationResult.data;
  const requestId = response.request_id;

  if (!requestId) {
    throw new Error('JUDIT não retornou request_id');
  }

  // Salvar registro da requisição no banco COM CASE ID EXPLÍCITO
  await prisma.juditRequest.create({
    data: {
      requestId,
      status: response.status || 'pending',
      finalidade,
      processoId: processo.id,
      caseId: targetCaseId, // NOVO: Armazenar case ID explícito para webhook usar
    },
  });

  juditLogger.info({
    action: 'request_saved_to_db',
    cnj,
    request_id: requestId,
    case_id: targetCaseId, // Log do case ID armazenado
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
export async function getProcessoData(cnj: string): Promise<Record<string, unknown> | null> {
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
 * Extract document count from JUDIT response (currently unused - kept for reference)
 */
// function extractDocumentCount(dadosCompletos: Record<string, unknown>): number {
//   if (!dadosCompletos) return 0;
//
//   try {
//     const data = dadosCompletos as Record<string, unknown>;
//     // Check if data has attachments array (JUDIT API returns "attachments", not "documents")
//     if ((data?.data as Record<string, unknown>)?.attachments) {
//       return Array.isArray((data.data as Record<string, unknown>).attachments)
//         ? ((data.data as Record<string, unknown>).attachments as Array<unknown>).length
//         : 0;
//     }
//
//     // Also check response_data (alternative structure)
//     if ((data?.response_data as Record<string, unknown>)?.attachments) {
//       return Array.isArray((data.response_data as Record<string, unknown>).attachments)
//         ? ((data.response_data as Record<string, unknown>).attachments as Array<unknown>).length
//         : 0;
//     }
//
//     // Check pages array
//     if (data?.pages && Array.isArray(data.pages)) {
//       return (data.pages as Array<Record<string, unknown>>).reduce((total: number, page: Record<string, unknown>) => {
//         const pageDocs = (page.data as Record<string, unknown>)?.attachments || (page.response_data as Record<string, unknown>)?.attachments || [];
//         return total + (Array.isArray(pageDocs) ? pageDocs.length : 0);
//       }, 0);
//     }
//
//     return 0;
//   } catch (_error) {
//     juditLogger.warn({
//       action: 'extract_document_count_failed',
//       error: error instanceof Error ? error.message : 'Unknown error',
//     });
//     return 0;
//   }
// }

/**
 * Extract movements count from JUDIT response (currently unused - kept for reference)
 */
// function extractMovementsCount(dadosCompletos: Record<string, unknown>): number {
//   if (!dadosCompletos) return 0;
//
//   try {
//     const data = dadosCompletos as Record<string, unknown>;
//     // Check if data has steps array (JUDIT API returns "steps", not "movements")
//     if ((data?.data as Record<string, unknown>)?.steps) {
//       return Array.isArray((data.data as Record<string, unknown>).steps)
//         ? ((data.data as Record<string, unknown>).steps as Array<unknown>).length
//         : 0;
//     }
//
//     // Also check response_data (alternative structure)
//     if ((data?.response_data as Record<string, unknown>)?.steps) {
//       return Array.isArray((data.response_data as Record<string, unknown>).steps)
//         ? ((data.response_data as Record<string, unknown>).steps as Array<unknown>).length
//         : 0;
//     }
//
//     // Check pages array
//     if (data?.pages && Array.isArray(data.pages)) {
//       return (data.pages as Array<Record<string, unknown>>).reduce((total: number, page: Record<string, unknown>) => {
//         const pageMovements = (page.data as Record<string, unknown>)?.steps || (page.response_data as Record<string, unknown>)?.steps || [];
//         return total + (Array.isArray(pageMovements) ? pageMovements.length : 0);
//       }, 0);
//     }
//
//     return 0;
//   } catch (_error) {
//     juditLogger.warn({
//       action: 'extract_movements_count_failed',
//       error: error instanceof Error ? error.message : 'Unknown error',
//     });
//     return 0;
//   }
// }
