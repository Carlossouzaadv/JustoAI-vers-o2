
// ================================================================
// TIMELINE MERGE SERVICE - Timeline Unificada Inteligente
// ================================================================
// Implementa deduplicação inteligente e ordenação cronológica
// de andamentos processuais de múltiplas fontes

import { getDocumentHashManager } from './document-hash';
import { ICONS } from './icons';
import { PrismaClient } from '@prisma/client'
import {
  isTimelineMergedMetadata,
  isTimelineSourceMetadata,
  type TimelineSourceMetadata,
} from './types/type-guards';
import { log, logError } from '@/lib/services/logger';

export interface TimelineEntry {
  eventDate: Date;
  eventType: string;
  description: string;
  source: 'DOCUMENT_UPLOAD' | 'API_JUDIT' | 'MANUAL_ENTRY' | 'SYSTEM_IMPORT' | 'AI_EXTRACTION';
  sourceId?: string;
  metadata?: Record<string, unknown>;
  confidence?: number;
}

export interface AIAnalysisEvent {
  data_andamento?: string;
  date?: string | Date;
  tipo_andamento?: string;
  type?: string;
  resumo_andamento?: string;
  description?: string;
  confidence?: number;
}

export interface AIAnalysisResult {
  raw_events_extracted?: AIAnalysisEvent[];
  events?: AIAnalysisEvent[];
  [key: string]: unknown;
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

/**
 * Type Guard: Validates that a string is a valid TimelineEntry source
 * Uses narrowing to ensure runtime safety without casting
 */
function isValidTimelineEntrySource(value: unknown): value is TimelineEntry['source'] {
  if (typeof value !== 'string') {
    return false;
  }
  const validSources: readonly TimelineEntry['source'][] = [
    'DOCUMENT_UPLOAD',
    'API_JUDIT',
    'MANUAL_ENTRY',
    'SYSTEM_IMPORT',
    'AI_EXTRACTION',
  ];
  return validSources.includes(value as TimelineEntry['source']);
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
   * Retorna o tipo completo do Prisma (inferido automaticamente)
   */
  private async findEntryWithRetry(
    prisma: PrismaClient,
    caseId: string,
    contentHash: string,
    maxRetries: number = 3
  ) {
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
          log.info({ msg: '${ICONS.INFO} Entrada encontrada após retry #${attempt}', component: 'timelineMerge' });
        }
        return entry;
      }

