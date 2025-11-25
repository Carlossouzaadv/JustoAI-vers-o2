// ================================================================
// GEMINI TEST ENDPOINT - Test Real Gemini Integration
// ================================================================
// Simple endpoint to test Gemini API connectivity and functionality

import { NextRequest, NextResponse } from 'next/server';
import { getGeminiClient } from '@/lib/gemini-client';
import { getRealAnalysisService } from '@/lib/real-analysis-service';
import { ModelTier } from '@/lib/ai-model-router';
import { ICONS } from '@/lib/icons';

// === TYPE DEFINITIONS (Safe Function Types) ===

interface GeminiGenerateOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

interface GeminiContentResponse {
  content: string;
  usage?: Record<string, unknown>;
}

interface GeminiClient {
  generateContent: (_prompt: string, _options: GeminiGenerateOptions) => Promise<GeminiContentResponse>;
  generateJsonContent: (_prompt: string, _options: GeminiGenerateOptions) => Promise<unknown>;
  getRateLimitStatus: () => unknown;
}

// Type guard para gemini client
function isGeminiClient(data: unknown): data is GeminiClient {
  return (
    typeof data === 'object' &&
    data !== null &&
    'generateContent' in data &&
    typeof (data as Record<string, unknown>).generateContent === 'function' &&
    'generateJsonContent' in data &&
    typeof (data as Record<string, unknown>).generateJsonContent === 'function'
  );
}

export async function GET() {
  try {
    console.log(`${ICONS.PROCESS} Testando conectividade Gemini`);

    const geminiClient = getGeminiClient();
    const analysisService = getRealAnalysisService();

    // 1. Test basic connectivity
    const connectionTest = await analysisService.testConnection();

    // 2. Test each model tier
    const modelTests = await Promise.allSettled([
      testModel(geminiClient, ModelTier.LITE),
      testModel(geminiClient, ModelTier.BALANCED),
      testModel(geminiClient, ModelTier.PRO)
    ]);

    // 3. Get rate limit status
    const rateLimits = geminiClient.getRateLimitStatus();

    // 4. Test structured JSON response
    const jsonTest = await testJsonGeneration(geminiClient);

    const results = {
      success: true,
      connectivity: connectionTest,
      model_tests: {
        lite: modelTests[0].status === 'fulfilled' ? modelTests[0].value : { success: false, error: modelTests[0].reason?.message },
        balanced: modelTests[1].status === 'fulfilled' ? modelTests[1].value : { success: false, error: modelTests[1].reason?.message },
        pro: modelTests[2].status === 'fulfilled' ? modelTests[2].value : { success: false, error: modelTests[2].reason?.message }
      },
      json_generation_test: jsonTest,
      rate_limits: rateLimits,
      environment: {
        api_key_configured: !!process.env.GOOGLE_API_KEY,
        api_key_prefix: process.env.GOOGLE_API_KEY?.substring(0, 10) + '...' || 'Not configured'
      },
      timestamp: new Date().toISOString()
    };

    console.log(`${ICONS.SUCCESS} Teste Gemini concluído`);

    return NextResponse.json(results);

  } catch (_error) {
    console.error(`${ICONS.ERROR} Erro no teste Gemini:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      {
        success: false,
        error: errorMessage || 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    console.log(`${ICONS.PROCESS} Teste de análise completa com Gemini`);

    const body = await req.json();
    const testText = body.text || getDefaultTestText();

    const analysisService = getRealAnalysisService();

    // Test complete analysis workflow
    const analysisRequest = {
      text: testText,
      analysisType: 'essential' as const,
      fileSizeMB: 0,
      workspaceId: undefined, // Don't use workspace for tests
      forceRefresh: true,
      metadata: {
        documentType: 'test',
        userId: 'test-user'
      }
    };

    const result = await analysisService.analyze(analysisRequest);

    console.log(`${ICONS.SUCCESS} Teste de análise concluído`);

    return NextResponse.json({
      success: true,
      analysis_result: result,
      test_input: {
        text_length: testText.length,
        analysis_type: 'essential'
      },
      timestamp: new Date().toISOString()
    });

  } catch (_error) {
    console.error(`${ICONS.ERROR} Erro no teste de análise:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      {
        success: false,
        error: errorMessage || 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

async function testModel(geminiClient: unknown, model: ModelTier) {
  const startTime = Date.now();

  try {
    if (!isGeminiClient(geminiClient)) {
      throw new Error('Gemini client is invalid');
    }

    const response = await geminiClient.generateContent(
      'Responda apenas com "OK" para confirmar que você está funcionando.',
      {
        model,
        maxTokens: 10,
        temperature: 0
      }
    );

    const latency = Date.now() - startTime;

    return {
      success: true,
      model,
      response: response.content.trim(),
      latency_ms: latency,
      token_usage: response.usage
    };

  } catch (_error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      model,
      error: errorMessage || 'Unknown error',
      latency_ms: Date.now() - startTime
    };
  }
}

async function testJsonGeneration(geminiClient: unknown) {
  const startTime = Date.now();

  try {
    if (!isGeminiClient(geminiClient)) {
      throw new Error('Gemini client is invalid');
    }

    const testPrompt = `Retorne um JSON simples com as seguintes informações:
{
  "status": "funcionando",
  "timestamp": "data_atual",
  "teste": true
}

Retorne APENAS o JSON, sem nenhum texto adicional.`;

    const jsonResponse = await geminiClient.generateJsonContent(testPrompt, {
      model: ModelTier.LITE,
      maxTokens: 100,
      temperature: 0
    });

    const latency = Date.now() - startTime;

    return {
      success: true,
      latency_ms: latency,
      json_parsed: typeof jsonResponse === 'object',
      response: jsonResponse
    };

  } catch (_error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMessage || 'Unknown error',
      latency_ms: Date.now() - startTime
    };
  }
}

function getDefaultTestText(): string {
  return `TRIBUNAL DE JUSTIÇA DO ESTADO DE SÃO PAULO
COMARCA DE SÃO PAULO
1ª VARA CÍVEL

PROCESSO: 1000000-00.2023.8.26.0100

AUTOR: João Silva
RÉUS: Empresa XYZ Ltda

PETIÇÃO INICIAL

O autor João Silva, brasileiro, casado, empresário, portador do RG 12.345.678-9 e CPF 123.456.789-00, residente na Rua das Flores, 123, São Paulo/SP, vem respeitosamente à presença de Vossa Excelência, por meio de seu advogado, propor

AÇÃO DE COBRANÇA

em face de EMPRESA XYZ LTDA, pessoa jurídica de direito privado, inscrita no CNPJ sob nº 11.222.333/0001-44, com sede na Av. Paulista, 1000, São Paulo/SP, pelos fatos e fundamentos jurídicos a seguir expostos:

DOS FATOS

Em 15 de janeiro de 2023, o autor celebrou contrato de prestação de serviços com a ré no valor de R$ 50.000,00 (cinquenta mil reais).

Os serviços foram devidamente prestados pelo autor, conforme comprovam os documentos anexos.

Entretanto, a empresa ré permanece inadimplente quanto ao pagamento da quantia devida.

DO DIREITO

O inadimplemento contratual da ré configura descumprimento de obrigação, nos termos do art. 389 do Código Civil.

DOS PEDIDOS

Diante do exposto, requer:
a) A procedência da ação para condenar a ré ao pagamento de R$ 50.000,00;
b) A condenação da ré ao pagamento de juros e correção monetária;
c) A condenação da ré ao pagamento das custas processuais e honorários advocatícios.

São Paulo, 15 de março de 2023.

[Assinatura do Advogado]
OAB/SP 123.456`;
}