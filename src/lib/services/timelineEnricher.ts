/**
 * Timeline Enricher Service
 *
 * Serviço responsável por:
 * 1. Associar eventos novos a eventos JUDIT base existentes
 * 2. Detectar tipo de relacionamento entre eventos
 * 3. Enriquecer descrições usando Gemini Flash
 * 4. Detectar conflitos entre fontes
 */

import { Prisma, ProcessTimelineEntry, TimelineSource, EventRelationType } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import { getTimelineConfig } from '@/lib/config/timelineConfig';
import { isJuditSource } from '@/lib/utils/timelineSourceUtils';
import { getGeminiClient } from '@/lib/gemini-client';
import { buildEnrichmentPrompt } from '@/lib/prompts/enrichTimelineEvent';

export interface TimelineMovement {
  date: Date;
  type: string;
  description: string;
  source: TimelineSource;
  sourceId?: string;
  confidence: number;
  metadata?: Record<string, unknown>;
}

export interface AssociationResult {
  baseEventId: string | null;
  relationType: EventRelationType | null;
  similarity: number;
  confidence: number;
}

export interface EnrichmentResult {
  enrichedDescription: string;
  model: string;
  tokensUsed?: number;
  cost?: number;
}

export interface ConflictDetails {
  type: 'DATE_MISMATCH' | 'TYPE_MISMATCH' | 'DESCRIPTION_CONTRADICTION';
  sources: {
    source1: TimelineSource;
    source2: TimelineSource;
    value1: string | Date;
    value2: string | Date;
  };
  severity: 'low' | 'medium' | 'high';
  message: string;
}

/**
 * Serviço de enriquecimento de timeline
 */
export class TimelineEnricherService {
  private prisma: PrismaClient;
  private config = getTimelineConfig();

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Associa um evento novo a um evento JUDIT base existente
   *
   * Estratégia:
   * 1. Hash exato → DUPLICATE
   * 2. Data + Tipo + similaridade > 0.85 → ENRICHMENT
   * 3. Data + Tipo + similaridade > 0.70 → RELATED
   * 4. Data ±2 dias + alta similaridade → RELATED
   * 5. Nada encontrado → null (cria novo evento)
   */
  async associateToBaseEvent(
    newEvent: TimelineMovement,
    existingEvents: ProcessTimelineEntry[]
  ): Promise<AssociationResult> {
    // Se o evento novo é JUDIT, nunca é enriquecedor
    if (isJuditSource(newEvent.source)) {
      return {
        baseEventId: null,
        relationType: null,
        similarity: 1,
        confidence: 1,
      };
    }

    // Buscar candidatos por data
    const candidates = existingEvents.filter((e) => {
      const daysDiff = Math.abs(
        (e.eventDate.getTime() - newEvent.date.getTime()) / (1000 * 60 * 60 * 24)
      );
      return daysDiff <= this.config.dateProximityDays;
    });

    if (candidates.length === 0) {
      return { baseEventId: null, relationType: null, similarity: 0, confidence: 0 };
    }

    // Buscar melhor candidato por similaridade
    let bestMatch: { event: ProcessTimelineEntry; similarity: number } | null = null;

    for (const candidate of candidates) {
      const similarity = this.calculateSimilarity(
        newEvent.description,
        candidate.description
      );

      if (!bestMatch || similarity > bestMatch.similarity) {
        bestMatch = { event: candidate, similarity };
      }
    }

    if (!bestMatch) {
      return { baseEventId: null, relationType: null, similarity: 0, confidence: 0 };
    }

    // Determinar tipo de relacionamento
    let relationType: EventRelationType | null = null;
    let confidence = bestMatch.similarity;

    if (bestMatch.similarity >= this.config.similarityThresholdEnrichment) {
      // ENRICHMENT: novo evento adiciona contexto ao base
      relationType = 'ENRICHMENT';
      confidence = Math.min(confidence + 0.15, 1); // Boost se encontrou match forte
    } else if (bestMatch.similarity >= this.config.similarityThresholdRelated) {
      // RELATED: eventos semanticamente similares mas distintos
      relationType = 'RELATED';
    } else {
      // Sem associação clara
      return { baseEventId: null, relationType: null, similarity: bestMatch.similarity, confidence };
    }

    return {
      baseEventId: bestMatch.event.id,
      relationType,
      similarity: bestMatch.similarity,
      confidence,
    };
  }

