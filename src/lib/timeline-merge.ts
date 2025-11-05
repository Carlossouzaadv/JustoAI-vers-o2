/* eslint-disable @typescript-eslint/no-explicit-unknown */
// ================================================================
// TIMELINE MERGE SERVICE - Timeline Unificada Inteligente
// ================================================================
// Implementa deduplicação inteligente e ordenação cronológica
// de andamentos processuais de múltiplas fontes
// NOTE: This file uses unknown types due to complex Prisma query results.
// TODO: Refactor with proper Prisma types when time allows.

import { getDocumentHashManager } from './document-hash';
import { ICONS } from './icons';
import type { PrismaClient, ProcessTimelineEntry } from '@prisma/client';

export interface TimelineEntry {
  eventDate: Date;
  eventType: string;
  description: string;
  source: 'DOCUMENT_UPLOAD' | 'API_JUDIT' | 'MANUAL_ENTRY' | 'SYSTEM_IMPORT' | 'AI_EXTRACTION';
  sourceId?: string;
  metadata?: Record<string, unknown>;
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
   * Helper: Aguarda um tempo com backoff exponencial
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Tenta recuperar uma entrada com retry e backoff exponencial
   * Útil quando race condition deixa entry não imediatamente disponível
   */
  private async findEntryWithRetry(
    prisma: PrismaClient,
    caseId: string,
    contentHash: string,
    maxRetries: number = 3
  ): Promise<ProcessTimelineEntry | null> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const entry = await prisma.processTimelineEntry.findUnique({
        where: {
          caseId_contentHash: {
            caseId,
            contentHash
          }
        }
      });

      if (entry) {
        if (attempt > 0) {
          console.log(
            `${ICONS.INFO} Entrada encontrada após retry #${attempt}`
          );
        }
        return entry;
      }

      // Se não encontrou e ainda há tentativas, aguardar com backoff
      if (attempt < maxRetries - 1) {
        const delayMs = Math.pow(2, attempt) * 100; // 100ms, 200ms, 400ms
        console.log(
          `${ICONS.WARNING} Entrada não encontrada na tentativa ${attempt + 1}. Aguardando ${delayMs}ms antes de retry...`
        );
        await this.sleep(delayMs);
      }
    }

    return null;
  }

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
    existing: unknown,
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
   * Usa abordagem otimista com tratamento robusto de race conditions
   */
  async mergeEntries(
    caseId: string,
    entries: TimelineEntry[],
    prisma: unknown
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
        let existingEntry = await prisma.processTimelineEntry.findUnique({
          where: {
            caseId_contentHash: {
              caseId,
              contentHash
            }
          }
        });

        if (existingEntry) {
          // Tentar mesclar inteligentemente
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
              `${ICONS.INFO} Entrada duplicada mesclada: ${entry.eventType} - ${entry.eventDate.toLocaleDateString()}`
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
            // Não houve mudanças
            duplicatesSkipped++;
            console.log(
              `${ICONS.WARNING} Entrada duplicada sem mudanças: ${entry.eventType} - ${entry.eventDate.toLocaleDateString()}`
            );
          }
          continue;
        }

        // Tentar criar nova entrada
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

          newEntries++;
          console.log(`${ICONS.SUCCESS} Nova entrada adicionada: ${entry.eventType} - ${entry.eventDate.toLocaleDateString()}`);

          mergedEntries.push({
            id: newEntry.id,
            eventDate: newEntry.eventDate,
            eventType: newEntry.eventType,
            description: newEntry.description,
            source: newEntry.source,
            confidence: newEntry.confidence
          });

        } catch (createError: unknown) {
          // Se houver erro de constraint única, outra requisição criou a entrada
          // Recuperar e tentar merge com retry
          if (createError?.code === 'P2002') {
            console.log(
              `${ICONS.INFO} Race condition detectada: Recuperando entrada criada por outra requisição para ${entry.eventType} - ${entry.eventDate.toLocaleDateString()}`
            );

            // Recuperar a entrada que foi criada pela outra requisição com retry
            existingEntry = await this.findEntryWithRetry(prisma, caseId, contentHash);

            if (existingEntry) {
              // Tentar merge com a entrada recuperada
              const { merged, changed } = this.mergeIntelligently(existingEntry, entry);

              if (changed) {
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
                  `${ICONS.INFO} Entrada recuperada e mesclada via race condition recovery: ${entry.eventType}`
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
                duplicatesSkipped++;
                console.log(
                  `${ICONS.INFO} Entrada recuperada mas sem mudanças: ${entry.eventType}`
                );
              }
            } else {
              // PROBLEMA: Não conseguiu recuperar a entrada mesmo com retries!
              // Isso é crítico - significa que o erro foi levantado mas a entrada não existe
              // após múltiplas tentativas. Pode indicar problema no banco de dados.
              console.error(
                `${ICONS.ERROR} CRÍTICO: Race condition mas entrada não encontrada após ${3} retries! caseId=${caseId}, hash=${contentHash}, event=${entry.eventType}. Possível problema com banco de dados ou replicação.`
              );
              duplicatesSkipped++;
            }
          } else {
            // Re-throw se for erro diferente
            console.error(
              `${ICONS.ERROR} Erro ao criar entrada (não é P2002):`,
              { code: createError?.code, message: createError?.message }
            );
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
    prisma: unknown,
    options: {
      limit?: number;
      offset?: number;
      since?: Date;
      sources?: string[];
    } = {}
  ) {
    const whereClause: unknown = { caseId };

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
  extractTimelineFromAIAnalysis(aiResult: unknown, sourceId: string): TimelineEntry[] {
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
    details: unknown,
    prisma: unknown
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