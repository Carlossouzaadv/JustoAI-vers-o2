import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-utils';
import { ChatService } from '@/lib/chat-service';
import { z } from 'zod';

// Validation schemas
const createSessionSchema = z.object({
  title: z.string().optional(),
  contextType: z.string().optional(),
  contextId: z.string().optional(),
});

/**
 * POST /api/chat/sessions
 * Create a new chat session
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;

    // 2. Get workspace ID
    const workspaceId = request.headers.get('x-workspace-id');
    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace ID is required' },
        { status: 400 }
      );
    }

    // 3. Parse and validate request body
    const body = await request.json();
    const validated = createSessionSchema.parse(body);

    // 4. Create new session
    const session = await ChatService.createSession({
      workspaceId,
      userId: user.id,
      title: validated.title,
      contextType: validated.contextType,
      contextId: validated.contextId,
    });

    return NextResponse.json({
      success: true,
      data: session,
    });
  } catch (error) {
    if (_error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', issues: _error.issues },
        { status: 400 }
      );
    }

    console.error('Error creating chat session:', _error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/chat/sessions
 * List all active chat sessions for the user
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate user
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;

    // 2. Get workspace ID
    const workspaceId = request.headers.get('x-workspace-id');
    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace ID is required' },
        { status: 400 }
      );
    }

    // 3. Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);

    // 4. List sessions
    const sessions = await ChatService.listSessions(workspaceId, user.id, limit);

    return NextResponse.json({
      success: true,
      data: sessions,
      total: sessions.length,
    });
  } catch (error) {
    console.error('Error listing chat sessions:', _error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
