// ================================
// ROUTER INTELIGENTE DE IA - MELHORADO
// ================================
// Sistema de routing com cache agressivo e tipos específicos de análise

import { getAiCache, generateTextHash } from './ai-cache-manager';
import { ICONS } from './icons';

export enum ModelTier {
  FLASH_LITE = "gemini-1.5-flash-8b",
  FLASH = "gemini-1.5-flash",
  PRO = "gemini-1.5-pro"
}

export type AnalysisType = 'essential' | 'strategic' | 'report';

export interface ModelPricing {
  input_price_per_million: number;
  output_price_per_million: number;
}

export interface ComplexityScore {
  total_score: number;
  factors: Record<string, number>;
  recommended_tier: ModelTier;
  reasoning: string;
}

export interface CacheEntry {
  content: string;
  created_at: Date;
  hits: number;
  cache_id: string;
}

export interface RoutingInfo {
  initial_tier: string;
  final_tier: string;
  complexity_score: number;
  empty_fields_percentage?: number;
  escalated?: boolean;
  cost_estimate: any;
  fallback_reason?: string;
}

export class ModelRouter {
  private apiKey: string;
  private projectId?: string;
  private modelPricing: Record<ModelTier, ModelPricing>;
  private promptCache: Map<string, CacheEntry> = new Map();
  private cacheMetrics = {
    hits: 0,
    misses: 0,
    created: 0,
    expired: 0
  };
  private escalationMetrics = {
    flash_lite_to_flash: 0,
    flash_to_pro: 0,
    flash_lite_failures: 0,
    flash_failures: 0
  };

  constructor(apiKey: string, projectId?: string) {
    this.apiKey = apiKey;
    this.projectId = projectId;

    this.modelPricing = {
      [ModelTier.FLASH_LITE]: { input_price_per_million: 0.10, output_price_per_million: 0.40 },
      [ModelTier.FLASH]: { input_price_per_million: 0.30, output_price_per_million: 2.50 },
      [ModelTier.PRO]: { input_price_per_million: 1.25, output_price_per_million: 10.00 }
    };
  }

  /**
   * Analisa complexidade do texto e recomenda tier do modelo
   */
  analyzeComplexity(text: string, fileSizeMb: number = 0): ComplexityScore {
    const factors: Record<string, number> = {};

    // 1. Tamanho do texto (0-25 pontos)
    const textLength = text.length;
    const textPoints = Math.min(Math.floor(textLength / 1000) * 0.5, 25);
    factors['text_length'] = textPoints;

    // 2. Tamanho do arquivo (0-25 pontos)
    if (fileSizeMb < 1) {
      factors['file_size'] = 0;
    } else if (fileSizeMb < 4) {
      factors['file_size'] = 3;
    } else if (fileSizeMb < 10) {
      factors['file_size'] = 8;
    } else if (fileSizeMb < 20) {
      factors['file_size'] = 15;
    } else {
      factors['file_size'] = 25;
    }

    // 3. Complexidade jurídica (0-70 pontos)
    let complexityScore = 0;

    // Múltiplas instâncias (+20 pontos)
    const multipleInstancesPatterns = [
      /primeira instância.*segunda instância/i,
      /tribunal.*juiz.*primeira instância/i,
      /tjsp.*primeira instância/i,
      /stj.*tribunal/i,
      /stf.*superior/i,
      /instância superior/i
    ];

    if (multipleInstancesPatterns.some(pattern => pattern.test(text))) {
      complexityScore += 20;
    }

    // Processos criminais (+25 pontos)
    const criminalPatterns = [
      /processo criminal|ação penal/i,
      /ministério público.*criminal/i,
      /denúncia.*crime/i,
      /réu.*acusado/i,
      /sentença.*condenatória/i,
      /vara criminal|juizado criminal/i,
      /código penal|lei penal/i
    ];

    if (criminalPatterns.some(pattern => pattern.test(text))) {
      complexityScore += 25;
    }

    // Complexidade jurídica tradicional
    const legalComplexityIndicators = [
      { pattern: /recurso especial|recurso extraordinário/i, points: 8 },
      { pattern: /embargos de declaração|agravo/i, points: 5 },
      { pattern: /tutela antecipada|liminar|cautelar/i, points: 4 },
      { pattern: /perícia|avaliação|arbitragem/i, points: 3 },
      { pattern: /incidente|execução provisória/i, points: 3 },
      { pattern: /desconsideração.*personalidade/i, points: 2 }
    ];

    legalComplexityIndicators.forEach(({ pattern, points }) => {
      if (pattern.test(text)) {
        complexityScore += points;
      }
    });

    factors['legal_complexity'] = Math.min(complexityScore, 70);

    // 4. Número de entidades (0-15 pontos)
    const entityPatterns = [
      /\b[A-Z][a-z]+ [A-Z][a-z]+ [A-Z][a-z]+\b/g, // Nomes próprios
      /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g, // CNPJs
      /\d{3}\.\d{3}\.\d{3}-\d{2}/g // CPFs
    ];

    const uniqueEntities = new Set();
    entityPatterns.forEach(pattern => {
      const matches = text.match(pattern) || [];
      matches.forEach(match => uniqueEntities.add(match));
    });

    const numEntities = uniqueEntities.size;
    if (numEntities < 3) {
      factors['entities'] = 0;
    } else if (numEntities < 6) {
      factors['entities'] = 5;
    } else if (numEntities < 10) {
      factors['entities'] = 10;
    } else {
      factors['entities'] = 15;
    }

    // 5. Valores financeiros (0-10 pontos)
    const valoresPattern = /R\$\s?[\d\.,]+(?:\,\d{2})?/gi;
    const valores = text.match(valoresPattern) || [];

    if (valores.length === 0) {
      factors['financial_complexity'] = 0;
    } else if (valores.length < 3) {
      factors['financial_complexity'] = 2;
    } else if (valores.length < 8) {
      factors['financial_complexity'] = 6;
    } else {
      factors['financial_complexity'] = 10;
    }

    // Calcular score total
    const totalScore = Object.values(factors).reduce((sum, value) => sum + value, 0);

    // Determinar tier recomendado
    let recommendedTier: ModelTier;
    let reasoning: string;

    if (totalScore <= 25) {
      recommendedTier = ModelTier.FLASH_LITE;
      reasoning = "Processo simples: baixa complexidade, arquivo pequeno (≤25 pontos)";
    } else if (totalScore <= 49) {
      recommendedTier = ModelTier.FLASH;
      reasoning = "Processo médio: complexidade moderada, bom custo-benefício (26-49 pontos)";
    } else {
      recommendedTier = ModelTier.PRO;
      reasoning = "Processo complexo: alta complexidade ou arquivo grande (≥50 pontos)";
    }

    return {
      total_score: totalScore,
      factors,
      recommended_tier: recommendedTier,
      reasoning
    };
  }

