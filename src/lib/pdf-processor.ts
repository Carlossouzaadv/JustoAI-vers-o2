// ================================================================
// PDF PROCESSOR - Cliente Vercel que chama Railway
// ================================================================
// Este arquivo roda em VERCEL e faz requisições HTTP para Railway
// O processamento pesado (pdf-parse, pdfjs-dist) acontece no Railway

import { promises as fs } from 'fs';
import { prisma } from './prisma';
import { getErrorMessage, isPDFData, isRailwayPdfResponse, isPDFExtractionData } from './types/type-guards';
import { log, logError } from '@/lib/services/logger';

const ICONS = {
  SUCCESS: '✅',
  ERROR: '❌',
  PDF: '📄',
  RAILWAY: '🚂',
  INFO: 'ℹ️',
  DOWNLOAD: '⬇️',
  PROCESS: '⚙️',
  WARNING: '⚠️',
  EXTRACT: '📝',
  VERCEL: '▲',
  OCR: '🔍',
};

const DEBUG = process.env.DEBUG === 'true';

// ================================================================
// LOGGER MINIMALISTA
// ================================================================
function log(prefix: string, message: string, data?: Record<string, unknown>) {
  const timestamp = new Date().toISOString().split('T')[1]; // HH:MM:SS.mmm

  if (data) {
    console.log(`[${timestamp}] ${prefix} ${message}`, JSON.stringify(data, null, 2));
  } else if (process.env.NODE_ENV === 'development' || DEBUG || message.includes('Error')) {
    log.info({ msg: "[]" });
  }
}

// Obter URL base do serviço PDF (Railway ou localhost)
function getPdfProcessorUrl(): string {
  const url = process.env.PDF_PROCESSOR_URL || 'http://localhost:3000';

  // Log da URL (sem valores sensíveis)
  if (DEBUG) {
    log.info({ msg: "PDF_PROCESSOR_URL configurada como:" });
  }

  return url;
}

// ================================================================
// CLIENTE HTTP PARA RAILWAY
// ================================================================
async function callRailwayPdfProcessor(buffer: Buffer, fileName: string): Promise<unknown> {
  const startTime = Date.now();
  const baseUrl = getPdfProcessorUrl();
  const url = `${baseUrl}/api/pdf/process`;

  try {
    log(`${ICONS.RAILWAY}`, `Iniciando extração via Railway: ${fileName}`, {
      buffer_size: buffer.length,
      url: url,
    });

    // Criar FormData - Convert Buffer to Uint8Array for BlobPart compatibility
    const formData = new FormData();
    const uint8Array = new Uint8Array(buffer);
    const blob = new Blob([uint8Array], { type: 'application/pdf' });
    formData.append('file', blob, fileName);

    // Fazer requisição com melhor tratamento de timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 segundos timeout

    try {
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();

        // Parse JSON error if possible
        let errorDetails = errorText;
        try {
          const jsonError = JSON.parse(errorText);
          errorDetails = jsonError.reason || jsonError.details || JSON.stringify(jsonError);
        } catch {
          // Not JSON, use raw text
        }

        const errorMsg = `HTTP ${response.status}: ${errorDetails.substring(0, 200)}`;
        log.error({ msg: "PDF extraction failed:" });

        // Log detalhado para debugging (mais conciso)
        log(`${ICONS.ERROR}`, `Railway error (${response.status})`, {
          reason: errorDetails.substring(0, 200),
          duration_ms: Date.now() - startTime,
        });

        throw new Error(`Railway HTTP ${response.status}: ${errorDetails}`);
      }

      const result = await response.json();

      log(`${ICONS.SUCCESS}`, `PDF processado com sucesso`, {
        duration_ms: Date.now() - startTime,
        text_length: typeof result.data === 'object' && result.data !== null && 'cleanedText' in result.data
          ? (result.data as Record<string, unknown>).cleanedText?.toString().length || 0
          : 0,
        file_name: fileName,
      });

      return result.data;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
  } catch (_error) {
    const duration = Date.now() - startTime;
    const errorMsg = getErrorMessage(error);

    log.error({ msg: "Railway error (ms):" });

    log(`${ICONS.ERROR}`, `Erro ao chamar Railway`, {
      error: errorMsg,
      file_name: fileName,
      buffer_size: buffer.length,
      url: url,
      duration_ms: duration,
    });

    throw error;
  }
}

