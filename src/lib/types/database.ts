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

import type { Decimal, InputJsonValue } from '@prisma/client/runtime/library';

// Re-export InputJsonValue for use throughout the codebase
export type { InputJsonValue };

// ================================================================
// LOCAL ENUM DEFINITIONS (Prisma Client fallback)
// ================================================================
// These enums are defined locally because Prisma Client generation
// failed. They mirror the exact enums from schema.prisma.

/* eslint-disable no-unused-vars */
export enum TimelineSource {
  DOCUMENT_UPLOAD = 'DOCUMENT_UPLOAD',
  API_JUDIT = 'API_JUDIT',
  MANUAL_ENTRY = 'MANUAL_ENTRY',
  SYSTEM_IMPORT = 'SYSTEM_IMPORT',
  AI_EXTRACTION = 'AI_EXTRACTION'
}

export enum EventRelationType {
  DUPLICATE = 'DUPLICATE',
  ENRICHMENT = 'ENRICHMENT',
  RELATED = 'RELATED',
  CONFLICT = 'CONFLICT'
}

export enum CreditCategory {
  REPORT = 'REPORT',
  FULL = 'FULL'
}

export enum JobStatus {
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

export enum AudienceType {
  CLIENTE = 'CLIENTE',
  DIRETORIA = 'DIRETORIA',
  USO_INTERNO = 'USO_INTERNO'
}

export enum OutputFormat {
  PDF = 'PDF',
  DOCX = 'DOCX'
}

export enum AlertSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

// ================================================================
// ADDITIONAL ENUM DEFINITIONS (from schema.prisma)
// ================================================================
// All remaining enums needed by the application

export enum Plan {
  FREE = 'FREE',
  STARTER = 'STARTER',
  PROFESSIONAL = 'PROFESSIONAL',
}

export enum Status {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  DELETED = 'DELETED',
}

export enum Role {
  ADMIN = 'ADMIN',
  USER = 'USER',
  VIEWER = 'VIEWER',
}

export enum WorkspaceRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
  VIEWER = 'VIEWER',
}

export enum ClientType {
  INDIVIDUAL = 'INDIVIDUAL',
  COMPANY = 'COMPANY',
  GOVERNMENT = 'GOVERNMENT',
  NGO = 'NGO',
}

export enum CaseType {
  CIVIL = 'CIVIL',
  CRIMINAL = 'CRIMINAL',
  LABOR = 'LABOR',
  FAMILY = 'FAMILY',
  COMMERCIAL = 'COMMERCIAL',
  ADMINISTRATIVE = 'ADMINISTRATIVE',
  CONSTITUTIONAL = 'CONSTITUTIONAL',
  TAX = 'TAX',
  OTHER = 'OTHER',
}

export enum CaseStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  CLOSED = 'CLOSED',
  ARCHIVED = 'ARCHIVED',
  CANCELLED = 'CANCELLED',
  UNASSIGNED = 'UNASSIGNED',
}

export enum Priority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum FeeType {
  FIXED = 'FIXED',
  HOURLY = 'HOURLY',
  SUCCESS_FEE = 'SUCCESS_FEE',
  MIXED = 'MIXED',
}

export enum EventType {
  NOTE = 'NOTE',
  CALL = 'CALL',
  MEETING = 'MEETING',
  EMAIL = 'EMAIL',
  DOCUMENT_RECEIVED = 'DOCUMENT_RECEIVED',
  DOCUMENT_SENT = 'DOCUMENT_SENT',
  DOCUMENT_UPDATED = 'DOCUMENT_UPDATED',
  DOCUMENT_DELETED = 'DOCUMENT_DELETED',
  HEARING = 'HEARING',
  DEADLINE = 'DEADLINE',
  PAYMENT = 'PAYMENT',
  OTHER = 'OTHER',
}

