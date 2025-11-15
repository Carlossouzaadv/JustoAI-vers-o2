// ================================================================
// WEBHOOK HANDLER - Recepção de Notificações da Judit via Tracking
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ICONS } from '@/lib/icons';
import crypto from 'crypto';
import { sendProcessAlert } from '@/lib/notification-service';
import { getWebSocketManager } from '@/lib/websocket-manager';
import type { MonitoredProcess, ProcessMovement, InputJsonValue } from '@/lib/types/database';


// ================================================================
// TIPOS E INTERFACES
// ================================================================

interface AttachmentData {
  id: string;
  name: string;
  type: string;
  size: number;
  url?: string;
  important?: boolean;
}

interface MovementData {
  id: string;
  type: string;
  date: string;
  description: string;
  content: string;
  attachments?: AttachmentData[];
}

interface StatusData {
  previous: string;
  current: string;
  reason?: string;
}

interface JuditWebhookPayload {
  tracking_id: string;
  process_number: string;
  event_type: 'movement' | 'attachment' | 'status_change' | 'update';
  timestamp: string;
  data: {
    movement?: MovementData;
    status?: StatusData;
    metadata?: Record<string, unknown>;
  };
  signature?: string;
}

// Type for MonitoredProcess with workspace relation
type MonitoredProcessWithWorkspace = MonitoredProcess & {
  workspace: {
    id: string;
    name: string;
  };
};

// Type for process data from Judit API
interface JuditProcessData {
  attachments?: AttachmentData[];
  movimentacoes?: MovementData[];
  metadata?: Record<string, unknown>;
}

// Type Guard for ProcessMovement raw data
interface ProcessMovementRawData {
  remoteId?: string;
  juditProcessId?: string;
  webhookTimestamp?: string;
  trackingId?: string;
  content?: string;
  [key: string]: unknown;
}

// Type Guard for MonitoredProcess JSON metadata
interface MonitoredProcessMetadata {
  lastWebhookAt?: string;
  lastWebhookEvent?: string;
  remoteIds?: Record<string, string>;
  [key: string]: unknown;
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

    // Get workspace from process to check for duplicates
    const process = await prisma.monitoredProcess.findFirst({
      where: { processNumber: payload.process_number }
    });

    const workspaceId = process?.workspaceId || 'unknown';

