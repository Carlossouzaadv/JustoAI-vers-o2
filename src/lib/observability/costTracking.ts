// ================================================================
// COST TRACKING SERVICE
// Rastreamento de custos em tempo real da integração JUDIT
// ================================================================

import { PrismaClient } from '@prisma/client'
import { JuditOperationType, JuditAlertType } from '@/lib/types/database';
import { costLogger } from './logger';
import { withAdminCache, AdminCacheKeys, CacheTTL } from '@/lib/cache/admin-redis';

const prisma = new PrismaClient();

// ================================================================
// CONFIGURATION - Preços da API JUDIT (em BRL)
// ================================================================

export const JUDIT_PRICING = {
  SEARCH_BASE: 0.69, // Custo base de busca (sem anexos)
  DOCUMENT_COST: 0.25, // Custo por documento baixado
  MONITORING_COST: 0.69, // Custo mensal por processo monitorado
} as const;

// ================================================================
// TYPES
// ================================================================

interface CostTrackingInput {
  workspaceId?: string;
  operationType: JuditOperationType;
  numeroCnj?: string;
  documentsRetrieved?: number;
  movementsCount?: number;
  apiCallsCount?: number;
  durationMs?: number;
  requestId?: string;
  trackingId?: string;
  jobId?: string;
  status?: 'success' | 'failed' | 'timeout';
  errorMessage?: string;
}

interface CostSummary {
  totalCost: number;
  searchCost: number;
  attachmentsCost: number;
  operationsCount: number;
  documentsRetrieved: number;
  avgCostPerOperation: number;
}

interface CostBreakdown {
  operationType: JuditOperationType;
  count: number;
  totalCost: number;
  avgCost: number;
}

interface JuditCostGroupByResult {
  operationType: JuditOperationType;
  _count: {
    id: number;
  };
  _sum: {
    totalCost: number | null;
  };
}

// ================================================================
// COST TRACKING
// ================================================================

/**
 * Registra custos de uma operação JUDIT
 */
export async function trackJuditCost(input: CostTrackingInput): Promise<void> {
  try {
    // Calculate costs
    const searchCost = JUDIT_PRICING.SEARCH_BASE;
    const attachmentsCost = (input.documentsRetrieved || 0) * JUDIT_PRICING.DOCUMENT_COST;
    const totalCost = searchCost + attachmentsCost;

    // Save to database
    await prisma.juditCostTracking.create({
      data: {
        workspaceId: input.workspaceId,
        operationType: input.operationType,
        numeroCnj: input.numeroCnj,
        searchCost,
        attachmentsCost,
        totalCost,
        documentsRetrieved: input.documentsRetrieved || 0,
        movementsCount: input.movementsCount || 0,
        apiCallsCount: input.apiCallsCount || 1,
        durationMs: input.durationMs,
        requestId: input.requestId,
        trackingId: input.trackingId,
        jobId: input.jobId,
        status: input.status || 'success',
        errorMessage: input.errorMessage,
      },
    });

    costLogger.info({
      action: 'track_cost',
      operation_type: input.operationType,
      cnj: input.numeroCnj,
      search_cost: searchCost,
      attachments_cost: attachmentsCost,
      total_cost: totalCost,
      documents_retrieved: input.documentsRetrieved || 0,
      status: input.status || 'success',
    });

    // Check for high cost alert
    if (totalCost > 10) {
      // More than R$10 in single operation
      await createAlert({
        workspaceId: input.workspaceId,
        alertType: 'HIGH_COST',
        severity: 'HIGH',
        title: 'High Cost Operation Detected',
        message: `Operation cost R$${totalCost.toFixed(2)} with ${input.documentsRetrieved} documents`,
        numeroCnj: input.numeroCnj,
        requestId: input.requestId,
        metadata: {
          operationType: input.operationType,
          totalCost,
          documentsRetrieved: input.documentsRetrieved,
        },
      });
    }
  } catch (error) {
    costLogger._error({
      action: 'track_cost_failed',
      _error: _error instanceof Error ? _error.message : String(_error),
      input,
    });
  }
}

/**
 * Busca resumo de custos (otimizado com aggregate + cache)
 */
