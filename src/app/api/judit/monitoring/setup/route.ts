// ================================================================
// API ROUTE: POST /api/judit/monitoring/setup
// Configura monitoramento contínuo para um processo
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { setupProcessMonitoring } from '@/lib/services/juditMonitoringService';

// ================================================================
// VALIDAÇÃO
// ================================================================

const monitoringSetupSchema = z.object({
  cnj: z.string()
    .min(1, 'CNJ é obrigatório')
    .regex(
      /^\d{7}-\d{2}\.\d{4}\.\d{1,2}\.\d{2}\.\d{4}$/,
      'Formato de CNJ inválido. Use: 1234567-12.2023.8.09.0001'
    ),
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
    const validation = monitoringSetupSchema.safeParse(body);

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

    const { cnj } = validation.data;

    // ============================================================
    // 2. EXECUTAR SETUP DE MONITORAMENTO
    // ============================================================

    console.log(`[API] Iniciando setup de monitoramento para CNJ: ${cnj}`);

    const result = await setupProcessMonitoring(cnj);

    // ============================================================
    // 3. RETORNAR RESULTADO
    // ============================================================

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Monitoramento configurado com sucesso',
        data: {
          cnj: result.numeroCnj,
          trackingId: result.trackingId,
          processoId: result.processoId,
          monitoringType: 'UNIVERSAL',
          recurrence: '1 day',
          status: 'active',
        },
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Falha ao configurar monitoramento',
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('[API] Erro ao configurar monitoramento:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao configurar monitoramento',
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
