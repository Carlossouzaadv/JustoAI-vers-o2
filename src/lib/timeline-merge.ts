// ================================================================
// TIMELINE MERGE SERVICE - Timeline Unificada Inteligente
// ================================================================
// Implementa deduplicação inteligente e ordenação cronológica
// de andamentos processuais de múltiplas fontes

import { getDocumentHashManager } from './document-hash';
import { ICONS } from './icons';

export interface TimelineEntry {
  eventDate: Date;
  eventType: string;
  description: string;
  source: 'DOCUMENT_UPLOAD' | 'API_JUDIT' | 'MANUAL_ENTRY' | 'SYSTEM_IMPORT' | 'AI_EXTRACTION';
  sourceId?: string;
  metadata?: any;
  confidence?: number;
}

export interface TimelineMergeResult {
  newEntries: number;
  duplicatesSkipped: number;
  totalEntries: number;
  mergedEntries: Array<{
    id: string;
    eventDate: Date;
    eventType: string;
    description: string;
    source: string;
    confidence: number;
  }>;
}

export class TimelineMergeService {
  private hashManager = getDocumentHashManager();

  /**
   * Função de prioridade para ordenar fontes
   * Fonte com maior prioridade = mais confiável
   */
  private getSourcePriority(source: TimelineEntry['source']): number {
    const priorities: Record<TimelineEntry['source'], number> = {
      'API_JUDIT': 10, // Fonte oficial - maior prioridade
      'DOCUMENT_UPLOAD': 8, // Documento do processo
      'AI_EXTRACTION': 6, // Extração por IA
      'SYSTEM_IMPORT': 5, // Importação de sistema
      'MANUAL_ENTRY': 3, // Entrada manual - menor prioridade
    };
    return priorities[source] || 0;
  }

  /**
   * Mescla inteligentemente informações de múltiplas fontes
   * Combina descrições e usa dados de melhor fonte
   */
  private mergeIntelligently(
    existing: any,
    newEntry: TimelineEntry
  ): { merged: TimelineEntry; changed: boolean } {
    const existingPriority = this.getSourcePriority(existing.source);
    const newPriority = this.getSourcePriority(newEntry.source);

    // Usar data da fonte com maior prioridade
    const eventDate =
      newPriority > existingPriority
        ? newEntry.eventDate
        : existing.eventDate;

    // Usar tipo do evento da fonte com maior prioridade
    const eventType =
      newPriority > existingPriority
        ? newEntry.eventType
        : existing.eventType;

    // Combinar descrições se forem diferentes
    let description = existing.description;
    const isDescriptionDifferent =
      newEntry.description.toLowerCase() !== existing.description.toLowerCase();

    if (isDescriptionDifferent && newEntry.description) {
      // Adicionar descrição nova como referência adicional
      description = `${existing.description} [${newEntry.source}: ${newEntry.description}]`;
    }

    // Usar maior confiança
    const confidence = Math.max(
      newEntry.confidence || 1.0,
      existing.confidence || 1.0
    );

    // Mesclar metadados
    const mergedMetadata = {
      ...(existing.metadata || {}),
      ...(newEntry.metadata || {}),
      sources: [
        ...(existing.metadata?.sources || [{ source: existing.source, date: existing.createdAt }]),
        { source: newEntry.source, date: new Date(), description: newEntry.description }
      ],
      lastMerged: new Date().toISOString()
    };

    const merged: TimelineEntry = {
      eventDate,
      eventType,
      description,
      source: newPriority > existingPriority ? newEntry.source : existing.source,
      sourceId: newEntry.sourceId || existing.sourceId,
      metadata: mergedMetadata,
      confidence
    };

    const changed =
      merged.eventDate !== existing.eventDate ||
      merged.eventType !== existing.eventType ||
      merged.description !== existing.description ||
      merged.source !== existing.source;

    return { merged, changed };
  }