      // Se não encontrou e ainda há tentativas, aguardar com backoff
      if (attempt < maxRetries - 1) {
        const delayMs = Math.pow(2, attempt) * 100; // 100ms, 200ms, 400ms
        log.info({ msg: '${ICONS.WARNING} Entrada não encontrada na tentativa ${attempt + 1}. Aguardando ${delayMs}ms antes de retry...', component: 'timelineMerge' });
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
   * Valida metadados antes de fazer spread operators
   */
  private mergeIntelligently(
    existing: TimelineEntry,
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

    // Mesclar metadados com validação
    // Validar metadados existentes antes de usar
    const validatedExistingMetadata = existing.metadata && isTimelineMergedMetadata(existing.metadata)
      ? existing.metadata
      : {};
    const validatedNewMetadata = newEntry.metadata && isTimelineMergedMetadata(newEntry.metadata)
      ? newEntry.metadata
      : {};

    // Construir sources array validado
    const existingSources: TimelineSourceMetadata[] = [];
    if (validatedExistingMetadata.sources && Array.isArray(validatedExistingMetadata.sources)) {
      for (const source of validatedExistingMetadata.sources) {
        if (isTimelineSourceMetadata(source)) {
          existingSources.push(source);
        }
      }
    }

    // Se não há sources, criar um a partir da entrada existente
    if (existingSources.length === 0) {
      existingSources.push({
        source: existing.source,
        date: existing.eventDate,
      });
    }

    // Adicionar novo source
    existingSources.push({
      source: newEntry.source,
      date: new Date(),
      description: newEntry.description,
    });

    // Mesclar metadados com type safety
    const mergedMetadata: Record<string, unknown> = {
      ...validatedExistingMetadata,
      ...validatedNewMetadata,
      sources: existingSources,
      lastMerged: new Date().toISOString(),
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
    prisma: PrismaClient
  ): Promise<TimelineMergeResult> {
    log.info({ msg: '${ICONS.PROCESS} Mesclando ${entries.length} entradas na timeline do caso ${caseId}', component: 'timelineMerge' });

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
          // Convert Prisma result to TimelineEntry with safe type narrowing
          // Validate source using type guard before constructing object
          if (!isValidTimelineEntrySource(existingEntry.source)) {
            log.warn({ msg: '${ICONS.WARNING} Entrada com source inválido: ${existingEntry.source}. Pulando merge.', component: 'timelineMerge' });
            continue;
          }

          const existingAsTimelineEntry: TimelineEntry = {
            eventDate: existingEntry.eventDate,
            eventType: existingEntry.eventType,
            description: existingEntry.description,
            source: existingEntry.source, // Now guaranteed to be valid by type guard
            sourceId: existingEntry.sourceId ?? undefined,
            metadata: typeof existingEntry.metadata === 'object' && existingEntry.metadata !== null
              ? (existingEntry.metadata as Record<string, unknown>)
              : undefined,
            confidence: existingEntry.confidence,
          };
          const { merged, changed } = this.mergeIntelligently(existingAsTimelineEntry, entry);

          if (changed) {
            // Atualizar entrada existente com dados mesclados
            const updatedEntry = await prisma.processTimelineEntry.update({
              where: { id: existingEntry.id },
              data: {
                eventDate: merged.eventDate,
                eventType: merged.eventType,
                description: merged.description,
                source: merged.source,
                metadata: merged.metadata ? JSON.parse(JSON.stringify(merged.metadata)) : undefined,
                confidence: merged.confidence,
                normalizedContent: this.hashManager.normalizeForTimeline(
                  `${merged.eventType}_${merged.description}_${merged.eventDate.toISOString().split('T')[0]}`
                )
              }
            });

            mergedDuplicates++;
            log.info({ msg: '${ICONS.INFO} Entrada duplicada mesclada: ${entry.eventType} - ${entry.eventDate.toLocaleDateString()}', component: 'timelineMerge' });

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
            log.info({ msg: '${ICONS.WARNING} Entrada duplicada sem mudanças: ${entry.eventType} - ${entry.eventDate.toLocaleDateString()}', component: 'timelineMerge' });
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
              metadata: entry.metadata ? JSON.parse(JSON.stringify(entry.metadata)) : {},
              confidence: entry.confidence || 1.0
            }
          });

          newEntries++;
          log.info({ msg: '${ICONS.SUCCESS} Nova entrada adicionada: ${entry.eventType} - ${entry.eventDate.toLocaleDateString()}', component: 'timelineMerge' });

          mergedEntries.push({
            id: newEntry.id,
            eventDate: newEntry.eventDate,
            eventType: newEntry.eventType,
            description: newEntry.description,
            source: newEntry.source,
            confidence: newEntry.confidence
          });

        } catch (createError) {
          // Narrow unknown to Error type for safety, with Prisma error code handling
          const err = createError instanceof Error ? createError : new Error(String(createError));

          // Check for Prisma unique constraint error (P2002) safely
          const prismaErrorCode = 'code' in err && typeof (err as Record<string, unknown>).code === 'string'
            ? (err as Record<string, unknown>).code
            : null;

          // Se houver erro de constraint única, outra requisição criou a entrada
          // Recuperar e tentar merge com retry
          if (prismaErrorCode === 'P2002') {
            log.info({ msg: '${ICONS.INFO} Race condition detectada: Recuperando entrada criada por outra requisição para ${entry.eventType} - ${entry.eventDate.toLocaleDateStr...', component: 'timelineMerge' });

            // Recuperar a entrada que foi criada pela outra requisição com retry
            existingEntry = await this.findEntryWithRetry(prisma, caseId, contentHash);

            if (existingEntry) {
              // Tentar merge com a entrada recuperada
              // Validate source using type guard before constructing object
              if (!isValidTimelineEntrySource(existingEntry.source)) {
                log.warn({ msg: '${ICONS.WARNING} Entrada recuperada com source inválido: ${existingEntry.source}. Pulando merge.', component: 'timelineMerge' });
                duplicatesSkipped++;
              } else {
                // Convert Prisma result to TimelineEntry with safe type narrowing
                const recoveredAsTimelineEntry: TimelineEntry = {
                  eventDate: existingEntry.eventDate,
                  eventType: existingEntry.eventType,
                  description: existingEntry.description,
                  source: existingEntry.source, // Now guaranteed to be valid by type guard
                  sourceId: existingEntry.sourceId ?? undefined,
                  metadata: typeof existingEntry.metadata === 'object' && existingEntry.metadata !== null
                    ? (existingEntry.metadata as Record<string, unknown>)
                    : undefined,
                  confidence: existingEntry.confidence,
                };
                const { merged, changed } = this.mergeIntelligently(recoveredAsTimelineEntry, entry);

              if (changed) {
                const updatedEntry = await prisma.processTimelineEntry.update({
                  where: { id: existingEntry.id },
                  data: {
                    eventDate: merged.eventDate,
                    eventType: merged.eventType,
                    description: merged.description,
                    source: merged.source,
                    metadata: merged.metadata ? JSON.parse(JSON.stringify(merged.metadata)) : undefined,
                    confidence: merged.confidence,
                    normalizedContent: this.hashManager.normalizeForTimeline(
                      `${merged.eventType}_${merged.description}_${merged.eventDate.toISOString().split('T')[0]}`
                    )
                  }
                });

                mergedDuplicates++;
                log.info({ msg: '${ICONS.INFO} Entrada recuperada e mesclada via race condition recovery: ${entry.eventType}', component: 'timelineMerge' });

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
                log.info({ msg: `${ICONS.INFO} Entrada recuperada mas sem mudanças: ${entry.eventType}`, component: 'timelineMerge' });
              }
              }
            } else {
              // PROBLEMA: Não conseguiu recuperar a entrada mesmo com retries!
              // Isso é crítico - significa que o erro foi levantado mas a entrada não existe
              // após múltiplas tentativas. Pode indicar problema no banco de dados.
              log.error({ msg: `${ICONS.ERROR} CRÍTICO: Race condition mas entrada não encontrada após ${3} retries! caseId=${caseId}, hash=${contentHash}, event=${entry.eventType}`, component: 'timelineMerge' });
              duplicatesSkipped++;
            }
          } else {
            // Re-throw se for erro diferente
            log.error({ msg: `${ICONS.ERROR} Erro ao criar entrada (não é P2002)`, component: 'timelineMerge', code: prismaErrorCode, message: err.message });
            throw err;
          }
        }

      } catch (_error) {
        logError(`${ICONS.ERROR} Erro ao processar entrada:`, 'error', { component: 'timelineMerge' });
        // Continuar processamento mesmo com erro em uma entrada
      }
    }

    // Obter total de entradas após merge
    const totalEntries = await prisma.processTimelineEntry.count({
      where: { caseId }
    });

    log.info({ msg: '${ICONS.SUCCESS} Timeline merge concluído: ${newEntries} novas, ${mergedDuplicates} mescladas, ${duplicatesSkipped} ignoradas, ${totalEntries} total', component: 'timelineMerge' });

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
    prisma: PrismaClient,
    options: {
      limit?: number;
      offset?: number;
      since?: Date;
      sources?: string[];
    } = {}
  ) {
    const whereClause: Record<string, unknown> = { caseId };

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
   * Valida cada evento com type checking antes de usar
   */
  extractTimelineFromAIAnalysis(aiResult: AIAnalysisResult, sourceId: string): TimelineEntry[] {
    const entries: TimelineEntry[] = [];

    try {
      // Verificar se há andamentos extraídos no resultado da IA
      const rawEvents = aiResult.raw_events_extracted || aiResult.events || [];

      // Validar que rawEvents é um array
      if (!Array.isArray(rawEvents)) {
        log.warn({ msg: '${ICONS.WARNING} raw_events_extracted não é um array válido', component: 'timelineMerge' });
        return entries;
      }

      for (const event of rawEvents) {
        try {
          // Type check do evento antes de usar seus campos
          if (typeof event !== 'object' || event === null) {
            log.warn({ msg: '${ICONS.WARNING} Evento não é um objeto válido', component: 'timelineMerge' });
            continue;
          }

          const eventObj = event as Record<string, unknown>;

          // Tentar parsear data em diferentes formatos
          let eventDate: Date;

          const dataAndamento = eventObj.data_andamento;
          const dateField = eventObj.date;

          if (typeof dataAndamento === 'string' && dataAndamento.includes('/')) {
            // Formato brasileiro DD/MM/AAAA
            const [day, month, year] = dataAndamento.split('/');
            const dayNum = parseInt(day, 10);
            const monthNum = parseInt(month, 10);
            const yearNum = parseInt(year, 10);

            if (!isNaN(dayNum) && !isNaN(monthNum) && !isNaN(yearNum)) {
              eventDate = new Date(yearNum, monthNum - 1, dayNum);
            } else {
              // Data inválida, usar fallback
              eventDate = new Date();
            }
          } else if (dateField instanceof Date) {
            eventDate = dateField;
          } else if (typeof dateField === 'string') {
            eventDate = new Date(dateField);
          } else {
            // Se não há data válida, usar data atual como fallback
            eventDate = new Date();
          }

          // Validar data resultante
          if (isNaN(eventDate.getTime())) {
            log.warn({ msg: '${ICONS.WARNING} Data inválida para evento: ${eventObj.tipo_andamento || eventObj.type}', component: 'timelineMerge' });
            continue;
          }

          // Extrair campos com type safety
          const eventType = typeof eventObj.tipo_andamento === 'string'
            ? eventObj.tipo_andamento
            : typeof eventObj.type === 'string'
            ? eventObj.type
            : 'Andamento';

          const description = typeof eventObj.resumo_andamento === 'string'
            ? eventObj.resumo_andamento
            : typeof eventObj.description === 'string'
            ? eventObj.description
            : 'Sem descrição';

          const confidence = typeof eventObj.confidence === 'number'
            ? eventObj.confidence
            : 0.8;

          // Validar metadata antes de incluir no metadata spread
          const eventMetadata: Record<string, unknown> = {
            extracted_from: 'ai_analysis',
            confidence,
          };

          // Adicionar original_data se for um objeto válido
          if (typeof event === 'object' && event !== null) {
            eventMetadata.original_data = event;
          }

          entries.push({
            eventDate,
            eventType,
            description,
            source: 'AI_EXTRACTION',
            sourceId,
            metadata: eventMetadata,
            confidence
          });

        } catch (_eventError) {
          log.warn({ msg: '${ICONS.WARNING} Erro ao processar evento individual:`, _eventError', component: 'timelineMerge' });
        }
      }

      log.info({ msg: '${ICONS.SUCCESS} Extraídos ${entries.length} andamentos da análise IA', component: 'timelineMerge' });

    } catch (_error) {
      logError(`${ICONS.ERROR} Erro na extração de timeline da IA:`, 'error', { component: 'timelineMerge' });
    }

    return entries;
  }

  /**
   * Registra evento de auditoria
   */
  async logAuditEvent(
    type: 'duplicate_upload' | 'new_upload' | 'timeline_merge',
    details: Record<string, unknown>,
    prisma: PrismaClient
  ) {
    try {
      await prisma.globalLog.create({
        data: {
          level: 'INFO',
          category: 'UPLOAD',
          message: `Timeline event: ${type}`,
          data: JSON.parse(JSON.stringify(details)) // Safe JSON serialization for Prisma
        }
      });
    } catch (error) {
      logError(`${ICONS.ERROR} Erro ao registrar auditoria:`, 'error', { component: 'timelineMerge' });
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