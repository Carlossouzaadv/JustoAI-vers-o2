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
  SystemImportColumnMapping,
  SystemImportDataPreview,
  SystemImportValidation,
  SystemImportSummary,
  SystemImportSettings,
  ImportedDataOriginal,
  ImportedDataMapped,
  TimelineConflictDetails,
  TimelineOriginalTexts,
  CreditTransactionMetadata,
  UsageEventMetadata,
  ReportParameters,
  ReportResult,
  ReportFileUrls,
  CachedReportData,
  ReportFilters,
  MonitoredProcessData,
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

/**
 * Check if a value is valid TimelineConflictDetails
 */
export function isTimelineConflictDetails(value: unknown): value is TimelineConflictDetails {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // 'type' is required
  const validTypes = ['date_mismatch', 'description_mismatch', 'source_conflict', 'other'];
  if (!validTypes.includes(obj.type as string)) {
    return false;
  }

  // 'sources' is required and must be array of strings
  if (!Array.isArray(obj.sources) || !obj.sources.every((s) => typeof s === 'string')) {
    return false;
  }

  // Optional fields validation
  if (obj.severity !== undefined) {
    const validSeverities = ['low', 'medium', 'high'];
    if (!validSeverities.includes(obj.severity as string)) {
      return false;
    }
  }

  if (obj.notes !== undefined && typeof obj.notes !== 'string') {
    return false;
  }

  if (obj.conflictingData !== undefined && typeof obj.conflictingData !== 'object') {
    return false;
  }

  return true;
}

/**
 * Check if a value is valid TimelineOriginalTexts
 */
export function isTimelineOriginalTexts(value: unknown): value is TimelineOriginalTexts {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // All keys should map to strings (source -> original text)
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] !== 'string') {
      return false;
    }
  }

  return true;
}

/**
 * Timeline metadata with sources array for merge tracking
 */
export interface TimelineSourceMetadata {
  source: string;
  date: Date | string;
  description?: string;
}

/**
 * Check if an object is a valid source in timeline metadata
 */
export function isTimelineSourceMetadata(value: unknown): value is TimelineSourceMetadata {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  if (typeof obj.source !== 'string') {
    return false;
  }

  if (!(obj.date instanceof Date || typeof obj.date === 'string')) {
    return false;
  }

  if (obj.description !== undefined && typeof obj.description !== 'string') {
    return false;
  }

  return true;
}

/**
 * Validates that a metadata object from timeline merge has correct sources array structure
 */
export function isTimelineMergedMetadata(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // Check sources array if present
  if (obj.sources !== undefined) {
    if (!Array.isArray(obj.sources)) {
      return false;
    }
    // Each source should be a valid TimelineSourceMetadata-like object
    for (const source of obj.sources) {
      if (!isTimelineSourceMetadata(source)) {
        return false;
      }
    }
  }

  // lastMerged should be ISO string if present
  if (obj.lastMerged !== undefined && typeof obj.lastMerged !== 'string') {
    return false;
  }

  return true;
}

// ================================================================
// SYSTEM IMPORT TYPE GUARDS
// ================================================================

/**
 * Check if a value is a valid SystemImportColumnMapping
 */
export function isSystemImportColumnMapping(value: unknown): value is SystemImportColumnMapping {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  if (obj.sourceColumn !== undefined && typeof obj.sourceColumn !== 'string') {
    return false;
  }

  if (obj.targetField !== undefined && typeof obj.targetField !== 'string') {
    return false;
  }

  if (obj.dataType !== undefined && typeof obj.dataType !== 'string') {
    return false;
  }

  if (obj.required !== undefined && typeof obj.required !== 'boolean') {
    return false;
  }

  return true;
}

/**
 * Check if a value is a valid SystemImportDataPreview
 */
