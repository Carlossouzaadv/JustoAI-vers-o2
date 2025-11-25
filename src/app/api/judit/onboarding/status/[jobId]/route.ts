// ================================================================
// API ROUTE: GET /api/judit/onboarding/status/[jobId]
// Verifica status de um job de onboarding
// ================================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getJobStatus } from '@/lib/queue/juditQueue';
import { juditAPI, JuditOperationType } from '@/lib/judit-api-wrapper';

// ================================================================
// HANDLER
// ================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  try {

    if (!jobId) {
      return NextResponse.json(
        {
          success: false,
          error: 'jobId é obrigatório',
        },
        { status: 400 }
      );
    }

    // Buscar status do job
    const startTime = Date.now();
    const jobStatus = await getJobStatus(jobId);

    if (jobStatus.status === 'unknown') {
      return NextResponse.json(
        {
          success: false,
          error: 'Job não encontrado',
        },
        { status: 404 }
      );
    }

    // Mapear status para resposta amigável
    const statusMap = {
      waiting: 'Aguardando processamento',
      active: 'Processando',
      completed: 'Concluído',
      failed: 'Falhou',
      delayed: 'Atrasado',
      unknown: 'Desconhecido',
    };

    // Track completion or failure
    const durationMs = Date.now() - startTime;
    if (jobStatus.status === 'completed' || jobStatus.status === 'failed') {
      // Try to get workspaceId from job result metadata
      const workspaceId = jobStatus.result?.workspaceId;
      if (workspaceId) {
        await juditAPI.trackCall({
          workspaceId,
          operationType: JuditOperationType.MONITORING,
          durationMs,
          success: jobStatus.status === 'completed',
          error: jobStatus.error,
          requestId: jobId,
          metadata: {
            eventType: 'onboarding.completed',
            status: jobStatus.status,
            progress: jobStatus.progress || 0,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        jobId,
        status: jobStatus.status,
        statusDescription: statusMap[jobStatus.status],
        progress: jobStatus.progress || 0,
        result: jobStatus.result,
        error: jobStatus.error,
        isComplete: jobStatus.status === 'completed',
        isFailed: jobStatus.status === 'failed',
      },
    });

  } catch (_error) {
    console.error('[API] Erro ao buscar status do job:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao buscar status',
      },
      { status: 500 }
    );
  }
}
