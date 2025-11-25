/**
 * ================================================================
 * PDF EXTRACTION SERVICE - Gold Standard
 * ================================================================
 * Serviço centralizado para extração e limpeza de texto de PDFs
 *
 * Este é o "Fonte da Verdade Padrão-Ouro" para clean_text no sistema.
 *
 * Mandato Inegociável:
 * - ZERO `any` - Type safety absoluta
 * - ZERO `as` - Use type guards apenas
 * - ZERO `@ts-expect-error` - Resolver tipos corretamente
 */

import { ICONS } from '../icons';
import { log, logError } from '@/lib/services/logger';

// ================================================================
// TIPOS - Padrão-Ouro
// ================================================================

export interface CleaningMetrics {
  originalLength: number;
  cleanedLength: number;
  reductionPercentage: number;
  patternsApplied: string[];
  repetitiveLineRemovalCount: number;
  hyphenReconstructionsCount: number;
  confidence: number;
  processingTimeMs: number;
}

export interface ExtractionResult {
  originalText: string;
  cleanedText: string;
  metrics: CleaningMetrics;
  success: boolean;
  quality: 'high' | 'medium' | 'low';
  processNumber: string | null;
}

// ================================================================
// REGEX PATTERNS - Gold Standard
// ================================================================

const GoldStandardPatterns = {
  // Headers e footers jurídicos
  tribunalHeaders: /^\s*TRIBUNAL\s+DE\s+JUSTIÇA[^\n]*$/gmi,

  // Numeração de páginas (múltiplas variações)
  pageNumbersFormat1: /---?\s*(?:pág\.?|p\.?|page|página|pg)\s*\d+\s*(?:de|of|\/)\s*\d+\s*---?/gi,
  pageNumbersFormat2: /^\s*(?:pág\.?|p\.?|page|página|pg)\s*\d+\s*(?:de|of|\/)\s*\d+\s*$/gmi,
  pageNumbersFormat3: /(?:^|\n)\s*-+\s*\d+\s*-+\s*(?:\n|$)/gi,

  // Data e hora (footers comuns)
  dateTimeFooter: /\d{1,2}\/\d{1,2}\/\d{4}\s+\d{2}:\d{2}:\d{2}/g,

  // Protocolos e números de distribuição
  protocolNumbers: /(?:protocolo|autuado|distribuído|processo)[\s\w]*n[°º]?\s*[\d\.\-\/]+/gi,

  // Assinaturas digitais (compactar)
  digitalSignatures: /(?:assinado\s+digitalmente|certificado\s+digital|documento\s+assinado)[\s\S]{0,200}(?:em\s+\d{2}\/\d{2}\/\d{4})/gi,

  // Linhas separadoras decorativas
  decorativeSeparators: /^[\s\*\-_=]{3,}$/gm,

  // Espaçamento excessivo
  excessiveSpaces: /\s{3,}/g,
  excessiveNewlines: /\n{3,}/g,

  // Caracteres de controle
  controlCharacters: /[\x00-\x1F\x7F]/g,

  // URLs (opcional: pode ser preservado ou removido)
  urls: /https?:\/\/[^\s]+/g,
};

// ================================================================
// EXPORT CLASS - PDFExtractionService
// ================================================================

export class PDFExtractionService {
  private readonly minConfidenceThreshold = 0.5;
  private readonly minTextLength = 50; // Mínimo de chars para considerar como sucesso

  /**
   * Método público: Extrai e limpa texto de PDF bruto
   *
   * @param originalText - Texto bruto extraído do PDF
   * @returns ExtractionResult com clean_text e métricas
   */
  public extractAndClean(originalText: string): ExtractionResult {
    const startTime = Date.now();

    if (!originalText || typeof originalText !== 'string') {
      log.error({ msg: "PDFExtractionService: originalText inválido" });
      return this.createFailureResult(originalText || '');
    }

    try {
      let cleanedText = originalText;
      const appliedPatterns: string[] = [];
      let hyphenReconstructionsCount = 0;
      let repetitiveLineRemovalCount = 0;

      // Etapa 1: Detectar e remover seções repetitivas (rodapés/cabeçalhos)
      const { text: afterRepetitive, removed: repetitiveCount } =
        this.detectRepetitiveSection(cleanedText);
      cleanedText = afterRepetitive;
      repetitiveLineRemovalCount = repetitiveCount;
      appliedPatterns.push('detect_repetitive_sections');

      // Etapa 2: Reconstruir parágrafos (juntar hifens)
      const { text: afterReconstruction, count: reconstructCount } =
        this.reconstructParagraphs(cleanedText);
      cleanedText = afterReconstruction;
      hyphenReconstructionsCount = reconstructCount;
      appliedPatterns.push('reconstruct_paragraphs');

      // Etapa 3: Remover padrões jurídicos específicos
      cleanedText = this.removeHeaders(cleanedText);
      appliedPatterns.push('remove_headers');

      cleanedText = this.removePageNumbers(cleanedText);
      appliedPatterns.push('remove_page_numbers');

      cleanedText = this.removeProtocols(cleanedText);
      appliedPatterns.push('remove_protocols');

      cleanedText = this.removeDigitalSignatures(cleanedText);
      appliedPatterns.push('remove_digital_signatures');

      // Etapa 4: Normalizar espaçamento
      cleanedText = this.normalizeWhitespace(cleanedText);
      appliedPatterns.push('normalize_whitespace');

      // Etapa 5: Limpeza final
      cleanedText = cleanedText.trim();

      // Etapa 6: Extrair número de processo CNJ
      const processNumber = this.extractProcessNumber(cleanedText);

      // Calcular métricas
      const metrics = this.calculateMetrics(
        originalText,
        cleanedText,
        appliedPatterns,
        hyphenReconstructionsCount,
        repetitiveLineRemovalCount,
        Date.now() - startTime
      );

      // Determinar qualidade
      const quality = this.determineQuality(cleanedText, metrics);

      return {
        originalText,
        cleanedText,
        metrics,
        success: cleanedText.length >= this.minTextLength,
        quality,
        processNumber,
      };

    } catch (_error) {
      logError(error, "${ICONS.ERROR} PDFExtractionService erro:", { component: "refactored" });
      return this.createFailureResult(originalText);
    }
  }

