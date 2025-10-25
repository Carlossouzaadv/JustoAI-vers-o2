import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUnassignedReason } from '@/lib/utils/case-onboarding-helper';
import { auth } from '@clerk/nextjs/server';

/**
 * GET /api/cases/[id]/onboarding-status
 *
 * Retorna informações sobre o status de onboarding de um caso UNASSIGNED
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
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
        workspaceId: true,
        status: true,
        metadata: true,
        createdById: true,
      },
    });

    if (!caseData) {
      return NextResponse.json(
        { error: 'Case not found' },
        { status: 404 }
      );
    }

    // Verificar permissão (user criou ou é workspace member)
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: caseData.workspaceId,
        members: {
          some: {
            clerkId: userId,
          },
        },
      },
    });

    if (!workspace && caseData.createdById !== userId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Obter informações de erro
    const unassignedReason = await getUnassignedReason(caseId);

    return NextResponse.json(unassignedReason);
  } catch (error) {
    console.error('[OnboardingStatus API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
