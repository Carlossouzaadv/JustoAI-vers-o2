// Script para solicitar atualização de um processo no Escavador
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import axios from 'axios';

async function solicitarAtualizacao(cnj: string) {
  const apiKey = process.env.ESCAVADOR_API_KEY;
  const baseUrl = process.env.ESCAVADOR_BASE_URL || 'https://api.escavador.com/api/v2';
  const certificadoId = process.env.ESCAVADOR_CERTIFICADO_ID;

  console.log(`\n🔄 Solicitando atualização do CNJ: ${cnj}\n`);

  try {
    const response = await axios.post(
      `${baseUrl}/processos/numero_cnj/${cnj}/solicitar-atualizacao`,
      {
        autos: 1,
        utilizar_certificado: 1,
        certificado_id: certificadoId,
        enviar_callback: 1
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'X-Requested-With': 'XMLHttpRequest',
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );

    console.log('✅ Atualização solicitada com sucesso!');
    console.log(JSON.stringify(response.data, null, 2));
    
    console.log(`\n📋 ID da solicitação: ${response.data.id}`);
    console.log(`📊 Status: ${response.data.status}`);
    console.log(`\n⏳ Aguarde alguns minutos e verifique com:`);
    console.log(`   npx ts-node scripts/check-escavador-status.ts ${cnj}`);
    
  } catch (error: any) {
    if (error.response) {
      console.error(`\n❌ Erro ${error.response.status}:`);
      console.error(JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('\n❌ Erro:', error.message);
    }
  }
}

const cnj = process.argv[2];
if (!cnj) {
  console.error('❌ Uso: npx ts-node scripts/solicitar-atualizacao.ts <CNJ>');
  process.exit(1);
}

solicitarAtualizacao(cnj);
