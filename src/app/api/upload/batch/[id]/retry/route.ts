// ================================================================
// API ROUTE: /api/upload/batch/[id]/retry
// Retry failed rows up to 3 times
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth-helper';
import { captureApiError, setSentryUserContext } from '@/lib/sentry-error-handler';
import { z } from 'zod';
import { ICONS } from '@/lib/icons';

// ================================================================
// VALIDATION SCHEMAS
// ================================================================

const retryRequestSchema = z.object({
  rowNumbers: z.array(z.number().positive()).optional(), // Retry specific rows or all
  maxRetries: z.number().min(1).max(5).optional().default(3),
});

type RetryRequest = z.infer<typeof retryRequestSchema>;

// ================================================================
// POST HANDLER: Retry failed rows
// ================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: batchId } = await params;

  try {
    // ============================================================
    // 1. AUTHENTICATION
    // ============================================================

    const user = await getAuthenticatedUser(request);
    if (!user) {
      return unauthorizedResponse('Não autenticado');
    }

    setSentryUserContext(user.id);

    console.log(`${ICONS.PROCESS} [Batch Retry] Iniciando retry para batch ${batchId}`);

    // ============================================================
    // 2. PARSE AND VALIDATE REQUEST BODY
    // ============================================================

    let body: RetryRequest = {};
    try {
      const rawBody = await request.json();
      body = retryRequestSchema.parse(rawBody);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { success: false, error: 'Validação inválida', details: error.errors },
          { status: 400 }
        );
      }
      body = {}; // Use defaults
    }

    // ============================================================
    // 3. FETCH BATCH AND VERIFY ACCESS
    // ============================================================

    const batch = await prisma.processBatchUpload.findUnique({
      where: { id: batchId },
      include: {
        workspace: {
          include: {
            users: {
              where: { userId: user.id },
            },
          },
        },
      },
    });

    if (!batch) {
      console.warn(`${ICONS.WARNING} [Batch Retry] Batch não encontrado: ${batchId}`);
      return NextResponse.json(
        { success: false, error: 'Batch não encontrado' },
        { status: 404 }
      );
    }

    // ============================================================
    // 4. VERIFY WORKSPACE ACCESS
    // ============================================================

    if (!batch.workspace?.users || batch.workspace.users.length === 0) {
      console.warn(
        `${ICONS.WARNING} [Batch Retry] Acesso negado para usuário ${user.id} ao batch ${batchId}`
      );
      return NextResponse.json(
        { success: false, error: 'Acesso negado' },
        { status: 403 }
      );
    }

    // ============================================================
    // 5. CHECK IF BATCH HAS FAILED ROWS
    // ============================================================

    if (batch.failed === 0) {
      console.log(`${ICONS.INFO} [Batch Retry] Batch não possui linhas com erro: ${batchId}`);
      return NextResponse.json(
        { success: false, error: 'Este batch não possui linhas com erro' },
        { status: 400 }
      );
    }

    // ============================================================
    // 6. GET ERROR DETAILS FROM batch.errors JSON
    // ============================================================

    let errorDetails: Array<{
      rowNumber: number;
      field: string;
      error: string;
      retryCount?: number;
    }> = [];

    try {
      if (batch.errors) {
        const parsedErrors = JSON.parse(batch.errors as string);
        if (Array.isArray(parsedErrors)) {
          errorDetails = parsedErrors;
        }
      }
    } catch (parseError) {
      console.warn(
        `${ICONS.WARNING} [Batch Retry] Erro ao fazer parse de erros JSON:`,
        parseError
      );
    }

    // ============================================================
    // 7. FILTER RETRYABLE ROWS (max retries < limit)
    // ============================================================

    const maxRetries = body.maxRetries || 3;
    const rowNumberFilter = body.rowNumbers;

    const retryableRows = errorDetails.filter((err) => {
      const retryCount = err.retryCount || 0;
      const canRetry = retryCount < maxRetries;

      // Filter by row numbers if specified
      if (rowNumberFilter && !rowNumberFilter.includes(err.rowNumber)) {
        return false;
      }

      return canRetry;
    });

    if (retryableRows.length === 0) {
      console.log(`${ICONS.WARNING} [Batch Retry] Nenhuma linha elegível para retry`);
      return NextResponse.json(
        {
          success: false,
          error: 'Nenhuma linha elegível para retry. Limite de tentativas pode ter sido atingido.',
        },
        { status: 400 }
      );
    }

    // ============================================================
    // 8. INCREMENT RETRY COUNT FOR EACH ROW
    // ============================================================

    const updatedErrors = errorDetails.map((err) => {
      if (
        retryableRows.some((r) => r.rowNumber === err.rowNumber)
      ) {
        return {
          ...err,
          retryCount: (err.retryCount || 0) + 1,
        };
      }
      return err;
    });

    // ============================================================
    // 9. UPDATE BATCH WITH NEW ERROR STATE
    // ============================================================

    const updatedBatch = await prisma.processBatchUpload.update({
      where: { id: batchId },
      data: {
        status: 'PROCESSING', // Mark as processing again
        errors: JSON.stringify(updatedErrors),
        updatedAt: new Date(),
      },
    });

    console.log(
      `${ICONS.SUCCESS} [Batch Retry] ${retryableRows.length} linhas marcadas para retry`
    );

    // ============================================================
    // 10. RETURN RETRY STATUS
    // ============================================================

    return NextResponse.json({
      success: true,
      message: `${retryableRows.length} linhas marcadas para retry`,
      batch: {
        id: updatedBatch.id,
        status: updatedBatch.status,
        totalRows: updatedBatch.totalRows,
        processed: updatedBatch.processed,
        successful: updatedBatch.successful,
        failed: updatedBatch.failed,
        retryableRows: retryableRows.length,
        nextRetryAt: new Date(Date.now() + 5000).toISOString(), // 5 seconds grace period
      },
      details: {
        rowsToRetry: retryableRows.map((r) => ({
          rowNumber: r.rowNumber,
          field: r.field,
          previousError: r.error,
          retryAttempt: (r.retryCount || 0) + 1,
          maxRetries,
        })),
        rowsExhausted: errorDetails
          .filter((err) => (err.retryCount || 0) >= maxRetries)
          .map((r) => ({ rowNumber: r.rowNumber, error: r.error })),
      },
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} [Batch Retry] Erro:`, error);

    captureApiError(error, {
      endpoint: '/api/upload/batch/[id]/retry',
      method: 'POST',
      batchId,
      userId: user?.id,
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao reprocessar linhas',
      },
      { status: 500 }
    );
  }
}

// ================================================================
// GET HANDLER: Check retry status
// ================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: batchId } = await params;

  try {
    // ============================================================
    // 1. AUTHENTICATION
    // ============================================================

    const user = await getAuthenticatedUser(request);
    if (!user) {
      return unauthorizedResponse('Não autenticado');
    }

    setSentryUserContext(user.id);

    console.log(`${ICONS.INFO} [Batch Retry Status] Consultando status de retry para batch ${batchId}`);

    // ============================================================
    // 2. FETCH BATCH AND VERIFY ACCESS
    // ============================================================

    const batch = await prisma.processBatchUpload.findUnique({
      where: { id: batchId },
      include: {
        workspace: {
          include: {
            users: {
              where: { userId: user.id },
            },
          },
        },
      },
    });

    if (!batch) {
      return NextResponse.json(
        { success: false, error: 'Batch não encontrado' },
        { status: 404 }
      );
    }

    // ============================================================
    // 3. VERIFY WORKSPACE ACCESS
    // ============================================================

    if (!batch.workspace?.users || batch.workspace.users.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Acesso negado' },
        { status: 403 }
      );
    }

    // ============================================================
    // 4. GET RETRY STATUS FROM ERRORS JSON
    // ============================================================

    const retryStats = {
      totalErrors: 0,
      retryable: 0,
      maxedOut: 0,
      retryBreakdown: {} as Record<number, number>,
    };

    try {
      if (batch.errors) {
        const errors = JSON.parse(batch.errors as string);
        if (Array.isArray(errors)) {
          retryStats.totalErrors = errors.length;
          retryStats.retryable = errors.filter((e) => (e.retryCount || 0) < 3).length;
          retryStats.maxedOut = errors.filter((e) => (e.retryCount || 0) >= 3).length;

          // Count by retry attempt
          for (const err of errors) {
            const retryCount = err.retryCount || 0;
            retryStats.retryBreakdown[retryCount] =
              (retryStats.retryBreakdown[retryCount] || 0) + 1;
          }
        }
      }
    } catch (parseError) {
      console.warn(`${ICONS.WARNING} [Batch Retry Status] Erro ao fazer parse:`, parseError);
    }

    return NextResponse.json({
      success: true,
      batch: {
        id: batch.id,
        status: batch.status,
        totalRows: batch.totalRows,
        processed: batch.processed,
        successful: batch.successful,
        failed: batch.failed,
      },
      retryStats,
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} [Batch Retry Status] Erro:`, error);

    captureApiError(error, {
      endpoint: '/api/upload/batch/[id]/retry',
      method: 'GET',
      batchId,
      userId: user?.id,
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao consultar status de retry',
      },
      { status: 500 }
    );
  }
}
