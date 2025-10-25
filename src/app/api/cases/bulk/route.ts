import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';

/**
 * PATCH /api/cases/bulk
 *
 * Atualiza múltiplos casos em uma única requisição
 * Util para operações em massa como: atribuir cliente, mudar status, etc
 *
 * Body:
 * {
 *   caseIds: string[];
 *   updates: {
 *     clientId?: string;
 *     status?: string;
 *     priority?: string;
 *     // ... outros campos
 *   }
 * }
 */
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { caseIds, updates } = body;

    // Validar input
    if (!Array.isArray(caseIds) || caseIds.length === 0) {
      return NextResponse.json(
        { error: 'Invalid input: caseIds must be a non-empty array' },
        { status: 400 }
      );
    }

    if (!updates || typeof updates !== 'object' || Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'Invalid input: updates must be a non-empty object' },
        { status: 400 }
      );
    }

    // Limitar campos atualizáveis (segurança)
    const allowedFields = ['clientId', 'status', 'priority', 'title', 'description'];
    const updateKeys = Object.keys(updates).filter(key => allowedFields.includes(key));

    if (updateKeys.length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Construir objeto de update apenas com campos permitidos
    const safeUpdates: Record<string, any> = {};
    updateKeys.forEach(key => {
      safeUpdates[key] = updates[key];
    });

    // ================================================================
    // VERIFICAR ACESSO AO WORKSPACE
    // ================================================================

    // Buscar workspace dos casos para verificar acesso
    const casesWorkspace = await prisma.case.findFirst({
      where: {
        id: { in: caseIds }
      },
      select: { workspaceId: true }
    });

    if (!casesWorkspace) {
      return NextResponse.json(
        { error: 'Cases not found' },
        { status: 404 }
      );
    }

    // Verificar que user tem acesso ao workspace
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: casesWorkspace.workspaceId,
        members: {
          some: {
            clerkId: userId
          }
        }
      }
    });

    if (!workspace) {
      return NextResponse.json(
        { error: 'Forbidden - no access to workspace' },
        { status: 403 }
      );
    }

    // ================================================================
    // ATUALIZAR CASOS
    // ================================================================

    // Se está atualizando clientId, validar que cliente existe e pertence ao workspace
    if (safeUpdates.clientId) {
      const client = await prisma.client.findUnique({
        where: { id: safeUpdates.clientId },
        select: { id: true, workspaceId: true }
      });

      if (!client || client.workspaceId !== workspace.id) {
        return NextResponse.json(
          { error: 'Invalid client - client does not exist or is from different workspace' },
          { status: 400 }
        );
      }
    }

    // Atualizar todos os casos
    const result = await prisma.case.updateMany({
      where: {
        id: { in: caseIds },
        workspaceId: workspace.id // Garantir que só atualiza casos do workspace
      },
      data: {
        ...safeUpdates,
        updatedAt: new Date()
      }
    });

    // ================================================================
    // REGISTRAR EVENTOS (AUDITORIA)
    // ================================================================

    // Criar evento para cada caso atualizado
    const updateSummary = Object.entries(safeUpdates)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');

    const caseEvents = await prisma.caseEvent.createMany({
      data: caseIds.map(caseId => ({
        caseId,
        userId,
        type: 'BULK_UPDATE',
        title: 'Atualização em massa',
        description: `Atualização em massa: ${updateSummary}`,
        metadata: {
          bulkOperationId: crypto.getRandomValues(new Uint8Array(16)).join(''),
          updatedFields: updateKeys,
          updates: safeUpdates
        }
      }))
    });

    console.log(`[Bulk Update] ${result.count} casos atualizados pelo user ${userId}`);

    return NextResponse.json({
      success: true,
      message: `${result.count} caso(s) atualizado(s) com sucesso`,
      updated: result.count,
      failed: caseIds.length - result.count,
      updatedFields: updateKeys,
      eventsCreated: caseEvents.count
    });
  } catch (error) {
    console.error('[Bulk Update API] Error:', error);

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
