/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
// ================================================================
// TOKEN OPTIMIZER - Serviço Integrado de Otimização do JustoAI V2
// ================================================================
// Combina PDF processing, text cleaning e AI routing para máxima economia

import { PDFProcessor, ExtractionResult } from './pdf-processor';
import { TextCleaner, CleaningResult } from './text-cleaner';
import { AIModelRouter, ComplexityScore, ModelTier, ProcessingConfig, ModelCosts } from './ai-model-router';

export interface OptimizationResult {
  // Resultados do processamento
  extractionResult: ExtractionResult;
  cleaningResult: CleaningResult;
  complexityAnalysis: ComplexityScore;

  // Configuração final
  selectedModel: ModelTier;
  processingConfig: ProcessingConfig;

  // Informações extraídas
  extractedProcessNumber: string | null;

  // Métricas de economia
  totalTokenReduction: number;
  estimatedCostSaving: number;
  savingsPercentage: number;

  // Metadados
  processingTime: number;
  confidence: number;
  qualityScore: number;
}

export interface OptimizationOptions {
  documentType: 'legal' | 'general';
  userPlan: 'starter' | 'professional';
  aggressiveness: 'conservative' | 'balanced' | 'aggressive';
  preserveStructure: boolean;
  customPatterns?: any[];
}

export class TokenOptimizer {
  private pdfProcessor: PDFProcessor;
  private textCleaner: TextCleaner;
  private modelRouter: AIModelRouter;

  constructor() {
    this.pdfProcessor = new PDFProcessor();
    this.textCleaner = new TextCleaner();
    this.modelRouter = new AIModelRouter();
  }

  /**
   * Pipeline completo de otimização de tokens
   * Integra todas as etapas do processamento V1 otimizado
   */
  async optimizeDocument(
    buffer: Buffer,
    filename: string,
    options: OptimizationOptions
  ): Promise<OptimizationResult> {
    const startTime = Date.now();

    try {
      console.log('🚀 Iniciando pipeline de otimização completo...');

      // ETAPA 1: Validação robusta do PDF
      console.log('📋 Validando PDF...');
      const validation = await this.pdfProcessor.validatePDF(buffer, filename, options.userPlan);

      if (!validation.isValid) {
        throw new Error(`PDF inválido: ${validation.errors.join(', ')}`);
      }

      if (validation.warnings.length > 0) {
        console.log('⚠️ Avisos de validação:', validation.warnings);
      }

      // ETAPA 2: Extração em cascata
      console.log('🔍 Extraindo texto em cascata...');
      const extractionResult = await this.pdfProcessor.extractText(buffer);

      if (!extractionResult.success) {
        throw new Error('Falha na extração de texto do PDF');
      }

      console.log(`✅ Texto extraído: ${extractionResult.text.length} caracteres`);

      // ETAPA 3: Limpeza inteligente de texto
      console.log('🧹 Aplicando limpeza inteligente...');
      const cleaningData = this.textCleaner.cleanLegalDocument(extractionResult.text);
      const cleaningResult: CleaningResult = {
        originalText: extractionResult.text,
        ...cleaningData
      };

      console.log(`🎯 Texto limpo: ${cleaningResult.reductionPercentage}% de redução`);

      // ETAPA 4: Extração do número do processo
      console.log('🔍 Extraindo número do processo...');
      const extractedProcessNumber = this.textCleaner.extractProcessNumber(extractionResult.text);

      if (extractedProcessNumber) {
        console.log(`📋 Número do processo identificado: ${extractedProcessNumber}`);
      } else {
        console.log('⚠️ Número do processo não identificado no documento');
      }

      // ETAPA 5: Análise de complexidade
      console.log('🧮 Analisando complexidade...');
      const complexityAnalysis = this.modelRouter.analyzeComplexity(
        cleaningResult.cleanedText,
        validation.metadata.sizeMB
      );

      // ETAPA 6: Configuração otimizada
      const processingConfig = this.modelRouter.getProcessingConfig(
        complexityAnalysis,
        options.documentType
      );

      // ETAPA 7: Cálculo de métricas de economia
      const metrics = this.calculateOptimizationMetrics(
        extractionResult,
        cleaningResult,
        complexityAnalysis,
        validation.metadata.sizeMB
      );

      const processingTime = Date.now() - startTime;

      const result: OptimizationResult = {
        extractionResult,
        cleaningResult,
        complexityAnalysis,
        selectedModel: processingConfig.model,
        processingConfig,
        extractedProcessNumber,
        totalTokenReduction: metrics.totalTokenReduction,
        estimatedCostSaving: metrics.estimatedCostSaving,
        savingsPercentage: metrics.savingsPercentage,
        processingTime,
        confidence: this.calculateOverallConfidence(extractionResult, cleaningResult, complexityAnalysis),
        qualityScore: this.calculateQualityScore(extractionResult, cleaningResult, complexityAnalysis)
      };

      console.log('🎉 Pipeline de otimização concluído!');
      console.log(`📊 Economia: ${result.savingsPercentage}% | Confiança: ${(result.confidence * 100).toFixed(1)}%`);

      return result;

    } catch (error) {
      console.error('❌ Erro no pipeline de otimização:', error);
      throw error;
    }
  }

