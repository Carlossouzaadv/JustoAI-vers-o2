// ================================================================
// API ROUTE: POST /api/judit/onboarding
// Inicia processo de onboarding via fila de background
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { addOnboardingJob } from '@/lib/queue/juditQueue';
import { juditAPI, JuditOperationType } from '@/lib/judit-api-wrapper';

// ================================================================
// VALIDAÇÃO
// ================================================================

const onboardingSchema = z.object({
  cnj: z.string()
    .min(1, 'CNJ é obrigatório')
    .regex(
      /^\d{7}-\d{2}\.\d{4}\.\d{1,2}\.\d{2}\.\d{4}$/,
      'Formato de CNJ inválido. Use: 1234567-12.2023.8.09.0001'
    ),
  workspaceId: z.string().optional(),
  userId: z.string().optional(),
  priority: z.number().min(1).max(10).optional(),
});

// ================================================================
// HANDLER
// ================================================================

export async function POST(request: NextRequest) {
  try {
    // ============================================================
    // 1. VALIDAR REQUEST
    // ============================================================

    const body = await request.json();
    const validation = onboardingSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Dados inválidos',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const { cnj, workspaceId, userId, priority } = validation.data;

    // ============================================================
    // 2. ADICIONAR À FILA
    // ============================================================

    const startTime = Date.now();
    const { jobId } = await addOnboardingJob(cnj, {
      workspaceId,
      userId,
      priority,
    });

    console.log(`[API] Onboarding job criado: ${jobId} - CNJ: ${cnj}`);

    // ============================================================
    // 2.5. TRACK TELEMETRY
    // ============================================================

    const durationMs = Date.now() - startTime;
    if (workspaceId) {
      await juditAPI.trackCall({
        workspaceId,
        operationType: JuditOperationType.MONITORING,
        numeroCnj: cnj,
        durationMs,
        success: true,
        requestId: jobId,
        metadata: {
          eventType: 'onboarding.started',
          userId,
          priority: priority || 5,
        },
      });
    }

    // ============================================================
    // 3. RETORNAR 202 ACCEPTED
    // ============================================================

    return NextResponse.json(
      {
        success: true,
        message: 'Onboarding iniciado. O processo será executado em background.',
        data: {
          jobId,
          cnj,
          status: 'queued',
          estimatedTime: '2-5 minutos',
          statusUrl: `/api/judit/onboarding/status/${jobId}`,
        },
      },
      { status: 202 } // 202 Accepted
    );

  } catch (error) {
    console.error('[API] Erro ao criar onboarding job:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao iniciar onboarding',
      },
      { status: 500 }
    );
  }
}

// ================================================================
// MÉTODO NÃO PERMITIDO
// ================================================================

export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: 'Método não permitido. Use POST.',
    },
    { status: 405 }
  );
}
