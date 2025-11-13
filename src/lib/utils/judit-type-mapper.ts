
/**
 * Mapeamento automático de tipos de processos JUDIT para CaseType enum
 *
 * JUDIT retorna tipos em: response_data.classifications[].name
 * Exemplos reais:
 * - "PROCEDIMENTO COMUM CÍVEL"
 * - "PROCEDIMENTO COMUM TRABALHISTA"
 * - "AÇÃO DE EXECUÇÃO"
 * - "AÇÃO PENAL"
 * - "AÇÃO DE FAMÍLIA"
 * - "MANDADO DE SEGURANÇA"
 * - "EXCEÇÃO DE PRÉ-EXECUTIVIDADE"
 *
 * Este arquivo mapeia para CaseType enum:
 * CIVIL, CRIMINAL, LABOR, FAMILY, COMMERCIAL, ADMINISTRATIVE, CONSTITUTIONAL, TAX, OTHER
 */

import { CaseType } from '@/lib/types/database';

// Type definitions for JUDIT API responses
export interface JuditClassification {
  name?: string;
  [key: string]: unknown;
}

export interface JuditResponseData {
  classifications?: JuditClassification[];
  subjects?: Array<{ name?: string; [key: string]: unknown }>;
  phase?: string;
  [key: string]: unknown;
}

export interface GeminiAnalysisData {
  type?: string;
  subject?: string;
  description?: string;
  [key: string]: unknown;
}

// Type guards for JUDIT response structures
function isJuditResponseData(value: unknown): value is JuditResponseData {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    (obj.classifications === undefined || Array.isArray(obj.classifications)) &&
    (obj.subjects === undefined || Array.isArray(obj.subjects)) &&
    (obj.phase === undefined || typeof obj.phase === 'string')
  );
}

function isJuditClassification(value: unknown): value is JuditClassification {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return obj.name === undefined || typeof obj.name === 'string';
}

function isGeminiAnalysisData(value: unknown): value is GeminiAnalysisData {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    (obj.type === undefined || typeof obj.type === 'string') &&
    (obj.subject === undefined || typeof obj.subject === 'string') &&
    (obj.description === undefined || typeof obj.description === 'string')
  );
}

/**
 * Mapeia o tipo de classificação retornado pela JUDIT para o enum CaseType
 * @param juditClassification - String retornada em response_data.classifications[].name
 * @returns CaseType enum value
 */
export function mapJuditClassificationToCaseType(juditClassification: string): CaseType {
  if (!juditClassification) return CaseType.CIVIL; // Default fallback

  const classification = juditClassification.toUpperCase().trim();

  // CÍVEL - Procedimentos civis em geral
  if (
    classification.includes('PROCEDIMENTO COMUM CÍVEL') ||
    classification.includes('CÍVEL') ||
    classification.includes('AÇÃO ORDINÁRIA') ||
    classification.includes('AÇÃO SUMÁRIA') ||
    classification.includes('MANDADO DE SEGURANÇA') ||
    classification.includes('HABEAS CORPUS')
  ) {
    return CaseType.CIVIL;
  }

  // TRABALHISTA - Processos trabalhistas
  if (
    classification.includes('PROCEDIMENTO COMUM TRABALHISTA') ||
    classification.includes('TRABALHISTA') ||
    classification.includes('RECLAMAÇÃO TRABALHISTA')
  ) {
    return CaseType.LABOR;
  }

  // TRIBUTÁRIO / EXECUÇÃO FISCAL - Processos de execução fiscal e tributários
  if (
    classification.includes('EXECUÇÃO FISCAL') ||
    classification.includes('AÇÃO DE EXECUÇÃO FISCAL') ||
    classification.includes('TRIBUTÁRIO') ||
    classification.includes('IMPOSTO') ||
    classification.includes('TAXA')
  ) {
    return CaseType.TAX;
  }

  // PENAL / CRIMINAL - Processos criminais
  if (
    classification.includes('AÇÃO PENAL') ||
    classification.includes('CRIMINAL') ||
    classification.includes('PENAL') ||
    classification.includes('CRIME')
  ) {
    return CaseType.CRIMINAL;
  }

  // FAMÍLIA - Processos de família
  if (
    classification.includes('FAMÍLIA') ||
    classification.includes('DIVÓRCIO') ||
    classification.includes('GUARDA') ||
    classification.includes('PENSÃO') ||
    classification.includes('ALIMENTOS') ||
    classification.includes('SUCESSÃO') ||
    classification.includes('FILIAÇÃO')
  ) {
    return CaseType.FAMILY;
  }

  // COMERCIAL - Processos comerciais
  if (
    classification.includes('COMERCIAL') ||
    classification.includes('FALÊNCIA') ||
    classification.includes('INSOLVÊNCIA') ||
    classification.includes('RECUPERAÇÃO JUDICIAL')
  ) {
    return CaseType.COMMERCIAL;
  }

  // ADMINISTRATIVO - Processos administrativos
  if (
    classification.includes('ADMINISTRATIVO') ||
    classification.includes('AÇÃO ADMINISTRATIVA') ||
    classification.includes('PROCESSO ADMINISTRATIVO')
  ) {
    return CaseType.ADMINISTRATIVE;
  }

  // CONSTITUCIONAL - Ações constitucionais
  if (
    classification.includes('CONSTITUCIONAL') ||
    classification.includes('AÇÃO DIRETA') ||
    classification.includes('ADI') ||
    classification.includes('ADIN') ||
    classification.includes('ADC') ||
    classification.includes('ARGUIÇÃO DE DESCUMPRIMENTO')
  ) {
    return CaseType.CONSTITUTIONAL;
  }

  // Se não conseguir mapear, retorna OTHER
  return CaseType.OTHER;
}