// Type declaration for extracted PDF data
// Note: Kept for future PDF parsing needs
// eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
interface PDFData {
  text: string;
  numpages: number;
  info: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export interface ExtractionResult {
  text: string;
  method: 'primary' | 'fallback' | 'ocr';
  success: boolean;
  quality: 'high' | 'medium' | 'low';
  originalLength: number;
  processedLength: number;
  reductionPercentage: number;
}

export interface PDFValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  metadata: {
    pages: number;
    sizeMB: number;
    hasText: boolean;
    hasImages: boolean;
  };
}

export interface PDFAnalysisResult {
  success: boolean;
  texto_original?: string;
  texto_limpo?: string;
  texto_ai_friendly?: string;
  info_basica?: {
    numero_processo?: string;
    cpf_encontrado?: string;
    cnpj_encontrado?: string;
    valores_encontrados?: string[];
    datas_encontradas?: string[];
  };
  extracted_fields: string[];
  custom_fields?: string[];
  processed_at: string;
  file_name: string;
  error?: string;
  file_size_mb?: number;
  tokenReduction?: number;
  processingMethod?: string;
  extraction?: ExtractionResult;
}

export interface ProcessCompleteOptions {
  pdf_path: string;
  extract_fields: string[];
  custom_fields?: string[];
}

export class PDFProcessor {
  private readonly MIN_TEXT_LENGTH = 100;
  private readonly MAX_EXTRACTION_TIME = 60000; // 60 segundos
  private readonly prisma: typeof prisma;

  constructor() {
    // Processamento 100% local - sem dependência de API externa
    this.prisma = prisma;
  }

  /**
   * Extração em cascata com OCR - Estratégia para PDFs complexos/scanned
   * 1. Método primário com Railway (pdf-parse ou pdfjs-dist)
   * 2. OCR via Railway (Tesseract.js) se < 100 chars
   * 3. Fallback vazio se OCR também falhar
   */
  async extractText(buffer: Buffer, fileName: string = 'document.pdf'): Promise<ExtractionResult> {
    try {
      // Estratégia 1: Método primário
      const primaryText = await this.extractWithPrimary(buffer, fileName);

      if (primaryText.length >= this.MIN_TEXT_LENGTH) {
        return {
          text: primaryText,
          method: 'primary',
          success: true,
          quality: 'high',
          originalLength: primaryText.length,
          processedLength: primaryText.length,
          reductionPercentage: 0
        };
      }

      // Estratégia 2: OCR via Railway (para PDFs scanned/image-only)
      log(`${ICONS.OCR}`, `Primary extraction insufficient (${primaryText.length} chars), tentando OCR`);
      const ocrText = await this.extractWithOCR(buffer, fileName);

      if (ocrText.length >= this.MIN_TEXT_LENGTH) {
        return {
          text: ocrText,
          method: 'ocr',
          success: true,
          quality: 'medium',
          originalLength: ocrText.length,
          processedLength: ocrText.length,
          reductionPercentage: 0
        };
      }

      // Estratégia 3: Fallback vazio
      log(`${ICONS.WARNING}`, `Todas as estratégias falharam para ${fileName}`);
      return {
        text: primaryText || ocrText || '',
        method: 'primary',
        success: false,
        quality: 'low',
        originalLength: 0,
        processedLength: 0,
        reductionPercentage: 0
      };

    } catch (_error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      log.error({ msg: "Extraction error:" });
      throw new Error(`Extraction failed: ${errorMsg}`);
    }
  }

