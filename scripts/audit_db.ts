
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// BigInt serialization helper
const replacer = (key: string, value: any) =>
  typeof value === 'bigint' ? value.toString() : value;

async function runAudit() {
  console.log('--- START AUDIT ---');
  let report = '--- START AUDIT ---\n';

  try {
    // Query 1: All tables
    const tables = await prisma.$queryRawUnsafe(`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    report += '## 2. TABLES_RESULT\n' + JSON.stringify(tables, replacer, 2) + '\n';

    // Query 2: Row counts
    const rowCounts = await prisma.$queryRawUnsafe(`
      SELECT schemaname || '.' || relname as table_name, n_live_tup as row_count
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
      ORDER BY n_live_tup DESC;
    `);
    report += '## 3. ROW_COUNTS_RESULT\n' + JSON.stringify(rowCounts, replacer, 2) + '\n';

    // Query 3: Structure
    const structure = await prisma.$queryRawUnsafe(`
      SELECT table_name, column_name, data_type, is_nullable, column_default, character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position;
    `);
    report += '## 4. STRUCTURE_RESULT\n' + JSON.stringify(structure, replacer, 2) + '\n';

    // Query 4: Enums
    const enums = await prisma.$queryRawUnsafe(`
      SELECT t.typname as enum_name, string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) as enum_values
      FROM pg_type t 
      JOIN pg_enum e ON t.oid = e.enumtypid  
      JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
      GROUP BY t.typname
      ORDER BY t.typname;
    `);
    report += '## 5. ENUMS_RESULT\n' + JSON.stringify(enums, replacer, 2) + '\n';

    // Query 5: Ghost Enums
    const ghostEnums = await prisma.$queryRawUnsafe(`
      SELECT typname, typtype, typowner::regrole::text as owner
      FROM pg_type 
      WHERE typname LIKE '%_old%' OR typname LIKE '%_new%' OR typname LIKE '%backup%';
    `);
    report += '## 6. GHOST_ENUMS_RESULT\n' + JSON.stringify(ghostEnums, replacer, 2) + '\n';

    // Query 6: Foreign Keys
    const fks = await prisma.$queryRawUnsafe(`
      SELECT tc.table_name as from_table, kcu.column_name as from_column, ccu.table_name as to_table, ccu.column_name as to_column, tc.constraint_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
      ORDER BY tc.table_name, kcu.column_name;
    `);
    report += '## 7. FK_RESULT\n' + JSON.stringify(fks, replacer, 2) + '\n';

    // Query 7: Indexes
    const indexes = await prisma.$queryRawUnsafe(`
      SELECT tablename, indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname;
    `);
    report += '## 8. INDEXES_RESULT\n' + JSON.stringify(indexes, replacer, 2) + '\n';

    // Query 8: Triggers
    const triggers = await prisma.$queryRawUnsafe(`
      SELECT trigger_name, event_object_table as table_name, action_statement
      FROM information_schema.triggers
      WHERE trigger_schema = 'public'
      ORDER BY event_object_table, trigger_name;
    `);
    report += '## 9. TRIGGERS_RESULT\n' + JSON.stringify(triggers, replacer, 2) + '\n';

    fs.writeFileSync(path.join(__dirname, '../audit_report_data.txt'), report);
    console.log('Report written to audit_report_data.txt');

  } catch (e) {
    console.error('ERROR RUNNING AUDIT:', e);
  } finally {
    await prisma.$disconnect();
    console.log('--- END AUDIT ---');
  }
}

runAudit();
