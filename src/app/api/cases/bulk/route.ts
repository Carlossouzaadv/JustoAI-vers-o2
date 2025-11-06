// ================================================================
// API ENDPOINT - Bulk Update Cases (PATCH)
// ================================================================
// PATCH /api/cases/bulk - Atualizar múltiplos casos em uma requisição
//
// Padrão de Validação Zod:
// - Request body: BulkUpdateCasesPayloadSchema (valida caseIds e updates)

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateAuthAndGetUser } from '@/lib/auth';
import {
  BulkUpdateCasesPayloadSchema,
  BulkUpdateCasesPayload,
} from '@/lib/types/api-schemas';

/**
 * PATCH /api/cases/bulk
 *
 * Atualiza múltiplos casos em uma única requisição
 * Util para operações em massa como: atribuir cliente, mudar status, etc
 *
 * Validação com Zod: caseIds (array[UUID]), updates (objetos)
 */
export async function PATCH(request: NextRequest) {
  try {
    // ============================================================
    // AUTENTICAÇÃO
    // ============================================================
    const authData = await validateAuthAndGetUser(request);
    const user = authData.user;

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    // ============================================================
    // VALIDAÇÃO DE BODY (JSON) COM ZOD
    // ============================================================
    const rawBody: unknown = await request.json();
    const bodyParseResult = BulkUpdateCasesPayloadSchema.safeParse(rawBody);

    if (!bodyParseResult.success) {
      return NextResponse.json(
        {
          success: false,
          message: 'Payload de bulk update inválido.',
          errors: bodyParseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { caseIds, updates }: BulkUpdateCasesPayload = bodyParseResult.data;
    const updateKeys = Object.keys(updates).filter(key => updates[key as keyof typeof updates] !== undefined);

    // ============================================================
    // VERIFICAR ACESSO AO WORKSPACE
    // ============================================================

    // Buscar workspace dos casos para verificar acesso
    const casesWorkspace = await prisma.case.findFirst({
      where: {
        id: { in: caseIds }
      },
      select: { workspaceId: true }
    });

    if (!casesWorkspace) {
      return NextResponse.json(
        { success: false, message: 'Casos não encontrados' },
        { status: 404 }
      );
    }

    // Verificar que user tem acesso ao workspace
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: casesWorkspace.workspaceId,
        members: {
          some: {
            userId: user.id
          }
        }
      }
    });

    if (!workspace) {
      return NextResponse.json(
        { success: false, message: 'Acesso negado - sem acesso ao workspace' },
        { status: 403 }
      );
    }

    // ============================================================
    // VALIDAÇÃO ADICIONAL: clientId (se fornecido)
    // ============================================================

    // Se está atualizando clientId, validar que cliente existe e pertence ao workspace
    if (updates.clientId) {
      const client = await prisma.client.findUnique({
        where: { id: updates.clientId },
        select: { id: true, workspaceId: true }
      });

      if (!client || client.workspaceId !== workspace.id) {
        return NextResponse.json(
          {
            success: false,
            message: 'Cliente inválido - cliente não existe ou pertence a outro workspace',
          },
          { status: 400 }
        );
      }
    }

    // ============================================================
    // ATUALIZAR CASOS
    // ============================================================

    // Construir objeto de update com valores validados por Zod
    const safeUpdates = { ...updates };

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

    // ============================================================
    // REGISTRAR EVENTOS (AUDITORIA)
    // ============================================================

    // Criar evento para cada caso atualizado
    const updateSummary = Object.entries(safeUpdates)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');

    const caseEvents = await prisma.caseEvent.createMany({
      data: caseIds.map(caseId => ({
        caseId,
        userId: user.id,
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

    console.log(`[Bulk Update] ${result.count} casos atualizados pelo user ${user.id}`);

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
        {
          success: false,
          message: 'JSON inválido'
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Desconhecido'
      },
      { status: 500 }
    );
  }
}
