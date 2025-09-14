// lib/pdf-processor.ts - Sistema de processamento PDF adaptado da v1
import { PrismaClient } from '@prisma/client';
import { promises as fs } from 'fs';
import { join } from 'path';

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
}

export interface ProcessCompleteOptions {
  pdf_path: string;
  extract_fields: string[];
  custom_fields?: string[];
}

export class PDFProcessor {
  private prisma: PrismaClient;
  private apiUrl: string;

  constructor(prisma: PrismaClient, apiUrl = 'http://localhost:8000') {
    this.prisma = prisma;
    this.apiUrl = apiUrl;
  }

  /**
   * Processa PDF completo chamando API Python (da v1)
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
      const file = new File([fileBuffer], options.pdf_path.split('/').pop() || 'document.pdf', {
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
          extractedData: analysisResult,
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