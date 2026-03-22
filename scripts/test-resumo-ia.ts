// Script para testar resumo IA do Escavador
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import axios from 'axios';

async function testarResumoIA(cnj: string) {
  const apiKey = process.env.ESCAVADOR_API_KEY;
  const baseUrl = 'https://api.escavador.com/api/v2';

  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'X-Requested-With': 'XMLHttpRequest',
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };

  console.log(`\n🤖 Testando Resumo IA para CNJ: ${cnj}\n`);

  // 1. Tentar solicitar novo resumo
  console.log('📝 1. Solicitando novo resumo IA...');
  try {
    const resp1 = await axios.post(
      `${baseUrl}/processos/numero_cnj/${cnj}/resumo-inteligente`,
      {},
      { headers }
    );
    console.log(`   ✅ Solicitação criada: ID ${resp1.data.id}`);
    console.log(`   Status: ${JSON.stringify(resp1.data)}`);
  } catch (e: any) {
    console.log(`   ❌ Erro ao solicitar: ${e.response?.status} - ${JSON.stringify(e.response?.data)}`);
  }

  // 2. Aguardar um pouco
  console.log('\n⏳ Aguardando 5 segundos...');
  await new Promise(r => setTimeout(r, 5000));

  // 3. Buscar resumo
  console.log('\n📖 2. Buscando resumo IA...');
  try {
    const resp2 = await axios.get(
      `${baseUrl}/processos/numero_cnj/${cnj}/resumo-inteligente`,
      { headers }
    );
    console.log(`   ✅ Resumo encontrado!`);
    console.log(`   Status: ${resp2.data.status}`);
    if (resp2.data.resumo) {
      console.log(`\n📄 RESUMO IA:\n${resp2.data.resumo.substring(0, 500)}...`);
    }
  } catch (e: any) {
    console.log(`   ❌ Erro ao buscar: ${e.response?.status} - ${JSON.stringify(e.response?.data)}`);
  }
}

const cnj = process.argv[2] || '0266813-90.2018.8.19.0001';
testarResumoIA(cnj).catch(console.error);
