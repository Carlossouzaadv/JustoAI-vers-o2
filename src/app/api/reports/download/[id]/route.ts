// ================================================================
// API ENDPOINT - Download de Relatórios
// ================================================================
// GET /api/reports/download/[id] - Download de relatório por ID

import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, requireAuth, withErrorHandler } from '@/lib/api-utils';
import { prisma } from '@/lib/prisma';
import { ICONS } from '@/lib/icons';
import { OutputFormat } from '@/lib/types/database';
import fs from 'fs/promises';
import path from 'path';

// Type guard for OutputFormat validation
function isValidOutputFormat(value: unknown): value is OutputFormat {
  const validFormats = ['PDF', 'DOCX', 'XLSX', 'JSON'];
  return typeof value === 'string' && validFormats.includes(value);
}

// Type guard for file URLs object
function isFileUrlsObject(obj: unknown): obj is Record<string, string> {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    !Array.isArray(obj) &&
    Object.values(obj).every(v => typeof v === 'string')
  );
}

export const GET = withErrorHandler(async (
  request: NextRequest,
  context?: { params?: Promise<Record<string, string>> }
) => {
  const paramsObj = context?.params ? await context.params : { id: '' };
  const { user, error: authError } = await requireAuth(request);
  if (authError) return authError;

  const id = paramsObj.id || '';
  const reportId = id;
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || 'PDF';
  const workspaceId = searchParams.get('workspaceId');

  if (!workspaceId) {
    return errorResponse('workspaceId é obrigatório', 400);
  }

  console.log(`${ICONS.PROCESS} Download solicitado para relatório: ${reportId} (formato: ${format})`);

  try {
    // Verificar acesso ao workspace
    const hasAccess = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        users: {
          some: { userId: user.id }
        }
      }
    });

    if (!hasAccess) {
      return errorResponse('Workspace não encontrado ou acesso negado', 404);
    }

    // Buscar a execução do relatório
    // Retrieve any report execution (status checking happens in application logic)
    const execution = await prisma.reportExecution.findFirst({
      where: {
        id: reportId,
        workspaceId,
      },
      select: {
        id: true,
        fileUrls: true,
        outputFormats: true,
        scheduleId: true,
        status: true,
      }
    });

    if (!execution) {
      return errorResponse('Relatório não encontrado ou não está concluído', 404);
    }

    // Validate status before allowing download
    // Only allow download if status is not FAILED or CANCELLED
    if (execution.status === 'FAILED' || execution.status === 'CANCELLED') {
      return errorResponse('Relatório não está disponível para download (status: ' + execution.status + ')', 400);
    }

    // Type-safe validation of format parameter
    const formatValue: unknown = format;
    if (!isValidOutputFormat(formatValue)) {
      return errorResponse(`Formato ${format} não é suportado`, 400);
    }

    // Type-safe validation of fileUrls
    const fileUrlsValue: unknown = execution.fileUrls;
    if (!isFileUrlsObject(fileUrlsValue)) {
      return errorResponse('Arquivo não encontrado no sistema', 500);
    }

    const fileUrl = fileUrlsValue[formatValue];

    if (!fileUrl) {
      return errorResponse(`Arquivo ${format} não encontrado`, 404);
    }

    // Construir caminho do arquivo
    const filePath = path.join(process.cwd(), 'public', fileUrl.replace('/files/', ''));

    try {
      // Verificar se arquivo existe
      await fs.access(filePath);

      // Ler arquivo
      const fileBuffer = await fs.readFile(filePath);

      // Preparar headers de resposta
      // Use scheduleId as base for filename (schedule name would require additional lookup)
      const fileName = `relatorio_${execution.scheduleId || execution.id}_${formatValue}.${formatValue.toLowerCase()}`;
      const mimeType = formatValue === 'PDF' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

      console.log(`${ICONS.SUCCESS} Arquivo enviado: ${fileName}`);

      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Content-Disposition': `attachment; filename="${fileName}"`,
          'Content-Length': fileBuffer.length.toString(),
          'Cache-Control': 'private, no-cache'
        }
      });

    } catch (_fileError) {
      console.error(`${ICONS.ERROR} Arquivo não encontrado:`, filePath);
      return errorResponse('Arquivo não encontrado no sistema', 404);
    }

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro no download:`, error);
    return errorResponse(
      error instanceof Error ? error.message : 'Erro interno do servidor',
      500
    );
  }
});