// ================================================================
// PDF PROCESSING SERVICE - Railway Backend
// ================================================================
// Este endpoint roda no Railway (não no Vercel serverless)
// Toda lógica inlineada para evitar problemas de module resolution
// Recebe PDF via request, processa, retorna texto extraído

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import { execSync, spawnSync } from 'child_process';

const ICONS = {
  SUCCESS: '✅',
  ERROR: '❌',
  TIMER: '⏱️',
};

// ================================================================
// MINIMALIST LOGGER - Only errors and critical status
// ================================================================
function log(level: 'error' | 'success', message: string, data?: any) {
  const timestamp = new Date().toISOString().split('T')[1]; // HH:MM:SS.mmm

  if (level === 'error') {
    console.error(`[${timestamp}] ${ICONS.ERROR} ${message}`, data ? JSON.stringify(data, null, 2) : '');
  } else if (level === 'success') {
    console.log(`[${timestamp}] ${ICONS.SUCCESS} ${message}`, data ? JSON.stringify(data, null, 2) : '');
  }
}

// ================================================================
// TIMEOUT HELPER - Execute command with timeout protection
// ================================================================
function executeWithTimeout(
  command: string,
  args: string[],
  timeoutMs: number = 15000
): { stdout: string; stderr: string; status: number | null } {
  const startTime = Date.now();
  console.log(`${ICONS.TIMER} [executeWithTimeout] Iniciando: ${command} (timeout: ${timeoutMs}ms)`);

  try {
    const result = spawnSync(command, args, {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024, // 10MB
      timeout: timeoutMs,
    });

    const duration = Date.now() - startTime;

    if (result.error) {
      console.error(`${ICONS.ERROR} [executeWithTimeout] Spawn error após ${duration}ms:`, {
        error: result.error.message,
        code: result.error.code,
      });
      throw result.error;
    }

    if (result.signal) {
      console.error(`${ICONS.ERROR} [executeWithTimeout] Process killed após ${duration}ms:`, {
        signal: result.signal,
      });
      throw new Error(`Process killed by signal: ${result.signal}`);
    }

    console.log(`${ICONS.SUCCESS} [executeWithTimeout] Completo em ${duration}ms (status: ${result.status})`);

    return {
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      status: result.status,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`${ICONS.ERROR} [executeWithTimeout] Falha após ${duration}ms:`, {
      error: (error as any)?.message,
      command,
    });
    throw error;
  }
}

// ================================================================
// PDF EXTRACTION - Using system pdftotext command (from poppler-utils)
// ================================================================
async function extractTextFromPDF(pdfPath: string): Promise<string> {
  const startTime = Date.now();
  try {
    console.log(`${ICONS.SUCCESS} [extractTextFromPDF] Iniciando extração com pdftotext: ${pdfPath}`);

    // 1. VERIFICAR SE ARQUIVO EXISTE
    try {
      await fs.stat(pdfPath);
      console.log(`${ICONS.SUCCESS} [extractTextFromPDF] Arquivo encontrado, iniciando extração`);
    } catch (statError) {
      const errorMsg = `Arquivo não encontrado: ${pdfPath}`;
      console.error(`${ICONS.ERROR} [extractTextFromPDF] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    // 2. EXECUTAR PDFTOTEXT COM PROTEÇÕES
    console.log(`${ICONS.SUCCESS} [extractTextFromPDF] Calling executeWithTimeout`);

    const result = executeWithTimeout('pdftotext', [pdfPath, '-'], 15000); // 15s timeout

    // 3. VALIDAR RESULTADO DO COMANDO
    if (result.status !== 0 && result.status !== null) {
      const errorMsg = result.stderr || `Exited with code ${result.status}`;
      console.error(`${ICONS.ERROR} [extractTextFromPDF] pdftotext error:`, {
        status: result.status,
        stderr: errorMsg,
      });
      throw new Error(`pdftotext failed (${result.status}): ${errorMsg}`);
    }

    const text = result.stdout || '';

    // 4. VALIDAR RESULTADO
    if (!text || text.trim().length === 0) {
      const errorMsg = 'pdftotext retornou texto vazio - possível PDF corrupto ou sem texto';
      console.error(`${ICONS.ERROR} [extractTextFromPDF] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    const duration = Date.now() - startTime;
    console.log(`${ICONS.SUCCESS} [extractTextFromPDF] Sucesso! ${text.length} caracteres em ${duration}ms`);

    return text;
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error(`${ICONS.ERROR} [extractTextFromPDF] FALHA após ${duration}ms:`, {
      error: errorMsg,
      stack: errorStack?.split('\n').slice(0, 3).join('\n'),
      pdfPath,
    });

    throw error;
  }
}

// ================================================================
// TEXT CLEANING
// ================================================================
function cleanText(text: string): string {
  if (!text) return '';

  let cleaned = text
    .replace(/\n{3,}/g, '\n\n') // Reduz quebras de linha múltiplas
    .replace(/\s{2,}/g, ' ') // Reduz espaços múltiplos
    .trim();

  return cleaned;
}

// ================================================================
// EXTRACT PROCESS NUMBER
// ================================================================
function extractProcessNumber(text: string): string | null {
  const patterns = [
    /\b\d{7}[-.]?\d{2}[-.]?\d{4}[-.]?\d[-.]?\d{2}[-.]?\d{4}\b/, // CNJ moderno
    /\b\d{4}\.\d{2}\.\d{6}[-.]?\d\b/, // CNJ antigo
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0];
    }
  }

  return null;
}

