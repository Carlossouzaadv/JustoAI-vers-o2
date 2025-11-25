import { log, logError } from '@/lib/services/logger';

/**
 * Timeline Unificada Inteligente - Configuração
 *
 * Define limiares ajustáveis para associação semântica e detecção de conflitos.
 * Valores podem ser sobrescritos via variáveis de ambiente (.env).
 */

export interface TimelineConfig {
  // Limiar de similaridade para associar como ENRICHMENT (0-1)
  // Se dois eventos têm similaridade > este valor, o novo enriquece o base
  similarityThresholdEnrichment: number;

  // Limiar de similaridade para associar como RELATED (0-1)
  // Se dois eventos têm similaridade > este valor mas < enrichment, são RELATED
  similarityThresholdRelated: number;

  // Proximidade de datas para considerar eventos relacionados (em dias)
  // Se data diferença <= este valor, podem ser RELATED mesmo com baixa similaridade
  dateProximityDays: number;

  // Custo de enriquecimento em créditos (por evento)
  // ~100 tokens no Gemini Flash = 0.001 crédito
  enrichmentCreditCost: number;

  // Modelo de IA padrão para enriquecimento
  enrichmentModel: string;

  // Máximo de tentativas de enriquecimento antes de fallback
  maxEnrichmentRetries: number;

  // Timeout para chamada à Gemini Flash (em ms)
  enrichmentTimeoutMs: number;
}

/**
 * Obtém configuração de timeline com valores de .env ou padrões
 */
export function getTimelineConfig(): TimelineConfig {
  return {
    // Limiares de Similaridade - ajustáveis via .env
    similarityThresholdEnrichment: parseFloat(
      process.env.TIMELINE_SIMILARITY_THRESHOLD_ENRICHMENT || '0.85'
    ),
    similarityThresholdRelated: parseFloat(
      process.env.TIMELINE_SIMILARITY_THRESHOLD_RELATED || '0.70'
    ),

    // Proximidade de datas
    dateProximityDays: parseInt(
      process.env.TIMELINE_DATE_PROXIMITY_DAYS || '2'
    ),

    // Custos e configuração de IA
    enrichmentCreditCost: parseFloat(
      process.env.TIMELINE_ENRICHMENT_CREDIT_COST || '0.001'
    ),
    enrichmentModel:
      process.env.TIMELINE_ENRICHMENT_MODEL || 'gemini-1.5-flash',
    maxEnrichmentRetries: parseInt(
      process.env.TIMELINE_MAX_ENRICHMENT_RETRIES || '3'
    ),
    enrichmentTimeoutMs: parseInt(
      process.env.TIMELINE_ENRICHMENT_TIMEOUT_MS || '10000'
    ),
  };
}

/**
 * Validar que os limiares estão em range válido
 */
export function validateTimelineConfig(config: TimelineConfig): void {
  if (config.similarityThresholdEnrichment < 0 || config.similarityThresholdEnrichment > 1) {
    throw new Error(
      `TIMELINE_SIMILARITY_THRESHOLD_ENRICHMENT deve estar entre 0 e 1, recebido: ${config.similarityThresholdEnrichment}`
    );
  }

  if (config.similarityThresholdRelated < 0 || config.similarityThresholdRelated > 1) {
    throw new Error(
      `TIMELINE_SIMILARITY_THRESHOLD_RELATED deve estar entre 0 e 1, recebido: ${config.similarityThresholdRelated}`
    );
  }

  if (config.similarityThresholdEnrichment <= config.similarityThresholdRelated) {
    throw new Error(
      `TIMELINE_SIMILARITY_THRESHOLD_ENRICHMENT (${config.similarityThresholdEnrichment}) deve ser > RELATED (${config.similarityThresholdRelated})`
    );
  }

  if (config.dateProximityDays < 0) {
    throw new Error(
      `TIMELINE_DATE_PROXIMITY_DAYS deve ser >= 0, recebido: ${config.dateProximityDays}`
    );
  }

  if (config.enrichmentCreditCost <= 0) {
    throw new Error(
      `TIMELINE_ENRICHMENT_CREDIT_COST deve ser > 0, recebido: ${config.enrichmentCreditCost}`
    );
  }
}

// Exportar instância padrão
export const timelineConfig = getTimelineConfig();

// Validar ao carregar
try {
  validateTimelineConfig(timelineConfig);
} catch (_error) {
  logError(error, "❌ Erro na configuração da Timeline:", { component: "refactored" });
  // Em produção, falhar rápido; em dev, apenas log
  if (process.env.NODE_ENV === 'production') {
    throw error;
  }
}

/**
 * Debug: Exibir configuração atual (use apenas em desenvolvimento)
 */
export function debugTimelineConfig(): void {
  log.info({ msg: "📊 Timeline Unificada - Configuração Atual:" });
  log.info({ msg: "✓ Enrichment Threshold:" });
  log.info({ msg: "✓ Related Threshold:" });
  log.info({ msg: "✓ Date Proximity: ± dias" });
  log.info({ msg: "✓ Enrichment Cost:  crédito" });
  log.info({ msg: "✓ Enrichment Model:" });
  log.info({ msg: "✓ Enrichment Timeout: ms" });
}