export enum DocumentType {
  CONTRACT = 'CONTRACT',
  PETITION = 'PETITION',
  MOTION = 'MOTION',
  EVIDENCE = 'EVIDENCE',
  CORRESPONDENCE = 'CORRESPONDENCE',
  COURT_ORDER = 'COURT_ORDER',
  JUDGMENT = 'JUDGMENT',
  APPEAL = 'APPEAL',
  AGREEMENT = 'AGREEMENT',
  INVOICE = 'INVOICE',
  OTHER = 'OTHER',
}

export enum ProcessStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum ProcessOnboardingStatus {
  created = 'created',
  previewed = 'previewed',
  enriching = 'enriching',
  enriched = 'enriched',
  analysis_pending = 'analysis_pending',
  analyzed = 'analyzed',
}

export enum AnalysisType {
  GENERAL = 'GENERAL',
  RISK_ASSESSMENT = 'RISK_ASSESSMENT',
  DOCUMENT_REVIEW = 'DOCUMENT_REVIEW',
  CASE_STRATEGY = 'CASE_STRATEGY',
  PRECEDENT_RESEARCH = 'PRECEDENT_RESEARCH',
  CONTRACT_ANALYSIS = 'CONTRACT_ANALYSIS',
  COMPLIANCE_CHECK = 'COMPLIANCE_CHECK',
}

export enum ReportType {
  CASE_SUMMARY = 'CASE_SUMMARY',
  FINANCIAL = 'FINANCIAL',
  PRODUCTIVITY = 'PRODUCTIVITY',
  DEADLINE_ALERTS = 'DEADLINE_ALERTS',
  CUSTOM = 'CUSTOM',
  COMPLETO = 'COMPLETO',
  NOVIDADES = 'NOVIDADES',
}

export enum Frequency {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  BIWEEKLY = 'BIWEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY',
}

export enum CacheType {
  ANALYSIS = 'ANALYSIS',
  DOCUMENT_SUMMARY = 'DOCUMENT_SUMMARY',
  PRECEDENT_SEARCH = 'PRECEDENT_SEARCH',
  RISK_ASSESSMENT = 'RISK_ASSESSMENT',
  CONTRACT_REVIEW = 'CONTRACT_REVIEW',
}

export enum MonitoringStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  STOPPED = 'STOPPED',
  ERROR = 'ERROR',
}

export enum SyncFrequency {
  HOURLY = 'HOURLY',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MANUAL = 'MANUAL',
}

export enum ProcessSource {
  JUDIT_API = 'JUDIT_API',
  CODILO_API = 'CODILO_API',
  MANUAL_INPUT = 'MANUAL_INPUT',
  EXCEL_UPLOAD = 'EXCEL_UPLOAD',
}

export enum ExtractionMethod {
  API = 'API',
  WEB_SCRAPING = 'WEB_SCRAPING',
  MANUAL = 'MANUAL',
}

export enum MovementCategory {
  HEARING = 'HEARING',
  DECISION = 'DECISION',
  PETITION = 'PETITION',
  DOCUMENT_REQUEST = 'DOCUMENT_REQUEST',
  DEADLINE = 'DEADLINE',
  NOTIFICATION = 'NOTIFICATION',
  APPEAL = 'APPEAL',
  SETTLEMENT = 'SETTLEMENT',
  OTHER = 'OTHER',
}

export enum AlertType {
  MOVEMENT = 'MOVEMENT',
  DEADLINE = 'DEADLINE',
  ERROR = 'ERROR',
  SYNC_FAILURE = 'SYNC_FAILURE',
  IMPORTANT_DECISION = 'IMPORTANT_DECISION',
}

export enum SyncType {
  FULL = 'FULL',
  INCREMENTAL = 'INCREMENTAL',
  MANUAL = 'MANUAL',
}

export enum SyncStatus {
  SUCCESS = 'SUCCESS',
  PARTIAL_SUCCESS = 'PARTIAL_SUCCESS',
  FAILED = 'FAILED',
  TIMEOUT = 'TIMEOUT',
}

