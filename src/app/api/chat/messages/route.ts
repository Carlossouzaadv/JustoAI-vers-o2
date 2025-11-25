import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-utils';
import { ChatService } from '@/lib/chat-service';
import { z } from 'zod';

// Validation schema for message
const sendMessageSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  content: z.string().min(1, 'Message content is required').max(10000),
});

type SendMessageRequest = z.infer<typeof sendMessageSchema>;

/**
 * POST /api/chat/messages
 * Send a message to an AI chat session and stream the response
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;

    // 2. Parse and validate request body
    const body = await request.json();
    const validated = sendMessageSchema.parse(body);

    // 3. Get user's workspace (simplified - in production get actual workspace)
    // For now, use the workspace from request header or default
    const workspaceId = request.headers.get('x-workspace-id');
    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace ID is required' },
        { status: 400 }
      );
    }

    // 4. Send message and stream response
    const responseStream = await ChatService.sendMessage({
      sessionId: validated.sessionId,
      workspaceId,
      userId: user.id,
      content: validated.content,
    });

    // 5. Create streaming response
    return new NextResponse(
      new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of responseStream) {
              controller.enqueue(new TextEncoder().encode(chunk));
            }
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        },
      }),
      {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', issues: error.issues },
        { status: 400 }
      );
    }

    console.error('Error in chat endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
