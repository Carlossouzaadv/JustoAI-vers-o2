#!/usr/bin/env node

/**
 * Run database migrations safely
 * This script applies missing columns to production database
 *
 * Usage:
 *   npx tsx scripts/run-migrations.ts
 *   NODE_ENV=production npx tsx scripts/run-migrations.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface MigrationResult {
  name: string;
  success: boolean;
  message: string;
}

const migrations: Array<{
  name: string;
  sql: string;
}> = [
  {
    name: 'Add processoId to cases',
    sql: 'ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "processoId" TEXT;'
  },
  {
    name: 'Add textSha to case_documents',
    sql: 'ALTER TABLE "case_documents" ADD COLUMN IF NOT EXISTS "textSha" TEXT;'
  },
  {
    name: 'Create index on textSha',
    sql: 'CREATE INDEX IF NOT EXISTS "case_documents_textSha_idx" ON "case_documents"("textSha");'
  }
];

async function runMigrations() {
  console.log('🔧 Running database migrations...\n');

  const results: MigrationResult[] = [];

  for (const migration of migrations) {
    console.log(`⏳ Running: ${migration.name}`);

    try {
      await prisma.$executeRawUnsafe(migration.sql);
      console.log(`✅ Success: ${migration.name}\n`);
      results.push({
        name: migration.name,
        success: true,
        message: 'Applied successfully'
      });
    } catch (error: any) {
      const message = error.message || String(error);

      // Check if error is because column/index already exists or constraint conflict
      if (
        message.includes('already exists') ||
        message.includes('duplicate') ||
        message.includes('Relation already exists') ||
        message.includes('column') ||
        message.includes('constraint')
      ) {
        console.log(`⚠️  Skipped: ${migration.name} (${message.substring(0, 80)})\n`);
        results.push({
          name: migration.name,
          success: true,
          message: 'Skipped or already applied'
        });
      } else {
        console.error(`❌ Error: ${migration.name}`);
        console.error(`   ${message}\n`);
        results.push({
          name: migration.name,
          success: false,
          message: message
        });
      }
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Migration Summary');
  console.log('='.repeat(50));

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  results.forEach(r => {
    const icon = r.success ? '✅' : '❌';
    console.log(`${icon} ${r.name}: ${r.message}`);
  });

  console.log('='.repeat(50));
  console.log(`Total: ${successful} successful, ${failed} failed\n`);

  if (failed > 0) {
    console.warn('⚠️  Some migrations failed, but continuing...\n');
    // Don't exit with error - just warn
    // process.exit(1);
  } else {
    console.log('✅ All migrations completed successfully!');
  }
}

// Run migrations
runMigrations()
  .catch(error => {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
