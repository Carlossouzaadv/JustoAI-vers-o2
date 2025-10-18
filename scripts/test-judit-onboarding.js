#!/usr/bin/env node

/**
 * JUDIT API Test Script - Onboarding Flow
 *
 * Testa o fluxo completo de onboarding da API JUDIT:
 * 1. Inicia uma busca por CNJ (POST /requests)
 * 2. Poll do status até conclusão (GET /requests/{requestId})
 * 3. Coleta resultados paginados (GET /responses)
 *
 * Uso: node test-judit-onboarding.js "CNJ_NUMBER"
 * Exemplo: node test-judit-onboarding.js "5059111-78.2025.4.02.5101"
 */

require('dotenv').config({ path: '.env.local' });
const axios = require('axios');

// Configuração
const API_KEY = process.env.JUDIT_API_KEY;
const API_BASE_URL = 'https://requests.prod.judit.io';
const TIMEOUT = 30000; // 30 segundos por requisição
const POLLING_INTERVAL = 20000; // 20 segundos entre tentativas
const MAX_POLLING_ATTEMPTS = 15; // 5 minutos no total

// Validação de argumentos
const cnj = process.argv[2];
if (!cnj) {
  console.error('❌ Erro: Forneça um número CNJ como argumento');
  console.error('Uso: node test-judit-onboarding.js "5059111-78.2025.4.02.5101"');
  process.exit(1);
}

// Validação de API_KEY
if (!API_KEY) {
  console.error('❌ Erro: JUDIT_API_KEY não está configurada em .env.local');
  console.error('Adicione a chave ao arquivo .env.local e tente novamente');
  process.exit(1);
}

// Configuração do cliente axios
const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: TIMEOUT,
  headers: {
    'api-key': API_KEY,
    'Content-Type': 'application/json',
  },
});

// Função para delay
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Função para imprimir com timestamp
const log = (message) => {
  const timestamp = new Date().toLocaleTimeString('pt-BR');
  console.log(`[${timestamp}] ${message}`);
};

// Função para fazer requisição com tratamento de erros
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
      // Erro da API (status code != 2xx)
      errorMsg = `Erro HTTP ${error.response.status}: ${error.response.data?.message || error.response.statusText}`;
    } else if (error.code === 'ECONNABORTED') {
      errorMsg = `Timeout (${TIMEOUT}ms) - API não respondeu a tempo`;
    } else if (error.code === 'ECONNREFUSED') {
      errorMsg = 'Conexão recusada - Verifique a URL da API';
    } else if (error.message) {
      errorMsg = error.message;
    }

    return { success: false, error: errorMsg, status: error.response?.status };
  }
};

// Função para iniciar a busca
const startSearch = async (searchCnj) => {
  log(`🔍 Iniciando busca por CNJ: ${searchCnj}`);

  const requestBody = {
    search: {
      search_type: 'lawsuit_cnj',
      search_key: searchCnj,
    },
    with_attachments: true,
  };

  log(`📤 Enviando requisição POST /requests...`);
  const result = await makeRequest('POST', '/requests', requestBody);

  if (!result.success) {
    log(`❌ Falha ao iniciar busca: ${result.error}`);
    return null;
  }

  const requestId = result.data?.request_id;
  const initialStatus = result.data?.status;

  if (!requestId) {
    log(`❌ Resposta inválida: request_id não encontrado`);
    return null;
  }

  log(`✅ Busca iniciada com sucesso!`);
  log(`📌 Request ID: ${requestId}`);
  log(`📊 Status inicial: ${initialStatus}`);

  return requestId;
};

// Função para fazer polling do status
const pollStatus = async (requestId) => {
  log(`\n⏳ Iniciando polling de status (máximo ${MAX_POLLING_ATTEMPTS} tentativas)...`);

  for (let attempt = 1; attempt <= MAX_POLLING_ATTEMPTS; attempt++) {
    // Espera antes de fazer a requisição (exceto na primeira)
    if (attempt > 1) {
      await sleep(POLLING_INTERVAL);
    }

    const result = await makeRequest('GET', `/requests/${requestId}`);

    if (!result.success) {
      log(`⚠️  Tentativa ${attempt}/${MAX_POLLING_ATTEMPTS}: Erro - ${result.error}`);
      continue;
    }

    const status = result.data?.status;
    log(`📊 Tentativa ${attempt}/${MAX_POLLING_ATTEMPTS}: Status = ${status}`);

    if (status === 'completed') {
      log(`✅ Busca concluída com sucesso!`);
      return 'completed';
    }

    if (status === 'failed') {
      log(`❌ Busca falhou no servidor da JUDIT`);
      return 'failed';
    }

    if (status === 'processing' || status === 'pending') {
      // Continuar polling
      continue;
    }

    // Status desconhecido
    log(`⚠️  Status desconhecido: ${status}`);
  }

  log(`❌ Polling expirou após ${MAX_POLLING_ATTEMPTS} tentativas (${(MAX_POLLING_ATTEMPTS * POLLING_INTERVAL) / 1000 / 60} minutos)`);
  return 'timeout';
};

// Função para obter resultados paginados
const getResults = async (requestId) => {
  log(`\n📥 Buscando resultados paginados...`);

  let allResults = [];
  let pageNumber = 1;
  let totalPages = null;

  try {
    while (true) {
      const result = await makeRequest('GET', `/responses?request_id=${requestId}&page_size=100`);

      if (!result.success) {
        log(`❌ Erro ao buscar página ${pageNumber}: ${result.error}`);
        return null;
      }

      const allPagesCount = result.data?.all_pages_count || 1;
      const currentPage = result.data?.page || pageNumber;
      const pageData = result.data?.data || result.data?.page_data || [];

      if (totalPages === null) {
        totalPages = allPagesCount;
        log(`📄 Total de páginas: ${totalPages}`);
      }

      log(`✅ Página ${currentPage}/${totalPages}: ${pageData.length} resultados recebidos`);
      allResults = allResults.concat(pageData);

      // Se for a última página, sair do loop
      if (currentPage >= totalPages) {
        break;
      }

      // Ir para próxima página
      pageNumber++;
      await sleep(1000); // Pequeno delay entre requisições
    }

    log(`\n✅ Total de resultados coletados: ${allResults.length}`);
    return allResults;

  } catch (error) {
    log(`❌ Erro inesperado ao coletar resultados: ${error.message}`);
    return null;
  }
};

// Função principal
const main = async () => {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║     JUDIT API Test - Onboarding Flow                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const startTime = Date.now();

  try {
    // Etapa 1: Iniciar busca
    const requestId = await startSearch(cnj);
    if (!requestId) {
      process.exit(1);
    }

    // Etapa 2: Polling de status
    const finalStatus = await pollStatus(requestId);
    if (finalStatus !== 'completed') {
      log(`\n❌ Teste falhou: Busca não concluída (status final: ${finalStatus})`);
      process.exit(1);
    }

    // Etapa 3: Obter resultados
    const results = await getResults(requestId);
    if (!results) {
      log(`\n❌ Teste falhou: Não foi possível obter os resultados`);
      process.exit(1);
    }

    // Sucesso!
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                  ✅ TESTE BEM-SUCEDIDO                     ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`\n📊 Resumo:
  • CNJ buscado: ${cnj}
  • Request ID: ${requestId}
  • Status final: COMPLETED
  • Total de resultados: ${results.length}
  • Tempo total: ${duration}s
`);

  } catch (error) {
    log(`\n❌ Erro não tratado: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
};

// Executar
main();
