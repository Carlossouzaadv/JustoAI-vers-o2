
import { promises as fs } from 'fs';
import { prisma } from './prisma';
import { getErrorMessage, isPDFExtractionData, isRailwayPdfResponse, isPDFData } from './types/type-guards';
import { log, logError } from '@/lib/services/logger';
import { ICONS } from '@/lib/icons';

// Services
import { RailwayClient } from '@/lib/services/pdf/RailwayClient';
import { PdfValidator, PDFValidationResult } from '@/lib/services/pdf/PdfValidator';

export interface ExtractionResult {
  text: string;
  method: 'primary' | 'fallback' | 'ocr';
  success: boolean;
  quality: 'high' | 'medium' | 'low';
  originalLength: number;
  processedLength: number;
  reductionPercentage: number;
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
  private readonly prisma: typeof prisma;
  private railwayClient: RailwayClient;
  private validator: PdfValidator;

  constructor() {
    this.prisma = prisma;
    this.railwayClient = new RailwayClient();
    this.validator = new PdfValidator();
  }

  /**
   * Extração em cascata com OCR
   */
  async extractText(buffer: Buffer, fileName: string = 'document.pdf'): Promise<ExtractionResult> {
    try {
      // 1. Primary Method
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

      // 2. OCR Strategy
      log.info({ msg: `${ICONS.SCAN} Primary extraction insufficient (${primaryText.length} chars), trying OCR`, component: 'PDFProcessor' });
      const ocrText = await this.railwayClient.processOcr(buffer, fileName);

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

      // 3. Fallback
      log.warn({ msg: `${ICONS.WARNING} All extraction strategies failed for ${fileName}`, component: 'PDFProcessor' });
      return {
        text: primaryText || ocrText || '',
        method: 'primary',
        success: false,
        quality: 'low',
        originalLength: 0,
        processedLength: 0,
        reductionPercentage: 0
      };

    } catch (error) {
      const errorMsg = getErrorMessage(error);
      logError(error instanceof Error ? error : new Error(errorMsg), 'Extraction error', { component: 'PDFProcessor' });
      throw new Error(`Extraction failed: ${errorMsg}`);
    }
  }

  private async extractWithPrimary(buffer: Buffer, fileName: string): Promise<string> {
    try {
      const data = await this.railwayClient.processPdf(buffer, fileName);
      if (!isPDFExtractionData(data)) {
        throw new Error('Invalid PDF extraction response from Railway');
      }
      return data.cleanedText || data.text || '';
    } catch (error) {
      log.warn({ msg: 'Primary extraction failed', component: 'PDFProcessor' });
      return '';
    }
  }

  /**
   * Validate PDF using optimized validator service
   */
  async validatePDF(buffer: Buffer, filename: string, userPlan: string = 'starter'): Promise<PDFValidationResult> {
    return this.validator.validatePDF(buffer, filename, userPlan);
  }

  /**
   * Validates if Buffer has PDF magic bytes
   */
  private hasValidPDFHeader(buffer: Buffer): boolean {
    const header = buffer.slice(0, 4).toString();
    return header === '%PDF';
  }