/**
 * Extrai o tipo de processo dos dados completos retornados pela JUDIT
 * @param responseData - Resposta completa da API JUDIT
 * @returns CaseType enum value ou null se não conseguir extrair
 */
export function extractCaseTypeFromJuditResponse(responseData: unknown): CaseType | null {
  if (!responseData || !isJuditResponseData(responseData)) {
    console.warn('[CaseType Mapper] Invalid or missing JUDIT response data');
    return null;
  }

  // Tentar extrair do campo classifications (array)
  if (responseData.classifications && Array.isArray(responseData.classifications)) {
    // Preferir a primeira classificação não vazia
    for (const classification of responseData.classifications) {
      if (isJuditClassification(classification) && classification.name) {
        const mappedType = mapJuditClassificationToCaseType(classification.name);
        console.log(`[CaseType Mapper] Extraído de JUDIT: "${classification.name}" → ${mappedType}`);
        return mappedType;
      }
    }
  }

  // Fallback: tentar extrair do campo phase se existir
  if (responseData.phase && typeof responseData.phase === 'string') {
    const mappedType = mapJuditClassificationToCaseType(responseData.phase);
    if (mappedType !== CaseType.OTHER) {
      console.log(`[CaseType Mapper] Extraído de phase: "${responseData.phase}" → ${mappedType}`);
      return mappedType;
    }
  }

  // Nenhuma classificação encontrada
  console.warn('[CaseType Mapper] Nenhuma classificação encontrada em responseData');
  return null;
}

/**
 * Fallback: Tenta extrair tipo do assunto do processo (subjects)
 * Menos confiável que classifications, mas pode ajudar em casos edge
 */
export function extractCaseTypeFromSubject(responseData: unknown): CaseType | null {
  if (!responseData || !isJuditResponseData(responseData)) {
    return null;
  }

  if (!responseData.subjects || !Array.isArray(responseData.subjects)) {
    return null;
  }

  for (const subject of responseData.subjects) {
    if (typeof subject === 'object' && subject !== null && 'name' in subject) {
      const subjectName = (subject as { name?: unknown }).name;
      if (typeof subjectName === 'string') {
        const mappedType = mapJuditClassificationToCaseType(subjectName);
        if (mappedType !== CaseType.OTHER) {
          console.log(`[CaseType Mapper] Extraído de subject: "${subjectName}" → ${mappedType}`);
          return mappedType;
        }
      }
    }
  }

  return null;
}

/**
 * Fallback com Gemini: Se JUDIT não retornar tipo ou for ambíguo,
 * usa Gemini para analisar o documento e extrair tipo
 *
 * @param documentAnalysis - Análise do documento feita pelo Gemini
 * @returns CaseType ou null se não conseguir determinar
 */
export async function extractCaseTypeFromGeminiAnalysis(
  documentAnalysis: unknown
): Promise<CaseType | null> {
  if (!documentAnalysis || !isGeminiAnalysisData(documentAnalysis)) {
    return null;
  }

  // Se documentAnalysis já tem um campo tipo/type, usar isso
  if (documentAnalysis.type && typeof documentAnalysis.type === 'string') {
    const mappedType = mapJuditClassificationToCaseType(documentAnalysis.type);
    if (mappedType !== CaseType.OTHER) {
      console.log(`[CaseType Mapper] Extraído de Gemini analysis.type: "${documentAnalysis.type}" → ${mappedType}`);
      return mappedType;
    }
  }

  // Se tem um campo "subject" ou "assunto"
  if (documentAnalysis.subject && typeof documentAnalysis.subject === 'string') {
    const mappedType = mapJuditClassificationToCaseType(documentAnalysis.subject);
    if (mappedType !== CaseType.OTHER) {
      console.log(`[CaseType Mapper] Extraído de Gemini analysis.subject: "${documentAnalysis.subject}" → ${mappedType}`);
      return mappedType;
    }
  }

  // Se tem um campo description que mencione o tipo
  if (documentAnalysis.description && typeof documentAnalysis.description === 'string') {
    const mappedType = mapJuditClassificationToCaseType(documentAnalysis.description);
    if (mappedType !== CaseType.OTHER) {
      console.log(`[CaseType Mapper] Extraído de Gemini analysis.description: → ${mappedType}`);
      return mappedType;
    }
  }

  return null;
}