  /**
   * Processa documento com IA usando configuração otimizada
   */
  async processWithOptimizedAI(
    optimizationResult: OptimizationResult,
    aiProcessingFunction: (_config: ProcessingConfig, _text: string) => Promise<any>
  ): Promise<{
    result: any;
    modelUsed: ModelTier;
    actualCost: ModelCosts;
    savingsReport: any;
  }> {

    console.log('🤖 Iniciando processamento com IA otimizada...');

    const { cleanedText } = optimizationResult.cleaningResult;
    const { complexityAnalysis } = optimizationResult;

    // Usar fallback automático se disponível
    const aiResult = await this.modelRouter.processWithFallback(
      cleanedText,
      complexityAnalysis,
      (config) => aiProcessingFunction(config, cleanedText)
    );

    // Gerar relatório de economia
    const inputTokens = this.modelRouter.estimateTokens(cleanedText);
    const savingsReport = this.modelRouter.getCostSavingsReport(
      aiResult.modelUsed,
      complexityAnalysis,
      inputTokens
    );

    console.log(`💰 Economia final: ${savingsReport.savingsPercentage}% vs modelo mais caro`);

    return {
      result: aiResult.result,
      modelUsed: aiResult.modelUsed,
      actualCost: aiResult.cost,
      savingsReport
    };
  }

  /**
   * Calcula métricas de otimização
   */
  private calculateOptimizationMetrics(
    extraction: ExtractionResult,
    cleaning: CleaningResult,
    complexity: ComplexityScore,
    _fileSizeMB: number
  ): {
    totalTokenReduction: number;
    estimatedCostSaving: number;
    savingsPercentage: number;
  } {

    // Calcular redução total de tokens
    const originalTokens = Math.ceil(extraction.originalLength / 4);
    const cleanedTokens = Math.ceil(cleaning.cleanedLength / 4);
    const totalTokenReduction = originalTokens - cleanedTokens;

    // Estimar economia de custo baseada no modelo selecionado
    const worstCaseModel = ModelTier.PRO;
    const selectedModel = complexity.recommendedTier;

    const worstCaseCost = this.modelRouter.calculateCost(originalTokens, originalTokens * 0.3, worstCaseModel);
    const optimizedCost = this.modelRouter.calculateCost(cleanedTokens, cleanedTokens * 0.3, selectedModel);

    const estimatedCostSaving = worstCaseCost.estimatedCost - optimizedCost.estimatedCost;
    const savingsPercentage = Math.round((estimatedCostSaving / worstCaseCost.estimatedCost) * 100);

    return {
      totalTokenReduction,
      estimatedCostSaving,
      savingsPercentage
    };
  }

