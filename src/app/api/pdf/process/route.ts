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
import { execSync } from 'child_process';

const ICONS = {
  SUCCESS: '✅',
  ERROR: '❌',
};

// ================================================================
// NO POLYFILLS - Use pdfjs-dist and pdf-parse as-is
// ================================================================

// ================================================================
// MINIMALIST LOGGER - Only errors and critical status
// ================================================================
function log(level: 'error' | 'success', message: string, data?: any) {
  if (level === 'error') {
    console.error(`${ICONS.ERROR} ${message}`, data ? JSON.stringify(data, null, 2) : '');
  } else if (level === 'success') {
    console.log(`${ICONS.SUCCESS} ${message}`, data ? JSON.stringify(data, null, 2) : '');
  }
}

// ================================================================
// PDF EXTRACTION - Using system pdftotext command (no Node.js issues)
// ================================================================
async function extractTextFromPDF(pdfPath: string): Promise<string> {
  try {
    // Use pdftotext command-line tool (from poppler-utils)
    const command = `pdftotext "${pdfPath}" -`;
    const text = execSync(command, { encoding: 'utf-8' });
    return text;
  } catch (error) {
    log('error', 'PDF extraction failed', { error: (error as any)?.message });
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
// ENDPOINT PRINCIPAL
// ================================================================
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let tempFilePath: string | null = null;

  try {
    // 1. PARSEAR MULTIPART FORM DATA
    const contentType = request.headers.get('content-type');
    if (!contentType?.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Content-Type deve ser multipart/form-data' },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 });
    }

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
      extractedText = await extractTextFromPDF(tempFilePath);
    } catch (extractError) {
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
    log('error', 'PDF processing failed', {
      error: (error as any)?.message,
      totalTime: `${totalTime}ms`,
    });

    return NextResponse.json(
      {
        error: 'Erro ao processar PDF',
        details: (error as any)?.message,
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