  /**
   * Método primário - Chama Railway para extração de PDF
   */
  private async extractWithPrimary(buffer: Buffer, fileName: string = 'document.pdf'): Promise<string> {
    try {
      const data = await callRailwayPdfProcessor(buffer, fileName);

      // Use type guard to safely validate the response
      if (!isPDFExtractionData(data)) {
        throw new Error('Invalid PDF extraction response from Railway');
      }

      const fullText = data.cleanedText || data.text || '';

      if (!fullText || fullText.trim().length === 0) {
        throw new Error('No text extracted from PDF');
      }

      return fullText;
    } catch (_error) {
      const errorMsg = getErrorMessage(error);
      log.error({ msg: "Primary extraction failed:" });
      return '';
    }
  }

  /**
   * Método fallback
   */
  private async extractWithFallback(_buffer: Buffer): Promise<string> {
    try {
      log.info({ msg: "🔄 Tentando extração fallback..." });
      // Implementação básica de fallback
      return '';
    } catch (_error) {
      logError(error, "❌ Erro no método fallback:", { component: "refactored" });
      return '';
    }
  }

  /**
   * Método OCR - Chama Railway com flag OCR para Tesseract.js
   * Ideal para PDFs scanned/image-only que falharam em métodos anteriores
   */
  private async extractWithOCR(buffer: Buffer, fileName: string = 'document.pdf'): Promise<string> {
    try {
      const startTime = Date.now();
      const baseUrl = getPdfProcessorUrl();
      const url = `${baseUrl}/api/pdf/process`;

      log(`${ICONS.OCR}`, `Iniciando extração OCR via Railway: ${fileName}`, {
        buffer_size: buffer.length,
        method: 'tesseract.js',
      });

      // Criar FormData com flag OCR - Convert Buffer to Uint8Array for BlobPart compatibility
      const formData = new FormData();
      const uint8Array = new Uint8Array(buffer);
      const blob = new Blob([uint8Array], { type: 'application/pdf' });
      formData.append('file', blob, fileName);
      formData.append('forceOCR', 'true'); // Flag para forçar OCR na Railway

      // Timeout maior para OCR (mais lento)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 120 segundos para OCR

      try {
        const response = await fetch(url, {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          await response.text(); // Read response to free connection
          log(`${ICONS.ERROR}`, `OCR extraction failed (${response.status})`, {
            duration_ms: Date.now() - startTime,
          });
          return '';
        }

        const result = await response.json();

        // Use type guard to safely extract text from response
        if (typeof result.data === 'object' && result.data !== null && isPDFExtractionData(result.data)) {
          const ocrText = result.data.cleanedText || result.data.text || '';

          log(`${ICONS.SUCCESS}`, `OCR extraction successful`, {
            duration_ms: Date.now() - startTime,
            text_length: ocrText.length,
            file_name: fileName,
          });

          return ocrText;
        }

        // Fallback if data validation fails
        log(`${ICONS.WARNING}`, `OCR response invalid structure`, { file_name: fileName });
        return '';
      } catch (fetchError) {
        clearTimeout(timeoutId);

        const isTimeoutError = fetchError instanceof Error &&
          (fetchError.name === 'AbortError' || fetchError.message.includes('timeout'));

        if (isTimeoutError) {
          log(`${ICONS.WARNING}`, `OCR timeout (120s exceeded)`, { file_name: fileName });
        } else {
          const errorMsg = getErrorMessage(fetchError);
          log(`${ICONS.ERROR}`, `OCR fetch error`, {
            error: errorMsg,
            file_name: fileName,
          });
        }

        return '';
      }
    } catch (_error) {
      const errorMsg = getErrorMessage(error);
      log(`${ICONS.ERROR}`, `OCR extraction error: ${errorMsg}`);
      return '';
    }
  }

  /**
   * Validação robusta de PDF - Adaptado do pdf_validator.py
   */
  async validatePDF(buffer: Buffer, filename: string, userPlan: string = 'starter'): Promise<PDFValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // 1. Verificação de magic bytes
      if (!this.hasValidPDFHeader(buffer)) {
        errors.push('Arquivo não é um PDF válido');
      }

      // 2. Verificação de corrupção
      const corruptionCheck = await this.checkCorruption(buffer, userPlan);
      if (corruptionCheck.isCorrupt) {
        if (userPlan === 'starter') {
          errors.push('PDF corrompido detectado');
        } else {
          warnings.push('PDF com possível corrupção - processamento tolerante ativado');
        }
      }

      // 3. Extração de metadados
      const metadata = await this.extractMetadata(buffer);

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        metadata
      };

    } catch (_error) {
      const errorMsg = getErrorMessage(error);
      return {
        isValid: false,
        errors: [`Erro na validação: ${errorMsg}`],
        warnings: [],
        metadata: {
          pages: 0,
          sizeMB: buffer.length / (1024 * 1024),
          hasText: false,
          hasImages: false
        }
      };
    }
  }

  /**
   * Verificação de magic bytes do PDF
   */
  private hasValidPDFHeader(buffer: Buffer): boolean {
    const header = buffer.slice(0, 4).toString();
    return header === '%PDF';
  }


  /**
   * Verificação de corrupção com tolerância baseada no plano
   */
  private async checkCorruption(buffer: Buffer, _userPlan: string): Promise<{isCorrupt: boolean, severity: 'low' | 'medium' | 'high'}> {
    try {
      // Tentativa básica de extração para detectar corrupção
      await this.extractWithPrimary(buffer);
      return { isCorrupt: false, severity: 'low' };
    } catch (_error) {
      const errorMsg = error instanceof Error ? error.message.toLowerCase() : '';

      if (errorMsg.includes('invalid') || errorMsg.includes('corrupt')) {
        return { isCorrupt: true, severity: 'high' };
      }

      if (errorMsg.includes('parse') || errorMsg.includes('format')) {
        return { isCorrupt: true, severity: 'medium' };
      }

      return { isCorrupt: true, severity: 'low' };
    }
  }

  /**
   * Extração de metadados do PDF - Implementação simplificada
   * Não usa pdfjs-dist, apenas análise do buffer
   */
  private async extractMetadata(buffer: Buffer): Promise<PDFValidationResult['metadata']> {
    try {
      const sizeMB = Math.round((buffer.length / (1024 * 1024)) * 100) / 100;
      // Create validated PDFData object for image detection
      const pdfDataObj: { text: string; numpages: number; info: Record<string, unknown>; metadata: Record<string, unknown> } = {
        text: '',
        numpages: 0,
        info: {},
        metadata: {}
      };
      const hasImages = this.detectImagesInPDF(buffer, pdfDataObj);

      return {
        pages: 0, // Simplified - exact page count requires Railway processing
        sizeMB,
        hasText: false, // Will be determined during actual extraction
        hasImages
      };
    } catch (_error) {
      const errorMsg = getErrorMessage(error);
      logError(errorMsg, "❌ Erro ao extrair metadados:", { component: "refactored" });
      return {
        pages: 0,
        sizeMB: Math.round((buffer.length / (1024 * 1024)) * 100) / 100,
        hasText: false,
        hasImages: false
      };
    }
  }

  /**
   * Utilitário para logging de uso de memória (adaptado do V1)
   */
  logMemoryUsage(context: string = ''): void {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      const usedMB = Math.round(usage.rss / 1024 / 1024);

      if (usedMB > 400) {
        log.warn({ msg: "⚠️ HIGH MEMORY USAGE: MB -" });
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
          log.info({ msg: "🧹 Garbage collection forçado" });
        }
      } else {
        log.info({ msg: "📊 Memory usage: MB -" });
      }
    }
  }

  /**
   * Processa PDF completo - Extração via Railway
   * Extrai texto, normaliza e identifica campos específicos
   */
  async processComplete(options: ProcessCompleteOptions): Promise<PDFAnalysisResult> {
    const processStartTime = Date.now();

    try {
      log(`${ICONS.VERCEL} ${ICONS.PDF}`, '=== INICIANDO PROCESSAMENTO COMPLETO DO PDF ===');
      log(`${ICONS.VERCEL}`, 'Opções recebidas', {
        pdf_path: options.pdf_path,
        extract_fields: options.extract_fields.slice(0, 3),
        custom_fields_count: options.custom_fields?.length || 0,
      });

      // 1. Verificar se arquivo existe
      log(`${ICONS.VERCEL} ${ICONS.PDF}`, 'Verificando acesso ao arquivo');
      await fs.access(options.pdf_path);
      log(`${ICONS.VERCEL} ${ICONS.SUCCESS}`, 'Arquivo acessível');

      // 2. Ler arquivo do disco
      log(`${ICONS.VERCEL} ${ICONS.PDF}`, 'Lendo arquivo do disco', { path: options.pdf_path });
      const fileBuffer = await fs.readFile(options.pdf_path);
      const stats = await fs.stat(options.pdf_path);
      const file_size_mb = stats.size / (1024 * 1024);
      const file_name = options.pdf_path.split('/').pop() || 'document.pdf';

      log(`${ICONS.VERCEL} ${ICONS.SUCCESS}`, 'Arquivo lido com sucesso', {
        size_bytes: fileBuffer.length,
        size_mb: file_size_mb.toFixed(2),
        file_name,
      });

      // 3. Extrair texto via Railway
      log(`${ICONS.VERCEL} ${ICONS.RAILWAY}`, 'Iniciando extração de texto via Railway');
      const railwayDataRaw = await callRailwayPdfProcessor(fileBuffer, file_name);

      // Use type guard to safely validate Railway response
      if (!isRailwayPdfResponse(railwayDataRaw)) {
        log(`${ICONS.VERCEL} ${ICONS.ERROR}`, 'Invalid Railway response structure');
        return {
          success: false,
          error: 'Invalid response from PDF processor',
          extracted_fields: options.extract_fields,
          custom_fields: options.custom_fields || [],
          processed_at: new Date().toISOString(),
          file_name,
          file_size_mb
        };
      }

      const railwayData = railwayDataRaw;
      const texto_original = railwayData.originalText;

      log(`${ICONS.VERCEL} ${ICONS.SUCCESS}`, 'Texto extraído do Railway', {
        original_length: texto_original.length,
        cleaned_length: railwayData.cleanedText.length,
        extraction_time_ms: railwayData.metrics.extractionTimeMs,
        process_number: railwayData.processNumber,
      });

      if (!texto_original || texto_original.trim().length === 0) {
        log(`${ICONS.VERCEL} ${ICONS.ERROR}`, 'PDF não contém texto extraível');
        return {
          success: false,
          error: 'PDF não contém texto extraível',
          extracted_fields: options.extract_fields,
          custom_fields: options.custom_fields || [],
          processed_at: new Date().toISOString(),
          file_name,
          file_size_mb
        };
      }

      // 4. Normalizar/limpar texto
      log(`${ICONS.VERCEL} ${ICONS.PDF}`, 'Normalizando texto');
      const texto_limpo = this.normalizeText(texto_original);
      const texto_ai_friendly = texto_limpo.slice(0, 50000);

      log(`${ICONS.VERCEL} ${ICONS.SUCCESS}`, 'Texto normalizado', {
        normalized_length: texto_limpo.length,
        ai_friendly_length: texto_ai_friendly.length,
      });

      // 5. Extrair informações básicas
      log(`${ICONS.VERCEL} ${ICONS.PDF}`, 'Extraindo informações básicas');
      const info_basica = this.extractBasicInfo(texto_original, options.extract_fields);

      // Ensure info_basica has required structure
      const validatedInfoBasica = info_basica || {
        numero_processo: undefined,
        cpf_encontrado: undefined,
        cnpj_encontrado: undefined,
        valores_encontrados: [],
        datas_encontradas: []
      };

      log(`${ICONS.VERCEL} ${ICONS.SUCCESS}`, 'Informações básicas extraídas', {
        process_number: validatedInfoBasica.numero_processo,
        cpf_found: !!validatedInfoBasica.cpf_encontrado,
        cnpj_found: !!validatedInfoBasica.cnpj_encontrado,
        values_count: (validatedInfoBasica.valores_encontrados || []).length,
        dates_count: (validatedInfoBasica.datas_encontradas || []).length,
      });

      // 6. Retornar resultado completo
      const totalTime = Date.now() - processStartTime;

      log(`${ICONS.VERCEL} ${ICONS.SUCCESS}`, '=== PROCESSAMENTO DO PDF CONCLUÍDO ===', {
        total_time_ms: totalTime,
        success: true,
        text_length: texto_original.length,
      });

      return {
        success: true,
        texto_original,
        texto_limpo,
        texto_ai_friendly,
        info_basica: validatedInfoBasica,
        extracted_fields: options.extract_fields,
        custom_fields: options.custom_fields || [],
        processed_at: new Date().toISOString(),
        file_name,
        file_size_mb,
        processingMethod: 'railway-http-client'
      };

    } catch (_error) {
      const totalTime = Date.now() - processStartTime;
      const errorMessage = getErrorMessage(error);
      const errorStack = error instanceof Error ? error.stack?.substring(0, 200) : undefined;

      log(`${ICONS.VERCEL} ${ICONS.ERROR}`, '=== ERRO AO PROCESSAR PDF ===', {
        error_message: errorMessage,
        total_time_ms: totalTime,
        stack: errorStack,
      });

      return {
        success: false,
        error: errorMessage,
        extracted_fields: options.extract_fields,
        custom_fields: options.custom_fields || [],
        processed_at: new Date().toISOString(),
        file_name: options.pdf_path.split('/').pop() || 'unknown'
      };
    }
  }

  /**
   * Normaliza texto removendo espaços e quebras de linha excessivas
   */
  private normalizeText(text: string): string {
    return text
      .replace(/\n{3,}/g, '\n\n') // Reduz quebras de linha excessivas
      .replace(/\s{2,}/g, ' ') // Reduz espaços excessivos
      .trim();
  }

  /**
   * Extrai informações básicas do PDF conforme campos solicitados
   */
  private extractBasicInfo(texto: string, _extract_fields: string[]): PDFAnalysisResult['info_basica'] {
    const info: PDFAnalysisResult['info_basica'] = {
      numero_processo: undefined,
      cpf_encontrado: undefined,
      cnpj_encontrado: undefined,
      valores_encontrados: [],
      datas_encontradas: []
    };

    if (!texto) return info;

    try {
      // Extrair número do processo (CNJ formato moderno ou antigo)
      const cnj_modern = texto.match(/\d{7}-\d{2}\.\d{4}\.\d{1}\.\d{2}\.\d{4}/);
      const cnj_old = texto.match(/\d{4}\.\d{2}\.\d{6}-\d{1}/);
      info.numero_processo = cnj_modern?.[0] || cnj_old?.[0];

      // Extrair CPF
      const cpf = texto.match(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
      if (cpf) info.cpf_encontrado = cpf[0];

      // Extrair CNPJ
      const cnpj = texto.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
      if (cnpj) info.cnpj_encontrado = cnpj[0];

      // Extrair valores monetários
      const valores = texto.match(/R\$\s*[\d.,]+|R\$\s*\d+[.,]\d{2}/g);
      if (valores) info.valores_encontrados = valores.slice(0, 5); // Primeiros 5 valores

      // Extrair datas (DD/MM/YYYY)
      const datas = texto.match(/\d{2}\/\d{2}\/\d{4}/g);
      if (datas) info.datas_encontradas = [...new Set(datas)].slice(0, 5); // Únicas, primeiras 5

    } catch (_error) {
      const errorMsg = getErrorMessage(error);
      logError(errorMsg, "⚠️ Erro ao extrair informações básicas:", { component: "refactored" });
    }

    return info;
  }

  /**
   * Detecta presença de imagens no PDF com type narrowing seguro
   */
  private detectImagesInPDF(buffer: Buffer, pdfData: unknown): boolean {
    try {
      // Validate pdfData structure using type guard
      if (!isPDFData(pdfData)) {
        log.warn({ msg: "Invalid PDF data structure for image detection" });
        return false;
      }

      // Estratégias para detectar imagens:

      // 1. Verificar se há muitas páginas com pouco texto
      const avgTextPerPage = pdfData.numpages > 0
        ? pdfData.text.length / pdfData.numpages
        : pdfData.text.length;

      if (avgTextPerPage < 100) { // Menos de 100 chars por página sugere imagens
        return true;
      }

      // 2. Verificar padrões binários que indicam imagens no PDF
      const bufferStr = buffer.toString('binary');
      const imagePatterns = ['/Image', '/DCTDecode', '/JPXDecode', '/FlateDecode'];
      const hasImageMarkers = imagePatterns.some(pattern => bufferStr.includes(pattern));

      // 3. Verificar tamanho do arquivo vs quantidade de texto
      const textDensity = buffer.length > 0
        ? pdfData.text.length / buffer.length
        : 0;

      if (textDensity < 0.01) { // Muito pouco texto para o tamanho do arquivo
        return true;
      }

      return hasImageMarkers;
    } catch (_error) {
      const errorMsg = getErrorMessage(error);
      logError(errorMsg, "Erro ao detectar imagens:", { component: "refactored" });
      return false;
    }
  }

  /**
   * Salva resultado da análise no banco com versionamento
   */
  async saveAnalysisVersion(
    caseId: string,
    analysisResult: PDFAnalysisResult,
    modelUsed: string,
    aiAnalysis: Record<string, unknown>,
    processingTime: number = 0
  ) {
    try {
      // Get the case to obtain workspaceId
      const case_ = await this.prisma.case.findUnique({
        where: { id: caseId },
        select: { workspaceId: true }
      });

      if (!case_) {
        throw new Error(`Case not found: ${caseId}`);
      }

      // Implementar incremento correto da versão
      const lastVersion = await this.prisma.caseAnalysisVersion.findFirst({
        where: { caseId },
        orderBy: { version: 'desc' }
      });

      const nextVersion = (lastVersion?.version || 0) + 1;

      // Calcular confidence baseado na qualidade da extração
      const confidence = this.calculateExtractionConfidence(analysisResult);

      // Calcular custo baseado no modelo usado
      const costEstimate = this.calculateModelCost(modelUsed, analysisResult.extraction?.text.length || 0);

      // Create extractedData as JSON-compatible object for Prisma
      // Using JSON serialization to ensure type safety
      const extractedDataRaw = {
        text_original: analysisResult.texto_original || '',
        text_cleaned: analysisResult.texto_limpo || '',
        text_ai_friendly: analysisResult.texto_ai_friendly || '',
        info_basica: analysisResult.info_basica || null,
        extracted_fields: analysisResult.extracted_fields,
        custom_fields: analysisResult.custom_fields || [],
        file_name: analysisResult.file_name,
        file_size_mb: analysisResult.file_size_mb || 0,
        success: analysisResult.success,
        processing_method: analysisResult.processingMethod || 'unknown',
        extraction_quality: analysisResult.extraction?.quality || 'low'
      };

      // Parse/stringify to ensure JSON compatibility with Prisma
      const extractedData = JSON.parse(JSON.stringify(extractedDataRaw));
      const metadataRaw = {
        file_size_mb: analysisResult.file_size_mb || 0,
        extracted_fields_count: analysisResult.extracted_fields.length,
        success: analysisResult.success
      };
      const metadata = JSON.parse(JSON.stringify(metadataRaw));
      // Also ensure aiAnalysis is JSON-compatible
      const aiAnalysisData = JSON.parse(JSON.stringify(aiAnalysis));

      const version = await this.prisma.caseAnalysisVersion.create({
        data: {
          case: {
            connect: { id: caseId }
          },
          workspace: {
            connect: { id: case_.workspaceId }
          },
          version: nextVersion,
          analysisType: 'PDF_UPLOAD',
          extractedData,
          aiAnalysis: aiAnalysisData,
          modelUsed,
          confidence,
          processingTime,
          costEstimate,
          metadata
        }
      });

      return version;

    } catch (_error) {
      logError(error, "Erro ao salvar versão da análise:", { component: "refactored" });
      throw error;
    }
  }

  /**
   * Calcula confidence baseado na qualidade da extração
   */
  private calculateExtractionConfidence(analysisResult: PDFAnalysisResult): number {
    let confidence = 0.5; // Base de 50%

    // Incrementar baseado na qualidade da extração
    if (analysisResult.extraction?.success) {
      confidence += 0.2;
    }

    // Incrementar baseado na qualidade do texto
    switch (analysisResult.extraction?.quality) {
      case 'high':
        confidence += 0.3;
        break;
      case 'medium':
        confidence += 0.2;
        break;
      case 'low':
        confidence += 0.1;
        break;
    }

    // Incrementar baseado na quantidade de campos extraídos
    const fieldsExtracted = analysisResult.extracted_fields.filter(f => f && f.trim()).length;
    const totalFields = analysisResult.extracted_fields.length;
    const fieldRatio = fieldsExtracted / totalFields;
    confidence += fieldRatio * 0.2;

    return Math.min(Math.max(confidence, 0.1), 0.99); // Entre 10% e 99%
  }

  /**
   * Calcula custo baseado no modelo e quantidade de texto
   */
  private calculateModelCost(modelUsed: string, textLength: number): number {
    // Custos estimados por 1k tokens (em dólares)
    const modelCosts: Record<string, number> = {
      'gemini-2.5-flash-lite': 0.000075,
      'gemini-2.5-flash': 0.00015,
      'gemini-2.5-pro': 0.0025,
      'gpt-4': 0.03,
      'gpt-3.5-turbo': 0.002
    };

    // Estimar tokens (1 token ≈ 4 caracteres)
    const estimatedTokens = Math.ceil(textLength / 4);
    const costPerKToken = modelCosts[modelUsed] || 0.001;

    return (estimatedTokens / 1000) * costPerKToken;
  }

  /**
   * Obtém campos padrão para extração jurídica
   */
  getDefaultExtractionFields(): string[] {
    return [
      'Número do Processo',
      'Tipo Processual',
      'Parte (nome completo)',
      'CNPJ/CPF da Parte',
      'Esfera (Federal/Estadual/Municipal)',
      'Órgão/Instância',
      'Parte Contrária (nome completo)',
      'CNPJ/CPF da Parte Contrária',
      'Matéria Tributária / Tributo Cobrado',
      'Tese Jurídica (argumentos centrais das defesas)',
      'Valor Principal',
      'Multas',
      'Juros',
      'Encargos Legais',
      'Valor Total',
      'Atualizado em',
      'Risco (Provável/Possível/Remoto)',
      'Situação atual do processo',
      'Principais andamentos cronológicos',
      'CDAs (números)',
      'Penhora/Constrição',
      'Desconsideração/Inclusão de Sócios',
      'Recursos interpostos',
      'Citações legais (artigos, leis, súmulas)'
    ];
  }
}