  // ================================================================
  // MÉTODO GOLD STANDARD 1: Reconstruir Parágrafos
  // ================================================================

  /**
   * Reconstrói parágrafos que foram quebrados por hifens
   *
   * Problema: PDFs quebram linhas no meio de palavras
   * "Esta é uma sen-"
   * "tença importante"
   *
   * Solução: Detectar hifens finais + próxima linha com lowercase
   * e juntar as linhas
   */
  private reconstructParagraphs(
    text: string
  ): { text: string; count: number } {
    const lines = text.split('\n');
    let reconstructCount = 0;
    const result: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const currentLine = lines[i];
      const nextLine = i + 1 < lines.length ? lines[i + 1] : undefined;

      // Verificar se deve juntar com a próxima linha
      if (nextLine && this.shouldJoinLines(currentLine, nextLine)) {
        // Remover hyphen final e juntar com a próxima
        const joinedLine = currentLine.replace(/-\s*$/, '') + nextLine;
        result.push(joinedLine);
        i++; // Pular a próxima linha pois já foi processada
        reconstructCount++;
      } else {
        result.push(currentLine);
      }
    }

    return {
      text: result.join('\n'),
      count: reconstructCount,
    };
  }

  /**
   * Verifica se duas linhas devem ser juntadas
   */
  private shouldJoinLines(currentLine: string | undefined, nextLine: string | undefined): boolean {
    // Type guard para nextLine
    if (!currentLine || typeof currentLine !== 'string' || !nextLine || typeof nextLine !== 'string') {
      return false;
    }

    const trimmedCurrent = currentLine.trim();
    const trimmedNext = nextLine.trim();

    // Verificações heurísticas
    const currentEndsWithHyphen = /[-–—]\s*$/.test(trimmedCurrent);
    const nextStartsWithLowercase = /^[a-zç]/.test(trimmedNext);
    const bothHaveContent = trimmedCurrent.length > 0 && trimmedNext.length > 0;
    const nextIsNotHeading = !/^[A-Z\d]/.test(trimmedNext) || trimmedNext.includes(' ');

    return currentEndsWithHyphen && nextStartsWithLowercase && bothHaveContent && nextIsNotHeading;
  }

  // ================================================================
  // MÉTODO GOLD STANDARD 2: Detectar Seções Repetitivas
  // ================================================================

  /**
   * Detecta e remove linhas que aparecem com alta frequência
   * (indicativo de rodapés, cabeçalhos ou seções repetitivas)
   *
   * Algoritmo:
   * 1. Contar frequência de cada linha única
   * 2. Definir threshold baseado no número total de linhas
   * 3. Remover linhas que aparecem frequentemente (mas manter uma?)
   */
  private detectRepetitiveSection(
    text: string
  ): { text: string; removed: number } {
    const lines = text.split('\n');

    // Criar mapa de frequência de linhas
    const lineFrequency = new Map<string, number>();

    for (const line of lines) {
      const trimmed = line.trim();

      // Ignorar linhas muito curtas ou vazias
      if (trimmed.length > 10) {
        const count = lineFrequency.get(trimmed) || 0;
        lineFrequency.set(trimmed, count + 1);
      }
    }

    // Calcular threshold para considerar uma linha como "repetitiva"
    // Se uma linha aparece mais de 20% do tempo, é suspeita
    const repetitiveThreshold = Math.max(3, Math.ceil(lines.length / 5));

    // Filtrar linhas
    const filteredLines: string[] = [];
    let removedCount = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      const frequency = lineFrequency.get(trimmed) || 0;

      // Se a linha é muito frequente, removê-la
      if (frequency >= repetitiveThreshold && trimmed.length > 10) {
        removedCount++;
        // Não adiciona a linha ao resultado
      } else {
        filteredLines.push(line);
      }
    }

    return {
      text: filteredLines.join('\n'),
      removed: removedCount,
    };
  }

  // ================================================================
  // MÉTODOS DE LIMPEZA - Padrões Específicos
  // ================================================================

  private removeHeaders(text: string): string {
    return text.replace(GoldStandardPatterns.tribunalHeaders, '');
  }

  private removePageNumbers(text: string): string {
    let result = text
      .replace(GoldStandardPatterns.pageNumbersFormat1, '')
      .replace(GoldStandardPatterns.pageNumbersFormat2, '')
      .replace(GoldStandardPatterns.pageNumbersFormat3, '');

    // Remover também dateTimeFooter que costuma aparecer com números de página
    result = result.replace(GoldStandardPatterns.dateTimeFooter, '');

    return result;
  }

  private removeProtocols(text: string): string {
    return text.replace(GoldStandardPatterns.protocolNumbers, '[PROTOCOLO]');
  }

  private removeDigitalSignatures(text: string): string {
    return text.replace(GoldStandardPatterns.digitalSignatures, '[ASSINATURA_DIGITAL]');
  }

  /**
   * Normaliza espaçamento e remove caracteres de controle
   */
  private normalizeWhitespace(text: string): string {
    return text
      // Remover caracteres de controle
      .replace(GoldStandardPatterns.controlCharacters, '')
      // Remover linhas separadoras decorativas
      .replace(GoldStandardPatterns.decorativeSeparators, '')
      // Normalizar espaços múltiplos
      .replace(GoldStandardPatterns.excessiveSpaces, ' ')
      // Normalizar quebras de linha excessivas
      .replace(GoldStandardPatterns.excessiveNewlines, '\n\n');
  }

  // ================================================================
  // EXTRAIR NÚMERO DE PROCESSO CNJ
  // ================================================================

  private extractProcessNumber(text: string): string | null {
    try {
      // Formato padrão CNJ: NNNNNNN-DD.AAAA.J.TR.OOOO
      const standardMatch = text.match(/\b\d{7}-\d{2}\.\d{4}\.\d{1}\.\d{2}\.\d{4}\b/);
      if (standardMatch && standardMatch[0]) {
        return standardMatch[0];
      }

      // Formato antigo: NNNN.DD.NNNNNN-D
      const oldMatch = text.match(/\b\d{4}\.\d{2}\.\d{6}-\d{1}\b/);
      if (oldMatch && oldMatch[0]) {
        return oldMatch[0];
      }

      return null;
    } catch {
      return null;
    }
  }

  // ================================================================
  // CÁLCULO DE MÉTRICAS
  // ================================================================

  private calculateMetrics(
    originalText: string,
    cleanedText: string,
    appliedPatterns: string[],
    hyphenReconstructionsCount: number,
    repetitiveLineRemovalCount: number,
    processingTimeMs: number
  ): CleaningMetrics {
    const originalLength = originalText.length;
    const cleanedLength = cleanedText.length;
    const reductionPercentage = originalLength > 0
      ? Math.round(((originalLength - cleanedLength) / originalLength) * 100)
      : 0;

    // Calcular confiança
    let confidence = 0.8; // Base

    // Ajustar por redução (não queremos remover demais)
    if (reductionPercentage > 50) {
      confidence -= 0.2;
    } else if (reductionPercentage > 30) {
      confidence -= 0.1;
    }

    // Aumentar por ações bem-sucedidas
    confidence += appliedPatterns.length * 0.05;
    confidence += (hyphenReconstructionsCount > 0 ? 0.05 : 0);
    confidence += (repetitiveLineRemovalCount > 0 ? 0.05 : 0);

    // Clampar entre 0 e 1
    confidence = Math.max(0, Math.min(1, confidence));

    return {
      originalLength,
      cleanedLength,
      reductionPercentage,
      patternsApplied: appliedPatterns,
      repetitiveLineRemovalCount,
      hyphenReconstructionsCount,
      confidence,
      processingTimeMs,
    };
  }

  // ================================================================
  // DETERMINAR QUALIDADE
  // ================================================================

  private determineQuality(
    cleanedText: string,
    metrics: CleaningMetrics
  ): 'high' | 'medium' | 'low' {
    // Alta qualidade: texto suficiente + confiança alta
    if (cleanedText.length >= 1000 && metrics.confidence >= 0.75) {
      return 'high';
    }

    // Qualidade média: texto razoável
    if (cleanedText.length >= 500 && metrics.confidence >= 0.5) {
      return 'medium';
    }

    // Baixa qualidade
    return 'low';
  }

  // ================================================================
  // HELPER: Criar resultado de falha
  // ================================================================

  private createFailureResult(originalText: string): ExtractionResult {
    return {
      originalText,
      cleanedText: originalText,
      metrics: {
        originalLength: originalText.length,
        cleanedLength: originalText.length,
        reductionPercentage: 0,
        patternsApplied: [],
        repetitiveLineRemovalCount: 0,
        hyphenReconstructionsCount: 0,
        confidence: 0.3,
        processingTimeMs: 0,
      },
      success: false,
      quality: 'low',
      processNumber: null,
    };
  }
}
