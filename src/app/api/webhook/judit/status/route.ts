// ================================================================
// JUDIT WEBHOOK STATUS CHECK - Diagnóstico
// ================================================================
// Este endpoint ajuda a diagnosticar:
// 1. Se a URL do webhook é acessível
// 2. Quais requisições JUDIT estão pendentes
// 3. Quais já receberam callbacks
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ICONS } from '@/lib/icons';

export async function GET(request: NextRequest) {
  try {
    console.log(`${ICONS.INFO} [Webhook Status] Verificando status das requisições JUDIT`);

    // Buscar todas as requisições JUDIT
    const juditRequests = await prisma.juditRequest.findMany({
      include: {
        processo: {
          include: {
            case: {
              select: {
                id: true,
                number: true,
                title: true,
                onboardingStatus: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 20 // Últimas 20
    });

    // Criar type alias para o resultado do Prisma com includes
    type JuditRequestWithRelations = typeof juditRequests[number];

    const summary = {
      total: juditRequests.length,
      byStatus: {
        pending: juditRequests.filter((r: JuditRequestWithRelations) => r.status === 'pending').length,
        processing: juditRequests.filter((r: JuditRequestWithRelations) => r.status === 'processing').length,
        completed: juditRequests.filter((r: JuditRequestWithRelations) => r.status === 'completed').length,
        failed: juditRequests.filter((r: JuditRequestWithRelations) => r.status === 'failed').length
      },
      details: juditRequests.map((req: JuditRequestWithRelations) => ({
        requestId: req.requestId,
        status: req.status,
        createdAt: req.createdAt,
        updatedAt: req.updatedAt,
        age_minutes: Math.round((Date.now() - req.createdAt.getTime()) / 60000),
        processo: {
          cnj: req.processo?.numeroCnj,
          caseId: req.processo?.case?.id,
          caseName: req.processo?.case?.title,
          onboardingStatus: req.processo?.case?.onboardingStatus
        }
      }))
    };

    console.log(`${ICONS.SUCCESS} [Webhook Status]`, summary);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      webhook_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://justoai.vercel.app'}/api/webhook/judit/callback`,
      summary,
      details: juditRequests
    });
  } catch (error) {
    console.error(`${ICONS.ERROR} [Webhook Status]`, error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}

// Health check - simples ping para verificar acessibilidade
export async function HEAD(_request: NextRequest) {
  console.log(`${ICONS.SUCCESS} [Webhook Health] PING recebido`);
  return NextResponse.json({ status: 'ok' });
}