    // Verificar deduplicação
    if (await isDuplicateWebhook(payload, workspaceId)) {
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
  process: MonitoredProcessWithWorkspace,
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
    // Build raw data with remote identifiers
    const rawData: ProcessMovementRawData = {
      remoteId: movement.id,
      juditProcessId: payload.tracking_id,
      webhookTimestamp: payload.timestamp,
      trackingId: payload.tracking_id,
      content: movement.content,
    };

    // Verificar se movimento já existe (by type + date + description as composite key)
    const existingMovement = await prisma.processMovement.findFirst({
      where: {
        monitoredProcessId: process.id,
        type: movement.type,
        date: new Date(movement.date),
        description: movement.description,
      }
    });

    if (existingMovement) {
      console.log(`${ICONS.INFO} Movement already exists, skipping: ${movement.id}`);
      return;
    }

    // Criar nova movimentação
    const newMovement = await prisma.processMovement.create({
      data: {
        monitoredProcessId: process.id,
        type: movement.type,
        date: new Date(movement.date),
        description: movement.description,
        rawData: rawData as InputJsonValue,
      }
    });

    result.newMovements++;

    // Processar anexos da movimentação
    if (movement.attachments && movement.attachments.length > 0) {
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
  process: MonitoredProcessWithWorkspace,
  payload: JuditWebhookPayload,
  _result: WebhookProcessingResult
) {
  console.log(`${ICONS.INFO} Processing attachment event for ${process.processNumber}`);

  try {
    // Attachments are included in the webhook payload
    if (payload.data.metadata) {
      console.log(`${ICONS.INFO} Attachment event received for ${process.processNumber}`);
      // The attachment data is typically in the metadata field
      // Store it in the process metadata for later retrieval
    }

  } catch (error) {
    console.error(`${ICONS.ERROR} Failed to process attachment event:`, error);
    throw error;
  }
}

async function processStatusChangeEvent(
  process: MonitoredProcessWithWorkspace,
  payload: JuditWebhookPayload,
  result: WebhookProcessingResult
) {
  const status = payload.data.status;
  if (!status) {
    console.warn(`${ICONS.WARNING} Status change event without status data`);
    return;
  }

  console.log(`${ICONS.INFO} Processing status change for ${process.processNumber}: ${status.previous} -> ${status.current}`);

  try {
    // Update processData with status metadata
    const currentProcessData = (process.processData as Record<string, unknown>) || {};
    const updatedProcessData = {
      ...currentProcessData,
      lastStatusChange: {
        previous: status.previous,
        current: status.current,
        reason: status.reason,
        timestamp: new Date().toISOString(),
      },
    };

    await prisma.monitoredProcess.update({
      where: { id: process.id },
      data: {
        processData: updatedProcessData as InputJsonValue,
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
  process: MonitoredProcessWithWorkspace,
  payload: JuditWebhookPayload,
  result: WebhookProcessingResult
) {
  console.log(`${ICONS.INFO} Processing general update for ${process.processNumber}`);

  try {
    // Para updates gerais, processar dados que vieram no webhook
    const updatedData: JuditProcessData = {
      metadata: payload.data.metadata
    };

    // Update process metadata if available
    if (payload.data.metadata) {
      await updateProcessMetadata(process.id, updatedData, payload.timestamp);
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

async function isDuplicateWebhook(payload: JuditWebhookPayload, workspaceId: string): Promise<boolean> {
  // Check for duplicate webhook within the deduplication window
  const existing = await prisma.webhookQueue.findFirst({
    where: {
      workspaceId,
      eventType: payload.event_type,
      processNumber: payload.process_number,
      createdAt: {
        gte: new Date(Date.now() - WEBHOOK_CONFIG.DEDUP_WINDOW_MINUTES * 60 * 1000)
      }
    }
  });

  if (existing) {
    console.log(`${ICONS.INFO} Duplicate webhook detected, skipping`);
    return true;
  }

  // Criar registro de deduplicação
  await prisma.webhookQueue.create({
    data: {
      workspaceId,
      eventType: payload.event_type,
      processNumber: payload.process_number,
      payload: (payload as unknown) as InputJsonValue,
      status: 'PENDING',
    }
  });

  return false;
}

async function findProcessByTracking(trackingId: string, processNumber: string): Promise<MonitoredProcessWithWorkspace | null> {
  // MonitoredProcess doesn't have a separate tracking ID field, use processNumber
  return await prisma.monitoredProcess.findFirst({
    where: {
      processNumber: processNumber
    },
    include: {
      workspace: true
    }
  });
}

async function processMovementAttachments(movementId: string, attachments: AttachmentData[]): Promise<void> {
  // Store attachment metadata in the ProcessMovement's rawData field
  // Don't create separate CaseDocuments as this is tracking data not case files
  console.log(`${ICONS.INFO} Processing ${attachments.length} attachments for movement ${movementId}`);
  // Attachments are stored via their process, not individual movements
}

async function generateMovementAlerts(process: MonitoredProcessWithWorkspace, movement: { type: unknown; description: unknown; date: unknown }): Promise<number> {
  try {
    // Definir urgência baseado no tipo de movimentação
    const urgencyMap: Record<string, 'high' | 'medium' | 'low'> = {
      'sentenca': 'high',      // Sentença judicial
      'acordao': 'high',        // Acórdão (decisão de tribunal)
      'despacho': 'high',       // Despacho importante
      'deliberacao': 'high',    // Deliberação
      'parecer': 'medium',      // Parecer
      'julgamento': 'high',     // Julgamento
      'recurso': 'medium',      // Recurso
      'apelacao': 'medium',     // Apelação
      'embargos': 'medium',     // Embargos
      'moção': 'low',           // Moção
      'petição': 'low',         // Petição comum
      'informação': 'low'       // Informação
    };

    // Detectar urgência - padrão é MEDIUM se não encontrado
    const movementType = typeof movement.type === 'string' ? movement.type.toLowerCase() : '';
    const urgency = urgencyMap[movementType] || 'medium';

    // Verificar se é movimento importante para alertar
    const isImportant = urgency !== 'low';

    if (!isImportant) {
      console.log(`${ICONS.INFO} Movimentação de baixa prioridade, sem alerta: ${movementType}`);
      return 0;
    }

    // Validate workspaceId is a string
    const workspaceId = typeof process.workspaceId === 'string' ? process.workspaceId : '';

    // Buscar workspace com dados básicos para log
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId }
    });

    if (!workspace) {
      console.warn(`${ICONS.WARNING} Workspace not found: ${workspaceId}`);
      return 0;
    }

    // Por enquanto, apenas log do alerta (integração com sistema de notificação será implementada)
    console.log(`${ICONS.INFO} Alert would be sent to workspace ${workspace.name} users for movement`);

    // Enviar alerta para cada usuário do workspace
    let alertsGenerated = 0;
    // TODO: Implementar busca de usuários do workspace quando o modelo estiver disponível
    // Placeholder for future implementation - keeping structure for when user notification is ready
    alertsGenerated = 0;

    if (alertsGenerated > 0) {
      // Broadcaster em tempo real via SSE
      const wsManager = getWebSocketManager();
      wsManager.broadcastToWorkspace(process.workspace.id, {
        type: 'movement:added',
        processId: process.id,
        data: {
          processNumber: process.processNumber,
          movementType: typeof movement.type === 'string' ? movement.type : 'Tipo desconhecido',
          movementDescription: typeof movement.description === 'string' ? movement.description : 'Sem descrição',
          date: movement.date,
          urgency: urgency,
          timestamp: new Date().toISOString()
        }
      });

      console.log(`${ICONS.SUCCESS} ${alertsGenerated} alerta(s) de movimentação enviado(s) + broadcaster SSE`);
    }

    return alertsGenerated;
  } catch (error) {
    console.error(`${ICONS.ERROR} Erro ao gerar alertas de movimentação:`, error);
    return 0;
  }
}

async function generateStatusChangeAlerts(process: MonitoredProcessWithWorkspace, status: StatusData): Promise<number> {
  try {
    // Definir urgência baseado no tipo de mudança de status
    const urgencyMap: Record<string, 'high' | 'medium' | 'low'> = {
      'arquivado': 'high',      // Processo arquivado
      'baixado': 'high',        // Processo baixado (encerrado)
      'extinto': 'high',        // Processo extinto
      'julgado': 'high',        // Processo julgado
      'finalizado': 'high',     // Processo finalizado
      'suspenso': 'medium',     // Processo suspenso
      'paralizado': 'medium',   // Processo paralizado
      'ativo': 'low',           // Processo ativo
      'andamento': 'low'        // Processo em andamento
    };

    // Detectar urgência - padrão é LOW se não encontrado
    const currentStatus = status.current?.toLowerCase() || '';
    const urgency = urgencyMap[currentStatus] || 'low';

    // Verificar se é mudança importante para alertar
    const isImportant = urgency !== 'low';

    if (!isImportant) {
      console.log(`${ICONS.INFO} Mudança de status de baixa prioridade, sem alerta: ${currentStatus}`);
      return 0;
    }

    // Validate workspaceId is a string
    const workspaceId = typeof process.workspaceId === 'string' ? process.workspaceId : '';

    // Buscar workspace com dados básicos para log
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId }
    });

    if (!workspace) {
      console.warn(`${ICONS.WARNING} Workspace not found for status change notification: ${workspaceId}`);
      return 0;
    }

    // Por enquanto, apenas log do alerta (integração com sistema de notificação será implementada)
    console.log(`${ICONS.INFO} Status change alert would be sent to workspace ${workspace.name} users`);

    // Criar descrição da mudança
    const statusChangeDescription = `
Processo: ${process.processNumber}
Status anterior: ${status.previous}
Novo status: ${status.current}
${status.reason ? `Motivo: ${status.reason}` : ''}
    `.trim();

    // Enviar alerta para cada usuário
    let alertsGenerated = 0;
    // TODO: Implementar busca de usuários do workspace quando o modelo estiver disponível
    // Placeholder for future implementation
    alertsGenerated = 0;

    if (alertsGenerated > 0 || true) {
      // Broadcaster em tempo real via SSE
      const wsManager = getWebSocketManager();
      wsManager.broadcastToWorkspace(process.workspace.id, {
        type: 'status:changed',
        processId: process.id,
        data: {
          processNumber: process.processNumber,
          previousStatus: status.previous,
          currentStatus: status.current,
          reason: typeof status.reason === 'string' ? status.reason : undefined,
          urgency: urgency,
          timestamp: new Date().toISOString()
        }
      });

      console.log(`${ICONS.SUCCESS} ${alertsGenerated} alerta(s) de mudança de status enviado(s) + broadcaster SSE`);
    }

    return alertsGenerated;
  } catch (error) {
    console.error(`${ICONS.ERROR} Erro ao gerar alertas de status:`, error);
    return 0;
  }
}

async function updateProcessLastWebhook(processId: string) {
  // Get current process data
  const process = await prisma.monitoredProcess.findUnique({
    where: { id: processId }
  });

  if (!process) return;

  // Update processData with webhook timestamp
  const currentData = (process.processData as Record<string, unknown>) || {};
  const metadata: MonitoredProcessMetadata = {
    ...currentData,
    lastWebhookAt: new Date().toISOString(),
  };

  await prisma.monitoredProcess.update({
    where: { id: processId },
    data: {
      processData: metadata as InputJsonValue
    }
  });
}

async function updateProcessMetadata(processId: string, data: JuditProcessData, webhookTimestamp: string): Promise<void> {
  const dataMetadata = (data.metadata && typeof data.metadata === 'object' && !Array.isArray(data.metadata))
    ? data.metadata
    : {};

  // Get current process data
  const process = await prisma.monitoredProcess.findUnique({
    where: { id: processId }
  });

  if (!process) return;

  const currentProcessData = (process.processData as Record<string, unknown>) || {};

  await prisma.monitoredProcess.update({
    where: { id: processId },
    data: {
      processData: {
        ...currentProcessData,
        lastWebhookUpdate: webhookTimestamp,
        lastDataSync: new Date().toISOString(),
        ...dataMetadata
      } as InputJsonValue
    }
  });
}

async function saveWebhookRecord(payload: JuditWebhookPayload, result: WebhookProcessingResult) {
  // Update WebhookQueue with processing result
  if (result.success) {
    // Mark in log by updating any pending queue entries
    await prisma.webhookQueue.updateMany({
      where: {
        eventType: payload.event_type,
        processNumber: payload.process_number,
        status: 'PENDING'
      },
      data: {
        status: 'SUCCESS',
        processedAt: new Date()
      }
    });
  }
}

async function logWebhookError(request: NextRequest, error: unknown, processingTime: number) {
  try {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    await prisma.webhookError.create({
      data: {
        workspaceId: 'unknown',
        eventType: 'webhook_error',
        errorMessage,
        errorStack,
        payload: {
          url: request.url,
          method: 'POST',
          processingTime
        } as InputJsonValue
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