import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ICONS } from '@/lib/icons';

/**
 * GET /api/cases/[id]/notes
 * Retorna anotações associadas a um case
 * Por enquanto, retorna array vazio pois anotações serão criadas via CaseEvent
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const caseId = params.id;

    console.log(`${ICONS.EDIT} Buscando notas para case: ${caseId}`);

    // Verificar se case existe
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
    });

    if (!caseData) {
      return NextResponse.json(
        { error: 'Case não encontrado' },
        { status: 404 }
      );
    }

    // TODO: Implementar quando CaseEvent tiver suporte a notas
    // Por enquanto, retorna array vazio
    // Anotações serão gerenciadas via CaseEvent com type: 'NOTE'

    return NextResponse.json({
      success: true,
      notes: [],
      count: 0,
    });
  } catch (error) {
    console.error(`${ICONS.ERROR} Erro ao buscar notas:`, error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Erro ao buscar notas',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cases/[id]/notes
 * Criar nova nota (implementar quando CaseEvent suportar)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const caseId = params.id;
    const body = await request.json();

    console.log(`${ICONS.EDIT} Criando nota para case: ${caseId}`);

    // TODO: Implementar quando CaseEvent tiver suporte completo
    return NextResponse.json(
      {
        error: 'Endpoint não implementado',
        message: 'Anotações serão gerenciadas via Timeline Events em futuro update',
      },
      { status: 501 }
    );
  } catch (error) {
    console.error(`${ICONS.ERROR} Erro ao criar nota:`, error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Erro ao criar nota',
      },
      { status: 500 }
    );
  }
}
