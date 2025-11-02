// ================================================================
// SSE ENDPOINT - Server-Sent Events para Real-Time Updates
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { validateAuthAndGetUser } from '@/lib/auth';
import { getWebSocketManager, generateConnectionId } from '@/lib/websocket-manager';
import { ICONS } from '@/lib/icons';

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
    const { user, workspace } = await validateAuthAndGetUser(request);

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
            controller.close();
          }
        };

        // Registrar conexão
        wsManager.addConnection(connectionId, mockResponse as any, workspace.id);

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

        // Cleanup ao desconectar
        const originalOnClose = (controller as any).close;
        (controller as any).close = () => {
          console.log(`${ICONS.INFO} SSE: Cliente desconectado - ${connectionId}`);
          wsManager.removeConnection(connectionId);
          if (originalOnClose) originalOnClose.call(controller);
        };
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
        'Access-Control-Allow-Headers': 'Content-Type'
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
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