export function isSystemImportDataPreview(value: unknown): value is SystemImportDataPreview {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  if (obj.totalRows !== undefined && typeof obj.totalRows !== 'number') {
    return false;
  }

  if (obj.rows !== undefined) {
    if (!Array.isArray(obj.rows)) {
      return false;
    }
    for (const row of obj.rows) {
      if (typeof row !== 'object' || row === null) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Check if a value is a valid SystemImportValidation
 */
export function isSystemImportValidation(value: unknown): value is SystemImportValidation {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  if (obj.valid !== undefined && typeof obj.valid !== 'boolean') {
    return false;
  }

  if (obj.errors !== undefined) {
    if (!Array.isArray(obj.errors)) {
      return false;
    }
    for (const error of obj.errors) {
      if (typeof error !== 'object' || error === null) {
        return false;
      }
      const err = error as Record<string, unknown>;
      if (typeof err.error !== 'string') {
        return false;
      }
    }
  }

  if (obj.warnings !== undefined) {
    if (!Array.isArray(obj.warnings)) {
      return false;
    }
    for (const warning of obj.warnings) {
      if (typeof warning !== 'object' || warning === null) {
        return false;
      }
      const warn = warning as Record<string, unknown>;
      if (typeof warn.warning !== 'string') {
        return false;
      }
    }
  }

  return true;
}

/**
 * Check if a value is a valid SystemImportSummary
 */
export function isSystemImportSummary(value: unknown): value is SystemImportSummary {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  if (obj.totalRows !== undefined && typeof obj.totalRows !== 'number') {
    return false;
  }

  if (obj.successfulRows !== undefined && typeof obj.successfulRows !== 'number') {
    return false;
  }

  if (obj.failedRows !== undefined && typeof obj.failedRows !== 'number') {
    return false;
  }

  if (obj.skippedRows !== undefined && typeof obj.skippedRows !== 'number') {
    return false;
  }

  if (obj.importedCases !== undefined && typeof obj.importedCases !== 'number') {
    return false;
  }

  if (obj.importedClients !== undefined && typeof obj.importedClients !== 'number') {
    return false;
  }

  if (obj.importedEvents !== undefined && typeof obj.importedEvents !== 'number') {
    return false;
  }

  if (obj.importedDocuments !== undefined && typeof obj.importedDocuments !== 'number') {
    return false;
  }

  return true;
}

/**
 * Check if a value is a valid SystemImportSettings
 */
export function isSystemImportSettings(value: unknown): value is SystemImportSettings {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  if (obj.overwriteData !== undefined && typeof obj.overwriteData !== 'boolean') {
    return false;
  }

  if (obj.skipDuplicates !== undefined && typeof obj.skipDuplicates !== 'boolean') {
    return false;
  }

  if (obj.dateFormat !== undefined && typeof obj.dateFormat !== 'string') {
    return false;
  }

  if (obj.currency !== undefined && typeof obj.currency !== 'string') {
    return false;
  }

  return true;
}

/**
 * Check if a value is a valid ImportedDataMapped
 */
export function isImportedDataMapped(value: unknown): value is ImportedDataMapped {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  if (obj.caseNumber !== undefined && typeof obj.caseNumber !== 'string') {
    return false;
  }

  if (obj.clientName !== undefined && typeof obj.clientName !== 'string') {
    return false;
  }

  if (obj.eventDate !== undefined && typeof obj.eventDate !== 'string') {
    return false;
  }

  if (obj.description !== undefined && typeof obj.description !== 'string') {
    return false;
  }

  return true;
}

/**
 * Check if a value is a valid CreditTransactionMetadata
 */
export function isCreditTransactionMetadata(value: unknown): value is CreditTransactionMetadata {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  if (obj.sourceId !== undefined && typeof obj.sourceId !== 'string') {
    return false;
  }

  if (obj.sourceType !== undefined && typeof obj.sourceType !== 'string') {
    return false;
  }

  if (obj.description !== undefined && typeof obj.description !== 'string') {
    return false;
  }

  if (obj.relatedEntity !== undefined) {
    if (typeof obj.relatedEntity !== 'object' || obj.relatedEntity === null) {
      return false;
    }
    const entity = obj.relatedEntity as Record<string, unknown>;
    if (entity.type !== undefined && typeof entity.type !== 'string') return false;
    if (entity.id !== undefined && typeof entity.id !== 'string') return false;
  }

  return true;
}

/**
 * Check if a value is a valid UsageEventMetadata
 */
export function isUsageEventMetadata(value: unknown): value is UsageEventMetadata {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  if (obj.userId !== undefined && typeof obj.userId !== 'string') {
    return false;
  }

  if (obj.ipAddress !== undefined && typeof obj.ipAddress !== 'string') {
    return false;
  }

  if (obj.userAgent !== undefined && typeof obj.userAgent !== 'string') {
    return false;
  }

  if (obj.customData !== undefined) {
    if (typeof obj.customData !== 'object' || obj.customData === null) {
      return false;
    }
  }

  return true;
}

// ================================================================
// REPORT TYPE GUARDS
// ================================================================

/**
 * Check if a value is a valid ReportFilters
 */
export function isReportFilters(value: unknown): value is ReportFilters {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  if (obj.caseStatus !== undefined) {
    if (!Array.isArray(obj.caseStatus) || !obj.caseStatus.every((s) => typeof s === 'string')) {
      return false;
    }
  }

  if (obj.caseType !== undefined) {
    if (!Array.isArray(obj.caseType) || !obj.caseType.every((t) => typeof t === 'string')) {
      return false;
    }
  }

  if (obj.priority !== undefined) {
    if (!Array.isArray(obj.priority) || !obj.priority.every((p) => typeof p === 'string')) {
      return false;
    }
  }

  if (obj.dateRange !== undefined) {
    if (typeof obj.dateRange !== 'object' || obj.dateRange === null) {
      return false;
    }
    const dateRange = obj.dateRange as Record<string, unknown>;
    if (dateRange.startDate !== undefined && typeof dateRange.startDate !== 'string') return false;
    if (dateRange.endDate !== undefined && typeof dateRange.endDate !== 'string') return false;
  }

  if (obj.customFilters !== undefined && typeof obj.customFilters !== 'object') {
    return false;
  }

  return true;
}

/**
 * Check if a value is a valid ReportParameters
 */
export function isReportParameters(value: unknown): value is ReportParameters {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  if (obj.reportType !== undefined && typeof obj.reportType !== 'string') {
    return false;
  }

  if (obj.format !== undefined) {
    const validFormats = ['PDF', 'DOCX'];
    if (!validFormats.includes(obj.format as string)) {
      return false;
    }
  }

  if (obj.includeCharts !== undefined && typeof obj.includeCharts !== 'boolean') {
    return false;
  }

  if (obj.includeMetrics !== undefined && typeof obj.includeMetrics !== 'boolean') {
    return false;
  }

  if (obj.customization !== undefined) {
    if (typeof obj.customization !== 'object' || obj.customization === null) {
      return false;
    }
    const customization = obj.customization as Record<string, unknown>;
    if (customization.headerText !== undefined && typeof customization.headerText !== 'string') return false;
    if (customization.footerText !== undefined && typeof customization.footerText !== 'string') return false;
    if (customization.logoUrl !== undefined && typeof customization.logoUrl !== 'string') return false;
  }

  return true;
}

/**
 * Check if a value is a valid ReportResult
 */
export function isReportResult(value: unknown): value is ReportResult {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  if (obj.summary !== undefined && typeof obj.summary !== 'string') {
    return false;
  }

  if (obj.totalRecords !== undefined && typeof obj.totalRecords !== 'number') {
    return false;
  }

  if (obj.generatedAt !== undefined && typeof obj.generatedAt !== 'string') {
    return false;
  }

  if (obj.sections !== undefined) {
    if (!Array.isArray(obj.sections)) {
      return false;
    }
    for (const section of obj.sections) {
      if (typeof section !== 'object' || section === null) {
        return false;
      }
      const sec = section as Record<string, unknown>;
      if (typeof sec.name !== 'string') {
        return false;
      }
      if (sec.content !== undefined && typeof sec.content !== 'string') {
        return false;
      }
    }
  }

  if (obj.metrics !== undefined) {
    if (typeof obj.metrics !== 'object' || obj.metrics === null) {
      return false;
    }
    const metrics = obj.metrics as Record<string, unknown>;
    for (const value of Object.values(metrics)) {
      if (typeof value !== 'number' && typeof value !== 'string') {
        return false;
      }
    }
  }

  return true;
}

/**
 * Check if a value is a valid ReportFileUrls
 */
export function isReportFileUrls(value: unknown): value is ReportFileUrls {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  if (obj.pdf !== undefined && typeof obj.pdf !== 'string') {
    return false;
  }

  if (obj.docx !== undefined && typeof obj.docx !== 'string') {
    return false;
  }

  if (obj.xlsx !== undefined && typeof obj.xlsx !== 'string') {
    return false;
  }

  // Check that all values are strings
  for (const value of Object.values(obj)) {
    if (value !== undefined && typeof value !== 'string') {
      return false;
    }
  }

  return true;
}

/**
 * Check if a value is a valid CachedReportData
 */
export function isCachedReportData(value: unknown): value is CachedReportData {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  if (obj.reportType !== undefined && typeof obj.reportType !== 'string') {
    return false;
  }

  if (obj.summary !== undefined && typeof obj.summary !== 'string') {
    return false;
  }

  if (obj.generatedAt !== undefined && typeof obj.generatedAt !== 'string') {
    return false;
  }

  if (obj.lastMovementTimestamp !== undefined && typeof obj.lastMovementTimestamp !== 'string') {
    return false;
  }

  if (obj.sections !== undefined) {
    if (!Array.isArray(obj.sections)) {
      return false;
    }
    for (const section of obj.sections) {
      if (typeof section !== 'object' || section === null) {
        return false;
      }
      const sec = section as Record<string, unknown>;
      if (typeof sec.name !== 'string') {
        return false;
      }
      if (sec.data !== undefined && typeof sec.data !== 'object' && sec.data !== null) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Check if a value is a valid MonitoredProcessData
 */
export function isMonitoredProcessData(value: unknown): value is MonitoredProcessData {
  if (value === null) {
    // null is allowed (optional field)
    return true;
  }

  if (typeof value !== 'object') {
    return false;
  }

  const obj = value as Record<string, unknown>;

  if (obj.processNumber !== undefined && typeof obj.processNumber !== 'string') {
    return false;
  }

  if (obj.courtCode !== undefined && typeof obj.courtCode !== 'string') {
    return false;
  }

  if (obj.status !== undefined && typeof obj.status !== 'string') {
    return false;
  }

  if (obj.lastMovementDate !== undefined && typeof obj.lastMovementDate !== 'string') {
    return false;
  }

  if (obj.judge !== undefined && typeof obj.judge !== 'string') {
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

  if (obj.movements !== undefined) {
    if (!Array.isArray(obj.movements)) {
      return false;
    }
    // Each movement is allowed to be unknown (flexible structure)
  }

  return true;
}

// ================================================================
// ERROR HANDLING UTILITIES
// ================================================================

/**
 * Safe extraction of error message from unknown error objects
 * Used in catch blocks to handle both Error instances and generic objects
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (typeof error === 'object' && error !== null) {
    const obj = error as Record<string, unknown>;
    if (typeof obj.message === 'string') {
      return obj.message;
    }
    if (typeof obj.error === 'string') {
      return obj.error;
    }
  }
  return String(error);
}

/**
 * Check if a value is a Gemini API error response structure
 */
export function isGeminiErrorResponse(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // Gemini API returns errors in either { error: { message, details } } or { error: string } format
  if (obj.error !== undefined) {
    if (typeof obj.error === 'string') {
      return true;
    }
    if (typeof obj.error === 'object' && obj.error !== null) {
      const err = obj.error as Record<string, unknown>;
      // error.message is optional but if present should be string
      if (err.message !== undefined && typeof err.message !== 'string') {
        return false;
      }
      // error.details is optional but if present should be string
      if (err.details !== undefined && typeof err.details !== 'string') {
        return false;
      }
      return true;
    }
  }

  return false;
}

// ================================================================
// PDF PROCESSOR TYPE GUARDS
// ================================================================

/**
 * Check if a value is a valid PDFData structure
 */
export function isPDFData(value: unknown): value is { text: string; numpages: number; info: Record<string, unknown>; metadata: Record<string, unknown> } {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // Required fields
  if (typeof obj.text !== 'string') {
    return false;
  }

  if (typeof obj.numpages !== 'number') {
    return false;
  }

  if (typeof obj.info !== 'object' || obj.info === null) {
    return false;
  }

  if (typeof obj.metadata !== 'object' || obj.metadata === null) {
    return false;
  }

  return true;
}

/**
 * Check if a value is a valid Railway PDF processor response
 */
export function isRailwayPdfResponse(value: unknown): value is {
  originalText: string;
  cleanedText: string;
  processNumber?: string;
  metrics: { extractionTimeMs: number };
} {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // Required fields
  if (typeof obj.originalText !== 'string') {
    return false;
  }

  if (typeof obj.cleanedText !== 'string') {
    return false;
  }

  // metrics is required
  if (typeof obj.metrics !== 'object' || obj.metrics === null) {
    return false;
  }

  const metrics = obj.metrics as Record<string, unknown>;
  if (typeof metrics.extractionTimeMs !== 'number') {
    return false;
  }

  // Optional fields
  if (obj.processNumber !== undefined && typeof obj.processNumber !== 'string') {
    return false;
  }

  return true;
}

/**
 * Check if a value is a valid PDF extraction result
 */
export function isPDFExtractionData(value: unknown): value is {
  cleanedText: string;
  originalText?: string;
  text?: string;
  processNumber?: string;
  metrics?: { extractionTimeMs: number };
} {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // At least cleanedText is required
  if (typeof obj.cleanedText !== 'string') {
    // Fallback: try to find text field
    if (typeof obj.text !== 'string') {
      return false;
    }
  }

  // Optional fields validation
  if (obj.originalText !== undefined && typeof obj.originalText !== 'string') {
    return false;
  }

  if (obj.text !== undefined && typeof obj.text !== 'string') {
    return false;
  }

  if (obj.processNumber !== undefined && typeof obj.processNumber !== 'string') {
    return false;
  }

  if (obj.metrics !== undefined) {
    if (typeof obj.metrics !== 'object' || obj.metrics === null) {
      return false;
    }
    const metrics = obj.metrics as Record<string, unknown>;
    if (metrics.extractionTimeMs !== undefined && typeof metrics.extractionTimeMs !== 'number') {
      return false;
    }
  }

  return true;
}
