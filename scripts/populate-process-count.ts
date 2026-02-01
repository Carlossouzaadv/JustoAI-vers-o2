/**
 * Script de População Pós-Migration
 * 
 * Este script deve ser executado APÓS a migration 'prepare_for_escavador' ser aplicada.
 * Ele popula o campo `processCount` em todas as workspaces com a contagem atual de cases.
 * 
 * Uso:
 *   npx ts-node scripts/populate-process-count.ts
 * 
 * Ou via seed:
 *   Adicione este código ao seu prisma/seed.ts e execute npx prisma db seed
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Iniciando população do campo processCount...\n');

  const workspaces = await prisma.workspace.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
    },
  });

  console.log(`📊 Encontrados ${workspaces.length} workspaces para atualizar.\n`);

  let updated = 0;
  let errors = 0;

  for (const workspace of workspaces) {
    try {
      // Conta os cases do workspace
      const count = await prisma.case.count({
        where: { workspaceId: workspace.id },
      });

      // Atualiza o processCount
      await prisma.workspace.update({
        where: { id: workspace.id },
        data: { processCount: count },
      });

      console.log(`  ✅ [${workspace.slug}] ${workspace.name}: ${count} processos`);
      updated++;
    } catch (error) {
      console.error(`  ❌ [${workspace.slug}] Erro: ${error}`);
      errors++;
    }
  }

  console.log('\n========================================');
  console.log(`✅ Atualizados: ${updated} workspaces`);
  if (errors > 0) {
    console.log(`❌ Erros: ${errors} workspaces`);
  }
  console.log('========================================\n');
}

main()
  .catch((e) => {
    console.error('❌ Erro fatal:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
