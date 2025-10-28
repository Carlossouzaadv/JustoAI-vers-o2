/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
// ================================================================
// TIMELINE UNIFIER SERVICE - V2 with Intelligent Enrichment
// Unifica movimentos de PDF + JUDIT com enriquecimento inteligente
// ================================================================

import { prisma } from '@/lib/prisma';
import { createHash } from 'crypto';
import { ICONS } from '@/lib/icons';
import { getTimelineEnricherService, TimelineMovement } from './timelineEnricher';
import { TimelineSource, EventRelationType } from '@prisma/client';

// ================================================================
// TYPES
// ================================================================

export interface TimelineUnificationResult {
  total: number;
  new: number;
  duplicates: number;
  updated: number;
  enriched: number;
  related: number;
  conflicts: number;
}

// ================================================================
// MAIN FUNCTION - V2 with Intelligent Enrichment
// ================================================================

/**
 * Unifica timeline de um caso com enriquecimento inteligente
 *
 * Fluxo:
 * 1. Extrair movimentos de JUDIT (espinha dorsal)
 * 2. Criar eventos JUDIT no banco
 * 3. Extrair movimentos de PDF/IA
 * 4. Para cada movimento não-JUDIT:
 *    a. Associar a evento JUDIT base
 *    b. Se ENRICHMENT: enriquecer descrição + vincular
 *    c. Se RELATED: criar separado + vincular
 *    d. Se CONFLICT: marcar para revisão
 * 5. Vincular documentos aos eventos
 */