  /**
   * Adiciona entradas à timeline com deduplicação automática E mesclagem inteligente
   */
  async mergeEntries(
    caseId: string,
    entries: TimelineEntry[],
    prisma: any
  ): Promise<TimelineMergeResult> {
    console.log(`${ICONS.PROCESS} Mesclando ${entries.length} entradas na timeline do caso ${caseId}`);

    let newEntries = 0;
    let duplicatesSkipped = 0;
    let mergedDuplicates = 0;
    const mergedEntries = [];

    for (const entry of entries) {
      try {
        // Normalizar conteúdo para deduplicação
        const normalizedContent = this.hashManager.normalizeForTimeline(
          `${entry.eventType}_${entry.description}_${entry.eventDate.toISOString().split('T')[0]}`
        );

        const contentHash = this.hashManager.generateContentHash(normalizedContent);

        // Verificar se entrada já existe
        const existingEntry = await prisma.processTimelineEntry.findUnique({
          where: {
            caseId_contentHash: {
              caseId,
              contentHash
            }
          }
        });

        if (existingEntry) {
          // Tentar mesclar inteligentemente ao invés de apenas descartar
          const { merged, changed } = this.mergeIntelligently(existingEntry, entry);

          if (changed) {
            // Atualizar entrada existente com dados mesclados
            const updatedEntry = await prisma.processTimelineEntry.update({
              where: { id: existingEntry.id },
              data: {
                eventDate: merged.eventDate,
                eventType: merged.eventType,
                description: merged.description,
                source: merged.source,
                metadata: merged.metadata,
                confidence: merged.confidence,
                normalizedContent: this.hashManager.normalizeForTimeline(
                  `${merged.eventType}_${merged.description}_${merged.eventDate.toISOString().split('T')[0]}`
                )
              }
            });

            mergedDuplicates++;
            console.log(
              `${ICONS.INFO} Entrada duplicada mesclada inteligentemente: ${entry.eventType} - ${entry.eventDate.toLocaleDateString()}`
            );

            mergedEntries.push({
              id: updatedEntry.id,
              eventDate: updatedEntry.eventDate,
              eventType: updatedEntry.eventType,
              description: updatedEntry.description,
              source: updatedEntry.source,
              confidence: updatedEntry.confidence
            });
          } else {
            // Não houve mudanças na mesclagem
            duplicatesSkipped++;
            console.log(
              `${ICONS.WARNING} Entrada duplicada sem mudanças: ${entry.eventType} - ${entry.eventDate.toLocaleDateString()}`
            );
          }
          continue;
        }

        // Criar nova entrada (com tratamento de race condition)
        try {
          const newEntry = await prisma.processTimelineEntry.create({
            data: {
              caseId,
              contentHash,
              eventDate: entry.eventDate,
              eventType: entry.eventType,
              description: entry.description,
              normalizedContent,
              source: entry.source,
              sourceId: entry.sourceId,
              metadata: entry.metadata || {},
              confidence: entry.confidence || 1.0
            }
          });

          mergedEntries.push({
            id: newEntry.id,
            eventDate: newEntry.eventDate,
            eventType: newEntry.eventType,
            description: newEntry.description,
            source: newEntry.source,
            confidence: newEntry.confidence
          });

          newEntries++;
          console.log(`${ICONS.SUCCESS} Nova entrada adicionada: ${entry.eventType} - ${entry.eventDate.toLocaleDateString()}`);
        } catch (createError: any) {
          // Tratar race condition: se houver erro de constraint única, significa que outra requisição
          // criou a entrada entre o findUnique e o create. Isso não é um erro real.
          if (createError?.code === 'P2002' && createError?.meta?.target?.includes('content_hash')) {
            console.log(
              `${ICONS.INFO} Entrada criada por outra requisição: ${entry.eventType} - ${entry.eventDate.toLocaleDateString()}`
            );
            duplicatesSkipped++;
          } else {
            // Re-throw se for um erro diferente
            throw createError;
          }
        }

      } catch (error) {
        console.error(`${ICONS.ERROR} Erro ao processar entrada:`, error);
        // Continuar processamento mesmo com erro em uma entrada
      }
    }

    // Obter total de entradas após merge
    const totalEntries = await prisma.processTimelineEntry.count({
      where: { caseId }
    });

    console.log(
      `${ICONS.SUCCESS} Timeline merge concluído: ${newEntries} novas, ${mergedDuplicates} mescladas, ${duplicatesSkipped} ignoradas, ${totalEntries} total`
    );

    return {
      newEntries: newEntries + mergedDuplicates,
      duplicatesSkipped,
      totalEntries,
      mergedEntries
    };
  }

