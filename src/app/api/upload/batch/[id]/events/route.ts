// ================================================================
// API ENDPOINT - Batch Events (SSE Real-time Progress)
// ================================================================
// GET /upload/batch/{id}/events
// Server-Sent Events para progresso em tempo real

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ICONS } from '@/lib/icons';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const batchId = params.id;

  console.log(`${ICONS.PROCESS} Iniciando SSE para batch: ${batchId}`);

  try {
    // Verificar se o batch existe
    const batch = await prisma.processBatchUpload.findUnique({
      where: { id: batchId }
    });

    if (!batch) {
      return NextResponse.json(
        {
          success: false,
          error: 'Batch não encontrado'
        },
        { status: 404 }
      );
    }

    // Configurar SSE
    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      start(controller) {
        console.log(`${ICONS.SUCCESS} SSE conectado para batch ${batchId}`);

        // Enviar evento inicial com status atual
        const initialEvent = {
          type: 'connected',
          data: {
            batchId,
            status: batch.status,
            totalRows: batch.totalRows,
            processed: batch.processed,
            successful: batch.successful,
            failed: batch.failed,
            progress: batch.totalRows > 0 ? Math.round((batch.processed / batch.totalRows) * 100) : 0,
            timestamp: new Date().toISOString()
          }
        };

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(initialEvent)}\n\n`)
        );

        // Polling de progresso a cada 2 segundos
        const interval = setInterval(async () => {
          try {
            const updatedBatch = await prisma.processBatchUpload.findUnique({
              where: { id: batchId }
            });

            if (!updatedBatch) {
              controller.close();
              clearInterval(interval);
              return;
            }

            // Calcular progresso
            const progress = updatedBatch.totalRows > 0
              ? Math.round((updatedBatch.processed / updatedBatch.totalRows) * 100)
              : 0;

            // Calcular velocidade (linhas por minuto)
            const elapsedMinutes = (Date.now() - updatedBatch.createdAt.getTime()) / 60000;
            const speed = elapsedMinutes > 0 ? Math.round(updatedBatch.processed / elapsedMinutes) : 0;

            // Calcular ETA
            const remaining = updatedBatch.totalRows - updatedBatch.processed;
            const eta = speed > 0 && remaining > 0 ? Math.ceil(remaining / speed) : null;

            const progressEvent = {
              type: 'progress',
              data: {
                batchId,
                status: updatedBatch.status,
                totalRows: updatedBatch.totalRows,
                processed: updatedBatch.processed,
                successful: updatedBatch.successful,
                failed: updatedBatch.failed,
                progress,
                speed: `${speed} linhas/min`,
                eta: eta ? `${eta} min restantes` : null,
                timestamp: new Date().toISOString()
              }
            };

            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(progressEvent)}\n\n`)
            );

            // Se o batch foi concluído/cancelado/falhou, enviar evento final e encerrar
            if (['COMPLETED', 'CANCELLED', 'FAILED'].includes(updatedBatch.status)) {
              const finalEvent = {
                type: 'finished',
                data: {
                  batchId,
                  status: updatedBatch.status,
                  finalStats: {
                    totalRows: updatedBatch.totalRows,
                    processed: updatedBatch.processed,
                    successful: updatedBatch.successful,
                    failed: updatedBatch.failed,
                    successRate: updatedBatch.processed > 0
                      ? Math.round((updatedBatch.successful / updatedBatch.processed) * 100)
                      : 0
                  },
                  duration: elapsedMinutes,
                  timestamp: new Date().toISOString()
                }
              };

              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(finalEvent)}\n\n`)
              );

              controller.close();
              clearInterval(interval);
            }

          } catch (error) {
            console.error(`${ICONS.ERROR} Erro no SSE polling:`, error);

            const errorEvent = {
              type: 'error',
              data: {
                batchId,
                error: 'Erro ao obter progresso',
                timestamp: new Date().toISOString()
              }
            };

            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`)
            );
          }
        }, 2000); // Polling a cada 2 segundos

        // Cleanup quando a conexão é fechada
        request.signal?.addEventListener('abort', () => {
          console.log(`${ICONS.INFO} SSE desconectado para batch ${batchId}`);
          clearInterval(interval);
          controller.close();
        });
      }
    });

    return new NextResponse(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Cache-Control'
      }
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro ao configurar SSE:`, error);

    return NextResponse.json(
      {
        success: false,
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}