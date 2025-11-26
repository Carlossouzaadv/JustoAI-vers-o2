// ================================================================
// API ROUTE: /api/upload/batch/[id]/errors/download
// Download CSV of failed rows with errors
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth-helper';
import { captureApiError, setSentryUserContext } from '@/lib/sentry-error-handler';
import { generateErrorCsv } from '@/lib/excel-validation';
import { ICONS } from '@/lib/icons';

// ================================================================
// GET HANDLER: Download error CSV
// ================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: batchId } = await params;
  let userId: string | undefined;

  try {
    // ============================================================
    // 1. AUTHENTICATION
    // ============================================================

    const user = await getAuthenticatedUser(request);
    userId = user?.id;
    if (!user) {
      return unauthorizedResponse('Não autenticado');
    }

    setSentryUserContext(user.id);

    console.log(`${ICONS.DOWNLOAD} [Batch Errors Download] Gerando CSV de erros para batch ${batchId}`);

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
      console.warn(`${ICONS.WARNING} [Batch Errors Download] Batch não encontrado: ${batchId}`);
      return NextResponse.json(
        { success: false, error: 'Batch não encontrado' },
        { status: 404 }
      );
    }

    // ============================================================
    // 3. VERIFY WORKSPACE ACCESS
    // ============================================================

    if (!batch.workspace?.users || batch.workspace.users.length === 0) {
      console.warn(
        `${ICONS.WARNING} [Batch Errors Download] Acesso negado para usuário ${user.id} ao batch ${batchId}`
      );
      return NextResponse.json(
        { success: false, error: 'Acesso negado' },
        { status: 403 }
      );
    }

    // ============================================================
    // 4. CHECK IF BATCH HAS ERRORS
    // ============================================================

    if (batch.failed === 0) {
      console.log(`${ICONS.INFO} [Batch Errors Download] Batch não possui erros: ${batchId}`);
      return NextResponse.json(
        { success: false, error: 'Este batch não possui erros' },
        { status: 400 }
      );
    }

    // ============================================================
    // 5. GET ERROR DETAILS FROM batch.errors JSON
    // ============================================================

    let errorDetails: Array<{
      rowNumber: number;
      field: string;
      error: string;
    }> = [];

    try {
      if (batch.errors) {
        const parsedErrors = JSON.parse(batch.errors as string);
        if (Array.isArray(parsedErrors)) {
          errorDetails = parsedErrors;
        }
      }
    } catch (_parseError) {
      console.warn(
        `${ICONS.WARNING} [Batch Errors Download] Erro ao fazer parse de erros JSON:`,
        _parseError
      );
    }

    // ============================================================
    // 6. GENERATE CSV
    // ============================================================

    const csvContent = generateErrorCsv(
      errorDetails.map((err) => ({
        rowNumber: err.rowNumber,
        field: err.field,
        error: err.error,
        originalValue: 'N/A', // Original values are typically not stored for performance
      }))
    );

    console.log(
      `${ICONS.SUCCESS} [Batch Errors Download] CSV gerado com ${errorDetails.length} erros`
    );

    // ============================================================
    // 7. RETURN CSV AS DOWNLOADABLE FILE
    // ============================================================

    const timestamp = new Date().toISOString().split('T')[0];
    const fileName = `erros_batch_${batchId.substring(0, 8)}_${timestamp}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} [Batch Errors Download] Erro:`, error);

    captureApiError(error, {
      endpoint: '/api/upload/batch/[id]/errors/download',
      method: 'GET',
      batchId,
      userId,
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao gerar CSV de erros',
      },
      { status: 500 }
    );
  }
}
