/**
 * ================================================================
 * DATABASE TYPE DEFINITIONS
 * ================================================================
 * Comprehensive TypeScript interfaces derived from Prisma schema.
 * This is the single source of truth for database-related types.
 *
 * Architecture:
 * 1. Domain entities (Workspace, User, Case, Client, etc)
 * 2. JSON field types (for Prisma's Json fields)
 * 3. API integration types (JUDIT, Gemini)
 * 4. Type guards and validators
 * 5. Utility types for common patterns
 *
 * ================================================================
 */

import type { Decimal } from '@prisma/client/runtime/library';
import type {
  Plan,
  Status,
  Role,
  WorkspaceRole,
  ClientType,
  CaseType,
  CaseStatus,
  Priority,
  FeeType,
  EventType,
  DocumentType,
  ProcessStatus,
  ProcessOnboardingStatus,
  AnalysisType,
  ReportType,
  Frequency,
  CacheType,
  MonitoringStatus,
  SyncFrequency,
  ProcessSource,
  ExtractionMethod,
  MovementCategory,
  AlertType,
  SyncType,
  SyncStatus,
  BatchStatus,
  SourceSystem,
  ImportStatus,
  ImportedDataType,
  ImportItemStatus,
  SyncMode,
  SyncSchedule,
  ExecutionStatus,
  LogLevel,
  LogCategory,
  TimelineSource,
  EventRelationType,
  CreditAllocationType,
  CreditTransactionType,
  CreditCategory,
  UsageStatus,
  UploadBatchStatus,
  UploadRowStatus,
  JobStatus,
  AudienceType,
  OutputFormat,
  JuditOperationType,
  JuditAlertType,
  AlertSeverity,
  WebhookDeliveryStatus,
  JobExecutionStatus,
  HealthStatus,
} from '@prisma/client';

// ================================================================
// CORE DOMAIN ENTITIES
// ================================================================

