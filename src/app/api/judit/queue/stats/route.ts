// ================================================================
// API ROUTE: GET /api/judit/queue/stats
// Retorna estatísticas da fila de onboarding
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getQueueStats, getActiveJobs, getWaitingJobs } from '@/lib/queue/juditQueue';

// ================================================================
// HANDLER
// ================================================================

export async function GET(request: NextRequest) {
  try {
    // Buscar estatísticas gerais
    const stats = await getQueueStats();

    // Buscar jobs ativos para detalhes
    const activeJobs = await getActiveJobs();
    const waitingJobs = await getWaitingJobs();

    // Formatar jobs ativos
    const activeJobsData = activeJobs.map((job) => ({
      jobId: job.id,
      cnj: job.data.cnj,
      progress: job.progress || 0,
      processedOn: job.processedOn,
    }));

    // Formatar jobs aguardando
    const waitingJobsData = waitingJobs.slice(0, 10).map((job) => ({
      jobId: job.id,
      cnj: job.data.cnj,
      priority: job.opts.priority,
      timestamp: job.timestamp,
    }));

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          ...stats,
          health: calculateHealth(stats),
        },
        activeJobs: activeJobsData,
        waitingJobs: waitingJobsData,
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('[API] Erro ao buscar estatísticas da fila:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao buscar estatísticas',
      },
      { status: 500 }
    );
  }
}

// ================================================================
// UTILITÁRIOS
// ================================================================

interface QueueStats {
  active: number;
  waiting: number;
  failed: number;
}

function isQueueStats(data: unknown): data is QueueStats {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.active === 'number' &&
    typeof obj.waiting === 'number' &&
    typeof obj.failed === 'number'
  );
}

function calculateHealth(stats: unknown): 'healthy' | 'warning' | 'critical' {
  if (!isQueueStats(stats)) return 'critical';

  const { active, waiting, failed } = stats;
  const totalActive = active + waiting;

  // Crítico se muitos jobs falhando
  if (failed > 50) return 'critical';

  // Warning se muitos jobs aguardando
  if (waiting > 100) return 'warning';

  // Warning se muitos jobs ativos (pode indicar lentidão)
  if (active > 20) return 'warning';

  return 'healthy';
}
