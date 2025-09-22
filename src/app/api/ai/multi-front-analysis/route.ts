// ================================================================
// API ENDPOINT - ANÁLISE MULTI-FRENTES
// ================================================================
// Endpoint para testar e usar os novos prompts de análise multi-frentes

import { NextRequest, NextResponse } from 'next/server';
import { AIModelRouter, ModelTier } from '../../../../lib/ai-model-router';
import PromptsMaestros from '../../../../lib/prompts-maestros';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      numeroProcesso,
      tipoAnalise,
      texto,
      processos,
      situacao,
      contexto,
      audiencia = 'Cliente',
      tipoRelatorio = 'COMPLETO'
    } = body;

    // Validações básicas
    if (!tipoAnalise) {
      return NextResponse.json(
        { error: 'Tipo de análise é obrigatório', code: 'MISSING_ANALYSIS_TYPE' },
        { status: 400 }
      );
    }

    const router = new AIModelRouter();
    let prompt: string;
    let complexity;

    // Gerar prompt baseado no tipo de análise
    switch (tipoAnalise) {
      case 'individual':
        if (!numeroProcesso) {
          return NextResponse.json(
            { error: 'Número do processo é obrigatório para análise individual' },
            { status: 400 }
          );
        }
        prompt = PromptsMaestros.getAnaliseMultiFrentesIndividual(
          numeroProcesso,
          ModelTier.BALANCED
        );
        break;

      case 'multiplos':
        if (!processos || !Array.isArray(processos)) {
          return NextResponse.json(
            { error: 'Lista de processos é obrigatória para análise múltipla' },
            { status: 400 }
          );
        }
        prompt = PromptsMaestros.getAnaliseMultiFrentesMultiplos(
          processos,
          tipoRelatorio,
          audiencia
        );
        break;

      case 'situacao_especifica':
        if (!numeroProcesso || !situacao) {
          return NextResponse.json(
            { error: 'Número do processo e situação são obrigatórios' },
            { status: 400 }
          );
        }
        prompt = PromptsMaestros.getAnaliseSituacaoEspecifica(
          numeroProcesso,
          situacao,
          contexto
        );
        break;

      case 'novidades':
        if (!processos || !Array.isArray(processos)) {
          return NextResponse.json(
            { error: 'Lista de processos é obrigatória para análise de novidades' },
            { status: 400 }
          );
        }
        const periodoAnterior = body.periodoAnterior || 'último mês';
        prompt = PromptsMaestros.getAnaliseNovidades(
          processos,
          periodoAnterior,
          body.ultimoRelatorio
        );
        break;

      case 'jurisprudencial':
        if (!numeroProcesso || !body.questaoJuridica) {
          return NextResponse.json(
            { error: 'Número do processo e questão jurídica são obrigatórios' },
            { status: 400 }
          );
        }
        prompt = PromptsMaestros.getAnaliseJurisprudencial(
          numeroProcesso,
          body.questaoJuridica,
          body.instancia
        );
        break;

      default:
        return NextResponse.json(
          { error: `Tipo de análise '${tipoAnalise}' não suportado` },
          { status: 400 }
        );
    }

    // Validar estrutura do prompt
    const validation = PromptsMaestros.validatePromptStructure(prompt);
    if (!validation.isValid) {
      console.warn('Prompt validation warnings:', validation.errors);
    }

    // Analisar complexidade se houver texto
    if (texto) {
      complexity = router.analyzeComplexity(texto);
      console.log(`📊 Complexidade detectada: ${complexity.totalScore} pontos → ${complexity.recommendedTier}`);
    }

    // Para demonstração, vamos simular uma resposta estruturada
    // Em produção, aqui seria feita a chamada real para o Gemini
    const mockResponse = {
      success: true,
      analysis_type: tipoAnalise,
      prompt_generated: {
        length: prompt.length,
        validated: validation.isValid,
        suggestions: validation.suggestions
      },
      complexity_analysis: complexity ? {
        total_score: complexity.totalScore,
        recommended_tier: complexity.recommendedTier,
        document_type: complexity.documentType,
        factors: complexity.factors
      } : null,
      mock_result: {
        message: `Análise ${tipoAnalise} gerada com sucesso`,
        prompt_preview: prompt.substring(0, 500) + '...',
        estrutura_resposta: 'JSON estruturado conforme especificação'
      }
    };

    // Em produção, substituir por:
    // const result = await router.processWithModel(texto || JSON.stringify(body), complexity?.recommendedTier || ModelTier.BALANCED, tipoAnalise);

    return NextResponse.json(mockResponse);

  } catch (error) {
    console.error('Erro na análise multi-frentes:', error);
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Endpoint para listar tipos de análise disponíveis
  const tiposAnalise = {
    individual: {
      description: 'Análise multi-frentes de um processo individual',
      required_fields: ['numeroProcesso', 'texto'],
      optional_fields: ['tier']
    },
    multiplos: {
      description: 'Análise consolidada de múltiplos processos',
      required_fields: ['processos'],
      optional_fields: ['audiencia', 'tipoRelatorio']
    },
    situacao_especifica: {
      description: 'Análise de situação específica em um processo',
      required_fields: ['numeroProcesso', 'situacao'],
      optional_fields: ['contexto']
    },
    novidades: {
      description: 'Análise de novidades/mudanças desde último período',
      required_fields: ['processos'],
      optional_fields: ['periodoAnterior', 'ultimoRelatorio']
    },
    jurisprudencial: {
      description: 'Análise de precedentes e jurisprudência aplicável',
      required_fields: ['numeroProcesso', 'questaoJuridica'],
      optional_fields: ['instancia']
    }
  };

  return NextResponse.json({
    message: 'API de Análise Multi-Frentes - JustoAI V2',
    version: '1.0.0',
    tipos_analise_disponiveis: tiposAnalise,
    exemplo_uso: {
      method: 'POST',
      body: {
        tipoAnalise: 'individual',
        numeroProcesso: '5080281-82.2020.4.02.5101',
        texto: 'Texto do documento ou processo...'
      }
    }
  });
}