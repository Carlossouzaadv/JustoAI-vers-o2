// ================================================================
// API ROUTE: /api/cases/[id]/notes/[noteId]
// Endpoints: PATCH (update note), DELETE (remove note)
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth-helper';
import { captureApiError, setSentryUserContext } from '@/lib/sentry-error-handler';
import { ICONS } from '@/lib/icons';
import type { UserWorkspaceRecord } from '@/lib/types/database';

// ================================================================
// TYPE DEFINITIONS & VALIDATION SCHEMAS
// ================================================================

/**
 * Type guard to validate Note metadata structure
 * Ensures metadata has the expected shape: { title?, tags?, priority?, isPinned? }
 */
type NoteMetadata = {
  title?: string;
  tags?: string[];
  priority?: string;
  isPinned?: boolean;
};

/**
 * Type guard predicate for validating note metadata
 */
function isValidNoteMetadata(metadata: unknown): metadata is NoteMetadata {
  if (metadata === null || metadata === undefined) {
    return true; // null/undefined is valid (empty metadata)
  }
  if (typeof metadata !== 'object') {
    return false;
  }
  // Check optional fields have correct types
  const meta = metadata as Record<string, unknown>;
  return (
    (meta.title === undefined || typeof meta.title === 'string') &&
    (meta.tags === undefined || Array.isArray(meta.tags)) &&
    (meta.priority === undefined || typeof meta.priority === 'string') &&
    (meta.isPinned === undefined || typeof meta.isPinned === 'boolean')
  );
}

const updateNoteSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(5000).optional(),
  tags: z.array(z.string()).max(10).optional(),
  priority: z.enum(['low', 'normal', 'high']).optional(),
  isPinned: z.boolean().optional(),
});

type UpdateNotePayload = z.infer<typeof updateNoteSchema>;

