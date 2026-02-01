import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { onboardingService } from '@/lib/services/onboardingService';
import { checkProcessLimit } from '@/lib/middleware/checkWorkspaceLimit';

// ============================================
// API ROUTE: PROCESS ONBOARDING VIA ESCAVADOR
// POST /api/process/onboarding
// ============================================

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = session.user as { id?: string }; // Cast to access id

    const body = await request.json();
    const { cnj, workspaceId, clientId, incluirDocumentos = true } = body;

    // Validar CNJ
    if (!cnj) {
      return NextResponse.json({ error: 'CNJ é obrigatório' }, { status: 400 });
    }

    // Validar formato CNJ (NNNNNNN-DD.AAAA.J.TR.OOOO)
    const cnjRegex = /^\d{7}-\d{2}\.\d{4}\.\d{1}\.\d{2}\.\d{4}$/;
    if (!cnjRegex.test(cnj)) {
      return NextResponse.json({ 
        error: 'CNJ inválido. Formato esperado: NNNNNNN-DD.AAAA.J.TR.OOOO' 
      }, { status: 400 });
    }

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId é obrigatório' }, { status: 400 });
    }

    // VERIFICAR LIMITE ANTES DE PROCESSAR
    const limitCheck = await checkProcessLimit(workspaceId);
    if (!limitCheck.allowed) {
      return limitCheck.response!;
    }

    // Fazer onboarding
    const result = await onboardingService.onboardProcesso({
      cnj,
      workspaceId,
      clientId,
      createdById: user.id || '', // Fallback to empty string if undefined
      incluirDocumentos,
      usarCertificado: true
    });

    return NextResponse.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('[API Onboarding] Erro:', error);
    
    const message = error instanceof Error ? error.message : 'Erro ao fazer onboarding';
    
    return NextResponse.json({
      error: message
    }, { status: 500 });
  }
}
