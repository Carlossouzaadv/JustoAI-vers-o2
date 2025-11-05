// ================================================================
// REAL ANALYSIS SERVICE - Production Gemini Integration
// ================================================================
// Complete analysis service using real Gemini API with error handling and rate limiting

import { AIModelRouter, ModelTier, UnifiedProcessSchema, ComplexityScore, ProcessingConfig } from './ai-model-router';
import { getGeminiClient, GeminiClient } from './gemini-client';
import { ICONS } from './icons';

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
      console.log(`${ICONS.PROCESS} Iniciando análise ${request.analysisType} - ${request.text.length} caracteres`);

      // 1. Analyze document complexity
      const complexity = this.router.analyzeComplexity(request.text, request.fileSizeMB || 0);
      console.log(`${ICONS.INFO} Complexidade: ${complexity.totalScore} pontos → Modelo: ${complexity.recommendedTier}`);

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
      console.log(`${ICONS.SUCCESS} Análise concluída em ${processingTime}ms`);

      return this.buildSuccessResponse(analysisResult, complexity, false, processingTime);

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`${ICONS.ERROR} Erro na análise:`, error);

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
        console.log(`${ICONS.PROCESS} Tentativa ${attempt}/${maxRetries} com modelo ${config.model}`);

        // Build the analysis prompt
        const prompt = this.buildAnalysisPrompt(request, config.promptTemplate);

        // Call Gemini API
        const geminiResponse = await this.geminiClient.generateJsonContent(prompt, {
          model: config.model,
          maxTokens: config.maxTokens,
          temperature: config.temperature
        });

        // Validate and enhance the response
        const validatedResult = this.validateAndEnhanceResult(geminiResponse, request, complexity);

        console.log(`${ICONS.SUCCESS} Análise bem-sucedida na tentativa ${attempt}`);
        return validatedResult;

      } catch (error) {
        // Narrow unknown to Error for type safety
        const err = error instanceof Error ? error : new Error(String(error));
        lastError = err;
        console.error(`${ICONS.WARNING} Tentativa ${attempt} falhou:`, error);

        // Check if we should retry
        if (attempt < maxRetries && this.shouldRetry(err)) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          console.log(`${ICONS.INFO} Aguardando ${delay}ms antes da próxima tentativa...`);
          await this.sleep(delay);
          continue;
        }

        // Try fallback model on final attempt
        if (attempt === maxRetries && config.fallbackModel) {
          console.log(`${ICONS.INFO} Tentando modelo de fallback: ${config.fallbackModel}`);
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
   * Validate and enhance Gemini API response
   */
  private validateAndEnhanceResult(
    geminiResponse: Record<string, unknown>,
    request: AnalysisRequest,
    complexity: ComplexityScore
  ): UnifiedProcessSchema {
    // Ensure all required sections exist
    const result: UnifiedProcessSchema = {
      identificacao_basica: geminiResponse.identificacao_basica || {},
      partes_envolvidas: geminiResponse.partes_envolvidas || {},
      valores_financeiros: geminiResponse.valores_financeiros || {},
      campos_especializados: geminiResponse.campos_especializados || {},
      situacao_processual: geminiResponse.situacao_processual || {},
      analise_estrategica: geminiResponse.analise_estrategica || {},
      documentos_relacionados: geminiResponse.documentos_relacionados || {},
      metadados_analise: {
        data_analise: new Date().toISOString(),
        modelo_utilizado: complexity.recommendedTier,
        confianca_geral: this.calculateConfidence(geminiResponse, complexity),
        observacoes_ia: geminiResponse.metadados_analise?.observacoes_ia || null,
        campos_nao_encontrados: this.findMissingFields(geminiResponse),
        ...geminiResponse.metadados_analise
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

    const countFields = (obj: Record<string, unknown>): void => {
      if (obj && typeof obj === 'object') {
        Object.values(obj).forEach(value => {
          totalFields++;
          if (value !== null && value !== undefined && value !== '') {
            filledFields++;
          }
        });
      }
    };

    countFields(response.identificacao_basica);
    countFields(response.partes_envolvidas);
    countFields(response.valores_financeiros);

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
        case 'essential':
          return await cache.getEssential(textHash);
        case 'strategic':
          return await cache.getStrategic(textHash, complexity.totalScore);
        case 'report':
          const reportHash = generateTextHash(request.text + request.analysisType);
          return await cache.getReport(reportHash);
        default:
          return null;
      }
    } catch (error) {
      console.error(`${ICONS.WARNING} Cache check failed:`, error);
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
    } catch (error) {
      console.error(`${ICONS.WARNING} Cache save failed:`, error);
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
    const tokenUsage = {
      prompt: data._routing_info?.prompt_tokens || this.router.estimateTokens(''),
      completion: data._routing_info?.completion_tokens || this.router.estimateTokens(JSON.stringify(data)),
      total: 0
    };
    tokenUsage.total = tokenUsage.prompt + tokenUsage.completion;

    const cost = this.router.calculateCost(tokenUsage.prompt, tokenUsage.completion, complexity.recommendedTier);

    return {
      success: true,
      data,
      metadata: {
        modelUsed: this.getModelName(complexity.recommendedTier),
        analysisType: data._routing_info?.analysis_type || 'unknown',
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