async function _getCostSummaryUncached(
  workspaceId?: string,
  startDate?: Date,
  endDate?: Date
): Promise<CostSummary> {
  const where: Record<string, unknown> = {};

  if (workspaceId) {
    where.workspaceId = workspaceId;
  }

  if (startDate || endDate) {
    where.createdAt = {
      ...(startDate && { gte: startDate }),
      ...(endDate && { lte: endDate }),
    };
  }

  // Use database-level aggregation instead of loading all records into memory
  const aggregateResult = await prisma.juditCostTracking.aggregate({
    where,
    _sum: {
      totalCost: true,
      searchCost: true,
      attachmentsCost: true,
      documentsRetrieved: true,
    },
    _count: {
      id: true,
    },
  });

  const summary: CostSummary = {
    totalCost: Number(aggregateResult._sum.totalCost || 0),
    searchCost: Number(aggregateResult._sum.searchCost || 0),
    attachmentsCost: Number(aggregateResult._sum.attachmentsCost || 0),
    operationsCount: aggregateResult._count.id,
    documentsRetrieved: Number(aggregateResult._sum.documentsRetrieved || 0),
    avgCostPerOperation: 0,
  };

  if (summary.operationsCount > 0) {
    summary.avgCostPerOperation = summary.totalCost / summary.operationsCount;
  }

  return summary;
}

export async function getCostSummary(
  workspaceId?: string,
  startDate?: Date,
  endDate?: Date
): Promise<CostSummary> {
  // Generate cache key based on parameters
  const cacheKey = `admin:cost:summary:${workspaceId ?? 'global'}:${startDate?.toISOString() ?? 'no-start'}:${endDate?.toISOString() ?? 'no-end'}:v1`;

  return withAdminCache(
    cacheKey,
    CacheTTL.COST_SUMMARY,
    () => _getCostSummaryUncached(workspaceId, startDate, endDate)
  );
}

/**
 * Busca breakdown de custos por tipo de operação (com cache)
 */
async function _getCostBreakdownUncached(
  workspaceId?: string,
  startDate?: Date,
  endDate?: Date
): Promise<CostBreakdown[]> {
  const where: Record<string, unknown> = {};

  if (workspaceId) {
    where.workspaceId = workspaceId;
  }

  if (startDate || endDate) {
    where.createdAt = {
      ...(startDate && { gte: startDate }),
      ...(endDate && { lte: endDate }),
    };
  }

  const records = await prisma.juditCostTracking.groupBy({
    by: ['operationType'],
    where,
    _count: {
      id: true,
    },
    _sum: {
      totalCost: true,
    },
  });

  return records.map((record): CostBreakdown => ({
    operationType: record.operationType as JuditOperationType,
    count: record._count.id,
    totalCost: Number(record._sum.totalCost || 0),
    avgCost: Number(record._sum.totalCost || 0) / record._count.id,
  }));
}

export async function getCostBreakdown(
  workspaceId?: string,
  startDate?: Date,
  endDate?: Date
): Promise<CostBreakdown[]> {
  // Generate cache key based on parameters
  const cacheKey = `admin:cost:breakdown:${workspaceId ?? 'global'}:${startDate?.toISOString() ?? 'no-start'}:${endDate?.toISOString() ?? 'no-end'}:v1`;

  return withAdminCache(
    cacheKey,
    CacheTTL.COST_BREAKDOWN,
    () => _getCostBreakdownUncached(workspaceId, startDate, endDate)
  );
}

/**
 * Busca custos diários (últimos N dias, com cache)
 */
