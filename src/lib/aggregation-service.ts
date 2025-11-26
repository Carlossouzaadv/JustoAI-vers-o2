// ================================================================
// AGGREGATION SERVICE
// Daily telemetry aggregation and alert triggering
// ================================================================

import { prisma } from '@/lib/prisma';
import { ICONS } from '@/lib/icons';
import { log, logError } from '@/lib/services/logger';

// ================================================================
// TYPES
// ================================================================

export interface AggregationResult {
  success: boolean;
  date: string;
  workspacesProcessed: number;
  alertsCreated: number;
  duration: number;
  errors?: string[];
}

// Type guard for checking JUDIT operation success (status field)
function isSuccessfulJuditCall(status: unknown): status is string {
  return typeof status === 'string' && status === 'success';
}

// Valid JuditAlertType from schema (used as type constraint)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const VALID_JUDIT_ALERT_TYPES = [
  'API_ERROR',
  'RATE_LIMIT',
  'CIRCUIT_BREAKER',
  'HIGH_COST',
  'TIMEOUT',
  'ATTACHMENT_TRIGGER',
  'MONITORING_FAILED',
] as const;

type ValidJuditAlertType = typeof VALID_JUDIT_ALERT_TYPES[number];

export interface WorkspaceMetrics {
  workspaceId: string;
  period: {
    startDate: Date;
    endDate: Date;
  };
  judit: {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    totalCost: number;
    avgDuration: number;
    byOperation: Record<string, { count: number; cost: number }>;
  };
  documents: {
    created: number;
    analyzed: number;
  };
  cases: {
    created: number;
    analyzed: number;
  };
  alerts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

// ================================================================
// ALERT THRESHOLDS
// ================================================================

const ALERT_THRESHOLDS = {
  DAILY_COST_WARNING: 50.0, // R$ 50/day
  DAILY_COST_CRITICAL: 100.0, // R$ 100/day
  FAILURE_RATE_WARNING: 0.15, // 15% failure rate
  FAILURE_RATE_CRITICAL: 0.3, // 30% failure rate
  API_TIMEOUT_COUNT: 10, // consecutive timeouts
};

// ================================================================
// AGGREGATION SERVICE CLASS
// ================================================================

export class AggregationService {
  /**
   * Run daily aggregation for all workspaces
   */
  static async runDailyAggregation(): Promise<AggregationResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      log.info({ msg: '[Daily Aggregation] Starting daily telemetry aggregation...' });

      // Get all active workspaces
      const workspaces = await prisma.workspace.findMany({
        select: { id: true },
        where: { status: 'ACTIVE' },
      });

      log.info({ msg: '[Daily Aggregation] Found  active workspaces' });

      let alertsCreated = 0;

