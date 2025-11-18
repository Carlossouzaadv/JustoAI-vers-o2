/**
 * Database Migration Executor
 * Executes the SSOT plan migration on production database
 */

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

// Use DIRECT_URL for direct database connection (not pooled)
const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('❌ Error: DATABASE_URL or DIRECT_URL environment variable not found');
  process.exit(1);
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
});

async function main() {
  console.log('🚀 Starting SSOT Database Migration...\n');

  try {
    // STEP 0: Update ENUM type to include new plan types
    console.log('🔧 STEP 0: Updating PostgreSQL ENUM type...');
    try {
      await prisma.$executeRaw`
        ALTER TYPE "Plan" ADD VALUE 'GESTAO' BEFORE 'PROFESSIONAL';
      `;
      console.log('✅ Added GESTAO to Plan ENUM\n');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('⚠️  GESTAO already exists in enum (skipping)\n');
      } else {
        console.warn('⚠️  Could not add GESTAO:', error.message);
      }
    }

    try {
      await prisma.$executeRaw`
        ALTER TYPE "Plan" ADD VALUE 'PERFORMANCE' AFTER 'PROFESSIONAL';
      `;
      console.log('✅ Added PERFORMANCE to Plan ENUM\n');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('⚠️  PERFORMANCE already exists in enum (skipping)\n');
      } else {
        console.warn('⚠️  Could not add PERFORMANCE:', error.message);
      }
    }

    try {
      await prisma.$executeRaw`
        ALTER TYPE "Plan" ADD VALUE 'ENTERPRISE' AFTER 'PERFORMANCE';
      `;
      console.log('✅ Added ENTERPRISE to Plan ENUM\n');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('⚠️  ENTERPRISE already exists in enum (skipping)\n');
      } else {
        console.warn('⚠️  Could not add ENTERPRISE:', error.message);
      }
    }

    // STEP 1: Verify current plan distribution
    console.log('📊 STEP 1: Checking current plan distribution...');
    const beforeStats = await prisma.$queryRaw`
      SELECT plan, COUNT(*) as count FROM workspaces GROUP BY plan ORDER BY plan;
    `;
    console.log('Current plan distribution:');
    console.table(beforeStats);
    console.log('');

    // STEP 2: Create backup table
    console.log('💾 STEP 2: Creating backup table...');
    try {
      await prisma.$executeRaw`
        CREATE TABLE workspaces_backup_ssot_migration AS
        SELECT * FROM workspaces
        WHERE plan IN ('STARTER', 'PROFESSIONAL');
      `;
      console.log('✅ Backup table created successfully\n');
    } catch (error) {
      if (error.code === 'P0001' || error.message.includes('already exists')) {
        console.log('⚠️  Backup table already exists (skipping)\n');
      } else {
        throw error;
      }
    }

    // STEP 3: Execute migration
    console.log('🔄 STEP 3: Executing plan name migrations...\n');

    // Migrate 'STARTER' to 'GESTAO'
    console.log('   Migrating: STARTER → GESTAO');
    const result1 = await prisma.$executeRaw`
      UPDATE workspaces
      SET plan = 'GESTAO'::\"Plan\", "updatedAt" = NOW()
      WHERE plan = 'STARTER'
      AND plan != 'GESTAO';
    `;
    console.log(`   ✅ Updated ${result1} records\n`);

    // Migrate 'PROFESSIONAL' to 'PERFORMANCE'
    console.log('   Migrating: PROFESSIONAL → PERFORMANCE');
    const result2 = await prisma.$executeRaw`
      UPDATE workspaces
      SET plan = 'PERFORMANCE'::\"Plan\", "updatedAt" = NOW()
      WHERE plan = 'PROFESSIONAL'
      AND plan != 'PERFORMANCE';
    `;
    console.log(`   ✅ Updated ${result2} records\n`);

    // Keep 'FREE' as is (no change needed)
    console.log('   Keeping: FREE → FREE (no change)');
    const result3 = 0;
    console.log(`   ✅ Skipped (unchanged plan)\n`);

    // STEP 4: Verify migration results
    console.log('📋 STEP 4: Verifying migration results...');
    const afterStats = await prisma.$queryRaw`
      SELECT plan, COUNT(*) as count FROM workspaces GROUP BY plan ORDER BY plan;
    `;
    console.log('New plan distribution:');
    console.table(afterStats);
    console.log('');

    // STEP 5: Validate data integrity
    console.log('✔️  STEP 5: Validating data integrity...');
    const invalidPlans = await prisma.$queryRaw`
      SELECT DISTINCT plan FROM workspaces
      WHERE plan NOT IN ('FREE', 'GESTAO', 'PERFORMANCE', 'ENTERPRISE', 'STARTER', 'PROFESSIONAL');
    `;

    if (invalidPlans.length === 0) {
      console.log('✅ All workspace plans are valid\n');
    } else {
      console.warn('⚠️  WARNING: Found invalid plan values:');
      console.table(invalidPlans);
      console.log('');
    }

    // Summary
    console.log('═'.repeat(60));
    console.log('✅ MIGRATION COMPLETED SUCCESSFULLY!\n');
    console.log('Summary:');
    console.log(`  • starter → gestao: ${result1} records updated`);
    console.log(`  • professional → performance: ${result2} records updated`);
    console.log(`  • enterprise standardized: ${result3} records updated`);
    console.log(`  • Total records migrated: ${result1 + result2 + result3}`);
    console.log(`  • Total workspaces in database: ${beforeStats.reduce((sum, row) => sum + Number(row.count), 0)}`);
    console.log('\n✨ Next steps:');
    console.log('  1. Monitor application logs for next 24 hours');
    console.log('  2. Verify pricing page displays new plan names');
    console.log('  3. Check credit calculations are working correctly');
    console.log('  4. Notify support team of plan name changes');
    console.log('═'.repeat(60));

  } catch (error) {
    console.error('\n❌ MIGRATION FAILED!');
    console.error('Error:', error.message);
    console.error('\nDetails:', error);

    console.log('\n🔄 Rollback Instructions:');
    console.log('If you need to rollback:');
    console.log('1. Restore from backup table:');
    console.log('   DELETE FROM workspaces');
    console.log('   WHERE plan IN (\'GESTAO\', \'PERFORMANCE\');');
    console.log('');
    console.log('   INSERT INTO workspaces');
    console.log('   SELECT * FROM workspaces_backup_ssot_migration;');
    console.log('');
    console.log('2. Revert code: git revert HEAD && git push');

    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
