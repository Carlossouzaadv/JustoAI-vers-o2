// ================================
// COLETOR DE DADOS PARA RELATÓRIOS
// ================================
// Sistema para coletar e organizar dados para diferentes tipos de relatório

import { ICONS } from './icons';
import prisma from './prisma';
import { AIModelRouter } from './ai-model-router';
import type {
  ReportData,
  ProcessReportData,
  ChartData,
  ReportType
} from './report-templates';

// ================================
// TIPOS E INTERFACES
// ================================

export interface ReportFilters {
  workspaceId: string;
  dateRange?: {
    from: Date;
    to: Date;
  };
  clientIds?: string[];
  processIds?: string[];
  priorities?: ('LOW' | 'MEDIUM' | 'HIGH' | 'URGENT')[];
  statuses?: string[];
  courts?: string[];
  includeInactiveProcesses?: boolean;
}

export interface ReportGenerationOptions {
  type: ReportType;
  filters: ReportFilters;
  includeCharts?: boolean;
  includeAIInsights?: boolean;
  includeFinancialData?: boolean;
  maxProcesses?: number;
  daysForUpdates?: number; // Para relatório de novidades
}

export interface DataCollectionStats {
  totalProcesses: number;
  processesIncluded: number;
  movementsAnalyzed: number;
  chartsGenerated: number;
  aiInsightsGenerated: number;
  collectionTime: number;
}

export interface SummaryData {
  total_processes: number;
  active_processes: number;
  new_movements: number;
  critical_alerts: number;
  pending_actions: number;
}

// ================================
// CLASSE PRINCIPAL
// ================================

export class ReportDataCollector {
  private modelRouter: AIModelRouter;

  constructor(_apiKey?: string) {
    this.modelRouter = new AIModelRouter();
  }

  // ================================
  // COLETA DE DADOS PRINCIPAL
  // ================================

  /**
   * Coleta dados para qualquer tipo de relatório
   */
  async collectReportData(options: ReportGenerationOptions): Promise<{
    data: ReportData;
    stats: DataCollectionStats;
  }> {
    const startTime = Date.now();
    console.log(`${ICONS.PROCESS} Coletando dados para relatório: ${options.type}`);

    try {
      // Buscar workspace
      const workspace = await prisma.workspace.findUnique({
        where: { id: options.filters.workspaceId },
        select: { name: true }
      });

      if (!workspace) {
        throw new Error('Workspace não encontrado');
      }

      // Coletar dados base
      const summary = await this.collectSummaryData(options.filters);
      const processes = await this.collectProcessData(options);

      // Dados específicos por tipo
      let filteredProcesses = processes;
      let insights: string[] = [];
      let charts: ChartData[] = [];

      switch (options.type) {
        case 'complete':
          // Relatório completo - todos os dados
          if (options.includeCharts) {
            charts = await this.generateCharts(processes, options.filters);
          }
          if (options.includeAIInsights) {
            insights = await this.generateAIInsights(processes, summary);
          }
          break;

        case 'updates':
          // Apenas novidades dos últimos N dias
          const days = options.daysForUpdates || 7;
          filteredProcesses = this.filterRecentUpdates(processes, days);
          if (options.includeAIInsights) {
            insights = await this.generateUpdateInsights(filteredProcesses, days);
          }
          break;

        case 'executive':
          // Resumo executivo - apenas processos críticos
          filteredProcesses = processes
            .filter(p => ['HIGH', 'URGENT'].includes(p.priority))
            .slice(0, 15); // Máximo 15 para executivo
          if (options.includeAIInsights) {
            insights = await this.generateExecutiveInsights(filteredProcesses, summary);
          }
          break;

        case 'financial':
          // Relatório financeiro
          filteredProcesses = processes.filter(p => p.financial_info);
          charts = await this.generateFinancialCharts(filteredProcesses);
          break;
      }

      const data: ReportData = {
        title: this.generateReportTitle(options.type, options.filters),
        subtitle: this.generateReportSubtitle(options.type, options.filters),
        generated_at: new Date(),
        generated_by: 'Sistema JustoAI',
        workspace_name: workspace.name,
        period: options.filters.dateRange,
        summary,
        processes: filteredProcesses,
        charts: charts.length > 0 ? charts : undefined,
        insights: insights.length > 0 ? insights : undefined
      };

      const stats: DataCollectionStats = {
        totalProcesses: processes.length,
        processesIncluded: filteredProcesses.length,
        movementsAnalyzed: processes.reduce((sum, p) => sum + (p.recent_movements?.length || 0), 0),
        chartsGenerated: charts.length,
        aiInsightsGenerated: insights.length,
        collectionTime: Date.now() - startTime
      };

      console.log(`${ICONS.SUCCESS} Dados coletados em ${stats.collectionTime}ms`);
      return { data, stats };

    } catch (error) {
      console.error(`${ICONS.ERROR} Erro na coleta de dados:`, error);
      throw error;
    }
  }

