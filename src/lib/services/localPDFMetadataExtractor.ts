// ================================================================
// LOCAL PDF METADATA EXTRACTOR
// Extrai metadata de documentos PDFs sem chamar serviço externo
// ================================================================

import { ICONS } from '@/lib/icons';
import { log, logError } from '@/lib/services/logger';

// ================================================================
// TYPES
// ================================================================

export interface PDFMetadata {
  documentDate?: Date;
  documentType: string;
  documentTypeCategory: 'PETITION' | 'DECISION' | 'MOVEMENT' | 'EVIDENCE' | 'OTHER';
  parties?: string[];
  judge?: string;
  court?: string;
  courtLevel?: 'FIRST' | 'SECOND' | 'SUPERIOR' | 'STF' | 'UNKNOWN';
  description: string;
  keyNumbers?: {
    processNumber?: string;
    judicialSegment?: string;
    tribunal?: string;
    origin?: string;
    year?: string;
  };
  confidence: number; // 0 a 1
}

interface DateExtractionResult {
  date?: Date;
  pattern: string;
  confidence: number;
}

// ================================================================
// DATE EXTRACTION
// ================================================================

/**
 * Extrai datas do texto do documento
 * Procura por padrões comuns em documentos brasileiros
 */
function extractDatesFromText(text: string): DateExtractionResult[] {
  const results: DateExtractionResult[] = [];

  if (!text || text.length < 10) {
    return results;
  }

  // Padrão brasileiro: dd/mm/yyyy ou dd de mês de yyyy
  const datePatterns = [
    // dd/mm/yyyy
    {
      regex: /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g,
      parser: (match: string) => {
        const parts = match.split('/');
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]);
        const year = parseInt(parts[2]);

        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          return new Date(year, month - 1, day);
        }
        return null;
      },
      pattern: 'DD/MM/YYYY',
      confidence: 0.95,
    },
    // dd de mês de yyyy
    {
      regex:
        /\b(\d{1,2})\s+de\s+(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+(\d{4})\b/gi,
      parser: (match: string) => {
        const months: Record<string, number> = {
          janeiro: 0,
          fevereiro: 1,
          março: 2,
          abril: 3,
          maio: 4,
          junho: 5,
          julho: 6,
          agosto: 7,
          setembro: 8,
          outubro: 9,
          novembro: 10,
          dezembro: 11,
        };

        const parts = match.toLowerCase().split(' de ');
        const day = parseInt(parts[0]);
        const month = months[parts[1]];
        const year = parseInt(parts[2]);

        if (month !== undefined && day >= 1 && day <= 31) {
          return new Date(year, month, day);
        }
        return null;
      },
      pattern: 'DD de MÊS de YYYY',
      confidence: 0.9,
    },
  ];

  // Executar cada padrão
  for (const { regex, parser, pattern, confidence } of datePatterns) {
    let match;
    const localRegex = new RegExp(regex);

    while ((match = localRegex.exec(text)) !== null) {
      try {
        const date = parser(match[0]);
        if (date && date instanceof Date && !isNaN(date.getTime())) {
          // Validar se a data é razoável (não futura, não muito antiga)
          const now = new Date();
          if (date < new Date(1950, 0, 1) || date > now) {
            continue;
          }

          results.push({
            date,
            pattern,
            confidence,
          });
        }
      } catch {
        // Skip invalid matches
      }
    }
  }

  return results;
}

/**
 * Extrai a data mais provável do documento
 * Prioriza datas no início do documento
 */
function extractPrimaryDocumentDate(text: string): Date | undefined {
  const dates = extractDatesFromText(text);

  if (dates.length === 0) {
    return undefined;
  }

  // Priorizar primeira data encontrada (geralmente a mais relevante)
  // ou datas recentes (última data é frequentemente a data do documento)
  const firstDate = dates[0];
  const lastDate = dates[dates.length - 1];

  // Se as datas são recentes e próximas, usar a última
  if (dates.length >= 2) {
    const timeDiff = Math.abs(lastDate.date!.getTime() - firstDate.date!.getTime());
    const oneMonth = 30 * 24 * 60 * 60 * 1000;

    if (timeDiff < oneMonth) {
      return lastDate.date;
    }
  }

  return firstDate.date;
}

// ================================================================
// DOCUMENT TYPE CLASSIFICATION
// ================================================================

/**
 * Classifica o tipo de documento baseado em padrões de texto e nome
 */
