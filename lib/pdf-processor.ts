// ================================================================
// PDF PROCESSOR - Adaptado do JustoAI V1 com Economia de Tokens
// ================================================================
// Implementa extração em cascata, limpeza avançada e otimização de IA

import { promises as fs } from 'fs';
import { prisma } from './prisma';

// Type declaration for pdf-parse
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
  private readonly apiUrl: string;
  private readonly prisma: typeof prisma;

  constructor() {
    // Construtor simplificado - não depende mais de Prisma ou API externa
    this.apiUrl = process.env.PDF_API_URL || 'http://localhost:8000';
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
   * Método primário - extração real com pdf-parse
   */
  private async extractWithPrimary(buffer: Buffer): Promise<string> {
    try {
      const pdfParse = (await import('pdf-parse' as any)).default as (buffer: Buffer) => Promise<PDFData>;

      const startTime = Date.now();
      const pdfData = await pdfParse(buffer);
      const extractionTime = Date.now() - startTime;

      console.log(`📄 PDF extraído com pdf-parse: ${pdfData.text.length} chars em ${extractionTime}ms`);

      if (!pdfData.text || pdfData.text.trim().length === 0) {
        throw new Error('PDF não contém texto extraível');
      }

      return pdfData.text;
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
      const pdfParse = (await import('pdf-parse' as any)).default as (buffer: Buffer) => Promise<PDFData>;
      const pdfData = await pdfParse(buffer);

      // Detectar imagens verificando se há discrepância entre páginas e texto
      const hasImages = this.detectImagesInPDF(buffer, pdfData);

      return {
        pages: pdfData.numpages,
        sizeMB: Math.round((buffer.length / (1024 * 1024)) * 100) / 100,
        hasText: !!(pdfData.text && pdfData.text.trim().length > 0),
        hasImages
      };
    } catch {
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
   * Processa PDF completo (versão otimizada para V2)
   */
  async processComplete(options: ProcessCompleteOptions): Promise<PDFAnalysisResult> {
    try {
      // Verificar se arquivo existe
      await fs.access(options.pdf_path);

      // Obter tamanho do arquivo
      const stats = await fs.stat(options.pdf_path);
      const file_size_mb = stats.size / (1024 * 1024);

      // Chamar API Python da v1 para processamento
      const formData = new FormData();
      const fileBuffer = await fs.readFile(options.pdf_path);
      const arrayBuffer = fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength) as ArrayBuffer;
      const file = new File([arrayBuffer], options.pdf_path.split('/').pop() || 'document.pdf', {
        type: 'application/pdf'
      });

      formData.append('file', file);
      formData.append('extract_fields', JSON.stringify(options.extract_fields));
      if (options.custom_fields) {
        formData.append('custom_fields', JSON.stringify(options.custom_fields));
      }

      const response = await fetch(`${this.apiUrl}/api/pdf/process-complete`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`API Python retornou erro: ${response.status}`);
      }

      const result = await response.json();

      return {
        ...result,
        file_size_mb,
        processed_at: new Date().toISOString(),
      };

    } catch (error) {
      console.error('Erro no processamento PDF:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        extracted_fields: options.extract_fields,
        custom_fields: options.custom_fields || [],
        processed_at: new Date().toISOString(),
        file_name: options.pdf_path.split('/').pop() || 'unknown',
      };
    }
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