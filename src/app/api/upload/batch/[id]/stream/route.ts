// ================================================================
// API ENDPOINT - Server-Sent Events para Progresso
// ================================================================
// Stream de progresso em tempo real via SSE

import { NextRequest } from 'next/server';
import { getWebSocketManager, generateConnectionId } from '@/lib/websocket-manager';
import { ICONS } from '@/lib/icons';

/**
 * GET /api/upload/batch/{id}/stream
 * Estabelece conexão SSE para receber atualizações de progresso
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const batchId = params.id;

  if (!batchId) {
    return new Response('Batch ID é obrigatório', { status: 400 });
  }

  console.log(`${ICONS.PROCESS} Nova conexão SSE para batch: ${batchId}`);

  // Configurar headers SSE
  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Criar stream personalizado
  const stream = new ReadableStream({
    start(controller) {
      const wsManager = getWebSocketManager();
      const connectionId = generateConnectionId();

      console.log(`${ICONS.SUCCESS} Conexão SSE estabelecida: ${connectionId}`);

      // Registrar conexão
      // TODO: Adaptar para usar controller ao invés de Response
      // wsManager.addConnection(connectionId, response);
      // wsManager.subscribeToBatch(connectionId, batchId);

      // Enviar mensagem inicial
      const initialMessage = `data: ${JSON.stringify({
        type: 'connected',
        batchId,
        connectionId,
        timestamp: Date.now()
      })}\n\n`;

      controller.enqueue(new TextEncoder().encode(initialMessage));

      // Configurar cleanup quando conexão for fechada
      const cleanup = () => {
        console.log(`${ICONS.INFO} Limpando conexão SSE: ${connectionId}`);
        wsManager.removeConnection(connectionId);
      };

      // TODO: Configurar listeners apropriados para cleanup
      // request.signal.addEventListener('abort', cleanup);

      // Simular envio de progresso a cada 5 segundos (para teste)
      const intervalId = setInterval(() => {
        try {
          const progressMessage = `data: ${JSON.stringify({
            type: 'batch_progress',
            batchId,
            data: {
              batchId,
              progress: Math.floor(Math.random() * 100),
              processed: Math.floor(Math.random() * 100),
              timestamp: Date.now()
            },
            timestamp: Date.now()
          })}\n\n`;

          controller.enqueue(new TextEncoder().encode(progressMessage));

        } catch (error) {
          console.error(`${ICONS.ERROR} Erro ao enviar progresso SSE:`, error);
          clearInterval(intervalId);
          cleanup();
          controller.close();
        }
      }, 5000);

      // Cleanup quando stream for fechado
      return () => {
        clearInterval(intervalId);
        cleanup();
      };
    }
  });

  return new Response(stream, { headers });
}

/**
 * OPTIONS - CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Cache-Control'
    }
  });
}