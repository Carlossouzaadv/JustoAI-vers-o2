// ================================
// API PARA ANÁLISE DE IA COM CACHE INTELIGENTE
// ================================
// Endpoint unificado para análises essenciais, estratégicas e relatórios

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getRealAnalysisService } from '@/lib/real-analysis-service';
import { validateAuthAndGetUser } from '@/lib/auth';
import { ICONS } from '@/lib/icons';
import { requireWorkspaceAdmin, isInternalDivinityAdmin } from '@/lib/permission-validator';
import { getCredits, debitCredits } from '@/lib/services/creditService';

// ================================
// VALIDAÇÃO DE INPUT
// ================================

const analyzeSchema = z.object({
  text: z.string().min(1, 'Texto é obrigatório'),
  analysis_type: z.enum(['essential', 'strategic', 'report']),
  file_size_mb: z.number().optional().default(0),
  workspace_id: z.string().optional(),
  report_type: z.string().optional(),
  report_data: z.unknown().optional(),
  force_refresh: z.boolean().optional().default(false)
});

// ================================
// API ENDPOINTS
// ================================

export async function POST(req: NextRequest) {
  try {
    console.log(`${ICONS.PROCESS} Nova requisição de análise IA (Gemini Real)`);

    // 1. Autenticação
    const { user, workspace } = await validateAuthAndGetUser();

    // 2. Validação do input
    const body = await req.json();
    const validatedData = analyzeSchema.parse(body);

    // 3. Setup do serviço de análise real
    const analysisService = getRealAnalysisService();

    // 4. Preparar dados para análise
    const analysisRequest = {
      text: validatedData.text,
      analysisType: validatedData.analysis_type,
      fileSizeMB: validatedData.file_size_mb || 0,
      workspaceId: workspace.id,
      forceRefresh: validatedData.force_refresh || false,
      metadata: {
        documentType: validatedData.report_type || undefined,
        userId: user.id,
        sourceFile: body.source_file || undefined
      }
    };

    console.log(`${ICONS.INFO} Processando análise ${validatedData.analysis_type} com Gemini API`);

    // 4.5. Determine credit cost based on analysis type
    const creditCosts: Record<string, number> = {
      'essential': 0,
      'strategic': 1,
      'report': 2
    };
    const creditCost = creditCosts[validatedData.analysis_type] || 0;

    // 4.6. Check credits before expensive operation
    const isDivinity = isInternalDivinityAdmin(user.email);
    if (!isDivinity && creditCost > 0) {
      const credits = await getCredits(user.email, workspace.id);
      const availableCredits = validatedData.analysis_type === 'report' ? credits.fullCredits : credits.fullCredits;

      if (availableCredits < creditCost) {
        return NextResponse.json(
          {
            success: false,
            error: `Créditos insuficientes para análise ${validatedData.analysis_type}`,
            required: creditCost,
            available: availableCredits,
            message: `Você precisa de ${creditCost} crédito(s) para realizar uma análise ${validatedData.analysis_type}. Entre em contato com o suporte para adquirir mais créditos.`
          },
          { status: 402 } // Payment Required
        );
      }
    }

    // 5. Executar análise com Gemini real
    const result = await analysisService.analyze(analysisRequest);

    if (!result.success) {
      console.error(`${ICONS.ERROR} Análise falhou: ${result.error}`);
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Falha na análise',
          metadata: result.metadata
        },
        { status: 500 }
      );
    }

    // 6. Debit credits if not cached and not a divinity admin
    if (!isDivinity && creditCost > 0 && !result.metadata.cached) {
      const debitResult = await debitCredits(
        user.email,
        workspace.id,
        creditCost,
        'FULL',
        `AI ${validatedData.analysis_type} analysis`
      );
      // Use narrowing seguro to safely access newBalance
      if (debitResult.success && debitResult.newBalance) {
        console.log(`${ICONS.SUCCESS} Credits debited: ${creditCost} credit(s) (new balance: ${debitResult.newBalance.fullCredits})`);
      } else {
        console.warn(`${ICONS.WARNING} Failed to debit credits: ${debitResult.reason}`);
        // Log but don't fail the request - the analysis was already completed
      }
    }

    // 7. Resposta de sucesso
    console.log(`${ICONS.SUCCESS} Análise concluída: ${validatedData.analysis_type} - Modelo: ${result.metadata.modelUsed}`);

    return NextResponse.json({
      success: true,
      data: result.data,
      analysis_type: validatedData.analysis_type,

      // Compatibilidade com formato anterior
      cache_info: {
        cached: result.metadata.cached,
        tokens_saved: result.metadata.cached ? result.metadata.tokenUsage.total : 0,
        model_used: result.metadata.modelUsed,
        complexity_score: result.metadata.complexity.score
      },

      // Informações detalhadas do Gemini
      gemini_info: {
        model_used: result.metadata.modelUsed,
        processing_time_ms: result.metadata.processingTime,
        token_usage: result.metadata.tokenUsage,
        cost_estimate: result.metadata.cost,
        complexity_analysis: result.metadata.complexity,
        cached: result.metadata.cached
      },

      timestamp: result.metadata.timestamp
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro na análise IA:`, error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Dados inválidos', details: error.issues },
        { status: 400 }
      );
    }

    // Erro específico do Gemini
    if (typeof error === 'object' && error !== null && 'code' in error && 'error' in error) {
      const geminiError = error as { code?: number; error?: string; retryable?: boolean };
      return NextResponse.json(
        {
          success: false,
          error: `Gemini API Error: ${geminiError.error}`,
          code: geminiError.code,
          retryable: geminiError.retryable || false
        },
        { status: geminiError.code === 429 ? 429 : 500 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// ================================
// ESTATÍSTICAS DO CACHE
// ================================

export async function GET(req: NextRequest) {
  try {
    console.log(`${ICONS.INFO} Requisição de estatísticas da análise Gemini`);

    // 1. Autenticação
    await validateAuthAndGetUser();

    // 2. Obter estatísticas do serviço real
    const analysisService = getRealAnalysisService();
    const serviceStats = analysisService.getStats();
    const rateLimitStatus = analysisService.getRateLimitStatus();

    // 3. Teste de conectividade
    const connectionTest = await analysisService.testConnection();

    // 4. Obter estatísticas de cache (se disponível)
    let cacheStats = null;
    try {
      const { getAiCache } = await import('@/lib/ai-cache-manager');
      const cache = getAiCache();
      cacheStats = await cache.getStats();
    } catch (error) {
      console.warn(`${ICONS.WARNING} Cache stats not available:`, error);
    }

    return NextResponse.json({
      success: true,

      // Estatísticas do serviço de análise
      analysis_service: {
        total_analyses: serviceStats.totalAnalyses,
        analyses_by_type: serviceStats.analysesByType,
        analyses_by_model: serviceStats.analysesByModel,
        total_tokens_used: serviceStats.totalTokensUsed,
        total_cost_usd: serviceStats.totalCostUSD,
        average_processing_time_ms: serviceStats.averageProcessingTime,
        cache_hit_rate: serviceStats.cacheHitRate,
        error_rate: serviceStats.errorRate
      },

      // Status de rate limiting do Gemini
      gemini_rate_limits: rateLimitStatus,

      // Teste de conectividade
      connectivity: {
        gemini_api_status: connectionTest.success ? 'connected' : 'failed',
        latency_ms: connectionTest.latency,
        model_tested: connectionTest.model
      },

      // Estatísticas de cache (compatibilidade)
      cache_stats: cacheStats,

      // Recomendações baseadas nas estatísticas
      recommendations: {
        cache_hit_rate: serviceStats.cacheHitRate,
        performance_level: serviceStats.averageProcessingTime < 5000 ? 'excellent' :
                          serviceStats.averageProcessingTime < 10000 ? 'good' : 'needs_improvement',
        error_rate_level: serviceStats.errorRate < 0.05 ? 'excellent' :
                         serviceStats.errorRate < 0.1 ? 'good' : 'needs_improvement',
        cost_efficiency: serviceStats.totalCostUSD / Math.max(serviceStats.totalAnalyses, 1)
      },

      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro ao obter estatísticas:`, error);

    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// ================================
// LIMPEZA DE CACHE
// ================================

export async function DELETE(req: NextRequest) {
  try {
    console.log(`${ICONS.WARNING} Requisição de limpeza de cache`);

    // 1. Autenticação (apenas admins)
    const { user, workspace } = await validateAuthAndGetUser();

    // 2. Verificar se user é admin do workspace
    const adminCheck = await requireWorkspaceAdmin(user.id, workspace.id);
    if (!adminCheck.authorized) {
      console.warn(
        `${ICONS.SHIELD} Acesso negado: ${adminCheck.error}`
      );
      return NextResponse.json(
        {
          success: false,
          error: 'Acesso negado. Apenas admins podem limpar o cache.',
          details: adminCheck.error
        },
        { status: 403 }
      );
    }

    // 3. Limpar cache
    const { getAiCache } = await import('@/lib/ai-cache-manager');
    const cache = getAiCache();
    await cache.clearAll();

    console.log(`${ICONS.CLEAN} Cache limpo pelo usuário ${user.email}`);

    return NextResponse.json({
      success: true,
      message: 'Cache limpo com sucesso',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro ao limpar cache:`, error);

    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}