  /**
   * Obtém timeline ordenada cronologicamente
   */
  async getTimelineEntries(
    caseId: string,
    prisma: any,
    options: {
      limit?: number;
      offset?: number;
      since?: Date;
      sources?: string[];
    } = {}
  ) {
    const whereClause: any = { caseId };

    if (options.since) {
      whereClause.eventDate = { gte: options.since };
    }

    if (options.sources && options.sources.length > 0) {
      whereClause.source = { in: options.sources };
    }

    const entries = await prisma.processTimelineEntry.findMany({
      where: whereClause,
      orderBy: [
        { eventDate: 'desc' },
        { createdAt: 'desc' }
      ],
      take: options.limit || 50,
      skip: options.offset || 0,
      select: {
        id: true,
        eventDate: true,
        eventType: true,
        description: true,
        source: true,
        sourceId: true,
        metadata: true,
        confidence: true,
        createdAt: true
      }
    });

    return entries;
  }

  /**
   * Extrai andamentos de texto analisado por IA
   */
  extractTimelineFromAIAnalysis(aiResult: any, sourceId: string): TimelineEntry[] {
    const entries: TimelineEntry[] = [];

    try {
      // Verificar se há andamentos extraídos no resultado da IA
      const rawEvents = aiResult.raw_events_extracted || aiResult.events || [];

      for (const event of rawEvents) {
        try {
          // Tentar parsear data em diferentes formatos
          let eventDate: Date;

          if (event.data_andamento) {
            // Formato brasileiro DD/MM/AAAA
            const [day, month, year] = event.data_andamento.split('/');
            eventDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          } else if (event.date) {
            eventDate = new Date(event.date);
          } else {
            // Se não há data, usar data atual como fallback
            eventDate = new Date();
          }

          // Validar data
          if (isNaN(eventDate.getTime())) {
            console.warn(`${ICONS.WARNING} Data inválida para evento: ${event.tipo_andamento || event.type}`);
            continue;
          }

          entries.push({
            eventDate,
            eventType: event.tipo_andamento || event.type || 'Andamento',
            description: event.resumo_andamento || event.description || 'Sem descrição',
            source: 'AI_EXTRACTION',
            sourceId,
            metadata: {
              extracted_from: 'ai_analysis',
              confidence: event.confidence || 0.8,
              original_data: event
            },
            confidence: event.confidence || 0.8
          });

        } catch (eventError) {
          console.warn(`${ICONS.WARNING} Erro ao processar evento individual:`, eventError);
        }
      }

      console.log(`${ICONS.SUCCESS} Extraídos ${entries.length} andamentos da análise IA`);

    } catch (error) {
      console.error(`${ICONS.ERROR} Erro na extração de timeline da IA:`, error);
    }

    return entries;
  }

  /**
   * Registra evento de auditoria
   */
  async logAuditEvent(
    type: 'duplicate_upload' | 'new_upload' | 'timeline_merge',
    details: any,
    prisma: any
  ) {
    try {
      await prisma.globalLog.create({
        data: {
          level: 'INFO',
          category: 'UPLOAD',
          message: `Timeline event: ${type}`,
          data: details // Use 'data' field - GlobalLog schema only has 'data: Json?'
        }
      });
    } catch (error) {
      console.error(`${ICONS.ERROR} Erro ao registrar auditoria:`, error);
      // Silently fail - don't let audit logging block document upload
    }
  }
}

// Singleton para reutilização
let timelineMergeService: TimelineMergeService | null = null;

export function getTimelineMergeService(): TimelineMergeService {
  if (!timelineMergeService) {
    timelineMergeService = new TimelineMergeService();
  }
  return timelineMergeService;
}