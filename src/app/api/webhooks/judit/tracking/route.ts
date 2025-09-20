// ================================================================
// WEBHOOK HANDLER - Recepção de Notificações da Judit via Tracking
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getJuditApiClient } from '@/lib/judit-api-client';
import { ICONS } from '@/lib/icons';
import { headers } from 'next/headers';
import crypto from 'crypto';

// ================================================================
// TIPOS E INTERFACES
// ================================================================

interface JuditWebhookPayload {
  tracking_id: string;
  process_number: string;
  event_type: 'movement' | 'attachment' | 'status_change' | 'update';
  timestamp: string;
  data: {
    movement?: {
      id: string;
      type: string;
      date: string;
      description: string;
      content: string;
      attachments?: Array<{
        id: string;
        name: string;
        type: string;
        size: number;
        url?: string;
      }>;
    };
    status?: {
      previous: string;
      current: string;
      reason?: string;
    };
    metadata?: Record<string, any>;
  };
  signature?: string;
}

interface WebhookProcessingResult {
  success: boolean;
  processId?: string;
  newMovements: number;
  alertsGenerated: number;
  attachmentsProcessed: number;
  error?: string;
  processingTime: number;
}

// ================================================================
// CONFIGURAÇÕES
// ================================================================

const WEBHOOK_CONFIG = {
  // Segurança
  VALIDATE_SIGNATURE: true,
  MAX_PAYLOAD_SIZE: 5 * 1024 * 1024, // 5MB
  TIMEOUT_MS: 30000,

  // Processamento
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
  BATCH_SIZE: 10,

  // Cache/Deduplicação
  DEDUP_WINDOW_MINUTES: 5,
  CACHE_TTL_SECONDS: 300,

  // Alertas
  ENABLE_MOVEMENT_ALERTS: true,
  ENABLE_STATUS_ALERTS: true,
  ENABLE_ATTACHMENT_ALERTS: true,
} as const;

// ================================================================
// HANDLER PRINCIPAL
// ================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log(`${ICONS.WEBHOOK} Received Judit tracking webhook`);

  try {
    // Validar tamanho do payload
    const contentLength = parseInt(request.headers.get('content-length') || '0');
    if (contentLength > WEBHOOK_CONFIG.MAX_PAYLOAD_SIZE) {
      console.error(`${ICONS.ERROR} Payload too large: ${contentLength} bytes`);
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }

    // Parsear payload
    const payload: JuditWebhookPayload = await request.json();

    // Validar estrutura básica
    if (!payload.tracking_id || !payload.process_number || !payload.event_type) {
      console.error(`${ICONS.ERROR} Invalid webhook payload structure`);
      return NextResponse.json({ error: 'Invalid payload structure' }, { status: 400 });
    }

    // Validar assinatura se habilitado
    if (WEBHOOK_CONFIG.VALIDATE_SIGNATURE && !await validateWebhookSignature(request, payload)) {
      console.error(`${ICONS.ERROR} Invalid webhook signature`);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Verificar deduplicação
    if (await isDuplicateWebhook(payload)) {
      console.log(`${ICONS.INFO} Duplicate webhook ignored: ${payload.tracking_id}`);
      return NextResponse.json({ status: 'duplicate_ignored' }, { status: 200 });
    }

    // Processar webhook
    const result = await processWebhook(payload);

    // Salvar webhook para histórico/auditoria
    await saveWebhookRecord(payload, result);

    const processingTime = Date.now() - startTime;
    console.log(`${ICONS.SUCCESS} Webhook processed successfully in ${processingTime}ms`, {
      trackingId: payload.tracking_id,
      processNumber: payload.process_number,
      eventType: payload.event_type,
      newMovements: result.newMovements,
      alertsGenerated: result.alertsGenerated
    });

    return NextResponse.json({
      status: 'success',
      processed: result.success,
      newMovements: result.newMovements,
      alertsGenerated: result.alertsGenerated,
      processingTime
    }, { status: 200 });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`${ICONS.ERROR} Webhook processing failed:`, error);

    // Log detalhado do erro
    await logWebhookError(request, error, processingTime);

    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime
    }, { status: 500 });
  }
}

// ================================================================
// PROCESSAMENTO DO WEBHOOK
// ================================================================