// ================================================================
// CONSTANTS
// ================================================================
const MAX_PROCESSING_TIME = 25000; // 25 segundos total (Railway timeout é ~30s)

// ================================================================
// ENDPOINT PRINCIPAL
// ================================================================
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let tempFilePath: string | null = null;

  try {
    console.log(`${ICONS.SUCCESS} [POST /api/pdf/process] Iniciado`);

    // 1. VALIDAR CONTENT-TYPE
    const contentType = request.headers.get('content-type');
    console.log(`${ICONS.SUCCESS} [POST /api/pdf/process] Headers:`, {
      contentType,
      method: request.method,
      remoteAddr: request.headers.get('x-forwarded-for') || 'unknown',
    });

    if (!contentType?.includes('multipart/form-data')) {
      console.error(`${ICONS.ERROR} Content-Type inválido: ${contentType}`);
      return NextResponse.json(
        { error: 'Content-Type deve ser multipart/form-data' },
        { status: 400 }
      );
    }

    // 2. PARSEAR FORM DATA
    let formData;
    try {
      formData = await request.formData();
    } catch (parseError) {
      console.error(`${ICONS.ERROR} Erro ao parsear FormData:`, parseError);
      return NextResponse.json(
        { error: 'Erro ao processar multipart/form-data' },
        { status: 400 }
      );
    }

    const file = formData.get('file') as File;

    if (!file) {
      console.error(`${ICONS.ERROR} Arquivo não encontrado no FormData`);
      return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 });
    }

    console.log(`${ICONS.SUCCESS} Arquivo recebido: ${file.name} (${file.size} bytes)`);

    // 2. SALVAR ARQUIVO TEMPORÁRIO
    const tempDir = join(tmpdir(), 'justoai-pdfs');
    try {
      await fs.mkdir(tempDir, { recursive: true });
    } catch (err) {
      // Silently fail if dir exists
    }

    const tempFileName = `${Date.now()}-${randomBytes(4).toString('hex')}.pdf`;
    tempFilePath = join(tempDir, tempFileName);

    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(tempFilePath, buffer);

    // 3. EXTRAIR TEXTO
    const processingStartTime = Date.now();
    let extractedText = '';

    try {
      console.log(`${ICONS.SUCCESS} Iniciando extração de texto do PDF...`);
      extractedText = await extractTextFromPDF(tempFilePath);
      console.log(`${ICONS.SUCCESS} Texto extraído com sucesso: ${extractedText.length} caracteres`);
    } catch (extractError) {
      const errorMsg = extractError instanceof Error ? extractError.message : String(extractError);
      console.error(`${ICONS.ERROR} Erro na extração de texto:`, {
        error: errorMsg,
        stack: extractError instanceof Error ? extractError.stack : undefined,
      });
      throw extractError;
    }

    const processingTime = Date.now() - processingStartTime;

    if (!extractedText || extractedText.trim().length < 50) {
      return NextResponse.json(
        { error: 'PDF não contém texto suficiente' },
        { status: 400 }
      );
    }

    // 4. LIMPAR TEXTO
    const cleanedText = cleanText(extractedText);

    // 5. EXTRAIR PROCESSO
    const processNumber = extractProcessNumber(extractedText);

    // 6. PREPARAR RESPOSTA
    const totalTime = Date.now() - startTime;

    log('success', 'PDF processed', {
      totalTime: `${totalTime}ms`,
      processingTime: `${processingTime}ms`,
      textLength: extractedText.length,
      cleanedLength: cleanedText.length,
      processNumber: processNumber || 'not found',
    });

    return NextResponse.json({
      success: true,
      data: {
        originalText: extractedText,
        cleanedText: cleanedText,
        processNumber: processNumber,
        metrics: {
          originalLength: extractedText.length,
          cleanedLength: cleanedText.length,
          extractionTimeMs: processingTime,
          totalTimeMs: totalTime,
        },
      },
    });
  } catch (error) {
    const totalTime = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    console.error(`${ICONS.ERROR} [POST /api/pdf/process] Erro geral após ${totalTime}ms:`, {
      error: errorMsg,
      stack: stack?.substring(0, 500),
    });

    log('error', 'PDF processing failed', {
      error: errorMsg,
      totalTime: `${totalTime}ms`,
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Erro ao processar PDF',
        details: errorMsg,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  } finally {
    // 7. LIMPAR ARQUIVO TEMPORÁRIO
    if (tempFilePath) {
      try {
        await fs.unlink(tempFilePath);
      } catch (cleanupError) {
        // Silently fail
      }
    }
  }
}
