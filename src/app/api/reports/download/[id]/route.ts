// ================================================================
// API ENDPOINT - Download de Relatórios
// ================================================================
// GET /api/reports/download/[id] - Download de relatório por ID

import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, requireAuth, withErrorHandler } from '@/lib/api-utils';
import { prisma } from '@/lib/prisma';
import { ICONS } from '@/lib/icons';
import fs from 'fs/promises';
import path from 'path';

export const GET = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { user, error: authError } = await requireAuth(request);
  if (authError) return authError;

  const { id: reportId } = await params;
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
    const execution = await prisma.reportExecution.findFirst({
      where: {
        id: reportId,
        workspaceId,
        status: 'CONCLUIDO'
      },
      include: {
        schedule: {
          select: {
            name: true,
            type: true
          }
        }
      }
    });

    if (!execution) {
      return errorResponse('Relatório não encontrado ou não está concluído', 404);
    }

    // Verificar se o formato solicitado está disponível
    if (!execution.outputFormats.includes(format as any)) {
      return errorResponse(`Formato ${format} não está disponível para este relatório`, 400);
    }

    // Obter URL do arquivo
    const fileUrls = execution.fileUrls as any;
    const fileUrl = fileUrls[format];

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
      const fileName = `${execution.schedule?.name || 'relatorio'}_${execution.id}.${format.toLowerCase()}`;
      const mimeType = format === 'PDF' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

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

    } catch (fileError) {
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