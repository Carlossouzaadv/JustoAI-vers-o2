// ================================================================
// JUDIT API WRAPPER
// Centralizes JUDIT API calls with cost tracking and telemetry
// ================================================================

import { prisma } from '@/lib/prisma';
import { ICONS } from '@/lib/icons';
import { log, logError } from '@/lib/services/logger';

// ================================================================
// TYPES
// ================================================================

/* eslint-disable no-unused-vars */
export enum JuditOperationType {
  SEARCH = 'SEARCH',
  MONITORING = 'MONITORING',
  FETCH = 'FETCH',
  ANALYSIS = 'ANALYSIS',
  REPORT = 'REPORT',
}
/* eslint-enable no-unused-vars */

export interface JuditCallMetrics {
  workspaceId?: string;
  operationType: JuditOperationType;
  numeroCnj?: string;
  documentsRetrieved?: number;
  movementsCount?: number;
  durationMs: number;
  success: boolean;
  error?: string;
  errorCode?: string;
  cost?: number;
  attachmentsCost?: number;
  apiCallsCount?: number;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

export interface JuditResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
  metrics: {
    durationMs: number;
    documentsRetrieved: number;
    movementsCount: number;
    cost: number;
  };
}

// ================================================================
// COST CONFIGURATION
// ================================================================

const JUDIT_COSTS = {
  SEARCH: 0.69, // Base search cost
  MONITORING: 0.15, // Monitoring check cost
  FETCH: 0.35, // Fetch cost
  ANALYSIS: 1.50, // Analysis cost
  REPORT: 2.00, // Report generation cost
} as Record<JuditOperationType, number>;

// ================================================================
// TYPE GUARDS AND SAFE CONVERTERS (Padrão-Ouro)
// ================================================================

/**
 * Type guard with predicate: narrow unknown to a valid JuditAlertType
 * Values MUST match Prisma schema enum JuditAlertType
 */
function isValidJuditAlertType(value: unknown): value is 'API_ERROR' | 'RATE_LIMIT' | 'CIRCUIT_BREAKER' | 'HIGH_COST' | 'TIMEOUT' | 'ATTACHMENT_TRIGGER' | 'MONITORING_FAILED' {
  const validTypes = ['API_ERROR', 'RATE_LIMIT', 'CIRCUIT_BREAKER', 'HIGH_COST', 'TIMEOUT', 'ATTACHMENT_TRIGGER', 'MONITORING_FAILED'];
  return typeof value === 'string' && validTypes.includes(value);
}

/**
 * Type guard with predicate: narrow unknown to a valid AlertSeverity
 */
function isValidAlertSeverity(value: unknown): value is 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  const validSeverities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  return typeof value === 'string' && validSeverities.includes(value);
}

/**
 * Safe mapping function: Convert local JuditOperationType to Prisma enum values
 * Padrão-Ouro pattern: validates and transforms at boundary crossing
 *
 * Returns specific Prisma enum literal types to enable safe type narrowing
 * This documents the semantic mapping between internal API and persistence layer
 */
function mapLocalOperationTypeToPrisma(
  operationType: JuditOperationType
): 'ONBOARDING' | 'MONITORING_CHECK' | 'ATTACHMENT_FETCH' | 'MANUAL_SEARCH' {
  // Map our internal operation types to Prisma's enum values
  const prismaMapping: Record<
    JuditOperationType,
    'ONBOARDING' | 'MONITORING_CHECK' | 'ATTACHMENT_FETCH' | 'MANUAL_SEARCH'
  > = {
    [JuditOperationType.SEARCH]: 'MANUAL_SEARCH',      // User-initiated search
    [JuditOperationType.MONITORING]: 'MONITORING_CHECK', // Monitoring verification
    [JuditOperationType.FETCH]: 'ATTACHMENT_FETCH',    // Fetching attachments
    [JuditOperationType.ANALYSIS]: 'ONBOARDING',       // Analysis as part of onboarding
    [JuditOperationType.REPORT]: 'ONBOARDING',         // Report generation as part of onboarding
  };

  // Get the mapped value - guaranteed to be valid Prisma enum literal
  const prismaValue = prismaMapping[operationType];

  if (!prismaValue) {
    log.error({ msg: 'Cannot map operation type', operationType });
    throw new Error(`Cannot map operation type: ${operationType}`);
  }

  return prismaValue;
}