async function processWebhook(payload: JuditWebhookPayload): Promise<WebhookProcessingResult> {
  const startTime = Date.now();

  const result: WebhookProcessingResult = {
    success: false,
    newMovements: 0,
    alertsGenerated: 0,
    attachmentsProcessed: 0,
    processingTime: 0
  };

  try {
    // Buscar processo pelo tracking_id ou process_number
    const process = await findProcessByTracking(payload.tracking_id, payload.process_number);

    if (!process) {
      console.warn(`${ICONS.WARNING} Process not found for tracking: ${payload.tracking_id} / ${payload.process_number}`);
      result.error = 'Process not found';
      return result;
    }

    result.processId = process.id;

    // Processar conforme tipo de evento
    switch (payload.event_type) {
      case 'movement':
        await processMovementEvent(process, payload, result);
        break;

      case 'attachment':
        await processAttachmentEvent(process, payload, result);
        break;

      case 'status_change':
        await processStatusChangeEvent(process, payload, result);
        break;

      case 'update':
        await processUpdateEvent(process, payload, result);
        break;

      default:
        console.warn(`${ICONS.WARNING} Unknown event type: ${payload.event_type}`);
        result.error = `Unknown event type: ${payload.event_type}`;
        return result;
    }

    // Atualizar timestamp da última atualização
    await updateProcessLastWebhook(process.id);

    result.success = true;
    result.processingTime = Date.now() - startTime;

    return result;

  } catch (error) {
    console.error(`${ICONS.ERROR} Failed to process webhook:`, error);
    result.error = error instanceof Error ? error.message : 'Unknown error';
    result.processingTime = Date.now() - startTime;
    return result;
  }
}

// ================================================================
// PROCESSAMENTO POR TIPO DE EVENTO
// ================================================================

async function processMovementEvent(
  process: any,
  payload: JuditWebhookPayload,
  result: WebhookProcessingResult
) {
  const movement = payload.data.movement;
  if (!movement) {
    console.warn(`${ICONS.WARNING} Movement event without movement data`);
    return;
  }

  console.log(`${ICONS.PROCESS} Processing movement for ${process.processNumber}: ${movement.description}`);

  try {
    // Verificar se movimento já existe
    const existingMovement = await prisma.processMovement.findFirst({
      where: {
        processId: process.id,
        remoteId: movement.id
      }
    });

    if (existingMovement) {
      console.log(`${ICONS.INFO} Movement already exists, skipping: ${movement.id}`);
      return;
    }

    // Criar nova movimentação
    const newMovement = await prisma.processMovement.create({
      data: {
        processId: process.id,
        remoteId: movement.id,
        type: movement.type,
        date: new Date(movement.date),
        description: movement.description,
        content: movement.content,
        source: 'webhook',
        metadata: {
          trackingId: payload.tracking_id,
          webhookTimestamp: payload.timestamp
        }
      }
    });

    result.newMovements++;

    // Processar anexos da movimentação
    if (movement.attachments?.length > 0) {
      await processMovementAttachments(newMovement.id, movement.attachments);
      result.attachmentsProcessed += movement.attachments.length;
    }

    // Gerar alertas se habilitado
    if (WEBHOOK_CONFIG.ENABLE_MOVEMENT_ALERTS) {
      const alertsGenerated = await generateMovementAlerts(process, newMovement);
      result.alertsGenerated += alertsGenerated;
    }

    console.log(`${ICONS.SUCCESS} Movement processed: ${movement.description}`);

  } catch (error) {
    console.error(`${ICONS.ERROR} Failed to process movement:`, error);
    throw error;
  }
}

async function processAttachmentEvent(
  process: any,
  payload: JuditWebhookPayload,
  result: WebhookProcessingResult
) {
  console.log(`${ICONS.ATTACHMENT} Processing attachment event for ${process.processNumber}`);

  try {
    // Buscar attachments na Judit para obter dados completos
    const juditClient = getJuditApiClient();
    const processData = await juditClient.getProcessDetails(process.processNumber);

    if (processData.attachments?.length > 0) {
      const newAttachments = await processAttachments(process.id, processData.attachments);
      result.attachmentsProcessed = newAttachments.length;

      // Gerar alertas para anexos importantes
      if (WEBHOOK_CONFIG.ENABLE_ATTACHMENT_ALERTS) {
        const importantAttachments = newAttachments.filter(att => att.important);
        if (importantAttachments.length > 0) {
          const alertsGenerated = await generateAttachmentAlerts(process, importantAttachments);
          result.alertsGenerated += alertsGenerated;
        }
      }
    }

  } catch (error) {
    console.error(`${ICONS.ERROR} Failed to process attachment event:`, error);
    throw error;
  }
}