  // ================================
  // COLETA DE DADOS ESPECÍFICOS
  // ================================

  /**
   * Coleta dados de resumo executivo
   */
  private async collectSummaryData(filters: ReportFilters) {
    const dateFilter = filters.dateRange ? {
      gte: filters.dateRange.from,
      lte: filters.dateRange.to
    } : undefined;

    const [
      totalProcesses,
      activeProcesses,
      newMovements,
      criticalAlerts,
      pendingActions
    ] = await Promise.all([
      // Total de processos
      prisma.monitoredProcess.count({
        where: {
          workspaceId: filters.workspaceId,
          ...(filters.clientIds ? { clientId: { in: filters.clientIds } } : {})
        }
      }),

      // Processos ativos
      prisma.monitoredProcess.count({
        where: {
          workspaceId: filters.workspaceId,
          monitoringStatus: 'ACTIVE',
          ...(filters.clientIds ? { clientId: { in: filters.clientIds } } : {})
        }
      }),

      // Novas movimentações
      prisma.processMovement.count({
        where: {
          monitoredProcess: {
            workspaceId: filters.workspaceId
          },
          ...(dateFilter ? { date: dateFilter } : {})
        }
      }),

      // Alertas críticos
      prisma.processAlert.count({
        where: {
          monitoredProcess: {
            workspaceId: filters.workspaceId
          },
          severity: { in: ['HIGH', 'URGENT'] },
          read: false,
          ...(dateFilter ? { createdAt: dateFilter } : {})
        }
      }),

      // Ações pendentes
      prisma.processMovement.count({
        where: {
          monitoredProcess: {
            workspaceId: filters.workspaceId
          },
          requiresAction: true,
          ...(dateFilter ? { date: dateFilter } : {})
        }
      })
    ]);

    return {
      total_processes: totalProcesses,
      active_processes: activeProcesses,
      new_movements: newMovements,
      critical_alerts: criticalAlerts,
      pending_actions: pendingActions
    };
  }

