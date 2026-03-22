import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { escavadorClient } from '@/lib/escavador-client';
import { prisma } from '@/lib/prisma';
import { checkProcessLimit } from '@/lib/middleware/checkWorkspaceLimit';
import { onboardingService } from '@/lib/services/onboardingService';

// ============================================
// API ROUTE: PROCESS ONBOARDING VIA ESCAVADOR (ASYNC)
// POST /api/process/onboarding
// 
// Arquitetura Assíncrona:
// 1. Cria Case com status ONBOARDING
// 2. Solicita atualização no Escavador com callback
// 3. Retorna 202 Accepted imediatamente
// 4. Webhook /api/webhooks/escavador recebe resultado e finaliza
// ============================================

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    // Verificar se Escavador está configurado
    if (!escavadorClient.isConfigured()) {
      return NextResponse.json({ 
        error: 'Escavador API não está configurada' 
      }, { status: 500 });
    }

    // VERIFICAR LIMITE ANTES DE PROCESSAR
    const limitCheck = await checkProcessLimit(workspaceId);
    if (!limitCheck.allowed) {
      return limitCheck.response!;
    }

    // Verificar se já existe Case para este CNJ neste workspace
    const existingCase = await prisma.case.findFirst({
      where: {
        workspaceId,
        number: cnj
      }
    });

    if (existingCase) {
      return NextResponse.json({
        success: true,
        caseId: existingCase.id,
        status: existingCase.status,
        message: 'Processo já cadastrado'
      });
    }

    // 1. Iniciar Onboarding via Service (que agora possui fluxo 3 fases)
    const result = await onboardingService.onboardProcesso({
      cnj,
      workspaceId,
      clientId,
      createdById: user.id || '',
      incluirDocumentos
    });

    // 2. Retornar status adequado com base na resposta
    if (result.case.status === 'ACTIVE') {
      // Fase 1 ou 2 bem sucedida (processo já existia base)
      return NextResponse.json({
        success: true,
        caseId: result.case.id,
        status: 'ACTIVE',
        message: 'Processo carregado com sucesso'
      }, { status: 200 });
    } else {
      // Fase 3 via fall-back assíncrono
      return NextResponse.json({
        success: true,
        caseId: result.case.id,
        status: 'ONBOARDING',
        message: 'Processamento iniciado. O processo será atualizado automaticamente quando o Escavador concluir.'
      }, { status: 202 });
    }

  } catch (error) {
    console.error('[API Onboarding] Erro:', error);
    
    const message = error instanceof Error ? error.message : 'Erro ao fazer onboarding';
    
    return NextResponse.json({
      error: message
    }, { status: 500 });
  }
}
