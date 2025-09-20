// ================================
// API PARA ANÁLISE DE IA COM CACHE INTELIGENTE
// ================================
// Endpoint unificado para análises essenciais, estratégicas e relatórios

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AIModelRouter } from '@/lib/ai-model-router';
import { getAiCache } from '@/lib/ai-cache-manager';
import { validateAuthAndGetUser } from '@/lib/auth';
import { ICONS } from '@/lib/icons';

// ================================
// VALIDAÇÃO DE INPUT
// ================================

const analyzeSchema = z.object({
  text: z.string().min(1, "Texto é obrigatório"),
  analysis_type: z.enum(['essential', 'strategic', 'report']),
  file_size_mb: z.number().optional().default(0),
  workspace_id: z.string().optional(),
  report_type: z.string().optional(),
  report_data: z.any().optional(),
  force_refresh: z.boolean().optional().default(false)
});

// ================================
// API ENDPOINTS
// ================================

export async function POST(req: NextRequest) {
  try {
    console.log(`${ICONS.PROCESS} Nova requisição de análise IA`);

    // 1. Autenticação
    const { user, workspace } = await validateAuthAndGetUser(req);

    // 2. Validação do input
    const body = await req.json();
    const validatedData = analyzeSchema.parse(body);

    // 3. Setup do router
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'Google API Key não configurada' },
        { status: 500 }
      );
    }

    const router = new AIModelRouter();
    let result;

    // 4. Processar de acordo com o tipo de análise
    switch (validatedData.analysis_type) {
      case 'essential':
        console.log(`${ICONS.INFO} Processando análise ESSENCIAL (Flash 8B + Cache)`);
        result = await router.analyzeEssential(
          validatedData.text,
          workspace.id
        );
        break;

      case 'strategic':
        console.log(`${ICONS.INFO} Processando análise ESTRATÉGICA (Routing por complexidade + Cache)`);
        result = await router.analyzeStrategic(
          validatedData.text,
          validatedData.file_size_mb,
          workspace.id
        );
        break;

      case 'report':
        console.log(`${ICONS.INFO} Processando RELATÓRIO (Flash + Cache)`);
        const reportData = validatedData.report_data || { text: validatedData.text };
        result = await router.generateReport(
          reportData,
          validatedData.report_type || 'general',
          workspace.id
        );
        break;

      default:
        return NextResponse.json(
          { success: false, error: 'Tipo de análise não suportado' },
          { status: 400 }
        );
    }

    // 5. Resposta com informações de cache
    console.log(`${ICONS.SUCCESS} Análise concluída: ${validatedData.analysis_type}`);

    return NextResponse.json({
      success: true,
      data: result,
      analysis_type: validatedData.analysis_type,
      cache_info: {
        cached: result._routing_info?.cached || false,
        tokens_saved: result._routing_info?.tokens_saved || 0,
        model_used: result._routing_info?.final_tier,
        complexity_score: result._routing_info?.complexity_score
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro na análise IA:`, error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Dados inválidos', details: error.issues },
        { status: 400 }
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
    console.log(`${ICONS.INFO} Requisição de estatísticas de cache`);

    // 1. Autenticação
    await validateAuthAndGetUser(req);

    // 2. Obter estatísticas
    const cache = getAiCache();
    const stats = await cache.getStats();
    const topSaving = await cache.getTopSavingEntries(10);

    return NextResponse.json({
      success: true,
      cache_stats: stats,
      top_saving_entries: topSaving,
      recommendations: {
        cache_hit_rate: stats.memory.hit_rate,
        tokens_saved_today: stats.postgresql.tokens_saved_today,
        estimated_cost_saved_usd: stats.postgresql.cost_saved_usd,
        cache_efficiency: stats.memory.hit_rate > 50 ? 'excellent' : stats.memory.hit_rate > 20 ? 'good' : 'needs_improvement'
      }
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
    const { user, workspace } = await validateAuthAndGetUser(req);

    // TODO: Verificar se user é admin do workspace

    // 2. Limpar cache
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