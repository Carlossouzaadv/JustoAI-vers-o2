#!/usr/bin/env node

/**
 * JUDIT API Advanced Test Suite
 *
 * Testa múltiplos CNJs, limites de paginação, erros e edge cases
 *
 * Uso: node test-judit-advanced.js
 *      node test-judit-advanced.js --cnj "5059111-78.2025.4.02.5101"
 *      node test-judit-advanced.js --stress 5
 */

require('dotenv').config({ path: '.env.local' });
const axios = require('axios');

// Configuração
const API_KEY = process.env.JUDIT_API_KEY;
const API_BASE_URL = 'https://requests.prod.judit.io';
const TIMEOUT = 30000;
const POLLING_INTERVAL = 5000; // 5 segundos para testes rápidos
const MAX_POLLING_ATTEMPTS = 60; // 5 minutos

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

const log = (message, prefix = '') => {
  const timestamp = new Date().toLocaleTimeString('pt-BR');
  const prefixStr = prefix ? `[${prefix}] ` : '';
  console.log(`[${timestamp}] ${prefixStr}${message}`);
};

const makeRequest = async (method, path, data = null) => {
  try {
    let response;
    if (method === 'GET') {
      response = await client.get(path);
    } else if (method === 'POST') {
      response = await client.post(path, data);
    }
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    let errorMsg = 'Erro desconhecido';

    if (error.response) {
      errorMsg = `HTTP ${error.response.status}: ${error.response.data?.message || error.response.statusText}`;
    } else if (error.code === 'ECONNABORTED') {
      errorMsg = `Timeout (${TIMEOUT}ms)`;
    } else if (error.code === 'ECONNREFUSED') {
      errorMsg = 'Conexão recusada';
    } else if (error.message) {
      errorMsg = error.message;
    }

    return { success: false, error: errorMsg, status: error.response?.status };
  }
};

// Test 1: Validação de input
const testInputValidation = async () => {
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║ Test 1: Input Validation                   ║');
  console.log('╚════════════════════════════════════════════╝\n');

  const testCases = [
    { cnj: '', description: 'CNJ vazio' },
    { cnj: 'INVALID_CNJ', description: 'Formato inválido' },
    { cnj: '0000000-00.0000.0.00.0000', description: 'Todos zeros' },
  ];

  for (const testCase of testCases) {
    log(`Testando: ${testCase.description} (${testCase.cnj || 'empty'})`);

    if (!testCase.cnj) {
      log('  ⚠️  Skipping empty CNJ');
      continue;
    }

    const result = await makeRequest('POST', '/requests', {
      search: {
        search_type: 'lawsuit_cnj',
        search_key: testCase.cnj,
      },
      with_attachments: true,
    });

    if (result.success) {
      log(`  ✅ POST /requests: ${result.data.request_id}`);
    } else {
      log(`  ❌ POST /requests falhou: ${result.error}`);
    }
  }
};

// Test 2: Teste de Status Codes
const testStatusCodes = async () => {
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║ Test 2: Status Codes                       ║');
  console.log('╚════════════════════════════════════════════╝\n');

  // Teste com API Key inválida
  log('Testando com API Key inválida...');
  const invalidClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: TIMEOUT,
    headers: {
      'api-key': 'invalid-key-12345',
      'Content-Type': 'application/json',
    },
  });

  try {
    await invalidClient.post('/requests', {
      search: {
        search_type: 'lawsuit_cnj',
        search_key: '5059111-78.2025.4.02.5101',
      },
      with_attachments: true,
    });
    log('❌ Erro: Deveria ter falhado com chave inválida');
  } catch (error) {
    const status = error.response?.status;
    if (status === 401 || status === 403) {
      log(`✅ API corretamente rejeitou chave inválida (HTTP ${status})`);
    } else {
      log(`⚠️  Status inesperado: HTTP ${status}`);
    }
  }

  // Teste com path inválido
  log('\nTestando com endpoint inválido...');
  const result = await makeRequest('GET', '/invalid-endpoint');
  if (!result.success) {
    log(`✅ API corretamente rejeitou endpoint inválido: ${result.error}`);
  } else {
    log('❌ Erro: Deveria ter falhado com endpoint inválido');
  }
};

