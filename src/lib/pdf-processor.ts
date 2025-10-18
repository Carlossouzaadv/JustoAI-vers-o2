// ================================================================
// PDF PROCESSOR - Adaptado do JustoAI V1 com Economia de Tokens
// ================================================================
// Implementa extração em cascata, limpeza avançada e otimização de IA

import { promises as fs } from 'fs';
import { prisma } from './prisma';

// Polyfills for Node.js environment (no canvas/DOM)
if (typeof globalThis !== 'undefined' && typeof globalThis.DOMMatrix === 'undefined') {
  (globalThis as any).DOMMatrix = class {
    constructor(public data: any = null) {}
  };
}

// Import pdfjs-dist and disable worker for Node.js
let pdfjs: any = null;

async function getPdfJS() {
  if (!pdfjs) {
    try {
      pdfjs = await import('pdfjs-dist/build/pdf.mjs');
    } catch {
      pdfjs = await import('pdfjs-dist');
    }

    // CRITICAL: Disable worker IMMEDIATELY after import
    // This prevents pdfjs from trying to load pdf.worker.mjs dynamically
    if (pdfjs.GlobalWorkerOptions) {
      pdfjs.GlobalWorkerOptions.workerSrc = '';  // Empty string = no worker
    }
  }
  return pdfjs;
}