export enum BatchStatus {
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum SourceSystem {
  PROJURIS = 'PROJURIS',
  LEGAL_ONE = 'LEGAL_ONE',
  ASTREA = 'ASTREA',
  CP_PRO = 'CP_PRO',
  SAJ = 'SAJ',
  ESAJ = 'ESAJ',
  PJE = 'PJE',
  THEMIS = 'THEMIS',
  ADVBOX = 'ADVBOX',
  JUSBRASIL = 'JUSBRASIL',
  UNKNOWN = 'UNKNOWN',
}

export enum ImportStatus {
  ANALYZING = 'ANALYZING',
  MAPPING = 'MAPPING',
  VALIDATING = 'VALIDATING',
  IMPORTING = 'IMPORTING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum ImportedDataType {
  CASE = 'CASE',
  CLIENT = 'CLIENT',
  EVENT = 'EVENT',
  DOCUMENT = 'DOCUMENT',
  LAWYER = 'LAWYER',
  CONTACT = 'CONTACT',
  FINANCIAL = 'FINANCIAL',
  DEADLINE = 'DEADLINE',
  OTHER = 'OTHER',
}

export enum ImportItemStatus {
  IMPORTED = 'IMPORTED',
  UPDATED = 'UPDATED',
  SKIPPED = 'SKIPPED',
  FAILED = 'FAILED',
  DUPLICATE = 'DUPLICATE',
}

export enum SyncMode {
  IMPORT_ONLY = 'IMPORT_ONLY',
  BIDIRECTIONAL = 'BIDIRECTIONAL',
  EXPORT_ONLY = 'EXPORT_ONLY',
}

export enum SyncSchedule {
  MANUAL = 'MANUAL',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  REAL_TIME = 'REAL_TIME',
}

export enum ExecutionStatus {
  AGENDADO = 'AGENDADO',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  FATAL = 'FATAL',
}

export enum LogCategory {
  SYSTEM = 'SYSTEM',
  USER_ACTION = 'USER_ACTION',
  API_CALL = 'API_CALL',
  SYNC = 'SYNC',
  REPORT = 'REPORT',
  AUTH = 'AUTH',
  UPLOAD = 'UPLOAD',
  ANALYSIS = 'ANALYSIS',
  MONITORING = 'MONITORING',
}

export enum CreditAllocationType {
  MONTHLY = 'MONTHLY',
  BONUS = 'BONUS',
  PACK = 'PACK',
}

export enum CreditTransactionType {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT',
}

export enum UsageStatus {
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  INSUFFICIENT_CREDITS = 'INSUFFICIENT_CREDITS',
}

export enum UploadBatchStatus {
  PROCESSING = 'PROCESSING',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum UploadRowStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED',
  CANCELLED = 'CANCELLED',
}

export enum JuditOperationType {
  ONBOARDING = 'ONBOARDING',
  MONITORING_CHECK = 'MONITORING_CHECK',
  ATTACHMENT_FETCH = 'ATTACHMENT_FETCH',
  MANUAL_SEARCH = 'MANUAL_SEARCH',
}

export enum JuditAlertType {
  API_ERROR = 'API_ERROR',
  RATE_LIMIT = 'RATE_LIMIT',
  CIRCUIT_BREAKER = 'CIRCUIT_BREAKER',
  HIGH_COST = 'HIGH_COST',
  TIMEOUT = 'TIMEOUT',
  ATTACHMENT_TRIGGER = 'ATTACHMENT_TRIGGER',
  MONITORING_FAILED = 'MONITORING_FAILED',
}

export enum WebhookDeliveryStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  RETRYING = 'RETRYING',
  SKIPPED = 'SKIPPED',
}

export enum WebhookQueueStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  RETRYING = 'RETRYING',
  SKIPPED = 'SKIPPED',
}

export enum JobExecutionStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  RETRYING = 'RETRYING',
  CANCELLED = 'CANCELLED',
  TIMEOUT = 'TIMEOUT',
}

export enum HealthStatus {
  HEALTHY = 'HEALTHY',
  DEGRADED = 'DEGRADED',
  UNHEALTHY = 'UNHEALTHY',
  UNKNOWN = 'UNKNOWN',
}

