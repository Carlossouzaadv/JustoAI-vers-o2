// Script para buscar dados completos de um processo no Escavador
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import axios from 'axios';

async function fetchData(cnj: string) {
  const apiKey = process.env.ESCAVADOR_API_KEY;
  const baseUrl = process.env.ESCAVADOR_BASE_URL || 'https://api.escavador.com/api/v2';
  const certificadoId = process.env.ESCAVADOR_CERTIFICADO_ID;

  console.log(`\n🔍 Buscando dados do CNJ: ${cnj}\n`);

  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'X-Requested-With': 'XMLHttpRequest',
    'Accept': 'application/json'
  };

  // 1. Buscar processo
  console.log('📋 1. Buscando processo...');
  try {
    const resp = await axios.get(`${baseUrl}/processos/numero_cnj/${cnj}`, { headers });
    console.log(`   ✅ Processo encontrado`);
    console.log(`   Classe: ${resp.data.classe || 'N/A'}`);
    console.log(`   Tribunal: ${resp.data.tribunal?.nome || 'N/A'}`);
  } catch (e: any) {
    console.log(`   ❌ Erro: ${e.response?.status} - ${e.response?.data?.error || e.message}`);
  }

  // 2. Buscar movimentações
  console.log('\n📜 2. Buscando movimentações...');
  try {
    const resp = await axios.get(`${baseUrl}/processos/numero_cnj/${cnj}/movimentacoes`, { headers });
    const movs = resp.data.data || [];
    console.log(`   ✅ ${movs.length} movimentações encontradas`);
    if (movs.length > 0) {
      console.log(`   Última: ${movs[0].data} - ${movs[0].conteudo?.substring(0, 50)}...`);
    }
  } catch (e: any) {
    console.log(`   ❌ Erro: ${e.response?.status} - ${e.response?.data?.error || e.message}`);
  }

  // 3. Buscar autos
  console.log('\n📁 3. Buscando autos...');
  try {
    const resp = await axios.get(`${baseUrl}/processos/numero_cnj/${cnj}/autos`, { 
      headers,
      params: {
        utilizar_certificado: 1,
        certificado_id: certificadoId,
        tipo_documentos: 'INICIAIS'
      }
    });
    const autos = resp.data.data || [];
    console.log(`   ✅ ${autos.length} autos encontrados`);
  } catch (e: any) {
    console.log(`   ❌ Erro: ${e.response?.status} - ${e.response?.data?.error || e.message}`);
  }

  // 4. Tentar resumo IA
  console.log('\n🤖 4. Verificando resumo IA...');
  try {
    const resp = await axios.get(`${baseUrl}/processos/numero_cnj/${cnj}/resumo-inteligente`, { headers });
    console.log(`   ✅ Resumo disponível: ${resp.data.resumo?.substring(0, 100)}...`);
  } catch (e: any) {
    console.log(`   ❌ Erro: ${e.response?.status} - ${e.response?.data?.error || e.message}`);
  }
}

const cnj = process.argv[2] || '0266813-90.2018.8.19.0001';
fetchData(cnj).catch(console.error);
