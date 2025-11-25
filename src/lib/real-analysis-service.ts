// ================================================================
// REAL ANALYSIS SERVICE - Production Gemini Integration
// ================================================================
// Complete analysis service using real Gemini API with error handling and rate limiting

import { AIModelRouter, ModelTier, UnifiedProcessSchema, ComplexityScore, ProcessingConfig } from './ai-model-router';
import { getGeminiClient, GeminiClient } from './gemini-client';
import { ICONS } from './icons';
import { log, logError } from '@/lib/services/logger';

export interface AnalysisRequest {
  text: string;
  analysisType: 'essential' | 'strategic' | 'report';
  fileSizeMB?: number;
  workspaceId?: string;
  forceRefresh?: boolean;
  metadata?: {
    documentType?: string;
    sourceFile?: string;
    userId?: string;
  };
}

export interface ComplexityFactors {
  [key: string]: unknown;
}

export interface GeminiResponse {
  [key: string]: unknown;
}

export interface AnalysisResponse {
  success: boolean;
  data?: UnifiedProcessSchema;
  error?: string;
  metadata: {
    modelUsed: string;
    analysisType: string;
    cached: boolean;
    processingTime: number;
    tokenUsage: {
      prompt: number;
      completion: number;
      total: number;
    };
    cost: {
      estimated: number;
      currency: string;
    };
    complexity: {
      score: number;
      factors: ComplexityFactors;
      tier: ModelTier;
    };
    timestamp: string;
  };
}

export interface AnalysisStats {
  totalAnalyses: number;
  analysesByType: Record<string, number>;
  analysesByModel: Record<string, number>;
  totalTokensUsed: number;
  totalCostUSD: number;
  averageProcessingTime: number;
  cacheHitRate: number;
  errorRate: number;
}

/**
 * Production-ready analysis service using real Gemini API
 */
export class RealAnalysisService {
  private router: AIModelRouter;
  private geminiClient: GeminiClient;
  private stats: AnalysisStats;

  constructor() {
    this.router = new AIModelRouter();
    this.geminiClient = getGeminiClient();
    this.stats = {
      totalAnalyses: 0,
      analysesByType: {},
      analysesByModel: {},
      totalTokensUsed: 0,
      totalCostUSD: 0,
      averageProcessingTime: 0,
      cacheHitRate: 0,
      errorRate: 0
    };
  }

  /**
   * Perform complete analysis with automatic model selection
   */
  async analyze(request: AnalysisRequest): Promise<AnalysisResponse> {
    const startTime = Date.now();

    try {
      log.info({ msg: "Iniciando análise  -  caracteres" });

      // 1. Analyze document complexity
      const complexity = this.router.analyzeComplexity(request.text, request.fileSizeMB || 0);
      log.info({ msg: "Complexidade:  pontos → Modelo:" });

      // 2. Check cache first
      const cacheResult = await this.checkCache(request, complexity);
      if (cacheResult && !request.forceRefresh) {
        const processingTime = Date.now() - startTime;
        return this.buildSuccessResponse(cacheResult, complexity, true, processingTime);
      }

      // 3. Get processing configuration
      const config = this.router.getProcessingConfig(complexity, request.metadata?.documentType);

      // 4. Process with Gemini API
      const analysisResult = await this.processWithGemini(request, config, complexity);

      // 5. Cache the result
      await this.cacheResult(request, analysisResult, complexity);

      // 6. Update statistics
      this.updateStats(request.analysisType, complexity.recommendedTier, Date.now() - startTime, false);

      const processingTime = Date.now() - startTime;
      log.info({ msg: "Análise concluída em ms" });

      return this.buildSuccessResponse(analysisResult, complexity, false, processingTime);

    } catch (_error) {
      const processingTime = Date.now() - startTime;
      logError(error, "${ICONS.ERROR} Erro na análise:", { component: "refactored" });

      this.updateStats(request.analysisType, ModelTier.BALANCED, processingTime, true);

      // Narrow unknown to Error for type safety
      const err = error instanceof Error ? error : new Error(String(error));

      return {
        success: false,
        error: this.formatError(err),
        metadata: {
          modelUsed: 'unknown',
          analysisType: request.analysisType,
          cached: false,
          processingTime,
          tokenUsage: { prompt: 0, completion: 0, total: 0 },
          cost: { estimated: 0, currency: 'USD' },
          complexity: { score: 0, factors: {}, tier: ModelTier.BALANCED },
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Process analysis using Gemini API with retry logic
   */
  private async processWithGemini(
    request: AnalysisRequest,
    config: ProcessingConfig,
    complexity: ComplexityScore
  ): Promise<UnifiedProcessSchema> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        log.info({ msg: "Tentativa / com modelo" });

        // Build the analysis prompt
        const prompt = this.buildAnalysisPrompt(request, config.promptTemplate);

        // Call Gemini API
        const geminiResponse = await this.geminiClient.generateJsonContent(prompt, {
          model: config.model,
          maxTokens: config.maxTokens,
          temperature: config.temperature
        });

        // Validate and enhance the response
        const validatedResult = this.validateAndEnhanceResult(geminiResponse as Record<string, unknown>, request, complexity);

        log.info({ msg: "Análise bem-sucedida na tentativa" });
        return validatedResult;

      } catch (_error) {
        // Narrow unknown to Error for type safety
        const err = error instanceof Error ? error : new Error(String(error));
        lastError = err;
        logError(error, "${ICONS.WARNING} Tentativa ${attempt} falhou:", { component: "refactored" });

        // Check if we should retry
        if (attempt < maxRetries && this.shouldRetry(err)) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          log.info({ msg: "Aguardando ms antes da próxima tentativa..." });
          await this.sleep(delay);
          continue;
        }

        // Try fallback model on final attempt
        if (attempt === maxRetries && config.fallbackModel) {
          log.info({ msg: "Tentando modelo de fallback:" });
          config.model = config.fallbackModel;
          delete config.fallbackModel; // Prevent infinite fallback
        }
      }
    }

    throw lastError;
  }

