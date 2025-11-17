// ================================================================
// WEBHOOK CALLBACK ROUTE FOR JUDIT API
// ================================================================
// Recebe callbacks assíncronos da JUDIT conforme as respostas ficam prontas
// Muito mais eficiente que polling de 20+ minutos
//
// Fluxo:
// 1. JUDIT envia response_created com dados incrementais
// 2. Processamos e salvamos no banco
// 3. JUDIT envia request_completed quando terminado
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { mergeTimelines } from '@/lib/services/timelineUnifier';
import { processJuditAttachments } from '@/lib/services/juditAttachmentProcessor';
import { ICONS } from '@/lib/icons';

import {
  extractCaseTypeFromJuditResponse,
  extractCaseTypeFromSubject,
} from '@/lib/utils/judit-type-mapper';
import { log, logError } from '@/lib/services/logger';

// Critical: Timeout handling for webhook processing
// JUDIT may have strict timeout requirements for webhook callbacks
// Vercel Pro allows up to 900s (15min), but we use 300s (5min) for processing 30+ attachments
// With 5 parallel downloads, ~10-15 seconds per batch of 5 files
export const maxDuration = 300; // 300 seconds (5 minutes) - enough for 30+ attachments with 5 concurrent

// ================================================================
// TYPE GUARDS FOR SAFE NARROWING
// ================================================================

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

interface JuditLawsuitResponse {
  code?: string | number;
  instance?: string | number;
  attachments?: Array<unknown>;
  [key: string]: unknown;
}

interface JuditApplicationErrorResponse {
  code?: string | number;
  message?: string;
  [key: string]: unknown;
}

function isJuditLawsuitResponse(data: unknown): data is JuditLawsuitResponse {
  return isRecord(data);
}

function isJuditApplicationErrorResponse(data: unknown): data is JuditApplicationErrorResponse {
  return isRecord(data);
}

function hasAttachments(data: JuditLawsuitResponse): data is JuditLawsuitResponse & { attachments: Array<unknown> } {
  return Array.isArray(data.attachments) && data.attachments.length > 0;
}

function hasCode(data: JuditLawsuitResponse | JuditApplicationErrorResponse): boolean {
  return typeof data.code === 'string' || typeof data.code === 'number';
}

function getCodeAsString(data: JuditLawsuitResponse | JuditApplicationErrorResponse): string {
  const code = data.code;
  if (typeof code === 'string') {
    return code;
  }
  if (typeof code === 'number') {
    return code.toString();
  }
  return '';
}