  /**
   * Coleta dados detalhados dos processos
   */
  private async collectProcessData(options: ReportGenerationOptions): Promise<ProcessReportData[]> {
    const { filters } = options;
    const limit = options.maxProcesses || 1000;

    const processes = await prisma.monitoredProcess.findMany({
      where: {
        workspaceId: filters.workspaceId,
        ...(filters.clientIds ? { clientId: { in: filters.clientIds } } : {}),
        ...(filters.processIds ? { id: { in: filters.processIds } } : {}),
        ...(filters.statuses ? { status: { in: filters.statuses } } : {}),
        ...(filters.courts ? { court: { in: filters.courts } } : {}),
        ...(filters.includeInactiveProcesses ? {} : { monitoringStatus: 'ACTIVE' })
      },
      include: {
        movements: {
          orderBy: { date: 'desc' },
          take: 10,
          where: filters.dateRange ? {
            date: {
              gte: filters.dateRange.from,
              lte: filters.dateRange.to
            }
          } : undefined
        },
        alerts: {
          where: { read: false },
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      },
      orderBy: [
        { lastSync: 'desc' },
        { updatedAt: 'desc' }
      ],
      take: limit
    });

    // Converter para formato do relatório
    return processes.map(process => {
      const lastMovement = process.movements[0];
      const recentMovements = process.movements.map(m => ({
        date: m.date,
        type: m.type,
        description: m.description,
        importance: m.importance
      }));

      // Determinar prioridade baseada em alertas e movimentações
      let priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' = 'LOW';
      if (process.alerts.some(a => a.severity === 'URGENT')) {
        priority = 'URGENT';
      } else if (process.alerts.some(a => a.severity === 'HIGH')) {
        priority = 'HIGH';
      } else if (process.alerts.length > 0 || recentMovements.length > 2) {
        priority = 'MEDIUM';
      }

      // Extrair dados do processData JSON
      const processData = this.parseProcessData(process.processData);
      const nextDeadline = this.calculateNextDeadline(process.movements);

      return {
        id: process.id,
        number: process.processNumber,
        client_name: process.clientName || 'Cliente não informado',
        subject: processData.subject || 'Assunto não informado',
        court: process.court || 'Tribunal não informado',
        status: process.monitoringStatus,
        priority,
        last_movement: lastMovement ? {
          date: lastMovement.date,
          description: lastMovement.description,
          requires_action: lastMovement.requiresAction
        } : undefined,
        next_deadline: nextDeadline,
        recent_movements: recentMovements.length > 0 ? recentMovements : undefined,
        financial_info: processData.financialInfo
      } as ProcessReportData;
    });
  }

  // ================================
  // MÉTODOS AUXILIARES
  // ================================

  /**
   * Extrai dados estruturados do processData JSON
   */
  private parseProcessData(processData: Record<string, unknown>): {
    subject?: string;
    financialInfo?: {
      valor_principal?: number;
      multas?: number;
      total?: number;
      currency?: string;
    };
  } {
    try {
      if (!processData || typeof processData !== 'object') {
        return {};
      }

      // Tentar extrair assunto
      const subject = processData.assunto ||
                     processData.subject ||
                     processData.titulo ||
                     processData.descricao;

      // Tentar extrair informações financeiras
      const financialInfo = this.extractFinancialInfo(processData);

      return {
        subject: subject?.toString().trim(),
        financialInfo
      };
    } catch (error) {
      console.error('Erro ao analisar processData:', error);
      return {};
    }
  }

  /**
   * Extrai informações financeiras do processData
   */
  private extractFinancialInfo(data: Record<string, unknown>): Record<string, unknown> {
    try {
      const financial: Record<string, unknown> = {};

      // Buscar valores em diferentes formatos
      const possibleFields = [
        'valor_principal', 'valorPrincipal', 'valor', 'value',
        'multas', 'multa', 'penalties', 'fine',
        'total', 'valor_total', 'valorTotal'
      ];

      for (const field of possibleFields) {
        const value = data[field];
        if (value && (typeof value === 'number' || typeof value === 'string')) {
          const numericValue = typeof value === 'string' ? parseFloat(value.replace(/[^\d.,]/g, '').replace(',', '.')) : value;
          if (!isNaN(numericValue) && numericValue > 0) {
            if (field.includes('principal') || field === 'valor' || field === 'value') {
              financial.valor_principal = numericValue;
            } else if (field.includes('multa') || field.includes('fine') || field.includes('penalties')) {
              financial.multas = numericValue;
            } else if (field.includes('total')) {
              financial.total = numericValue;
            }
          }
        }
      }

      // Calcular total se não fornecido
      if (!financial.total && (financial.valor_principal || financial.multas)) {
        financial.total = (financial.valor_principal || 0) + (financial.multas || 0);
      }

      // Adicionar moeda padrão
      if (Object.keys(financial).length > 0) {
        financial.currency = data.currency || data.moeda || 'BRL';
      }

      return Object.keys(financial).length > 0 ? financial : undefined;
    } catch (error) {
      console.error('Erro ao extrair informações financeiras:', error);
      return undefined;
    }
  }

  /**
   * Calcula próximo prazo baseado nas movimentações
   */
  private calculateNextDeadline(movements: Array<Record<string, unknown>>): { date: Date; description: string; days_remaining: number } | undefined {
    try {
      if (!movements || movements.length === 0) {
        return undefined;
      }

      const now = new Date();
      const upcomingDeadlines: Array<{ date: Date; description: string; days_remaining: number }> = [];

      for (const movement of movements) {
        // Buscar por padrões de prazo na descrição
        const description = movement.description || '';
        const deadlinePatterns = [
          /prazo.*?(\d{1,2}).*?dias?/i,
          /prazo.*?até.*?(\d{1,2}\/\d{1,2}\/\d{4})/i,
          /vencimento.*?(\d{1,2}\/\d{1,2}\/\d{4})/i,
          /manifestar.*?(\d{1,2}).*?dias?/i
        ];

        for (const pattern of deadlinePatterns) {
          const match = description.match(pattern);
          if (match) {
            let deadlineDate: Date | null = null;

            if (match[1].includes('/')) {
              // Data específica
              deadlineDate = new Date(match[1].split('/').reverse().join('-'));
            } else {
              // Número de dias
              const days = parseInt(match[1]);
              deadlineDate = new Date(movement.date);
              deadlineDate.setDate(deadlineDate.getDate() + days);
            }

            if (deadlineDate && deadlineDate > now) {
              const daysRemaining = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              upcomingDeadlines.push({
                date: deadlineDate,
                description: `Prazo para ${description.substring(0, 50)}...`,
                days_remaining: daysRemaining
              });
            }
          }
        }
      }

      // Retornar o prazo mais próximo
      upcomingDeadlines.sort((a, b) => a.date.getTime() - b.date.getTime());
      return upcomingDeadlines[0];

    } catch (error) {
      console.error('Erro ao calcular próximo prazo:', error);
      return undefined;
    }
  }

  // ================================
  // GERAÇÃO DE INSIGHTS IA
  // ================================

  /**
   * Gera insights gerais com IA
   */
  private async generateAIInsights(processes: ProcessReportData[], summary: Record<string, unknown>): Promise<string[]> {
    try {
      console.log(`${ICONS.PROCESS} Gerando insights de IA...`);

      const data = {
        summary,
        critical_processes: processes.filter(p => ['HIGH', 'URGENT'].includes(p.priority)),
        recent_movements: processes
          .flatMap(p => p.recent_movements || [])
          .slice(0, 20),
        total_processes: processes.length
      };

      const result = await this.modelRouter.analyzeEssential(
        `Analise estes dados jurídicos e forneça insights executivos:\n\n${JSON.stringify(data, null, 2)}`,
        summary.workspace_id
      );

      // Extrair insights da resposta da IA
      const insights = this.extractInsights(result.analysis || result.content || '');
      return insights.slice(0, 5); // Máximo 5 insights

    } catch (error) {
      console.warn(`${ICONS.WARNING} Erro ao gerar insights de IA:`, error);
      return [
        `Identificados ${summary.critical_alerts} alertas que requerem atenção imediata`,
        `Total de ${summary.new_movements} movimentações recentes registradas`,
        `${summary.pending_actions} processos com ações pendentes identificados`
      ];
    }
  }

  /**
   * Gera insights específicos para relatório de novidades
   */
  private async generateUpdateInsights(processes: ProcessReportData[], days: number): Promise<string[]> {
    const insights = [
      `Identificadas novidades em ${processes.length} processos nos últimos ${days} dias`,
      `${processes.filter(p => p.priority === 'URGENT').length} processos requerem ação urgente`,
    ];

    // Análises específicas de tendências
    const courtsCount = new Map<string, number>();
    processes.forEach(p => {
      courtsCount.set(p.court, (courtsCount.get(p.court) || 0) + 1);
    });

    const topCourt = Array.from(courtsCount.entries()).sort((a, b) => b[1] - a[1])[0];
    if (topCourt) {
      insights.push(`${topCourt[0]} apresentou maior volume de movimentações (${topCourt[1]} processos)`);
    }

    return insights;
  }

  /**
   * Gera insights executivos
   */
  private async generateExecutiveInsights(processes: ProcessReportData[], summary: SummaryData): Promise<string[]> {
    return [
      `${processes.filter(p => p.priority === 'URGENT').length} processos críticos identificados`,
      `Taxa de atividade: ${Math.round((summary.active_processes / summary.total_processes) * 100)}%`,
      `${summary.pending_actions} ações requerem intervenção imediata`,
      'Recomendada revisão dos processos de alta prioridade esta semana'
    ];
  }

  // ================================
  // GERAÇÃO DE GRÁFICOS
  // ================================

  /**
   * Gera gráficos para o relatório
   */
  private async generateCharts(processes: ProcessReportData[], _filters: ReportFilters): Promise<ChartData[]> {
    const charts: ChartData[] = [];

    // Gráfico de processos por status
    const statusCount = new Map<string, number>();
    processes.forEach(p => {
      statusCount.set(p.status, (statusCount.get(p.status) || 0) + 1);
    });

    charts.push({
      type: 'pie',
      title: 'Processos por Status',
      data: Array.from(statusCount.values()),
      labels: Array.from(statusCount.keys())
    });

    // Gráfico de processos por prioridade
    const priorityCount = new Map<string, number>();
    processes.forEach(p => {
      priorityCount.set(p.priority, (priorityCount.get(p.priority) || 0) + 1);
    });

    charts.push({
      type: 'bar',
      title: 'Processos por Prioridade',
      data: Array.from(priorityCount.values()),
      labels: Array.from(priorityCount.keys())
    });

    // Gráfico de processos por tribunal
    const courtCount = new Map<string, number>();
    processes.forEach(p => {
      courtCount.set(p.court, (courtCount.get(p.court) || 0) + 1);
    });

    charts.push({
      type: 'bar',
      title: 'Processos por Tribunal',
      data: Array.from(courtCount.values()),
      labels: Array.from(courtCount.keys())
    });

    return charts;
  }

  private async generateFinancialCharts(processes: ProcessReportData[]): Promise<ChartData[]> {
    const charts: ChartData[] = [];

    const processesWithFinancial = processes.filter(p => p.financial_info);

    if (processesWithFinancial.length > 0) {
      // Valor total por cliente
      const valueByClient = new Map<string, number>();
      processesWithFinancial.forEach(p => {
        if (p.financial_info?.case_value) {
          valueByClient.set(
            p.client_name,
            (valueByClient.get(p.client_name) || 0) + p.financial_info.case_value
          );
        }
      });

      charts.push({
        type: 'bar',
        title: 'Valor Total por Cliente (R$)',
        data: Array.from(valueByClient.values()),
        labels: Array.from(valueByClient.keys())
      });
    }

    return charts;
  }

  // ================================
  // UTILITÁRIOS PRIVADOS
  // ================================

  private filterRecentUpdates(processes: ProcessReportData[], days: number): ProcessReportData[] {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    return processes.filter(process => {
      // Verificar se tem movimentações recentes
      return process.recent_movements?.some(movement =>
        movement.date > cutoffDate
      ) || (process.last_movement && process.last_movement.date > cutoffDate);
    });
  }

  private generateReportTitle(type: ReportType, _filters: ReportFilters): string {
    switch (type) {
      case 'complete':
        return 'Relatório Completo de Processos Jurídicos';
      case 'updates':
        return 'Relatório de Novidades';
      case 'executive':
        return 'Resumo Executivo';
      case 'financial':
        return 'Relatório Financeiro';
      default:
        return 'Relatório de Processos';
    }
  }

  private generateReportSubtitle(type: ReportType, filters: ReportFilters): string {
    const periodText = filters.dateRange ?
      `Período: ${filters.dateRange.from.toLocaleDateString('pt-BR')} a ${filters.dateRange.to.toLocaleDateString('pt-BR')}` :
      'Dados atualizados';

    switch (type) {
      case 'updates':
        return `Movimentações recentes - ${periodText}`;
      case 'executive':
        return `Visão geral dos processos - ${periodText}`;
      case 'financial':
        return `Análise de valores e custos - ${periodText}`;
      default:
        return periodText;
    }
  }

  private extractInsights(aiResponse: string): string[] {
    // Parser simples para extrair insights da resposta da IA
    const lines = aiResponse.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 20)
      .filter(line =>
        line.includes('insight') ||
        line.includes('observ') ||
        line.includes('identif') ||
        line.includes('reco') ||
        line.startsWith('•') ||
        line.startsWith('-') ||
        line.includes('processo')
      );

    return lines.slice(0, 5).map(line =>
      line.replace(/^[•\-\*]\s*/, '').trim()
    );
  }
}

// ================================
// INSTÂNCIA SINGLETON
// ================================

let globalDataCollector: ReportDataCollector | null = null;

/**
 * Obtém a instância global do coletor de dados
 */
export function getReportDataCollector(): ReportDataCollector {
  if (!globalDataCollector) {
    globalDataCollector = new ReportDataCollector();
  }
  return globalDataCollector;
}

export default ReportDataCollector;