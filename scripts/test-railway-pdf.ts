#!/usr/bin/env npx tsx
/**
 * Script para testar a conectividade do Railway e extração de PDF
 * Uso: npm run test:railway-pdf
 *
 * Testes:
 * 1. Verifica se Railway está online (/api/health)
 * 2. Verifica se pdftotext está instalado
 * 3. Testa extração de PDF com um arquivo de teste
 */

import { readFileSync, writeFileSync } from 'fs';
import { execSync, spawnSync } from 'child_process';
import path from 'path';

const ICONS = {
  SUCCESS: '✅',
  ERROR: '❌',
  INFO: 'ℹ️',
  ARROW: '➜',
  CHECK: '✓',
  CROSS: '✗',
};

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  message: string;
  details?: Record<string, any>;
}

const results: TestResult[] = [];

// ================================================================
// HELPERS
// ================================================================

function log(icon: string, message: string, details?: Record<string, any>) {
  if (details) {
    console.log(`${icon} ${message}`, JSON.stringify(details, null, 2));
  } else {
    console.log(`${icon} ${message}`);
  }
}

async function runTest(name: string, testFn: () => Promise<boolean>, details?: Record<string, any>): Promise<void> {
  const startTime = Date.now();
  try {
    const passed = await testFn();
    const duration = Date.now() - startTime;

    results.push({
      name,
      passed,
      duration,
      message: passed ? 'Passou' : 'Falhou',
      details,
    });

    log(passed ? ICONS.SUCCESS : ICONS.ERROR, `[${name}] ${passed ? 'Passou' : 'Falhou'} (${duration}ms)`);
  } catch (error) {
    const duration = Date.now() - startTime;
    results.push({
      name,
      passed: false,
      duration,
      message: error instanceof Error ? error.message : String(error),
    });

    log(ICONS.ERROR, `[${name}] Erro: ${(error as any)?.message}`);
  }
}

// ================================================================
// TEST 1: Verificar variáveis de ambiente
// ================================================================

async function testEnvironment(): Promise<boolean> {
  log(ICONS.INFO, 'Verificando variáveis de ambiente...');

  const railwayUrl = process.env.PDF_PROCESSOR_URL || 'http://localhost:3000';
  const isProduction = process.env.NODE_ENV === 'production';

  log(ICONS.INFO, `PDF_PROCESSOR_URL: ${railwayUrl}`);
  log(ICONS.INFO, `NODE_ENV: ${process.env.NODE_ENV}`);
  log(ICONS.INFO, `Production: ${isProduction ? 'Sim' : 'Não'}`);

  return true;
}

// ================================================================
// TEST 2: Verificar se pdftotext está instalado
// ================================================================

async function testPdftextInstalled(): Promise<boolean> {
  try {
    const result = execSync('which pdftotext', { encoding: 'utf-8' });
    log(ICONS.SUCCESS, `pdftotext encontrado em: ${result.trim()}`);
    return true;
  } catch (error) {
    log(ICONS.ERROR, 'pdftotext não encontrado. Execute: apt-get install poppler-utils');
    return false;
  }
}

// ================================================================
// TEST 3: Verificar se Railway está online
// ================================================================

async function testRailwayHealth(): Promise<boolean> {
  const railwayUrl = process.env.PDF_PROCESSOR_URL || 'http://localhost:3000';
  const healthUrl = `${railwayUrl}/api/health`;

  try {
    log(ICONS.INFO, `Testando conectividade: ${healthUrl}`);

    const response = await fetch(healthUrl, {
      method: 'GET',
    });

    if (response.ok) {
      const data = await response.json();
      log(ICONS.SUCCESS, `Railway está online`, data);
      return true;
    } else {
      log(ICONS.ERROR, `Railway respondeu com status ${response.status}`, {
        status: response.status,
        statusText: response.statusText,
      });
      return false;
    }
  } catch (error) {
    log(ICONS.ERROR, `Erro ao conectar em Railway: ${(error as any)?.message}`, {
      url: healthUrl,
    });
    return false;
  }
}

// ================================================================
// TEST 4: Testar extração local de PDF
// ================================================================