export async function mergeTimelines(
  caseId: string,
  linkedDocumentIds?: string[]
): Promise<TimelineUnificationResult> {
  const result: TimelineUnificationResult = {
    total: 0,
    new: 0,
    duplicates: 0,
    updated: 0,
    enriched: 0,
    related: 0,
    conflicts: 0,
  };

  const enricher = getTimelineEnricherService(prisma);

  try {
    console.log(
      `${ICONS.PROCESS} [Timeline Unifier v2] Unificando timeline para case ${caseId}`
    );

    // ============================================================
    // 1. BUSCAR CASE COM DADOS
    // ============================================================

    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        processo: true,
        timelineEntries: true,
      },
    });

    if (!caseData) {
      throw new Error(`Case ${caseId} não encontrado`);
    }

    // ============================================================
    // 2. EXTRAIR MOVIMENTOS DO JUDIT (PRIORIDADE 1)
    // ============================================================

    const juditMovements = extractMovementsFromJudit(
      caseData.processo?.dadosCompletos as any
    );

    console.log(
      `${ICONS.INFO} [Timeline Unifier v2] Movimentos JUDIT encontrados: ${juditMovements.length}`
    );

    // ============================================================
    // 3. CRIAR/ATUALIZAR EVENTOS JUDIT NO BANCO
    // ============================================================

    const juditEventIds: Map<string, string> = new Map(); // hash -> id

    for (const movement of juditMovements) {
      const normalizedContent = normalizeMovementContent(movement.description);
      const contentHash = generateContentHash(movement.date, normalizedContent);

      try {
        // JUDIT eventos são sempre base (nunca enriquecedores)
        const existing = await prisma.processTimelineEntry.findUnique({
          where: {
            caseId_contentHash: { caseId, contentHash },
          },
        });

        if (existing) {
          result.duplicates++;
          juditEventIds.set(contentHash, existing.id);
        } else {
          // Criar novo evento JUDIT
          const created = await prisma.processTimelineEntry.create({
            data: {
              caseId,
              contentHash,
              eventDate: movement.date,
              eventType: movement.type,
              description: movement.description,
              normalizedContent,
              source: 'API_JUDIT',
              sourceId: movement.sourceId,
              confidence: movement.confidence,
              metadata: movement.metadata,
              contributingSources: ['API_JUDIT'] as TimelineSource[],
              originalTexts: {
                API_JUDIT: movement.description,
              },
            },
          });

          result.new++;
          juditEventIds.set(contentHash, created.id);
        }
      } catch (error) {
        console.error(
          `${ICONS.ERROR} [Timeline Unifier v2] Erro ao processar JUDIT:`,
          error
        );
      }
    }

    // ============================================================
    // 4. EXTRAIR MOVIMENTOS DO PDF (PRIORIDADE 2)
    // ============================================================

    const pdfMovements = extractMovementsFromPreview(caseData.previewSnapshot as any);

    console.log(
      `${ICONS.INFO} [Timeline Unifier v2] Movimentos PDF encontrados: ${pdfMovements.length}`
    );

    // ============================================================
    // 5. ASSOCIAR E ENRIQUECER MOVIMENTOS PDF
    // ============================================================

    for (const movement of pdfMovements) {
      try {
        // Associar a evento JUDIT base
        const association = await enricher.associateToBaseEvent(
          movement,
          caseData.timelineEntries,
          caseId
        );

        result.total++;

        // ========== IDEMPOTÊNCIA: Se evento já foi processado pela v2, pular ==========
        // Evita reprocessar eventos antigos ou já enriquecidos
        if (association.baseEventId) {
          const baseEvent = await prisma.processTimelineEntry.findUnique({
            where: { id: association.baseEventId },
          });

          if (baseEvent && (baseEvent.isEnriched || baseEvent.enrichedByIds?.length)) {
            console.log(
              `${ICONS.INFO} [Timeline Unifier v2] Evento já processado pela v2, pulando enriquecimento novamente`
            );
            continue;
          }
        }

        // ========== CASO 1: ENRICHMENT ==========
        if (association.relationType === 'ENRICHMENT' && association.baseEventId) {
          const baseEvent = await prisma.processTimelineEntry.findUnique({
            where: { id: association.baseEventId },
          });

          if (!baseEvent) continue;

          // Tentar enriquecer descrição (com fallback)
          let enrichedDescription = baseEvent.description;
          let enrichmentModel: string | undefined = undefined;

          try {
            const enrichResult = await enricher.enrichDescription(
              baseEvent.description,
              movement.description,
              { source: movement.source as TimelineSource }
            );
            enrichedDescription = enrichResult.enrichedDescription;
            enrichmentModel = enrichResult.model;
          } catch (enrichError) {
            // Fallback: concatenar simples
            console.warn(
              `${ICONS.WARNING} [Timeline Unifier v2] Enriquecimento falhou, usando fallback`
            );
            enrichedDescription = `${baseEvent.description}\n---\n${movement.description}`;
          }

          // Atualizar evento base com enriquecimento
          await prisma.processTimelineEntry.update({
            where: { id: association.baseEventId },
            data: enricher.prepareEnrichmentData(baseEvent, movement, {
              enrichedDescription,
              model: enrichmentModel || 'gemini-1.5-flash',
            }),
          });

          result.enriched++;
          console.log(
            `${ICONS.SUCCESS} [Timeline Unifier v2] Evento enriquecido: ${baseEvent.eventType}`
          );
        }

        // ========== CASO 2: RELATED ==========
        else if (association.relationType === 'RELATED' && association.baseEventId) {
          // Criar novo evento relacionado
          const normalizedContent = normalizeMovementContent(movement.description);
          const contentHash = generateContentHash(movement.date, normalizedContent);

          const newEvent = await prisma.processTimelineEntry.create({
            data: {
              ...enricher.prepareRelatedEventData(association.baseEventId, movement),
              case: { connect: { id: caseId } },
              contentHash,
            },
          });

          result.related++;
          console.log(
            `${ICONS.INFO} [Timeline Unifier v2] Evento relacionado criado: ${newEvent.eventType}`
          );
        }

        // ========== CASO 3: CONFLICT ==========
        else if (association.relationType === 'CONFLICT' && association.baseEventId) {
          const baseEvent = await prisma.processTimelineEntry.findUnique({
            where: { id: association.baseEventId },
          });

          if (baseEvent) {
            const conflict = enricher.detectConflicts(baseEvent, movement);

            if (conflict) {
              await prisma.processTimelineEntry.update({
                where: { id: association.baseEventId },
                data: enricher.prepareConflictData(baseEvent, conflict, movement),
              });

              result.conflicts++;
              console.log(
                `${ICONS.WARNING} [Timeline Unifier v2] Conflito detectado: ${conflict.message}`
              );
            }
          }
        }

        // ========== CASO 4: SEM ASSOCIAÇÃO - NOVO EVENTO ==========
        else {
          const normalizedContent = normalizeMovementContent(movement.description);
          const contentHash = generateContentHash(movement.date, normalizedContent);

          await prisma.processTimelineEntry.create({
            data: {
              caseId,
              contentHash,
              eventDate: movement.date,
              eventType: movement.type,
              description: movement.description,
              normalizedContent,
              source: movement.source as TimelineSource,
              sourceId: movement.sourceId,
              confidence: movement.confidence,
              metadata: movement.metadata,
              contributingSources: [movement.source as TimelineSource],
              originalTexts: {
                [movement.source]: movement.description,
              },
            },
          });

          result.new++;
        }
      } catch (error) {
        console.error(
          `${ICONS.ERROR} [Timeline Unifier v2] Erro ao processar PDF:`,
          error
        );
      }
    }

    // ============================================================
    // 6. VINCULAR DOCUMENTOS (se passados)
    // ============================================================

    if (linkedDocumentIds && linkedDocumentIds.length > 0) {
      // Vincular apenas os eventos criados/atualizados nesta execução
      // Para simplificar, vinculamos todos os eventos PDF aos documentos
      const timelineEntries = await prisma.processTimelineEntry.findMany({
        where: {
          caseId,
          source: 'DOCUMENT_UPLOAD',
        },
      });

      for (const entry of timelineEntries) {
        await prisma.processTimelineEntry.update({
          where: { id: entry.id },
          data: {
            linkedDocumentIds: Array.from(
              new Set([...(entry.linkedDocumentIds || []), ...linkedDocumentIds])
            ),
          },
        });
      }

      console.log(
        `${ICONS.SUCCESS} [Timeline Unifier v2] ${timelineEntries.length} eventos vinculados a documentos`
      );
    }

    // ============================================================
    // 7. LOG FINAL
    // ============================================================

    console.log(`${ICONS.SUCCESS} [Timeline Unifier v2] Unificação completa:
      ${ICONS.INFO} Total analisados: ${result.total}
      ${ICONS.SUCCESS} Novos: ${result.new}
      ${ICONS.INFO} Duplicados: ${result.duplicates}
      ✨ Enriquecidos: ${result.enriched}
      🔗 Relacionados: ${result.related}
      ⚠️  Conflitos: ${result.conflicts}
      ${ICONS.INFO} Atualizados: ${result.updated}`);

    return result;
  } catch (error) {
    console.error(`${ICONS.ERROR} [Timeline Unifier v2] Erro geral:`, error);
    throw error;
  }
}

