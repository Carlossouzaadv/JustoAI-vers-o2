// ================================================================
// JUDIT API WRAPPER
// Centralizes JUDIT API calls with cost tracking and telemetry
// ================================================================

import { prisma } from '@/lib/prisma';
import { ICONS } from '@/lib/icons';

// ================================================================
// TYPES
// ================================================================

export enum JuditOperationType {
  SEARCH = 'SEARCH',
  MONITORING = 'MONITORING',
  FETCH = 'FETCH',
  ANALYSIS = 'ANALYSIS',
  REPORT = 'REPORT',
}

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

      // Save to database
      const tracking = await prisma.juditCostTracking.create({
        data: {
          workspaceId: metrics.workspaceId,
          operationType: metrics.operationType as any,
          numeroCnj: metrics.numeroCnj,
          searchCost: metrics.operationType === 'SEARCH' ? baseCost : 0,
          attachmentsCost: attachmentsCost,
          totalCost: totalCost,
          documentsRetrieved: metrics.documentsRetrieved || 0,
          movementsCount: metrics.movementsCount || 0,
          apiCallsCount: metrics.apiCallsCount || 1,
          durationMs: metrics.durationMs,
          requestId: metrics.requestId,
        },
      });

      const duration = Date.now() - startTime;
      console.log(
        `${ICONS.SUCCESS} [JUDIT Tracking] ${metrics.operationType} tracked in ${duration}ms (Cost: R$ ${totalCost.toFixed(2)})`
      );

      // Check if alert should be created
      if (!metrics.success && metrics.error) {
        await this.checkAndCreateAlert(metrics);
      }
    } catch (error) {
      console.error(`${ICONS.ERROR} [JUDIT Tracking] Error tracking call:`, error);
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

        await prisma.juditAlert.create({
          data: {
            workspaceId: metrics.workspaceId,
            alertType: this.mapErrorToAlertType(metrics.errorCode) as any,
            severity: severity as any,
            title: `JUDIT ${metrics.operationType} Error`,
            message: metrics.error,
            errorCode: metrics.errorCode,
            numeroCnj: metrics.numeroCnj,
            requestId: metrics.requestId,
            metadata: safeMetadata,
          },
        });

        console.log(
          `${ICONS.WARNING} [JUDIT Alert] Created alert for ${metrics.errorCode}`
        );
      }
    } catch (error) {
      console.warn(`${ICONS.WARNING} [JUDIT Alert] Failed to create alert:`, error);
    }
  }

  /**
   * Map error codes to alert types (using narrowing seguro)
   */
  private static mapErrorToAlertType(errorCode?: string): string {
    if (!errorCode) return 'API_ERROR';

    const mapping: Record<string, string> = {
      RATE_LIMIT: 'RATE_LIMIT_EXCEEDED',
      AUTH_FAILED: 'AUTHENTICATION_ERROR',
      TIMEOUT: 'TIMEOUT_ERROR',
      CNJ_NOT_FOUND: 'PROCESS_NOT_FOUND',
      INVALID_CNJ: 'INVALID_PROCESS_NUMBER',
    };

    // Return string value - Prisma will validate it's a valid JuditAlertType
    const result = mapping[errorCode] || 'API_ERROR';
    return String(result);
  }

  /**
   * Wrap a JUDIT search operation
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

    try {
      console.log(`${ICONS.PROCESS} [JUDIT Search] Starting search for CNJ: ${numeroCnj}`);

      // TODO: Replace with actual JUDIT API call
      // const response = await juditClient.search(numeroCnj);

      // Mock response for now
      const mockData = {
        success: true,
        documents: [],
        movements: [],
      };

      const durationMs = Date.now() - startTime;

      // Track the call
      await this.trackCall({
        workspaceId,
        operationType: JuditOperationType.SEARCH,
        numeroCnj,
        documentsRetrieved: 0,
        movementsCount: 0,
        durationMs,
        success: true,
        requestId: options.requestId,
        metadata: options.metadata,
      });

      return {
        success: true,
        data: mockData as T,
        metrics: {
          durationMs,
          documentsRetrieved: 0,
          movementsCount: 0,
          cost: JUDIT_COSTS.SEARCH,
        },
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await this.trackCall({
        workspaceId,
        operationType: JuditOperationType.SEARCH,
        numeroCnj,
        durationMs,
        success: false,
        error: errorMessage,
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
   */
  static async monitoring<T>(
    workspaceId: string,
    numeroCnj: string,
    options: {
      requestId?: string;
      metadata?: Record<string, unknown>;
    } = {}
  ): Promise<JuditResponse<T>> {
    const startTime = Date.now();

    try {
      console.log(`${ICONS.SEARCH} [JUDIT Monitoring] Checking for updates: ${numeroCnj}`);

      // TODO: Replace with actual JUDIT monitoring call
      // const response = await juditClient.monitoring(numeroCnj);

      // Mock response for now
      const mockData = {
        hasUpdates: false,
        lastUpdate: null,
      };

      const durationMs = Date.now() - startTime;

      await this.trackCall({
        workspaceId,
        operationType: JuditOperationType.MONITORING,
        numeroCnj,
        durationMs,
        success: true,
        requestId: options.requestId,
        metadata: options.metadata,
      });

      return {
        success: true,
        data: mockData as T,
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

      await this.trackCall({
        workspaceId,
        operationType: JuditOperationType.MONITORING,
        numeroCnj,
        durationMs,
        success: false,
        error: errorMessage,
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

    try {
      console.log(
        `${ICONS.DOWNLOAD} [JUDIT Fetch] Fetching ${documentIds.length} documents for CNJ: ${numeroCnj}`
      );

      // TODO: Replace with actual JUDIT fetch call
      // const response = await juditClient.fetch(numeroCnj, documentIds);

      // Mock response
      const mockData = {
        documents: [],
      };

      const durationMs = Date.now() - startTime;
      const attachmentsCost = documentIds.length * 0.15; // 0.15 per document

      await this.trackCall({
        workspaceId,
        operationType: JuditOperationType.FETCH,
        numeroCnj,
        documentsRetrieved: documentIds.length,
        durationMs,
        success: true,
        attachmentsCost,
        requestId: options.requestId,
        metadata: options.metadata,
      });

      return {
        success: true,
        data: mockData as T,
        metrics: {
          durationMs,
          documentsRetrieved: documentIds.length,
          movementsCount: 0,
          cost: JUDIT_COSTS.FETCH + attachmentsCost,
        },
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await this.trackCall({
        workspaceId,
        operationType: JuditOperationType.FETCH,
        numeroCnj,
        durationMs,
        success: false,
        error: errorMessage,
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
      console.error(`${ICONS.ERROR} [JUDIT Costs] Error getting month costs:`, error);
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
      console.error(`${ICONS.ERROR} [JUDIT Alerts] Error getting alerts:`, error);
      return [];
    }
  }
}

// ================================================================
// CONVENIENCE EXPORTS
// ================================================================

export const juditAPI = JuditApiWrapper;