  /**
   * Calcula custo estimado baseado no texto e modelo
   */
  estimateCost(text: string, modelTier: ModelTier): any {
    // Estimativa aproximada: 4 caracteres = 1 token
    const estimatedInputTokens = Math.floor(text.length / 4);
    const estimatedOutputTokens = 2000; // Estimativa baseada na resposta típica

    const pricing = this.modelPricing[modelTier];
    const inputCost = (estimatedInputTokens / 1_000_000) * pricing.input_price_per_million;
    const outputCost = (estimatedOutputTokens / 1_000_000) * pricing.output_price_per_million;
    const estimatedCost = inputCost + outputCost;

    return {
      model: modelTier,
      estimated_input_tokens: estimatedInputTokens,
      estimated_output_tokens: estimatedOutputTokens,
      estimated_cost_usd: Math.round(estimatedCost * 10000) / 10000, // 4 casas decimais
      pricing_per_million: {
        input: pricing.input_price_per_million,
        output: pricing.output_price_per_million
      }
    };
  }

  // ================================
  // ANÁLISES ESPECÍFICAS COM CACHE AGRESSIVO
  // ================================

  /**
   * Análise ESSENCIAL - SEMPRE Gemini Flash 8B
   * Cache agressivo (7 dias) para máxima economia
   */
  async analyzeEssential(text: string, workspaceId?: string): Promise<any> {
    console.log(`${ICONS.PROCESS} Análise ESSENCIAL iniciada (Flash 8B)`);

    const cache = getAiCache();
    const textHash = generateTextHash(text);

    // 1. Buscar no cache primeiro (CRÍTICO para economia)
    const cached = await cache.getEssential(textHash);
    if (cached) {
      console.log(`${ICONS.CACHE} Cache HIT - Análise essencial: ${cached._routing_info?.tokens_saved || 0} tokens economizados`);
      return cached;
    }

    // 2. Processar com Flash 8B (mais barato)
    const result = await this.processWithModel(text, ModelTier.FLASH_LITE, 'essential');

    // 3. Salvar no cache (CRÍTICO)
    await cache.setEssential(textHash, result, {
      tokens_saved: this.estimateTokens(text),
      workspaceId
    });

    console.log(`${ICONS.SUCCESS} Análise essencial concluída e cacheada`);
    return result;
  }

