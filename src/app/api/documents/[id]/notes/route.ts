// ================================================================
// API ROUTE: /api/documents/[id]/notes
// Endpoints: GET (fetch notes), POST (create note)
// ================================================================
// Document-level notes: annotations and observations on specific documents

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth-helper';
import { captureApiError, setSentryUserContext } from '@/lib/sentry-error-handler';
import { ICONS } from '@/lib/icons';

// ================================================================
// TYPES & VALIDATION SCHEMAS
// ================================================================

const createDocumentNoteSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(5000),
  tags: z.array(z.string()).max(10).optional(),
  priority: z.enum(['low', 'normal', 'high']).optional().default('normal'),
  isPinned: z.boolean().optional().default(false),
});

type CreateDocumentNotePayload = z.infer<typeof createDocumentNoteSchema>;

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
 * Verifies user has access to a document's workspace via its case.
 * SAFE: Uses separate query with proper narrowing.
 */
async function verifyUserDocumentAccess(
  documentId: string,
  userId: string
): Promise<boolean> {
  // Find the case that contains this document and verify user has access to it
  const access = await prisma.userWorkspace.findFirst({
    where: {
      userId,
      workspace: {
        cases: {
          some: {
            documents: {
              some: {
                id: documentId,
              },
            },
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
  const { id: documentId } = await params;
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

    console.log(`${ICONS.INFO} [Document Notes GET] Buscando notas do documento ${documentId}`);

    // ============================================================
    // 2. VERIFY DOCUMENT EXISTS AND USER HAS ACCESS
    // ============================================================

    const documentExists = await prisma.caseDocument.findUnique({
      where: { id: documentId },
      select: { id: true, caseId: true },
    });

    if (!documentExists) {
      return NextResponse.json(
        { success: false, error: 'Documento não encontrado' },
        { status: 404 }
      );
    }

    const hasAccess = await verifyUserDocumentAccess(documentId, userId);
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

    console.log(`${ICONS.INFO} [Document Notes GET] Pagination: page=${page}, limit=${limit}, sort=${sort}`);

    // ============================================================
    // 4. FETCH NOTES FROM CASE_EVENTS TABLE (Document-specific)
    // ============================================================

    const [notes, total] = await Promise.all([
      prisma.caseEvent.findMany({
        where: {
          // Link to document via metadata
          type: 'NOTE',
          metadata: {
            path: ['documentId'],
            equals: documentId,
          },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.caseEvent.count({
        where: {
          type: 'NOTE',
          metadata: {
            path: ['documentId'],
            equals: documentId,
          },
        },
      }),
    ]);

    // ============================================================
    // 5. FORMAT AND RETURN RESPONSE
    // ============================================================

    const formattedNotes = notes.map(formatNoteFromEvent);

    console.log(`${ICONS.SUCCESS} [Document Notes GET] Retornando ${notes.length} notas de ${total} total`);

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
    console.error(`${ICONS.ERROR} [Document Notes GET] Erro:`, error);

    captureApiError(error, {
      endpoint: '/api/documents/[id]/notes',
      method: 'GET',
      documentId,
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
  const { id: documentId } = await params;
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

    console.log(`${ICONS.INFO} [Document Notes POST] Criando nota para documento ${documentId}`);

    // ============================================================
    // 2. PARSE AND VALIDATE REQUEST BODY
    // ============================================================

    let body: CreateDocumentNotePayload;
    try {
      const rawBody = await request.json();
      body = createDocumentNoteSchema.parse(rawBody);
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
    // 3. VERIFY DOCUMENT EXISTS AND USER HAS ACCESS
    // ============================================================

    const documentExists = await prisma.caseDocument.findUnique({
      where: { id: documentId },
      select: { id: true, caseId: true },
    });

    if (!documentExists) {
      return NextResponse.json(
        { success: false, error: 'Documento não encontrado' },
        { status: 404 }
      );
    }

    const hasAccess = await verifyUserDocumentAccess(documentId, userId);
    if (!hasAccess) {
      console.warn(`${ICONS.WARNING} [Document Notes POST] Acesso negado para usuário ${userId} ao documento ${documentId}`);
      return NextResponse.json(
        { success: false, error: 'Acesso negado' },
        { status: 403 }
      );
    }

    // ============================================================
    // 4. CREATE NOTE AS CASE EVENT (Document-specific)
    // ============================================================

    const noteMetadata: {
      documentId: string;
      title?: string;
      tags: string[];
      priority: 'low' | 'normal' | 'high';
      isPinned: boolean;
    } = {
      documentId,
      title: body.title,
      tags: body.tags || [],
      priority: body.priority || 'normal',
      isPinned: body.isPinned || false,
    };

    // Create note associated with the document's case
    const note = await prisma.caseEvent.create({
      data: {
        caseId: documentExists.caseId,
        userId,
        type: 'NOTE',
        title: body.title || 'Observação sem título',
        description: body.description,
        metadata: noteMetadata,
      },
    });

    console.log(`${ICONS.SUCCESS} [Document Notes POST] Nota criada com sucesso: ${note.id}`);

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
    console.error(`${ICONS.ERROR} [Document Notes POST] Erro:`, error);

    captureApiError(error, {
      endpoint: '/api/documents/[id]/notes',
      method: 'POST',
      documentId,
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
