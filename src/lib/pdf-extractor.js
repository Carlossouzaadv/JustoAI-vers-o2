// ================================================================
// PDF EXTRACTOR - Pure Node.js (NOT bundled by webpack)
// ================================================================
// Este arquivo é copiado como-is para .next/standalone
// Não é processado pelo webpack, então require() funciona em runtime
// Usado pela rota API /api/pdf/process no Railway

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
};

function log(prefix, message, data) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${prefix} ${message}`, data ? JSON.stringify(data, null, 2) : '');
}

// ================================================================
// PDF EXTRACTION WITH CASCADE
// ================================================================
async function extractTextFromPDF(pdfPath) {
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
        error: pdfParseError?.message?.substring(0, 100),
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
        log(`${ICONS.RAILWAY} ${ICONS.PDF}`, `${ICONS.ERROR} pdfjs-dist também falhou`, {
          error: pdfjsError?.message?.substring(0, 100),
        });
        throw pdfjsError;
      }
    }
  } catch (error) {
    log(`${ICONS.RAILWAY} ${ICONS.PDF}`, `${ICONS.ERROR} Falha na extração de PDF`, {
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

    // Extract text
    const processingStartTime = Date.now();
    let extractedText = '';

    try {
      extractedText = await extractTextFromPDF(tempFilePath);
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
