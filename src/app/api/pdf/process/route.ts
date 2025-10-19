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

const ICONS = {
  RAILWAY: '🚂',
  PDF: '📄',
  SUCCESS: '✅',
  ERROR: '❌',
  LOG: '📝',
};

// ================================================================
// POLYFILLS FOR NODE.JS ENVIRONMENT
// ================================================================
if (typeof (global as any).DOMMatrix === 'undefined') {
  (global as any).DOMMatrix = class DOMMatrix {
    constructor(
      public a: number = 1,
      public b: number = 0,
      public c: number = 0,
      public d: number = 1,
      public e: number = 0,
      public f: number = 0
    ) {}

    multiply(other: any): any {
      return new (global as any).DOMMatrix(
        this.a * other.a + this.c * other.b,
        this.b * other.a + this.d * other.b,
        this.a * other.c + this.c * other.d,
        this.b * other.c + this.d * other.d,
        this.a * other.e + this.c * other.f + this.e,
        this.b * other.e + this.d * other.f + this.f
      );
    }

    translate(x: number = 0, y: number = 0): any {
      return this.multiply(new (global as any).DOMMatrix(1, 0, 0, 1, x, y));
    }

    scale(x: number = 1, y: number = x): any {
      return this.multiply(new (global as any).DOMMatrix(x, 0, 0, y, 0, 0));
    }

    rotate(angle: number = 0): any {
      const cos = Math.cos((angle * Math.PI) / 180);
      const sin = Math.sin((angle * Math.PI) / 180);
      return this.multiply(new (global as any).DOMMatrix(cos, sin, -sin, cos, 0, 0));
    }

    skewX(angle: number = 0): any {
      return this.multiply(new (global as any).DOMMatrix(1, 0, Math.tan((angle * Math.PI) / 180), 1, 0, 0));
    }

    skewY(angle: number = 0): any {
      return this.multiply(new (global as any).DOMMatrix(1, Math.tan((angle * Math.PI) / 180), 0, 1, 0, 0));
    }

    inverse(): any {
      const det = this.a * this.d - this.b * this.c;
      if (det === 0) throw new Error('Matrix is not invertible');
      return new (global as any).DOMMatrix(
        this.d / det,
        -this.b / det,
        -this.c / det,
        this.a / det,
        (this.c * this.f - this.d * this.e) / det,
        (this.b * this.e - this.a * this.f) / det
      );
    }

    transformPoint(point: any): any {
      return {
        x: this.a * point.x + this.c * point.y + this.e,
        y: this.b * point.x + this.d * point.y + this.f,
      };
    }

    toString(): string {
      return `matrix(${this.a}, ${this.b}, ${this.c}, ${this.d}, ${this.e}, ${this.f})`;
    }

    get isIdentity(): boolean {
      return this.a === 1 && this.b === 0 && this.c === 0 && this.d === 1 && this.e === 0 && this.f === 0;
    }

    get is2D(): boolean {
      return true;
    }

    get isInvertible(): boolean {
      return this.a * this.d - this.b * this.c !== 0;
    }
  };
}

// ================================================================
// LOGGER COM PREFIXES PARA RASTREAMENTO
// ================================================================
function log(prefix: string, message: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${prefix} ${message}`, data ? JSON.stringify(data, null, 2) : '');
}

// ================================================================
// PDF EXTRACTION WITH CASCADE
// ================================================================
async function extractTextFromPDF(pdfPath: string): Promise<string> {
  log(`${ICONS.RAILWAY} ${ICONS.PDF}`, 'Iniciando extração de texto do PDF', { path: pdfPath });

  try {
    // Try pdf-parse first
    log(`${ICONS.RAILWAY} ${ICONS.PDF}`, 'Tentando método 1: pdf-parse');

    try {
      const pdfParse = require('pdf-parse');
      const fileBuffer = await fs.readFile(pdfPath);
      const pdfData = await pdfParse(fileBuffer);

      log(`${ICONS.RAILWAY} ${ICONS.PDF}`, `${ICONS.SUCCESS} Extração bem-sucedida com pdf-parse`, {
        pages: pdfData.numpages,
        textLength: pdfData.text.length,
      });

      return pdfData.text;
    } catch (pdfParseError) {
      log(`${ICONS.RAILWAY} ${ICONS.PDF}`, `⚠️ pdf-parse falhou, tentando pdfjs-dist`, {
        error: (pdfParseError as any)?.message?.substring(0, 100),
      });

      // Fallback to pdfjs-dist
      log(`${ICONS.RAILWAY} ${ICONS.PDF}`, 'Tentando método 2: pdfjs-dist');

      try {
        const pdfjs = require('pdfjs-dist');

        // Disable workers for Node.js environment
        pdfjs.GlobalWorkerOptions = pdfjs.GlobalWorkerOptions || {};
        pdfjs.GlobalWorkerOptions.workerSrc = null;

        const fileBuffer = await fs.readFile(pdfPath);
        const uint8Array = new Uint8Array(fileBuffer);
        const pdf = await pdfjs.getDocument({ data: uint8Array }).promise;

        let fullText = '';
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          try {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
              .map((item: any) => (item.str || '') + (item.space ? ' ' : ''))
              .join('')
              .trim();
            fullText += pageText + '\n';
          } catch (pageError) {
            log(`${ICONS.RAILWAY} ${ICONS.PDF}`, `⚠️ Erro ao extrair página ${pageNum}`, {
              error: (pageError as any)?.message?.substring(0, 50),
            });
          }
        }

        log(`${ICONS.RAILWAY} ${ICONS.PDF}`, `${ICONS.SUCCESS} Extração bem-sucedida com pdfjs-dist`, {
          pages: pdf.numPages,
          textLength: fullText.length,
        });

        return fullText.trim();
      } catch (pdfjsError) {
        log(`${ICONS.RAILWAY} ${ICONS.PDF}`, `${ICONS.ERROR} pdfjs-dist também falhou`, {
          error: (pdfjsError as any)?.message?.substring(0, 100),
        });
        throw pdfjsError;
      }
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