// ================================================================
// PATCH HANDLER: Update a note (author or admin only)
// ================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const { id: caseId, noteId } = await params;
  let userId: string | undefined;

  try {
    // ============================================================
    // 1. AUTHENTICATION
    // ============================================================

    const user = await getAuthenticatedUser(request);
    if (!user) {
      return unauthorizedResponse('Não autenticado');
    }

    userId = user.id;
    setSentryUserContext(userId);

    console.log(`${ICONS.INFO} [Case Notes PATCH] Atualizando nota ${noteId} do case ${caseId}`);

    // ============================================================
    // 2. PARSE AND VALIDATE REQUEST BODY
    // ============================================================

    let body: UpdateNotePayload;
    try {
      const rawBody = await request.json();
      body = updateNoteSchema.parse(rawBody);
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
    // 3. FETCH NOTE AND VERIFY OWNERSHIP/ACCESS
    // ============================================================

    const note = await prisma.caseEvent.findUnique({
      where: { id: noteId },
      include: {
        case: {
          include: {
            workspace: {
              include: {
                users: true,
              },
            },
          },
        },
      },
    });

    if (!note) {
      console.warn(`${ICONS.WARNING} [Case Notes PATCH] Nota não encontrada: ${noteId}`);
      return NextResponse.json(
        { success: false, error: 'Nota não encontrada' },
        { status: 404 }
      );
    }

    // Verify note belongs to the correct case
    if (note.caseId !== caseId) {
      console.warn(
        `${ICONS.WARNING} [Case Notes PATCH] Nota ${noteId} não pertence ao case ${caseId}`
      );
      return NextResponse.json(
        { success: false, error: 'Nota não encontrada neste case' },
        { status: 404 }
      );
    }

    // Verify note is actually a note (type='NOTE')
    if (note.type !== 'NOTE') {
      return NextResponse.json(
        { success: false, error: 'Este evento não é uma nota' },
        { status: 400 }
      );
    }

    // ============================================================
    // 4. VERIFY WORKSPACE ACCESS
    // ============================================================

    const hasWorkspaceAccess = note.case?.workspace?.users?.some(
      (userWorkspace: UserWorkspaceRecord) => userWorkspace.userId === userId
    );

    if (!hasWorkspaceAccess) {
      console.warn(
        `${ICONS.WARNING} [Case Notes PATCH] Acesso negado para usuário ${userId} ao case ${caseId}`
      );
      return NextResponse.json(
        { success: false, error: 'Acesso negado' },
        { status: 403 }
      );
    }

    // ============================================================
    // 5. VERIFY OWNERSHIP (author or admin can edit)
    // ============================================================

    const isAuthor = note.userId === userId;

    if (!isAuthor) {
      console.warn(
        `${ICONS.WARNING} [Case Notes PATCH] Usuário ${userId} não é autor da nota ${noteId}`
      );
      return NextResponse.json(
        { success: false, error: 'Apenas o autor da nota pode editá-la' },
        { status: 403 }
      );
    }

    // ============================================================
    // 6. UPDATE NOTE
    // ============================================================

    // Validate existing metadata safely using type guard
    if (!isValidNoteMetadata(note.metadata)) {
      console.warn(
        `${ICONS.WARNING} [Case Notes PATCH] Metadados inválidos na nota ${noteId}`
      );
      return NextResponse.json(
        { success: false, error: 'Erro ao processar metadados da nota' },
        { status: 500 }
      );
    }

    const updateData: { title?: string; description?: string; metadata?: NoteMetadata } = {};

    if (body.title !== undefined) {
      updateData.title = body.title;
    }

    if (body.description !== undefined) {
      updateData.description = body.description;
    }

    if (
      body.tags !== undefined ||
      body.priority !== undefined ||
      body.isPinned !== undefined
    ) {
      // Preserve existing metadata and update only specified fields
      const existingMetadata = note.metadata;

      updateData.metadata = {
        title: body.title !== undefined ? body.title : existingMetadata?.title,
        tags: body.tags !== undefined ? body.tags : existingMetadata?.tags,
        priority: body.priority !== undefined ? body.priority : existingMetadata?.priority,
        isPinned: body.isPinned !== undefined ? body.isPinned : existingMetadata?.isPinned,
      };
    }

    const updatedNote = await prisma.caseEvent.update({
      where: { id: noteId },
      data: updateData,
    });

    console.log(`${ICONS.SUCCESS} [Case Notes PATCH] Nota ${noteId} atualizada com sucesso`);

    // ============================================================
    // 7. RETURN UPDATED NOTE
    // ============================================================

    // Validate response metadata safely
    if (!isValidNoteMetadata(updatedNote.metadata)) {
      console.warn(
        `${ICONS.WARNING} [Case Notes PATCH] Metadados inválidos após atualização: ${noteId}`
      );
      return NextResponse.json(
        { success: false, error: 'Erro ao processar resposta' },
        { status: 500 }
      );
    }

    const responseMetadata = updatedNote.metadata;

    return NextResponse.json({
      success: true,
      note: {
        id: updatedNote.id,
        title: responseMetadata?.title || 'Sem título',
        description: updatedNote.description,
        tags: responseMetadata?.tags || [],
        priority: responseMetadata?.priority || 'normal',
        isPinned: responseMetadata?.isPinned || false,
        createdAt: updatedNote.createdAt,
      },
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} [Case Notes PATCH] Erro:`, error);

    captureApiError(error, {
      endpoint: '/api/cases/[id]/notes/[noteId]',
      method: 'PATCH',
      caseId,
      noteId,
      userId,
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao atualizar nota',
      },
      { status: 500 }
    );
  }
}

// ================================================================
// DELETE HANDLER: Delete a note (author or admin only)
// ================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const { id: caseId, noteId } = await params;
  let userId: string | undefined;

  try {
    // ============================================================
    // 1. AUTHENTICATION
    // ============================================================

    const user = await getAuthenticatedUser(request);
    if (!user) {
      return unauthorizedResponse('Não autenticado');
    }

    userId = user.id;
    setSentryUserContext(userId);

    console.log(`${ICONS.INFO} [Case Notes DELETE] Deletando nota ${noteId} do case ${caseId}`);

    // ============================================================
    // 2. FETCH NOTE AND VERIFY OWNERSHIP/ACCESS
    // ============================================================

    const note = await prisma.caseEvent.findUnique({
      where: { id: noteId },
      include: {
        case: {
          include: {
            workspace: {
              include: {
                users: true,
              },
            },
          },
        },
      },
    });

    if (!note) {
      console.warn(`${ICONS.WARNING} [Case Notes DELETE] Nota não encontrada: ${noteId}`);
      return NextResponse.json(
        { success: false, error: 'Nota não encontrada' },
        { status: 404 }
      );
    }

    // Verify note belongs to the correct case
    if (note.caseId !== caseId) {
      console.warn(
        `${ICONS.WARNING} [Case Notes DELETE] Nota ${noteId} não pertence ao case ${caseId}`
      );
      return NextResponse.json(
        { success: false, error: 'Nota não encontrada neste case' },
        { status: 404 }
      );
    }

    // Verify note is actually a note (type='NOTE')
    if (note.type !== 'NOTE') {
      return NextResponse.json(
        { success: false, error: 'Este evento não é uma nota' },
        { status: 400 }
      );
    }

    // ============================================================
    // 3. VERIFY WORKSPACE ACCESS
    // ============================================================

    const hasWorkspaceAccess = note.case?.workspace?.users?.some(
      (userWorkspace: UserWorkspaceRecord) => userWorkspace.userId === userId
    );

    if (!hasWorkspaceAccess) {
      console.warn(
        `${ICONS.WARNING} [Case Notes DELETE] Acesso negado para usuário ${userId} ao case ${caseId}`
      );
      return NextResponse.json(
        { success: false, error: 'Acesso negado' },
        { status: 403 }
      );
    }

    // ============================================================
    // 4. VERIFY OWNERSHIP (author or admin can delete)
    // ============================================================

    const isAuthor = note.userId === userId;

    if (!isAuthor) {
      console.warn(
        `${ICONS.WARNING} [Case Notes DELETE] Usuário ${userId} não é autor da nota ${noteId}`
      );
      return NextResponse.json(
        { success: false, error: 'Apenas o autor da nota pode deletá-la' },
        { status: 403 }
      );
    }

    // ============================================================
    // 5. DELETE NOTE
    // ============================================================

    await prisma.caseEvent.delete({
      where: { id: noteId },
    });

    console.log(`${ICONS.SUCCESS} [Case Notes DELETE] Nota ${noteId} deletada com sucesso`);

    // ============================================================
    // 6. RETURN SUCCESS RESPONSE
    // ============================================================

    return NextResponse.json({
      success: true,
      message: 'Nota deletada com sucesso',
      noteId,
      deletedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} [Case Notes DELETE] Erro:`, error);

    captureApiError(error, {
      endpoint: '/api/cases/[id]/notes/[noteId]',
      method: 'DELETE',
      caseId,
      noteId,
      userId,
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao deletar nota',
      },
      { status: 500 }
    );
  }
}
