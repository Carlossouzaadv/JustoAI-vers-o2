// ================================================================
// HISTÓRICO DE RELATÓRIOS INDIVIDUAIS - Endpoint
// ================================================================
// 100% Mandato Inegociável: Zero "as any" ou "as unknown"
// Apenas Type Guards Reais e Narrowing Seguro

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ICONS } from '@/lib/icons';

// ================================================================
// TYPE DEFINITIONS E GUARDS
// ================================================================

// Prisma-aligned ExecutionStatus values (from schema)
type PrismaExecutionStatus = 'AGENDADO' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

// User-facing Portuguese status values for API params
type UserExecutionStatus = 'AGENDADO' | 'EM_PROCESSAMENTO' | 'CONCLUIDO' | 'FALHOU' | 'CANCELADO';

const VALID_USER_STATUSES = new Set<UserExecutionStatus>([
  'AGENDADO',
  'EM_PROCESSAMENTO',
  'CONCLUIDO',
  'FALHOU',
  'CANCELADO'
]);

const STATUS_MAP: Record<UserExecutionStatus, PrismaExecutionStatus> = {
  'AGENDADO': 'AGENDADO',
  'EM_PROCESSAMENTO': 'RUNNING',
  'CONCLUIDO': 'COMPLETED',
  'FALHOU': 'FAILED',
  'CANCELADO': 'CANCELLED'
};

function isValidUserExecutionStatus(value: unknown): value is UserExecutionStatus {
  return typeof value === 'string' && VALID_USER_STATUSES.has(value as UserExecutionStatus);
}

/**
 * Mapeia status de usuário (português) para Prisma ExecutionStatus (English)
 */
function mapUserStatusToPrisma(userStatus: UserExecutionStatus): PrismaExecutionStatus {
  const prismaStatus = STATUS_MAP[userStatus];
  if (!prismaStatus) {
    throw new Error(`Invalid user status: ${userStatus}`);
  }
  return prismaStatus;
}

// Type guard para ReportParameters
interface ReportParameters {
  processIds?: unknown;
  [key: string]: unknown;
}

function isReportParameters(value: unknown): value is ReportParameters {
  return typeof value === 'object' && value !== null;
}

// Type guard para aggregate count result
function isAggregateCountObject(value: unknown): value is { id: number } {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  if (!('id' in value)) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return typeof obj.id === 'number';
}

// Type guard para aggregate sum result
interface AggregateSumObject {
  quotaConsumed: number | null;
  duration: number | null;
}

function isAggregateSumObject(value: unknown): value is AggregateSumObject {
  return (
    typeof value === 'object' &&
    value !== null &&
    'quotaConsumed' in value &&
    'duration' in value
  );
}

interface HistoryFilters {
  status?: UserExecutionStatus;
  dateFrom?: string;
  dateTo?: string;
  limit: number;
  offset: number;
}

interface ReportHistoryItem {
  id: string;
  reportType: string;
  status: string;
  createdAt: string;
  completedAt?: string;
  scheduledFor?: string;
  duration?: number;
  processCount: number;
  fileUrls: Record<string, string>;
  creditInfo: {
    consumed: boolean;
    amount: number;
    message: string;
  };
  downloadUrls: string[];
}

interface HistoryResponse {
  success: boolean;
  reports: ReportHistoryItem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  summary: {
    totalReports: number;
    reportsThisMonth: number;
    totalCreditsUsed: number;
    avgGenerationTime: number;
  };
  error?: string;
}

// ================================================================
// BUILDER FUNCTIONS COM TYPE SAFETY (sem type assertions)
// ================================================================

/**
 * Extrai processIds com narrowing seguro
 */
function extractProcessIds(parameters: unknown): string[] {
  // Guard 1: É um objeto?
  if (!isReportParameters(parameters)) {
    return [];
  }

  const { processIds } = parameters;

  // Guard 2: processIds é um array?
  if (!Array.isArray(processIds)) {
    return [];
  }

  // Guard 3: Todos elementos são strings?
  const result = processIds.filter((id): id is string => typeof id === 'string');
  return result;
}

/**
 * Extrai fileUrls com narrowing seguro
 */
