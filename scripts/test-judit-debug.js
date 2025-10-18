#!/usr/bin/env node

/**
 * JUDIT API Debug - Verify API Response Structure
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

const cnj = process.argv[2] || '5059111-78.2025.4.02.5101';

(async () => {
  console.log('🔍 Iniciando busca para debug...\n');

  try {
    // POST /requests
    console.log('📤 POST /requests');
    const postResponse = await client.post('/requests', {
      search: {
        search_type: 'lawsuit_cnj',
        search_key: cnj,
      },
      with_attachments: true,
    });

    console.log('📨 Resposta completa da API:\n');
    console.log(JSON.stringify(postResponse.data, null, 2));

    const requestId = postResponse.data?.request_id;
    if (!requestId) {
      console.error('❌ request_id não encontrado!');
      process.exit(1);
    }

    console.log(`\n✅ Request ID: ${requestId}`);
    console.log('\n⏳ Aguardando 5 segundos antes de fazer GET...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // GET /requests/{requestId}
    console.log(`📥 GET /requests/${requestId}`);
    const getResponse = await client.get(`/requests/${requestId}`);

    console.log('📨 Resposta completa da API:\n');
    console.log(JSON.stringify(getResponse.data, null, 2));

  } catch (error) {
    console.error('❌ Erro:', error.response?.data || error.message);
  }
})();
