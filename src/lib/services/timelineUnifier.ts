
// ================================================================
// TIMELINE UNIFIER SERVICE - V2 with Intelligent Enrichment
// Unifica movimentos de PDF + JUDIT com enriquecimento inteligente
// ================================================================

import { prisma } from '@/lib/prisma';
import { createHash } from 'crypto';
import { ICONS } from '@/lib/icons';
import { getTimelineEnricherService, TimelineMovement } from './timelineEnricher';
import { TimelineSource } from '@/lib/types/database';

// ================================================================
// TYPE DEFINITIONS FOR TYPE GUARDS
// ================================================================

interface PreviewSnapshot {
  summary: string;
  parties: string[];
  subject: string;
  object: string;
  claimValue: number | null;
  lastMovements: Array<{
    date: string;
    type: string;
    description: string;
  }>;
  generatedAt: string;
  model: string;
}

interface JuditResponseData {
  data?: {
    movements?: Array<Record<string, unknown>>;
    pages?: Array<{
      page?: number;
      movements?: Array<Record<string, unknown>>;
    }>;
  } | Record<string, unknown>;
}

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
// TYPE GUARDS
// ================================================================

/**
 * Type Guard: Validates if data is a valid PreviewSnapshot structure
 * Used to safely extract data from preview snapshot (unknown type)
 */
function isPreviewSnapshot(data: unknown): data is PreviewSnapshot {
  // Step 1: Check if data is an object
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  // Step 2: Safe property access using Record cast after type check
  const obj = data as Record<string, unknown>;

  // Step 3: Validate required fields
  if (typeof obj.summary !== 'string' || obj.summary.trim().length === 0) {
    return false;
  }

  if (typeof obj.subject !== 'string' || obj.subject.trim().length === 0) {
    return false;
  }

  if (typeof obj.object !== 'string' || obj.object.trim().length === 0) {
    return false;
  }

  // Step 4: Validate parties array
  if (!Array.isArray(obj.parties) || obj.parties.length === 0) {
    return false;
  }

  if (!obj.parties.every((p) => typeof p === 'string')) {
    return false;
  }

  // Step 5: Validate claimValue (number or null)
  if (obj.claimValue !== null && typeof obj.claimValue !== 'number') {
    return false;
  }

  // Step 6: Validate lastMovements array structure
  if (!Array.isArray(obj.lastMovements)) {
    return false;
  }

  for (const mov of obj.lastMovements) {
    if (typeof mov !== 'object' || mov === null) {
      return false;
    }

    const m = mov as Record<string, unknown>;

    if (typeof m.date !== 'string' || typeof m.type !== 'string' || typeof m.description !== 'string') {
      return false;
    }
  }

  return true;
}

/**
 * Type Guard: Validates if data is a valid JUDIT response structure
 * Used to safely extract data from JUDIT API response (unknown type)
 */