async function processStatusChangeEvent(
  process: any,
  payload: JuditWebhookPayload,
  result: WebhookProcessingResult
) {
  const status = payload.data.status;
  if (!status) {
    console.warn(`${ICONS.WARNING} Status change event without status data`);
    return;
  }

  console.log(`${ICONS.STATUS} Processing status change for ${process.processNumber}: ${status.previous} -> ${status.current}`);

  try {
    // Atualizar status do processo
    await prisma.monitoredProcess.update({
      where: { id: process.id },
      data: {
        status: status.current,
        statusChangedAt: new Date(),
        metadata: {
          ...process.metadata,
          previousStatus: status.previous,
          statusChangeReason: status.reason,
          statusChangeWebhook: payload.timestamp
        }
      }
    });

    // Gerar alertas para mudanças de status importantes
    if (WEBHOOK_CONFIG.ENABLE_STATUS_ALERTS) {
      const alertsGenerated = await generateStatusChangeAlerts(process, status);
      result.alertsGenerated += alertsGenerated;
    }

    console.log(`${ICONS.SUCCESS} Status updated: ${status.previous} -> ${status.current}`);

  } catch (error) {
    console.error(`${ICONS.ERROR} Failed to process status change:`, error);
    throw error;
  }
}

async function processUpdateEvent(
  process: any,
  payload: JuditWebhookPayload,
  result: WebhookProcessingResult
) {
  console.log(`${ICONS.UPDATE} Processing general update for ${process.processNumber}`);

  try {
    // Para updates gerais, fazer uma busca completa dos dados atualizados
    const juditClient = getJuditApiClient();
    const updatedData = await juditClient.getProcessDetails(process.processNumber);

    // Processar movimentações novas
    if (updatedData.movimentacoes?.length > 0) {
      const newMovements = await syncProcessMovements(process.id, updatedData.movimentacoes);
      result.newMovements = newMovements.length;
    }

    // Processar anexos novos
    if (updatedData.attachments?.length > 0) {
      const newAttachments = await processAttachments(process.id, updatedData.attachments);
      result.attachmentsProcessed = newAttachments.length;
    }

    // Atualizar metadados do processo
    await updateProcessMetadata(process.id, updatedData, payload.timestamp);

    console.log(`${ICONS.SUCCESS} General update processed: ${result.newMovements} movements, ${result.attachmentsProcessed} attachments`);

  } catch (error) {
    console.error(`${ICONS.ERROR} Failed to process general update:`, error);
    throw error;
  }
}

// ================================================================
// FUNÇÕES AUXILIARES
// ================================================================

async function validateWebhookSignature(request: NextRequest, payload: JuditWebhookPayload): Promise<boolean> {
  try {
    const signature = request.headers.get('x-judit-signature');
    if (!signature) return false;

    const secret = process.env.JUDIT_WEBHOOK_SECRET;
    if (!secret) {
      console.warn(`${ICONS.WARNING} JUDIT_WEBHOOK_SECRET not configured`);
      return true; // Skip validation if secret not configured
    }

    const payloadStr = JSON.stringify(payload);
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payloadStr, 'utf8')
      .digest('hex');

    const providedSignature = signature.replace('sha256=', '');

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(providedSignature, 'hex')
    );

  } catch (error) {
    console.error(`${ICONS.ERROR} Signature validation failed:`, error);
    return false;
  }
}

async function isDuplicateWebhook(payload: JuditWebhookPayload): Promise<boolean> {
  const deduplicationKey = `webhook:${payload.tracking_id}:${payload.event_type}:${payload.timestamp}`;

  const existing = await prisma.webhookDeduplication.findFirst({
    where: {
      key: deduplicationKey,
      createdAt: {
        gte: new Date(Date.now() - WEBHOOK_CONFIG.DEDUP_WINDOW_MINUTES * 60 * 1000)
      }
    }
  });

  if (existing) {
    return true;
  }

  // Criar registro de deduplicação
  await prisma.webhookDeduplication.create({
    data: {
      key: deduplicationKey,
      trackingId: payload.tracking_id,
      eventType: payload.event_type,
      processNumber: payload.process_number
    }
  });

  return false;
}

async function findProcessByTracking(trackingId: string, processNumber: string) {
  return await prisma.monitoredProcess.findFirst({
    where: {
      OR: [
        { remoteTrackingId: trackingId },
        { processNumber: processNumber }
      ]
    },
    include: {
      workspace: {
        select: { id: true, name: true }
      }
    }
  });
}

