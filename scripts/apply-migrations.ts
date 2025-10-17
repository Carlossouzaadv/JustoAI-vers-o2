#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { prisma } from '../src/lib/prisma';

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
      } catch (error: any) {
        // Check if error is because column already exists
        if (error.message?.includes('already exists') ||
            error.message?.includes('duplicate') ||
            error.message?.includes('Syntax error')) {
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
  } catch (error: any) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

applyMigrations();
