// ================================================================
// PDF EXTRACTOR - Pure Node.js (NOT bundled by webpack)
// ================================================================
// Este arquivo é copiado como-is para .next/standalone
// Não é processado pelo webpack, então require() funciona em runtime
// Usado pela rota API /api/pdf/process no Railway

/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const ICONS = {
  RAILWAY: '🚂',
  PDF: '📄',
  SUCCESS: '✅',
  ERROR: '❌',
  LOG: '📝',
  OCR: '🔍',
};

function log(prefix, message, data) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${prefix} ${message}`, data ? JSON.stringify(data, null, 2) : '');
}

// ================================================================
// PDF EXTRACTION WITH CASCADE (including OCR fallback)
// ================================================================
async function extractTextFromPDF(pdfPath, forceOCR = false) {
  log(`${ICONS.RAILWAY} ${ICONS.PDF}`, 'Iniciando extração de texto do PDF', {
    path: pdfPath,
    forceOCR: forceOCR
  });

  try {
    // Se forceOCR=true, pular direto para OCR
    if (forceOCR) {
      log(`${ICONS.RAILWAY} ${ICONS.OCR}`, 'Flag forceOCR ativada, tentando OCR direto');
      try {
        return await extractTextWithOCR(pdfPath);
      } catch (ocrError) {
        log(`${ICONS.RAILWAY} ${ICONS.OCR}`, `${ICONS.ERROR} OCR forçado falhou`, {
          error: ocrError?.message?.substring(0, 100),
        });
        throw ocrError;
      }
    }

    // Estratégia 1: Try pdf-parse first
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
        error: pdfParseError?.message?.substring(0, 100),
      });

      // Estratégia 2: Fallback to pdfjs-dist
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
              .map((item) => (item.str || '') + (item.space ? ' ' : ''))
              .join('')
              .trim();
            fullText += pageText + '\n';
          } catch (pageError) {
            log(`${ICONS.RAILWAY} ${ICONS.PDF}`, `⚠️ Erro ao extrair página ${pageNum}`, {
              error: pageError?.message?.substring(0, 50),
            });
          }
        }

        log(`${ICONS.RAILWAY} ${ICONS.PDF}`, `${ICONS.SUCCESS} Extração bem-sucedida com pdfjs-dist`, {
          pages: pdf.numPages,
          textLength: fullText.length,
        });

        return fullText.trim();
      } catch (pdfjsError) {
        // Estratégia 3: OCR como fallback final
        log(`${ICONS.RAILWAY} ${ICONS.PDF}`, `⚠️ pdfjs-dist falhou, tentando OCR`, {
          error: pdfjsError?.message?.substring(0, 100),
        });

        try {
          log(`${ICONS.RAILWAY} ${ICONS.OCR}`, 'Tentando método 3: OCR com Tesseract.js');
          return await extractTextWithOCR(pdfPath);
        } catch (ocrError) {
          log(`${ICONS.RAILWAY} ${ICONS.OCR}`, `${ICONS.ERROR} OCR também falhou`, {
            error: ocrError?.message?.substring(0, 100),
          });
          throw ocrError;
        }
      }
    }
  } catch (error) {
    log(`${ICONS.RAILWAY} ${ICONS.PDF}`, `${ICONS.ERROR} Falha em todas as estratégias de extração`, {
      error: error?.message,
    });
    throw error;
  }
}

// ================================================================
// TEXT CLEANING
// ================================================================
function cleanText(text) {
  if (!text) return '';

  log(`${ICONS.RAILWAY} ${ICONS.PDF}`, 'Limpando e normalizando texto', { inputLength: text.length });

  let cleaned = text
    .replace(/\n{3,}/g, '\n\n') // Reduce multiple line breaks
    .replace(/\s{2,}/g, ' ') // Reduce multiple spaces
    .trim();

  log(`${ICONS.RAILWAY} ${ICONS.PDF}`, 'Limpeza concluída', { outputLength: cleaned.length });

  return cleaned;
}

// ================================================================
// OCR WITH TESSERACT.JS (para PDFs scanned/image-only)
// ================================================================
async function extractTextWithOCR(pdfPath) {
  const startTime = Date.now();

  try {
    log(`${ICONS.RAILWAY} ${ICONS.OCR}`, 'Iniciando OCR com Tesseract.js', { path: pdfPath });

    // Lazy-load Tesseract e pdfjs apenas quando OCR é solicitado
    const Tesseract = require('tesseract.js');
    const pdfjs = require('pdfjs-dist');
    pdfjs.GlobalWorkerOptions = pdfjs.GlobalWorkerOptions || {};
    pdfjs.GlobalWorkerOptions.workerSrc = null;

    // Ler PDF
    const fileBuffer = await fs.readFile(pdfPath);
    const uint8Array = new Uint8Array(fileBuffer);
    const pdf = await pdfjs.getDocument({ data: uint8Array }).promise;

    let fullText = '';
    const pageCount = Math.min(pdf.numPages, 50); // Limitar a 50 páginas para OCR (muito pesado)

    log(`${ICONS.RAILWAY} ${ICONS.OCR}`, `Processando ${pageCount} páginas com OCR`, { totalPages: pdf.numPages });

    // Processar cada página com OCR
    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2 }); // 2x zoom para melhor OCR

        // Renderizar página como canvas
        const canvasFactory = {
          create: (width, height) => {
            const Canvas = require('canvas');
            return Canvas.createCanvas(width, height);
          }
        };

        const renderContext = {
          canvasContext: null,
          viewport: viewport,
          canvasFactory: canvasFactory,
        };

        // Renderizar página
        const canvas = canvasFactory.create(viewport.width, viewport.height);
        renderContext.canvasContext = canvas.getContext('2d');

        await page.render(renderContext).promise;

        // Converter canvas para imagem e fazer OCR
        const imageData = canvas.toDataURL('image/png');

        // Usar Tesseract.js para OCR
        const { data: { text } } = await Tesseract.recognize(imageData, 'por');

        fullText += text + '\n';

        const elapsed = Date.now() - startTime;
        if (pageNum % 5 === 0) {
          log(`${ICONS.RAILWAY} ${ICONS.OCR}`, `Progresso OCR: ${pageNum}/${pageCount}`, { elapsed: `${elapsed}ms` });
        }
      } catch (pageError) {
        log(`${ICONS.RAILWAY} ${ICONS.OCR}`, `⚠️ Erro ao processar página ${pageNum}`, {
          error: pageError?.message?.substring(0, 100),
        });
        // Continuar com próxima página
      }
    }

    const duration = Date.now() - startTime;

    log(`${ICONS.RAILWAY} ${ICONS.OCR}`, `${ICONS.SUCCESS} OCR concluído`, {
      pagesProcessed: pageCount,
      textLength: fullText.length,
      duration: `${duration}ms`,
    });

    return fullText.trim();
  } catch (error) {
    const duration = Date.now() - startTime;
    log(`${ICONS.RAILWAY} ${ICONS.OCR}`, `${ICONS.ERROR} Falha no OCR`, {
      error: error?.message?.substring(0, 150),
      duration: `${duration}ms`,
    });
    throw error;
  }
}

// ================================================================
// EXTRACT PROCESS NUMBER
// ================================================================
function extractProcessNumber(text) {
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
// MAIN HANDLER (exported for use in route.ts)
// ================================================================
async function handlePdfProcessing(req) {
  const startTime = Date.now();
  let tempFilePath = null;

  try {
    log(`${ICONS.RAILWAY}`, `${ICONS.PDF} Recebendo requisição de processamento de PDF`);

    // Parse multipart form data
    const contentType = req.headers.get('content-type');
    if (!contentType?.includes('multipart/form-data')) {
      return {
        error: 'Content-Type deve ser multipart/form-data',
        status: 400,
      };
    }

    const formData = await req.formData();
    const file = formData.get('file');

    if (!file) {
      log(`${ICONS.RAILWAY}`, `${ICONS.ERROR} Arquivo não enviado`);
      return {
        error: 'Arquivo não enviado',
        status: 400,
      };
    }

    log(`${ICONS.RAILWAY} ${ICONS.PDF}`, 'Arquivo recebido', {
      name: file.name,
      size: file.size,
      type: file.type,
    });

    // Save temporary file
    const tempDir = path.join(os.tmpdir(), 'justoai-pdfs');
    try {
      await fs.mkdir(tempDir, { recursive: true });
    } catch (err) {
      log(`${ICONS.RAILWAY}`, `⚠️ Aviso ao criar diretório temp`, { error: err?.message });
    }

    const tempFileName = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.pdf`;
    tempFilePath = path.join(tempDir, tempFileName);

    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(tempFilePath, buffer);

    log(`${ICONS.RAILWAY} ${ICONS.PDF}`, 'Arquivo salvo temporariamente', {
      path: tempFilePath,
      size: buffer.length,
    });

    // Verificar se forceOCR foi solicitado
    const forceOCR = formData.get('forceOCR') === 'true';
    if (forceOCR) {
      log(`${ICONS.RAILWAY} ${ICONS.OCR}`, 'Flag forceOCR detectada na requisição');
    }

    // Extract text
    const processingStartTime = Date.now();
    let extractedText = '';

    try {
      extractedText = await extractTextFromPDF(tempFilePath, forceOCR);
    } catch (extractError) {
      log(`${ICONS.RAILWAY}`, `${ICONS.ERROR} Falha na extração`, {
        error: extractError?.message,
      });
      throw extractError;
    }

    const processingTime = Date.now() - processingStartTime;

    if (!extractedText || extractedText.trim().length < 50) {
      log(`${ICONS.RAILWAY}`, `${ICONS.ERROR} Texto insuficiente extraído`, {
        textLength: extractedText.length,
      });

      return {
        error: 'PDF não contém texto suficiente',
        status: 400,
      };
    }

    // Clean text and extract process number
    const cleanedText = cleanText(extractedText);
    const processNumber = extractProcessNumber(extractedText);

    const totalTime = Date.now() - startTime;

    log(`${ICONS.RAILWAY}`, `${ICONS.SUCCESS} Processamento concluído com sucesso`, {
      totalTime: `${totalTime}ms`,
      processingTime: `${processingTime}ms`,
      textLength: extractedText.length,
      cleanedLength: cleanedText.length,
      processNumber: processNumber || 'não identificado',
    });

    return {
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
      status: 200,
    };
  } catch (error) {
    const totalTime = Date.now() - startTime;

    log(`${ICONS.RAILWAY}`, `${ICONS.ERROR} Erro fatal no processamento`, {
      error: error?.message,
      totalTime: `${totalTime}ms`,
      stack: error?.stack?.substring(0, 200),
    });

    return {
      error: 'Erro ao processar PDF',
      details: error?.message,
      status: 500,
    };
  } finally {
    // Cleanup temp file
    if (tempFilePath) {
      try {
        await fs.unlink(tempFilePath);
        log(`${ICONS.RAILWAY} ${ICONS.PDF}`, 'Arquivo temporário removido');
      } catch (cleanupError) {
        log(`${ICONS.RAILWAY}`, `⚠️ Aviso ao remover arquivo temporário`, {
          error: cleanupError?.message,
        });
      }
    }
  }
}

module.exports = { handlePdfProcessing };
