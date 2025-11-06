/**
 * ================================================================
 * TYPE GUARDS - Runtime validators for JSON field types
 * ================================================================
 * Provides runtime type checking functions (type guards and predicates)
 * for validating Prisma JSON fields at runtime.
 */

import type {
  AnalysisMetadata,
  AIAnalysisData,
  CaseMetadata,
  ExtractedAnalysisData,
  TimelineMetadata,
  DocumentMetadata,
} from './json-fields';

/**
 * Check if a value is a valid AnalysisMetadata
 */
export function isAnalysisMetadata(value: unknown): value is AnalysisMetadata {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // Optional fields with type checking
  if (obj.modelVersion !== undefined && typeof obj.modelVersion !== 'string') {
    return false;
  }

  if (obj.confidence !== undefined && typeof obj.confidence !== 'number') {
    return false;
  }

  if (obj.processingTimeMs !== undefined && typeof obj.processingTimeMs !== 'number') {
    return false;
  }

  if (obj.cost !== undefined && typeof obj.cost !== 'number') {
    return false;
  }

  // Validate tokenUsage if present
  if (obj.tokenUsage !== undefined) {
    if (typeof obj.tokenUsage !== 'object' || obj.tokenUsage === null) {
      return false;
    }
    const tokens = obj.tokenUsage as Record<string, unknown>;
    if (tokens.prompt !== undefined && typeof tokens.prompt !== 'number') return false;
    if (tokens.completion !== undefined && typeof tokens.completion !== 'number') return false;
    if (tokens.total !== undefined && typeof tokens.total !== 'number') return false;
  }

  return true;
}

/**
 * Check if a value is valid AIAnalysisData
 */
export function isAIAnalysisData(value: unknown): value is AIAnalysisData {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // All fields are optional Record<string, unknown>, so we just check the object shape
  const validKeys = [
    'identificacao_basica',
    'partes_envolvidas',
    'valores_financeiros',
    'campos_especializados',
    'situacao_processual',
    'analise_estrategica',
    'documentos_relacionados',
    'metadados_analise',
  ];

  // Check that all present keys are either valid or unknown extensions
  for (const key of Object.keys(obj)) {
    const field = obj[key];
    // All fields should be either object/Record or undefined
    if (field !== undefined && field !== null && typeof field !== 'object') {
      return false;
    }
  }

  return true;
}

/**
 * Check if a value is valid CaseMetadata
 */
export function isCaseMetadata(value: unknown): value is CaseMetadata {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  if (obj.jurisdiction !== undefined && typeof obj.jurisdiction !== 'string') {
    return false;
  }

  if (obj.courtLevel !== undefined && typeof obj.courtLevel !== 'string') {
    return false;
  }

  if (obj.judge !== undefined && typeof obj.judge !== 'string') {
    return false;
  }

  if (obj.tags !== undefined) {
    if (!Array.isArray(obj.tags)) {
      return false;
    }
    if (!obj.tags.every((tag) => typeof tag === 'string')) {
      return false;
    }
  }

  if (obj.customFields !== undefined) {
    if (typeof obj.customFields !== 'object' || obj.customFields === null) {
      return false;
    }
  }

  return true;
}

/**
 * Check if a value is valid ExtractedAnalysisData
 */
export function isExtractedAnalysisData(value: unknown): value is ExtractedAnalysisData {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  if (obj.processNumber !== undefined && typeof obj.processNumber !== 'string') {
    return false;
  }

  if (obj.courtCode !== undefined && typeof obj.courtCode !== 'string') {
    return false;
  }

  if (obj.caseType !== undefined && typeof obj.caseType !== 'string') {
    return false;
  }

  if (obj.status !== undefined && typeof obj.status !== 'string') {
    return false;
  }

  if (obj.parties !== undefined) {
    if (!Array.isArray(obj.parties)) {
      return false;
    }
    if (!obj.parties.every((party) => typeof party === 'string')) {
      return false;
    }
  }

  if (obj.values !== undefined) {
    if (typeof obj.values !== 'object' || obj.values === null) {
      return false;
    }
    const values = obj.values as Record<string, unknown>;
    if (values.claimed !== undefined && typeof values.claimed !== 'number') return false;
    if (values.estimated !== undefined && typeof values.estimated !== 'number') return false;
  }

  return true;
}