// ================================================================
// JUDIT API WRAPPER CLASS
// ================================================================

export class JuditApiWrapper {
  /**
   * Track a JUDIT API call with full metrics
   * Called after successful JUDIT operation
   */
  static async trackCall(metrics: JuditCallMetrics): Promise<void> {
    try {
      const startTime = Date.now();

      // Calculate costs
      const baseCost = JUDIT_COSTS[metrics.operationType];
      const attachmentsCost = metrics.attachmentsCost || 0;
      const totalCost = baseCost + attachmentsCost;

      // Save to database with safe enum mapping (Padrão-Ouro pattern)
      // mapLocalOperationTypeToPrisma() returns specific Prisma enum literal types
      // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
      const tracking = await prisma.juditCostTracking.create({
        data: {
          workspaceId: metrics.workspaceId ?? null,
          numeroCnj: metrics.numeroCnj ?? null,
          searchCost: metrics.operationType === 'SEARCH' ? baseCost : 0,
          attachmentsCost: attachmentsCost,
          totalCost: totalCost,
          documentsRetrieved: metrics.documentsRetrieved || 0,
          movementsCount: metrics.movementsCount || 0,
          apiCallsCount: metrics.apiCallsCount || 1,
          durationMs: metrics.durationMs || 0,
          requestId: metrics.requestId ?? null,
          // ✅ Safe mapping: transforms local enum to Prisma enum literal (no casting)
          operationType: mapLocalOperationTypeToPrisma(metrics.operationType),
        },
      });

      const duration = Date.now() - startTime;
      log.info({
        msg: 'JUDIT operation tracked',
        component: 'juditApiWrapper',
        operationType: metrics.operationType,
        durationMs: duration,
        cost: totalCost,
        icon: ICONS.SUCCESS
      });

      // Check if alert should be created
      if (!metrics.success && metrics.error) {
        await this.checkAndCreateAlert(metrics);
      }
    } catch (error) {
      logError(error, 'Error tracking JUDIT call', { component: 'juditApiWrapper', icon: ICONS.ERROR });
      // Don't throw - tracking failure shouldn't break the operation
    }
  }

  /**
   * Check if alert should be created for this error
   */
  static async checkAndCreateAlert(metrics: JuditCallMetrics): Promise<void> {
    if (!metrics.workspaceId || !metrics.error) return;

    try {
      // Map error codes to alert types
      let severity = 'MEDIUM';
      if (metrics.errorCode === 'RATE_LIMIT') severity = 'HIGH';
      if (metrics.errorCode === 'AUTH_FAILED') severity = 'CRITICAL';
      if (metrics.errorCode === 'TIMEOUT') severity = 'HIGH';

      // Check if similar unresolved alert exists
      const existingAlert = await prisma.juditAlert.findFirst({
        where: {
          workspaceId: metrics.workspaceId,
          errorCode: metrics.errorCode,
          resolved: false,
        },
      });

      // Only create new alert if no unresolved one exists
      if (!existingAlert) {
        // Type guard: ensure metadata is JSON-safe
        const safeMetadata = metrics.metadata ? JSON.parse(JSON.stringify(metrics.metadata)) : undefined;

        // Type guard + narrowing: safely map to alertType and validate
        const alertTypeStr = this.mapErrorToAlertType(metrics.errorCode);
        if (!isValidJuditAlertType(alertTypeStr)) {
          log.warn({
            msg: 'Invalid alert type, skipping alert creation',
            component: 'juditApiWrapper',
            alertType: alertTypeStr,
            icon: ICONS.WARNING
          });
          return;
        }

        // Type guard + narrowing: validate severity before use
        if (!isValidAlertSeverity(severity)) {
          log.warn({
            msg: 'Invalid severity, skipping alert creation',
            component: 'juditApiWrapper',
            severity,
            icon: ICONS.WARNING
          });
          return;
        }

        await prisma.juditAlert.create({
          data: {
            workspaceId: metrics.workspaceId,
            alertType: alertTypeStr,
            severity: severity,
            title: `JUDIT ${metrics.operationType} Error`,
            message: metrics.error,
            errorCode: metrics.errorCode,
            numeroCnj: metrics.numeroCnj,
            requestId: metrics.requestId,
            metadata: safeMetadata,
          },
        });

        log.warn({
          msg: 'Created JUDIT alert',
          component: 'juditApiWrapper',
          errorCode: metrics.errorCode,
          icon: ICONS.WARNING
        });
      }
    } catch (error) {
      logError(error, 'Failed to create JUDIT alert', { component: 'juditApiWrapper', icon: ICONS.WARNING });
    }
  }

