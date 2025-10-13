// ================================================================
// API ROUTE: GET /api/judit/onboarding/status/[jobId]
// Verifica status de um job de onboarding
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getJobStatus } from '@/lib/queue/juditQueue';

// ================================================================
// HANDLER
// ================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = params;

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

  } catch (error) {
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
