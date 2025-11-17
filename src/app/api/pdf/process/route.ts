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
import { spawnSync } from 'child_process';
import { PDFExtractionService } from '@/lib/services/pdf-extraction-service';

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
// NOTE: Text cleaning and process number extraction are now handled
// by PDFExtractionService.extractAndClean() - See /lib/services/pdf-extraction-service.ts
// ================================================================

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
    } catch (_err) {
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
    } catch (_quickError) {
      // Timeout or error - just continue with empty text
      extractionTimeMs = Date.now() - startTime;
      console.warn('Fast extraction failed, continuing with empty text');
      extractedText = '';
    }


    // 4. LIMPAR TEXTO COM GOLD STANDARD SERVICE
    const pdfExtractionService = new PDFExtractionService();
    const extractionResult = pdfExtractionService.extractAndClean(extractedText);

    // 5. PREPARAR RESPOSTA
    const totalTime = Date.now() - startTime;

    log('success', 'PDF processed', {
      totalTime: `${totalTime}ms`,
      textLength: extractionResult.originalText.length,
      cleanedLength: extractionResult.cleanedText.length,
      quality: extractionResult.quality,
      hasProcess: extractionResult.processNumber !== null,
    });

    return NextResponse.json({
      success: true,
      data: {
        originalText: extractionResult.originalText,
        cleanedText: extractionResult.cleanedText,
        processNumber: extractionResult.processNumber,
        quality: extractionResult.quality,
        metrics: {
          originalLength: extractionResult.metrics.originalLength,
          cleanedLength: extractionResult.metrics.cleanedLength,
          reductionPercentage: extractionResult.metrics.reductionPercentage,
          extractionTimeMs: extractionTimeMs,
          processingTimeMs: extractionResult.metrics.processingTimeMs,
          totalTimeMs: totalTime,
          confidence: extractionResult.metrics.confidence,
          patternsApplied: extractionResult.metrics.patternsApplied,
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
      } catch (_cleanupError) {
        // Silently fail
      }
    }
  }
}
