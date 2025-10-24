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
import { getTimelineMergeService } from '@/lib/timeline-merge';
import { processJuditAttachments } from '@/lib/services/juditAttachmentProcessor';
import { ICONS } from '@/lib/icons';

// Critical: Timeout handling for webhook processing
// JUDIT may have strict timeout requirements for webhook callbacks
export const maxDuration = 60; // 60 seconds max for webhook processing

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
    response_data?: any;
    status?: string;
    created_at?: string;
    tags?: {
      cached_response?: boolean;
      [key: string]: any;
    };
  };
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Log com timestamp exato para rastreamento
    const timestamp = new Date().toISOString();
    console.log(`${ICONS.WEBHOOK} [JUDIT Webhook] ✅ RECEBIDO EM ${timestamp}`);
    console.log(`${ICONS.WEBHOOK} [JUDIT Webhook] URL: ${request.url}`);
    console.log(`${ICONS.WEBHOOK} [JUDIT Webhook] Method: ${request.method}`);
    console.log(`${ICONS.WEBHOOK} [JUDIT Webhook] Headers:`, {
      'content-type': request.headers.get('content-type'),
      'user-agent': request.headers.get('user-agent'),
    });

    // Parse request body
    let webhook: JuditWebhookPayload;
    try {
      const bodyText = await request.text();
      console.log(`${ICONS.WEBHOOK} [JUDIT Webhook] Body size: ${bodyText.length} bytes`);
      webhook = JSON.parse(bodyText);
    } catch (parseError) {
      console.error(`${ICONS.ERROR} [JUDIT Webhook] Erro ao parsear JSON:`, parseError);
      return NextResponse.json(
        { error: 'JSON inválido', details: parseError instanceof Error ? parseError.message : 'desconhecido' },
        { status: 400 }
      );
    }

    // Validar payload obrigatório
    if (!webhook.reference_id) {
      console.warn(`${ICONS.WARNING} [JUDIT Webhook] Payload inválido - faltando reference_id`);
      console.warn(`${ICONS.WARNING} [JUDIT Webhook] Payload recebido:`, JSON.stringify(webhook).substring(0, 500));
      return NextResponse.json(
        { error: 'reference_id obrigatório' },
        { status: 400 }
      );
    }

    const requestId = webhook.reference_id;
    const eventType = webhook.event_type;

    console.log(`${ICONS.SUCCESS} [JUDIT Webhook] ✅ VÁLIDO - Event: ${eventType}, RequestID: ${requestId}`);

    // ================================================================
    // CASE 1: response_created - JUDIT encontrou dados
    // ================================================================
    if (eventType === 'response_created' && webhook.payload.response_data) {
      const responseType = webhook.payload.response_type;
      const responseData = webhook.payload.response_data;
      const isCachedResponse = webhook.payload.tags?.cached_response === true;

      console.log(`${ICONS.SUCCESS} [JUDIT Webhook] Resposta recebida:`, {
        responseType,
        cached: isCachedResponse,
        cnj: responseData?.code,
      });

      // Encontrar o processo que iniciou essa requisição
      const juditRequest = await prisma.juditRequest.findUnique({
        where: { requestId }
      });

      if (!juditRequest) {
        console.warn(`${ICONS.WARNING} [JUDIT Webhook] JuditRequest não encontrado:`, requestId);
        return NextResponse.json(
          { error: 'Request não encontrada' },
          { status: 404 }
        );
      }

      // Encontrar o caso relacionado
      const processo = await prisma.processo.findUnique({
        where: { id: juditRequest.processoId },
        include: { case: true }
      });

      if (!processo) {
        console.error(`${ICONS.ERROR} [JUDIT Webhook] Processo não encontrado:`, juditRequest.processoId);
        return NextResponse.json(
          { error: 'Processo não encontrado' },
          { status: 404 }
        );
      }

      // Se há um caso associado, atualizar com dados da JUDIT
      if (processo.case) {
        // Salvar dados completos no proceso
        await prisma.processo.update({
          where: { id: processo.id },
          data: {
            dadosCompletos: responseData,
            ultimaAtualizacao: new Date()
          }
        });

        // Extrair informações principais e processar timeline
        const timelineService = getTimelineMergeService();

        // Extrair andamentos do response_data
        if (responseData.steps && Array.isArray(responseData.steps)) {
          const timelineEntries = responseData.steps.map((step: any) => ({
            eventDate: new Date(step.step_date),
            eventType: step.step_type || 'Andamento',
            description: step.content,
            sourceId: step.step_id,
          }));

          // Mesclar com timeline existente
          if (timelineEntries.length > 0) {
            const mergeResult = await timelineService.mergeEntries(
              processo.case.id,
              timelineEntries,
              prisma
            );

            console.log(`${ICONS.SUCCESS} [JUDIT Webhook] Timeline atualizada:`, {
              case_id: processo.case.id,
              new_entries: mergeResult?.added || 0,
            });
          }
        }

        // Processar anexos (com retry silencioso se falhar)
        try {
          if (responseData.attachments && Array.isArray(responseData.attachments) && responseData.attachments.length > 0) {
            console.log(`${ICONS.PROCESS} [JUDIT Webhook] Iniciando processamento de ${responseData.attachments.length} anexos`);

            const attachmentResult = await processJuditAttachments(
              processo.case.id,
              responseData,
              responseData.code, // cnj_code
              responseData.instance // instance
            );

            console.log(`${ICONS.SUCCESS} [JUDIT Webhook] Anexos processados:`, {
              total: attachmentResult.total,
              downloaded: attachmentResult.downloaded,
              processed: attachmentResult.processed,
              failed: attachmentResult.failed
            });
          }
        } catch (attachmentError) {
          console.error(`${ICONS.ERROR} [JUDIT Webhook] Erro ao processar anexos:`, attachmentError);
          // Continuar mesmo se erro em anexos
        }

        // Se não é resposta cacheada, é a resposta final completa
        if (!isCachedResponse) {
          console.log(`${ICONS.SUCCESS} [JUDIT Webhook] Resposta completa (não cacheada) recebida`);

          // Atualizar status do caso para 'enriched' (FASE 2 completa) e mudar status de UNASSIGNED → ACTIVE
          await prisma.case.update({
            where: { id: processo.case.id },
            data: {
              status: 'ACTIVE', // Muda de UNASSIGNED para ACTIVE quando JUDIT retorna dados
              onboardingStatus: 'enriched',
              enrichmentCompletedAt: new Date(),
              metadata: {
                ...(processo.case.metadata as any),
                judit_data_retrieved: true,
                judit_callback_received_at: new Date().toISOString(),
              }
            }
          });

          console.log(`${ICONS.SUCCESS} [JUDIT Webhook] Caso ${processo.case.id} marcado como 'enriched' (FASE 2 completa) e status atualizado para ACTIVE`);
        }
      }

      // Atualizar status do request no banco
      await prisma.juditRequest.update({
        where: { requestId },
        data: { status: 'processing' }
      });

      return NextResponse.json({
        success: true,
        message: 'Resposta processada com sucesso',
        cached: isCachedResponse,
        cnj: responseData?.code
      });
    }

    // ================================================================
    // CASE 2: request_completed - JUDIT finalizou tudo
    // ================================================================
    if (eventType === 'request_completed' ||
        (webhook.payload.response_type === 'application_info' && webhook.payload.response_data?.code === 600)) {

      console.log(`${ICONS.SUCCESS} [JUDIT Webhook] REQUEST COMPLETED - Processamento finalizado:`, requestId);

      // Atualizar status no banco
      await prisma.juditRequest.update({
        where: { requestId },
        data: { status: 'completed' }
      });

      // Log final de sucesso
      const duration = Date.now() - startTime;
      console.log(`${ICONS.SUCCESS} [JUDIT Webhook] Webhook processado com sucesso em ${duration}ms`);

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
      const errorCode = webhook.payload.response_data?.code;
      const errorMessage = webhook.payload.response_data?.message;

      console.error(`${ICONS.ERROR} [JUDIT Webhook] Erro reportado pela JUDIT:`, {
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
    console.log(`${ICONS.INFO} [JUDIT Webhook] Evento desconhecido recebido:`, eventType);
    return NextResponse.json({
      success: true,
      message: 'Evento processado (tipo desconhecido)',
      event_type: eventType
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} [JUDIT Webhook] Erro ao processar webhook:`, error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      timestamp: new Date().toISOString()
    }, { status: 500 });
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
    ]
  });
}