// ================================================================
// PRISMA MODEL TYPE ALIASES
// ================================================================
// Fallback type definitions when Prisma Client is not fully generated
// These are minimal interfaces that allow type checking

export type Workspace = Record<string, unknown> & { id: string; name: string; slug: string };
export type User = Record<string, unknown> & { id: string; email: string };
export type UserWorkspace = Record<string, unknown> & { userId: string; workspaceId: string };
export type MonitoredProcess = Record<string, unknown> & { id: string; processNumber: string };
export type ProcessMovement = Record<string, unknown> & { id: string; processId: string };
export type ProcessTimelineEntry = Record<string, unknown> & { id: string; caseId: string };
export type CaseDocument = Record<string, unknown> & { id: string; caseId: string };
export type CaseAnalysisVersion = Record<string, unknown> & { id: string; caseId: string };
export type AnalysisJob = Record<string, unknown> & { id: string; caseAnalysisVersionId: string };
export type SystemImport = Record<string, unknown> & {
  id: string;
  workspaceId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  originalHash: string;
  sourceSystem: string;
  systemVersion: string | null;
  detectedFormat: string | null;
  status: string;
  progress: number;
  columnMapping: unknown;
  dataPreview: unknown;
  validation: unknown;
  totalRows: number;
  processedRows: number;
  successfulRows: number;
  failedRows: number;
  skippedRows: number;
  importedCases: number;
  importedClients: number;
  importedEvents: number;
  importedDocuments: number;
  errors: unknown;
  warnings: unknown;
  summary: unknown;
  importSettings: unknown;
  overwriteData: boolean;
  startedAt: Date;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
export type ImportedDataItem = Record<string, unknown> & { id: string; systemImportId: string };
export type UsageEvent = Record<string, unknown> & { id: string; workspaceId: string };

// ================================================================
// PRISMA OPERATION TYPES
// ================================================================
// Type aliases for Prisma operation types (WhereInput, UpdateInput, etc.)
// These are fallbacks when Prisma Client is not fully generated

// Where Input Types (for filtering)
export type CaseWhereInput = Partial<Record<string, unknown>>;
export type ClientWhereInput = Partial<Record<string, unknown>>;
export type ProcessAlertWhereInput = Partial<Record<string, unknown>>;
export type WorkspaceWhereInput = Partial<Record<string, unknown>>;
export type CaseAnalysisVersionWhereInput = Partial<Record<string, unknown>>;
export type SystemImportWhereInput = Partial<Record<string, unknown>>;

// Update Input Types (for updates)
export type ClientUpdateInput = Partial<Record<string, unknown>>;
export type ProcessTimelineEntryUpdateInput = Partial<Record<string, unknown>>;

// Create Input Types (for creation)
export type ProcessTimelineEntryCreateInput = Record<string, unknown>;
export interface WorkspaceCreateInput {
  name: string;
  slug: string;
  plan?: Plan;
  description?: string | null;
  logoUrl?: string | null;
  settings?: InputJsonValue | null;
  status?: Status;
  users?: {
    create?: {
      userId: string;
      role: string;
      status?: string;
    } | Array<{
      userId: string;
      role: string;
      status?: string;
    }>;
  };
}

// OrderBy Types (for sorting)
export type ProcessAlertOrderByWithRelationInput = Partial<Record<string, 'asc' | 'desc'>>;

// GetPayload Types (for type inference)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type WorkspaceGetPayload<T> = Workspace & Record<string, unknown>;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type UserWorkspaceGetPayload<T> = UserWorkspace & Record<string, unknown>;

// FindMany Args Types
export type CreditTransactionFindManyArgs = {
  where?: Partial<Record<string, unknown>>;
  orderBy?: Partial<Record<string, 'asc' | 'desc'>>;
  skip?: number;
  take?: number;
  include?: Partial<Record<string, boolean>>;
};

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
  _error: string | null;
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
  _error: string | null;
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
 * Standard API _error response
 */
export interface ApiErrorResponse {
  success: false;
  _error: string;
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
