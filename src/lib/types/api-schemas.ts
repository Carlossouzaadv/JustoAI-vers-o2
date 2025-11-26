// ================================================================
// API ROUTE SCHEMAS - Zod Validation for Request/Response Bodies
// ================================================================
// Central validation schemas for all API route handlers.
// Provides runtime type safety with Zod parsing and type inference.
//
// Usage:
//   const result = CreateProcessPayloadSchema.safeParse(rawBody);
//   if (!result.success) return NextResponse.json({ errors: result.error.flatten() }, { status: 400 });
//   const data = result.data; // 100% type-safe
//
// Pattern: Always use safeParse() to handle validation failures gracefully.

import { z } from 'zod';

// ================================================================
// SHARED SCHEMAS - Reusable types for multiple endpoints
// ================================================================

/**
 * Case Type Enumeration
 * All supported legal case types in JustoAI
 */
export const CaseTypeSchema = z.enum([
  'CIVIL',
  'CRIMINAL',
  'LABOR',
  'FAMILY',
  'TAX',
  'ADMINISTRATIVE',
]);

export type CaseType = z.infer<typeof CaseTypeSchema>;

/**
 * Case Status Enumeration
 * All possible case statuses
 */
export const CaseStatusSchema = z.enum([
  'ACTIVE',
  'SUSPENDED',
  'CLOSED',
  'ARCHIVED',
  'CANCELLED',
]);

export type CaseStatus = z.infer<typeof CaseStatusSchema>;

/**
 * Priority Level Enumeration
 */
export const PriorityLevelSchema = z.enum([
  'LOW',
  'MEDIUM',
  'HIGH',
  'URGENT',
]);

export type PriorityLevel = z.infer<typeof PriorityLevelSchema>;

/**
 * Analysis Level Enumeration
 * FAST: Quick analysis with Gemini Flash (0 credits)
 * FULL: Deep analysis with Gemini Pro (1 credit)
 */
export const AnalysisLevelSchema = z.enum([
  'FAST',
  'FULL',
]);

export type AnalysisLevel = z.infer<typeof AnalysisLevelSchema>;

/**
 * CUID Format Validator
 * Validates CUID format (starts with 'c' followed by 24 alphanumeric chars)
 */
const CuidSchema = z
  .string()
  .regex(/^c[a-z0-9]{24}$/i, 'Invalid CUID format');

/**
 * UUID Format Validator
 */
const UuidSchema = z.string().uuid('Invalid UUID format');

/**
 * ISO 8601 DateTime Validator
 */
const DateTimeSchema = z.string().datetime('Invalid ISO 8601 datetime');

// ================================================================
// PROCESS UPLOAD SCHEMAS
// ================================================================

/**
 * POST /api/process/upload
 * Upload PDF document with automatic process detection
 */
export const ProcessUploadPayloadSchema = z.object({
  workspaceId: CuidSchema,
  manualCnj: z.string().min(20).max(30).optional(),
  clientId: CuidSchema.optional(),
  skipEnrichment: z.boolean().default(false),
  // Note: File is handled by FormData middleware, not validated here
});

export type ProcessUploadPayload = z.infer<typeof ProcessUploadPayloadSchema>;

/**
 * POST /api/process/upload Response
 */
export const ProcessUploadResponseSchema = z.object({
  success: z.boolean(),
  caseId: UuidSchema.optional(),
  caseNumber: z.string().optional(),
  status: z.enum(['created', 'previewed', 'enriching']).optional(),
  detectedCnj: z.string().optional(),
  preview: z.record(z.string(), z.unknown()).optional(),
  analysisModel: z.string().optional(),
  juditJobId: z.string().optional(),
  timing: z.object({
    total: z.number().int().min(0).optional(),
    extraction: z.number().int().min(0).optional(),
    preview: z.number().int().min(0).optional(),
  }).optional(),
  message: z.string().optional(),
}).passthrough();

export type ProcessUploadResponse = z.infer<typeof ProcessUploadResponseSchema>;

// ================================================================
// PROCESS ANALYSIS SCHEMAS
// ================================================================