      // Process each workspace
      for (const workspace of workspaces) {
        try {
          const metrics = await this.collectWorkspaceMetrics(workspace.id);
          const newAlerts = await this.evaluateAndCreateAlerts(workspace.id, metrics);
          alertsCreated += newAlerts;

          log.info({ msg: '[Daily Aggregation] Processed workspace :  alerts created' });
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Workspace ${workspace.id}: ${errorMsg}`);
          logError(error, '${ICONS.ERROR} Daily Aggregation Error processing workspace ${workspace.id}:', { component: 'refactored' });
        }
      }

      const duration = Date.now() - startTime;

      log.info({ msg: '[Daily Aggregation] Daily aggregation complete in ms' });

      return {
        success: true,
        date: new Date().toISOString(),
        workspacesProcessed: workspaces.length,
        alertsCreated,
        duration,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';

      logError(error, '${ICONS.ERROR} Daily Aggregation Aggregation failed:', { component: 'refactored' });

      return {
        success: false,
        date: new Date().toISOString(),
        workspacesProcessed: 0,
        alertsCreated: 0,
        duration,
        errors: [errorMsg],
      };
    }
  }

  /**
   * Collect metrics for a workspace for the current day
   */
  private static async collectWorkspaceMetrics(workspaceId: string): Promise<WorkspaceMetrics> {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    endDate.setHours(23, 59, 59, 999);

    // Fetch JUDIT cost tracking
    const juditCalls = await prisma.juditCostTracking.findMany({
      where: {
        workspaceId,
        createdAt: { gte: startDate, lte: endDate },
      },
    });

    // Fetch documents and cases
    const [documents, cases, alerts] = await Promise.all([
      prisma.caseDocument.count({
        where: {
          case: { workspaceId },
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
      prisma.case.count({
        where: {
          workspaceId,
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
      prisma.juditAlert.findMany({
        where: {
          workspaceId,
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
    ]);

    // Local interface matching Prisma JuditCostTracking schema
    interface PrismaJuditCostTracking {
      id: string;
      status: string;
      numeroCnj: string | null;
      workspaceId: string | null;
      createdAt: Date;
      requestId: string | null;
      movementsCount: number;
      errorMessage: string | null;
      totalCost: number;
      inputCost: number;
      outputCost: number;
      inputTokens: number;
      outputTokens: number;
      durationMs: number | null;
      documentsRetrieved: number | null;
      operationType: string;
    }

    // Helper functions for safe extraction
    const getTotalCost = (call: PrismaJuditCostTracking): number =>
      typeof call.totalCost === 'number' ? call.totalCost : 0;

    const getDuration = (call: PrismaJuditCostTracking): number =>
      typeof call.durationMs === 'number' ? call.durationMs : 0;

    // Type assertion for Prisma result
    const typedJuditCalls = juditCalls as unknown as PrismaJuditCostTracking[];

    // Aggregate JUDIT metrics
    const juditMetrics = {
      totalCalls: typedJuditCalls.length,
      successfulCalls: typedJuditCalls.filter((c) => isSuccessfulJuditCall(c.status)).length,
      failedCalls: typedJuditCalls.filter((c) => !isSuccessfulJuditCall(c.status)).length,
      totalCost: typedJuditCalls.reduce((sum, c) => sum + getTotalCost(c), 0),
      avgDuration:
        typedJuditCalls.length > 0
          ? typedJuditCalls.reduce((sum, c) => sum + getDuration(c), 0) / typedJuditCalls.length
          : 0,
      byOperation: {} as Record<string, { count: number; cost: number }>,
    };

    // Group by operation
    for (const call of typedJuditCalls) {
      const op = call.operationType;
      if (!juditMetrics.byOperation[op]) {
        juditMetrics.byOperation[op] = { count: 0, cost: 0 };
      }
      juditMetrics.byOperation[op].count++;
      juditMetrics.byOperation[op].cost += getTotalCost(call);
    }

    // Count analyzed documents
    const analyzedDocs = await prisma.caseAnalysisVersion.count({
      where: {
        workspace: { id: workspaceId },
        createdAt: { gte: startDate, lte: endDate },
      },
    });

    // Count analyzed cases
    const analyzedCases = await prisma.caseAnalysisVersion.findMany({
      where: {
        workspace: { id: workspaceId },
        createdAt: { gte: startDate, lte: endDate },
      },
      distinct: ['caseId'],
    });

    // Local interface for Prisma JuditAlert type
    interface AlertData {
      severity: string;
    }

    // Count alerts by severity
    const alertCounts = {
      critical: alerts.filter((a: AlertData) => a.severity === 'CRITICAL').length,
      high: alerts.filter((a: AlertData) => a.severity === 'HIGH').length,
      medium: alerts.filter((a: AlertData) => a.severity === 'MEDIUM').length,
      low: alerts.filter((a: AlertData) => a.severity === 'LOW').length,
    };

    return {
      workspaceId,
      period: { startDate, endDate },
      judit: juditMetrics,
      documents: { created: documents, analyzed: analyzedDocs },
      cases: { created: cases, analyzed: analyzedCases.length },
      alerts: alertCounts,
    };
  }

  /**
   * Evaluate metrics and create alerts if thresholds exceeded
   */
  private static async evaluateAndCreateAlerts(
    workspaceId: string,
    metrics: WorkspaceMetrics
  ): Promise<number> {
    let alertsCreated = 0;

    try {
      // Check daily cost warnings
      const dailyCost = metrics.judit.totalCost;

      if (dailyCost >= ALERT_THRESHOLDS.DAILY_COST_CRITICAL) {
        await this.createAlertIfNotExists(workspaceId, {
          severity: 'CRITICAL',
          alertType: 'HIGH_COST',
          title: 'CRITICAL: Daily JUDIT costs exceed threshold',
          message: `Daily costs reached R$ ${dailyCost.toFixed(2)} (threshold: R$ ${ALERT_THRESHOLDS.DAILY_COST_CRITICAL})`,
          metadata: { dailyCost, threshold: ALERT_THRESHOLDS.DAILY_COST_CRITICAL },
        });
        alertsCreated++;
      } else if (dailyCost >= ALERT_THRESHOLDS.DAILY_COST_WARNING) {
        await this.createAlertIfNotExists(workspaceId, {
          severity: 'HIGH',
          alertType: 'HIGH_COST',
          title: 'Daily JUDIT costs are high',
          message: `Daily costs reached R$ ${dailyCost.toFixed(2)} (threshold: R$ ${ALERT_THRESHOLDS.DAILY_COST_WARNING})`,
          metadata: { dailyCost, threshold: ALERT_THRESHOLDS.DAILY_COST_WARNING },
        });
        alertsCreated++;
      }

      // Check failure rate
      if (metrics.judit.totalCalls > 0) {
        const failureRate = metrics.judit.failedCalls / metrics.judit.totalCalls;

        if (failureRate >= ALERT_THRESHOLDS.FAILURE_RATE_CRITICAL) {
          await this.createAlertIfNotExists(workspaceId, {
            severity: 'CRITICAL',
            alertType: 'API_ERROR',
            title: 'CRITICAL: High JUDIT API failure rate',
            message: `Failure rate: ${(failureRate * 100).toFixed(1)}% (threshold: ${ALERT_THRESHOLDS.FAILURE_RATE_CRITICAL * 100}%)`,
            metadata: { failureRate, failedCalls: metrics.judit.failedCalls, totalCalls: metrics.judit.totalCalls },
          });
          alertsCreated++;
        } else if (failureRate >= ALERT_THRESHOLDS.FAILURE_RATE_WARNING) {
          await this.createAlertIfNotExists(workspaceId, {
            severity: 'HIGH',
            alertType: 'API_ERROR',
            title: 'High JUDIT API failure rate detected',
            message: `Failure rate: ${(failureRate * 100).toFixed(1)}% (threshold: ${ALERT_THRESHOLDS.FAILURE_RATE_WARNING * 100}%)`,
            metadata: { failureRate, failedCalls: metrics.judit.failedCalls, totalCalls: metrics.judit.totalCalls },
          });
          alertsCreated++;
        }
      }

      // Check for existing unresolved alerts
      if (metrics.alerts.critical > 0 || metrics.alerts.high > 0) {
        // Create summary alert for existing issues
        const totalCriticalHigh = metrics.alerts.critical + metrics.alerts.high;
        await this.createAlertIfNotExists(workspaceId, {
          severity: metrics.alerts.critical > 0 ? 'CRITICAL' : 'HIGH',
          alertType: 'MONITORING_FAILED',
          title: `${totalCriticalHigh} unresolved high-priority alerts`,
          message: `Your workspace has ${metrics.alerts.critical} critical and ${metrics.alerts.high} high-priority alerts that need attention`,
          metadata: {
            criticalCount: metrics.alerts.critical,
            highCount: metrics.alerts.high,
          },
        });
        alertsCreated++;
      }
    } catch (error) {
      logError(error, '${ICONS.ERROR} Aggregation Error evaluating alerts for workspace ${workspaceId}:', { component: 'refactored' });
    }

    return alertsCreated;
  }

  /**
   * Create an alert only if a similar unresolved one doesn't already exist
   */
  private static async createAlertIfNotExists(
    workspaceId: string,
    alertData: {
      severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
      alertType: ValidJuditAlertType;
      title: string;
      message: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<boolean> {
    try {
      // Safely serialize metadata to JSON for Prisma
      const serializedMetadata = alertData.metadata ? JSON.parse(JSON.stringify(alertData.metadata)) : null;

      // Check if similar unresolved alert exists
      const existingAlert = await prisma.juditAlert.findFirst({
        where: {
          workspaceId,
          alertType: alertData.alertType,
          resolved: false,
        },
      });

      if (!existingAlert) {
        await prisma.juditAlert.create({
          data: {
            workspaceId,
            severity: alertData.severity,
            alertType: alertData.alertType,
            title: alertData.title,
            message: alertData.message,
            metadata: serializedMetadata,
          },
        });

        log.info({ msg: '[Aggregation] Created  alert:' });
        return true;
      }

      return false;
    } catch (error) {
      logError(error, '${ICONS.ERROR} Aggregation Error creating alert:', { component: 'refactored' });
      return false;
    }
  }
}

// ================================================================
// CONVENIENCE EXPORTS
// ================================================================

export const aggregationService = AggregationService;