async function testLocalPdfExtraction(): Promise<boolean> {
  try {
    // Criar PDF de teste simples (usando texto ASCII)
    // Este é um PDF mínimo válido
    const simplePdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Length 44 >>
stream
BT
/F1 12 Tf
100 700 Td
(Teste de PDF) Tj
ET
endstream
endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000257 00000 n
0000000333 00000 n
trailer
<< /Size 6 /Root 1 0 R >>
startxref
427
%%EOF`;

    // Salvar PDF de teste
    const testPdfPath = '/tmp/test-pdf-extraction.pdf';
    writeFileSync(testPdfPath, simplePdf, 'utf-8');
    log(ICONS.SUCCESS, `PDF de teste criado: ${testPdfPath}`);

    // Tentar extrair texto com pdftotext
    const command = `pdftotext "${testPdfPath}" -`;
    log(ICONS.INFO, `Executando: ${command}`);

    const output = execSync(command, {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
      timeout: 10000,
    });

    if (output && output.trim().length > 0) {
      log(ICONS.SUCCESS, `Extração local bem-sucedida: ${output.length} caracteres`);
      return true;
    } else {
      log(ICONS.ERROR, 'pdftotext retornou texto vazio');
      return false;
    }
  } catch (error) {
    log(ICONS.ERROR, `Erro na extração local de PDF: ${(error as any)?.message}`);
    return false;
  }
}

// ================================================================
// TEST 5: Testar chamada HTTP ao Railway para PDF
// ================================================================

async function testRailwayPdfProcessing(): Promise<boolean> {
  const railwayUrl = process.env.PDF_PROCESSOR_URL || 'http://localhost:3000';
  const pdfProcessUrl = `${railwayUrl}/api/pdf/process`;

  try {
    log(ICONS.INFO, `Testando PDF processing em Railway: ${pdfProcessUrl}`);

    // Criar PDF de teste simples
    const simplePdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Length 44 >>
stream
BT
/F1 12 Tf
100 700 Td
(Test PDF) Tj
ET
endstream
endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000257 00000 n
0000000333 00000 n
trailer
<< /Size 6 /Root 1 0 R >>
startxref
427
%%EOF`;

    const formData = new FormData();
    const blob = new Blob([simplePdf], { type: 'application/pdf' });
    formData.append('file', blob, 'test.pdf');

    const response = await fetch(pdfProcessUrl, {
      method: 'POST',
      body: formData,
    });

    log(ICONS.INFO, `Resposta do Railway:`, {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers),
    });

    if (response.ok) {
      const data = await response.json();
      log(ICONS.SUCCESS, `PDF processado com sucesso no Railway`, {
        textLength: data.data?.cleanedText?.length,
        extractionTimeMs: data.data?.metrics?.extractionTimeMs,
      });
      return true;
    } else {
      const errorText = await response.text();
      log(ICONS.ERROR, `Railway retornou erro ${response.status}`, {
        body: errorText.substring(0, 500),
      });
      return false;
    }
  } catch (error) {
    log(ICONS.ERROR, `Erro ao testar PDF processing no Railway: ${(error as any)?.message}`);
    return false;
  }
}

// ================================================================
// MAIN
// ================================================================

async function main() {
  console.log('\n🚀 INICIANDO TESTES DE RAILWAY PDF EXTRACTION\n');

  // Test 1: Environment
  await runTest('Environment Variables', testEnvironment);

  // Test 2: pdftotext installed
  await runTest('pdftotext Installed', testPdftextInstalled);

  // Test 3: Railway Health
  await runTest('Railway Health Check', testRailwayHealth);

  // Test 4: Local PDF Extraction
  await runTest('Local PDF Extraction', testLocalPdfExtraction);

  // Test 5: Railway PDF Processing
  await runTest('Railway PDF Processing', testRailwayPdfProcessing);

  // ================================================================
  // SUMMARY
  // ================================================================

  console.log('\n📊 RESUMO DOS TESTES:\n');

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;

  results.forEach((result) => {
    const icon = result.passed ? ICONS.CHECK : ICONS.CROSS;
    console.log(`  ${icon} ${result.name}: ${result.message} (${result.duration}ms)`);
  });

  console.log(`\n  ${ICONS.ARROW} Total: ${passed}/${total} testes passaram\n`);

  if (passed === total) {
    log(ICONS.SUCCESS, 'TODOS OS TESTES PASSARAM! ✨');
    process.exit(0);
  } else {
    log(ICONS.ERROR, `${total - passed} testes falharam. Verifique a configuração.`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(`${ICONS.ERROR} Erro fatal:`, error);
  process.exit(1);
});