  /**
   * Calcula similaridade textual simples entre dois textos
   *
   * Implementação básica: normaliza e calcula Levenshtein
   * Para versão avançada, usar embeddings
   */
  private calculateSimilarity(text1: string, text2: string): number {
    // Normalizar
    const norm1 = this.normalizeText(text1);
    const norm2 = this.normalizeText(text2);

    // Se exatamente iguais
    if (norm1 === norm2) return 1;

    // Levenshtein distance (simplicidade)
    const distance = this.levenshteinDistance(norm1, norm2);
    const maxLen = Math.max(norm1.length, norm2.length);

    // Similaridade = 1 - (distância normalizada)
    const similarity = 1 - distance / maxLen;
    return Math.max(0, Math.min(1, similarity));
  }

  /**
   * Distância de Levenshtein entre dois strings
   */
  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  /**
   * Normaliza texto para comparação
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, '') // Remove pontuação
      .replace(/\s+/g, ' '); // Normaliza espaços
  }

  /**
   * Enriquece descrição de evento usando Gemini Flash
   *
   * Chamado apenas se:
   * - Event novo é enriquecedor (fonte não-JUDIT)
   * - Workspace tem créditos
   * - Similaridade alta o suficiente
   */
  async enrichDescription(
    baseDescription: string,
    newDescription: string,
    contextInfo?: {
      documentName?: string;
      source: TimelineSource;
    }
  ): Promise<EnrichmentResult> {
    try {
      // Construir prompt
      const prompt = buildEnrichmentPrompt(
        baseDescription,
        newDescription,
        contextInfo?.documentName
      );

      // Chamar Gemini Flash
      const gemini = getGeminiClient();
      const result = await gemini.generateContent(prompt, {
        temperature: 0.3, // Mais determinístico para este caso
        maxTokens: 256,
      });

      const enriched = result.content.trim();

      return {
        enrichedDescription: enriched || baseDescription,
        model: this.config.enrichmentModel,
        tokensUsed: 100, // Estimativa
        cost: this.config.enrichmentCreditCost,
      };
    } catch (error) {
      console.error('❌ Erro ao enriquecer descrição:', error);
      // Fallback: retornar descrição original
      throw error;
    }
  }

