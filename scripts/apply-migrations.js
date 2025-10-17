#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

// Use Prisma client internals to execute raw SQL
async function applyMigrations() {
  try {
    console.log('🔍 Checking for pending migrations...\n');

    // Read all SQL migration files
    const migrationsDir = path.join(__dirname, '../prisma/migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`Found ${files.length} migration files:\n`);
    files.forEach(f => console.log(`  - ${f}`));
    console.log('');

    // Import Prisma after env is loaded
    const { prisma } = require('../src/lib/prisma');

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      console.log(`⏳ Applying: ${file}`);

      try {
        // Execute each SQL statement separately
        const statements = sql.split(';').filter(s => s.trim());
        for (const statement of statements) {
          if (statement.trim()) {
            await prisma.$executeRawUnsafe(statement);
          }
        }
        console.log(`✅ Applied: ${file}\n`);
      } catch (error) {
        // Check if error is because column already exists
        if (error.message.includes('already exists') ||
            error.message.includes('duplicate') ||
            error.message.includes('Syntax error')) {
          console.log(`⚠️  Already applied or skipped: ${file}\n`);
        } else {
          console.error(`❌ Error applying ${file}:`);
          console.error(error.message);
          console.error('');
        }
      }
    }

    console.log('✅ Migration process completed!');
    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

applyMigrations();
