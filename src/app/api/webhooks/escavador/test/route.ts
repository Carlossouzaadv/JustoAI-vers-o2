import { NextRequest, NextResponse } from 'next/server';

// ============================================
// TESTE: Simula callback do Escavador
// GET /api/webhooks/escavador/test
// 
// Use para diagnosticar se o webhook está funcionando
// ============================================

export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://v2.justoai.com.br';
  const webhookUrl = `${baseUrl}/api/webhooks/escavador`;
  const webhookSecret = process.env.ESCAVADOR_WEBHOOK_SECRET;
  
  // Simular callback de teste
  const testCallback = {
    event: 'atualizacao_processo_concluida',
    atualizacao: {
      id: 999999,
      status: 'SUCESSO',
      numero_cnj: '0000000-00.0000.0.00.0000', // CNJ de teste
      criado_em: new Date().toISOString(),
      concluido_em: new Date().toISOString(),
      enviar_callback: 'SIM'
    },
    uuid: 'test-uuid-' + Date.now()
  };

  try {
    // Tentar enviar para nosso próprio webhook
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': webhookSecret ? `Bearer ${webhookSecret}` : '',
        'X-Test': 'true'
      },
      body: JSON.stringify(testCallback)
    });

    const responseText = await response.text();
    let responseJson;
    try {
      responseJson = JSON.parse(responseText);
    } catch {
      responseJson = null;
    }

    return NextResponse.json({
      test: 'webhook_self_call',
      webhookUrl,
      hasSecret: !!webhookSecret,
      secretPreview: webhookSecret ? `${webhookSecret.substring(0, 10)}...` : null,
      callback_sent: testCallback,
      response: {
        status: response.status,
        statusText: response.statusText,
        body: responseJson || responseText
      },
      diagnosis: response.status === 200 ? 
        'Webhook funcionando corretamente!' : 
        `Erro ${response.status}: ${response.statusText}`
    });
  } catch (error) {
    return NextResponse.json({
      test: 'webhook_self_call',
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      webhookUrl,
      hasSecret: !!webhookSecret
    }, { status: 500 });
  }
}