function classifyDocumentType(
  text: string,
  fileName: string
): { type: string; category: PDFMetadata['documentTypeCategory']; confidence: number } {
  const lowerText = text.toLowerCase();
  const lowerFileName = fileName.toLowerCase();

  // Palavras-chave por tipo de documento
  const typePatterns: Record<
    string,
    { keywords: string[]; category: PDFMetadata['documentTypeCategory']; weight: number }
  > = {
    // PETIÇÕES
    PETIÇÃO_INICIAL: {
      keywords: ['petição inicial', 'initial petition', 'causa de pedir', 'fundamentação'],
      category: 'PETITION',
      weight: 1.0,
    },
    PETIÇÃO_INTERMEDIÁRIA: {
      keywords: [
        'petição',
        'requerimento',
        'request',
        'postulamos',
        'venho respeitosamente',
      ],
      category: 'PETITION',
      weight: 0.7,
    },

    // CONTESTAÇÃO / DEFESA
    CONTESTAÇÃO: {
      keywords: ['contestação', 'contestation', 'defesa', 'defense', 'nega'],
      category: 'PETITION',
      weight: 0.95,
    },

    // DESPACHOS / DECISÕES
    DESPACHO: {
      keywords: [
        'despacho',
        'dispatch',
        'determinações',
        'determino',
        'ordeno',
        'decisões interlocutórias',
      ],
      category: 'DECISION',
      weight: 0.95,
    },
    DECISÃO: {
      keywords: ['decision', 'decisão', 'resolvido', 'resolved', 'acordão', 'acórdão'],
      category: 'DECISION',
      weight: 0.9,
    },
    SENTENÇA: {
      keywords: ['sentença', 'sentence', 'condemned', 'condenado', 'absolvido'],
      category: 'DECISION',
      weight: 1.0,
    },

    // ANDAMENTOS
    MANDADO: {
      keywords: ['mandado', 'mandate', 'cumprimento', 'citação'],
      category: 'MOVEMENT',
      weight: 0.9,
    },
    CITAÇÃO: {
      keywords: ['citação', 'citation', 'cite-se', 'citado'],
      category: 'MOVEMENT',
      weight: 0.9,
    },
    INTIMAÇÃO: {
      keywords: ['intimação', 'intimation', 'intimado', 'intima-se'],
      category: 'MOVEMENT',
      weight: 0.85,
    },
    JUNTADA: {
      keywords: ['juntada', 'junta-se', 'acostado', 'anexado', 'documento acostado'],
      category: 'MOVEMENT',
      weight: 0.8,
    },

    // PROVAS / DOCUMENTOS
    PROVA: {
      keywords: ['prova', 'evidence', 'documento', 'anexado', 'comprobante'],
      category: 'EVIDENCE',
      weight: 0.7,
    },
    PARECER: {
      keywords: ['parecer', 'opinion', 'parecer jurídico', 'legal opinion'],
      category: 'EVIDENCE',
      weight: 0.85,
    },
  };

  // Contar ocorrências de palavras-chave
  let bestMatch = { type: 'OTHER', category: 'OTHER' as PDFMetadata['documentTypeCategory'], confidence: 0.3 };

  for (const [type, { keywords, category, weight }] of Object.entries(typePatterns)) {
    let score = 0;
    const textLength = lowerText.length;

    for (const keyword of keywords) {
      const occurrences = (lowerText.match(new RegExp(keyword, 'g')) || []).length;
      score += (occurrences / (textLength / 1000)) * weight;
    }

    // Bonus se encontrado no nome do arquivo
    if (keywords.some((k) => lowerFileName.includes(k))) {
      score *= 1.5;
    }

    if (score > bestMatch.confidence) {
      bestMatch = { type, category, confidence: Math.min(score, 0.99) };
    }
  }

  return bestMatch;
}

// ================================================================
// KEY INFORMATION EXTRACTION
// ================================================================

/**
 * Extrai informações-chave do documento
 */