// Type declaration for extracted PDF data
interface PDFData {
  text: string;
  numpages: number;
  info: any;
  metadata: any;
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
   * Extração em cascata - Estratégia principal do V1
   * 1. Método primário com pdf-parse
   * 2. Fallback se < 100 chars
   * 3. OCR seria implementado com tesseract.js se necessário
   */
  async extractText(buffer: Buffer): Promise<ExtractionResult> {
    console.log('🔍 Iniciando extração em cascata...');

    try {
      // Estratégia 1: Método primário
      const primaryText = await this.extractWithPrimary(buffer);

      if (primaryText.length >= this.MIN_TEXT_LENGTH) {
        console.log('✅ Extração primária bem-sucedida');
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

      console.log('⚠️ Texto insuficiente, tentando método alternativo...');

      // Estratégia 2: Fallback
      const fallbackText = await this.extractWithFallback(buffer);

      if (fallbackText.length >= this.MIN_TEXT_LENGTH) {
        console.log('✅ Extração fallback bem-sucedida');
        return {
          text: fallbackText,
          method: 'fallback',
          success: true,
          quality: 'medium',
          originalLength: fallbackText.length,
          processedLength: fallbackText.length,
          reductionPercentage: 0
        };
      }

      // TODO: Estratégia 3: OCR com tesseract.js
      console.log('❌ Todas as estratégias falharam');

      return {
        text: primaryText || fallbackText || '',
        method: 'primary',
        success: false,
        quality: 'low',
        originalLength: 0,
        processedLength: 0,
        reductionPercentage: 0
      };

    } catch (error) {
      console.error('❌ Erro na extração de texto:', error);
      throw new Error(`Falha na extração: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  /**
   * Método primário - extração com pdfjs-dist (sem canvas, puro Node.js)
   */
  private async extractWithPrimary(buffer: Buffer): Promise<string> {
    try {
      const startTime = Date.now();
      const pdfLib = await getPdfJS();

      // Convert Buffer to Uint8Array (pdfjs-dist requires Uint8Array, not Buffer)
      const uint8Array = new Uint8Array(buffer);

      // Load PDF document
      const pdf = await pdfLib.getDocument({ data: uint8Array }).promise;
      let fullText = '';

      // Extract text from each page (no rendering, just text content)
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
          console.warn(`⚠️ Erro ao extrair página ${pageNum}:`, pageError);
          // Continue com próximas páginas
        }
      }

      const extractionTime = Date.now() - startTime;
      console.log(`📄 PDF extraído com pdfjs-dist: ${fullText.length} chars em ${extractionTime}ms`);

      if (!fullText || fullText.trim().length === 0) {
        throw new Error('PDF não contém texto extraível');
      }

      return fullText;
    } catch (error) {
      console.error('❌ Erro no método primário:', error);
      return '';
    }
  }

  /**
   * Método fallback
   */
  private async extractWithFallback(buffer: Buffer): Promise<string> {
    try {
      console.log('🔄 Tentando extração fallback...');
      // Implementação básica de fallback
      return '';
    } catch (error) {
      console.error('❌ Erro no método fallback:', error);
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

    } catch (error) {
      return {
        isValid: false,
        errors: [`Erro na validação: ${error instanceof Error ? error.message : 'Erro desconhecido'}`],
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
  private async checkCorruption(buffer: Buffer, userPlan: string): Promise<{isCorrupt: boolean, severity: 'low' | 'medium' | 'high'}> {
    try {
      // Tentativa básica de extração para detectar corrupção
      await this.extractWithPrimary(buffer);
      return { isCorrupt: false, severity: 'low' };
    } catch (error) {
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
   * Extração de metadados do PDF
   */
  private async extractMetadata(buffer: Buffer): Promise<PDFValidationResult['metadata']> {
    try {
      const pdfLib = await getPdfJS();
      const uint8Array = new Uint8Array(buffer);
      const pdf = await pdfLib.getDocument({ data: uint8Array }).promise;

      let fullText = '';
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str || '')
            .join('');
          fullText += pageText + '\n';
        } catch {
          // Continue
        }
      }

      // Detectar imagens verificando se há discrepância entre páginas e texto
      const hasImages = this.detectImagesInPDF(buffer, {
        text: fullText,
        numpages: pdf.numPages
      });

      return {
        pages: pdf.numPages,
        sizeMB: Math.round((buffer.length / (1024 * 1024)) * 100) / 100,
        hasText: !!(fullText && fullText.trim().length > 0),
        hasImages
      };
    } catch (error) {
      console.error('❌ Erro ao extrair metadados:', error);
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
        console.warn(`⚠️ HIGH MEMORY USAGE: ${usedMB}MB - ${context}`);
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
          console.log('🧹 Garbage collection forçado');
        }
      } else {
        console.log(`📊 Memory usage: ${usedMB}MB - ${context}`);
      }
    }
  }

  /**
   * Processa PDF completo - Extração com pdfjs-dist (sem canvas, pure Node.js)
   * Extrai texto, normaliza e identifica campos específicos
   */
  async processComplete(options: ProcessCompleteOptions): Promise<PDFAnalysisResult> {
    try {
      // DEBUG: Log all inputs at start
      console.log('=== PDF PROCESSOR START (pdfjs-dist no-canvas) ===');
      console.log('--- OPTIONS RECEIVED ---', JSON.stringify(options, null, 2));
      console.log('--- PDF_PATH TYPE ---', typeof options.pdf_path);
      console.log('--- PDF_PATH VALUE ---', options.pdf_path);

      // 1. Verificar se arquivo existe
      console.log('--- CHECKING FILE ACCESS ---', options.pdf_path);
      await fs.access(options.pdf_path);
      console.log('--- FILE ACCESS OK ---');

      // 2. Ler arquivo do disco
      console.log('--- ATTEMPTING TO READ FILE ---', options.pdf_path);
      let fileBuffer: Buffer;
      try {
        fileBuffer = await fs.readFile(options.pdf_path);
        console.log('--- FILE READ SUCCESS ---', 'Size:', fileBuffer.length, 'bytes');
      } catch (readError: any) {
        console.error('=== FILE READ FAILED ===');
        console.error('--- ERROR DETAILS ---', readError);
        throw readError;
      }
      const stats = await fs.stat(options.pdf_path);
      const file_size_mb = stats.size / (1024 * 1024);
      const file_name = options.pdf_path.split('/').pop() || 'document.pdf';

      console.log(`📄 Processando PDF localmente: ${file_name} (${file_size_mb.toFixed(2)}MB)`);

      // 3. Extrair texto com pdfjs-dist (text-only, sem canvas)
      console.log('--- STARTING PDFJS-DIST EXTRACTION ---');
      const pdfLib = await getPdfJS();
      // Convert Buffer to Uint8Array (pdfjs-dist requirement)
      const uint8Array = new Uint8Array(fileBuffer);
      const pdf = await pdfLib.getDocument({ data: uint8Array }).promise;
      console.log('--- PDF DOCUMENT LOADED ---', `Pages: ${pdf.numPages}`);

      let texto_original = '';
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => (item.str || '') + (item.space ? ' ' : ''))
            .join('')
            .trim();
          texto_original += pageText + '\n';
          console.log(`--- PAGE ${pageNum} EXTRACTED ---`, `${pageText.length} chars`);
        } catch (pageError) {
          console.warn(`⚠️ Erro extraindo página ${pageNum}:`, pageError);
        }
      }

      console.log('--- PDF EXTRACTION COMPLETE ---', `Total: ${texto_original.length} chars`);

      if (!texto_original || texto_original.trim().length === 0) {
        console.warn('⚠️ PDF não contém texto extraível');
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

      console.log(`✅ Texto extraído: ${texto_original.length} caracteres`);

      // 4. Normalizar/limpar texto
      const texto_limpo = this.normalizeText(texto_original);
      const texto_ai_friendly = texto_limpo.slice(0, 50000); // Limitar para análise IA

      // 5. Extrair informações básicas conforme os campos solicitados
      const info_basica = this.extractBasicInfo(texto_original, options.extract_fields);

      // 6. Retornar resultado completo
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
        processingMethod: 'local-pdfjs-no-canvas'
      };

    } catch (error) {
      console.error('❌ Erro ao processar PDF:', error);
      console.error('--- ERROR STACK ---', error instanceof Error ? error.stack : 'Sem stack trace');

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
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
  private extractBasicInfo(texto: string, extract_fields: string[]): PDFAnalysisResult['info_basica'] {
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

    } catch (error) {
      console.warn('⚠️ Erro ao extrair informações básicas:', error);
    }

    return info;
  }

  /**
   * Detecta presença de imagens no PDF
   */
  private detectImagesInPDF(buffer: Buffer, pdfData: any): boolean {
    try {
      // Estratégias para detectar imagens:

      // 1. Verificar se há muitas páginas com pouco texto
      const avgTextPerPage = pdfData.text.length / pdfData.numpages;
      if (avgTextPerPage < 100) { // Menos de 100 chars por página sugere imagens
        return true;
      }

      // 2. Verificar padrões binários que indicam imagens no PDF
      const bufferStr = buffer.toString('binary');
      const imagePatterns = ['/Image', '/DCTDecode', '/JPXDecode', '/FlateDecode'];
      const hasImageMarkers = imagePatterns.some(pattern => bufferStr.includes(pattern));

      // 3. Verificar tamanho do arquivo vs quantidade de texto
      const textDensity = pdfData.text.length / buffer.length;
      if (textDensity < 0.01) { // Muito pouco texto para o tamanho do arquivo
        return true;
      }

      return hasImageMarkers;
    } catch (error) {
      console.error('Erro ao detectar imagens:', error);
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
    aiAnalysis: any,
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

      const version = await this.prisma.caseAnalysisVersion.create({
        data: {
          caseId,
          workspaceId: case_.workspaceId,
          version: nextVersion,
          analysisType: 'PDF_UPLOAD',
          extractedData: analysisResult as any,
          aiAnalysis,
          modelUsed,
          confidence,
          processingTime,
          costEstimate,
          metadata: {
            file_size_mb: analysisResult.file_size_mb,
            extracted_fields_count: analysisResult.extracted_fields.length,
            success: analysisResult.success
          }
        }
      });

      return version;

    } catch (error) {
      console.error('Erro ao salvar versão da análise:', error);
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
      'gemini-1.5-flash-8b': 0.000075,
      'gemini-1.5-flash': 0.00015,
      'gemini-1.5-pro': 0.0025,
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