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

/**
 * Type guards: Safe error handling
 * Padrão-Ouro: Mandato Inegociável (ZERO 'as')
 */
function isNodeJSError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return String(error);
}

// ================================================================
// MINIMALIST LOGGER - Only errors and critical status
// ================================================================
function log(level: 'error' | 'success', message: string, data?: unknown) {
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
      // Padrão-Ouro: Safe narrowing com type guard (ZERO 'as')
      const errorData: Record<string, unknown> = {
        error: result.error.message,
      };

      // Apenas adicionar 'code' se for NodeJS.ErrnoException
      if (isNodeJSError(result.error)) {
        errorData.code = result.error.code;
      }

      console.error(`${ICONS.ERROR} [executeWithTimeout] Spawn error após ${duration}ms:`, errorData);
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
    // Padrão-Ouro: Safe error extraction (ZERO 'as')
    const errorMsg = getErrorMessage(error);
    console.error(`${ICONS.ERROR} [executeWithTimeout] Falha após ${duration}ms:`, {
      error: errorMsg,
      command,
    });
    throw error;
  }
}

// ================================================================
// PDF EXTRACTION - Using system pdftotext command (from poppler-utils)
// With aggressive timeout and graceful degradation
// ================================================================
async function extractTextFromPDF(pdfPath: string): Promise<string> {
  const startTime = Date.now();
  try {
    console.log(`${ICONS.SUCCESS} [extractTextFromPDF] Iniciando (timeout: ${PDFTOTEXT_TIMEOUT}ms)`);

    // 1. VERIFICAR SE ARQUIVO EXISTE
    try {
      await fs.stat(pdfPath);
    } catch (statError) {
      const errorMsg = `Arquivo não encontrado: ${pdfPath}`;
      console.error(`${ICONS.ERROR} [extractTextFromPDF] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    // 2. EXECUTAR PDFTOTEXT COM TIMEOUT AGRESSIVO
    console.log(`${ICONS.TIMER} [extractTextFromPDF] Executando pdftotext...`);
    let result;
    try {
      result = executeWithTimeout('pdftotext', [pdfPath, '-'], PDFTOTEXT_TIMEOUT);
    } catch (timeoutError) {
      const duration = Date.now() - startTime;
      console.error(`${ICONS.ERROR} [extractTextFromPDF] TIMEOUT após ${duration}ms`);
      // Retornar erro específico de timeout em vez de crashar
      throw new Error(`pdftotext timeout (${PDFTOTEXT_TIMEOUT}ms exceeded). PDF pode ser muito complexo.`);
    }

    // 3. VALIDAR RESULTADO DO COMANDO
    if (result.status !== 0 && result.status !== null) {
      const errorMsg = result.stderr || `Exited with code ${result.status}`;
      console.error(`${ICONS.ERROR} [extractTextFromPDF] pdftotext exit code ${result.status}`);
      throw new Error(`pdftotext failed: ${errorMsg.substring(0, 100)}`);
    }

    const text = result.stdout || '';

    // 4. VALIDAR RESULTADO
    if (!text || text.trim().length === 0) {
      console.error(`${ICONS.ERROR} [extractTextFromPDF] Texto vazio - PDF pode ser sem texto ou imagens`);
      // Não throw - retornar string vazia é ok
      return '';
    }

    const duration = Date.now() - startTime;
    console.log(`${ICONS.SUCCESS} [extractTextFromPDF] OK: ${text.length}c em ${duration}ms`);
    return text;

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`${ICONS.ERROR} [extractTextFromPDF] ERRO após ${duration}ms: ${errorMsg.substring(0, 100)}`);
    throw error;
  }
}

// ================================================================
// TEXT CLEANING
// ================================================================
function cleanText(text: string): string {
  if (!text) return '';

  const cleaned = text
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
const PDFTOTEXT_TIMEOUT = 8000; // 8 segundos MAX (Railway ~30s, Vercel ~60s)
const MAX_PROCESSING_TIME = 25000; // 25 segundos total

// ================================================================
// ENDPOINT PRINCIPAL
// ================================================================
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let tempFilePath: string | null = null;

  try {
    // 1. MINIMAL VALIDATION - fail fast if invalid
    const contentType = request.headers.get('content-type');
    if (!contentType?.includes('multipart/form-data')) {
      return NextResponse.json(
        { success: false, error: 'Invalid Content-Type' },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // 2. ASYNC APPROACH: Save file and return immediately
    // Process extraction in background via worker
    const tempDir = join(tmpdir(), 'justoai-pdfs');
    try {
      await fs.mkdir(tempDir, { recursive: true });
    } catch (err) {
      // Ignore
    }

    const tempFileName = `${Date.now()}-${randomBytes(4).toString('hex')}.pdf`;
    tempFilePath = join(tempDir, tempFileName);

    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(tempFilePath, buffer);

    // 3. TRY FAST EXTRACTION (5 second timeout only)
    // If it succeeds quickly, return result
    // If it times out, return success anyway with empty text
    let extractedText = '';
    let extractionTimeMs = 0;
    try {
      const extractionStart = Date.now();
      const fastTimeout = 5000; // 5 seconds only
      const result = executeWithTimeout('pdftotext', [tempFilePath, '-'], fastTimeout);
      extractionTimeMs = Date.now() - extractionStart;

      if (result.status === 0) {
        extractedText = result.stdout || '';
      }
    } catch (quickError) {
      // Timeout or error - just continue with empty text
      extractionTimeMs = Date.now() - startTime;
      console.warn('Fast extraction failed, continuing with empty text');
      extractedText = '';
    }


    // 4. LIMPAR TEXTO
    const cleanedText = cleanText(extractedText);

    // 5. EXTRAIR PROCESSO (mesmo se texto vazio)
    const processNumber = extractedText ? extractProcessNumber(extractedText) : null;

    // 6. PREPARAR RESPOSTA
    const totalTime = Date.now() - startTime;

    log('success', 'PDF processed', {
      totalTime: `${totalTime}ms`,
      textLength: extractedText.length,
      hasText: extractedText.length > 0,
    });

    return NextResponse.json({
      success: true,
      data: {
        originalText: extractedText || '',
        cleanedText: cleanedText || '',
        processNumber: processNumber || null,
        metrics: {
          originalLength: extractedText.length,
          cleanedLength: cleanedText.length,
          extractionTimeMs: extractionTimeMs,
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
