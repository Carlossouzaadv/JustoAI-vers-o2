#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function applyMigration() {
  try {
    console.log('🚀 Aplicando migração JUDIT...');

    // Executar comandos separadamente
    const commands = [
      // 1. Criar tabela de Processos
      `CREATE TABLE IF NOT EXISTS processos (
        id VARCHAR PRIMARY KEY,
        numero_cnj VARCHAR NOT NULL UNIQUE,
        dados_completos JSONB NULL,
        data_onboarding TIMESTAMP DEFAULT NOW(),
        ultima_atualizacao TIMESTAMP DEFAULT NOW()
      )`,

      // 2. Criar índice para processos
      `CREATE INDEX IF NOT EXISTS idx_numero_cnj ON processos(numero_cnj)`,

      // 3. Criar tabela de Requisições JUDIT
      `CREATE TABLE IF NOT EXISTS judit_requests (
        id VARCHAR PRIMARY KEY,
        request_id VARCHAR NOT NULL UNIQUE,
        status VARCHAR NOT NULL,
        finalidade VARCHAR NOT NULL,
        processo_id VARCHAR NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`,

      // 4. Criar índices para judit_requests
      `CREATE INDEX IF NOT EXISTS idx_request_id ON judit_requests(request_id)`,
      `CREATE INDEX IF NOT EXISTS idx_processo_status ON judit_requests(processo_id, status)`,

      // 5. Criar tabela de Monitoramento JUDIT
      `CREATE TABLE IF NOT EXISTS judit_monitoring (
        id VARCHAR PRIMARY KEY,
        tracking_id VARCHAR NOT NULL UNIQUE,
        tipo VARCHAR NOT NULL DEFAULT 'UNIVERSAL',
        ativo BOOLEAN NOT NULL DEFAULT true,
        processo_id VARCHAR NOT NULL UNIQUE REFERENCES processos(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`,

      // 6. Criar índices para judit_monitoring
      `CREATE INDEX IF NOT EXISTS idx_tracking_id ON judit_monitoring(tracking_id)`,
      `CREATE INDEX IF NOT EXISTS idx_ativo ON judit_monitoring(ativo)`,

      // 7. Criar função de trigger
      `CREATE OR REPLACE FUNCTION update_updated_at_column()
       RETURNS TRIGGER AS $$
       BEGIN
           NEW.updated_at = NOW();
           RETURN NEW;
       END;
       $$ language 'plpgsql'`,
    ];

    for (let i = 0; i < commands.length; i++) {
      try {
        await prisma.$executeRawUnsafe(commands[i]);
        console.log(`✓ Comando ${i + 1}/${commands.length} executado`);
      } catch (err) {
        if (err.message.includes('already exists')) {
          console.log(`✓ Comando ${i + 1}/${commands.length} (já existe)`);
        } else {
          throw err;
        }
      }
    }

    // 8. Criar triggers
    try {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS update_judit_requests_updated_at ON judit_requests`);
    } catch (e) {
      // Pode falhar se a tabela não existir ainda
    }

    try {
      await prisma.$executeRawUnsafe(`
        CREATE TRIGGER update_judit_requests_updated_at
        BEFORE UPDATE ON judit_requests
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
      `);
    } catch (err) {
      if (!err.message.includes('already exists')) throw err;
    }

    try {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS update_judit_monitoring_updated_at ON judit_monitoring`);
    } catch (e) {
      // Pode falhar se a tabela não existir ainda
    }

    try {
      await prisma.$executeRawUnsafe(`
        CREATE TRIGGER update_judit_monitoring_updated_at
        BEFORE UPDATE ON judit_monitoring
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
      `);
    } catch (err) {
      if (!err.message.includes('already exists')) throw err;
    }

    console.log('\n✅ Tabelas JUDIT criadas com sucesso!');
    console.log('✓ processos');
    console.log('✓ judit_requests');
    console.log('✓ judit_monitoring');

  } catch (error) {
    console.error('❌ Erro ao aplicar migração:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration();
