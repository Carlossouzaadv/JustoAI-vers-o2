// ================================================================
// PDF PROCESSOR - Adaptado do JustoAI V1 com Economia de Tokens
// ================================================================
// Implementa extração em cascata, limpeza avançada e otimização de IA

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
}

export interface ProcessCompleteOptions {
  pdf_path: string;
  extract_fields: string[];
  custom_fields?: string[];
}

export class PDFProcessor {
  private readonly MIN_TEXT_LENGTH = 100;
  private readonly MAX_EXTRACTION_TIME = 60000; // 60 segundos

  constructor() {
    // Construtor simplificado - não depende mais de Prisma ou API externa
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
   * Método primário - implementação básica para agora
   */
  private async extractWithPrimary(buffer: Buffer): Promise<string> {
    try {
      // TODO: Implementar com pdf-parse ou similar
      // Por enquanto, simulação para desenvolvimento
      await new Promise(resolve => setTimeout(resolve, 500));

      // Simula extração bem-sucedida para PDFs válidos
      if (buffer.length > 1000) {
        return 'Texto extraído simulado do PDF. Este seria o conteúdo real extraído usando pdf-parse ou biblioteca similar.';
      }

      return '';
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
      // Implementação básica de metadados
      return {
        pages: Math.ceil(buffer.length / 50000), // Estimativa grosseira
        sizeMB: Math.round((buffer.length / (1024 * 1024)) * 100) / 100,
        hasText: buffer.length > 1000, // Estimativa básica
        hasImages: false // TODO: Implementar detecção de imagens se necessário
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
   * Salva resultado da análise no banco com versionamento
   */
  async saveAnalysisVersion(
    caseId: string,
    analysisResult: PDFAnalysisResult,
    modelUsed: string,
    aiAnalysis: any
  ) {
    try {
      const version = await this.prisma.caseAnalysisVersion.create({
        data: {
          caseId,
          version: 1, // TODO: implementar incremento correto
          analysisType: 'PDF_UPLOAD',
          extractedData: analysisResult as any,
          aiAnalysis,
          modelUsed,
          confidence: 0.85, // TODO: calcular baseado na qualidade da extração
          processingTime: 0, // TODO: medir tempo real
          costEstimate: 0.001, // TODO: calcular baseado no modelo usado
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
   * Obtém campos padrão para extração jurídica
   */
  getDefaultExtractionFields(): string[] {
    return [
      "Número do Processo",
      "Tipo Processual",
      "Parte (nome completo)",
      "CNPJ/CPF da Parte",
      "Esfera (Federal/Estadual/Municipal)",
      "Órgão/Instância",
      "Parte Contrária (nome completo)",
      "CNPJ/CPF da Parte Contrária",
      "Matéria Tributária / Tributo Cobrado",
      "Tese Jurídica (argumentos centrais das defesas)",
      "Valor Principal",
      "Multas",
      "Juros",
      "Encargos Legais",
      "Valor Total",
      "Atualizado em",
      "Risco (Provável/Possível/Remoto)",
      "Situação atual do processo",
      "Principais andamentos cronológicos",
      "CDAs (números)",
      "Penhora/Constrição",
      "Desconsideração/Inclusão de Sócios",
      "Recursos interpostos",
      "Citações legais (artigos, leis, súmulas)"
    ];
  }
}