// ================================================================
// HISTÓRICO DE RELATÓRIOS INDIVIDUAIS - Endpoint
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ICONS } from '@/lib/icons';

interface HistoryFilters {
  status?: 'AGENDADO' | 'EM_PROCESSAMENTO' | 'CONCLUIDO' | 'FALHOU' | 'CANCELADO';
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Obter workspace do usuário
    const workspaceId = request.headers.get('x-workspace-id') || 'workspace-mock';

    // Parse dos filtros
    const filters: HistoryFilters = {
      status: searchParams.get('status') as unknown,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      limit: parseInt(searchParams.get('limit') || '20'),
      offset: parseInt(searchParams.get('offset') || '0')
    };

    console.log(`${ICONS.PROCESS} Buscando histórico de relatórios para workspace ${workspaceId}`);

    // Construir where clause
    const whereClause: unknown = {
      workspaceId,
      // Filtrar apenas relatórios individuais (não schedules regulares)
      scheduleId: null
    };

    if (filters.status) {
      whereClause.status = filters.status;
    }

    if (filters.dateFrom || filters.dateTo) {
      whereClause.createdAt = {};
      if (filters.dateFrom) {
        whereClause.createdAt.gte = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        whereClause.createdAt.lte = new Date(filters.dateTo);
      }
    }

    // Buscar relatórios com contagem total
    const [reports, totalCount] = await Promise.all([
      prisma.reportExecution.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
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
          cacheHit: true,
          result: true
        }
      }),
      prisma.reportExecution.count({ where: whereClause })
    ]);

    // Transformar dados para resposta
    const historyItems: ReportHistoryItem[] = reports.map(report => {
      const parameters = report.parameters as unknown;
      const processIds = parameters?.processIds || [];

      return {
        id: report.id,
        reportType: mapReportType(report.reportType),
        status: mapStatus(report.status),
        createdAt: report.createdAt.toISOString(),
        completedAt: report.completedAt?.toISOString(),
        scheduledFor: report.scheduledFor?.toISOString(),
        duration: report.duration || 0,
        processCount: processIds.length || 0,
        fileUrls: report.fileUrls as Record<string, string> || {},
        creditInfo: {
          consumed: !report.cacheHit,
          amount: Number(report.quotaConsumed || 0),
          message: report.cacheHit
            ? 'Este relatório foi gerado a partir de cache (sem custo)'
            : `Este relatório usou ${report.quotaConsumed || 0} crédito(s)`
        },
        downloadUrls: generateDownloadUrls(report.fileUrls as Record<string, string>)
      };
    });

    // Calcular estatísticas do mês atual
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [monthlyStats, overallStats] = await Promise.all([
      prisma.reportExecution.aggregate({
        where: {
          workspaceId,
          scheduleId: null,
          createdAt: { gte: startOfMonth }
        },
        _count: { id: true },
        _sum: { quotaConsumed: true }
      }),
      prisma.reportExecution.aggregate({
        where: {
          workspaceId,
          scheduleId: null,
          status: 'CONCLUIDO'
        },
        _count: { id: true },
        _sum: { quotaConsumed: true, duration: true }
      })
    ]);

    const summary = {
      totalReports: overallStats._count.id,
      reportsThisMonth: monthlyStats._count.id,
      totalCreditsUsed: Number(overallStats._sum.quotaConsumed || 0),
      avgGenerationTime: overallStats._count.id > 0
        ? Math.round((overallStats._sum.duration || 0) / overallStats._count.id)
        : 0
    };

    console.log(`${ICONS.SUCCESS} Histórico carregado: ${historyItems.length} relatórios encontrados`);

    return NextResponse.json({
      success: true,
      reports: historyItems,
      pagination: {
        total: totalCount,
        limit: filters.limit!,
        offset: filters.offset!,
        hasMore: filters.offset! + filters.limit! < totalCount
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

// Endpoint para cancelar relatório agendado
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reportId = searchParams.get('reportId');

    if (!reportId) {
      return NextResponse.json({
        success: false,
        error: 'ID do relatório é obrigatório'
      }, { status: 400 });
    }

    const workspaceId = request.headers.get('x-workspace-id') || 'workspace-mock';

    console.log(`${ICONS.PROCESS} Cancelando relatório ${reportId}`);

    // Buscar relatório
    const report = await prisma.reportExecution.findFirst({
      where: {
        id: reportId,
        workspaceId,
        status: 'AGENDADO'
      }
    });

    if (!report) {
      return NextResponse.json({
        success: false,
        error: 'Relatório não encontrado ou não pode ser cancelado'
      }, { status: 404 });
    }

    // Marcar como cancelado
    await prisma.reportExecution.update({
      where: { id: reportId },
      data: {
        status: 'CANCELADO',
        completedAt: new Date()
      }
    });

    // Liberar hold de créditos se existir
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

// ================================================================
// FUNÇÕES AUXILIARES
// ================================================================

function mapReportType(type: string): string {
  const typeMap: Record<string, string> = {
    'COMPLETO': 'Relatório Jurídico',
    'NOVIDADES': 'Relatório Executivo',
    'CASE_SUMMARY': 'Resumo de Casos',
    'CUSTOM': 'Relatório Personalizado'
  };

  return typeMap[type] || type;
}

function mapStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'AGENDADO': 'Agendado',
    'EM_PROCESSAMENTO': 'Em Processamento',
    'CONCLUIDO': 'Concluído',
    'FALHOU': 'Falhou',
    'CANCELADO': 'Cancelado'
  };

  return statusMap[status] || status;
}

function generateDownloadUrls(fileUrls: Record<string, string>): string[] {
  if (!fileUrls || Object.keys(fileUrls).length === 0) {
    return [];
  }

  return Object.entries(fileUrls).map(([format, url]) => url);
}