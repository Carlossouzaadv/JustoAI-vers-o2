// ================================================================
// API ROUTE: POST /api/cases/[id]/timeline/conflicts/resolve
// Resolve timeline conflicts with user-defined actions
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import type { InputJsonValue, ProcessTimelineEntryUpdateInput, ProcessTimelineEntryCreateInput } from '@/lib/types/database';
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

// Type Guard: Check if object is ResolveConflictsRequest
function isResolveConflictsRequest(obj: unknown): obj is ResolveConflictsRequest {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'resolutions' in obj &&
    Array.isArray(obj.resolutions)
  );
}

interface UpdateData {
  description?: string;
  hasConflict?: boolean;
  conflictDetails?: InputJsonValue | null;
  reviewedBy?: string;
  reviewedAt?: Date;
  metadata?: InputJsonValue;
}

// Helper to build Prisma update input safely
function buildProcessTimelineUpdateInput(
  hasConflict: boolean,
  conflictDetails: InputJsonValue | null | undefined,
  reviewedBy: string,
  reviewedAt: Date,
  metadata: InputJsonValue | undefined,
  description?: string
): ProcessTimelineEntryUpdateInput {
  const input: ProcessTimelineEntryUpdateInput = {
    hasConflict,
    conflictDetails: conflictDetails,
    reviewedBy,
    reviewedAt,
    metadata,
  };

  if (description !== undefined) {
    input.description = description;
  }

  return input;
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
    const body = await request.json();

    // Validate body structure (ZERO casting)
    if (!isResolveConflictsRequest(body)) {
      return NextResponse.json(
        { error: 'Payload inválido ou resoluções não fornecidas' },
        { status: 400 }
      );
    }

    const { resolutions } = body; // body is now typed as ResolveConflictsRequest

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

        // Parse existing metadata safely (JsonValue can be null) - ZERO casting
        const existingMetadata: Record<string, unknown> = {};
        if (
          event.metadata &&
          typeof event.metadata === 'object' &&
          !Array.isArray(event.metadata)
        ) {
          // After narrowing, safely copy properties
          Object.assign(existingMetadata, event.metadata);
        }

        // Build update object - ZERO casting, using Padrão-Ouro JSON serialization
        const serializedMetadata = JSON.parse(JSON.stringify({
          ...existingMetadata,
          conflictResolution: {
            timestamp: now.toISOString(),
            resolution: resolution.resolution,
            resolvedBy: userId,
          },
        }));

        const updateData: UpdateData = {
          hasConflict: false,
          conflictDetails: null,
          reviewedBy: userId,
          reviewedAt: now,
          metadata: serializedMetadata,
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
            if (event.originalTexts && typeof event.originalTexts === 'object' && !Array.isArray(event.originalTexts)) {
              // After narrowing, safely iterate entries (ZERO casting)
              const docText = Object.entries(event.originalTexts)
                .filter(([source]) => source !== 'API_JUDIT')
                .map(([, text]) => String(text))
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
            // Criar novo evento relacionado com dados seguros
            // Serialize metadata and originalTexts using Padrão-Ouro (ZERO casting)
            const serializedEventMetadata = event.metadata
              ? JSON.parse(JSON.stringify(event.metadata))
              : undefined;
            const serializedOriginalTexts = event.originalTexts
              ? JSON.parse(JSON.stringify(event.originalTexts))
              : undefined;

            const relatedEvent = await prisma.processTimelineEntry.create({
              data: {
                case: { connect: { id: caseId } },
                contentHash: `related-${event.id}`,
                eventDate: event.eventDate,
                eventType: event.eventType,
                description: event.description || '',
                normalizedContent: event.normalizedContent || '',
                source: event.source,
                confidence: event.confidence,
                metadata: serializedEventMetadata,
                baseEvent: { connect: { id: event.id } },
                relationType: 'RELATED',
                originalTexts: serializedOriginalTexts,
              },
            });

            console.log(
              `${ICONS.SUCCESS} [Timeline Conflicts] Evento relacionado criado: ${relatedEvent.id}`
            );
            break;
        }

        // Atualizar evento com narrowing seguro
        const updateInput = buildProcessTimelineUpdateInput(
          false,
          null,
          userId,
          now,
          updateData.metadata,
          updateData.description
        );

        await prisma.processTimelineEntry.update({
          where: { id: resolution.eventId },
          data: updateInput,
        });

        results.push({
          eventId: resolution.eventId,
          status: 'resolved',
          resolution: resolution.resolution,
        });
      } catch (_error) {
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
  } catch (_error) {
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
