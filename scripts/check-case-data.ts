// Script para verificar o estado do case e processo no banco
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const cnj = process.argv[2] || '0266813-90.2018.8.19.0001';
  
  console.log(`\n🔍 Verificando CNJ: ${cnj}\n`);
  
  // Buscar case pelo CNJ
  const caseData = await prisma.case.findFirst({
    where: { number: cnj },
    include: { processo: true }
  });
  
  if (!caseData) {
    console.log('❌ Case não encontrado no banco');
    await prisma.$disconnect();
    return;
  }
  
  console.log('📋 Case encontrado:');
  console.log(`  ID: ${caseData.id}`);
  console.log(`  Number: ${caseData.number}`);
  console.log(`  Status: ${caseData.status}`);
  console.log(`  ProcessoId: ${caseData.processoId || 'NULL'}`);
  
  if (caseData.processo) {
    console.log('\n📄 Processo vinculado:');
    console.log(`  ID: ${caseData.processo.id}`);
    console.log(`  CNJ: ${caseData.processo.numeroCnj}`);
    
    const dados = caseData.processo.dadosCompletos as any;
    if (dados) {
      console.log(`  Provider: ${dados.provider || 'N/A'}`);
      console.log(`  Movimentações: ${dados.movimentacoes?.length || 0}`);
      console.log(`  Autos: ${dados.autos?.length || 0}`);
      console.log(`  Resumo IA: ${dados.resumoIA ? 'SIM' : 'NÃO'}`);
      console.log(`  Fetched At: ${dados.fetchedAt || 'N/A'}`);
    } else {
      console.log('  ⚠️ dadosCompletos está NULL/vazio');
    }
  } else {
    console.log('\n⚠️ Processo NÃO vinculado ao Case!');
    
    // Verificar se existe processo separado
    const processo = await prisma.processo.findUnique({
      where: { numeroCnj: cnj }
    });
    
    if (processo) {
      console.log('\n📄 Processo existe mas não está vinculado:');
      console.log(`  ID: ${processo.id}`);
      const dados = processo.dadosCompletos as any;
      console.log(`  Tem dados: ${!!dados}`);
    } else {
      console.log('❌ Processo também não existe no banco');
    }
  }
  
  await prisma.$disconnect();
}

check().catch(console.error);
