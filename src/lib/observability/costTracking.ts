// ================================================================
// COST TRACKING SERVICE
// Rastreamento de custos em tempo real da integração JUDIT
// ================================================================

import { PrismaClient, JuditOperationType } from '@prisma/client';
import { costLogger } from './logger';

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

export interface CostTrackingInput {
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

export interface CostSummary {
  totalCost: number;
  searchCost: number;
  attachmentsCost: number;
  operationsCount: number;
  documentsRetrieved: number;
  avgCostPerOperation: number;
}

export interface CostBreakdown {
  operationType: JuditOperationType;
  count: number;
  totalCost: number;
  avgCost: number;
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
    costLogger.error({
      action: 'track_cost_failed',
      error: error instanceof Error ? error.message : String(error),
      input,
    });
  }
}

/**
 * Busca resumo de custos
 */
export async function getCostSummary(
  workspaceId?: string,
  startDate?: Date,
  endDate?: Date
): Promise<CostSummary> {
  const where: any = {};

  if (workspaceId) {
    where.workspaceId = workspaceId;
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  const records = await prisma.juditCostTracking.findMany({
    where,
    select: {
      totalCost: true,
      searchCost: true,
      attachmentsCost: true,
      documentsRetrieved: true,
    },
  });

  const summary: CostSummary = {
    totalCost: 0,
    searchCost: 0,
    attachmentsCost: 0,
    operationsCount: records.length,
    documentsRetrieved: 0,
    avgCostPerOperation: 0,
  };

  for (const record of records) {
    summary.totalCost += Number(record.totalCost);
    summary.searchCost += Number(record.searchCost);
    summary.attachmentsCost += Number(record.attachmentsCost);
    summary.documentsRetrieved += record.documentsRetrieved;
  }

  if (summary.operationsCount > 0) {
    summary.avgCostPerOperation = summary.totalCost / summary.operationsCount;
  }

  return summary;
}

/**
 * Busca breakdown de custos por tipo de operação
 */
export async function getCostBreakdown(
  workspaceId?: string,
  startDate?: Date,
  endDate?: Date
): Promise<CostBreakdown[]> {
  const where: any = {};

  if (workspaceId) {
    where.workspaceId = workspaceId;
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
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

  return records.map((record) => ({
    operationType: record.operationType,
    count: record._count.id,
    totalCost: Number(record._sum.totalCost || 0),
    avgCost: Number(record._sum.totalCost || 0) / record._count.id,
  }));
}

/**
 * Busca custos diários (últimos 30 dias)
 */
export async function getDailyCosts(
  workspaceId?: string,
  days: number = 30
): Promise<Array<{ date: string; cost: number; operations: number }>> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const where: any = {
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

/**
 * Estima custo de uma operação
 */
export function estimateCost(
  operationType: JuditOperationType,
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

interface AlertInput {
  workspaceId?: string;
  alertType: string;
  severity: string;
  title: string;
  message: string;
  errorCode?: string;
  numeroCnj?: string;
  requestId?: string;
  trackingId?: string;
  jobId?: string;
  metadata?: any;
}

/**
 * Cria um alerta
 */
export async function createAlert(input: AlertInput): Promise<void> {
  try {
    await prisma.juditAlert.create({
      data: {
        workspaceId: input.workspaceId,
        alertType: input.alertType as any,
        severity: input.severity as any,
        title: input.title,
        message: input.message,
        errorCode: input.errorCode,
        numeroCnj: input.numeroCnj,
        requestId: input.requestId,
        trackingId: input.trackingId,
        jobId: input.jobId,
        metadata: input.metadata,
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
    costLogger.error({
      action: 'create_alert_failed',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Busca alertas não resolvidos
 */
export async function getUnresolvedAlerts(workspaceId?: string) {
  const where: any = {
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