/**
 * POST /api/process/[id]/analysis
 * Request full legal analysis of a case
 */
export const CreateAnalysisPayloadSchema = z.object({
  level: AnalysisLevelSchema,
  includeDocuments: z.boolean().default(true),
  includeTimeline: z.boolean().default(true),
  workspaceId: CuidSchema,
});

export type CreateAnalysisPayload = z.infer<typeof CreateAnalysisPayloadSchema>;

/**
 * POST /api/process/[id]/analysis Response
 */
export const CreateAnalysisResponseSchema = z.object({
  success: z.boolean(),
  analysisId: UuidSchema.optional(),
  version: z.number().int().min(1).optional(),
  level: AnalysisLevelSchema.optional(),
  model: z.string().optional(),
  estimatedTime: z.string().optional(),
  message: z.string().optional(),
}).passthrough();

export type CreateAnalysisResponse = z.infer<typeof CreateAnalysisResponseSchema>;

/**
 * GET /api/process/[id]/analysis Response
 */
export const GetAnalysisResponseSchema = z.object({
  success: z.boolean(),
  analyses: z.array(z.object({
    id: UuidSchema,
    version: z.number().int().min(1),
    status: z.enum(['PROCESSING', 'COMPLETED', 'FAILED']),
    analysisType: z.string(),
    model: z.string(),
    confidence: z.number().min(0).max(1).optional(),
    summary: z.string().optional(),
    keyPoints: z.array(z.string()).optional(),
    legalAssessment: z.string().optional(),
    riskAssessment: z.string().optional(),
  })).optional(),
  message: z.string().optional(),
}).passthrough();

export type GetAnalysisResponse = z.infer<typeof GetAnalysisResponseSchema>;

/**
 * GET /api/process/[id]/analysis Query Parameters
 * Optional filtering for analysis retrieval
 */
export const GetAnalysisQuerySchema = z.object({
  level: AnalysisLevelSchema.optional(),
});

export type GetAnalysisQuery = z.infer<typeof GetAnalysisQuerySchema>;

// ================================================================
// CASE LIST SCHEMAS
// ================================================================

/**
 * GET /api/cases Query Parameters
 * Pagination and filtering for case listing
 */
export const CasesListQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).refine(n => n >= 1, 'Page must be >= 1').default(1),
  limit: z.string().regex(/^\d+$/).transform(Number).refine(n => n >= 1 && n <= 100, 'Limit must be 1-100').default(20),
  search: z.string().max(200).optional(),
  status: CaseStatusSchema.optional(),
  type: CaseTypeSchema.optional(),
  priority: PriorityLevelSchema.optional(),
  clientId: CuidSchema.optional(),
  workspaceId: CuidSchema.optional(),
});

export type CasesListQuery = z.infer<typeof CasesListQuerySchema>;

/**
 * GET /api/cases Response
 */
export const CasesListResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(z.object({
    id: UuidSchema,
    number: z.string(),
    title: z.string(),
    description: z.string().optional(),
    type: CaseTypeSchema,
    status: CaseStatusSchema,
    priority: PriorityLevelSchema,
    workspace: z.object({
      id: CuidSchema,
      name: z.string(),
      slug: z.string(),
    }).optional(),
    client: z.object({
      id: CuidSchema,
      name: z.string(),
      email: z.string().email().optional(),
      type: z.string().optional(),
    }).optional(),
    createdBy: z.object({
      id: UuidSchema,
      name: z.string(),
      email: z.string().email().optional(),
    }).optional(),
    _count: z.object({
      documents: z.number().int().min(0).optional(),
      events: z.number().int().min(0).optional(),
      analysisVersions: z.number().int().min(0).optional(),
    }).optional(),
  })).optional(),
  pagination: z.object({
    page: z.number().int().min(1),
    limit: z.number().int().min(1),
    total: z.number().int().min(0),
    pages: z.number().int().min(0),
  }).optional(),
  message: z.string().optional(),
}).passthrough();

export type CasesListResponse = z.infer<typeof CasesListResponseSchema>;

// ================================================================
// CASE CREATE SCHEMAS
// ================================================================