function extractKeyInformation(text: string): Partial<PDFMetadata> {
  const result: Partial<PDFMetadata> = {};

  // Extrair processo (NNNNNNNDDAAOORTTJSS)
  const processMatch = text.match(/\b(\d{7})(\d{2})(\d{4})(\d{1})(\d{2})(\d{4})\b/);
  if (processMatch) {
    result.keyNumbers = result.keyNumbers || {};
    result.keyNumbers.processNumber = `${processMatch[1]}-${processMatch[2]}.${processMatch[3]}.${processMatch[4]}.${processMatch[5]}.${processMatch[6]}`;
    result.keyNumbers.year = processMatch[3];
    result.keyNumbers.tribunal = processMatch[5];
  }

  // Extrair nomes de partes (padrão: "Autor:" ou "Réu:")
  const partyPatterns = [
    /(?:Autor|Autora|Autores|Plaintiff)[\s:]+([^\n]+)/i,
    /(?:Réu|Ré|Defendant)[\s:]+([^\n]+)/i,
    /(?:Agravante|Agravado)[\s:]+([^\n]+)/i,
  ];

  result.parties = [];
  for (const pattern of partyPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const party = match[1]
        .trim()
        .split(/[\n,]/)[0]
        .substring(0, 100);
      if (!result.parties.includes(party)) {
        result.parties.push(party);
      }
    }
  }

  if (result.parties.length === 0) {
    delete result.parties;
  }

  // Extrair nome do juiz
  const judgePatterns = [
    /(?:Juiz|Judge|Desembargador|Justice)[\s:]+([A-Z][A-Za-z\s]+)/i,
    /Sentenciante[\s:]+([A-Z][A-Za-z\s]+)/i,
  ];

  for (const pattern of judgePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      result.judge = match[1]
        .trim()
        .substring(0, 150);
      break;
    }
  }

  // Determinar nível de tribunal baseado em palavras-chave
  type CourtLevel = NonNullable<PDFMetadata['courtLevel']>;
  const courtLevelPatterns: Record<CourtLevel, RegExp[]> = {
    STF: [/supremo\s+tribunal\s+federal|stf/i],
    SUPERIOR: [/superior\s+tribunal|stj|oab/i],
    SECOND: [/tribunal\s+de\s+justiça|desembargador/i, /second\s+instance/i],
    FIRST: [/primeira\s+instância|juizado/i, /first\s+instance/i],
    UNKNOWN: [],
  };

  for (const [level, patterns] of Object.entries(courtLevelPatterns)) {
    if (level === 'UNKNOWN') continue;
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        result.courtLevel = level as PDFMetadata['courtLevel'];
        break;
      }
    }
    if (result.courtLevel) break;
  }

  if (!result.courtLevel) {
    result.courtLevel = 'UNKNOWN';
  }

  return result;
}

// ================================================================
// MAIN EXTRACTOR
// ================================================================

/**
 * Extrai metadata completa de um documento PDF
 * Baseado em texto extraído anteriormente
 */
export async function extractPDFMetadata(
  text: string,
  fileName: string
): Promise<PDFMetadata> {
  try {
    log.info({ msg: '[PDF Metadata] Extraindo metadata de:' });

    const metadata: PDFMetadata = {
      documentDate: extractPrimaryDocumentDate(text),
      documentType: 'UNKNOWN',
      documentTypeCategory: 'OTHER',
      description: '',
      confidence: 0.5,
      ...extractKeyInformation(text),
    };

    // Classificar tipo de documento
    const { type, category, confidence } = classifyDocumentType(text, fileName);
    metadata.documentType = type;
    metadata.documentTypeCategory = category;
    metadata.confidence = confidence;

    // Gerar descrição
    const description: string[] = [];
    if (metadata.documentType !== 'OTHER') {
      description.push(`Tipo: ${metadata.documentType}`);
    }
    if (metadata.documentDate) {
      description.push(`Data: ${metadata.documentDate.toLocaleDateString('pt-BR')}`);
    }
    if (metadata.parties && metadata.parties.length > 0) {
      description.push(`Partes: ${metadata.parties.slice(0, 2).join(', ')}`);
    }
    if (metadata.judge) {
      description.push(`Juiz: ${metadata.judge}`);
    }

    metadata.description = description.join(' | ');

    console.log(`${ICONS.SUCCESS} [PDF Metadata] Metadata extraída:`, {
      documentType: metadata.documentType,
      documentDate: metadata.documentDate?.toISOString(),
      confidence: metadata.confidence,
      courtLevel: metadata.courtLevel,
    });

    return metadata;
  } catch (error) {
    logError(_error, '${ICONS.ERROR} PDF Metadata Erro ao extrair metadata:', { component: 'refactored' });

    // Retornar metadata mínima em caso de erro
    return {
      documentType: 'UNKNOWN',
      documentTypeCategory: 'OTHER',
      description: `Documento: ${fileName}`,
      confidence: 0.1,
      courtLevel: 'UNKNOWN',
    };
  }
}
