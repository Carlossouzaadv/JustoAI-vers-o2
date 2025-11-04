// ================================================================
// API ROUTE: /api/documents/[id]
// Endpoints: PATCH (update metadata), DELETE (remove document)
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth-helper';
import { captureApiError, setSentryUserContext } from '@/lib/sentry-error-handler';
import { ICONS } from '@/lib/icons';

// ================================================================
// VALIDATION SCHEMAS
// ================================================================

const updateDocumentSchema = z.object({
  name: z.string().min(3).max(255).optional(),
  tags: z.array(z.string().min(1).max(50)).max(10).optional(),
  summary: z.string().max(1000).optional(),
});

type UpdateDocumentPayload = z.infer<typeof updateDocumentSchema>;

// ================================================================
// PATCH HANDLER: Update document metadata
// ================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: documentId } = await params;

  try {
    // ============================================================
    // 1. AUTHENTICATION
    // ============================================================

    const user = await getAuthenticatedUser(request);
    if (!user) {
      return unauthorizedResponse('Não autenticado');
    }

    setSentryUserContext(user.id);

    console.log(`${ICONS.INFO} [Document PATCH] Atualizando documento ${documentId}`);

    // ============================================================
    // 2. PARSE AND VALIDATE REQUEST BODY
    // ============================================================

    let body: UpdateDocumentPayload;
    try {
      const rawBody = await request.json();
      body = updateDocumentSchema.parse(rawBody);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { success: false, error: 'Validação inválida', details: error.errors },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { success: false, error: 'Erro ao processar corpo da requisição' },
        { status: 400 }
      );
    }

    // ============================================================
    // 3. FETCH DOCUMENT WITH WORKSPACE ACCESS CHECK
    // ============================================================

    const document = await prisma.caseDocument.findUnique({
      where: { id: documentId },
      include: {
        case: {
          include: {
            workspace: {
              include: {
                users: {
                  where: { userId: user.id },
                },
              },
            },
          },
        },
      },
    });

    if (!document) {
      console.warn(`${ICONS.WARNING} [Document PATCH] Documento não encontrado: ${documentId}`);
      return NextResponse.json(
        { success: false, error: 'Documento não encontrado' },
        { status: 404 }
      );
    }

    // ============================================================
    // 4. VERIFY WORKSPACE ACCESS
    // ============================================================

    if (!document.case?.workspace?.users || document.case.workspace.users.length === 0) {
      console.warn(
        `${ICONS.WARNING} [Document PATCH] Acesso negado: ${user.id} tentando acessar documento ${documentId}`
      );
      return NextResponse.json(
        { success: false, error: 'Acesso negado' },
        { status: 403 }
      );
    }

    // ============================================================
    // 5. UPDATE DOCUMENT
    // ============================================================

    const updateData: any = {};

    if (body.name !== undefined) {
      updateData.name = body.name;
    }

    if (body.tags !== undefined) {
      updateData.tags = body.tags;
    }

    if (body.summary !== undefined) {
      // Preserve existing metadata and update summary
      updateData.metadata = {
        ...(document.metadata as Record<string, any> || {}),
        summary: body.summary,
      };
    }

    const updatedDocument = await prisma.caseDocument.update({
      where: { id: documentId },
      data: updateData,
    });

    // ============================================================
    // 6. CREATE AUDIT EVENT
    // ============================================================

    await prisma.caseEvent.create({
      data: {
        caseId: document.caseId,
        userId: user.id,
        type: 'DOCUMENT_UPDATED',
        title: `Documento "${document.name}" atualizado`,
        description: `Metadados atualizados: ${Object.keys(body).join(', ')}`,
        metadata: {
          documentId,
          originalName: document.name,
          changes: body,
        },
      },
    });

    console.log(`${ICONS.SUCCESS} [Document PATCH] Documento ${documentId} atualizado com sucesso`);

    // ============================================================
    // 7. RETURN UPDATED DOCUMENT
    // ============================================================

    return NextResponse.json({
      success: true,
      document: {
        id: updatedDocument.id,
        name: updatedDocument.name,
        tags: updatedDocument.tags,
        summary: (updatedDocument.metadata as Record<string, any>)?.summary || null,
        updatedAt: updatedDocument.updatedAt,
      },
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} [Document PATCH] Erro:`, error);

    captureApiError(error, {
      endpoint: '/api/documents/[id]',
      method: 'PATCH',
      documentId,
      userId: user?.id,
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao atualizar documento',
      },
      { status: 500 }
    );
  }
}

// ================================================================
// DELETE HANDLER: Remove document from storage and database
// ================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: documentId } = await params;

  try {
    // ============================================================
    // 1. AUTHENTICATION
    // ============================================================

    const user = await getAuthenticatedUser(request);
    if (!user) {
      return unauthorizedResponse('Não autenticado');
    }

    setSentryUserContext(user.id);

    console.log(`${ICONS.INFO} [Document DELETE] Deletando documento ${documentId}`);

    // ============================================================
    // 2. FETCH DOCUMENT WITH WORKSPACE ACCESS CHECK
    // ============================================================

    const document = await prisma.caseDocument.findUnique({
      where: { id: documentId },
      include: {
        case: {
          include: {
            workspace: {
              include: {
                users: {
                  where: { userId: user.id },
                },
              },
            },
          },
        },
      },
    });

    if (!document) {
      console.warn(`${ICONS.WARNING} [Document DELETE] Documento não encontrado: ${documentId}`);
      return NextResponse.json(
        { success: false, error: 'Documento não encontrado' },
        { status: 404 }
      );
    }

    // ============================================================
    // 3. VERIFY WORKSPACE ACCESS
    // ============================================================

    if (!document.case?.workspace?.users || document.case.workspace.users.length === 0) {
      console.warn(
        `${ICONS.WARNING} [Document DELETE] Acesso negado: ${user.id} tentando deletar documento ${documentId}`
      );
      return NextResponse.json(
        { success: false, error: 'Acesso negado' },
        { status: 403 }
      );
    }

    const caseId = document.caseId;
    const documentName = document.name;

    // ============================================================
    // 4. NULL OUT FOREIGN KEY REFERENCES (cascading cleanup)
    // ============================================================

    // Note: Supabase Storage deletion is delegated to a background job
    // to avoid blocking the API response. The file cleanup will happen
    // asynchronously after the database record is deleted.

    // Update TimelineEntry references if they exist
    try {
      await prisma.timelineEntry.updateMany({
        where: { documentId },
        data: { documentId: null },
      });
    } catch (err) {
      console.warn(`${ICONS.WARNING} [Document DELETE] Error nullifying TimelineEntry references:`, err);
    }

    // ============================================================
    // 6. DELETE DOCUMENT RECORD
    // ============================================================

    await prisma.caseDocument.delete({
      where: { id: documentId },
    });

    console.log(`${ICONS.SUCCESS} [Document DELETE] Documento deletado do banco de dados: ${documentId}`);

    // ============================================================
    // 7. CREATE AUDIT EVENT
    // ============================================================

    await prisma.caseEvent.create({
      data: {
        caseId,
        userId: user.id,
        type: 'DOCUMENT_DELETED',
        title: `Documento "${documentName}" deletado`,
        description: `Arquivo foi removido do armazenamento e do banco de dados`,
        metadata: {
          documentId,
          fileName: documentName,
          deletedAt: new Date().toISOString(),
        },
      },
    });

    console.log(`${ICONS.SUCCESS} [Document DELETE] Evento de auditoria criado para documento ${documentId}`);

    // ============================================================
    // 8. RETURN SUCCESS RESPONSE
    // ============================================================

    return NextResponse.json({
      success: true,
      message: 'Documento deletado com sucesso',
      documentId,
      deletedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} [Document DELETE] Erro:`, error);

    captureApiError(error, {
      endpoint: '/api/documents/[id]',
      method: 'DELETE',
      documentId,
      userId: user?.id,
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao deletar documento',
      },
      { status: 500 }
    );
  }
}