  /**
   * Map error codes to alert types (Padrão-Ouro: safe mapping function)
   * Maps error codes to values that match Prisma's JuditAlertType enum exactly
   */
  private static mapErrorToAlertType(errorCode?: string): string {
    if (!errorCode) return 'API_ERROR';

    // Mapping must use exact Prisma enum values (from schema.prisma)
    const mapping: Record<string, string> = {
      RATE_LIMIT: 'RATE_LIMIT',
      TIMEOUT: 'TIMEOUT',
      CIRCUIT_BREAKER: 'CIRCUIT_BREAKER',
      AUTH_FAILED: 'API_ERROR', // Map auth failures to generic API error
      ATTACHMENT_TRIGGER: 'ATTACHMENT_TRIGGER',
      MONITORING_FAILED: 'MONITORING_FAILED',
      HIGH_COST: 'HIGH_COST',
    };

    // Return mapped value - guaranteed to be a valid Prisma JuditAlertType
    const result = mapping[errorCode] || 'API_ERROR';
    return String(result);
  }

  /**
   * Wrap a JUDIT search operation
   * Implements async polling pattern: POST /requests → GET /requests → GET /responses
   */
  static async search<T>(
    workspaceId: string,
    numeroCnj: string,
    options: {
      requestId?: string;
      metadata?: Record<string, unknown>;
    } = {}
  ): Promise<JuditResponse<T>> {
    const startTime = Date.now();
    const apiKey = process.env.JUDIT_API_KEY;
    const searchBaseUrl = 'https://requests.prod.judit.io';

    if (!apiKey) {
      const errorMsg = 'JUDIT_API_KEY not configured';
      log.error({ msg: errorMsg, component: 'juditApiWrapper', icon: ICONS.ERROR });
      return {
        success: false,
        error: errorMsg,
        metrics: {
          durationMs: Date.now() - startTime,
          documentsRetrieved: 0,
          movementsCount: 0,
          cost: JUDIT_COSTS.SEARCH,
        },
      };
    }

    try {
      log.info({ msg: 'Starting JUDIT search', component: 'juditApiWrapper', numeroCnj, icon: ICONS.PROCESS });

      // Extract search type (lawsuit_cnj is default, but could be cpf, cnpj, oab, name)
      const searchType = 'lawsuit_cnj';

      // Step 1: Create search request (POST /requests)
      log.info({ msg: 'Creating search request', component: 'juditApiWrapper', icon: ICONS.INFO });
      const createResponse = await fetch(`${searchBaseUrl}/requests`, {
        method: 'POST',
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          search_type: searchType,
          search_key: numeroCnj,
          attachments: true, // Request attachments in results
        }),
      });

      if (!createResponse.ok) {
        const errorBody = await createResponse.text();
        throw new Error(`Failed to create search request: ${createResponse.status} - ${errorBody}`);
      }

      const createData: unknown = await createResponse.json();

      // Type guard for request ID
      if (
        typeof createData !== 'object' ||
        createData === null ||
        !('request_id' in createData) ||
        typeof (createData as { request_id: unknown }).request_id !== 'string'
      ) {
        throw new Error('Invalid response from create search request: missing request_id');
      }

