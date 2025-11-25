import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-utils';
import { ChatService } from '@/lib/chat-service';
import { z } from 'zod';

// Validation schemas
const actionSchema = z.object({
  action: z.enum(['archive', 'delete']),
});

/**
 * GET /api/chat/sessions/[sessionId]
 * Get a specific chat session with all its messages
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    // 1. Authenticate user
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;

    const { sessionId } = await params;

    // 2. Get session
    const session = await ChatService.getSession(sessionId, user.id);

    return NextResponse.json({
      success: true,
      data: session,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Chat session not found') {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    console.error('Error fetching chat session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/chat/sessions/[sessionId]
 * Archive or delete a chat session
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    // 1. Authenticate user
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;

    const { sessionId } = await params;

    // 2. Parse and validate request body
    const body = await request.json();
    const validated = actionSchema.parse(body);

    // 3. Perform action
    let session;
    if (validated.action === 'archive') {
      session = await ChatService.archiveSession(sessionId, user.id);
    } else if (validated.action === 'delete') {
      session = await ChatService.deleteSession(sessionId, user.id);
    }

    return NextResponse.json({
      success: true,
      data: session,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', issues: error.issues },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === 'Chat session not found') {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    console.error('Error updating chat session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/chat/sessions/[sessionId]
 * Delete a chat session
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    // 1. Authenticate user
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;

    const { sessionId } = await params;

    // 2. Delete session
    const session = await ChatService.deleteSession(sessionId, user.id);

    return NextResponse.json({
      success: true,
      message: 'Session deleted',
      data: session,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Chat session not found') {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    console.error('Error deleting chat session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