async function processMovementAttachments(movementId: string, attachments: any[]) {
  for (const attachment of attachments) {
    await prisma.processAttachment.create({
      data: {
        movementId,
        remoteId: attachment.id,
        name: attachment.name,
        type: attachment.type,
        size: attachment.size,
        url: attachment.url,
        source: 'webhook'
      }
    });
  }
}

async function processAttachments(processId: string, attachments: any[]) {
  const newAttachments = [];

  for (const attachment of attachments) {
    const existing = await prisma.processAttachment.findFirst({
      where: {
        processId,
        remoteId: attachment.id
      }
    });

    if (!existing) {
      const newAttachment = await prisma.processAttachment.create({
        data: {
          processId,
          remoteId: attachment.id,
          name: attachment.name,
          type: attachment.type,
          size: attachment.size,
          url: attachment.url,
          important: attachment.important || false,
          source: 'webhook'
        }
      });
      newAttachments.push(newAttachment);
    }
  }

  return newAttachments;
}

async function syncProcessMovements(processId: string, movements: any[]) {
  const newMovements = [];

  for (const movement of movements) {
    const existing = await prisma.processMovement.findFirst({
      where: {
        processId,
        remoteId: movement.id
      }
    });

    if (!existing) {
      const newMovement = await prisma.processMovement.create({
        data: {
          processId,
          remoteId: movement.id,
          type: movement.type,
          date: new Date(movement.date),
          description: movement.description,
          content: movement.content,
          source: 'webhook'
        }
      });
      newMovements.push(newMovement);
    }
  }

  return newMovements;
}

async function generateMovementAlerts(process: any, movement: any): Promise<number> {
  // TODO: Implementar lógica de alertas para movimentações
  // Por enquanto retornar 1 se movimento for importante
  const isImportant = movement.type === 'sentenca' || movement.type === 'acordao';
  return isImportant ? 1 : 0;
}

async function generateAttachmentAlerts(process: any, attachments: any[]): Promise<number> {
  // TODO: Implementar lógica de alertas para anexos
  return attachments.length;
}

async function generateStatusChangeAlerts(process: any, status: any): Promise<number> {
  // TODO: Implementar lógica de alertas para mudanças de status
  const importantStatuses = ['arquivado', 'baixado', 'extinto'];
  return importantStatuses.includes(status.current.toLowerCase()) ? 1 : 0;
}

async function updateProcessLastWebhook(processId: string) {
  await prisma.monitoredProcess.update({
    where: { id: processId },
    data: { lastWebhookAt: new Date() }
  });
}

async function updateProcessMetadata(processId: string, data: any, webhookTimestamp: string) {
  await prisma.monitoredProcess.update({
    where: { id: processId },
    data: {
      metadata: {
        lastWebhookUpdate: webhookTimestamp,
        lastDataSync: new Date().toISOString(),
        ...data.metadata
      }
    }
  });
}

async function saveWebhookRecord(payload: JuditWebhookPayload, result: WebhookProcessingResult) {
  await prisma.webhookLog.create({
    data: {
      trackingId: payload.tracking_id,
      processNumber: payload.process_number,
      eventType: payload.event_type,
      processId: result.processId,
      success: result.success,
      newMovements: result.newMovements,
      alertsGenerated: result.alertsGenerated,
      attachmentsProcessed: result.attachmentsProcessed,
      processingTime: result.processingTime,
      error: result.error,
      payload: payload as any,
      timestamp: new Date(payload.timestamp)
    }
  });
}

async function logWebhookError(request: NextRequest, error: any, processingTime: number) {
  try {
    const headers = Object.fromEntries(request.headers.entries());
    const url = request.url;

    await prisma.webhookError.create({
      data: {
        url,
        method: 'POST',
        headers: headers as any,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        processingTime,
        timestamp: new Date()
      }
    });
  } catch (logError) {
    console.error(`${ICONS.ERROR} Failed to log webhook error:`, logError);
  }
}

// ================================================================
// MÉTODOS HTTP OPCIONAIS
// ================================================================

export async function GET() {
  return NextResponse.json({
    status: 'active',
    webhook: 'judit-tracking',
    version: '1.0.0',
    capabilities: [
      'movement_events',
      'attachment_events',
      'status_change_events',
      'update_events'
    ],
    config: {
      validateSignature: WEBHOOK_CONFIG.VALIDATE_SIGNATURE,
      maxPayloadSize: WEBHOOK_CONFIG.MAX_PAYLOAD_SIZE,
      dedupWindow: WEBHOOK_CONFIG.DEDUP_WINDOW_MINUTES
    }
  });
}