  /**
   * Processes a PDF file from disk
   */
  async processComplete(options: ProcessCompleteOptions): Promise<PDFAnalysisResult> {
    const processStartTime = Date.now();

    try {
      log.info({ msg: `${ICONS.PROCESS} Starting complete PDF processing`, data: { path: options.pdf_path }, component: 'PDFProcessor' });

      // 1. Read file
      await fs.access(options.pdf_path);
      const fileBuffer = await fs.readFile(options.pdf_path);
      const file_name = options.pdf_path.split('/').pop() || 'document.pdf';
      const file_size_mb = fileBuffer.length / (1024 * 1024);

      // 2. Extract Text via Railway
      const railwayDataRaw = await this.railwayClient.processPdf(fileBuffer, file_name);

      if (!isRailwayPdfResponse(railwayDataRaw)) {
        throw new Error('Invalid Railway response structure');
      }

      const railwayData = railwayDataRaw;
      let texto_original = railwayData.originalText;
      let processingMethod = 'railway-http-client';

      // 2.1 OCR Fallback check
      // If text is empty or too short, try OCR
      if (!texto_original || texto_original.trim().length < this.MIN_TEXT_LENGTH) {
        log.info({ msg: `${ICONS.SCAN} Primary extraction insufficient, trying OCR`, component: 'PDFProcessor' });
        try {
          const ocrText = await this.railwayClient.processOcr(fileBuffer, file_name);
          if (ocrText && ocrText.length >= this.MIN_TEXT_LENGTH) {
            texto_original = ocrText;
            processingMethod = 'railway-ocr';
            log.info({ msg: `${ICONS.SUCCESS} OCR extraction successful`, component: 'PDFProcessor' });
          } else {
            // If OCR also fails or returns empty/short text
            if (!texto_original) texto_original = ''; // Ensure string
            log.warn({ msg: `${ICONS.WARNING} OCR also produced insufficient text`, component: 'PDFProcessor' });
          }
        } catch (ocrError) {
          logError(ocrError, 'OCR fallback failed', { component: 'PDFProcessor' });
          // Fallback to whatever we had (or empty string)
          if (!texto_original) texto_original = '';
        }
      }

      if (!texto_original || texto_original.trim().length === 0) {
        throw new Error('PDF content empty (OCR failed)');
      }

      // 3. Normalize
      const texto_limpo = this.normalizeText(texto_original);
      const texto_ai_friendly = texto_limpo.slice(0, 50000);

      // 4. Basic Info Extraction
      const info_basica = this.extractBasicInfo(texto_original);

      return {
        success: true,
        texto_original,
        texto_limpo,
        texto_ai_friendly,
        info_basica,
        extracted_fields: options.extract_fields,
        custom_fields: options.custom_fields || [],
        processed_at: new Date().toISOString(),
        file_name,
        file_size_mb,
        processingMethod: 'railway-http-client'
      };

    } catch (error) {
      const errorMsg = getErrorMessage(error);
      logError(error instanceof Error ? error : new Error(errorMsg), 'Error processing PDF complete', { component: 'PDFProcessor' });

      return {
        success: false,
        error: errorMsg,
        extracted_fields: options.extract_fields,
        custom_fields: options.custom_fields || [],
        processed_at: new Date().toISOString(),
        file_name: options.pdf_path.split('/').pop() || 'unknown'
      };
    }
  }

  private normalizeText(text: string): string {
    return text
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  private extractBasicInfo(texto: string): PDFAnalysisResult['info_basica'] {
    const info: PDFAnalysisResult['info_basica'] = {
      valores_encontrados: [],
      datas_encontradas: []
    };

    if (!texto) return info;

    try {
      const cnj_modern = texto.match(/\d{7}-\d{2}\.\d{4}\.\d{1}\.\d{2}\.\d{4}/);
      const cnj_old = texto.match(/\d{4}\.\d{2}\.\d{6}-\d{1}/);
      info.numero_processo = cnj_modern?.[0] || cnj_old?.[0];

      const cpf = texto.match(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
      if (cpf) info.cpf_encontrado = cpf[0];

      const cnpj = texto.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
      if (cnpj) info.cnpj_encontrado = cnpj[0];

      const valores = texto.match(/R\$\s*[\d.,]+|R\$\s*\d+[.,]\d{2}/g);
      if (valores) info.valores_encontrados = valores.slice(0, 5);

      const datas = texto.match(/\d{2}\/\d{2}\/\d{4}/g);
      if (datas) info.datas_encontradas = [...new Set(datas)].slice(0, 5);

    } catch (e) { /* ignore extraction errors */ }

    return info;
  }

  /* Backward Compatibility Methods */

  /**
   * Returns default fields to extract (used by analyze route)
   */
  getDefaultExtractionFields(): string[] {
    return [
      'numero_processo',
      'valor_causa',
      'data_distribuicao',
      'partes_ativas',
      'partes_passivas',
      'juizo',
      'comarca'
    ];
  }

  logMemoryUsage(context: string): void {
    const used = process.memoryUsage().heapUsed / 1024 / 1024;
    log.info({
      msg: `${ICONS.TELEMETRY || ICONS.CHART} Memory Usage: ${Math.round(used * 100) / 100} MB`,
      component: 'PDFProcessor',
      context
    });
  }

  /* End Backward Compatibility Methods */
}

/**
 * Standalone helper for backward compatibility with process/upload/route.ts
 */
export async function extractTextFromPDF(filePath: string): Promise<ExtractionResult> {
  const processor = new PDFProcessor();
  const fs = await import('fs/promises');
  const buffer = await fs.readFile(filePath);
  const fileName = filePath.split(/[/\\]/).pop() || 'document.pdf';
  return processor.extractText(buffer, fileName);
}