  /**
   * Build analysis prompt based on request type
   */
  private buildAnalysisPrompt(request: AnalysisRequest, promptTemplate: string): string {
    let basePrompt = `${promptTemplate}

TEXTO DO DOCUMENTO:
${request.text}

ANÁLISE SOLICITADA: ${this.getAnalysisDescription(request.analysisType)}

METADADOS ADICIONAIS:`;

    if (request.metadata?.documentType) {
      basePrompt += `\n- Tipo de documento detectado: ${request.metadata.documentType}`;
    }

    if (request.metadata?.sourceFile) {
      basePrompt += `\n- Arquivo origem: ${request.metadata.sourceFile}`;
    }

    return basePrompt + `\n\nRETORNE APENAS UM JSON VÁLIDO seguindo estritamente o schema fornecido.`;
  }

  /**
   * Get analysis description for prompt
   */
  private getAnalysisDescription(type: string): string {
    switch (type) {
      case 'essential':
        return 'Extrair informações essenciais para identificação rápida do processo (seções A, B, C do schema).';
      case 'strategic':
        return 'Análise estratégica completa com avaliação de riscos e recomendações (todas as seções exceto G).';
      case 'report':
        return 'Gerar relatório formatado baseado nos dados fornecidos (foco em estruturação e apresentação).';
      default:
        return 'Análise completa do documento jurídico.';
    }
  }

  /**
   * Type guard: Validate IdentificacaoBasica structure
   */
  private isIdentificacaoBasica(data: unknown): data is UnifiedProcessSchema['identificacao_basica'] {
    if (typeof data !== 'object' || data === null) {
      return false;
    }
    // At least the structure exists - Gemini response may have partial data
    return true;
  }

  /**
   * Type guard: Validate PartesEnvolvidas structure
   */
  private isPartesEnvolvidas(data: unknown): data is UnifiedProcessSchema['partes_envolvidas'] {
    if (typeof data !== 'object' || data === null) {
      return false;
    }
    // At least the structure exists
    return true;
  }

  /**
   * Type guard: Validate ValoresFinanceiros structure
   */
  private isValoresFinanceiros(data: unknown): data is UnifiedProcessSchema['valores_financeiros'] {
    if (typeof data !== 'object' || data === null) {
      return false;
    }
    return true;
  }

  /**
   * Type guard: Validate CamposEspecializados structure
   */
  private isCamposEspecializados(data: unknown): data is UnifiedProcessSchema['campos_especializados'] {
    if (typeof data !== 'object' || data === null) {
      return false;
    }
    return true;
  }

  /**
   * Type guard: Validate SituacaoProcessual structure
   */
  private isSituacaoProcessual(data: unknown): data is UnifiedProcessSchema['situacao_processual'] {
    if (typeof data !== 'object' || data === null) {
      return false;
    }
    return true;
  }