function isJuditResponse(data: unknown): data is JuditResponseData {
  // Step 1: Check if data is an object
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  // Step 2: Safe property access after type check
  const obj = data as Record<string, unknown>;

  // Step 3: Either has data property or is the data itself
  // If it has .data, it must be an object
  if ('data' in obj) {
    if (typeof obj.data !== 'object' || obj.data === null) {
      return false;
    }
  }

  return true;
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

    // Type Guard: Validate JUDIT response before extracting movements
    if (!isJuditResponse(caseData.processo?.dadosCompletos)) {
      console.warn(`${ICONS.WARNING} [Timeline Unifier v2] JUDIT data inválido ou ausente`);
    }

    const juditMovements = extractMovementsFromJudit(
      caseData.processo?.dadosCompletos
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
          // Safe JSON serialization for Prisma Json field
          const metadataForDb = movement.metadata ? JSON.parse(JSON.stringify(movement.metadata)) : {};

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
              metadata: metadataForDb,
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

    // Type Guard: Validate preview snapshot before extracting movements
    if (!isPreviewSnapshot(caseData.previewSnapshot)) {
      console.warn(`${ICONS.WARNING} [Timeline Unifier v2] Preview snapshot inválido ou ausente`);
    }

    const pdfMovements = extractMovementsFromPreview(caseData.previewSnapshot);

    console.log(
      `${ICONS.INFO} [Timeline Unifier v2] Movimentos PDF encontrados: ${pdfMovements.length}`
    );

    // ============================================================
    // 5. ASSOCIAR E ENRIQUECER MOVIMENTOS PDF
    // ============================================================

    for (const movement of pdfMovements) {
      try {
        // Associar a evento JUDIT base
        // Note: enricher.associateToBaseEvent expects 2 arguments, not 3
        const association = await enricher.associateToBaseEvent(
          movement,
          caseData.timelineEntries
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
          } catch {
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

          // Prepare data from enricher and add safe JSON serialization
          const relatedEventData = enricher.prepareRelatedEventData(association.baseEventId, movement);

          // Safe JSON serialization for metadata
          const metadataForDb = relatedEventData.metadata
            ? JSON.parse(JSON.stringify(relatedEventData.metadata))
            : {};

          // Type-safe data construction for Prisma
          const newEvent = await prisma.processTimelineEntry.create({
            data: {
              caseId,
              contentHash,
              eventDate: relatedEventData.eventDate || movement.date,
              eventType: relatedEventData.eventType || movement.type,
              description: relatedEventData.description || movement.description,
              normalizedContent: relatedEventData.normalizedContent || normalizedContent,
              source: (relatedEventData.source || movement.source) as TimelineSource,
              sourceId: relatedEventData.sourceId,
              confidence: relatedEventData.confidence || 0.5,
              metadata: metadataForDb,
              relationType: relatedEventData.relationType,
              contributingSources: (relatedEventData.contributingSources || []) as TimelineSource[],
              originalTexts: (relatedEventData.originalTexts || {}) as Record<string, string>,
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

          // Safe JSON serialization for metadata
          const metadataForDb = movement.metadata
            ? JSON.parse(JSON.stringify(movement.metadata))
            : {};

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
              metadata: metadataForDb,
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
 * Usa Type Guard para validar estrutura de dados
 */
function extractMovementsFromPreview(previewSnapshot: unknown): TimelineMovement[] {
  const movements: TimelineMovement[] = [];

  // Type Guard: Validate preview snapshot structure
  if (!isPreviewSnapshot(previewSnapshot)) {
    return movements;
  }

  // Now previewSnapshot is safely typed as PreviewSnapshot
  for (const mov of previewSnapshot.lastMovements) {
    try {
      movements.push({
        date: new Date(mov.date),
        type: mov.type || 'Movimento',
        description: mov.description || '',
        source: 'DOCUMENT_UPLOAD',
        confidence: 0.75, // Default confidence for document uploads
        metadata: {
          extractedBy: 'preview',
          model: previewSnapshot.model,
        },
      });
    } catch {
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
 * Usa Type Guard para validar estrutura de dados
 */
function extractMovementsFromJudit(dadosCompletos: unknown): TimelineMovement[] {
  const movements: TimelineMovement[] = [];

  // Type Guard: Validate JUDIT response structure
  if (!isJuditResponse(dadosCompletos)) {
    return movements;
  }

  // Now dadosCompletos is safely typed as JuditResponseData
  try {
    // Extract either from .data property or use the object itself
    const obj = dadosCompletos as Record<string, unknown>;
    const data = (typeof obj.data === 'object' && obj.data !== null ? obj.data : obj) as Record<string, unknown>;

    // Extract movements array
    if (Array.isArray(data.movements)) {
      for (const mov of data.movements) {
        if (typeof mov !== 'object' || mov === null) continue;

        const m = mov as Record<string, unknown>;
        const dateValue = m.date || m.movement_date;
        const typeValue = m.type || m.movement_type;
        const descValue = m.description || m.movement_description;
        const idValue = m.id || m.movement_id;

        // Only push if we have at least date and type
        if (dateValue && typeValue) {
          movements.push({
            date: new Date(String(dateValue)),
            type: String(typeValue),
            description: String(descValue || ''),
            source: 'API_JUDIT',
            sourceId: String(idValue || ''),
            confidence: 1.0,
            metadata: {
              juditId: idValue,
              rawData: m,
            },
          });
        }
      }
    }

    // Extract from pages if available
    if (Array.isArray(data.pages)) {
      for (const page of data.pages) {
        if (typeof page !== 'object' || page === null) continue;

        const p = page as Record<string, unknown>;

        if (Array.isArray(p.movements)) {
          for (const mov of p.movements) {
            if (typeof mov !== 'object' || mov === null) continue;

            const m = mov as Record<string, unknown>;
            const dateValue = m.date || m.movement_date;
            const typeValue = m.type || m.movement_type;
            const descValue = m.description || m.movement_description;
            const idValue = m.id || m.movement_id;

            // Only push if we have at least date and type
            if (dateValue && typeValue) {
              movements.push({
                date: new Date(String(dateValue)),
                type: String(typeValue),
                description: String(descValue || ''),
                source: 'API_JUDIT',
                sourceId: String(idValue || ''),
                confidence: 1.0,
                metadata: {
                  juditId: idValue,
                  page: p.page,
                  rawData: m,
                },
              });
            }
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