/**
 * POST /api/cases
 * Create a new legal case
 */
export const CreateCasePayloadSchema = z.object({
  workspaceId: CuidSchema,
  clientId: CuidSchema,
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  processNumber: z.string().min(10).max(30).optional(),
  type: CaseTypeSchema,
  status: CaseStatusSchema.default('ACTIVE'),
  priority: PriorityLevelSchema.default('MEDIUM'),
  value: z.number().min(0).optional(),
  startDate: DateTimeSchema.optional(),
  expectedEndDate: DateTimeSchema.optional(),
});

export type CreateCasePayload = z.infer<typeof CreateCasePayloadSchema>;

/**
 * POST /api/cases Response
 */
export const CreateCaseResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    id: UuidSchema,
    number: z.string(),
    title: z.string(),
    description: z.string().optional(),
    type: CaseTypeSchema,
    status: CaseStatusSchema,
    priority: PriorityLevelSchema,
    workspace: z.object({
      id: CuidSchema,
      name: z.string(),
      slug: z.string(),
    }).optional(),
    client: z.object({
      id: CuidSchema,
      name: z.string(),
      email: z.string().email().optional(),
      type: z.string().optional(),
    }).optional(),
    createdBy: z.object({
      id: UuidSchema,
      name: z.string(),
      email: z.string().email().optional(),
    }).optional(),
    _count: z.object({
      documents: z.number().int().min(0).optional(),
      events: z.number().int().min(0).optional(),
      analysisVersions: z.number().int().min(0).optional(),
    }).optional(),
  }).optional(),
  message: z.string().optional(),
}).passthrough();

export type CreateCaseResponse = z.infer<typeof CreateCaseResponseSchema>;

// ================================================================
// CASE UPDATE SCHEMAS
// ================================================================

/**
 * PATCH /api/cases/[id]
 * Update an existing case
 */
export const UpdateCasePayloadSchema = z.object({
  clientId: CuidSchema.optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  type: CaseTypeSchema.optional(),
  status: CaseStatusSchema.optional(),
  priority: PriorityLevelSchema.optional(),
  value: z.number().min(0).optional(),
  startDate: DateTimeSchema.optional(),
  expectedEndDate: DateTimeSchema.optional(),
}).refine(obj => Object.values(obj).some(v => v !== undefined), 'At least one field to update is required');

export type UpdateCasePayload = z.infer<typeof UpdateCasePayloadSchema>;

/**
 * PATCH /api/cases/[id] Response
 */
export const UpdateCaseResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    id: UuidSchema,
    number: z.string(),
    title: z.string(),
    description: z.string().optional(),
    type: CaseTypeSchema,
    status: CaseStatusSchema,
    priority: PriorityLevelSchema,
    client: z.object({
      id: CuidSchema,
      name: z.string(),
      email: z.string().email().optional(),
      type: z.string().optional(),
    }).optional(),
    documents: z.array(z.object({
      id: UuidSchema,
      name: z.string(),
      type: z.string(),
      size: z.number().int().min(0),
      createdAt: DateTimeSchema,
    })).optional(),
    documentCount: z.number().int().min(0).optional(),
    createdAt: DateTimeSchema,
    updatedAt: DateTimeSchema,
  }).optional(),
  message: z.string().optional(),
}).passthrough();

export type UpdateCaseResponse = z.infer<typeof UpdateCaseResponseSchema>;

// ================================================================
// CASE BULK UPDATE SCHEMAS
// ================================================================

/**
 * PATCH /api/cases/bulk
 * Update multiple cases in a single request
 */
export const BulkUpdateCasesPayloadSchema = z.object({
  caseIds: z.array(UuidSchema).min(1, 'At least one case ID is required'),
  updates: z.object({
    clientId: CuidSchema.optional(),
    status: CaseStatusSchema.optional(),
    priority: PriorityLevelSchema.optional(),
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
  }).refine(obj => Object.values(obj).some(v => v !== undefined), 'At least one field to update is required'),
});

export type BulkUpdateCasesPayload = z.infer<typeof BulkUpdateCasesPayloadSchema>;

