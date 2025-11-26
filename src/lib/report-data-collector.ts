// ================================
// COLETOR DE DADOS PARA RELATÓRIOS
// ================================
// Sistema para coletar e organizar dados para diferentes tipos de relatório

import { ICONS } from './icons';
import prisma from './prisma';
import { AIModelRouter } from './ai-model-router';
import { log, logError } from '@/lib/services/logger';
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

/**
 * Type for individual process movement from Prisma query
 * Explicitly typed to match ProcessMovement model
 */
interface ProcessMovementFromQuery {
  id: string;
  monitoredProcessId: string;
  date: Date;
  type: string;
  description: string;
  content: string | null;
  importance: string | null;
  requiresAction: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Type for individual process alert from Prisma query
 * Explicitly typed to match ProcessAlert model
 */
interface ProcessAlertFromQuery {
  id: string;
  monitoredProcessId: string;
  type: string;
  severity: string;
  message: string;
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Prisma query result type for processes with movements and alerts
 * Explicitly typed to match MonitoredProcess model with relations
 */
interface ProcessWithRelations {
  id: string;
  workspaceId: string;
  caseId: string | null;
  processNumber: string;
  court: string;
  clientName: string;
  processData: unknown;
  monitoringStatus: string;
  lastSync: Date | null;
  syncFrequency: string;
  alertsEnabled: boolean;
  alertRecipients: string[];
  source: string;
  extractionMethod: string;
  createdAt: Date;
  updatedAt: Date;
  movements: ProcessMovementFromQuery[];
  alerts: ProcessAlertFromQuery[];
}

// ================================
// TYPE GUARDS
// ================================

/**
 * Type guard to safely validate AI model response structure
 * Returns true if data is an object with string properties
 */
function isAIResult(data: unknown): data is Record<string, unknown> {
  return typeof data === 'object' && data !== null;
}

/**
 * Extracts analysis text from AI model response
 * Safely validates the object structure without casting
 */
function extractAnalysisTextFromResult(result: unknown): string {
  if (!isAIResult(result)) {
    return '';
  }

  // Check for 'analysis' property first (after type guard)
  if (typeof result.analysis === 'string') {
    return result.analysis;
  }

  // Fall back to 'content' property
  if (typeof result.content === 'string') {
    return result.content;
  }

  return '';
}

/**
 * Type guard to validate SummaryData structure (kept for future validation needs)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
function isSummaryData(data: unknown): data is SummaryData {
  if (!isAIResult(data)) {
    return false;
  }

  return (
    typeof data.total_processes === 'number' &&
    typeof data.active_processes === 'number' &&
    typeof data.new_movements === 'number' &&
    typeof data.critical_alerts === 'number' &&
    typeof data.pending_actions === 'number'
  );
}

/**
 * Helper to safely get string property value
 */
function getStringProperty(obj: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string') {
      return value;
    }
  }
  return undefined;
}

/**
 * Helper to safely get number property value
 */