// ================================================================
// HELPER FUNCTIONS
// ================================================================

/**
 * Extrai movimentos do preview snapshot (Gemini Flash)
 */
function extractMovementsFromPreview(previewSnapshot: any): TimelineMovement[] {
  const movements: TimelineMovement[] = [];

  if (!previewSnapshot || !previewSnapshot.lastMovements) {
    return movements;
  }

  for (const mov of previewSnapshot.lastMovements) {
    try {
      movements.push({
        date: new Date(mov.date),
        type: mov.type || 'Movimento',
        description: mov.description || '',
        source: 'DOCUMENT_UPLOAD',
        confidence: previewSnapshot.confidence || 0.75,
        metadata: {
          extractedBy: 'preview',
          model: previewSnapshot.model,
        },
      });
    } catch (error) {
      console.warn(
        `${ICONS.WARNING} [Timeline Unifier v2] Movimento inválido no preview:`,
        mov
      );
    }
  }

  return movements;
}

/**
 * Extrai movimentos do JUDIT response
 */
function extractMovementsFromJudit(dadosCompletos: any): TimelineMovement[] {
  const movements: TimelineMovement[] = [];

  if (!dadosCompletos) {
    return movements;
  }

  try {
    const data = dadosCompletos.data || dadosCompletos;

    if (data.movements && Array.isArray(data.movements)) {
      for (const mov of data.movements) {
        movements.push({
          date: new Date(mov.date || mov.movement_date),
          type: mov.type || mov.movement_type || 'Movimento',
          description: mov.description || mov.movement_description || '',
          source: 'API_JUDIT',
          sourceId: mov.id || mov.movement_id,
          confidence: 1.0,
          metadata: {
            juditId: mov.id,
            rawData: mov,
          },
        });
      }
    }

    // Se houver paginação
    if (data.pages && Array.isArray(data.pages)) {
      for (const page of data.pages) {
        if (page.movements && Array.isArray(page.movements)) {
          for (const mov of page.movements) {
            movements.push({
              date: new Date(mov.date || mov.movement_date),
              type: mov.type || mov.movement_type || 'Movimento',
              description: mov.description || mov.movement_description || '',
              source: 'API_JUDIT',
              sourceId: mov.id || mov.movement_id,
              confidence: 1.0,
              metadata: {
                juditId: mov.id,
                page: page.page,
                rawData: mov,
              },
            });
          }
        }
      }
    }
  } catch (error) {
    console.error(
      `${ICONS.ERROR} [Timeline Unifier v2] Erro ao extrair JUDIT:`,
      error
    );
  }

  return movements;
}

/**
 * Normaliza conteúdo para comparação
 */
function normalizeMovementContent(description: string): string {
  return description
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^\w\s]/g, '') // Remove pontuação
    .replace(/\s+/g, ' ') // Normaliza espaços
    .trim();
}

/**
 * Gera hash único para deduplicação
 */
function generateContentHash(date: Date, normalizedContent: string): string {
  const dateStr = date.toISOString().split('T')[0];
  const combined = `${dateStr}|${normalizedContent.substring(0, 200)}`;

  return createHash('sha256').update(combined).digest('hex');
}
