#!/usr/bin/env node

/**
 * JUDIT Bulk Test - Teste com múltiplos CNJs
 *
 * Testa várias requisições de uma vez para validar
 * desempenho e confiabilidade da API
 *
 * Uso: node test-judit-bulk.js
 */

require('dotenv').config({ path: '.env.local' });
const axios = require('axios');

const API_KEY = process.env.JUDIT_API_KEY;
const API_BASE_URL = 'https://requests.prod.judit.io';
const TIMEOUT = 30000;

if (!API_KEY) {
  console.error('❌ Erro: JUDIT_API_KEY não está configurada');
  process.exit(1);
}

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: TIMEOUT,
  headers: {
    'api-key': API_KEY,
    'Content-Type': 'application/json',
  },
});

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const log = (message) => {
  const timestamp = new Date().toLocaleTimeString('pt-BR');
  console.log(`[${timestamp}] ${message}`);
};

// Lista de CNJs para teste
const TEST_CNJS = [
  '5059111-78.2025.4.02.5101',  // CNJ original
  '0000001-00.2025.1.00.0001',  // Formato variado
  '1234567-89.2024.8.26.0100',  // TJ/SP
];

const makeRequest = async (method, path, data = null) => {
  try {
    let response;
    if (method === 'GET') {
      response = await client.get(path);
    } else if (method === 'POST') {
      response = await client.post(path, data);
    }
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: error.response?.data?.message || error.message };
  }
};

const testBulkRequests = async () => {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║     JUDIT Bulk Test - Múltiplos CNJs                 ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  const results = [];

  // Fase 1: Enviar requisições em paralelo
  log(`📤 Enviando ${TEST_CNJS.length} requisições em paralelo...`);

  const startTime = Date.now();

  const requests = TEST_CNJS.map((cnj) =>
    makeRequest('POST', '/requests', {
      search: {
        search_type: 'lawsuit_cnj',
        search_key: cnj,
      },
      with_attachments: true,
    }).then((result) => ({
      cnj,
      requestId: result.data?.request_id,
      initialStatus: result.data?.status,
      success: result.success,
      error: result.error,
    }))
  );

  const initialResults = await Promise.all(requests);

  log(`\n✅ Requisições enviadas (${((Date.now() - startTime) / 1000).toFixed(2)}s)`);

  // Fase 2: Polling para cada uma
  log(`\n⏳ Fazendo polling de status para ${initialResults.length} requisições...\n`);

  for (const req of initialResults) {
    if (!req.success) {
      log(`❌ ${req.cnj}: ${req.error}`);
      continue;
    }

    log(`📌 ${req.cnj}: request_id=${req.requestId}, status=${req.initialStatus}`);

    // Polling por até 2 minutos
    let finalStatus = req.initialStatus;
    let attempts = 0;

    while (finalStatus === 'pending' || finalStatus === 'processing') {
      await sleep(5000);
      attempts++;

      const statusResult = await makeRequest('GET', `/requests/${req.requestId}`);

      if (statusResult.success) {
        finalStatus = statusResult.data.status;
        log(`  └─ Tentativa ${attempts}: ${finalStatus}`);

        if (attempts >= 24) break; // 2 minutos
      } else {
        log(`  └─ Erro: ${statusResult.error}`);
        break;
      }
    }

    // Fase 3: Se completado, buscar resultados
    if (finalStatus === 'completed') {
      const resultsResp = await makeRequest('GET', `/responses?request_id=${req.requestId}&page_size=100`);

      if (resultsResp.success) {
        const totalPages = resultsResp.data?.all_pages_count;
        const dataCount = (resultsResp.data?.data || []).length;

        log(`  ✅ Resultados: ${dataCount} itens (${totalPages} página${totalPages > 1 ? 's' : ''})`);

        results.push({
          cnj: req.cnj,
          requestId: req.requestId,
          status: 'completed',
          resultCount: dataCount,
          totalPages: totalPages,
          duration: attempts * 5,
        });
      } else {
        log(`  ❌ Erro ao buscar resultados: ${resultsResp.error}`);

        results.push({
          cnj: req.cnj,
          requestId: req.requestId,
          status: 'error_fetching',
        });
      }
    } else {
      results.push({
        cnj: req.cnj,
        requestId: req.requestId,
        status: finalStatus,
        duration: attempts * 5,
      });
    }
  }

  // Resumo final
  const totalTime = (Date.now() - startTime) / 1000;

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║                  📊 RESUMO FINAL                     ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  console.log('Resultados por CNJ:');
  results.forEach((result) => {
    const statusEmoji = result.status === 'completed' ? '✅' : '⚠️';
    console.log(`\n${statusEmoji} ${result.cnj}`);
    console.log(`   Request ID: ${result.requestId}`);
    console.log(`   Status: ${result.status}`);

    if (result.resultCount !== undefined) {
      console.log(`   Resultados: ${result.resultCount} itens`);
      console.log(`   Páginas: ${result.totalPages}`);
    }

    if (result.duration) {
      console.log(`   Tempo de polling: ${result.duration}s`);
    }
  });

  console.log(`\n⏱️  Tempo total: ${totalTime.toFixed(2)}s`);
  console.log(`📊 Taxa de sucesso: ${((results.filter(r => r.status === 'completed').length / results.length) * 100).toFixed(0)}%\n`);
};

testBulkRequests().catch((error) => {
  console.error('❌ Erro:', error.message);
  process.exit(1);
});