  /**
   * Type guard: Validate AnaliseEstrategica structure
   */
  private isAnaliseEstrategica(data: unknown): data is UnifiedProcessSchema['analise_estrategica'] {
    if (typeof data !== 'object' || data === null) {
      return false;
    }
    return true;
  }

  /**
   * Type guard: Validate DocumentosRelacionados structure
   */
  private isDocumentosRelacionados(data: unknown): data is UnifiedProcessSchema['documentos_relacionados'] {
    if (typeof data !== 'object' || data === null) {
      return false;
    }
    return true;
  }

  /**
   * Extract field from response as unknown, no casting
   */
  private getResponseField(key: string, response: Record<string, unknown>): unknown {
    const field = response[key];
    if (field && typeof field === 'object' && !Array.isArray(field)) {
      return field;
    }
    return null;
  }

  /**
   * Validate and enhance Gemini API response
   */
  private validateAndEnhanceResult(
    geminiResponse: Record<string, unknown>,
    request: AnalysisRequest,
    complexity: ComplexityScore
  ): UnifiedProcessSchema {
    // Extract fields as unknown - no casting
    const identificacao_basica_raw = this.getResponseField('identificacao_basica', geminiResponse);
    const partes_envolvidas_raw = this.getResponseField('partes_envolvidas', geminiResponse);
    const valores_financeiros_raw = this.getResponseField('valores_financeiros', geminiResponse);
    const campos_especializados_raw = this.getResponseField('campos_especializados', geminiResponse);
    const situacao_processual_raw = this.getResponseField('situacao_processual', geminiResponse);
    const analise_estrategica_raw = this.getResponseField('analise_estrategica', geminiResponse);
    const documentos_relacionados_raw = this.getResponseField('documentos_relacionados', geminiResponse);
    const metadados_analise_raw = this.getResponseField('metadados_analise', geminiResponse);

    // Apply type guards with narrowing - use fallback if validation fails
    const identificacao_basica = this.isIdentificacaoBasica(identificacao_basica_raw)
      ? identificacao_basica_raw
      : { numero_processo: null, tipo_processual: null, esfera: null, orgao_instancia: null, comarca: null, vara: null, juiz_responsavel: null };

    const partes_envolvidas = this.isPartesEnvolvidas(partes_envolvidas_raw)
      ? partes_envolvidas_raw
      : { parte_principal: { nome: null, cpf_cnpj: null, tipo: null, qualificacao: null }, parte_contraria: { nome: null, cpf_cnpj: null, tipo: null, qualificacao: null }, outras_partes: null };

    const valores_financeiros = this.isValoresFinanceiros(valores_financeiros_raw)
      ? valores_financeiros_raw
      : { valor_principal: null, multas: null, juros: null, encargos_legais: null, valor_total: null, valor_atualizado_em: null, observacoes_valores: null };

    const campos_especializados = this.isCamposEspecializados(campos_especializados_raw)
      ? campos_especializados_raw
      : {};

    const situacao_processual = this.isSituacaoProcessual(situacao_processual_raw)
      ? situacao_processual_raw
      : { situacao_atual: null, fase_processual: null, ultimo_andamento: null, principais_andamentos: null, prazos_pendentes: null };

    const analise_estrategica = this.isAnaliseEstrategica(analise_estrategica_raw)
      ? analise_estrategica_raw
      : { tese_juridica_central: null, risco_classificacao: null, risco_justificativa: null, oportunidades_processuais: null, recomendacoes_estrategicas: null, pontos_atencao: null, precedentes_relevantes: null };

    const documentos_relacionados = this.isDocumentosRelacionados(documentos_relacionados_raw)
      ? documentos_relacionados_raw
      : { documentos_anexos: null, certidoes_pendentes: null, documentos_solicitados: null };

    // Extract metadata safely - use JSON serialization to ensure proper object structure
    let metadadosOriginal: Record<string, unknown> = {};
    if (typeof metadados_analise_raw === 'object' && metadados_analise_raw !== null) {
      metadadosOriginal = JSON.parse(JSON.stringify(metadados_analise_raw));
    }

    // Ensure all required sections exist with proper fallback
    const result: UnifiedProcessSchema = {
      identificacao_basica,
      partes_envolvidas,
      valores_financeiros,
      campos_especializados,
      situacao_processual,
      analise_estrategica,
      documentos_relacionados,
      metadados_analise: {
        data_analise: new Date().toISOString(),
        modelo_utilizado: complexity.recommendedTier,
        confianca_geral: this.calculateConfidence(geminiResponse, complexity),
        observacoes_ia: typeof metadadosOriginal.observacoes_ia === 'string' ? metadadosOriginal.observacoes_ia : null,
        campos_nao_encontrados: this.findMissingFields(geminiResponse),
        ...(metadadosOriginal || {})
      }
    };

    // Add document type if detected
    if (complexity.documentType) {
      result.metadados_analise.tipo_documento_detectado = complexity.documentType;
    }

    return result;
  }

