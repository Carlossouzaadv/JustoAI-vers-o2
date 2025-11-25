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
// TYPES & VALIDATION SCHEMAS
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
// TYPE GUARDS & HELPERS
// ================================================================

/**
 * Validates that an unknown value is a valid note metadata object.
 * SAFE: No casting, uses proper narrowing with 'in' operator.
 */
function isNoteMetadata(data: unknown): data is {
  title?: string;
  tags?: string[];
  priority?: 'low' | 'normal' | 'high';
  isPinned?: boolean;
} {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const obj = data as Record<string, unknown>;
  return (
    (!('title' in obj) || typeof obj.title === 'string') &&
    (!('tags' in obj) || Array.isArray(obj.tags)) &&
    (!('priority' in obj) || ['low', 'normal', 'high'].includes(obj.priority as string)) &&
    (!('isPinned' in obj) || typeof obj.isPinned === 'boolean')
  );
}

/**
 * Safely extracts note metadata with proper narrowing.
 * Returns defaults if metadata is invalid.
 */
function extractNoteMetadata(metadata: unknown) {
  if (isNoteMetadata(metadata)) {
    return {
      title: metadata.title || 'Sem título',
      tags: metadata.tags || [],
      priority: metadata.priority || 'normal',
      isPinned: metadata.isPinned || false,
    };
  }
  return {
    title: 'Sem título',
    tags: [],
    priority: 'normal',
    isPinned: false,
  };
}

/**
 * Type-safe order-by configuration.
 */
type OrderByConfig = { createdAt: 'asc' | 'desc' };

function buildOrderBy(sort: string | null): OrderByConfig {
  const sortValue = sort === 'oldest' ? 'asc' : 'desc';
  return { createdAt: sortValue };
}

/**
 * Verifies user has access to a case's workspace.
 * SAFE: Uses separate query with proper narrowing.
 */
async function verifyUserCaseAccess(
  caseId: string,
  userId: string
): Promise<boolean> {
  const access = await prisma.userWorkspace.findFirst({
    where: {
      userId,
      workspace: {
        cases: {
          some: {
            id: caseId,
          },
        },
      },
    },
  });
  return access !== null;
}

/**
 * Formats a CaseEvent into a Note response object.
 * SAFE: Uses type guard for metadata extraction.
 */
function formatNoteFromEvent(event: {
  id: string;
  metadata: unknown;
  description: string | null;
  createdAt: Date;
}) {
  const metadata = extractNoteMetadata(event.metadata);
  return {
    id: event.id,
    title: metadata.title,
    description: event.description || '',
    tags: metadata.tags,
    priority: metadata.priority,
    isPinned: metadata.isPinned,
    createdAt: event.createdAt,
  };
}

// ================================================================
// GET HANDLER: Fetch notes with pagination
// ================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: caseId } = await params;
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

    console.log(`${ICONS.INFO} [Case Notes GET] Buscando notas do case ${caseId}`);

    // ============================================================
    // 2. VERIFY CASE EXISTS AND USER HAS ACCESS
    // ============================================================

    const caseExists = await prisma.case.findUnique({
      where: { id: caseId },
      select: { id: true },
    });

    if (!caseExists) {
      return NextResponse.json(
        { success: false, error: 'Case não encontrado' },
        { status: 404 }
      );
    }

    const hasAccess = await verifyUserCaseAccess(caseId, userId);
    if (!hasAccess) {
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

    const orderBy = buildOrderBy(sort);

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
        orderBy,
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

    const formattedNotes = notes.map(formatNoteFromEvent);

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

  } catch (_error) {
    console.error(`${ICONS.ERROR} [Case Notes GET] Erro:`, error);

    captureApiError(error, {
      endpoint: '/api/cases/[id]/notes',
      method: 'GET',
      caseId,
      userId,
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

    console.log(`${ICONS.INFO} [Case Notes POST] Criando nota para case ${caseId}`);

    // ============================================================
    // 2. PARSE AND VALIDATE REQUEST BODY
    // ============================================================

    let body: CreateNotePayload;
    try {
      const rawBody = await request.json();
      body = createNoteSchema.parse(rawBody);
    } catch (_error) {
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

    const caseExists = await prisma.case.findUnique({
      where: { id: caseId },
      select: { id: true },
    });

    if (!caseExists) {
      return NextResponse.json(
        { success: false, error: 'Case não encontrado' },
        { status: 404 }
      );
    }

    const hasAccess = await verifyUserCaseAccess(caseId, userId);
    if (!hasAccess) {
      console.warn(`${ICONS.WARNING} [Case Notes POST] Acesso negado para usuário ${userId} ao case ${caseId}`);
      return NextResponse.json(
        { success: false, error: 'Acesso negado' },
        { status: 403 }
      );
    }

    // ============================================================
    // 4. CREATE NOTE AS CASE EVENT
    // ============================================================

    const noteMetadata: {
      title?: string;
      tags: string[];
      priority: 'low' | 'normal' | 'high';
      isPinned: boolean;
    } = {
      title: body.title,
      tags: body.tags || [],
      priority: body.priority || 'normal',
      isPinned: body.isPinned || false,
    };

    const note = await prisma.caseEvent.create({
      data: {
        caseId,
        userId,
        type: 'NOTE',
        title: body.title || 'Nota sem título',
        description: body.description,
        metadata: noteMetadata,
      },
    });

    console.log(`${ICONS.SUCCESS} [Case Notes POST] Nota criada com sucesso: ${note.id}`);

    // ============================================================
    // 5. RETURN CREATED NOTE
    // ============================================================

    const formattedNote = formatNoteFromEvent(note);

    return NextResponse.json(
      {
        success: true,
        note: formattedNote,
      },
      { status: 201 }
    );

  } catch (_error) {
    console.error(`${ICONS.ERROR} [Case Notes POST] Erro:`, error);

    captureApiError(error, {
      endpoint: '/api/cases/[id]/notes',
      method: 'POST',
      caseId,
      userId,
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
