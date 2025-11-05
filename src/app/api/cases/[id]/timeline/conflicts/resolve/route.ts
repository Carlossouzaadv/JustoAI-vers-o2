// ================================================================
// API ROUTE: POST /api/cases/[id]/timeline/conflicts/resolve
// Resolve timeline conflicts with user-defined actions
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth-helper';
import { ICONS } from '@/lib/icons';

// ================================================================
// TYPES
// ================================================================

interface ConflictResolution {
  eventId: string;
  resolution: 'keep_judit' | 'use_document' | 'merge' | 'keep_both';
  mergedDescription?: string;
}

interface ResolveConflictsRequest {
  resolutions: ConflictResolution[];
}

// ================================================================
// MAIN HANDLER
// ================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    // ============================================================
    // 1. AUTHENTICATION
    // ============================================================

    const user = await getAuthenticatedUser(request);
    if (!user) {
      return unauthorizedResponse('Não autenticado');
    }

    const caseId = id;
    const body = (await request.json()) as ResolveConflictsRequest;
    const { resolutions } = body;

    if (!Array.isArray(resolutions) || resolutions.length === 0) {
      return NextResponse.json(
        { error: 'Nenhuma resolução fornecida' },
        { status: 400 }
      );
    }

    console.log(
      `${ICONS.PROCESS} [Timeline Conflicts] Resolvendo ${resolutions.length} conflito(s) para caso ${caseId}`
    );

    // ============================================================
    // 2. VALIDATE CASE AND PERMISSIONS
    // ============================================================

    const caseData = await prisma.case.findFirst({
      where: {
        id: caseId,
        workspace: {
          users: {
            some: {
              userId: user.id,
            },
          },
        },
      },
    });

    if (!caseData) {
      return NextResponse.json(
        { error: 'Caso não encontrado ou acesso negado' },
        { status: 404 }
      );
    }

    console.log(
      `${ICONS.SUCCESS} [Timeline Conflicts] Caso validado: ${caseData.number}`
    );

    // ============================================================
    // 3. PROCESS EACH RESOLUTION
    // ============================================================

    const results = [];
    const now = new Date();
    const userId = user.id;

    for (const resolution of resolutions) {
      try {
        const event = await prisma.processTimelineEntry.findUnique({
          where: { id: resolution.eventId },
        });

        if (!event || event.caseId !== caseId) {
          console.warn(
            `${ICONS.WARNING} [Timeline Conflicts] Evento não encontrado: ${resolution.eventId}`
          );
          continue;
        }

        const updateData: unknown = {
          hasConflict: false,
          conflictDetails: null,
          reviewedBy: userId,
          reviewedAt: now,
          metadata: {
            ...(event.metadata || {}),
            conflictResolution: {
              timestamp: now.toISOString(),
              resolution: resolution.resolution,
              resolvedBy: userId,
            },
          },
        };

        // ========== RESOLUTION ACTIONS ==========
        switch (resolution.resolution) {
          // KEEP_JUDIT: Descarta o evento conflitante
          case 'keep_judit':
            console.log(
              `${ICONS.INFO} [Timeline Conflicts] Mantendo JUDIT para ${event.eventType}`
            );
            // Apenas marca como resolvido (não muda nada)
            break;

          // USE_DOCUMENT: Substitui descrição pela do documento
          case 'use_document':
            if (event.originalTexts) {
              // Encontrar descrição do documento (não-JUDIT)
              const docText = Object.entries(event.originalTexts)
                .filter(([source]) => source !== 'API_JUDIT')
                .map(([, text]) => text)
                .join('\n---\n');

              if (docText) {
                updateData.description = docText;
                console.log(
                  `${ICONS.SUCCESS} [Timeline Conflicts] Usando documento para ${event.eventType}`
                );
              }
            }
            break;

          // MERGE: Usa descrição mesclada do usuário
          case 'merge':
            if (resolution.mergedDescription) {
              updateData.description = resolution.mergedDescription;
              console.log(
                `${ICONS.SUCCESS} [Timeline Conflicts] Mesclado manualmente: ${event.eventType}`
              );
            }
            break;

          // KEEP_BOTH: Cria evento relacionado separado
          case 'keep_both':
            // Criar novo evento relacionado
            const relatedEvent = await prisma.processTimelineEntry.create({
              data: {
                caseId,
                contentHash: `related-${event.id}`,
                eventDate: event.eventDate,
                eventType: event.eventType,
                description: event.description,
                normalizedContent: event.normalizedContent,
                source: event.source,
                confidence: event.confidence,
                metadata: event.metadata,
                baseEventId: event.id,
                relationType: 'RELATED',
                contributingSources: event.contributingSources,
                originalTexts: event.originalTexts,
              },
            });

            console.log(
              `${ICONS.SUCCESS} [Timeline Conflicts] Evento relacionado criado: ${relatedEvent.id}`
            );
            break;
        }

        // Atualizar evento
        await prisma.processTimelineEntry.update({
          where: { id: resolution.eventId },
          data: updateData,
        });

        results.push({
          eventId: resolution.eventId,
          status: 'resolved',
          resolution: resolution.resolution,
        });
      } catch (error) {
        console.error(
          `${ICONS.ERROR} [Timeline Conflicts] Erro ao resolver ${resolution.eventId}:`,
          error
        );
        results.push({
          eventId: resolution.eventId,
          status: 'error',
          error: error instanceof Error ? error.message : 'Erro desconhecido',
        });
      }
    }

    // ============================================================
    // 4. LOG FINAL
    // ============================================================

    const successCount = results.filter((r) => r.status === 'resolved').length;
    const errorCount = results.filter((r) => r.status === 'error').length;

    console.log(`${ICONS.SUCCESS} [Timeline Conflicts] Resolução completa:
      ✓ Resolvidos: ${successCount}
      ✗ Erros: ${errorCount}
      Total: ${results.length}`);

    return NextResponse.json(
      {
        success: true,
        message: `${successCount} conflito(s) resolvido(s) com sucesso`,
        results,
        stats: {
          total: results.length,
          resolved: successCount,
          errors: errorCount,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      `${ICONS.ERROR} [Timeline Conflicts] Erro geral:`,
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao resolver conflitos',
      },
      { status: 500 }
    );
  }
}