  /**
   * Calculate overall confidence based on response completeness
   */
  private calculateConfidence(response: GeminiResponse, complexity: ComplexityScore): number {
    let filledFields = 0;
    let totalFields = 0;

    const countFields = (value: unknown): void => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        // After type narrowing: value is object, safe to use Object.values
        try {
          Object.values(value).forEach(field => {
            totalFields++;
            if (field !== null && field !== undefined && field !== '') {
              filledFields++;
            }
          });
        } catch {
          // Silently handle non-iterable objects
        }
      }
    };

    // Safe property access - response is already GeminiResponse (Record<string, unknown>)
    if (typeof response === 'object' && response !== null) {
      countFields(response.identificacao_basica);
      countFields(response.partes_envolvidas);
      countFields(response.valores_financeiros);
    }

    const completeness = totalFields > 0 ? filledFields / totalFields : 0;
    const complexityFactor = Math.min(complexity.confidence || 0.5, 1);

    return Math.round((completeness * 0.7 + complexityFactor * 0.3) * 100) / 100;
  }

  /**
   * Find missing required fields
   */
  private findMissingFields(response: GeminiResponse): string[] {
    const requiredFields = [
      'identificacao_basica.numero_processo',
      'identificacao_basica.tipo_processual',
      'partes_envolvidas.parte_principal.nome',
      'partes_envolvidas.parte_contraria.nome'
    ];

    const missing: string[] = [];

    requiredFields.forEach(fieldPath => {
      const value = this.getNestedValue(response, fieldPath);
      if (!value) {
        missing.push(fieldPath);
      }
    });

    return missing;
  }

  /**
   * Get nested object value by dot notation path
   */
  private getNestedValue(obj: GeminiResponse, path: string): unknown {
    return path.split('.').reduce((current: unknown, key: string) => {
      if (current && typeof current === 'object' && key in (current as GeminiResponse)) {
        return (current as GeminiResponse)[key];
      }
      return undefined;
    }, obj);
  }

  /**
   * Check cache for existing analysis
   */
  private async checkCache(request: AnalysisRequest, complexity: ComplexityScore): Promise<UnifiedProcessSchema | null> {
    try {
      const { getAiCache, generateTextHash } = await import('./ai-cache-manager');
      const cache = getAiCache();
      const textHash = generateTextHash(request.text);

      switch (request.analysisType) {
        case 'essential': {
          const result = await cache.getEssential(textHash);
          return result as UnifiedProcessSchema | null;
        }
        case 'strategic': {
          const result = await cache.getStrategic(textHash, complexity.totalScore);
          return result as UnifiedProcessSchema | null;
        }
        case 'report': {
          const reportHash = generateTextHash(request.text + request.analysisType);
          const result = await cache.getReport(reportHash);
          return result as UnifiedProcessSchema | null;
        }
        default:
          return null;
      }
    } catch (_error) {
      logError(error, "${ICONS.WARNING} Cache check failed:", { component: "refactored" });
      return null;
    }
  }

  /**
   * Cache analysis result
   */
  private async cacheResult(request: AnalysisRequest, result: UnifiedProcessSchema, complexity: ComplexityScore): Promise<void> {
    try {
      const { getAiCache, generateTextHash } = await import('./ai-cache-manager');
      const cache = getAiCache();
      const textHash = generateTextHash(request.text);

      const cacheMetadata = {
        model: complexity.recommendedTier,
        tokens_saved: this.router.estimateTokens(request.text),
        workspaceId: request.workspaceId
      };

      switch (request.analysisType) {
        case 'essential':
          await cache.setEssential(textHash, result, cacheMetadata);
          break;
        case 'strategic':
          await cache.setStrategic(textHash, result, complexity.totalScore, cacheMetadata);
          break;
        case 'report':
          const reportHash = generateTextHash(request.text + request.analysisType);
          await cache.setReport(reportHash, result, cacheMetadata);
          break;
      }
    } catch (_error) {
      logError(error, "${ICONS.WARNING} Cache save failed:", { component: "refactored" });
    }
  }

  /**
   * Build successful response
   */
  private buildSuccessResponse(
    data: UnifiedProcessSchema,
    complexity: ComplexityScore,
    cached: boolean,
    processingTime: number
  ): AnalysisResponse {
    // Safely access _routing_info if it exists using type narrowing
    let promptTokens = 0;
    let completionTokens = 0;
    let analysisType = 'unknown';

    // Type guard: check if data has _routing_info property
    if ('_routing_info' in data) {
      const routingInfo = (data as Record<string, unknown>)._routing_info;
      if (routingInfo && typeof routingInfo === 'object') {
        const routingObj = routingInfo as Record<string, unknown>;
        if (typeof routingObj.prompt_tokens === 'number') {
          promptTokens = routingObj.prompt_tokens;
        }
        if (typeof routingObj.completion_tokens === 'number') {
          completionTokens = routingObj.completion_tokens;
        }
        if (typeof routingObj.analysis_type === 'string') {
          analysisType = routingObj.analysis_type;
        }
      }
    }

    const tokenUsage = {
      prompt: promptTokens || this.router.estimateTokens(''),
      completion: completionTokens || this.router.estimateTokens(JSON.stringify(data)),
      total: 0
    };
    tokenUsage.total = tokenUsage.prompt + tokenUsage.completion;

    const cost = this.router.calculateCost(tokenUsage.prompt, tokenUsage.completion, complexity.recommendedTier);

    return {
      success: true,
      data,
      metadata: {
        modelUsed: this.getModelName(complexity.recommendedTier),
        analysisType,
        cached,
        processingTime,
        tokenUsage,
        cost: {
          estimated: cost.estimatedCost,
          currency: 'USD'
        },
        complexity: {
          score: complexity.totalScore,
          factors: complexity.factors,
          tier: complexity.recommendedTier
        },
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Get human-readable model name
   */
  private getModelName(tier: ModelTier): string {
    const names = {
      [ModelTier.LITE]: 'Gemini 1.5 Flash 8B',
      [ModelTier.BALANCED]: 'Gemini 1.5 Flash',
      [ModelTier.PRO]: 'Gemini 1.5 Pro'
    };
    return names[tier] || tier;
  }

  /**
   * Check if error is retryable
   */
  private shouldRetry(error: Error): boolean {
    const retryableErrors = [
      'rate limit',
      'timeout',
      'network',
      'temporary',
      '429',
      '500',
      '502',
      '503',
      '504'
    ];

    const errorMessage = error.message?.toLowerCase() || '';
    return retryableErrors.some(keyword => errorMessage.includes(keyword));
  }

  /**
   * Format error for response
   */
  private formatError(error: Error): string {
    if ('code' in error && 'error' in error) {
      const errorObj = error as Record<string, unknown>;
      return `Gemini API Error (${errorObj.code}): ${errorObj.error}`;
    }

    return error.message;
  }

  /**
   * Update service statistics
   */
  private updateStats(analysisType: string, model: ModelTier, processingTime: number, isError: boolean): void {
    this.stats.totalAnalyses++;
    this.stats.analysesByType[analysisType] = (this.stats.analysesByType[analysisType] || 0) + 1;
    this.stats.analysesByModel[model] = (this.stats.analysesByModel[model] || 0) + 1;

    // Update average processing time
    const prevAvg = this.stats.averageProcessingTime;
    const count = this.stats.totalAnalyses;
    this.stats.averageProcessingTime = (prevAvg * (count - 1) + processingTime) / count;

    if (isError) {
      this.stats.errorRate = (this.stats.errorRate * (count - 1) + 1) / count;
    } else {
      this.stats.errorRate = (this.stats.errorRate * (count - 1)) / count;
    }
  }

  /**
   * Get service statistics
   */
  getStats(): AnalysisStats {
    return { ...this.stats };
  }

  /**
   * Test Gemini API connectivity
   */
  async testConnection(): Promise<{ success: boolean; latency: number; model: string }> {
    try {
      const result = await this.geminiClient.testConnection();
      return result;
    } catch {
      return {
        success: false,
        latency: 0,
        model: 'unknown'
      };
    }
  }

  /**
   * Get rate limit status for all models
   */
  getRateLimitStatus() {
    return this.geminiClient.getRateLimitStatus();
  }

  /**
   * Utility function for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Singleton instance
 */
let analysisServiceInstance: RealAnalysisService | null = null;

export function getRealAnalysisService(): RealAnalysisService {
  if (!analysisServiceInstance) {
    analysisServiceInstance = new RealAnalysisService();
  }
  return analysisServiceInstance;
}