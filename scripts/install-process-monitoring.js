#!/usr/bin/env node
// ================================
// SCRIPT DE INSTALAÇÃO DO SISTEMA DE MONITORAMENTO
// ================================
// Instala dependências adicionais para o sistema de monitoramento de processos

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 Instalando dependências para monitoramento de processos...\n');

// Dependências necessárias
const dependencies = [
  'xlsx',           // Para processar arquivos Excel
  'multer',         // Para upload de arquivos
  '@types/multer',  // Types para multer
  'cron',           // Para agendamento de tarefas
  '@types/cron'     // Types para cron
];

// Dependências de desenvolvimento
const devDependencies = [];

try {
  console.log('📦 Instalando dependências principais...');
  execSync(`npm install ${dependencies.join(' ')}`, { stdio: 'inherit' });

  if (devDependencies.length > 0) {
    console.log('📦 Instalando dependências de desenvolvimento...');
    execSync(`npm install -D ${devDependencies.join(' ')}`, { stdio: 'inherit' });
  }

  console.log('✅ Dependências instaladas com sucesso!\n');

  // Verificar se as tabelas Prisma precisam ser sincronizadas
  console.log('🗄️ Verificando banco de dados...');

  try {
    execSync('npm run db:push', { stdio: 'inherit' });
    console.log('✅ Schema do banco atualizado!\n');
  } catch (error) {
    console.log('⚠️ Erro ao atualizar banco. Execute manualmente: npm run db:push\n');
  }

  // Criar diretório para uploads se não existir
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('📁 Diretório de uploads criado: ./uploads/\n');
  }

  console.log('🎉 Sistema de monitoramento de processos instalado com sucesso!\n');
  console.log('📋 Próximos passos:');
  console.log('   1. Configure as variáveis de ambiente para APIs (JUDIT_API_KEY, CODILO_USERNAME, etc.)');
  console.log('   2. Execute: npm run dev');
  console.log('   3. Teste o upload via: http://localhost:3000/api/processes/upload?action=template');
  console.log('   4. Documente no CLAUDE_DAILY_BRIEFING.md\n');

} catch (error) {
  console.error('❌ Erro durante a instalação:');
  console.error(error.message);
  process.exit(1);
}