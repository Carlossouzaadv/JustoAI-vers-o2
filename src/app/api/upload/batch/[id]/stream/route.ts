// ================================================================
// API ENDPOINT - Server-Sent Events para Progresso
// ================================================================
// Stream de progresso em tempo real via SSE

import { NextRequest } from 'next/server';
import { getWebSocketManager, generateConnectionId } from '@/lib/websocket-manager';
import { ICONS } from '@/lib/icons';
import { createSSECorsHeaders } from '@/lib/cors';
import { addSSESecurityHeaders } from '@/lib/security-headers';

/**
 * GET /api/upload/batch/{id}/stream
 * Estabelece conexão SSE para receber atualizações de progresso
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: batchId } = await params;

  if (!batchId) {
    return new Response('Batch ID é obrigatório', { status: 400 });
  }

  console.log(`${ICONS.PROCESS} Nova conexão SSE para batch: ${batchId}`);

  // Obter origem da requisição
  const origin = request.headers.get('origin');

  // Configurar headers SSE seguros
  const headers = createSSECorsHeaders(origin);
  addSSESecurityHeaders(headers);

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

        } catch (_error) {
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
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  const headers = createSSECorsHeaders(origin);
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');

  return new Response(null, {
    status: 200,
    headers
  });
}