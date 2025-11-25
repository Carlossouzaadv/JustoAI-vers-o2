// ================================================================
// API ENDPOINT - Status do Batch
// ================================================================
// Endpoint para acompanhar progresso do processamento

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ICONS } from '@/lib/icons';

// Type guard for error object with field and error properties
// Padrão-Ouro: Narrow first, THEN cast, THEN check properties
function isErrorObject(error: unknown): error is { field: string; error: string; retryCount?: number } {
  // Step 1: Narrow to object type (BEFORE any casting)
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  // Step 2: Safe cast only AFTER narrowing
  const obj = error as Record<string, unknown>;

  // Step 3: Check properties with safe access
  return (
    'field' in obj &&
    typeof obj.field === 'string' &&
    'error' in obj &&
    typeof obj.error === 'string' &&
    (!('retryCount' in obj) || typeof obj.retryCount === 'number')
  );
}

/**
 * GET /api/upload/batch/{id}/status
 * Retorna status atual do processamento do batch
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: batchId } = await params;

    if (!batchId) {
      return NextResponse.json(
        {
          success: false,
          error: 'ID do batch é obrigatório'
        },
        { status: 400 }
      );
    }

    console.log(`${ICONS.SEARCH} Consultando status do batch: ${batchId}`);

    // Buscar batch no banco
    const batch = await prisma.processBatchUpload.findUnique({
      where: { id: batchId },
      include: {
        workspace: {
          select: {
            id: true,
            name: true
          }
        }
      }
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

    // Calcular progresso
    const progress = batch.totalRows > 0
      ? Math.round((batch.processed / batch.totalRows) * 100)
      : 0;

    // Calcular ETA se ainda processando
    let estimatedTimeRemaining = 0;
    if (batch.status === 'PROCESSING' && batch.processed > 0) {
      const elapsed = Date.now() - batch.createdAt.getTime();
      const rate = batch.processed / elapsed; // linhas por ms
      const remaining = batch.totalRows - batch.processed;
      estimatedTimeRemaining = Math.ceil((remaining / rate) / 1000 / 60); // minutos
    }

    // Buscar erros se houver
    let errors: unknown[] = [];
    const errorSummary: Record<string, number> = {};
    try {
      if (batch.errors) {
        errors = JSON.parse(batch.errors as string);

        // Gerar resumo de erros por campo
        for (const err of errors) {
          if (isErrorObject(err)) {
            const key = `${err.field}: ${err.error}`;
            errorSummary[key] = (errorSummary[key] || 0) + 1;
          }
        }
      }
    } catch {
      // Ignorar erro de parsing
    }

    // Buscar resumo se disponível
    let summary: unknown = {};
    try {
      if (batch.summary) {
        summary = JSON.parse(batch.summary as string);
      }
    } catch {
      // Ignorar erro de parsing
    }

    // Calcular estatísticas de retry
    const retryStats = {
      totalWithErrors: errors.length,
      retryable: 0,
      maxedOut: 0,
      retryBreakdown: {} as Record<number, number>,
    };

    for (const err of errors) {
      if (isErrorObject(err)) {
        const retryCount = err.retryCount || 0;
        if (retryCount < 3) {
          retryStats.retryable++;
        } else {
          retryStats.maxedOut++;
        }
        retryStats.retryBreakdown[retryCount] = (retryStats.retryBreakdown[retryCount] || 0) + 1;
      }
    }

    const response = {
      success: true,
      batch: {
        id: batch.id,
        fileName: batch.fileName,
        fileSize: batch.fileSize,
        status: batch.status,
        totalRows: batch.totalRows,
        processed: batch.processed,
        successful: batch.successful,
        failed: batch.failed,
        progress,
        estimatedTimeRemaining,
        createdAt: batch.createdAt,
        updatedAt: batch.updatedAt,
        workspace: batch.workspace
      },
      summary,
      errorSummary: errorSummary, // Top error messages by frequency
      retryStats, // Retry statistics
      errors: errors.slice(0, 10), // Limitar erros retornados
      hasMoreErrors: errors.length > 10,
      actions: {
        canDownloadErrors: errors.length > 0,
        canRetry: retryStats.retryable > 0,
        downloadErrorsUrl: `/api/upload/batch/${batch.id}/errors/download`,
        retryUrl: `/api/upload/batch/${batch.id}/retry`
      }
    };

    console.log(`${ICONS.SUCCESS} Status retornado: ${batch.status} (${progress}%)`);

    return NextResponse.json(response);

  } catch (_error) {
    console.error(`${ICONS.ERROR} Erro ao consultar status do batch:`, error);

    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}

/**
 * DELETE /api/upload/batch/{id}/status
 * Cancela processamento do batch
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: batchId } = await params;

    console.log(`${ICONS.PROCESS} Cancelando batch: ${batchId}`);

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

    if (batch.status !== 'PROCESSING') {
      return NextResponse.json(
        {
          success: false,
          error: `Não é possível cancelar batch com status: ${batch.status}`
        },
        { status: 400 }
      );
    }

    // Marcar como cancelado
    await prisma.processBatchUpload.update({
      where: { id: batchId },
      data: {
        status: 'CANCELLED',
        updatedAt: new Date()
      }
    });

    console.log(`${ICONS.SUCCESS} Batch ${batchId} cancelado`);

    return NextResponse.json({
      success: true,
      message: 'Batch cancelado com sucesso'
    });

  } catch (_error) {
    console.error(`${ICONS.ERROR} Erro ao cancelar batch:`, error);

    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}