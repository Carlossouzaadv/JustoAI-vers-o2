import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { getGeminiClient } from './gemini-client';
import { getErrorMessage } from './error-handling';
import { log, logError } from '@/lib/services/logger';

interface CreateSessionParams {
  workspaceId: string;
  userId: string;
  title?: string;
  contextType?: string;
  contextId?: string;
}

interface SendMessageParams {
  sessionId: string;
  workspaceId: string;
  userId: string;
  content: string;
  contextType?: string;
  contextId?: string;
}

interface ChatResponse {
  sessionId: string;
  userMessage: {
    id: string;
    content: string;
    createdAt: Date;
  };
  assistantMessage: {
    id: string;
    content: string;
    tokens?: number;
    cost?: number;
    createdAt: Date;
  };
}

/**
 * Chat service for managing AI conversations
 * Integrates with Gemini API for intelligent responses
 */
export class ChatService {
  /**
   * Create a new chat session
   */
  static async createSession(params: CreateSessionParams) {
    const { workspaceId, userId, title, contextType, contextId } = params;

    const session = await prisma.chatSession.create({
      data: {
        workspaceId,
        userId,
        title: title || `Chat ${new Date().toLocaleDateString('pt-BR')}`,
        contextType,
        contextId,
        status: 'active',
      },
    });

    return session;
  }

  /**
   * Get a chat session with its messages
   */
  static async getSession(sessionId: string, userId: string) {
    const session = await prisma.chatSession.findFirst({
      where: {
        id: sessionId,
        userId,
        status: 'active',
      },
      include: {
        messages: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!session) {
      throw new Error('Chat session not found');
    }

    return session;
  }

  /**
   * List user's chat sessions
   */
  static async listSessions(workspaceId: string, userId: string, limit = 20) {
    const sessions = await prisma.chatSession.findMany({
      where: {
        workspaceId,
        userId,
        status: 'active',
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: limit,
      include: {
        _count: {
          select: { messages: true },
        },
      },
    });

    return sessions;
  }

  /**
   * Send a message and get AI response
   * Streams response and stores both user and assistant messages
   */
  static async sendMessage(params: SendMessageParams): Promise<AsyncIterable<string>> {
    const { sessionId, workspaceId, userId, content } = params;

    // Verify session exists and belongs to user
    const session = await prisma.chatSession.findFirst({
      where: {
        id: sessionId,
        userId,
        workspaceId,
        status: 'active',
      },
      include: {
        messages: {
          orderBy: {
            createdAt: 'asc',
          },
          select: {
            role: true,
            content: true,
          },
        },
      },
    });

    if (!session) {
      throw new Error('Chat session not found');
    }

    // Store user message
    const userMessage = await prisma.chatMessage.create({
      data: {
        sessionId,
        role: 'user',
        content,
      },
    });

    // Build conversation history as text prompt for context
    const conversationText = session.messages
      .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n\n');

    // Create final prompt with context
    const fullPrompt = conversationText
      ? `Previous conversation:\n${conversationText}\n\nUser: ${content}`
      : `User: ${content}`;

    // Get AI response from Gemini
    let assistantMessageId = '';
    let tokenCount = 0;
    let cost = 0;

    try {
      // Create placeholder for assistant message that we'll update after streaming
      const placeholderMessage = await prisma.chatMessage.create({
        data: {
          sessionId,
          role: 'assistant',
          content: '', // Will be updated after streaming
        },
      });

      assistantMessageId = placeholderMessage.id;

      // Get Gemini client and use streaming to get response
      const geminiClient = getGeminiClient();
      const streamPromise = geminiClient.generateContentStream(fullPrompt);

      // Build response and track tokens
      let fullResponse = '';

      return (async function* () {
        try {
          const stream = await streamPromise;
          for await (const chunk of stream) {
            fullResponse += chunk;
            yield chunk;
          }
        } finally {
          // After streaming is complete, save the full message and get token counts
          try {
            // Get token count for cost estimation (rough approximation)
            // Gemini API's token count is available via generateContent
            tokenCount = Math.ceil(
              (content.length + fullResponse.length) / 4 // Rough estimate: ~4 chars per token
            );

            // Estimate cost based on token count
            // Using BALANCED model default pricing: 0.075 per 1M input, 0.3 per 1M output tokens
            const inputCost = (content.length / 4) * (0.075 / 1000000);
            const outputCost = (fullResponse.length / 4) * (0.3 / 1000000);
            cost = inputCost + outputCost;

            // Update assistant message with full response and metrics
            await prisma.chatMessage.update({
              where: { id: assistantMessageId },
              data: {
                content: fullResponse,
                tokens: tokenCount,
                cost: new Prisma.Decimal(cost.toFixed(4)),
                modelUsed: 'gemini-2.5-flash',
              },
            });

            // Update session's updatedAt
            await prisma.chatSession.update({
              where: { id: sessionId },
              data: { updatedAt: new Date() },
            });
          } catch (updateError) {
            console.error('Error updating assistant message:', getErrorMessage(updateError));
          }
        }
      })();
    } catch (_error) {
      // Clean up on error
      try {
        await prisma.chatMessage.delete({
          where: { id: assistantMessageId },
        });
      } catch (deleteError) {
        console.error('Error deleting placeholder message:', getErrorMessage(deleteError));
      }

      throw new Error(`Failed to get AI response: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Delete a chat session (soft delete)
   */
  static async deleteSession(sessionId: string, userId: string) {
    const session = await prisma.chatSession.findFirst({
      where: {
        id: sessionId,
        userId,
      },
    });

    if (!session) {
      throw new Error('Chat session not found');
    }

    return await prisma.chatSession.update({
      where: { id: sessionId },
      data: { status: 'deleted' },
    });
  }

  /**
   * Archive a chat session
   */
  static async archiveSession(sessionId: string, userId: string) {
    const session = await prisma.chatSession.findFirst({
      where: {
        id: sessionId,
        userId,
      },
    });

    if (!session) {
      throw new Error('Chat session not found');
    }

    return await prisma.chatSession.update({
      where: { id: sessionId },
      data: { status: 'archived' },
    });
  }
}