      const juditRequestId = (createData as { request_id: string }).request_id;
      log.info({ msg: 'JUDIT search request created', component: 'juditApiWrapper', requestId: juditRequestId, icon: ICONS.SUCCESS });

      // Step 2: Poll for completion (GET /requests/{request_id})
      log.info({ msg: 'Polling for search completion', component: 'juditApiWrapper', icon: ICONS.INFO });
      const maxPolls = 30;
      let pollCount = 0;
      let searchStatus = 'pending';

      while (pollCount < maxPolls) {
        const pollResponse = await fetch(`${searchBaseUrl}/requests/${juditRequestId}`, {
          method: 'GET',
          headers: {
            'api-key': apiKey,
          },
        });

        if (!pollResponse.ok) {
          const errorBody = await pollResponse.text();
          throw new Error(`Failed to poll search status: ${pollResponse.status} - ${errorBody}`);
        }

        const pollData: unknown = await pollResponse.json();

        // Type guard for status
        if (
          typeof pollData !== 'object' ||
          pollData === null ||
          !('status' in pollData) ||
          typeof (pollData as { status: unknown }).status !== 'string'
        ) {
          throw new Error('Invalid response from poll: missing status');
        }

        searchStatus = (pollData as { status: string }).status;

        if (searchStatus === 'completed') {
          log.info({ msg: 'JUDIT search completed', component: 'juditApiWrapper', pollCount: pollCount + 1, icon: ICONS.SUCCESS });
          break;
        }

        if (searchStatus === 'failed') {
          throw new Error('Search request failed on JUDIT side');
        }

        pollCount++;
        // Wait 1 second before next poll
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      if (searchStatus !== 'completed') {
        throw new Error(`Search request timed out after ${maxPolls} polling attempts`);
      }

      // Step 3: Fetch results (GET /responses?request_id=...)
      log.info({ msg: 'Fetching search results', component: 'juditApiWrapper', icon: ICONS.INFO });
      const resultsResponse = await fetch(`${searchBaseUrl}/responses?request_id=${juditRequestId}`, {
        method: 'GET',
        headers: {
          'api-key': apiKey,
        },
      });

      if (!resultsResponse.ok) {
        const errorBody = await resultsResponse.text();
        throw new Error(`Failed to fetch search results: ${resultsResponse.status} - ${errorBody}`);
      }

      const resultsData: unknown = await resultsResponse.json();

      // Type guard for results
      if (typeof resultsData !== 'object' || resultsData === null) {
        throw new Error('Invalid response from fetch results: not an object');
      }

      // Extract documents and movements with safe narrowing
      const documents = 'documents' in resultsData && Array.isArray((resultsData as { documents: unknown }).documents)
        ? ((resultsData as { documents: unknown[] }).documents).length
        : 0;

      const movements = 'movements' in resultsData && Array.isArray((resultsData as { movements: unknown }).movements)
        ? ((resultsData as { movements: unknown[] }).movements).length
        : 0;

      const durationMs = Date.now() - startTime;

      // Track the call
      await this.trackCall({
        workspaceId,
        operationType: JuditOperationType.SEARCH,
        numeroCnj,
        documentsRetrieved: documents,
        movementsCount: movements,
        durationMs,
        success: true,
        requestId: juditRequestId,
        apiCallsCount: 2 + pollCount, // Create + Fetch + Polls
        metadata: {
          ...options.metadata,
          pollsRequired: pollCount,
        },
      });

      return {
        success: true,
        data: resultsData as T,
        metrics: {
          durationMs,
          documentsRetrieved: documents,
          movementsCount: movements,
          cost: JUDIT_COSTS.SEARCH,
        },
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logError(error, 'JUDIT search error', { component: 'juditApiWrapper', icon: ICONS.ERROR });

      await this.trackCall({
        workspaceId,
        operationType: JuditOperationType.SEARCH,
        numeroCnj,
        durationMs,
        success: false,
        error: errorMessage,
        errorCode: errorMessage.includes('401') ? 'AUTH_FAILED' : errorMessage.includes('429') ? 'RATE_LIMIT' : 'API_ERROR',
        requestId: options.requestId,
        metadata: options.metadata,
      });

      return {
        success: false,
        error: errorMessage,
        metrics: {
          durationMs,
          documentsRetrieved: 0,
          movementsCount: 0,
          cost: JUDIT_COSTS.SEARCH,
        },
      };
    }
  }