export interface WorkspaceRecord {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  plan: Plan;
  status: Status;
  settings: WorkspaceSettings | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserRecord {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  avatar: string | null;
  role: Role;
  status: Status;
  settings: UserSettings | null;
  supabaseId: string;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}

export interface UserWorkspaceRecord {
  id: string;
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
  status: Status;
  permissions: WorkspacePermissions | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClientRecord {
  id: string;
  workspaceId: string;
  name: string;
  email: string | null;
  phone: string | null;
  document: string | null;
  type: ClientType;
  status: Status;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  country: string;
  notes: string | null;
  metadata: ClientMetadata | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CaseRecord {
  id: string;
  workspaceId: string;
  clientId: string;
  number: string;
  title: string;
  description: string | null;
  type: CaseType;
  status: CaseStatus;
  priority: Priority;
  createdById: string;
  assignedToId: string | null;
  claimValue: Decimal | null;
  fee: Decimal | null;
  feeType: FeeType;
  filingDate: Date | null;
  dueDate: Date | null;
  closedAt: Date | null;
  tags: string[];
  metadata: CaseMetadata | null;
  previewSnapshot: CasePreviewSnapshot | null;
  detectedCnj: string | null;
  firstPageText: string | null;
  onboardingStatus: ProcessOnboardingStatus;
  enrichmentStartedAt: Date | null;
  enrichmentCompletedAt: Date | null;
  previewGeneratedAt: Date | null;
  processoId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CaseDocumentRecord {
  id: string;
  caseId: string;
  name: string;
  originalName: string;
  type: DocumentType;
  mimeType: string;
  size: number;
  url: string;
  path: string;
  pages: number | null;
  extractedText: string | null;
  summary: string | null;
  tags: string[];
  processed: boolean;
  ocrStatus: ProcessStatus;
  textSha: string | null;
  isDuplicate: boolean;
  originalDocumentId: string | null;
  cleanText: string | null;
  textExtractedAt: Date | null;
  analysisVersion: string | null;
  analysisKey: string | null;
  workerId: string | null;
  costEstimate: number | null;
  documentDate: Date | null;
  metadata: DocumentMetadata | null;
  juditAttachmentUrl: string | null;
  sourceOrigin: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CaseAnalysisVersionRecord {
  id: string;
  caseId: string;
  workspaceId: string;
  version: number;
  status: ProcessStatus;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
  aiAnalysis: AiAnalysisData | null;
  analysisType: string;
  confidence: number;
  costEstimate: number;
  extractedData: ExtractedAnalysisData | null;
  metadata: AnalysisMetadata | null;
  modelUsed: string;
  processingTime: number;
  analysisKey: string | null;
}

export interface ProcessTimelineEntryRecord {
  id: string;
  caseId: string;
  contentHash: string;
  eventDate: Date;
  eventType: string;
  description: string;
  normalizedContent: string;
  source: TimelineSource;
  sourceId: string | null;
  metadata: TimelineMetadata | null;
  confidence: number;
  createdAt: Date;
  updatedAt: Date;
  baseEventId: string | null;
  enrichedByIds: string[];
  relationType: EventRelationType | null;
  originalTexts: TimelineOriginalTexts | null;
  contributingSources: TimelineSource[];
  linkedDocumentIds: string[];
  isEnriched: boolean;
  enrichedAt: Date | null;
  enrichmentModel: string | null;
  hasConflict: boolean;
  conflictDetails: TimelineConflictDetails | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
}

export interface MonitoredProcessRecord {
  id: string;
  workspaceId: string;
  caseId: string | null;
  processNumber: string;
  court: string;
  clientName: string;
  processData: ProcessData | null;
  monitoringStatus: MonitoringStatus;
  lastSync: Date | null;
  syncFrequency: SyncFrequency;
  alertsEnabled: boolean;
  alertRecipients: string[];
  source: ProcessSource;
  extractionMethod: ExtractionMethod;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProcessMovementRecord {
  id: string;
  monitoredProcessId: string;
  date: Date;
  type: string;
  description: string;
  category: MovementCategory;
  importance: Priority;
  requiresAction: boolean;
  deadline: Date | null;
  rawData: ProcessMovementRawData | null;
  aiSummary: string | null;
  aiTags: string[];
  read: boolean;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReportScheduleRecord {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  type: ReportType;
  frequency: Frequency;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  time: string | null;
  timezone: string;
  filters: ReportFilters | null;
  recipients: string[];
  enabled: boolean;
  lastRun: Date | null;
  nextRun: Date | null;
  audienceType: AudienceType;
  outputFormats: OutputFormat[];
  processesLimit: number;
  processIds: string[];
  distributionHash: number | null;
  executionWindowStart: string;
  executionWindowEnd: string;
  monthlyQuotaUsed: number;
  lastQuotaReset: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReportExecutionRecord {
  id: string;
  workspaceId: string;
  scheduleId: string | null;
  reportType: ReportType;
  parameters: ReportParameters | null;
  filters: ReportFilters | null;
  recipients: string[];
  status: ExecutionStatus;
  result: ReportExecutionResult | null;
  filePath: string | null;
  fileSize: number | null;
  startedAt: Date;
  completedAt: Date | null;
  duration: number | null;
  tokensUsed: number;
  estimatedCost: Decimal | null;
  error: string | null;
  retryCount: number;
  audienceType: AudienceType;
  outputFormats: OutputFormat[];
  processCount: number;
  cacheKey: string | null;
  cacheHit: boolean;
  quotaConsumed: number;
  scheduledFor: Date | null;
  fileUrls: FileUrlsData | null;
  lastMovementTimestamp: Date | null;
  deltaDataOnly: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceCreditsRecord {
  id: string;
  workspaceId: string;
  reportCreditsBalance: Decimal;
  fullCreditsBalance: Decimal;
  reportCreditsRolloverCap: Decimal;
  fullCreditsRolloverCap: Decimal;
  createdAt: Date;
  updatedAt: Date;
}

export interface AnalysisJobRecord {
  id: string;
  processId: string;
  workspaceId: string;
  analysisKey: string;
  status: JobStatus;
  lockToken: string | null;
  lockAcquiredAt: Date | null;
  lockExpiresAt: Date | null;
  analysisType: AnalysisType;
  modelHint: string;
  filesMetadata: FileMetadata[];
  progress: number;
  resultVersionId: string | null;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  workerId: string | null;
  retryCount: number;
  metadata: JobMetadata | null;
}

// ================================================================
// JSON FIELD TYPES
// ================================================================

/**
 * Workspace settings - flexible JSON structure
 */
export interface WorkspaceSettings {
  defaultReportTemplate?: string;
  notificationPreferences?: {
    emailAlerts?: boolean;
    slackAlerts?: boolean;
    channelId?: string;
  };
  [key: string]: unknown;
}

/**
 * User preferences and settings
 */
export interface UserSettings {
  theme?: 'light' | 'dark';
  language?: string;
  notifications?: {
    emailDigest?: boolean;
    frequency?: 'daily' | 'weekly';
  };
  [key: string]: unknown;
}

/**
 * Workspace permissions structure
 */
export interface WorkspacePermissions {
  canManageUsers?: boolean;
  canManageReports?: boolean;
  canAccessBilling?: boolean;
  canManageIntegrations?: boolean;
  customPermissions?: Record<string, boolean>;
}

/**
 * Client metadata structure
 */
export interface ClientMetadata {
  customFields?: Record<string, unknown>;
  sourceSystem?: string;
  externalId?: string;
  [key: string]: unknown;
}

/**
 * Case metadata structure
 */
export interface CaseMetadata {
  jurisdiction?: string;
  customFields?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Case preview snapshot from first analysis
 */
export interface CasePreviewSnapshot {
  summary?: string;
  keyDates?: Array<{
    date: string;
    description: string;
  }>;
  parties?: string[];
  mainIssues?: string[];
  [key: string]: unknown;
}

/**
 * Document metadata structure
 */
export interface DocumentMetadata {
  ocr_confidence?: number;
  language?: string;
  tags?: string[];
  customData?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * AI Analysis data structure
 */
export interface AiAnalysisData {
  summary?: string;
  riskAssessment?: {
    level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    factors: string[];
  };
  recommendations?: string[];
  keyFindings?: string[];
  [key: string]: unknown;
}

/**
 * Extracted structured analysis data
 */
export interface ExtractedAnalysisData {
  parties?: string[];
  jurisdiction?: string;
  caseType?: string;
  estimatedValue?: number;
  deadlines?: Array<{
    date: string;
    description: string;
  }>;
  [key: string]: unknown;
}

/**
 * Analysis metadata
 */
export interface AnalysisMetadata {
  analysisTime?: number;
  modelVersion?: string;
  customMetadata?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Timeline entry metadata
 */
export interface TimelineMetadata {
  extractionConfidence?: number;
  sourceDocument?: string;
  customData?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Original texts from different sources for timeline entry
 */
export interface TimelineOriginalTexts {
  [source: string]: string;
}

/**
 * Conflict details for timeline entry
 */
export interface TimelineConflictDetails {
  type: string;
  sources: string[];
  details: Record<string, unknown>;
}

/**
 * Process data from JUDIT API
 */
export interface ProcessData {
  numeroCnj?: string;
  tribunal?: string;
  assunto?: string;
  partes?: string[];
  status?: string;
  ultimaMovimentacao?: string;
  [key: string]: unknown;
}

/**
 * Process movement raw data
 */
export interface ProcessMovementRawData {
  originalText?: string;
  sourceData?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Report filters
 */
export interface ReportFilters {
  caseTypes?: CaseType[];
  statuses?: CaseStatus[];
  priorities?: Priority[];
  dateRange?: {
    from: string;
    to: string;
  };
  customFilters?: Record<string, unknown>;
}

/**
 * Report parameters
 */
export interface ReportParameters {
  includeFinancial?: boolean;
  includeTimeline?: boolean;
  includeDocuments?: boolean;
  customParams?: Record<string, unknown>;
}

/**
 * Report execution result
 */
export interface ReportExecutionResult {
  summary?: string;
  processedCount?: number;
  errors?: string[];
  [key: string]: unknown;
}

/**
 * File URLs data
 */
export interface FileUrlsData {
  pdf?: string;
  docx?: string;
  excel?: string;
}

/**
 * File metadata for analysis jobs
 */
export interface FileMetadata {
  name: string;
  size: number;
  type: string;
  uploadedAt?: string;
}

/**
 * Job metadata
 */
export interface JobMetadata {
  retryReason?: string;
  customData?: Record<string, unknown>;
}

// ================================================================
// JUDIT API INTEGRATION TYPES
// ================================================================

export interface JuditOnboardingPayload {
  search: {
    search_type: 'lawsuit_cnj';
    search_key: string;
    on_demand: boolean;
  };
  with_attachments: boolean;
}

export interface JuditOnboardingResponse {
  request_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  [key: string]: unknown;
}

export interface JuditStatusResponse {
  request_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  [key: string]: unknown;
}

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

// ================================================================
// BULLMQ & REDIS CACHE TYPES
// ================================================================

export interface BullMQJobData {
  caseId: string;
  workspaceId: string;
  analysisType: AnalysisType;
  [key: string]: unknown;
}

export interface CacheValue<T> {
  data: T;
  expiresAt: number;
  version: number;
}

export interface RedisCacheOptions {
  ttl: number; // in seconds
  compress?: boolean;
}

// ================================================================
// TYPE GUARDS
// ================================================================

/**
 * Type guard for WorkspaceRecord
 */
export function isWorkspaceRecord(value: unknown): value is WorkspaceRecord {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.slug === 'string' &&
    obj.createdAt instanceof Date &&
    obj.updatedAt instanceof Date
  );
}

/**
 * Type guard for UserRecord
 */
export function isUserRecord(value: unknown): value is UserRecord {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.email === 'string' &&
    typeof obj.supabaseId === 'string' &&
    typeof obj.emailVerified === 'boolean'
  );
}

/**
 * Type guard for CaseRecord
 */
export function isCaseRecord(value: unknown): value is CaseRecord {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.number === 'string' &&
    typeof obj.title === 'string' &&
    typeof obj.workspaceId === 'string'
  );
}

/**
 * Type guard for CaseDocumentRecord
 */
export function isCaseDocumentRecord(value: unknown): value is CaseDocumentRecord {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.caseId === 'string' &&
    typeof obj.url === 'string' &&
    typeof obj.path === 'string'
  );
}

/**
 * Type guard for AiAnalysisData
 */
export function isAiAnalysisData(value: unknown): value is AiAnalysisData {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    (obj.summary === undefined || typeof obj.summary === 'string') &&
    (obj.keyFindings === undefined || Array.isArray(obj.keyFindings)) &&
    (obj.recommendations === undefined || Array.isArray(obj.recommendations))
  );
}

/**
 * Type guard for JuditResponseData
 */
export function isJuditResponseData(value: unknown): value is JuditResponseData {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    (obj.classifications === undefined || Array.isArray(obj.classifications)) &&
    (obj.subjects === undefined || Array.isArray(obj.subjects)) &&
    (obj.phase === undefined || typeof obj.phase === 'string')
  );
}

/**
 * Type guard for BullMQJobData
 */
export function isBullMQJobData(value: unknown): value is BullMQJobData {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.caseId === 'string' &&
    typeof obj.workspaceId === 'string'
  );
}

// ================================================================
// UTILITY TYPES
// ================================================================

/**
 * Optional fields of a type
 */
export type Nullable<T> = {
  [K in keyof T]: T[K] | null;
};

/**
 * Readonly version of a type
 */
export type Readonly<T> = {
  readonly [K in keyof T]: T[K];
};

/**
 * Partial fields of a type
 */
export type PartialRecord<T> = Partial<T>;

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

/**
 * Standard API error response
 */
export interface ApiErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: unknown;
}

/**
 * Standard API success response
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

/**
 * Union type for API responses
 */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// ================================================================
// EXPORTS
// ================================================================

export const DatabaseTypes = {
  isWorkspaceRecord,
  isUserRecord,
  isCaseRecord,
  isCaseDocumentRecord,
  isAiAnalysisData,
  isJuditResponseData,
  isBullMQJobData,
};