// Test 3: Teste de Paginação
const testPagination = async (cnj) => {
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║ Test 3: Pagination                        ║');
  console.log('╚════════════════════════════════════════════╝\n');

  log(`Buscando: ${cnj}`);

  // Iniciar busca
  const postResult = await makeRequest('POST', '/requests', {
    search: {
      search_type: 'lawsuit_cnj',
      search_key: cnj,
    },
    with_attachments: true,
  });

  if (!postResult.success) {
    log(`❌ Falha ao iniciar busca: ${postResult.error}`);
    return;
  }

  const requestId = postResult.data.request_id;
  log(`✅ Request iniciado: ${requestId}`);

  // Polling
  log('Fazendo polling de status...');
  let finalStatus = 'pending';
  for (let i = 1; i <= MAX_POLLING_ATTEMPTS; i++) {
    if (i > 1) await sleep(POLLING_INTERVAL);

    const statusResult = await makeRequest('GET', `/requests/${requestId}`);
    if (!statusResult.success) {
      log(`  ⚠️  Tentativa ${i}: Erro - ${statusResult.error}`);
      continue;
    }

    finalStatus = statusResult.data.status;
    log(`  Tentativa ${i}: ${finalStatus}`);

    if (finalStatus === 'completed' || finalStatus === 'failed') break;
  }

  if (finalStatus !== 'completed') {
    log(`❌ Busca não concluída: ${finalStatus}`);
    return;
  }

  log('\n✅ Busca concluída! Testando paginação...');

  // Testar diferentes tamanhos de página
  const pageSizes = [10, 50, 100];

  for (const pageSize of pageSizes) {
    log(`\nTestando page_size=${pageSize}`);

    const pageResult = await makeRequest('GET', `/responses?request_id=${requestId}&page_size=${pageSize}`);

    if (!pageResult.success) {
      log(`  ❌ Erro: ${pageResult.error}`);
      continue;
    }

    const totalPages = pageResult.data?.all_pages_count;
    const currentPage = pageResult.data?.page;
    const dataCount = (pageResult.data?.data || []).length;

    log(`  ✅ Página ${currentPage}/${totalPages}: ${dataCount} itens (esperado: ${Math.min(pageSize, dataCount)})`);

    if (dataCount === 0 && totalPages > 0) {
      log(`  ℹ️  Busca completada mas sem resultados (comum em CNJs sem processos indexados)`);
    }
  }
};

// Test 4: Stress Test
const stressTest = async (numRequests, cnj) => {
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║ Test 4: Stress Test (Requisições Paralelas)║');
  console.log('╚════════════════════════════════════════════╝\n');

  log(`Enviando ${numRequests} requisições em paralelo...`);

  const requests = Array(numRequests)
    .fill(null)
    .map((_, i) =>
      makeRequest('POST', '/requests', {
        search: {
          search_type: 'lawsuit_cnj',
          search_key: cnj,
        },
        with_attachments: true,
      }).then(result => ({
        index: i + 1,
        result,
      }))
    );

  const results = await Promise.all(requests);

  const successful = results.filter(r => r.result.success).length;
  const failed = results.filter(r => !r.result.success).length;

  log(`\n✅ Resultados do Stress Test:`);
  log(`  • Requisições bem-sucedidas: ${successful}/${numRequests}`);
  log(`  • Falhas: ${failed}/${numRequests}`);

  if (failed > 0) {
    log(`  • Taxa de sucesso: ${((successful / numRequests) * 100).toFixed(2)}%`);
  }
};

// Main
const main = async () => {
  const args = process.argv.slice(2);
  const stressCount = args.includes('--stress') ? parseInt(args[args.indexOf('--stress') + 1] || '5') : 0;
  const customCnj = args.includes('--cnj') ? args[args.indexOf('--cnj') + 1] : '5059111-78.2025.4.02.5101';

  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║   JUDIT API Advanced Test Suite            ║');
  console.log('╚════════════════════════════════════════════╝');

  try {
    await testInputValidation();
    await testStatusCodes();
    await testPagination(customCnj);

    if (stressCount > 0) {
      await stressTest(stressCount, customCnj);
    }

    console.log('\n╔════════════════════════════════════════════╗');
    console.log('║   ✅ Todos os testes concluídos!          ║');
    console.log('╚════════════════════════════════════════════╝\n');

  } catch (error) {
    log(`❌ Erro não tratado: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
};

main();
