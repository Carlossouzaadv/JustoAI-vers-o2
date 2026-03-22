// Script para verificar o status de uma atualização pendente no Escavador
// Execute com: npx ts-node scripts/check-escavador-status.ts 5003068-34.2019.4.02.5101

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import axios from 'axios';

async function checkStatus(cnj: string) {
  const apiKey = process.env.ESCAVADOR_API_KEY;
  const baseUrl = process.env.ESCAVADOR_BASE_URL || 'https://api.escavador.com/api/v2';

  if (!apiKey) {
    console.error('❌ ESCAVADOR_API_KEY não configurada');
    process.exit(1);
  }

  console.log(`\n🔍 Verificando status do CNJ: ${cnj}\n`);

  try {
    // 1. Consultar status da atualização
    const statusResponse = await axios.get(
      `${baseUrl}/processos/numero_cnj/${cnj}/status-atualizacao`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json'
        }
      }
    );

    console.log('📋 Status da Atualização:');
    console.log(JSON.stringify(statusResponse.data, null, 2));

    const ultimaVerificacao = statusResponse.data.ultima_verificacao;
    if (ultimaVerificacao) {
      console.log(`\n📊 Status: ${ultimaVerificacao.status}`);
      console.log(`📅 Criado em: ${ultimaVerificacao.criado_em}`);
      console.log(`✅ Concluído em: ${ultimaVerificacao.concluido_em || 'Ainda processando...'}`);
    } else {
      console.log('\n⚠️ Nenhuma solicitação de atualização encontrada');
    }

  } catch (error: any) {
    if (error.response) {
      console.error(`\n❌ Erro ${error.response.status}:`, error.response.data);
    } else {
      console.error('\n❌ Erro:', error.message);
    }
  }
}

// Pegar CNJ do argumento ou usar padrão
const cnj = process.argv[2] || '5003068-34.2019.4.02.5101';
checkStatus(cnj);
