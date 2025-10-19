require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');

async function verifyOnboarding() {
  const client = new Client({ connectionString: process.env.DIRECT_URL });

  try {
    await client.connect();

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🔍 VERIFICAÇÃO COMPLETA - SISTEMA ONBOARDING 3 FASES');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // 1. Verificar enum
    console.log('📋 FASE 1: ProcessOnboardingStatus Enum\n');
    const enumResult = await client.query(`
      SELECT enumlabel FROM pg_enum
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ProcessOnboardingStatus')
      ORDER BY enumsortorder
    `);

    const expectedEnum = ['created', 'previewed', 'enriching', 'enriched', 'analysis_pending', 'analyzed'];
    const foundEnum = enumResult.rows.map(r => r.enumlabel);
    let enumOk = true;

    expectedEnum.forEach(val => {
      const found = foundEnum.includes(val);
      console.log(`  ${found ? '✅' : '❌'} ${val}`);
      if (!found) enumOk = false;
    });

    // 2. Verificar colunas cases
    console.log('\n📋 Colunas em Cases Table\n');
    const casesResult = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'cases'
      AND column_name IN (
        'preview_snapshot', 'detected_cnj', 'first_page_text',
        'onboarding_status', 'enrichment_started_at', 'enrichment_completed_at',
        'preview_generated_at'
      )
      ORDER BY column_name
    `);

    const expectedCases = [
      'preview_snapshot', 'detected_cnj', 'first_page_text',
      'onboarding_status', 'enrichment_started_at', 'enrichment_completed_at',
      'preview_generated_at'
    ];

    const foundCases = casesResult.rows.map(r => r.column_name);
    let casesOk = true;

    expectedCases.forEach(col => {
      const found = foundCases.includes(col);
      console.log(`  ${found ? '✅' : '❌'} ${col}`);
      if (!found) casesOk = false;
    });

    // 3. Verificar colunas case_documents
    console.log('\n📋 Colunas em Case Documents Table\n');
    const docsResult = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'case_documents'
      AND column_name IN ('judit_attachment_url', 'source_origin')
    `);

    const expectedDocs = ['judit_attachment_url', 'source_origin'];
    const foundDocs = docsResult.rows.map(r => r.column_name);
    let docsOk = true;

    expectedDocs.forEach(col => {
      const found = foundDocs.includes(col);
      console.log(`  ${found ? '✅' : '❌'} ${col}`);
      if (!found) docsOk = false;
    });

    // 4. Verificar índices
    console.log('\n📋 Performance Indexes\n');
    const indexResult = await client.query(`
      SELECT indexname FROM pg_indexes
      WHERE tablename IN ('cases', 'case_documents')
      AND (indexname LIKE '%onboarding%' OR indexname LIKE '%detected_cnj%' OR indexname LIKE '%source_origin%')
    `);

    console.log(`  Total indexes: ${indexResult.rows.length}`);
    const requiredIndexes = ['idx_cases_onboarding_status', 'idx_cases_detected_cnj', 'idx_case_documents_source_origin'];
    const foundIndexes = indexResult.rows.map(r => r.indexname);

    requiredIndexes.forEach(idx => {
      const found = foundIndexes.includes(idx);
      console.log(`  ${found ? '✅' : '❌'} ${idx}`);
    });

    // 5. Verificar arquivos de código
    console.log('\n📋 FASE 1: Code Files\n');
    const fase1Files = [
      'src/lib/services/previewAnalysisService.ts',
      'src/app/api/process/upload/route.ts'
    ];

    fase1Files.forEach(file => {
      const exists = fs.existsSync(`${process.cwd()}/${file}`);
      console.log(`  ${exists ? '✅' : '❌'} ${file}`);
    });

    // 6. Verificar FASE 2 files
    console.log('\n📋 FASE 2: Code Files\n');
    const fase2Files = [
      'src/lib/services/juditAttachmentProcessor.ts',
      'src/lib/services/timelineUnifier.ts'
    ];

    fase2Files.forEach(file => {
      const exists = fs.existsSync(`${process.cwd()}/${file}`);
      console.log(`  ${exists ? '✅' : '❌'} ${file}`);
    });

    // 7. Verificar FASE 3 file
    console.log('\n📋 FASE 3: Code File\n');
    const fase3File = 'src/app/api/process/[id]/analysis/full/route.ts';
    const fase3Exists = fs.existsSync(`${process.cwd()}/${fase3File}`);
    console.log(`  ${fase3Exists ? '✅' : '❌'} ${fase3File}`);

    // 8. Verificar migrations
    console.log('\n📋 Database Migrations\n');
    const migrations = [
      'prisma/migrations/20251020_onboarding_preview_system/migration.sql',
      'prisma/migrations/20251020_judit_attachments/migration.sql'
    ];

    migrations.forEach(file => {
      const exists = fs.existsSync(`${process.cwd()}/${file}`);
      console.log(`  ${exists ? '✅' : '❌'} ${file}`);
    });

    // 9. Verificar Prisma schema
    console.log('\n📋 Prisma Schema Updates\n');
    const schemaPath = `${process.cwd()}/prisma/schema.prisma`;
    const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

    const schemaChecks = [
      { name: 'ProcessOnboardingStatus enum', pattern: 'enum ProcessOnboardingStatus' },
      { name: 'previewSnapshot field', pattern: 'previewSnapshot' },
      { name: 'detectedCnj field', pattern: 'detectedCnj' },
      { name: 'onboardingStatus field', pattern: 'onboardingStatus.*ProcessOnboardingStatus' },
      { name: 'juditAttachmentUrl field', pattern: 'juditAttachmentUrl' },
      { name: 'sourceOrigin field', pattern: 'sourceOrigin' }
    ];

    schemaChecks.forEach(check => {
      const found = new RegExp(check.pattern, 'i').test(schemaContent);
      console.log(`  ${found ? '✅' : '❌'} ${check.name}`);
    });

    await client.end();

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('✅ Verificação concluída!');
    console.log('═══════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

verifyOnboarding();
