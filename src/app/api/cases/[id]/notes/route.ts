// ================================================================
// API ROUTE: /api/cases/[id]/notes
// Endpoints: GET (fetch notes), POST (create note)
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

const createNoteSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(5000),
  tags: z.array(z.string()).max(10).optional(),
  priority: z.enum(['low', 'normal', 'high']).optional().default('normal'),
  isPinned: z.boolean().optional().default(false),
});

type CreateNotePayload = z.infer<typeof createNoteSchema>;

// ================================================================
// GET HANDLER: Fetch notes with pagination
// ================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: caseId } = await params;

  try {
    // ============================================================
    // 1. AUTHENTICATION
    // ============================================================

    const user = await getAuthenticatedUser(request);
    if (!user) {
      return unauthorizedResponse('Não autenticado');
    }

    setSentryUserContext(user.id);

    console.log(`${ICONS.INFO} [Case Notes GET] Buscando notas do case ${caseId}`);

    // ============================================================
    // 2. VERIFY CASE EXISTS AND USER HAS ACCESS
    // ============================================================

    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
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

    if (!caseData) {
      return NextResponse.json(
        { success: false, error: 'Case não encontrado' },
        { status: 404 }
      );
    }

    if (!caseData.workspace?.users || caseData.workspace.users.length === 0) {
      console.warn(`${ICONS.WARNING} [Case Notes GET] Acesso negado para usuário ${user.id} ao case ${caseId}`);
      return NextResponse.json(
        { success: false, error: 'Acesso negado' },
        { status: 403 }
      );
    }

    // ============================================================
    // 3. PARSE PAGINATION PARAMETERS
    // ============================================================

    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
    const sort = url.searchParams.get('sort') || 'newest'; // 'newest', 'oldest', 'pinned'

    console.log(`${ICONS.INFO} [Case Notes GET] Pagination: page=${page}, limit=${limit}, sort=${sort}`);

    // ============================================================
    // 4. FETCH NOTES FROM CASE_EVENTS TABLE
    // ============================================================

    const [notes, total] = await Promise.all([
      prisma.caseEvent.findMany({
        where: {
          caseId,
          type: 'NOTE',
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
        orderBy:
          sort === 'pinned'
            ? [{ metadata: { sort: 'desc' } }, { createdAt: 'desc' }]
            : { createdAt: sort === 'oldest' ? 'asc' : 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.caseEvent.count({
        where: { caseId, type: 'NOTE' },
      }),
    ]);

    // ============================================================
    // 5. FORMAT AND RETURN RESPONSE
    // ============================================================

    const formattedNotes = notes.map((note) => ({
      id: note.id,
      title: (note.metadata as Record<string, unknown>)?.title || 'Sem título',
      description: note.description,
      author: {
        id: note.user.id,
        email: note.user.email,
        name: note.user.name,
      },
      tags: (note.metadata as Record<string, unknown>)?.tags || [],
      priority: (note.metadata as Record<string, unknown>)?.priority || 'normal',
      isPinned: (note.metadata as Record<string, unknown>)?.isPinned || false,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    }));

    console.log(`${ICONS.SUCCESS} [Case Notes GET] Retornando ${notes.length} notas de ${total} total`);

    return NextResponse.json({
      success: true,
      notes: formattedNotes,
      pagination: {
        page,
        limit,
        total,
        hasMore: page * limit < total,
      },
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} [Case Notes GET] Erro:`, error);

    captureApiError(error, {
      endpoint: '/api/cases/[id]/notes',
      method: 'GET',
      caseId,
      userId: user?.id,
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao buscar notas',
      },
      { status: 500 }
    );
  }
}

// ================================================================
// POST HANDLER: Create a new note
// ================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: caseId } = await params;

  try {
    // ============================================================
    // 1. AUTHENTICATION
    // ============================================================

    const user = await getAuthenticatedUser(request);
    if (!user) {
      return unauthorizedResponse('Não autenticado');
    }

    setSentryUserContext(user.id);

    console.log(`${ICONS.INFO} [Case Notes POST] Criando nota para case ${caseId}`);

    // ============================================================
    // 2. PARSE AND VALIDATE REQUEST BODY
    // ============================================================

    let body: CreateNotePayload;
    try {
      const rawBody = await request.json();
      body = createNoteSchema.parse(rawBody);
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
    // 3. VERIFY CASE EXISTS AND USER HAS ACCESS
    // ============================================================

    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
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

    if (!caseData) {
      return NextResponse.json(
        { success: false, error: 'Case não encontrado' },
        { status: 404 }
      );
    }

    if (!caseData.workspace?.users || caseData.workspace.users.length === 0) {
      console.warn(`${ICONS.WARNING} [Case Notes POST] Acesso negado para usuário ${user.id} ao case ${caseId}`);
      return NextResponse.json(
        { success: false, error: 'Acesso negado' },
        { status: 403 }
      );
    }

    // ============================================================
    // 4. CREATE NOTE AS CASE EVENT
    // ============================================================

    const note = await prisma.caseEvent.create({
      data: {
        caseId,
        userId: user.id,
        type: 'NOTE',
        title: body.title || 'Nota sem título',
        description: body.description,
        metadata: {
          title: body.title,
          tags: body.tags || [],
          priority: body.priority || 'normal',
          isPinned: body.isPinned || false,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    console.log(`${ICONS.SUCCESS} [Case Notes POST] Nota criada com sucesso: ${note.id}`);

    // ============================================================
    // 5. RETURN CREATED NOTE
    // ============================================================

    return NextResponse.json(
      {
        success: true,
        note: {
          id: note.id,
          title: (note.metadata as Record<string, unknown>)?.title || 'Sem título',
          description: note.description,
          author: {
            id: note.user.id,
            email: note.user.email,
            name: note.user.name,
          },
          tags: (note.metadata as Record<string, unknown>)?.tags || [],
          priority: (note.metadata as Record<string, unknown>)?.priority || 'normal',
          isPinned: (note.metadata as Record<string, unknown>)?.isPinned || false,
          createdAt: note.createdAt,
          updatedAt: note.updatedAt,
        },
      },
      { status: 201 }
    );

  } catch (error) {
    console.error(`${ICONS.ERROR} [Case Notes POST] Erro:`, error);

    captureApiError(error, {
      endpoint: '/api/cases/[id]/notes',
      method: 'POST',
      caseId,
      userId: user?.id,
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao criar nota',
      },
      { status: 500 }
    );
  }
}