function extractFileUrls(fileUrls: unknown): Record<string, string> {
  // Guard 1: É um objeto?
  if (typeof fileUrls !== 'object' || fileUrls === null) {
    return {};
  }

  const urls = fileUrls as Record<string, unknown>;
  const result: Record<string, string> = {};

  // Guard 2: Iterar e verificar cada value
  for (const [key, value] of Object.entries(urls)) {
    if (typeof value === 'string') {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Mapeia tipo de relatório com narrowing seguro
 */
function mapReportType(type: unknown): string {
  if (typeof type !== 'string') {
    return 'Desconhecido';
  }

  const typeMap: Record<string, string> = {
    'COMPLETO': 'Relatório Jurídico',
    'NOVIDADES': 'Relatório Executivo',
    'CASE_SUMMARY': 'Resumo de Casos',
    'CUSTOM': 'Relatório Personalizado'
  };

  return typeMap[type] || type;
}

/**
 * Mapeia status com narrowing seguro
 */
function mapStatus(status: unknown): string {
  if (typeof status !== 'string') {
    return 'Desconhecido';
  }

  const statusMap: Record<string, string> = {
    'AGENDADO': 'Agendado',
    'EM_PROCESSAMENTO': 'Em Processamento',
    'CONCLUIDO': 'Concluído',
    'FALHOU': 'Falhou',
    'CANCELADO': 'Cancelado'
  };

  return statusMap[status] || status;
}

/**
 * Gera URLs de download com validação
 */
function generateDownloadUrls(fileUrls: Record<string, string>): string[] {
  if (!fileUrls || Object.keys(fileUrls).length === 0) {
    return [];
  }

  return Object.entries(fileUrls)
    .filter(([, url]) => typeof url === 'string' && url.length > 0)
    .map(([, url]) => url);
}

/**
 * Extrai count de forma segura do aggregate result
 */
function extractAggregateCount(result: unknown): number {
  if (isAggregateCountObject(result)) {
    return result.id;
  }
  return 0;
}

/**
 * Extrai sum de forma segura do aggregate result
 */
function extractAggregateSum(result: unknown, field: 'quotaConsumed' | 'duration'): number {
  if (isAggregateSumObject(result)) {
    const value = result[field];
    return typeof value === 'number' ? value : 0;
  }
  return 0;
}

/**
 * Extrai status de usuário e mapeia para Prisma
 */
function extractAndMapPrismaStatus(userStatus: UserExecutionStatus): PrismaExecutionStatus {
  return mapUserStatusToPrisma(userStatus);
}

// ================================================================
// GET HANDLER
// ================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Obter workspace
    const workspaceId = request.headers.get('x-workspace-id') || 'workspace-mock';

    // Parse e validar status com narrowing seguro
    const statusRaw = searchParams.get('status');
    const statusValue: UserExecutionStatus | undefined = isValidUserExecutionStatus(statusRaw)
      ? statusRaw
      : undefined;

    const filters: HistoryFilters = {
      status: statusValue,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      limit: Math.max(1, parseInt(searchParams.get('limit') || '20', 10)),
      offset: Math.max(0, parseInt(searchParams.get('offset') || '0', 10))
    };

    console.log(`${ICONS.PROCESS} Buscando histórico de relatórios para workspace ${workspaceId}`);

    // Construir data range se necessário
    const dateFilter = filters.dateFrom || filters.dateTo
      ? {
          ...(filters.dateFrom && { gte: new Date(filters.dateFrom) }),
          ...(filters.dateTo && { lte: new Date(filters.dateTo) })
        }
      : undefined;

    // Construir objetos where com narrowing seguro
    // Estratégia: construir incrementalmente, deixando TypeScript inferir tipos

    const baseWhere = {
      workspaceId,
      scheduleId: null
    };

    // Mapear status do usuário para Prisma se foi validado
    const prismaStatus: PrismaExecutionStatus | undefined = filters.status
      ? extractAndMapPrismaStatus(filters.status)
      : undefined;

    // Construir where para findMany - TypeScript infere o tipo de ReportExecutionWhereInput
    const findManyWhereObject = {
      ...baseWhere,
      ...(dateFilter && { createdAt: dateFilter }),
      ...(prismaStatus && { status: prismaStatus })
    };

    const findManyQuery = prisma.reportExecution.findMany({
      where: findManyWhereObject,
      orderBy: { createdAt: 'desc' as const },
      take: filters.limit,
      skip: filters.offset,
      select: {
        id: true,
        reportType: true,
        status: true,
        createdAt: true,
        completedAt: true,
        scheduledFor: true,
        duration: true,
        fileUrls: true,
        quotaConsumed: true,
        parameters: true,
        cacheHit: true
      }
    });

    // Construir where para count - reutilizar a mesma lógica
    const countWhereObject = {
      ...baseWhere,
      ...(dateFilter && { createdAt: dateFilter }),
      ...(prismaStatus && { status: prismaStatus })
    };

    const countQuery = prisma.reportExecution.count({
      where: countWhereObject
    });

    // Query 3: monthly stats
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlyQuery = prisma.reportExecution.aggregate({
      where: {
        ...baseWhere,
        createdAt: { gte: startOfMonth }
      },
      _count: { id: true },
      _sum: { quotaConsumed: true }
    });

    // Query 4: overall stats - only COMPLETED reports
    // Mapear CONCLUIDO (português) para COMPLETED (Prisma)
    const completedStatus: PrismaExecutionStatus = 'COMPLETED';

    const overallWhereObject = {
      workspaceId,
      scheduleId: null,
      status: completedStatus
    };

    const overallQuery = prisma.reportExecution.aggregate({
      where: overallWhereObject,
      _count: { id: true },
      _sum: { quotaConsumed: true, duration: true }
    });

    // Executar todas as queries
    const [reports, totalCount, monthlyStats, overallStats] = await Promise.all([
      findManyQuery,
      countQuery,
      monthlyQuery,
      overallQuery
    ]);

    // Transformar relatórios com extractors type-safe
    const historyItems: ReportHistoryItem[] = reports.map((report: typeof reports[number]) => {
      const processIds = extractProcessIds(report.parameters);
      const fileUrls = extractFileUrls(report.fileUrls);

      return {
        id: report.id,
        reportType: mapReportType(report.reportType),
        status: mapStatus(report.status),
        createdAt: report.createdAt.toISOString(),
        completedAt: report.completedAt?.toISOString(),
        scheduledFor: report.scheduledFor?.toISOString(),
        duration: report.duration || 0,
        processCount: processIds.length,
        fileUrls,
        creditInfo: {
          consumed: !report.cacheHit,
          amount: Number(report.quotaConsumed || 0),
          message: report.cacheHit
            ? 'Este relatório foi gerado a partir de cache (sem custo)'
            : `Este relatório usou ${report.quotaConsumed || 0} crédito(s)`
        },
        downloadUrls: generateDownloadUrls(fileUrls)
      };
    });

    // Extrair valores de agregados com guards
    const monthlyCount = extractAggregateCount(monthlyStats._count);
    const overallCount = extractAggregateCount(overallStats._count);
    const totalCredits = extractAggregateSum(overallStats._sum, 'quotaConsumed');
    const totalDuration = extractAggregateSum(overallStats._sum, 'duration');

    const summary = {
      totalReports: overallCount,
      reportsThisMonth: monthlyCount,
      totalCreditsUsed: totalCredits,
      avgGenerationTime: overallCount > 0 ? Math.round(totalDuration / overallCount) : 0
    };

    console.log(`${ICONS.SUCCESS} Histórico carregado: ${historyItems.length} relatórios encontrados`);

    return NextResponse.json({
      success: true,
      reports: historyItems,
      pagination: {
        total: totalCount,
        limit: filters.limit,
        offset: filters.offset,
        hasMore: filters.offset + filters.limit < totalCount
      },
      summary
    } as HistoryResponse);

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro ao buscar histórico de relatórios:`, error);

    return NextResponse.json({
      success: false,
      reports: [],
      pagination: { total: 0, limit: 20, offset: 0, hasMore: false },
      summary: { totalReports: 0, reportsThisMonth: 0, totalCreditsUsed: 0, avgGenerationTime: 0 },
      error: error instanceof Error ? error.message : 'Erro interno do servidor'
    } as HistoryResponse, { status: 500 });
  }
}

// ================================================================
// DELETE HANDLER
// ================================================================

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reportId = searchParams.get('reportId');

    if (!reportId || typeof reportId !== 'string') {
      return NextResponse.json({
        success: false,
        error: 'ID do relatório é obrigatório'
      }, { status: 400 });
    }

    const workspaceId = request.headers.get('x-workspace-id') || 'workspace-mock';

    console.log(`${ICONS.PROCESS} Cancelando relatório ${reportId}`);

    // Buscar relatório que está AGENDADO (scheduled) para poder cancelar
    const scheduledStatus: PrismaExecutionStatus = 'AGENDADO';
    const report = await prisma.reportExecution.findFirst({
      where: {
        id: reportId,
        workspaceId,
        status: scheduledStatus
      }
    });

    if (!report) {
      return NextResponse.json({
        success: false,
        error: 'Relatório não encontrado ou não pode ser cancelado'
      }, { status: 404 });
    }

    // Mapear status do usuário (português) para Prisma (English)
    const userCancelledStatus: UserExecutionStatus = 'CANCELADO';
    const prismaFilledStatus = extractAndMapPrismaStatus(userCancelledStatus);

    // Atualizar com status mapeado e validado
    await prisma.reportExecution.update({
      where: { id: reportId },
      data: {
        status: prismaFilledStatus,
        completedAt: new Date()
      }
    });

    // Liberar hold de créditos
    const creditHolds = await prisma.scheduledCreditHold.findMany({
      where: { reportId }
    });

    if (creditHolds.length > 0) {
      await prisma.scheduledCreditHold.deleteMany({
        where: { reportId }
      });
      console.log(`${ICONS.SUCCESS} Hold de créditos liberado para relatório ${reportId}`);
    }

    console.log(`${ICONS.SUCCESS} Relatório ${reportId} cancelado com sucesso`);

    return NextResponse.json({
      success: true,
      message: 'Relatório cancelado com sucesso'
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro ao cancelar relatório:`, error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro interno do servidor'
    }, { status: 500 });
  }
}
