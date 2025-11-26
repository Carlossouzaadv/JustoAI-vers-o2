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
import { log, logError } from '@/lib/services/logger';
import crypto from 'crypto';

import {
  extractCaseTypeFromJuditResponse,
  extractCaseTypeFromSubject,
} from '@/lib/utils/judit-type-mapper';

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
    log.info({ msg: `${ICONS.WEBHOOK} [JUDIT Webhook] ✅ RECEBIDO EM ${timestamp}`, component: 'judit-callback' });
    log.info({ msg: `${ICONS.WEBHOOK} [JUDIT Webhook] URL: ${request.url}`, component: 'judit-callback' });
    log.info({ msg: `${ICONS.WEBHOOK} [JUDIT Webhook] Method: ${request.method}`, component: 'judit-callback' });
    log.info({ msg: `${ICONS.WEBHOOK} [JUDIT Webhook] Headers`, data: {
      'content-type': request.headers.get('content-type'),
      'user-agent': request.headers.get('user-agent'),
    }, component: 'judit-callback' });

    // Parse request body
    let webhook: JuditWebhookPayload;
    let bodyText: string;
    try {
      bodyText = await request.text();
      log.info({ msg: `Body size: ${bodyText.length} bytes`, component: 'juditWebhookCallback' });
      webhook = JSON.parse(bodyText);
    } catch (_parseError) {
      logError(parseError, 'Error parsing webhook JSON', { component: 'juditWebhookCallback' });
      return NextResponse.json(
        { error: 'JSON inválido', details: parseError instanceof Error ? parseError.message : 'desconhecido' },
        { status: 400 }
      );
    }

    // Verify webhook signature
    if (!verifyJuditWebhookSignature(request, bodyText)) {
      log.warn({ msg: `${ICONS.WARNING} [JUDIT Webhook] Signature verification failed - rejecting webhook`, component: 'judit-callback' });
      return NextResponse.json(
        { error: 'Invalid signature', details: 'Webhook signature verification failed' },
        { status: 401 }
      );
    }

    // Validar payload obrigatório
    if (!webhook.reference_id) {
      log.warn({ msg: 'Invalid payload - missing reference_id', component: 'juditWebhookCallback', payload: JSON.stringify(webhook).substring(0, 500) });
      return NextResponse.json(
        { error: 'reference_id obrigatório' },
        { status: 400 }
      );
    }

    const requestId = webhook.reference_id;
    const eventType = webhook.event_type;

    log.info({ msg: `${ICONS.SUCCESS} [JUDIT Webhook] ✅ VÁLIDO - Event: ${eventType}, RequestID: ${requestId}`, component: 'juditWebhookCallback' });

    // ================================================================
    // CASE 1: response_created - JUDIT encontrou dados
    // ================================================================
    if (eventType === 'response_created' && webhook.payload.response_data) {
      const responseType = webhook.payload.response_type;
      const responseData = webhook.payload.response_data;
      const isCachedResponse = webhook.payload.tags?.cached_response === true;

      // Validar que responseData é um record (type guard)
      if (!isJuditLawsuitResponse(responseData)) {
        log.warn({ msg: `Dados de resposta inválidos`, responseType, component: 'juditWebhookCallback' });
        return NextResponse.json(
          { error: 'Dados de resposta inválidos' },
          { status: 400 }
        );
      }

      log.info({
        msg: 'Resposta recebida',
        responseType,
        cached: isCachedResponse,
        cnj: hasCode(responseData) ? getCodeAsString(responseData) : undefined,
        component: 'juditWebhookCallback'
      });

      // Encontrar o processo que iniciou essa requisição COM CASE ID EXPLÍCITO
      const juditRequest = await prisma.juditRequest.findUnique({
        where: { requestId }
      });

      if (!juditRequest) {
        log.warn({ msg: `${ICONS.WARNING} [JUDIT Webhook] JuditRequest não encontrado:`, requestId, component: 'juditWebhookCallback' });
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
          logError(new Error('Case not found'), 'Case não encontrado com ID explícito', {
            component: 'juditWebhookCallback',
            caseId: juditRequest.caseId
          });
          return NextResponse.json(
            { error: 'Case com ID explícito não encontrado' },
            { status: 404 }
          );
        }

        log.info({
          msg: `Usando case ID explícito: ${targetCase.id}`,
          component: 'juditWebhookCallback'
        });
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
          log.warn({
            msg: `Webhook duplicado detectado. Ignorando.`,
            component: 'juditWebhookCallback',
            requestId,
            caseId: targetCase.id
          });
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

          log.info({
            msg: 'Timeline unificada com enriquecimento',
            component: 'juditWebhookCallback',
            case_id: targetCase.id,
            total_analyzed: unificationResult.total,
            new_events: unificationResult.new,
            duplicates_detected: unificationResult.duplicates,
            enriched: unificationResult.enriched,
            related: unificationResult.related,
            conflicts: unificationResult.conflicts,
          });
        } catch (unificationError) {
          logError(unificationError, 'Erro na unificação de timeline', {
            component: 'juditWebhookCallback',
            caseId: targetCase.id
          });
          // Continuar mesmo se erro - não falha o webhook
        }

        // Processar anexos (com retry silencioso se falhar)
        try {
          if (hasAttachments(responseData)) {
            log.info({ msg: `${ICONS.PROCESS} [JUDIT Webhook] Iniciando processamento de ${responseData.attachments.length} anexos`, component: 'juditWebhookCallback' });

            const attachmentResult = await processJuditAttachments(
              targetCase.id,
              responseData,
              getCodeAsString(responseData), // cnj_code (safe extraction)
              getInstanceAsNumber(responseData) // instance (safe extraction - number or undefined)
            );

            log.info({
              msg: 'Anexos processados',
              component: 'juditWebhookCallback',
              total: attachmentResult.total,
              downloaded: attachmentResult.downloaded,
              processed: attachmentResult.processed,
              failed: attachmentResult.failed
            });
          }
        } catch (_attachmentError) {
          logError(`${ICONS.ERROR} [JUDIT Webhook] Erro ao processar anexos:`, '', { component: 'juditWebhookCallback' });
          // Continuar mesmo se erro em anexos
        }

        // Se não é resposta cacheada, é a resposta final completa
        if (!isCachedResponse) {
          log.info({ msg: `${ICONS.SUCCESS} [JUDIT Webhook] Resposta completa (não cacheada) recebida`, component: 'juditWebhookCallback' });

          // ================================================================
          // EXTRAIR TIPO DE PROCESSO AUTOMATICAMENTE
          // ================================================================
          let mappedCaseType = targetCase.type; // Manter tipo atual por padrão

          // Tentar extrair do classifications (preferencial)
          // responseData é garantidamente JuditLawsuitResponse aqui (type guard aplicado anteriormente)
          const classificationType = extractCaseTypeFromJuditResponse(responseData);
          if (classificationType) {
            mappedCaseType = classificationType;
            log.info({ msg: `${ICONS.SUCCESS} [JUDIT Webhook] Tipo mapeado automaticamente: ${mappedCaseType}`, component: 'juditWebhookCallback' });
          } else {
            // Fallback: tentar extrair do subject
            const subjectType = extractCaseTypeFromSubject(responseData);
            if (subjectType) {
              mappedCaseType = subjectType;
              log.info({ msg: `${ICONS.SUCCESS} [JUDIT Webhook] Tipo extraído de subject: ${mappedCaseType}`, component: 'juditWebhookCallback' });
            } else {
              log.warn({ msg: `${ICONS.WARNING} [JUDIT Webhook] Não foi possível mapear tipo automaticamente, mantendo ${targetCase.type}`, component: 'juditWebhookCallback' });
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

          log.info({ msg: `${ICONS.SUCCESS} [JUDIT Webhook] Caso ${targetCase.id} marcado como 'enriched' (FASE 2 completa) com type=${mappedCaseType} e status=ACTIVE`, component: 'juditWebhookCallback' });
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

      log.info({ msg: `${ICONS.SUCCESS} [JUDIT Webhook] REQUEST COMPLETED - Processamento finalizado:`, requestId, component: 'juditWebhookCallback' });

      // Atualizar status no banco
      await prisma.juditRequest.update({
        where: { requestId },
        data: { status: 'completed' }
      });

      // Log final de sucesso
      const duration = Date.now() - startTime;
      log.info({ msg: `${ICONS.SUCCESS} [JUDIT Webhook] Webhook processado com sucesso em ${duration}ms`, component: 'juditWebhookCallback' });

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

      log.error({
        msg: 'Erro reportado pela JUDIT',
        component: 'juditWebhookCallback',
        errorCode,
        errorMessage
      });

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
    log.info({ msg: `${ICONS.INFO} [JUDIT Webhook] Evento desconhecido recebido:`, eventType, component: 'juditWebhookCallback' });
    return NextResponse.json({
      success: true,
      message: 'Evento processado (tipo desconhecido)',
      event_type: eventType
    });

  } catch (error) {
    logError(`${ICONS.ERROR} [JUDIT Webhook] Erro ao processar webhook:`, '', { component: 'juditWebhookCallback' });

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * Verify JUDIT webhook signature
 * JUDIT uses HMAC-SHA256 with format: sha256=signature
 *
 * @param request HTTP request
 * @param body Raw request body text
 * @returns true if signature is valid, false otherwise
 */
function verifyJuditWebhookSignature(request: NextRequest, body: string): boolean {
  try {
    const signature = request.headers.get('x-judit-signature');
    if (!signature) {
      log.warn({ msg: `${ICONS.WARNING} [JUDIT Webhook] Missing x-judit-signature header`, component: 'judit-callback' });
      return false;
    }

    const secret = process.env.JUDIT_WEBHOOK_SECRET;
    if (!secret) {
      log.warn({ msg: `${ICONS.WARNING} [JUDIT Webhook] JUDIT_WEBHOOK_SECRET not configured - skipping verification`, component: 'judit-callback' });
      // Skip verification if secret not configured (for development)
      return true;
    }

    // Compute expected signature: HMAC-SHA256(body, secret)
    const computedSignature = crypto
      .createHmac('sha256', secret)
      .update(body, 'utf8')
      .digest('hex');

    // Remove 'sha256=' prefix if present
    const providedSignature = signature.replace(/^sha256=/, '');

    // Use timing-safe comparison to prevent timing attacks
    try {
      const isValid = crypto.timingSafeEqual(
        Buffer.from(computedSignature, 'hex'),
        Buffer.from(providedSignature, 'hex')
      );

      if (!isValid) {
        log.warn({ msg: `${ICONS.WARNING} [JUDIT Webhook] Signature mismatch`, component: 'judit-callback' });
        return false;
      }

      log.info({ msg: `${ICONS.SUCCESS} [JUDIT Webhook] Signature verified successfully`, component: 'judit-callback' });
      return true;
    } catch (error) {
      // timingSafeEqual throws if lengths don't match
      log.warn({ msg: `${ICONS.WARNING} [JUDIT Webhook] Signature length mismatch`, component: 'judit-callback' });
      return false;
    }

  } catch (error) {
    logError(`${ICONS.ERROR} [JUDIT Webhook] Error verifying signature:`, '', { component: 'judit-callback' });
    return false;
  }
}

// Health check endpoint
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'webhook_operational',
    endpoint: '/api/webhook/judit/callback',
    accepts: 'POST requests from JUDIT API',
    events: [
      'response_created - JUDIT found and sending data',
      'request_completed - JUDIT finished processing',
      'application_error - JUDIT encountered an error'
    ],
    security: {
      signature_validation: 'enabled (x-judit-signature header required)',
      algorithm: 'HMAC-SHA256'
    }
  });
}
