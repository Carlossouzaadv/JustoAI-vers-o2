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
  RAILWAY: '🚂',
  PDF: '📄',
  SUCCESS: '✅',
  ERROR: '❌',
  LOG: '📝',
};

// ================================================================
// NO POLYFILLS - Use pdfjs-dist and pdf-parse as-is
// ================================================================

// ================================================================
// LOGGER COM PREFIXES PARA RASTREAMENTO
// ================================================================
function log(prefix: string, message: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${prefix} ${message}`, data ? JSON.stringify(data, null, 2) : '');
}

// ================================================================
// PDF EXTRACTION - Using system pdftotext command (no Node.js issues)
// ================================================================
async function extractTextFromPDF(pdfPath: string): Promise<string> {
  log(`${ICONS.RAILWAY} ${ICONS.PDF}`, 'Iniciando extração de texto do PDF', { path: pdfPath });

  try {
    // Use pdftotext command-line tool (from poppler-utils)
    // This is system-level, no Node.js dependencies, no DOMMatrix issues
    log(`${ICONS.RAILWAY} ${ICONS.PDF}`, 'Usando pdftotext (poppler) para extração');

    try {
      // pdftotext arquivo.pdf - (outputs to stdout)
      const command = `pdftotext "${pdfPath}" -`;
      const text = execSync(command, { encoding: 'utf-8' });

      log(`${ICONS.RAILWAY} ${ICONS.PDF}`, `${ICONS.SUCCESS} Extração bem-sucedida`, {
        textLength: text.length,
      });

      return text;
    } catch (extractError) {
      log(`${ICONS.RAILWAY} ${ICONS.PDF}`, `${ICONS.ERROR} Falha ao extrair PDF`, {
        error: (extractError as any)?.message?.substring(0, 150),
      });
      throw extractError;
    }
  } catch (error) {
    log(`${ICONS.RAILWAY} ${ICONS.PDF}`, `${ICONS.ERROR} Falha na extração de PDF`, {
      error: (error as any)?.message,
    });
    throw error;
  }
}

// ================================================================
// TEXT CLEANING
// ================================================================
function cleanText(text: string): string {
  if (!text) return '';

  log(`${ICONS.RAILWAY} ${ICONS.PDF}`, 'Limpando e normalizando texto', { inputLength: text.length });

  let cleaned = text
    .replace(/\n{3,}/g, '\n\n') // Reduz quebras de linha múltiplas
    .replace(/\s{2,}/g, ' ') // Reduz espaços múltiplos
    .trim();

  log(`${ICONS.RAILWAY} ${ICONS.PDF}`, 'Limpeza concluída', { outputLength: cleaned.length });

  return cleaned;
}

// ================================================================
// EXTRACT PROCESS NUMBER
// ================================================================
function extractProcessNumber(text: string): string | null {
  log(`${ICONS.RAILWAY} ${ICONS.PDF}`, 'Procurando número do processo');

  const patterns = [
    /\b\d{7}[-.]?\d{2}[-.]?\d{4}[-.]?\d[-.]?\d{2}[-.]?\d{4}\b/, // CNJ moderno
    /\b\d{4}\.\d{2}\.\d{6}[-.]?\d\b/, // CNJ antigo
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      log(`${ICONS.RAILWAY} ${ICONS.PDF}`, `${ICONS.SUCCESS} Processo encontrado: ${match[0]}`);
      return match[0];
    }
  }

  log(`${ICONS.RAILWAY} ${ICONS.PDF}`, '⚠️ Nenhum processo encontrado');
  return null;
}

// ================================================================
// ENDPOINT PRINCIPAL
// ================================================================
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let tempFilePath: string | null = null;

  try {
    log(`${ICONS.RAILWAY}`, `${ICONS.PDF} Recebendo requisição de processamento de PDF`);

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
      log(`${ICONS.RAILWAY}`, `${ICONS.ERROR} Arquivo não enviado`);
      return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 });
    }

    log(`${ICONS.RAILWAY} ${ICONS.PDF}`, 'Arquivo recebido', {
      name: file.name,
      size: file.size,
      type: file.type,
    });

    // 2. SALVAR ARQUIVO TEMPORÁRIO
    const tempDir = join(tmpdir(), 'justoai-pdfs');
    try {
      await fs.mkdir(tempDir, { recursive: true });
    } catch (err) {
      log(`${ICONS.RAILWAY}`, `⚠️ Aviso ao criar diretório temp`, { error: (err as any)?.message });
    }

    const tempFileName = `${Date.now()}-${randomBytes(4).toString('hex')}.pdf`;
    tempFilePath = join(tempDir, tempFileName);

    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(tempFilePath, buffer);

    log(`${ICONS.RAILWAY} ${ICONS.PDF}`, 'Arquivo salvo temporariamente', {
      path: tempFilePath,
      size: buffer.length,
    });

    // 3. EXTRAIR TEXTO
    const processingStartTime = Date.now();
    let extractedText = '';

    try {
      extractedText = await extractTextFromPDF(tempFilePath);
    } catch (extractError) {
      log(`${ICONS.RAILWAY}`, `${ICONS.ERROR} Falha na extração`, {
        error: (extractError as any)?.message,
      });
      throw extractError;
    }

    const processingTime = Date.now() - processingStartTime;

    if (!extractedText || extractedText.trim().length < 50) {
      log(`${ICONS.RAILWAY}`, `${ICONS.ERROR} Texto insuficiente extraído`, {
        textLength: extractedText.length,
      });

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

    log(`${ICONS.RAILWAY}`, `${ICONS.SUCCESS} Processamento concluído com sucesso`, {
      totalTime: `${totalTime}ms`,
      processingTime: `${processingTime}ms`,
      textLength: extractedText.length,
      cleanedLength: cleanedText.length,
      processNumber: processNumber || 'não identificado',
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

    log(`${ICONS.RAILWAY}`, `${ICONS.ERROR} Erro fatal no processamento`, {
      error: (error as any)?.message,
      totalTime: `${totalTime}ms`,
      stack: (error as any)?.stack?.substring(0, 200),
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
        log(`${ICONS.RAILWAY} ${ICONS.PDF}`, 'Arquivo temporário removido');
      } catch (cleanupError) {
        log(`${ICONS.RAILWAY}`, `⚠️ Aviso ao remover arquivo temporário`, {
          error: (cleanupError as any)?.message,
        });
      }
    }
  }
}
