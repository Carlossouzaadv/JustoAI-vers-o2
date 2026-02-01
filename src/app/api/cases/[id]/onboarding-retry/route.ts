export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { retryOnboarding } from '@/lib/utils/case-onboarding-helper';
// import { addOnboardingJob } from '@/lib/queue/juditQueue'; // REMOVED
import { onboardingService } from '@/lib/services/onboardingService';
import { validateAuthAndGetUser } from '@/lib/auth';
import { ICONS } from '@/lib/icons';

/**
 * Type Guard: Validates metadata object structure for can_retry property
 */
function hasCanRetryProperty(obj: unknown): obj is { can_retry?: boolean } {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }
  const candidate = obj as Record<string, unknown>;
  return 'can_retry' in candidate && typeof candidate.can_retry === 'boolean';
}

/**
 * POST /api/cases/[id]/onboarding-retry
 *
 * Faz retry do onboarding para um caso UNASSIGNED
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const authData = await validateAuthAndGetUser();
    const user = authData.user;

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const caseId = id;

    // Verificar que o usuário tem acesso a este caso
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      select: {
        id: true,
        status: true,
        workspaceId: true,
        detectedCnj: true,
        createdById: true,
        metadata: true,
      },
    });

    if (!caseData) {
      return NextResponse.json(
        { error: 'Case not found' },
        { status: 404 }
      );
    }

    // Verificar permissão
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: caseData.workspaceId,
        users: {
          some: {
            userId: user.id,
          },
        },
      },
    });

    if (!workspace && caseData.createdById !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Verificar se pode fazer retry
    if (caseData.status !== 'UNASSIGNED') {
      return NextResponse.json(
        {
          error: 'Case is not UNASSIGNED',
          message: 'Só é possível fazer retry em processos com status UNASSIGNED',
        },
        { status: 400 }
      );
    }

    const metadata = (caseData.metadata || {}) as unknown;
    
    // Type-safe validation of metadata using type guard
    if (!hasCanRetryProperty(metadata) || metadata.can_retry !== true) {
      return NextResponse.json(
        {
          error: 'Retry not allowed',
          message: 'Limite de tentativas atingido. Entre em contato com o suporte.',
        },
        { status: 400 }
      );
    }

    if (!caseData.detectedCnj) {
      return NextResponse.json(
        {
          error: 'No CNJ detected',
          message: 'Não é possível fazer retry sem um número CNJ válido.',
        },
        { status: 400 }
      );
    }

    // ================================================================
    // EXECUTAR RETRY
    // ================================================================

    // 1. Limpar erros anteriores e resetar status
    const retrySuccess = await retryOnboarding(caseId);

    if (!retrySuccess) {
      return NextResponse.json(
        {
          error: 'Retry failed',
          message: 'Não foi possível iniciar o retry. Tente novamente mais tarde.',
        },
        { status: 500 }
      );
    }

    // 2. Executar Onboarding (agora síncrono/await, substitui fila)
    try {
      // NOTE: This might take time due to Escavador polling.
      // If we move to background job later, we need a working queue system.
      // For now, we process "synchronously" (awaiting) to ensure data is fetched.
      // Users might experience delay, but retry is an explicit action.
      
      const result = await onboardingService.onboardProcesso({
        cnj: caseData.detectedCnj,
        workspaceId: caseData.workspaceId,
        createdById: user.id,
        targetCaseId: caseId, // Update THIS case
        forceUpdate: true,    // Force fetching from Escavador
        incluirDocumentos: true,
        usarCertificado: true
      });

      console.log(`${ICONS.SUCCESS} [Retry] Onboarding reiniciado com sucesso para case ${caseId}`);

      return NextResponse.json({
        success: true,
        message: 'Retry realizado com sucesso. Dados atualizados.',
        cnj: caseData.detectedCnj,
        details: {
          movimentacoes: result.movimentacoesCount,
          autos: result.autosCount
        }
      });
    } catch (onboardingError) {
      console.error(`${ICONS.ERROR} [Retry] Erro ao executar onboarding:`, onboardingError);

      return NextResponse.json(
        {
          error: 'Failed to queue JUDIT request',
          message: 'Erro ao enfileirar nova requisição. Tente novamente mais tarde.',
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[OnboardingRetry API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