// ================================================================
// STANDALONE FUNCTION EXPORTS
// ================================================================

/**
 * Standalone function for PDF text extraction from file path
 * Reads file from disk and extracts text via Railway
 * Used by juditAttachmentProcessor and other file-based PDF operations
 */
export async function extractTextFromPDF(
  bufferOrPath: Buffer | string,
  fileName: string = 'document.pdf'
): Promise<ExtractionResult> {
  try {
    let buffer: Buffer;
    let finalFileName = fileName;

    // Handle both Buffer and file path inputs
    if (typeof bufferOrPath === 'string') {
      // It's a file path
      const fs = await import('fs/promises');
      buffer = await fs.readFile(bufferOrPath);
      // Extract filename from path if not provided
      finalFileName = bufferOrPath.split('/').pop() || fileName;
      log(`${ICONS.PDF}`, `Lido arquivo do caminho: ${bufferOrPath} (${buffer.length} bytes)`);
    } else {
      // It's a Buffer
      buffer = bufferOrPath;
    }

    const processor = new PDFProcessor();
    const result = await processor.extractText(buffer, finalFileName);

    if (!result.success) {
      throw new Error(`Extração falhou: ${result.text ? 'sem texto' : 'erro desconhecido'}`);
    }

    return result;
  } catch (_error) {
    const errorMsg = getErrorMessage(error);
    log(`${ICONS.ERROR}`, `Erro na extração de PDF: ${errorMsg}`);
    throw error;
  }
}

/**
 * Initialize and get a PDFProcessor instance
 */
export function getPDFProcessor(): PDFProcessor {
  return new PDFProcessor()
}