  /**
   * Análise ESTRATÉGICA - Router por complexidade
   * Cache por tier para otimização
   */
  async analyzeStrategic(text: string, fileSizeMb: number = 0, workspaceId?: string): Promise<any> {
    console.log(`${ICONS.PROCESS} Análise ESTRATÉGICA iniciada (routing por complexidade)`);

    const cache = getAiCache();
    const textHash = generateTextHash(text);
    const complexityScore = this.analyzeComplexity(text, fileSizeMb);

    // 1. Buscar no cache por tier
    const cached = await cache.getStrategic(textHash, complexityScore.total_score);
    if (cached) {
      console.log(`${ICONS.CACHE} Cache HIT - Análise estratégica: ${cached._routing_info?.tokens_saved || 0} tokens economizados`);
      return cached;
    }

    // 2. Processar com tier recomendado
    const result = await this.processWithModel(text, complexityScore.recommended_tier, 'strategic');
    result._routing_info = {
      ...result._routing_info,
      complexity_score: complexityScore.total_score,
      complexity_factors: complexityScore.factors,
      reasoning: complexityScore.reasoning
    };

    // 3. Salvar no cache por tier
    await cache.setStrategic(textHash, result, complexityScore.total_score, {
      model: complexityScore.recommended_tier,
      tokens_saved: this.estimateTokens(text),
      workspaceId
    });

    console.log(`${ICONS.SUCCESS} Análise estratégica concluída (${complexityScore.recommended_tier}) e cacheada`);
    return result;
  }

  /**
   * Relatórios - SEMPRE Gemini Flash
   * Cache específico para relatórios
   */
  async generateReport(
    reportData: any,
    reportType: string = 'general',
    workspaceId?: string
  ): Promise<any> {
    console.log(`${ICONS.PROCESS} Relatório iniciado (Flash)`);

    const cache = getAiCache();
    const reportHash = generateTextHash(JSON.stringify(reportData) + reportType);

    // 1. Buscar no cache
    const cached = await cache.getReport(reportHash);
    if (cached) {
      console.log(`${ICONS.CACHE} Cache HIT - Relatório: ${cached._routing_info?.tokens_saved || 0} tokens economizados`);
      return cached;
    }

    // 2. Processar com Flash (bom custo-benefício para relatórios)
    const result = await this.processWithModel(
      JSON.stringify(reportData),
      ModelTier.FLASH,
      'report'
    );

    // 3. Salvar no cache
    await cache.setReport(reportHash, result, {
      model: ModelTier.FLASH,
      tokens_saved: this.estimateTokens(JSON.stringify(reportData)),
      workspaceId
    });

    console.log(`${ICONS.SUCCESS} Relatório concluído e cacheado`);
    return result;
  }

  // ================================
  // PROCESSAMENTO INTERNO
  // ================================

  /**
   * Processa com modelo específico (chama API Python da v1)
   */
  private async processWithModel(
    text: string,
    modelTier: ModelTier,
    analysisType: AnalysisType
  ): Promise<any> {
    try {
      const response = await fetch('http://localhost:8000/api/ai/analyze-with-routing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          forced_model: modelTier,
          analysis_type: analysisType,
          cache_enabled: true // CRÍTICO
        })
      });

      if (!response.ok) {
        throw new Error(`API Python retornou erro: ${response.status}`);
      }

      const result = await response.json();

      // Adicionar informações de routing
      result._routing_info = {
        ...result._routing_info,
        final_tier: modelTier,
        analysis_type: analysisType,
        cost_estimate: this.estimateCost(text, modelTier),
        cached: false,
        timestamp: new Date().toISOString()
      };

      return result;

    } catch (error) {
      console.error(`${ICONS.ERROR} Erro na análise com ${modelTier}:`, error);

      // Fallback para tier inferior em caso de erro
      if (modelTier === ModelTier.PRO) {
        console.log(`${ICONS.WARNING} Fallback PRO → FLASH`);
        return this.processWithModel(text, ModelTier.FLASH, analysisType);
      } else if (modelTier === ModelTier.FLASH) {
        console.log(`${ICONS.WARNING} Fallback FLASH → FLASH_LITE`);
        return this.processWithModel(text, ModelTier.FLASH_LITE, analysisType);
      }

      throw error;
    }
  }

  private estimateTokens(text: string): number {
    return Math.floor(text.length / 4); // Aproximação: 4 chars = 1 token
  }

  /**
   * Obtém estatísticas do cache
   */
  getCacheStats() {
    const totalRequests = this.cacheMetrics.hits + this.cacheMetrics.misses;
    const hitRate = totalRequests > 0 ? (this.cacheMetrics.hits / totalRequests) * 100 : 0;

    return {
      cache_metrics: this.cacheMetrics,
      hit_rate_percentage: Math.round(hitRate * 100) / 100,
      cache_size: this.promptCache.size,
      escalation_metrics: this.escalationMetrics
    };
  }
}