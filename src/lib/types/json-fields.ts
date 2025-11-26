/**
 * ================================================================
 * JSON FIELD TYPES - Prisma JSON Field Definitions
 * ================================================================
 * Central type definitions for all Prisma JSON fields.
 * Provides type-safe alternatives to Record<string, unknown>.
 */

// ================================================================
// WORKSPACE & USER SETTINGS
// ================================================================

export interface WorkspaceSettings {
  defaultReportTemplate?: string;
  notificationPreferences?: {
    email?: boolean;
    slack?: boolean;
    webhook?: boolean;
  };
  themePreference?: 'light' | 'dark' | 'system';
  language?: string;
  timezone?: string;
  [key: string]: unknown;
}

export interface UserSettings {
  emailNotifications?: boolean;
  displayName?: string;
  avatar?: string;
  preferences?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface UserWorkspacePermissions {
  canViewCases?: boolean;
  canCreateCases?: boolean;
  canEditCases?: boolean;
  canDeleteCases?: boolean;
  canManageUsers?: boolean;
  canViewReports?: boolean;
  canGenerateReports?: boolean;
  canConfigureWorkspace?: boolean;
  customPermissions?: Record<string, boolean>;
  [key: string]: unknown;
}

// ================================================================
// CASE & DOCUMENT METADATA
// ================================================================

export interface CaseMetadata {
  jurisdiction?: string;
  courtLevel?: string;
  judge?: string;
  customFields?: Record<string, unknown>;
  tags?: string[];
  [key: string]: unknown;
}

export interface CasePreviewSnapshot {
  extractedText?: string;
  summary?: string;
  keyDates?: Array<{ date: string; description: string }>;
  detectedEntities?: {
    parties?: string[];
    dates?: string[];
    amounts?: string[];
  };
  [key: string]: unknown;
}

export interface DocumentMetadata {
  extractionDate?: string;
  extractionQuality?: 'high' | 'medium' | 'low';
  pageCount?: number;
  language?: string;
  detector?: {
    detectedType?: string;
    confidence?: number;
  };
  ocrMetadata?: {
    engine?: string;
    accuracy?: number;
  };
  [key: string]: unknown;
}

// ================================================================
// TIMELINE & ANALYSIS
// ================================================================

export interface TimelineMetadata {
  sources?: Array<{
    source: string;
    date?: string;
    description?: string;
  }>;
  enrichmentInfo?: {
    enrichedBy?: string;
    enrichmentDate?: string;
  };
  confidence?: number;
  [key: string]: unknown;
}

export interface TimelineConflictDetails {
  type: 'date_mismatch' | 'description_mismatch' | 'source_conflict' | 'other';
  sources: string[];
  conflictingData?: Record<string, unknown>;
  severity?: 'low' | 'medium' | 'high';
  notes?: string;
  [key: string]: unknown;
}

export interface TimelineOriginalTexts {
  [source: string]: string;
}

export interface AnalysisMetadata {
  modelVersion?: string;
  confidence?: number;
  processingTimeMs?: number;
  tokenUsage?: {
    prompt?: number;
    completion?: number;
    total?: number;
  };
  cost?: number;
  [key: string]: unknown;
}

export interface AIAnalysisData {
  identificacao_basica?: Record<string, unknown>;
  partes_envolvidas?: Record<string, unknown>;
  valores_financeiros?: Record<string, unknown>;
  campos_especializados?: Record<string, unknown>;
  situacao_processual?: Record<string, unknown>;
  analise_estrategica?: Record<string, unknown>;
  documentos_relacionados?: Record<string, unknown>;
  metadados_analise?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ExtractedAnalysisData {
  processNumber?: string;
  courtCode?: string;
  caseType?: string;
  status?: string;
  parties?: string[];
  values?: {
    claimed?: number;
    estimated?: number;
  };
  [key: string]: unknown;
}

// ================================================================
// REPORT & EXECUTION DATA
// ================================================================

export interface ReportFilters {
  caseStatus?: string[];
  caseType?: string[];
  priority?: string[];
  dateRange?: {
    startDate?: string;
    endDate?: string;
  };
  customFilters?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ReportParameters {
  reportType?: string;
  format?: 'PDF' | 'DOCX';
  includeCharts?: boolean;
  includeMetrics?: boolean;
  customization?: {
    headerText?: string;
    footerText?: string;
    logoUrl?: string;
  };
  [key: string]: unknown;
}

export interface ReportResult {
  summary?: string;
  totalRecords?: number;
  generatedAt?: string;
  sections?: Array<{
    name: string;
    content?: string;
  }>;
  metrics?: Record<string, number | string>;
  [key: string]: unknown;
}

export interface ReportFileUrls {
  pdf?: string;
  docx?: string;
  xlsx?: string;
  [key: string]: string | undefined;
}

export interface CachedReportData {
  reportType?: string;
  summary?: string;
  sections?: Array<{
    name: string;
    data?: unknown;
  }>;
  generatedAt?: string;
  lastMovementTimestamp?: string;
  [key: string]: unknown;
}

// ================================================================
// IMPORT & SYSTEM DATA
// ================================================================

export interface SystemImportColumnMapping {
  sourceColumn?: string;
  targetField?: string;
  dataType?: string;
  required?: boolean;
  [key: string]: unknown;
}

export interface SystemImportDataPreview {
  rows?: Array<Record<string, unknown>>;
  totalRows?: number;
  [key: string]: unknown;
}

export interface SystemImportValidation {
  valid?: boolean;
  errors?: Array<{
    row?: number;
    field?: string;
    _error: string;
  }>;
  warnings?: Array<{
    row?: number;
    field?: string;
    warning: string;
  }>;
  [key: string]: unknown;
}

export interface SystemImportErrors {
  [key: string]: string | string[];
}

export interface SystemImportWarnings {
  [key: string]: string | string[];
}

export interface SystemImportSummary {
  totalRows?: number;
  successfulRows?: number;
  failedRows?: number;
  skippedRows?: number;
  importedCases?: number;
  importedClients?: number;
  importedEvents?: number;
  importedDocuments?: number;
  [key: string]: unknown;
}

export interface SystemImportSettings {
  overwriteData?: boolean;
  skipDuplicates?: boolean;
  dateFormat?: string;
  currency?: string;
  [key: string]: unknown;
}

export interface ImportedDataOriginal {
  [key: string]: unknown;
}

export interface ImportedDataMapped {
  caseNumber?: string;
  clientName?: string;
  eventDate?: string;
  description?: string;
  [key: string]: unknown;
}

export interface ImportItemValidationErrors {
  [key: string]: string[];
}

export interface ImportItemWarnings {
  [key: string]: string[];
}

// ================================================================
// MONITORING & PROCESS DATA
// ================================================================

export interface MonitoredProcessData {
  processNumber?: string;
  courtCode?: string;
  status?: string;
  lastMovementDate?: string;
  parties?: string[];
  judge?: string;
  movements?: Array<{
    date: string;
    type: string;
    description: string;
  }>;
  [key: string]: unknown;
}

export interface ProcessMovementRawData {
  type?: string;
  date?: string;
  description?: string;
  source?: string;
  originalId?: string;
  [key: string]: unknown;
}

// ================================================================
// BATCH & UPLOAD DATA
// ================================================================

export interface UploadBatchErrors {
  [key: string]: string | string[];
}

export interface UploadBatchSummary {
  totalRows?: number;
  successfulRows?: number;
  failedRows?: number;
  skippedRows?: number;
  duration?: number;
  startedAt?: string;
  completedAt?: string;
  [key: string]: unknown;
}

export interface UploadBatchConfig {
  fileType?: string;
  delimiter?: string;
  encoding?: string;
  skipHeaderRow?: boolean;
  [key: string]: unknown;
}

export interface UploadBatchRowData {
  [key: string]: unknown;
}

export interface UploadBatchRowErrorMessage {
  field?: string;
  _error: string;
  [key: string]: unknown;
}

export interface UploadBatchEventPayload {
  eventType?: string;
  rowIndex?: number;
  data?: Record<string, unknown>;
  _error?: string;
  [key: string]: unknown;
}

// ================================================================
// CREDIT & USAGE DATA
// ================================================================

export interface CreditTransactionMetadata {
  sourceId?: string;
  sourceType?: string;
  description?: string;
  relatedEntity?: {
    type?: string;
    id?: string;
  };
  [key: string]: unknown;
}

export interface UsageEventMetadata {
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  customData?: Record<string, unknown>;
  [key: string]: unknown;
}

// ================================================================
// TEMPLATE & CUSTOMIZATION DATA
// ================================================================

export interface SystemMappingColumnMappings {
  [sourceField: string]: {
    targetField?: string;
    dataType?: string;
    transform?: string;
  };
}

export interface SystemMappingFieldMappings {
  [key: string]: unknown;
}

export interface SystemMappingTransformRules {
  [key: string]: unknown;
}

export interface SystemSyncSettings {
  syncMode?: 'IMPORT_ONLY' | 'BIDIRECTIONAL' | 'EXPORT_ONLY';
  schedule?: string;
  filterCriteria?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface SystemSyncFilterCriteria {
  [key: string]: unknown;
}

export interface SystemSyncLogErrors {
  [key: string]: string | string[];
}

export interface SystemSyncLogSummary {
  itemsChecked?: number;
  itemsCreated?: number;
  itemsUpdated?: number;
  itemsSkipped?: number;
  itemsFailed?: number;
  duration?: number;
  [key: string]: unknown;
}

export interface ReportTemplateStyles {
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  fontSize?: number;
  customCSS?: string;
  [key: string]: unknown;
}

// ================================================================
// AI CACHE DATA
// ================================================================

export interface AICacheParameters {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  customParameters?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface AICacheResult {
  success?: boolean;
  data?: Record<string, unknown>;
  tokens?: {
    prompt?: number;
    completion?: number;
    total?: number;
  };
  cost?: number;
  [key: string]: unknown;
}

export interface AnalysisCacheResultData {
  summary?: string;
  analysis?: Record<string, unknown>;
  metadata?: {
    modelUsed?: string;
    analysisDate?: string;
  };
  [key: string]: unknown;
}

export interface ReportCacheData {
  sections?: Array<{
    name: string;
    content?: string;
  }>;
  summary?: string;
  generatedAt?: string;
  [key: string]: unknown;
}

// ================================================================
// JUDIT & WEBHOOK DATA
// ================================================================

export interface ProcessoDADOSCompletos {
  numeroCnj?: string;
  dataOnboarding?: string;
  status?: string;
  parties?: string[];
  movements?: unknown[];
  [key: string]: unknown;
}

export interface JuditAlertMetadata {
  numeroCnj?: string;
  requestId?: string;
  trackingId?: string;
  jobId?: string;
  customData?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface WebhookDeliveryPayload {
  eventType?: string;
  processNumber?: string;
  timestamp?: string;
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

// ================================================================
// JOB EXECUTION DATA
// ================================================================

export interface JobExecutionInput {
  jobType?: string;
  parameters?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface JobExecutionOutput {
  success?: boolean;
  result?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

export interface JobExecutionMetrics {
  duration?: number;
  itemsProcessed?: number;
  itemsSuccessful?: number;
  itemsFailed?: number;
  [key: string]: unknown;
}

// ================================================================
// HEALTH & SYSTEM MONITORING
// ================================================================

export interface SystemHealthMetricMetadata {
  component?: string;
  details?: Record<string, unknown>;
  [key: string]: unknown;
}

// ================================================================
// WORKSPACE QUOTA
// ================================================================

export interface WorkspaceQuotaOverrideLimits {
  reportsMonthlyLimit?: number;
  reportProcessesLimit?: number;
  customLimits?: Record<string, number>;
  [key: string]: unknown;
}

// ================================================================
// GLOBAL LOG DATA
// ================================================================

export interface GlobalLogData {
  userId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  changes?: Record<string, unknown>;
  context?: Record<string, unknown>;
  [key: string]: unknown;
}
