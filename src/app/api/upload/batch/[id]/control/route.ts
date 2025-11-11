// ================================================================
// API ENDPOINT - Batch Control (Pause/Resume/Cancel)
// ================================================================
// POST /upload/batch/{id}/control
// Controla execução de batch: pause, resume, cancel

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { ICONS } from '@/lib/icons';

// Schema de validação para ações de controle
const controlSchema = z.object({
  action: z.enum(['pause', 'resume', 'cancel']).describe('Ação deve ser: pause, resume ou cancel'),
  reason: z.string().optional()
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: batchId } = await params;

  try {
    console.log(`${ICONS.PROCESS} Controle de batch: ${batchId}`);

    // Validar corpo da requisição
    const body = await request.json();
    const validation = controlSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Dados inválidos',
          details: validation.error.issues
        },
        { status: 400 }
      );
    }

    const { action, reason } = validation.data;

    // Verificar se o batch existe
    const batch = await prisma.processBatchUpload.findUnique({
      where: { id: batchId }
    });

    if (!batch) {
      return NextResponse.json(
        {
          success: false,
          error: 'Batch não encontrado'
        },
        { status: 404 }
      );
    }

    // Verificar se a ação é válida para o status atual
    const validTransitions = getValidTransitions(batch.status);

    if (!validTransitions.includes(action)) {
      return NextResponse.json(
        {
          success: false,
          error: `Ação '${action}' não é válida para batch com status '${batch.status}'`,
          currentStatus: batch.status,
          validActions: validTransitions
        },
        { status: 400 }
      );
    }

    // Executar ação
    const result = await executeControlAction(batchId, action, reason);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error
        },
        { status: 500 }
      );
    }

    console.log(`${ICONS.SUCCESS} Ação '${action}' executada no batch ${batchId}`);

    // Ensure newStatus is defined for successful operation
    if (!result.newStatus) {
      throw new Error('newStatus é obrigatório para operação bem-sucedida');
    }

    return NextResponse.json({
      success: true,
      batchId,
      action,
      previousStatus: batch.status,
      newStatus: result.newStatus,
      message: getActionMessage(action, result.newStatus),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro no controle do batch:`, error);

    return NextResponse.json(
      {
        success: false,
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}

// Type for valid actions
type ControlAction = 'pause' | 'resume' | 'cancel';

// Type guard to validate action string
function isValidAction(value: unknown): value is ControlAction {
  return value === 'pause' || value === 'resume' || value === 'cancel';
}

// Map internal status to Prisma-compatible status
function mapToPrismaStatus(status: BatchStatusType): PrismaBatchStatus {
  // PAUSED is not supported in Prisma, so keep it as PROCESSING
  if (status === 'PAUSED') {
    return 'PROCESSING';
  }
  return status as PrismaBatchStatus;
}

// Type for valid batch statuses
// Note: Internal representation includes PAUSED for logical flow,
// but Prisma schema only supports: PROCESSING | COMPLETED | FAILED | CANCELLED
type BatchStatusType = 'PROCESSING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
type PrismaBatchStatus = 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

/**
 * Retorna ações válidas baseadas no status atual
 */
function getValidTransitions(currentStatus: string): ControlAction[] {
  const transitions: Record<string, ControlAction[]> = {
    'PROCESSING': ['pause', 'cancel'],
    'PAUSED': ['resume', 'cancel'],
    'COMPLETED': [],
    'FAILED': [],
    'CANCELLED': []
  };

  return transitions[currentStatus] || [];
}

/**
 * Executa a ação de controle no batch
 */
async function executeControlAction(
  batchId: string,
  action: ControlAction,
  reason?: string
): Promise<{ success: boolean; newStatus?: BatchStatusType; error?: string }> {
  try {
    let newStatus: BatchStatusType;

    switch (action) {
      case 'pause':
        newStatus = 'PAUSED';
        break;

      case 'resume':
        newStatus = 'PROCESSING';
        break;

      case 'cancel':
        newStatus = 'CANCELLED';
        break;

      default:
        const _exhaustiveCheck: never = action;
        throw new Error(`Unknown action: ${_exhaustiveCheck}`);
    }

    // Atualizar status no banco
    // Note: Map internal status to Prisma-compatible status
    const prismaStatus = mapToPrismaStatus(newStatus);
    await prisma.processBatchUpload.update({
      where: { id: batchId },
      data: {
        status: prismaStatus,
        updatedAt: new Date()
      }
    });

    // Registrar evento de controle
    await prisma.uploadBatchEvent.create({
      data: {
        batchId,
        eventType: 'CONTROL_ACTION',
        payload: {
          action,
          reason,
          timestamp: new Date().toISOString(),
          newStatus
        }
      }
    });

    // Se é cancelamento, marcar todas as linhas pendentes como canceladas
    if (action === 'cancel') {
      await prisma.uploadBatchRow.updateMany({
        where: {
          batchId,
          status: 'PENDING'
        },
        data: {
          status: 'CANCELLED',
          errorMessage: reason || 'Processamento cancelado pelo usuário'
        }
      });
    }

    return { success: true, newStatus };

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro ao executar ação ${action}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
}

/**
 * Gera mensagem amigável para a ação executada
 */
function getActionMessage(action: ControlAction, newStatus: BatchStatusType): string {
  const messages: Record<ControlAction, string> = {
    'pause': 'Processamento pausado. Use "resume" para continuar.',
    'resume': 'Processamento retomado.',
    'cancel': 'Processamento cancelado. Esta ação não pode ser desfeita.'
  };

  return messages[action];
}