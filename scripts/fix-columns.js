#!/usr/bin/env node
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

async function fixColumns() {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    console.log('🔧 Fixing missing database columns...\n');

    const sql = fs.readFileSync('./prisma/migrations/fix_missing_columns.sql', 'utf-8');
    const statements = sql
      .split(';')
      .filter(s => s.trim() && !s.trim().startsWith('--'));

    for (const stmt of statements) {
      const preview = stmt.trim().substring(0, 60).replace(/\n/g, ' ');
      console.log(`⏳ Executing: ${preview}...`);
      try {
        await prisma.$executeRawUnsafe(stmt);
        console.log(`✅ Done\n`);
      } catch (err) {
        if (err.message.includes('already exists')) {
          console.log(`⚠️  Already exists, skipping\n`);
        } else {
          throw err;
        }
      }
    }

    console.log('✅ All columns fixed successfully!');
    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixColumns();