/**
 * PATCH /api/cases/bulk Response
 */
export const BulkUpdateCasesResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  updated: z.number().int().min(0).optional(),
  failed: z.number().int().min(0).optional(),
  updatedFields: z.array(z.string()).optional(),
  eventsCreated: z.number().int().min(0).optional(),
}).passthrough();

export type BulkUpdateCasesResponse = z.infer<typeof BulkUpdateCasesResponseSchema>;

/**
 * DELETE /api/cases/bulk
 * Delete multiple cases in a single request
 */
export const BulkDeleteCasesPayloadSchema = z.object({
  caseIds: z.array(UuidSchema)
    .min(1, { message: 'At least one case ID is required.' })
    .refine(ids => new Set(ids).size === ids.length, { message: 'Duplicate case IDs are not allowed.' }),
});

export type BulkDeleteCasesPayload = z.infer<typeof BulkDeleteCasesPayloadSchema>;

/**
 * DELETE /api/cases/bulk Response
 */
export const BulkDeleteCasesResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  deleted: z.number().int().min(0).optional(),
  failed: z.number().int().min(0).optional(),
  eventsCreated: z.number().int().min(0).optional(),
}).passthrough();

export type BulkDeleteCasesResponse = z.infer<typeof BulkDeleteCasesResponseSchema>;

// ================================================================
// EXCEL UPLOAD SCHEMAS
// ================================================================

/**
 * POST /api/upload/excel
 * Batch upload process numbers from Excel
 */
export const ExcelUploadPayloadSchema = z.object({
  workspaceId: CuidSchema,
  // Note: File is handled by FormData middleware
});

export type ExcelUploadPayload = z.infer<typeof ExcelUploadPayloadSchema>;

/**
 * POST /api/upload/excel Response
 */
export const ExcelUploadResponseSchema = z.object({
  success: z.boolean(),
  batchId: UuidSchema.optional(),
  preview: z.array(z.record(z.string(), z.unknown())).optional(),
  summary: z.object({
    valid: z.number().int().min(0),
    invalid: z.number().int().min(0),
    total: z.number().int().min(0),
  }).optional(),
  consumption: z.object({
    juditQueries: z.number().int().min(0).optional(),
    message: z.string().optional(),
  }).optional(),
  processing: z.object({
    status: z.enum(['PROCESSING', 'PENDING', 'COMPLETED']),
    totalProcesses: z.number().int().min(0).optional(),
    estimatedTime: z.string().optional(),
    message: z.string().optional(),
  }).optional(),
  config: z.object({
    pageSize: z.number().int().min(1).optional(),
    subbatch: z.number().int().min(1).optional(),
    concurrency: z.number().int().min(1).optional(),
  }).optional(),
}).passthrough();

export type ExcelUploadResponse = z.infer<typeof ExcelUploadResponseSchema>;

// ================================================================
// ROUTE PARAMETER SCHEMAS
// ================================================================

/**
 * Dynamic route parameter: [id]
 * Used in /api/process/[id]/analysis and similar
 */
export const RouteIdParamSchema = z.object({
  id: UuidSchema,
});

export type RouteIdParam = z.infer<typeof RouteIdParamSchema>;

/**
 * Dynamic route parameter: [caseId]
 * Used in /api/cases/[caseId]
 */
export const RouteCaseIdParamSchema = z.object({
  caseId: UuidSchema,
});

export type RouteCaseIdParam = z.infer<typeof RouteCaseIdParamSchema>;

// ================================================================
// VALIDATION UTILITY FUNCTIONS
// ================================================================

/**
 * Format ZodError into readable _error message
 */
function formatZodError(_error: z.ZodError<unknown>): string {
  if ('issues' in _error && Array.isArray(_error.issues)) {
    return _error.issues
      .map(issue => {
        // Extract path safely (ZERO casting)
        const path =
          'path' in issue && Array.isArray(issue.path)
            ? issue.path.map(p => String(p)).join('.')
            : 'root';

        // Extract message safely (ZERO casting)
        const message =
          'message' in issue && typeof issue.message === 'string'
            ? issue.message
            : 'Validation _error';

        return `${path || 'root'}: ${message}`;
      })
      .join('; ');
  }
  return 'Validation _error';
}

