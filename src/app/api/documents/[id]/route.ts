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
import type { Prisma } from '@prisma/client';

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
// TYPE GUARDS & HELPERS (Padrão-Ouro - Type Safety)
// ================================================================

/**
 * Helper: Safely extracts error message from unknown error
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Type guard: Validates authenticated user exists and is not null
 */
function isAuthenticatedUser(user: unknown): user is { id: string } {
  return (
    typeof user === 'object' &&
    user !== null &&
    'id' in user &&
    typeof (user as { id: unknown }).id === 'string'
  );
}

// ================================================================
// PATCH HANDLER: Update document metadata
// ================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: documentId } = await params;
  let authenticatedUser: unknown; // Declare outside try for catch block access

  try {
    // ============================================================
    // 1. AUTHENTICATION
    // ============================================================

    authenticatedUser = await getAuthenticatedUser(request);
    if (!isAuthenticatedUser(authenticatedUser)) {
      return unauthorizedResponse('Não autenticado');
    }

    // Now authenticatedUser is narrowed to { id: string }
    const user = authenticatedUser;
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
          { success: false, error: 'Validação inválida', details: error.flatten() },
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

    // Build update data safely, only including fields that changed
    const updateInput: {
      name?: string;
      tags?: string[];
      metadata?: Prisma.InputJsonValue;
    } = {};

    if (body.name !== undefined) {
      updateInput.name = body.name;
    }

    if (body.tags !== undefined) {
      updateInput.tags = body.tags;
    }

    if (body.summary !== undefined) {
      // Preserve existing metadata and update summary
      // Safe type narrowing: convert to Record first, then to Prisma.InputJsonValue
      const existingMetadata = typeof document.metadata === 'object' && document.metadata !== null && !Array.isArray(document.metadata)
        ? document.metadata as Record<string, unknown>
        : {};

      updateInput.metadata = {
        ...existingMetadata,
        summary: body.summary,
      } as Prisma.InputJsonValue;
    }

    const updatedDocument = await prisma.caseDocument.update({
      where: { id: documentId },
      data: updateInput,
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
        summary: (updatedDocument.metadata as Record<string, unknown>)?.summary || null,
        updatedAt: updatedDocument.updatedAt,
      },
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} [Document PATCH] Erro:`, error);

    // Type-safe error handling: narrow user type before using
    let userId: string | undefined;
    if (isAuthenticatedUser(authenticatedUser)) {
      userId = authenticatedUser.id;
    }

    captureApiError(error, {
      endpoint: '/api/documents/[id]',
      method: 'PATCH',
      documentId,
      userId,
    });

    return NextResponse.json(
      {
        success: false,
        error: getErrorMessage(error),
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
  let authenticatedUser: unknown; // Declare outside try for catch block access

  try {
    // ============================================================
    // 1. AUTHENTICATION
    // ============================================================

    authenticatedUser = await getAuthenticatedUser(request);
    if (!isAuthenticatedUser(authenticatedUser)) {
      return unauthorizedResponse('Não autenticado');
    }

    // Now authenticatedUser is narrowed to { id: string }
    const user = authenticatedUser;
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
    // 4. CLEANUP TIMELINE ENTRIES
    // ============================================================
    // ProcessTimelineEntry has linkedDocumentIds as JSON array
    // Remove this document ID from all timeline entries that reference it

    const timelineEntries = await prisma.processTimelineEntry.findMany({
      where: {
        caseId,
        linkedDocumentIds: {
          hasSome: [documentId],
        },
      },
    });

    for (const entry of timelineEntries) {
      const linkedDocumentIds = Array.isArray(entry.linkedDocumentIds)
        ? entry.linkedDocumentIds.filter((id: string) => id !== documentId)
        : [];

      await prisma.processTimelineEntry.update({
        where: { id: entry.id },
        data: { linkedDocumentIds },
      });
    }

    // ============================================================
    // 5. CLEANUP DUPLICATE DOCUMENTS
    // ============================================================
    // If this document is the original, set originalDocumentId to null for duplicates
    // If this is a duplicate, no action needed (onDelete cascade handles it)

    if (document.id === document.originalDocumentId) {
      // This is the original document, nullify duplicates' reference
      await prisma.caseDocument.updateMany({
        where: {
          originalDocumentId: documentId,
          caseId,
        },
        data: {
          originalDocumentId: null,
          isDuplicate: false,
        },
      });
    }

    // ============================================================
    // 6. DELETE DOCUMENT RECORD
    // ============================================================
    // Cascade deletion will handle ImportedDataItem records

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

    // Type-safe error handling: narrow user type before using
    let userId: string | undefined;
    if (isAuthenticatedUser(authenticatedUser)) {
      userId = authenticatedUser.id;
    }

    captureApiError(error, {
      endpoint: '/api/documents/[id]',
      method: 'DELETE',
      documentId,
      userId,
    });

    return NextResponse.json(
      {
        success: false,
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
