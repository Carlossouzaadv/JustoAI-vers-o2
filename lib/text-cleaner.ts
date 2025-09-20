// ================================================================
// TEXT CLEANER - Limpeza e Normalização de Documentos Jurídicos
// ================================================================
// Implementa extração de números CNJ e limpeza de texto conforme especificação

import { ICONS } from './icons';

export interface CleaningResult {
  originalText: string;
  cleanedText: string;
  originalLength: number;
  cleanedLength: number;
  reductionPercentage: number;
  patternsRemoved: string[];
  confidence: number;
}

export interface CleaningOptions {
  documentType: 'legal' | 'general';
  aggressiveness: 'conservative' | 'balanced' | 'aggressive';
  preserveStructure: boolean;
  customPatterns?: NoisePattern[];
}

export interface NoisePattern {
  name: string;
  regex: RegExp;
  replacement: string;
  description: string;
}

export class TextCleaner {
  // Regex para números CNJ no formato padrão: NNNNNNN-DD.AAAA.J.TR.OOOO
  private readonly CNJ_REGEX = /\b\d{7}-\d{2}\.\d{4}\.\d{1}\.\d{2}\.\d{4}\b/g;
  // Regex para formato antigo: NNNN.DD.NNNNNN-D
  private readonly CNJ_OLD_REGEX = /\b\d{4}\.\d{2}\.\d{6}-\d{1}\b/g;

  private legalNoisePatterns: NoisePattern[] = [
    // Cabeçalhos de tribunais repetidos (apenas linhas específicas)
    {
      name: 'legal_headers_expanded',
      regex: /^\s*TRIBUNAL\s+DE\s+JUSTIÇA[^\n]*$/gmi,
      replacement: '',
      description: 'Remove cabeçalhos de tribunais repetidos'
    },
    // Numeração de páginas específica
    {
      name: 'page_numbers',
      regex: /---?\s*Página\s+\d+\s+de\s+\d+\s*---?/gi,
      replacement: '',
      description: 'Remove numeração de páginas'
    },
    // Páginas simples
    {
      name: 'simple_pages',
      regex: /^\s*Página\s+\d+\s+de\s+\d+\s*$/gmi,
      replacement: '',
      description: 'Remove numeração simples de páginas'
    },
    // Protocolos
    {
      name: 'protocol_numbers',
      regex: /(?:protocolo|autuado|distribuído)[\s\w]*n[°º]?\s*[\d\.\-\/]+/gi,
      replacement: '[PROTOCOLO]',
      description: 'Remove protocolos e números de distribuição'
    },
    // Assinaturas digitais
    {
      name: 'digital_stamps',
      regex: /(?:assinado\s+digitalmente|certificado\s+digital|documento\s+assinado)[\s\S]{0,200}(?:em\s+\d{2}\/\d{2}\/\d{4})/gi,
      replacement: '[ASSINATURA_DIGITAL]',
      description: 'Comprime assinaturas e carimbos digitais'
    }
  ];

  private generalNoisePatterns: NoisePattern[] = [
    // Espaços excessivos
    {
      name: 'excessive_whitespace',
      regex: /\s{3,}/g,
      replacement: ' ',
      description: 'Normaliza espaços em branco excessivos'
    },
    // Quebras de linha excessivas
    {
      name: 'excessive_line_breaks',
      regex: /\n{3,}/g,
      replacement: '\n\n',
      description: 'Normaliza quebras de linha excessivas'
    }
  ];

  /**
   * Extrai o primeiro número CNJ válido encontrado no texto
   */
  extractProcessNumber(text: string): string | null {
    try {
      // Primeiro, tentar formato padrão CNJ
      const standardMatch = text.match(this.CNJ_REGEX);
      if (standardMatch && standardMatch.length > 0) {
        return standardMatch[0];
      }

      // Tentar formato antigo
      const oldMatch = text.match(this.CNJ_OLD_REGEX);
      if (oldMatch && oldMatch.length > 0) {
        return oldMatch[0];
      }

      // Tentar com normalização de espaços
      const normalizedText = text.replace(/\s+/g, '');
      const normalizedMatch = normalizedText.match(this.CNJ_REGEX);
      if (normalizedMatch && normalizedMatch.length > 0) {
        return normalizedMatch[0];
      }

      return null;

    } catch (error) {
      console.error(`${ICONS.ERROR} Erro ao extrair número CNJ:`, error);
      return null;
    }
  }

  /**
   * Limpa e normaliza texto de documento jurídico
   */
  cleanLegalDocument(text: string): {
    cleanedText: string;
    originalLength: number;
    cleanedLength: number;
    reductionPercentage: number;
    patternsRemoved: string[];
    confidence: number;
  } {
    const originalLength = text.length;
    let cleanedText = text;
    const patternsRemoved: string[] = [];

    try {
      // Aplicar apenas padrões seguros primeiro

      // 1. Remover cabeçalhos TRIBUNAL DE JUSTIÇA
      const tribunalRegex = /^\s*TRIBUNAL\s+DE\s+JUSTIÇA[^\n]*\n?/gmi;
      if (tribunalRegex.test(cleanedText)) {
        cleanedText = cleanedText.replace(tribunalRegex, '');
        patternsRemoved.push('legal_headers_expanded');
      }

      // 2. Remover numeração de páginas
      const pageRegex1 = /---?\s*Página\s+\d+\s+de\s+\d+\s*---?/gi;
      const pageRegex2 = /^\s*Página\s+\d+\s+de\s+\d+\s*$/gmi;

      if (pageRegex1.test(cleanedText) || pageRegex2.test(cleanedText)) {
        cleanedText = cleanedText.replace(pageRegex1, '');
        cleanedText = cleanedText.replace(pageRegex2, '');
        patternsRemoved.push('page_numbers');
      }

      // 3. Normalizar espaços
      cleanedText = cleanedText.replace(/\s{3,}/g, ' ');
      if (cleanedText !== text && !patternsRemoved.includes('excessive_whitespace')) {
        patternsRemoved.push('excessive_whitespace');
      }

      // 4. Normalizar quebras de linha
      cleanedText = cleanedText.replace(/\n{3,}/g, '\n\n');
      if (cleanedText !== text && !patternsRemoved.includes('excessive_line_breaks')) {
        patternsRemoved.push('excessive_line_breaks');
      }

      // 5. Limpeza final suave
      cleanedText = cleanedText.trim();

      const cleanedLength = cleanedText.length;
      const reductionPercentage = originalLength > 0
        ? Math.round(((originalLength - cleanedLength) / originalLength) * 100)
        : 0;

      const confidence = this.calculateConfidence(reductionPercentage, patternsRemoved.length);

      return {
        cleanedText,
        originalLength,
        cleanedLength,
        reductionPercentage,
        patternsRemoved,
        confidence
      };

    } catch (error) {
      console.error(`${ICONS.ERROR} Erro na limpeza do documento:`, error);

      return {
        cleanedText: text,
        originalLength,
        cleanedLength: text.length,
        reductionPercentage: 0,
        patternsRemoved: [],
        confidence: 0.5
      };
    }
  }

  /**
   * Calcula confiança do processo de limpeza
   */
  private calculateConfidence(reductionPercentage: number, patternsCount: number): number {
    let confidence = 0.8; // Confiança base

    // Ajustar baseado na redução
    if (reductionPercentage > 50) {
      confidence -= 0.2;
    } else if (reductionPercentage > 30) {
      confidence -= 0.1;
    }

    // Aumentar baseado nos padrões encontrados
    confidence += patternsCount * 0.05;

    return Math.max(0, Math.min(1, confidence));
  }
}