function getNumberProperty(obj: Record<string, unknown>, key: string): number | undefined {
  const value = obj[key];
  if (typeof value === 'number') {
    return value;
  }
  return undefined;
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
    log.info({ msg: 'Coletando dados para relatório:' });

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

      log.info({ msg: 'Dados coletados em ms' });
      return { data, stats };

    } catch (error) {
      logError(_error, '${ICONS.ERROR} Erro na coleta de dados:', { component: 'refactored' });
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
    return processes.map((process) => {
      const lastMovement = process.movements[0];
      const recentMovements = process.movements.map((m) => ({
        date: m.date,
        type: m.type,
        description: m.description,
        importance: m.importance ?? 'NORMAL'
      }));

      // Determinar prioridade baseada em alertas e movimentações
      let priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' = 'LOW';
      if (process.alerts.some((a) => a.severity === 'URGENT')) {
        priority = 'URGENT';
      } else if (process.alerts.some((a) => a.severity === 'HIGH')) {
        priority = 'HIGH';
      } else if (process.alerts.length > 0 || recentMovements.length > 2) {
        priority = 'MEDIUM';
      }

      // Extrair dados do processData JSON - safely validate structure
      const processDataObj: Record<string, unknown> =
        isAIResult(process.processData)
          ? process.processData
          : {};
      const processData = this.parseProcessData(processDataObj);
      const nextDeadline = this.calculateNextDeadline(process.movements);

      // Safely construct ProcessReportData without casting
      const reportData: ProcessReportData = {
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
      };

      return reportData;
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
      case_value?: number;
      costs_incurred?: number;
      estimated_duration?: string;
    };
  } {
    try {
      if (!isAIResult(processData)) {
        return {};
      }

      // Tentar extrair assunto usando type-safe helper
      const subject = getStringProperty(
        processData,
        'assunto',
        'subject',
        'titulo',
        'descricao'
      );

      // Tentar extrair informações financeiras
      const rawFinancialInfo = this.extractFinancialInfo(processData);

      // Map internal representation to ProcessReportData format
      let financialInfo: { case_value?: number; costs_incurred?: number; estimated_duration?: string } | undefined;
      if (rawFinancialInfo) {
        financialInfo = {
          case_value: rawFinancialInfo.valor_principal,
          costs_incurred: rawFinancialInfo.multas,
          estimated_duration: typeof rawFinancialInfo.currency === 'string' ? rawFinancialInfo.currency : undefined
        };
      }

      return {
        subject: subject?.trim(),
        financialInfo
      };
    } catch (error) {
      logError(_error, 'Erro ao analisar processData:', { component: 'refactored' });
      return {};
    }
  }

  /**
   * Safely parse numeric value from string or number
   */
  private parseNumericValue(value: string | number): number | null {
    if (typeof value === 'number') {
      return value > 0 ? value : null;
    }

    if (typeof value === 'string') {
      const cleaned = value.replace(/[^\d.,]/g, '').replace(',', '.');
      const numericValue = parseFloat(cleaned);
      return !isNaN(numericValue) && numericValue > 0 ? numericValue : null;
    }

    return null;
  }

  /**
   * Extrai informações financeiras do processData
   */
  private extractFinancialInfo(data: Record<string, unknown>): { valor_principal?: number; multas?: number; total?: number; currency?: string } | undefined {
    try {
      const financial: { valor_principal?: number; multas?: number; total?: number; currency?: string } = {};

      // Buscar valores em diferentes formatos
      const possibleFields = [
        'valor_principal', 'valorPrincipal', 'valor', 'value',
        'multas', 'multa', 'penalties', 'fine',
        'total', 'valor_total', 'valorTotal'
      ];

      for (const field of possibleFields) {
        const value = data[field];
        if (value !== undefined && value !== null && (typeof value === 'number' || typeof value === 'string')) {
          const numericValue = this.parseNumericValue(value);

          if (numericValue !== null) {
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
      if (
        financial.total === undefined &&
        (financial.valor_principal !== undefined || financial.multas !== undefined)
      ) {
        const principal = financial.valor_principal ?? 0;
        const multas = financial.multas ?? 0;
        financial.total = principal + multas;
      }

      // Adicionar moeda padrão se houver dados financeiros
      if (Object.keys(financial).length > 0) {
        const currency = data.currency ?? data.moeda;
        financial.currency = typeof currency === 'string' ? currency : 'BRL';
      }

      return Object.keys(financial).length > 0 ? financial : undefined;
    } catch (error) {
      logError(_error, 'Erro ao extrair informações financeiras:', { component: 'refactored' });
      return undefined;
    }
  }

  /**
   * Safely extracts deadline Date from regex match
   */
  private extractDeadlineFromMatch(match: RegExpMatchArray | null, movementDate: Date): Date | null {
    if (!match || !match[1]) {
      return null;
    }

    try {
      let deadlineDate: Date | null = null;

      if (match[1].includes('/')) {
        // Data específica (dd/mm/yyyy)
        const dateParts = match[1].split('/');
        if (dateParts.length === 3) {
          deadlineDate = new Date(dateParts.reverse().join('-'));
        }
      } else {
        // Número de dias
        const days = parseInt(match[1], 10);
        if (!isNaN(days) && days > 0) {
          deadlineDate = new Date(movementDate);
          deadlineDate.setDate(deadlineDate.getDate() + days);
        }
      }

      if (deadlineDate && deadlineDate.getTime() > Date.now()) {
        return deadlineDate;
      }

      return null;
    } catch (error) {
      logError(_error, 'Erro ao extrair prazo do padrão:', { component: 'refactored' });
      return null;
    }
  }

  /**
   * Calcula próximo prazo baseado nas movimentações
   * Retorna apenas a Date do prazo mais próximo que é válido (futuro)
   */
  private calculateNextDeadline(movements: Array<{ deadline?: Date | null; date?: unknown; description?: unknown }>): Date | undefined {
    try {
      if (!movements || movements.length === 0) {
        return undefined;
      }

      const upcomingDeadlines: Date[] = [];
      const deadlinePatterns = [
        /prazo.*?(\d{1,2}).*?dias?/i,
        /prazo.*?até.*?(\d{1,2}\/\d{1,2}\/\d{4})/i,
        /vencimento.*?(\d{1,2}\/\d{1,2}\/\d{4})/i,
        /manifestar.*?(\d{1,2}).*?dias?/i
      ];

      for (const movement of movements) {
        // Buscar por padrões de prazo na descrição
        const description = movement.description;

        // Validar que movement.date existe e é Date ou pode ser convertido
        const movementDate = movement.date instanceof Date
          ? movement.date
          : typeof movement.date === 'string' || typeof movement.date === 'number'
            ? new Date(movement.date)
            : new Date();

        // Validate description is a string before matching
        const descriptionStr = typeof movement.description === 'string' ? movement.description : '';

        for (const pattern of deadlinePatterns) {
          const match = descriptionStr.match(pattern);
          const deadline = this.extractDeadlineFromMatch(match, movementDate);

          if (deadline) {
            upcomingDeadlines.push(deadline);
          }
        }
      }

      // Retornar o prazo mais próximo
      if (upcomingDeadlines.length > 0) {
        upcomingDeadlines.sort((a, b) => a.getTime() - b.getTime());
        return upcomingDeadlines[0];
      }

      return undefined;
    } catch (error) {
      logError(_error, 'Erro ao calcular próximo prazo:', { component: 'refactored' });
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
      log.info({ msg: 'Gerando insights de IA...' });

      const data = {
        summary,
        critical_processes: processes.filter(p => ['HIGH', 'URGENT'].includes(p.priority)),
        recent_movements: processes
          .flatMap(p => p.recent_movements || [])
          .slice(0, 20),
        total_processes: processes.length
      };

      // Safely extract workspace ID
      const workspaceId = typeof summary.workspace_id === 'string'
        ? summary.workspace_id
        : '';

      const result = await this.modelRouter.analyzeEssential(
        `Analise estes dados jurídicos e forneça insights executivos:\n\n${JSON.stringify(data, null, 2)}`,
        workspaceId
      );

      // Extrair insights da resposta da IA - use type-safe helper function
      const analysisText = extractAnalysisTextFromResult(result);
      const insights = this.extractInsights(analysisText);
      return insights.slice(0, 5); // Máximo 5 insights

    } catch (error) {
      logError(_error, '${ICONS.WARNING} Erro ao gerar insights de IA:', { component: 'refactored' });

      // Safely build fallback insights from summary data
      const fallbackInsights: string[] = [];

      // Extract values safely with type checking
      const criticalAlerts = getNumberProperty(summary, 'critical_alerts');
      const newMovements = getNumberProperty(summary, 'new_movements');
      const pendingActions = getNumberProperty(summary, 'pending_actions');

      if (typeof criticalAlerts === 'number') {
        fallbackInsights.push(`Identificados ${criticalAlerts} alertas que requerem atenção imediata`);
      }

      if (typeof newMovements === 'number') {
        fallbackInsights.push(`Total de ${newMovements} movimentações recentes registradas`);
      }

      if (typeof pendingActions === 'number') {
        fallbackInsights.push(`${pendingActions} processos com ações pendentes identificados`);
      }

      return fallbackInsights.length > 0
        ? fallbackInsights
        : ['Insights não disponíveis no momento'];
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
   * Safely convert Map entries to chart data format
   */
  private mapCountsToChartData(counts: Map<string, number>): { data: Array<Record<string, unknown>>; labels: string[] } {
    const data: Array<Record<string, unknown>> = [];
    const labels: string[] = [];

    // Iterate in order to ensure data and labels align
    const entries = Array.from(counts.entries());
    for (const [label, count] of entries) {
      labels.push(label);
      data.push({ value: count });
    }

    return { data, labels };
  }

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

    if (statusCount.size > 0) {
      const { data, labels } = this.mapCountsToChartData(statusCount);
      charts.push({
        type: 'pie',
        title: 'Processos por Status',
        data,
        labels
      });
    }

    // Gráfico de processos por prioridade
    const priorityCount = new Map<string, number>();
    processes.forEach(p => {
      priorityCount.set(p.priority, (priorityCount.get(p.priority) || 0) + 1);
    });

    if (priorityCount.size > 0) {
      const { data, labels } = this.mapCountsToChartData(priorityCount);
      charts.push({
        type: 'bar',
        title: 'Processos por Prioridade',
        data,
        labels
      });
    }

    // Gráfico de processos por tribunal
    const courtCount = new Map<string, number>();
    processes.forEach(p => {
      courtCount.set(p.court, (courtCount.get(p.court) || 0) + 1);
    });

    if (courtCount.size > 0) {
      const { data, labels } = this.mapCountsToChartData(courtCount);
      charts.push({
        type: 'bar',
        title: 'Processos por Tribunal',
        data,
        labels
      });
    }

    return charts;
  }

  /**
   * Safely extracts financial value from process financial info
   */
  private extractFinancialValue(financialInfo: unknown): number | null {
    if (!isAIResult(financialInfo)) {
      return null;
    }

    // Try to use case_value (mapped from valor_principal) or costs_incurred (mapped from multas)
    const caseValue = getNumberProperty(financialInfo, 'case_value');
    const costsIncurred = getNumberProperty(financialInfo, 'costs_incurred');

    const value = caseValue ?? costsIncurred ?? null;
    return typeof value === 'number' && value > 0 ? value : null;
  }

  private async generateFinancialCharts(processes: ProcessReportData[]): Promise<ChartData[]> {
    const charts: ChartData[] = [];

    // Filter processes that have valid financial info
    const processesWithFinancial = processes.filter(p => {
      const value = this.extractFinancialValue(p.financial_info);
      return value !== null;
    });

    if (processesWithFinancial.length > 0) {
      // Valor total por cliente
      const valueByClient = new Map<string, number>();

      for (const p of processesWithFinancial) {
        const value = this.extractFinancialValue(p.financial_info);
        if (value !== null) {
          const currentTotal = valueByClient.get(p.client_name) ?? 0;
          valueByClient.set(p.client_name, currentTotal + value);
        }
      }

      if (valueByClient.size > 0) {
        const { data, labels } = this.mapCountsToChartData(valueByClient);
        charts.push({
          type: 'bar',
          title: 'Valor Total por Cliente (R$)',
          data,
          labels
        });
      }
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