  /**
   * Detecta conflitos entre um evento existente e um novo
   *
   * Tipos de conflito:
   * - DATE_MISMATCH: datas diferem em >3 dias
   * - TYPE_MISMATCH: tipos de evento diferentes
   * - DESCRIPTION_CONTRADICTION: descrições contraditórias
   */
  detectConflicts(
    existing: ProcessTimelineEntry,
    newEvent: TimelineMovement
  ): ConflictDetails | null {
    // DATE_MISMATCH
    const daysDiff = Math.abs(
      (existing.eventDate.getTime() - newEvent.date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysDiff > 3) {
      return {
        type: 'DATE_MISMATCH',
        sources: {
          source1: existing.source,
          source2: newEvent.source,
          value1: existing.eventDate,
          value2: newEvent.date,
        },
        severity: daysDiff > 7 ? 'high' : 'medium',
        message: `Data diverge em ${daysDiff.toFixed(0)} dias: ${existing.source} vs ${newEvent.source}`,
      };
    }

    // TYPE_MISMATCH
    if (existing.eventType.toLowerCase() !== newEvent.type.toLowerCase()) {
      return {
        type: 'TYPE_MISMATCH',
        sources: {
          source1: existing.source,
          source2: newEvent.source,
          value1: existing.eventType,
          value2: newEvent.type,
        },
        severity: 'medium',
        message: `Tipo diverge: "${existing.eventType}" vs "${newEvent.type}"`,
      };
    }

    // Sem conflitos detectados
    return null;
  }

  /**
   * Prepara um evento para ser salvo como ENRICHMENT
   *
   * Retorna objeto pronto para upsert no Prisma
   */
  prepareEnrichmentData(
    baseEvent: ProcessTimelineEntry,
    newEvent: TimelineMovement,
    enrichmentResult: EnrichmentResult
  ): Prisma.ProcessTimelineEntryUpdateInput {
    const newContributingSource = [
      ...baseEvent.contributingSources,
      newEvent.source,
    ] as TimelineSource[];

    return {
      description: enrichmentResult.enrichedDescription,
      isEnriched: true,
      enrichedAt: new Date(),
      enrichmentModel: enrichmentResult.model,
      contributingSources: newContributingSource,
      enrichedByIds: [...(baseEvent.enrichedByIds || []), newEvent.sourceId || 'unknown'],
      originalTexts: {
        ...(baseEvent.originalTexts as Record<string, string> || {}),
        [newEvent.source]: newEvent.description,
      },
      metadata: {
        ...(baseEvent.metadata || {}),
        enrichmentHistory: [
          ...((baseEvent.metadata as Record<string, unknown>)?.enrichmentHistory as Array<unknown> || []),
          {
            timestamp: new Date(),
            source: newEvent.source,
            enrichmentModel: enrichmentResult.model,
          },
        ],
      },
    };
  }

  /**
   * Prepara um evento para ser salvo como RELATED
   *
   * Cria novo evento vinculado via baseEventId
   */
  prepareRelatedEventData(
    baseEventId: string,
    newEvent: TimelineMovement
  ): Partial<Prisma.ProcessTimelineEntryCreateInput> {
    return {
      // caseId and contentHash will be set by caller
      eventDate: newEvent.date,
      eventType: newEvent.type,
      description: newEvent.description,
      normalizedContent: this.normalizeText(newEvent.description),
      source: newEvent.source,
      sourceId: newEvent.sourceId,
      confidence: newEvent.confidence,
      metadata: newEvent.metadata || {},
      relationType: 'RELATED',
      baseEventId,
      contributingSources: [newEvent.source] as TimelineSource[],
      originalTexts: {
        [newEvent.source]: newEvent.description,
      },
    };
  }

  /**
   * Prepara um evento com conflito detectado
   */
  prepareConflictData(
    baseEvent: ProcessTimelineEntry,
    conflictDetails: ConflictDetails,
    newEvent: TimelineMovement
  ): Prisma.ProcessTimelineEntryUpdateInput {
    return {
      hasConflict: true,
      conflictDetails: {
        type: conflictDetails.type,
        severity: conflictDetails.severity,
        message: conflictDetails.message,
        sources: conflictDetails.sources,
        detectedAt: new Date(),
        newEventSource: newEvent.source,
        newEventData: {
          date: newEvent.date,
          type: newEvent.type,
          description: newEvent.description,
        },
      },
      metadata: {
        ...(baseEvent.metadata || {}),
        conflictTracking: [
          ...((baseEvent.metadata as Record<string, unknown>)?.conflictTracking as Array<unknown> || []),
          {
            timestamp: new Date(),
            source: newEvent.source,
            type: conflictDetails.type,
          },
        ],
      },
    };
  }

  /**
   * Singleton pattern
   */
  private static instance: TimelineEnricherService | null = null;

  static getInstance(prisma: PrismaClient): TimelineEnricherService {
    if (!this.instance) {
      this.instance = new TimelineEnricherService(prisma);
    }
    return this.instance;
  }
}

/**
 * Factory function para criar instância
 */
export function getTimelineEnricherService(
  prisma: PrismaClient
): TimelineEnricherService {
  return TimelineEnricherService.getInstance(prisma);
}