  /**
   * Wrap a JUDIT monitoring operation
   * Endpoint: POST /tracking to create recurring monitoring
   */
  static async monitoring<T>(
    workspaceId: string,
    numeroCnj: string,
    options: {
      requestId?: string;
      metadata?: Record<string, unknown>;
      recurrenceIntervalDays?: number;
      notificationEmail?: string;
      keywordFilters?: string[];
    } = {}
  ): Promise<JuditResponse<T>> {
    const startTime = Date.now();
    const apiKey = process.env.JUDIT_API_KEY;
    const monitoringBaseUrl = 'https://tracking.prod.judit.io';

    if (!apiKey) {
      const errorMsg = 'JUDIT_API_KEY not configured';
      log.error({ msg: errorMsg, component: 'juditApiWrapper', icon: ICONS.ERROR });
      return {
        success: false,
        error: errorMsg,
        metrics: {
          durationMs: Date.now() - startTime,
          documentsRetrieved: 0,
          movementsCount: 0,
          cost: JUDIT_COSTS.MONITORING,
        },
      };
    }

    try {
      log.info({ msg: 'Setting up JUDIT monitoring', component: 'juditApiWrapper', numeroCnj, icon: ICONS.SEARCH });

      // Default recurrence: daily (1 day interval)
      const recurrenceDays = options.recurrenceIntervalDays || 1;

      // Build monitoring payload
      const monitoringPayload: Record<string, unknown> = {
        lawsuit_cnj: numeroCnj,
        recurrence: recurrenceDays, // In days
      };

      // Add optional notification email
      if (options.notificationEmail) {
        monitoringPayload.email_notification = options.notificationEmail;
      }

      // Add optional keyword filters for step notifications
      if (options.keywordFilters && options.keywordFilters.length > 0) {
        monitoringPayload.step_terms = options.keywordFilters;
      }

      // Create monitoring (POST /tracking)
      log.info({ msg: 'Creating monitoring', component: 'juditApiWrapper', recurrenceDays, icon: ICONS.INFO });
      const monitoringResponse = await fetch(`${monitoringBaseUrl}/tracking`, {
        method: 'POST',
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(monitoringPayload),
      });

      if (!monitoringResponse.ok) {
        const errorBody = await monitoringResponse.text();
        throw new Error(
          `Failed to create monitoring: ${monitoringResponse.status} - ${errorBody}`
        );
      }

      const monitoringData: unknown = await monitoringResponse.json();

      // Type guard for monitoring response
      if (
        typeof monitoringData !== 'object' ||
        monitoringData === null ||
        !('tracking_id' in monitoringData) ||
        typeof (monitoringData as { tracking_id: unknown }).tracking_id !== 'string'
      ) {
        throw new Error('Invalid response from create monitoring: missing tracking_id');
      }

      const trackingId = (monitoringData as { tracking_id: string }).tracking_id;
      log.info({ msg: 'JUDIT monitoring created', component: 'juditApiWrapper', trackingId, icon: ICONS.SUCCESS });

      const durationMs = Date.now() - startTime;

      // Track the call
      await this.trackCall({
        workspaceId,
        operationType: JuditOperationType.MONITORING,
        numeroCnj,
        durationMs,
        success: true,
        requestId: trackingId,
        apiCallsCount: 1,
        metadata: {
          ...options.metadata,
          recurrenceDays,
          hasEmailNotification: !!options.notificationEmail,
          hasKeywordFilters: (options.keywordFilters?.length || 0) > 0,
        },
      });

      return {
        success: true,
        data: monitoringData as T,
        metrics: {
          durationMs,
          documentsRetrieved: 0,
          movementsCount: 0,
          cost: JUDIT_COSTS.MONITORING,
        },
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logError(error, 'JUDIT monitoring error', { component: 'juditApiWrapper', icon: ICONS.ERROR });

      await this.trackCall({
        workspaceId,
        operationType: JuditOperationType.MONITORING,
        numeroCnj,
        durationMs,
        success: false,
        error: errorMessage,
        errorCode: errorMessage.includes('401') ? 'AUTH_FAILED' : 'MONITORING_FAILED',
        requestId: options.requestId,
        metadata: options.metadata,
      });

      return {
        success: false,
        error: errorMessage,
        metrics: {
          durationMs,
          documentsRetrieved: 0,
          movementsCount: 0,
          cost: JUDIT_COSTS.MONITORING,
        },
      };
    }
  }

  /**
   * Wrap a JUDIT fetch operation
   * Endpoints: GET /transfer-file, GET /transfer-file/:id, PATCH /transfer-file/:id
   */
  static async fetch<T>(
    workspaceId: string,
    numeroCnj: string,
    documentIds: string[],
    options: {
      requestId?: string;
      metadata?: Record<string, unknown>;
    } = {}
  ): Promise<JuditResponse<T>> {
    const startTime = Date.now();
    const apiKey = process.env.JUDIT_API_KEY;
    const fileTransferBaseUrl = 'https://lawsuits.prod.judit.io';

    if (!apiKey) {
      const errorMsg = 'JUDIT_API_KEY not configured';
      log.error({ msg: errorMsg, component: 'juditApiWrapper', icon: ICONS.ERROR });
      return {
        success: false,
        error: errorMsg,
        metrics: {
          durationMs: Date.now() - startTime,
          documentsRetrieved: 0,
          movementsCount: 0,
          cost: JUDIT_COSTS.FETCH,
        },
      };
    }

    if (!documentIds || documentIds.length === 0) {
      const errorMsg = 'No document IDs provided for fetch';
      log.warn({ msg: errorMsg, component: 'juditApiWrapper', icon: ICONS.WARNING });
      return {
        success: false,
        error: errorMsg,
        metrics: {
          durationMs: Date.now() - startTime,
          documentsRetrieved: 0,
          movementsCount: 0,
          cost: JUDIT_COSTS.FETCH,
        },
      };
    }

    try {
      log.info({
        msg: 'Fetching JUDIT documents',
        component: 'juditApiWrapper',
        documentCount: documentIds.length,
        numeroCnj,
        icon: ICONS.DOWNLOAD
      });

      const documents: Array<{ id: string; downloadUrl?: string; error?: string }> = [];
      let successCount = 0;

      // Fetch download URLs for each document
      for (const documentId of documentIds) {
        try {
          log.info({ msg: 'Getting download URL for document', component: 'juditApiWrapper', documentId, icon: ICONS.INFO });

          // Step 1: Get download URL (GET /transfer-file/{id})
          const downloadResponse = await fetch(
            `${fileTransferBaseUrl}/transfer-file/${documentId}`,
            {
              method: 'GET',
              headers: {
                'api-key': apiKey,
              },
            }
          );

          if (!downloadResponse.ok) {
            const errorBody = await downloadResponse.text();
            throw new Error(
              `Failed to get download URL: ${downloadResponse.status} - ${errorBody}`
            );
          }

          const downloadData: unknown = await downloadResponse.json();

          // Type guard for download URL response
          if (
            typeof downloadData !== 'object' ||
            downloadData === null ||
            !('download_url' in downloadData) ||
            typeof (downloadData as { download_url: unknown }).download_url !== 'string'
          ) {
            throw new Error('Invalid response from get download URL: missing download_url');
          }

          const downloadUrl = (downloadData as { download_url: string }).download_url;
          log.info({ msg: 'Got download URL for document', component: 'juditApiWrapper', documentId, icon: ICONS.SUCCESS });

          // Step 2: Update status to "downloaded" (PATCH /transfer-file/{id})
          log.info({ msg: 'Updating document status to downloaded', component: 'juditApiWrapper', documentId, icon: ICONS.INFO });
          const statusResponse = await fetch(
            `${fileTransferBaseUrl}/transfer-file/${documentId}`,
            {
              method: 'PATCH',
              headers: {
                'api-key': apiKey,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                status: 'downloaded',
              }),
            }
          );

          if (!statusResponse.ok) {
            const errorBody = await statusResponse.text();
            log.warn({
              msg: 'Failed to update document status',
              component: 'juditApiWrapper',
              statusCode: statusResponse.status,
              errorBody,
              icon: ICONS.WARNING
            });
            // Don't throw - status update is non-critical
          }

          documents.push({
            id: documentId,
            downloadUrl,
          });
          successCount++;
        } catch (docError) {
          const errorMsg = docError instanceof Error ? docError.message : 'Unknown error';
          logError(docError, `Failed to fetch document ${documentId}`, { component: 'juditApiWrapper', documentId, icon: ICONS.ERROR });
          documents.push({
            id: documentId,
            error: errorMsg,
          });
        }
      }

      if (successCount === 0) {
        throw new Error('Failed to fetch any documents');
      }

      const durationMs = Date.now() - startTime;
      const attachmentsCost = successCount * 0.15; // 0.15 per document

      // Track the call
      await this.trackCall({
        workspaceId,
        operationType: JuditOperationType.FETCH,
        numeroCnj,
        documentsRetrieved: successCount,
        durationMs,
        success: true,
        attachmentsCost,
        apiCallsCount: documentIds.length * 2, // Get URL + Update status per document
        requestId: options.requestId,
        metadata: {
          ...options.metadata,
          totalRequested: documentIds.length,
          successCount,
        },
      });

      return {
        success: true,
        data: { documents } as T,
        metrics: {
          durationMs,
          documentsRetrieved: successCount,
          movementsCount: 0,
          cost: JUDIT_COSTS.FETCH + attachmentsCost,
        },
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logError(error, 'JUDIT fetch error', { component: 'juditApiWrapper', icon: ICONS.ERROR });

      await this.trackCall({
        workspaceId,
        operationType: JuditOperationType.FETCH,
        numeroCnj,
        durationMs,
        success: false,
        error: errorMessage,
        errorCode: errorMessage.includes('401') ? 'AUTH_FAILED' : 'API_ERROR',
        requestId: options.requestId,
        metadata: {
          ...options.metadata,
          totalRequested: documentIds.length,
        },
      });

      return {
        success: false,
        error: errorMessage,
        metrics: {
          durationMs,
          documentsRetrieved: 0,
          movementsCount: 0,
          cost: JUDIT_COSTS.FETCH,
        },
      };
    }
  }

  /**
   * Get current month costs for workspace
   */
  static async getMonthCosts(workspaceId: string): Promise<{
    total: number;
    byOperation: Record<string, number>;
    callsCount: number;
  }> {
    try {
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      const costs = await prisma.juditCostTracking.findMany({
        where: {
          workspaceId,
          createdAt: { gte: startDate, lte: endDate },
        },
      });

      const byOperation: Record<string, number> = {};
      let total = 0;

      for (const cost of costs) {
        const amount = Number(cost.totalCost);
        total += amount;

        const op = cost.operationType;
        byOperation[op] = (byOperation[op] || 0) + amount;
      }

      return {
        total,
        byOperation,
        callsCount: costs.length,
      };
    } catch (error) {
      logError(error, 'Error getting JUDIT month costs', { component: 'juditApiWrapper', workspaceId, icon: ICONS.ERROR });
      return {
        total: 0,
        byOperation: {},
        callsCount: 0,
      };
    }
  }

  /**
   * Get unresolved alerts for workspace
   */
  static async getUnresolvedAlerts(workspaceId: string): Promise<unknown[]> {
    try {
      return await prisma.juditAlert.findMany({
        where: {
          workspaceId,
          resolved: false,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    } catch (error) {
      logError(error, 'Error getting JUDIT alerts', { component: 'juditApiWrapper', workspaceId, icon: ICONS.ERROR });
      return [];
    }
  }
}

// ================================================================
// CONVENIENCE EXPORTS
// ================================================================

export const juditAPI = JuditApiWrapper;
