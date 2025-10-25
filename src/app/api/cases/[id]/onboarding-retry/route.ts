import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { retryOnboarding } from '@/lib/utils/case-onboarding-helper';
import { addOnboardingJob } from '@/lib/queue/juditQueue';
import { validateAuthAndGetUser } from '@/lib/auth';
import { ICONS } from '@/lib/icons';

/**
 * POST /api/cases/[id]/onboarding-retry
 *
 * Faz retry do onboarding para um caso UNASSIGNED
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authData = await validateAuthAndGetUser(request);
    const user = authData.user;

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const caseId = params.id;

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
        members: {
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

    const metadata = (caseData.metadata || {}) as any;
    if (metadata.can_retry !== true) {
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

    // 2. Enfileirar novo job de JUDIT
    try {
      const { jobId } = await addOnboardingJob(caseData.detectedCnj, {
        workspaceId: caseData.workspaceId,
        userId,
        caseId,
        priority: 5,
      });

      console.log(`${ICONS.SUCCESS} [Retry] Job de JUDIT enfileirado (Job ID: ${jobId})`);

      return NextResponse.json({
        success: true,
        message: 'Retry iniciado com sucesso',
        jobId,
        cnj: caseData.detectedCnj,
      });
    } catch (juditError) {
      console.error(`${ICONS.ERROR} [Retry] Erro ao enfileirar JUDIT:`, juditError);

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