function getInstanceAsNumber(data: JuditLawsuitResponse): number | undefined {
  const instance = data.instance;
  if (typeof instance === 'number') {
    return instance;
  }
  if (typeof instance === 'string') {
    const parsed = parseInt(instance, 10);
    return isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

// Type definitions for JUDIT webhook payload
interface JuditWebhookPayload {
  user_id: string;
  callback_id: string;
  event_type: 'response_created' | 'request_completed' | 'application_error';
  reference_type: 'request' | 'tracking';
  reference_id: string; // request_id
  payload: {
    request_id: string;
    response_id?: string;
    response_type?: 'lawsuit' | 'application_info' | 'application_error';
    response_data?: unknown;
    status?: string;
    created_at?: string;
    tags?: {
      cached_response?: boolean;
      [key: string]: unknown;
    };
  };
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Log com timestamp exato para rastreamento
    const timestamp = new Date().toISOString();
    log.info({ msg: "${ICONS.WEBHOOK} [JUDIT Webhook] ✅ RECEBIDO EM ${timestamp}", component: "" });
    log.info({ msg: "${ICONS.WEBHOOK} [JUDIT Webhook] URL: ${request.url}", component: "" });
    log.info({ msg: "${ICONS.WEBHOOK} [JUDIT Webhook] Method: ${request.method}", component: "" });
    log.info({ msg: "${ICONS.WEBHOOK} [JUDIT Webhook] Headers:`, {
      'content-type': request.headers.get('content-type", component: "" });,
      'user-agent': request.headers.get('user-agent'),
    });

    // Parse request body
    let webhook: JuditWebhookPayload;
    try {
      const bodyText = await request.text();
      log.info({ msg: "${ICONS.WEBHOOK} [JUDIT Webhook] Body size: ${bodyText.length} bytes", component: "" });
      webhook = JSON.parse(bodyText);
    } catch (parseError) {
      logError(`${ICONS.ERROR} [JUDIT Webhook] Erro ao parsear JSON:`, "parseError", { component: "" });
      return NextResponse.json(
        { error: 'JSON inválido', details: parseError instanceof Error ? parseError.message : 'desconhecido' },
        { status: 400 }
      );
    }

    // Validar payload obrigatório
    if (!webhook.reference_id) {
      log.warn({ msg: "${ICONS.WARNING} [JUDIT Webhook] Payload inválido - faltando reference_id", component: "" });
      log.warn({ msg: "${ICONS.WARNING} [JUDIT Webhook] Payload recebido:`, JSON.stringify(webhook", component: "" });.substring(0, 500));
      return NextResponse.json(
        { error: 'reference_id obrigatório' },
        { status: 400 }
      );
    }

    const requestId = webhook.reference_id;
    const eventType = webhook.event_type;

    log.info({ msg: "${ICONS.SUCCESS} [JUDIT Webhook] ✅ VÁLIDO - Event: ${eventType}, RequestID: ${requestId}", component: "" });

    // ================================================================
    // CASE 1: response_created - JUDIT encontrou dados
    // ================================================================
    if (eventType === 'response_created' && webhook.payload.response_data) {
      const responseType = webhook.payload.response_type;
      const responseData = webhook.payload.response_data;
      const isCachedResponse = webhook.payload.tags?.cached_response === true;

      // Validar que responseData é um record (type guard)
      if (!isJuditLawsuitResponse(responseData)) {
        log.warn({ msg: "${ICONS.WARNING} [JUDIT Webhook] Dados de resposta inválidos`, { responseType }", component: "" });
        return NextResponse.json(
          { error: 'Dados de resposta inválidos' },
          { status: 400 }
        );
      }

      log.info({ msg: "${ICONS.SUCCESS} [JUDIT Webhook] Resposta recebida:`, {
        responseType,
        cached: isCachedResponse,
        cnj: hasCode(responseData", component: "" }); ? getCodeAsString(responseData) : undefined,
      });

      // Encontrar o processo que iniciou essa requisição COM CASE ID EXPLÍCITO
      const juditRequest = await prisma.juditRequest.findUnique({
        where: { requestId }
      });

      if (!juditRequest) {
        log.warn({ msg: "${ICONS.WARNING} [JUDIT Webhook] JuditRequest não encontrado:`, requestId", component: "" });
        return NextResponse.json(
          { error: 'Request não encontrada' },
          { status: 404 }
        );
      }

      // ================================================================
      // NOVO: Usar caseId EXPLÍCITO do JuditRequest (evita busca por CNJ ambígua)
      // ================================================================
      let targetCase = null;

      if (juditRequest.caseId) {
        // PREFERENCIAL: Usar o case ID armazenado explicitamente
        targetCase = await prisma.case.findUnique({
          where: { id: juditRequest.caseId }
        });
        if (!targetCase) {
          log.error({ msg: "${ICONS.ERROR} [JUDIT Webhook] Case não encontrado com ID explícito:`,
            juditRequest.caseId", component: "" });
          return NextResponse.json(
            { error: 'Case com ID explícito não encontrado' },
            { status: 404 }
          );
        }

        log.info({ msg: "${ICONS.SUCCESS} [JUDIT Webhook] Usando case ID explícito: ${targetCase.id}", component: "" });
      }

      // Se há um caso associado, atualizar com dados da JUDIT
      if (targetCase) {
        // ================================================================
        // NOVO: VERIFICAÇÃO DE IDEMPOTÊNCIA - EVITAR PROCESSAR WEBHOOK DUPLICADO
        // ================================================================
        // JUDIT pode enviar múltiplos webhooks para o mesmo requestId
        // Verificar se este requestId já foi processado para este caso
        const currentMetadata = (targetCase.metadata || {}) as Record<string, unknown>;
        const processedRequestIds = (isRecord(currentMetadata) && Array.isArray(currentMetadata.processed_webhook_request_ids) ? currentMetadata.processed_webhook_request_ids : []) as string[];

        if (processedRequestIds.includes(requestId)) {
          log.warn({ msg: "${ICONS.WARNING} [JUDIT Webhook] Webhook duplicado detectado (requestId: ${requestId}, case: ${targetCase.id}). Ignorando.", component: "" });
          // Retornar sucesso mas não processar novamente
          return NextResponse.json({
            success: true,
            message: 'Webhook duplicado ignorado (já processado)',
            isDuplicate: true,
            cached: isCachedResponse,
            cnj: getCodeAsString(responseData)
          });
        }

        // Atualizar status do request no banco (REMOVIDO: campo dadosCompletos não existe)
        await prisma.juditRequest.update({
          where: { requestId },
          data: {
            status: 'processing',
            updatedAt: new Date()
          }
        });

        // ================================================================
        // NOVO: Chamar inteligente mergeTimelines v2 com enriquecimento
        // Fluxo:
        // 1. JUDIT é espinha dorsal (oficial)
        // 2. Outros eventos associam inteligentemente
        // 3. Enriquecimento automático via Gemini Flash
        // 4. Detecção de conflitos
        // ================================================================
        try {
          const unificationResult = await mergeTimelines(targetCase.id);

          log.info({ msg: "${ICONS.SUCCESS} [JUDIT Webhook] Timeline unificada com enriquecimento:`, {
            case_id: targetCase.id,
            total_analyzed: unifi...", component: "" });
        } catch (unificationError) {
          logError(`${ICONS.ERROR} [JUDIT Webhook] Erro na unificação de timeline:`, "unificationError", { component: "" });
          // Continuar mesmo se erro - não falha o webhook
        }

        // Processar anexos (com retry silencioso se falhar)
        try {
          if (hasAttachments(responseData)) {
            log.info({ msg: "${ICONS.PROCESS} [JUDIT Webhook] Iniciando processamento de ${responseData.attachments.length} anexos", component: "" });

            const attachmentResult = await processJuditAttachments(
              targetCase.id,
              responseData,
              getCodeAsString(responseData), // cnj_code (safe extraction)
              getInstanceAsNumber(responseData) // instance (safe extraction - number or undefined)
            );

            log.info({ msg: "${ICONS.SUCCESS} [JUDIT Webhook] Anexos processados:`, {
              total: attachmentResult.total,
              downloaded: attachmentResult....", component: "" });
          }
        } catch (attachmentError) {
          logError(`${ICONS.ERROR} [JUDIT Webhook] Erro ao processar anexos:`, "attachmentError", { component: "" });
          // Continuar mesmo se erro em anexos
        }

        // Se não é resposta cacheada, é a resposta final completa
        if (!isCachedResponse) {
          log.info({ msg: "${ICONS.SUCCESS} [JUDIT Webhook] Resposta completa (não cacheada) recebida", component: "" });

          // ================================================================
          // EXTRAIR TIPO DE PROCESSO AUTOMATICAMENTE
          // ================================================================
          let mappedCaseType = targetCase.type; // Manter tipo atual por padrão

          // Tentar extrair do classifications (preferencial)
          // responseData é garantidamente JuditLawsuitResponse aqui (type guard aplicado anteriormente)
          const classificationType = extractCaseTypeFromJuditResponse(responseData);
          if (classificationType) {
            mappedCaseType = classificationType;
            log.info({ msg: "${ICONS.SUCCESS} [JUDIT Webhook] Tipo mapeado automaticamente: ${mappedCaseType}", component: "" });
          } else {
            // Fallback: tentar extrair do subject
            const subjectType = extractCaseTypeFromSubject(responseData);
            if (subjectType) {
              mappedCaseType = subjectType;
              log.info({ msg: "${ICONS.SUCCESS} [JUDIT Webhook] Tipo extraído de subject: ${mappedCaseType}", component: "" });
            } else {
              log.warn({ msg: "${ICONS.WARNING} [JUDIT Webhook] Não foi possível mapear tipo automaticamente, mantendo ${targetCase.type}", component: "" });
            }
          }

          // Atualizar status do caso para 'enriched' (FASE 2 completa) e mudar status de UNASSIGNED → ACTIVE
          // IMPORTANTE: Marcar este requestId como processado para evitar duplicação

          // PADRÃO-OURO: Construir metadata de forma segura e serializar corretamente
          const newMetadata = {
            ...(isRecord(currentMetadata) ? currentMetadata : {}),
            judit_data_retrieved: true,
            judit_callback_received_at: new Date().toISOString(),
            auto_mapped_case_type: mappedCaseType, // Log da mudança para auditoria
            // NOVO: Registrar requestId como processado para idempotência
            processed_webhook_request_ids: [...processedRequestIds, requestId],
          };

          await prisma.case.update({
            where: { id: targetCase.id },
            data: {
              type: mappedCaseType, // ← AGORA ATUALIZA O TIPO AUTOMATICAMENTE!
              status: 'ACTIVE', // Muda de UNASSIGNED para ACTIVE quando JUDIT retorna dados
              onboardingStatus: 'enriched',
              enrichmentCompletedAt: new Date(),
              metadata: JSON.parse(JSON.stringify(newMetadata)), // Padrão-Ouro: Serialização segura para JSON
            }
          });

          log.info({ msg: "${ICONS.SUCCESS} [JUDIT Webhook] Caso ${targetCase.id} marcado como 'enriched' (FASE 2 completa) com type=${mappedCaseType} e status=ACTIVE", component: "" });
        }
      } // Fechamento do if(targetCase)

      // Atualizar status do request no banco
      await prisma.juditRequest.update({
        where: { requestId },
        data: { status: 'processing' }
      });

      return NextResponse.json({
        success: true,
        message: 'Resposta processada com sucesso',
        cached: isCachedResponse,
        cnj: getCodeAsString(responseData)
      });
    } // Fechamento do if(eventType === 'response_created')

    // ================================================================
    // CASE 2: request_completed - JUDIT finalizou tudo
    // ================================================================
    const isApplicationInfoWith600 = webhook.payload.response_type === 'application_info' &&
                                     isJuditApplicationErrorResponse(webhook.payload.response_data) &&
                                     webhook.payload.response_data.code === 600;

    if (eventType === 'request_completed' || isApplicationInfoWith600) {

      log.info({ msg: "${ICONS.SUCCESS} [JUDIT Webhook] REQUEST COMPLETED - Processamento finalizado:`, requestId", component: "" });

      // Atualizar status no banco
      await prisma.juditRequest.update({
        where: { requestId },
        data: { status: 'completed' }
      });

      // Log final de sucesso
      const duration = Date.now() - startTime;
      log.info({ msg: "${ICONS.SUCCESS} [JUDIT Webhook] Webhook processado com sucesso em ${duration}ms", component: "" });

      return NextResponse.json({
        success: true,
        message: 'Requisição JUDIT completada',
        request_id: requestId,
        processing_time_ms: duration
      });
    }

    // ================================================================
    // CASE 3: application_error - JUDIT reportou erro
    // ================================================================
    if (eventType === 'application_error') {
      let errorCode: string | number | undefined;
      let errorMessage: string | undefined;

      if (isJuditApplicationErrorResponse(webhook.payload.response_data)) {
        errorCode = webhook.payload.response_data.code;
        errorMessage = typeof webhook.payload.response_data.message === 'string'
          ? webhook.payload.response_data.message
          : undefined;
      }

      logError(`${ICONS.ERROR} [JUDIT Webhook] Erro reportado pela JUDIT:`, "{
        errorCode,errorMessage
      }", { component: "" });

      // Atualizar request como falho
      await prisma.juditRequest.update({
        where: { requestId },
        data: {
          status: 'failed'
        }
      });

      return NextResponse.json({
        success: false,
        error: errorMessage,
        error_code: errorCode,
        request_id: requestId
      }, { status: 400 });
    }

    // ================================================================
    // CASE 4: Evento desconhecido - Apenas log, não falha
    // ================================================================
    log.info({ msg: "${ICONS.INFO} [JUDIT Webhook] Evento desconhecido recebido:`, eventType", component: "" });
    return NextResponse.json({
      success: true,
      message: 'Evento processado (tipo desconhecido)',
      event_type: eventType
    });

  } catch (error) {
    logError(`${ICONS.ERROR} [JUDIT Webhook] Erro ao processar webhook:`, "error", { component: "" });

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// Health check endpoint
export async function GET(_request: NextRequest) {
  return NextResponse.json({
    status: 'webhook_operational',
    endpoint: '/api/webhook/judit/callback',
    accepts: 'POST requests from JUDIT API',
    events: [
      'response_created - JUDIT found and sending data',
      'request_completed - JUDIT finished processing',
      'application_error - JUDIT encountered an error'
    ]
  });
}
