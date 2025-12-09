// ================================================================
// SSE ENDPOINT - Server-Sent Events para Real-Time Updates
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { validateAuthAndGetUser } from '../../../../lib/auth';
import { getWebSocketManager, generateConnectionId } from '../../../../lib/websocket-manager';
import { ICONS } from '../../../../lib/icons';

/**
 * Type Guard: Validates if an object has the write method needed for SSE
 */
function isSSEResponseLike(obj: unknown): obj is { write: (_data: string) => void; end: () => void } {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }
  const candidate = obj as Record<string, unknown>;
  return (
    'write' in candidate &&
    typeof candidate.write === 'function' &&
    'end' in candidate &&
    typeof candidate.end === 'function'
  );
}

/**
 * Type Guard: Validates if an object has the close method
 */
function hasCloseMethod(obj: unknown): obj is { close: () => void } {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }
  const candidate = obj as Record<string, unknown>;
  return 'close' in candidate && typeof candidate.close === 'function';
}

/**
 * GET /api/sse/subscribe
 *
 * Endpoint SSE que estabelece conexão com o cliente para atualizações em tempo real
 *
 * Uso:
 * const eventSource = new EventSource('/api/sse/subscribe');
 * eventSource.onmessage = (event) => {
 *   const message = JSON.parse(event.data);
 *   console.log('Evento recebido:', message);
 * };
 */
export async function GET(request: NextRequest) {
  try {
    // Validar autenticação
    const { user, workspace } = await validateAuthAndGetUser();

    if (!user || !workspace) {
      return NextResponse.json(
        { success: false, error: 'Não autenticado' },
        { status: 401 }
      );
    }

    console.log(`${ICONS.WEBHOOK} SSE: Novo cliente se conectando - User: ${user.id}, Workspace: ${workspace.id}`);

    // Gerar ID único para a conexão
    const connectionId = generateConnectionId();

    // Obter manager de WebSocket
    const wsManager = getWebSocketManager();

    // Criar ReadableStream para SSE
    const stream = new ReadableStream({
      start(controller) {
        // Registrar conexão no manager
        const mockResponse = {
          write: (data: string) => {
            try {
              // Converter SSE para Uint8Array para enviar via ReadableStream
              const encoder = new TextEncoder();
              const encoded = encoder.encode(data);
              controller.enqueue(encoded);
            } catch (error) {
              console.error(`${ICONS.ERROR} Erro ao escrever no stream:`, error);
            }
          },
          end: () => {
            try {
              controller.close();
            } catch (e) {
              // Ignore close errors if already closed
            }
          }
        };

        // Validar e registrar conexão (type-safe via type guard)
        if (isSSEResponseLike(mockResponse)) {
          // Cast é seguro aqui pois passamos pela validação
          wsManager.addConnection(connectionId, mockResponse as unknown as Response, workspace.id);
        } else {
          console.error(`${ICONS.ERROR} Mock response não atende aos requisitos SSE`);
          return;
        }

        // Enviar mensagem de boas-vindas/confirmação de conexão
        const welcomeMessage = {
          type: 'ping',
          connectionId,
          workspaceId: workspace.id,
          userId: user.id,
          timestamp: Date.now()
        };

        const encoder = new TextEncoder();
        const sseData = `data: ${JSON.stringify(welcomeMessage)}\n\n`;
        controller.enqueue(encoder.encode(sseData));

        // IMPLEMENTAÇÃO DE SAFETY TIMEOUT PARA VERCEL SERVERLESS
        // Vercel Serverless Function (Node.js) tem limite de 10s (Hobbie) ou 60s (Pro).
        // SSE precisa fechar graciosamente ANTES do limite para evitar "Task Timed Out".
        // O cliente (EventSource) reconectará automaticamente.
        const VERCEL_TIMEOUT_LIMIT = 50 * 1000; // 50 segundos (margem de segurança para 60s)

        const timeoutId = setTimeout(() => {
          console.log(`${ICONS.INFO} SSE: Fechando conexão preventivamente (Vercel Timeout Safety) - ${connectionId}`);
          wsManager.removeConnection(connectionId);
          try {
            controller.close();
          } catch (e) {
            // Ignore error if already closed
          }
        }, VERCEL_TIMEOUT_LIMIT);

        // Cleanup ao desconectar
        // Type-safe access to close method using type guard
        if (hasCloseMethod(controller)) {
          const originalOnClose = controller.close.bind(controller);
          controller.close = () => {
            clearTimeout(timeoutId); // Limpar timeout
            console.log(`${ICONS.INFO} SSE: Cliente desconectado - ${connectionId}`);
            wsManager.removeConnection(connectionId);
            originalOnClose();
          };
        }
      },
      cancel() {
        console.log(`${ICONS.INFO} SSE: Stream cancelado - ${connectionId}`);
        const wsManager = getWebSocketManager();
        wsManager.removeConnection(connectionId);
      }
    });

    // Retornar resposta SSE
    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
        'X-Accel-Buffering': 'no' // Importante para Nginx/Vercel
      }
    });
  } catch (error) {
    console.error(`${ICONS.ERROR} Erro no endpoint SSE:`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao conectar SSE'
      },
      { status: 500 }
    );
  }
}

/**
 * CORS preflight
 */
export async function OPTIONS(_request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