  /**
   * Calcula confiança geral do processamento
   */
  private calculateOverallConfidence(
    extraction: ExtractionResult,
    cleaning: CleaningResult,
    complexity: ComplexityScore
  ): number {

    const weights = {
      extraction: 0.4,
      cleaning: 0.3,
      complexity: 0.3
    };

    const extractionScore = extraction.quality === 'high' ? 1.0 :
                           extraction.quality === 'medium' ? 0.7 : 0.4;

    const cleaningScore = cleaning.confidence;
    const complexityScore = complexity.confidence;

    return (
      extractionScore * weights.extraction +
      cleaningScore * weights.cleaning +
      complexityScore * weights.complexity
    );
  }

  /**
   * Calcula pontuação de qualidade do processamento
   */
  private calculateQualityScore(
    extraction: ExtractionResult,
    cleaning: CleaningResult,
    complexity: ComplexityScore
  ): number {

    let score = 0;

    // Pontuação por qualidade da extração
    if (extraction.quality === 'high') score += 30;
    else if (extraction.quality === 'medium') score += 20;
    else score += 10;

    // Pontuação por eficiência da limpeza
    if (cleaning.reductionPercentage >= 35) score += 25;
    else if (cleaning.reductionPercentage >= 20) score += 15;
    else if (cleaning.reductionPercentage >= 10) score += 10;
    else score += 5;

    // Pontuação por análise de complexidade
    if (complexity.confidence >= 0.9) score += 20;
    else if (complexity.confidence >= 0.8) score += 15;
    else if (complexity.confidence >= 0.7) score += 10;
    else score += 5;

    // Pontuação por padrões de limpeza aplicados
    score += Math.min(cleaning.patternsRemoved.length * 2, 15);

    // Pontuação por sucesso geral
    if (extraction.success && cleaning.reductionPercentage > 0) score += 10;

    return Math.min(score, 100); // Máximo 100 pontos
  }

  /**
   * Gera relatório detalhado de otimização
   */
  generateOptimizationReport(result: OptimizationResult): {
    summary: string;
    metrics: any;
    recommendations: string[];
  } {

    const { extractionResult, cleaningResult, complexityAnalysis } = result;

    const summary = `
Processamento concluído com sucesso!
• Redução de tokens: ${result.totalTokenReduction.toLocaleString()}
• Economia estimada: ${result.savingsPercentage}%
• Modelo selecionado: ${result.selectedModel}
• Tempo de processamento: ${result.processingTime}ms
• Qualidade: ${result.qualityScore}/100
    `.trim();

    const metrics = {
      extraction: {
        method: extractionResult.method,
        quality: extractionResult.quality,
        success: extractionResult.success
      },
      cleaning: {
        reductionPercentage: cleaningResult.reductionPercentage,
        patternsApplied: cleaningResult.patternsRemoved.length,
        confidence: cleaningResult.confidence
      },
      complexity: {
        totalScore: complexityAnalysis.totalScore,
        recommendedModel: complexityAnalysis.recommendedTier,
        confidence: complexityAnalysis.confidence
      },
      costs: {
        tokensSaved: result.totalTokenReduction,
        costSaving: result.estimatedCostSaving,
        savingsPercentage: result.savingsPercentage
      }
    };

    const recommendations: string[] = [];

    // Recomendações baseadas nos resultados
    if (cleaningResult.reductionPercentage < 20) {
      recommendations.push('Considere usar configuração mais agressiva de limpeza para maior economia');
    }

    if (extractionResult.quality === 'low') {
      recommendations.push('Qualidade de extração baixa - verifique se PDF não está corrompido');
    }

    if (complexityAnalysis.totalScore > 40 && complexityAnalysis.recommendedTier === ModelTier.LITE) {
      recommendations.push('Documento complexo com modelo básico - monitore qualidade dos resultados');
    }

    if (result.qualityScore > 80) {
      recommendations.push('Excelente otimização! Configurações ideais para este tipo de documento');
    }

    return {
      summary,
      metrics,
      recommendations
    };
  }

  /**
   * Utilitário para logging de memória durante processamento
   */
  logMemoryUsage(stage: string): void {
    this.pdfProcessor.logMemoryUsage(`TokenOptimizer - ${stage}`);
  }
}