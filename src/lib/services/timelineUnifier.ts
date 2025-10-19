// ================================================================
// TIMELINE UNIFIER SERVICE
// Unifica movimentos de PDF + JUDIT evitando duplicatas
// ================================================================

import { prisma } from '@/lib/prisma';
import { createHash } from 'crypto';
import { ICONS } from '@/lib/icons';

// ================================================================
// TYPES
// ================================================================

export interface TimelineMovement {
  date: Date;
  type: string;
  description: string;
  source: 'DOCUMENT_UPLOAD' | 'API_JUDIT' | 'MANUAL_ENTRY';
  sourceId?: string;
  confidence: number;
  metadata?: any;
}

export interface TimelineUnificationResult {
  total: number;
  new: number;
  duplicates: number;
  updated: number;
}

// ================================================================
// MAIN FUNCTION
// ================================================================

/**
 * Unifica timeline de um caso mesclando movimentos do PDF preview e JUDIT
 * Usa contentHash para deduplicação
 */
export async function mergeTimelines(caseId: string): Promise<TimelineUnificationResult> {
  const result: TimelineUnificationResult = {
    total: 0,
    new: 0,
    duplicates: 0,
    updated: 0
  };

  try {
    console.log(`${ICONS.PROCESS} [Timeline Unifier] Unificando timeline para case ${caseId}`);

    // ============================================================
    // 1. BUSCAR CASE COM DADOS
    // ============================================================

    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        processo: true
      }
    });

    if (!caseData) {
      throw new Error(`Case ${caseId} não encontrado`);
    }

    // ============================================================
    // 2. EXTRAIR MOVIMENTOS DO PREVIEW (PDF)
    // ============================================================

    const pdfMovements = extractMovementsFromPreview(caseData.previewSnapshot as any);

    console.log(`${ICONS.INFO} [Timeline Unifier] Movimentos do PDF: ${pdfMovements.length}`);

    // ============================================================
    // 3. EXTRAIR MOVIMENTOS DO JUDIT
    // ============================================================

    const juditMovements = extractMovementsFromJudit(caseData.processo?.dadosCompletos as any);

    console.log(`${ICONS.INFO} [Timeline Unifier] Movimentos do JUDIT: ${juditMovements.length}`);

    // ============================================================
    // 4. UNIFICAR E NORMALIZAR
    // ============================================================

    const allMovements = [...pdfMovements, ...juditMovements];
    result.total = allMovements.length;

    // ============================================================
    // 5. INSERIR/ATUALIZAR NO BANCO (UPSERT)
    // ============================================================

    for (const movement of allMovements) {
      const normalizedContent = normalizeMovementContent(movement.description);
      const contentHash = generateContentHash(movement.date, normalizedContent);

      try {
        // Tentar buscar existente
        const existing = await prisma.processTimelineEntry.findUnique({
          where: {
            caseId_contentHash: {
              caseId,
              contentHash
            }
          }
        });

        if (existing) {
          // Duplicata detectada
          result.duplicates++;

          // Atualizar se a nova fonte tem maior confiança
          if (movement.confidence > existing.confidence) {
            await prisma.processTimelineEntry.update({
              where: { id: existing.id },
              data: {
                confidence: movement.confidence,
                source: movement.source,
                sourceId: movement.sourceId,
                metadata: movement.metadata,
                updatedAt: new Date()
              }
            });

            result.updated++;
          }

        } else {
          // Novo movimento
          await prisma.processTimelineEntry.create({
            data: {
              caseId,
              contentHash,
              eventDate: movement.date,
              eventType: movement.type,
              description: movement.description,
              normalizedContent,
              source: movement.source,
              sourceId: movement.sourceId,
              confidence: movement.confidence,
              metadata: movement.metadata
            }
          });

          result.new++;
        }

      } catch (error) {
        console.error(`${ICONS.ERROR} [Timeline Unifier] Erro ao processar movimento:`, error);
      }
    }

    console.log(`${ICONS.SUCCESS} [Timeline Unifier] Unificação completa: ${result.new} novos, ${result.duplicates} duplicados, ${result.updated} atualizados`);

    return result;

  } catch (error) {
    console.error(`${ICONS.ERROR} [Timeline Unifier] Erro geral:`, error);
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
          model: previewSnapshot.model
        }
      });
    } catch (error) {
      console.warn(`${ICONS.WARNING} [Timeline Unifier] Movimento inválido no preview:`, mov);
    }
  }

  return movements;
}

/**
 * Extrai movimentos do JUDIT response
 * Estrutura pode variar - ajustar conforme API real
 */
function extractMovementsFromJudit(dadosCompletos: any): TimelineMovement[] {
  const movements: TimelineMovement[] = [];

  if (!dadosCompletos) {
    return movements;
  }

  try {
    // Estrutura esperada (ajustar conforme API JUDIT):
    // dadosCompletos.data.movements[] ou similar

    const data = dadosCompletos.data || dadosCompletos;

    if (data.movements && Array.isArray(data.movements)) {
      for (const mov of data.movements) {
        movements.push({
          date: new Date(mov.date || mov.movement_date),
          type: mov.type || mov.movement_type || 'Movimento',
          description: mov.description || mov.movement_description || '',
          source: 'API_JUDIT',
          sourceId: mov.id || mov.movement_id,
          confidence: 1.0, // JUDIT tem alta confiança (dados oficiais)
          metadata: {
            juditId: mov.id,
            rawData: mov
          }
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
                rawData: mov
              }
            });
          }
        }
      }
    }

  } catch (error) {
    console.error(`${ICONS.ERROR} [Timeline Unifier] Erro ao extrair movimentos JUDIT:`, error);
  }

  return movements;
}

/**
 * Normaliza conteúdo de movimento para comparação
 * Remove pontuação, espaços extras, converte para lowercase
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
 * Baseado em data + conteúdo normalizado
 */
function generateContentHash(date: Date, normalizedContent: string): string {
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
  const combined = `${dateStr}|${normalizedContent.substring(0, 200)}`; // Primeiros 200 chars

  return createHash('sha256')
    .update(combined)
    .digest('hex');
}