async function _getDailyCostsUncached(
  workspaceId?: string,
  days: number = 30
): Promise<Array<{ date: string; cost: number; operations: number }>> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const where: Record<string, unknown> = {
    createdAt: {
      gte: startDate,
    },
  };

  if (workspaceId) {
    where.workspaceId = workspaceId;
  }

  const records = await prisma.juditCostTracking.findMany({
    where,
    select: {
      createdAt: true,
      totalCost: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  // Group by day
  const dailyMap = new Map<string, { cost: number; operations: number }>();

  for (const record of records) {
    const dateKey = record.createdAt.toISOString().split('T')[0];
    const existing = dailyMap.get(dateKey) || { cost: 0, operations: 0 };

    existing.cost += Number(record.totalCost);
    existing.operations += 1;

    dailyMap.set(dateKey, existing);
  }

  return Array.from(dailyMap.entries())
    .map(([date, data]) => ({
      date,
      cost: data.cost,
      operations: data.operations,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function getDailyCosts(
  workspaceId?: string,
  days: number = 30
): Promise<Array<{ date: string; cost: number; operations: number }>> {
  // Generate cache key based on parameters
  const cacheKey = `admin:cost:daily:${workspaceId ?? 'global'}:${days}days:v1`;

  return withAdminCache(
    cacheKey,
    CacheTTL.DAILY_COSTS,
    () => _getDailyCostsUncached(workspaceId, days)
  );
}

/**
 * Estima custo de uma operação
 */
export function estimateCost(
  _operationType: JuditOperationType,
  expectedDocuments: number = 0
): { searchCost: number; attachmentsCost: number; totalCost: number } {
  const searchCost = JUDIT_PRICING.SEARCH_BASE;
  const attachmentsCost = expectedDocuments * JUDIT_PRICING.DOCUMENT_COST;
  const totalCost = searchCost + attachmentsCost;

  return { searchCost, attachmentsCost, totalCost };
}

// ================================================================
// ALERTING
// ================================================================

// Type for alert types as stored in database (Prisma enum)
// Matches JuditAlertType from schema.prisma
export type AlertType =
  | 'API_ERROR'
  | 'RATE_LIMIT'
  | 'CIRCUIT_BREAKER'
  | 'HIGH_COST'
  | 'TIMEOUT'
  | 'ATTACHMENT_TRIGGER'
  | 'MONITORING_FAILED';

export type SeverityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * Type guard to validate AlertType against JuditAlertType
 * Ensures only valid enum values from Prisma schema are used
 */
function isValidAlertType(value: unknown): value is JuditAlertType {
  const validTypes: readonly string[] = [
    'API_ERROR',
    'RATE_LIMIT',
    'CIRCUIT_BREAKER',
    'HIGH_COST',
    'TIMEOUT',
    'ATTACHMENT_TRIGGER',
    'MONITORING_FAILED',
  ] as const;
  return typeof value === 'string' && validTypes.includes(value);
}

interface AlertInput {
  workspaceId?: string;
  alertType: AlertType;
  severity: SeverityLevel;
  title: string;
  message: string;
  errorCode?: string;
  numeroCnj?: string;
  requestId?: string;
  trackingId?: string;
  jobId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Cria um alerta
 */
export async function createAlert(input: AlertInput): Promise<void> {
  try {
    // Type-safe conversion of metadata: unknown -> InputJsonValue
    const metadata = input.metadata ? JSON.parse(JSON.stringify(input.metadata)) : undefined;

    // Validate AlertType is compatible with JuditAlertType using type guard
    const alertTypeValue: unknown = input.alertType;
    if (!isValidAlertType(alertTypeValue)) {
      throw new Error(`Invalid alert type: ${alertTypeValue}`);
    }

    // After validation, alertTypeValue is narrowed to JuditAlertType
    await prisma.juditAlert.create({
      data: {
        workspaceId: input.workspaceId,
        alertType: alertTypeValue,
        severity: input.severity,
        title: input.title,
        message: input.message,
        errorCode: input.errorCode,
        numeroCnj: input.numeroCnj,
        requestId: input.requestId,
        trackingId: input.trackingId,
        jobId: input.jobId,
        metadata,
      },
    });

    costLogger.warn({
      action: 'alert_created',
      alert_type: input.alertType,
      severity: input.severity,
      title: input.title,
      message: input.message,
    });
  } catch (error) {
    costLogger._error({
      action: 'create_alert_failed',
      _error: _error instanceof Error ? _error.message : String(_error),
    });
  }
}

/**
 * Busca alertas não resolvidos
 */
export async function getUnresolvedAlerts(workspaceId?: string) {
  const where: Record<string, unknown> = {
    resolved: false,
  };

  if (workspaceId) {
    where.workspaceId = workspaceId;
  }

  return await prisma.juditAlert.findMany({
    where,
    orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
    take: 50,
  });
}

/**
 * Marca alerta como resolvido
 */
export async function resolveAlert(alertId: string): Promise<void> {
  await prisma.juditAlert.update({
    where: { id: alertId },
    data: {
      resolved: true,
      resolvedAt: new Date(),
    },
  });

  costLogger.info({
    action: 'alert_resolved',
    alert_id: alertId,
  });
}

// ================================================================
// EXPORT
// ================================================================

export type { CostTrackingInput, CostSummary, CostBreakdown };