/**
 * Check if a value is valid TimelineMetadata
 */
export function isTimelineMetadata(value: unknown): value is TimelineMetadata {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  if (obj.confidence !== undefined && typeof obj.confidence !== 'number') {
    return false;
  }

  if (obj.sources !== undefined) {
    if (!Array.isArray(obj.sources)) {
      return false;
    }
    for (const source of obj.sources) {
      if (typeof source !== 'object' || source === null) {
        return false;
      }
      const src = source as Record<string, unknown>;
      if (typeof src.source !== 'string') return false;
      if (src.date !== undefined && typeof src.date !== 'string') return false;
      if (src.description !== undefined && typeof src.description !== 'string') return false;
    }
  }

  if (obj.enrichmentInfo !== undefined) {
    if (typeof obj.enrichmentInfo !== 'object' || obj.enrichmentInfo === null) {
      return false;
    }
    const enrichment = obj.enrichmentInfo as Record<string, unknown>;
    if (enrichment.enrichedBy !== undefined && typeof enrichment.enrichedBy !== 'string') return false;
    if (enrichment.enrichmentDate !== undefined && typeof enrichment.enrichmentDate !== 'string') return false;
  }

  return true;
}

/**
 * Check if a value is valid DocumentMetadata
 */
export function isDocumentMetadata(value: unknown): value is DocumentMetadata {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  if (obj.extractionDate !== undefined && typeof obj.extractionDate !== 'string') {
    return false;
  }

  if (obj.extractionQuality !== undefined) {
    const validQualities = ['high', 'medium', 'low'];
    if (!validQualities.includes(obj.extractionQuality as string)) {
      return false;
    }
  }

  if (obj.pageCount !== undefined && typeof obj.pageCount !== 'number') {
    return false;
  }

  if (obj.language !== undefined && typeof obj.language !== 'string') {
    return false;
  }

  if (obj.detector !== undefined) {
    if (typeof obj.detector !== 'object' || obj.detector === null) {
      return false;
    }
    const detector = obj.detector as Record<string, unknown>;
    if (detector.detectedType !== undefined && typeof detector.detectedType !== 'string') return false;
    if (detector.confidence !== undefined && typeof detector.confidence !== 'number') return false;
  }

  if (obj.ocrMetadata !== undefined) {
    if (typeof obj.ocrMetadata !== 'object' || obj.ocrMetadata === null) {
      return false;
    }
    const ocr = obj.ocrMetadata as Record<string, unknown>;
    if (ocr.engine !== undefined && typeof ocr.engine !== 'string') return false;
    if (ocr.accuracy !== undefined && typeof ocr.accuracy !== 'number') return false;
  }

  return true;
}

/**
 * Safe JSON parser that validates the result against a type guard
 */
export function parseJsonWithGuard<T>(
  jsonString: unknown,
  typeGuard: (value: unknown) => value is T,
): T | null {
  if (typeof jsonString === 'string') {
    try {
      const parsed = JSON.parse(jsonString);
      if (typeGuard(parsed)) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }

  // Already an object, validate with type guard
  if (typeGuard(jsonString)) {
    return jsonString as T;
  }

  return null;
}

/**
 * Create a validated metadata object, throwing on validation failure
 */
export function createAnalysisMetadata(data: unknown): AnalysisMetadata {
  if (!isAnalysisMetadata(data)) {
    throw new Error('Invalid AnalysisMetadata: failed type validation');
  }
  return data;
}

/**
 * Create a validated AIAnalysisData object, throwing on validation failure
 */
export function createAIAnalysisData(data: unknown): AIAnalysisData {
  if (!isAIAnalysisData(data)) {
    throw new Error('Invalid AIAnalysisData: failed type validation');
  }
  return data;
}

/**
 * Create a validated CaseMetadata object, throwing on validation failure
 */
export function createCaseMetadata(data: unknown): CaseMetadata {
  if (!isCaseMetadata(data)) {
    throw new Error('Invalid CaseMetadata: failed type validation');
  }
  return data;
}

/**
 * Create a validated ExtractedAnalysisData object, throwing on validation failure
 */
export function createExtractedAnalysisData(data: unknown): ExtractedAnalysisData {
  if (!isExtractedAnalysisData(data)) {
    throw new Error('Invalid ExtractedAnalysisData: failed type validation');
  }
  return data;
}