/**
 * Safely parse and validate process upload payload
 */
export function parseProcessUpload(
  data: unknown
): { success: true; data: ProcessUploadPayload } | { success: false; _error: string } {
  try {
    const parsed = ProcessUploadPayloadSchema.parse(data);
    return { success: true, data: parsed };
  } catch (error) {
    if (_error instanceof z.ZodError) {
      return { success: false, _error: formatZodError(_error) };
    }
    const message = _error instanceof Error ? _error.message : 'Unknown validation _error';
    return { success: false, _error: message };
  }
}

/**
 * Safely parse and validate create analysis payload
 */
export function parseCreateAnalysis(
  data: unknown
): { success: true; data: CreateAnalysisPayload } | { success: false; _error: string } {
  try {
    const parsed = CreateAnalysisPayloadSchema.parse(data);
    return { success: true, data: parsed };
  } catch (error) {
    if (_error instanceof z.ZodError) {
      return { success: false, _error: formatZodError(_error) };
    }
    const message = _error instanceof Error ? _error.message : 'Unknown validation _error';
    return { success: false, _error: message };
  }
}

/**
 * Safely parse and validate cases list query parameters
 */
export function parseCasesListQuery(
  data: unknown
): { success: true; data: CasesListQuery } | { success: false; _error: string } {
  try {
    const parsed = CasesListQuerySchema.parse(data);
    return { success: true, data: parsed };
  } catch (error) {
    if (_error instanceof z.ZodError) {
      return { success: false, _error: formatZodError(_error) };
    }
    const message = _error instanceof Error ? _error.message : 'Unknown validation _error';
    return { success: false, _error: message };
  }
}

/**
 * Safely parse and validate create case payload
 */
export function parseCreateCase(
  data: unknown
): { success: true; data: CreateCasePayload } | { success: false; _error: string } {
  try {
    const parsed = CreateCasePayloadSchema.parse(data);
    return { success: true, data: parsed };
  } catch (error) {
    if (_error instanceof z.ZodError) {
      return { success: false, _error: formatZodError(_error) };
    }
    const message = _error instanceof Error ? _error.message : 'Unknown validation _error';
    return { success: false, _error: message };
  }
}

/**
 * Safely parse and validate bulk update cases payload
 */
export function parseBulkUpdateCases(
  data: unknown
): { success: true; data: BulkUpdateCasesPayload } | { success: false; _error: string } {
  try {
    const parsed = BulkUpdateCasesPayloadSchema.parse(data);
    return { success: true, data: parsed };
  } catch (error) {
    if (_error instanceof z.ZodError) {
      return { success: false, _error: formatZodError(_error) };
    }
    const message = _error instanceof Error ? _error.message : 'Unknown validation _error';
    return { success: false, _error: message };
  }
}

/**
 * Safely parse and validate bulk delete cases payload
 */
export function parseBulkDeleteCases(
  data: unknown
): { success: true; data: BulkDeleteCasesPayload } | { success: false; _error: string } {
  try {
    const parsed = BulkDeleteCasesPayloadSchema.parse(data);
    return { success: true, data: parsed };
  } catch (error) {
    if (_error instanceof z.ZodError) {
      return { success: false, _error: formatZodError(_error) };
    }
    const message = _error instanceof Error ? _error.message : 'Unknown validation _error';
    return { success: false, _error: message };
  }
}

/**
 * Safely parse and validate route parameters
 */
export function parseRouteIdParam(
  data: unknown
): { success: true; data: RouteIdParam } | { success: false; _error: string } {
  try {
    const parsed = RouteIdParamSchema.parse(data);
    return { success: true, data: parsed };
  } catch (error) {
    if (_error instanceof z.ZodError) {
      return { success: false, _error: formatZodError(_error) };
    }
    const message = _error instanceof Error ? _error.message : 'Unknown validation _error';
    return { success: false, _error: message };
  }
}
