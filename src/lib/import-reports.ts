// ================================
// SISTEMA DE RELATÓRIOS DE IMPORTAÇÃO
// ================================
// Geração de relatórios detalhados sobre importações

import prisma from './prisma';
import { ICONS } from './icons';
import { SystemImport } from '@prisma/client';
import { Prisma } from '@prisma/client';

// ================================
// TIPOS E INTERFACES
// ================================

export interface ImportReport {
  id: string;
  workspaceId: string;
  title: string;
  type: ReportType;
  period: ReportPeriod;
  generatedAt: Date;
  data: ReportData;
  summary: ReportSummary;
}

export interface ReportData {
  imports: ImportSummary[];
  systems: SystemSummary[];
  timeline: TimelineEntry[];
  metrics: ReportMetrics;
  errors: ErrorSummary[];
  recommendations: string[];
}

export interface ImportSummary {
  id: string;
  fileName: string;
  sourceSystem: string;
  status: string;
  totalRows: number;
  successfulRows: number;
  failedRows: number;
  importedCases: number;
  importedClients: number;
  duration: number; // em minutos
  createdAt: Date;
  errors: string[];
}

export interface SystemSummary {
  system: string;
  totalImports: number;
  successfulImports: number;
  failedImports: number;
  totalRowsProcessed: number;
  averageSuccessRate: number;
  mostCommonErrors: string[];
  lastImportDate?: Date;
}

export interface TimelineEntry {
  date: string;
  importsCount: number;
  successfulCount: number;
  failedCount: number;
  totalRowsProcessed: number;
}

export interface ReportMetrics {
  totalImports: number;
  successfulImports: number;
  failedImports: number;
  overallSuccessRate: number;
  totalRowsProcessed: number;
  totalCasesImported: number;
  totalClientsImported: number;
  averageImportDuration: number;
  mostActiveSystem: string;
  peakImportDay?: string;
}

export interface ErrorSummary {
  type: string;
  message: string;
  count: number;
  affectedSystems: string[];
  lastOccurrence: Date;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface ReportSummary {
  overview: string;
  highlights: string[];
  concerns: string[];
  recommendations: string[];
}

export type ReportType = 'OVERVIEW' | 'DETAILED' | 'ERRORS' | 'PERFORMANCE' | 'COMPARISON';
export type ReportPeriod = 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'LAST_90_DAYS' | 'ALL_TIME' | 'CUSTOM';

// ================================
// GERADOR DE RELATÓRIOS
// ================================

export class ImportReportGenerator {
  /**
   * Gera relatório completo de importações
   */
  async generateReport(
    workspaceId: string,
    type: ReportType = 'OVERVIEW',
    period: ReportPeriod = 'LAST_30_DAYS',
    customPeriod?: { startDate: Date; endDate: Date }
  ): Promise<ImportReport> {
    console.log(`${ICONS.CHARTS} Gerando relatório de importação:`, {
      type,
      period,
      workspace: workspaceId
    });

    const reportId = `report_${Date.now()}`;
    const { startDate, endDate } = this.calculatePeriodDates(period, customPeriod);

    // Buscar dados base
    const imports = await this.fetchImports(workspaceId, startDate, endDate);

    // Gerar diferentes seções do relatório
    const data: ReportData = {
      imports: await this.generateImportSummaries(imports),
      systems: await this.generateSystemSummaries(imports),
      timeline: await this.generateTimeline(workspaceId, startDate, endDate),
      metrics: await this.calculateMetrics(imports),
      errors: await this.analyzeErrors(imports),
      recommendations: await this.generateRecommendations(imports)
    };

    const summary = this.generateReportSummary(data);

    const report: ImportReport = {
      id: reportId,
      workspaceId,
      title: `Relatório de Importações - ${this.formatPeriod(period)}`,
      type,
      period,
      generatedAt: new Date(),
      data,
      summary
    };

    console.log(`${ICONS.SUCCESS} Relatório gerado:`, {
      id: reportId,
      imports: data.imports.length,
      systems: data.systems.length,
      metrics: data.metrics.totalImports
    });

    return report;
  }

  /**
   * Gera relatório de comparação entre sistemas
   */
  async generateComparisonReport(workspaceId: string): Promise<ImportReport> {
    console.log(`${ICONS.COMPARE} Gerando relatório de comparação de sistemas`);

    const imports = await this.fetchImports(workspaceId);
    const systemStats = await this.generateSystemComparison(imports);

    const report: ImportReport = {
      id: `comparison_${Date.now()}`,
      workspaceId,
      title: 'Relatório de Comparação entre Sistemas',
      type: 'COMPARISON',
      period: 'ALL_TIME',
      generatedAt: new Date(),
      data: {
        imports: [],
        systems: systemStats,
        timeline: [],
        metrics: await this.calculateMetrics(imports),
        errors: await this.analyzeErrors(imports),
        recommendations: await this.generateSystemRecommendations(systemStats)
      },
      summary: this.generateComparisonSummary(systemStats)
    };

    return report;
  }

  /**
   * Gera relatório focado em erros e problemas
   */
  async generateErrorReport(workspaceId: string): Promise<ImportReport> {
    const imports = await this.fetchImports(workspaceId);
    const failedImports = imports.filter(imp => imp.status === 'FAILED');

    const errorAnalysis = await this.analyzeErrors(failedImports);
    const errorPatterns = await this.findErrorPatterns(failedImports);

    const report: ImportReport = {
      id: `errors_${Date.now()}`,
      workspaceId,
      title: 'Relatório de Análise de Erros',
      type: 'ERRORS',
      period: 'ALL_TIME',
      generatedAt: new Date(),
      data: {
        imports: await this.generateImportSummaries(failedImports),
        systems: await this.generateSystemSummaries(failedImports),
        timeline: [],
        metrics: await this.calculateMetrics(failedImports),
        errors: errorAnalysis,
        recommendations: await this.generateErrorRecommendations(errorAnalysis, errorPatterns)
      },
      summary: this.generateErrorSummary(errorAnalysis)
    };

    return report;
  }

  // ================================
  // MÉTODOS PRIVADOS DE GERAÇÃO
  // ================================

  private async fetchImports(
    workspaceId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<SystemImport[]> {
    const whereClause: Prisma.SystemImportWhereInput = {
      workspaceId,
      ...(startDate || endDate ? {
        createdAt: {
          ...(startDate && { gte: startDate }),
          ...(endDate && { lte: endDate })
        }
      } : {})
    };

    return await prisma.systemImport.findMany({
      where: whereClause,
      include: {
        importedItems: {
          select: {
            dataType: true,
            status: true,
            validationErrors: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  private async generateImportSummaries(imports: SystemImport[]): Promise<ImportSummary[]> {
    return imports.map(imp => ({
      id: imp.id,
      fileName: imp.fileName,
      sourceSystem: imp.sourceSystem,
      status: imp.status,
      totalRows: imp.totalRows || 0,
      successfulRows: imp.successfulRows || 0,
      failedRows: imp.failedRows || 0,
      importedCases: imp.importedCases || 0,
      importedClients: imp.importedClients || 0,
      duration: imp.finishedAt && imp.startedAt
        ? Math.round((imp.finishedAt.getTime() - imp.startedAt.getTime()) / (1000 * 60))
        : 0,
      createdAt: imp.createdAt,
      errors: Array.isArray(imp.errors)
        ? imp.errors.filter((e): e is string => typeof e === 'string')
        : []
    }));
  }

  private async generateSystemSummaries(imports: SystemImport[]): Promise<SystemSummary[]> {
    interface SystemStats {
      system: string;
      totalImports: number;
      successfulImports: number;
      failedImports: number;
      totalRowsProcessed: number;
      errors: string[];
      lastImportDate: Date;
    }

    const systemMap = new Map<string, SystemStats>();

    imports.forEach(imp => {
      if (!systemMap.has(imp.sourceSystem)) {
        systemMap.set(imp.sourceSystem, {
          system: imp.sourceSystem,
          totalImports: 0,
          successfulImports: 0,
          failedImports: 0,
          totalRowsProcessed: 0,
          errors: [],
          lastImportDate: imp.createdAt
        });
      }

      const summary = systemMap.get(imp.sourceSystem)!;
      summary.totalImports++;
      summary.totalRowsProcessed += imp.totalRows || 0;

      if (imp.status === 'COMPLETED') {
        summary.successfulImports++;
      } else if (imp.status === 'FAILED') {
        summary.failedImports++;
      }

      if (imp.errors && Array.isArray(imp.errors)) {
        summary.errors.push(...imp.errors.filter((e): e is string => typeof e === 'string'));
      }

      if (imp.createdAt > summary.lastImportDate) {
        summary.lastImportDate = imp.createdAt;
      }
    });

    return Array.from(systemMap.values()).map(summary => ({
      system: summary.system,
      totalImports: summary.totalImports,
      successfulImports: summary.successfulImports,
      failedImports: summary.failedImports,
      totalRowsProcessed: summary.totalRowsProcessed,
      lastImportDate: summary.lastImportDate,
      averageSuccessRate: summary.totalImports > 0
        ? (summary.successfulImports / summary.totalImports) * 100
        : 0,
      mostCommonErrors: this.findMostCommonErrors(summary.errors)
    }));
  }

  private async generateTimeline(workspaceId: string, startDate: Date, endDate: Date): Promise<TimelineEntry[]> {
    // Gerar timeline diário
    const timeline: TimelineEntry[] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      const dayStart = new Date(current);
      const dayEnd = new Date(current);
      dayEnd.setHours(23, 59, 59, 999);

      const dayImports = await prisma.systemImport.findMany({
        where: {
          workspaceId,
          createdAt: {
            gte: dayStart,
            lte: dayEnd
          }
        }
      });

      timeline.push({
        date: current.toISOString().split('T')[0],
        importsCount: dayImports.length,
        successfulCount: dayImports.filter(imp => imp.status === 'COMPLETED').length,
        failedCount: dayImports.filter(imp => imp.status === 'FAILED').length,
        totalRowsProcessed: dayImports.reduce((total, imp) => total + (imp.totalRows || 0), 0)
      });

      current.setDate(current.getDate() + 1);
    }

    return timeline;
  }

  private async calculateMetrics(imports: SystemImport[]): Promise<ReportMetrics> {
    const totalImports = imports.length;
    const successfulImports = imports.filter(imp => imp.status === 'COMPLETED').length;
    const failedImports = imports.filter(imp => imp.status === 'FAILED').length;

    const durations = imports
      .filter((imp): imp is (SystemImport & { finishedAt: Date; startedAt: Date }) =>
        imp.finishedAt !== null && imp.startedAt !== null
      )
      .map(imp => (imp.finishedAt.getTime() - imp.startedAt.getTime()) / (1000 * 60));

    const systemCounts = imports.reduce((acc, imp) => {
      acc[imp.sourceSystem] = (acc[imp.sourceSystem] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const mostActiveSystem = Object.entries(systemCounts)
      .reduce((most, [system, count]) =>
        (count as number) > ((most[1] as number) || 0) ? [system, count as number] : most,
        ['', 0] as [string, number]
      )[0];

    return {
      totalImports,
      successfulImports,
      failedImports,
      overallSuccessRate: totalImports > 0 ? (successfulImports / totalImports) * 100 : 100,
      totalRowsProcessed: imports.reduce((total, imp) => total + (imp.totalRows || 0), 0),
      totalCasesImported: imports.reduce((total, imp) => total + (imp.importedCases || 0), 0),
      totalClientsImported: imports.reduce((total, imp) => total + (imp.importedClients || 0), 0),
      averageImportDuration: durations.length > 0
        ? durations.reduce((sum, d) => sum + d, 0) / durations.length
        : 0,
      mostActiveSystem,
      peakImportDay: this.findPeakImportDay(imports)
    };
  }

  private async analyzeErrors(imports: SystemImport[]): Promise<ErrorSummary[]> {
    interface ErrorInfo {
      type: string;
      message: string;
      count: number;
      affectedSystems: Set<string>;
      lastOccurrence: Date;
      severity: 'LOW' | 'MEDIUM' | 'HIGH';
    }

    const errorMap = new Map<string, ErrorInfo>();

    imports.forEach(imp => {
      if (Array.isArray(imp.errors) && imp.errors.length > 0) {
        imp.errors.forEach((error: unknown) => {
          const message = typeof error === 'string' ? error : (error && typeof error === 'object' && 'message' in error ? (error as Record<string, any>).message : 'Unknown error');
          const type = (error && typeof error === 'object' && 'type' in error) ? (error as Record<string, any>).type : 'UNKNOWN';

          if (!errorMap.has(message)) {
            errorMap.set(message, {
              type: typeof type === 'string' ? type : 'UNKNOWN',
              message,
              count: 0,
              affectedSystems: new Set<string>(),
              lastOccurrence: imp.createdAt,
              severity: this.assessErrorSeverity(message, typeof type === 'string' ? type : 'UNKNOWN')
            });
          }

          const errorSummary = errorMap.get(message)!;
          errorSummary.count++;
          errorSummary.affectedSystems.add(imp.sourceSystem);

          if (imp.createdAt > errorSummary.lastOccurrence) {
            errorSummary.lastOccurrence = imp.createdAt;
          }
        });
      }
    });

    return Array.from(errorMap.values()).map(error => ({
      type: error.type,
      message: error.message,
      count: error.count,
      affectedSystems: Array.from(error.affectedSystems),
      lastOccurrence: error.lastOccurrence,
      severity: error.severity
    }));
  }

  private async generateRecommendations(imports: SystemImport[]): Promise<string[]> {
    const recommendations: string[] = [];
    const failureRate = imports.length > 0
      ? (imports.filter(imp => imp.status === 'FAILED').length / imports.length) * 100
      : 0;

    if (failureRate > 20) {
      recommendations.push('Taxa de falhas alta (>20%). Revisar mapeamentos de dados e validações.');
    }

    if (failureRate > 50) {
      recommendations.push('Taxa crítica de falhas (>50%). Verificar compatibilidade dos arquivos de origem.');
    }

    const systemsWithErrors = new Set();
    imports.forEach(imp => {
      if (imp.status === 'FAILED') {
        systemsWithErrors.add(imp.sourceSystem);
      }
    });

    if (systemsWithErrors.size > 0) {
      recommendations.push(`Sistemas com problemas recorrentes: ${Array.from(systemsWithErrors).join(', ')}`);
    }

    if (recommendations.length === 0) {
      recommendations.push('Sistema de importação funcionando bem. Continue monitorando regularmente.');
    }

    return recommendations;
  }

  private generateReportSummary(data: ReportData): ReportSummary {
    const { metrics } = data;

    const overview = `Período analisado: ${metrics.totalImports} importações processadas, ` +
      `com taxa de sucesso de ${Math.round(metrics.overallSuccessRate)}%. ` +
      `Total de ${metrics.totalRowsProcessed.toLocaleString()} linhas processadas, ` +
      `resultando em ${metrics.totalCasesImported} casos e ${metrics.totalClientsImported} clientes importados.`;

    const highlights: string[] = [];
    const concerns: string[] = [];

    if (metrics.overallSuccessRate >= 90) {
      highlights.push('Excelente taxa de sucesso nas importações');
    } else if (metrics.overallSuccessRate < 70) {
      concerns.push('Taxa de sucesso abaixo do ideal');
    }

    if (metrics.mostActiveSystem) {
      highlights.push(`Sistema mais utilizado: ${metrics.mostActiveSystem}`);
    }

    if (data.errors.filter(e => e.severity === 'HIGH').length > 0) {
      concerns.push('Presença de erros críticos que precisam ser corrigidos');
    }

    return {
      overview,
      highlights,
      concerns,
      recommendations: data.recommendations
    };
  }

  // ================================
  // MÉTODOS AUXILIARES
  // ================================

  private calculatePeriodDates(period: ReportPeriod, customPeriod?: { startDate: Date; endDate: Date }) {
    const now = new Date();
    let startDate: Date;
    let endDate = now;

    switch (period) {
      case 'LAST_7_DAYS':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'LAST_30_DAYS':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'LAST_90_DAYS':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'CUSTOM':
        if (customPeriod) {
          startDate = customPeriod.startDate;
          endDate = customPeriod.endDate;
        } else {
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }
        break;
      default: // ALL_TIME
        startDate = new Date(2020, 0, 1); // Data arbitrária no passado
    }

    return { startDate, endDate };
  }

  private formatPeriod(period: ReportPeriod): string {
    const formats = {
      'LAST_7_DAYS': 'Últimos 7 dias',
      'LAST_30_DAYS': 'Últimos 30 dias',
      'LAST_90_DAYS': 'Últimos 90 dias',
      'ALL_TIME': 'Todo o período',
      'CUSTOM': 'Período personalizado'
    };
    return formats[period] || 'Período não definido';
  }

  private findMostCommonErrors(errors: string[]): string[] {
    const errorCounts = errors.reduce((acc, error) => {
      acc[error] = (acc[error] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(errorCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([error]) => error);
  }

  private assessErrorSeverity(message: string, type: string): 'LOW' | 'MEDIUM' | 'HIGH' {
    const highSeverityPatterns = ['CRITICAL', 'FATAL', 'DATABASE_ERROR'];
    const mediumSeverityPatterns = ['VALIDATION_ERROR', 'PARSE_ERROR'];

    if (highSeverityPatterns.some(pattern => message.includes(pattern) || type.includes(pattern))) {
      return 'HIGH';
    }

    if (mediumSeverityPatterns.some(pattern => message.includes(pattern) || type.includes(pattern))) {
      return 'MEDIUM';
    }

    return 'LOW';
  }

  private findPeakImportDay(imports: SystemImport[]): string | undefined {
    const dayCounts = imports.reduce((acc, imp) => {
      const day = imp.createdAt.toISOString().split('T')[0];
      acc[day] = (acc[day] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const peakDay = Object.entries(dayCounts)
      .reduce((peak, [day, count]) =>
        (count as number) > ((peak[1] as number) || 0) ? [day, count as number] : peak,
        ['', 0] as [string, number]
      );

    return peakDay[0] || undefined;
  }

  private async generateSystemComparison(imports: SystemImport[]): Promise<SystemSummary[]> {
    return this.generateSystemSummaries(imports);
  }

  private async generateSystemRecommendations(systems: SystemSummary[]): Promise<string[]> {
    const recommendations: string[] = [];

    const bestSystem = systems.reduce((best, system) =>
      system.averageSuccessRate > best.averageSuccessRate ? system : best
    );

    const worstSystem = systems.reduce((worst, system) =>
      system.averageSuccessRate < worst.averageSuccessRate ? system : worst
    );

    if (systems.length > 1) {
      recommendations.push(
        `Melhor performance: ${bestSystem.system} (${Math.round(bestSystem.averageSuccessRate)}% de sucesso)`
      );

      if (worstSystem.averageSuccessRate < 80) {
        recommendations.push(
          `${worstSystem.system} precisa de atenção (${Math.round(worstSystem.averageSuccessRate)}% de sucesso)`
        );
      }
    }

    return recommendations;
  }

  private generateComparisonSummary(systems: SystemSummary[]): ReportSummary {
    const totalImports = systems.reduce((sum, sys) => sum + sys.totalImports, 0);
    const avgSuccessRate = systems.length > 0
      ? systems.reduce((sum, sys) => sum + sys.averageSuccessRate, 0) / systems.length
      : 0;

    return {
      overview: `Comparação entre ${systems.length} sistemas diferentes, ` +
        `com total de ${totalImports} importações e taxa média de sucesso de ${Math.round(avgSuccessRate)}%.`,
      highlights: systems.length > 0 ? [
        `Sistema com melhor performance: ${systems.reduce((best, sys) =>
          sys.averageSuccessRate > best.averageSuccessRate ? sys : best
        ).system}`
      ] : [],
      concerns: systems.filter(sys => sys.averageSuccessRate < 70).map(sys =>
        `${sys.system} com baixa taxa de sucesso (${Math.round(sys.averageSuccessRate)}%)`
      ),
      recommendations: []
    };
  }

  private generateErrorSummary(errors: ErrorSummary[]): ReportSummary {
    const highSeverityErrors = errors.filter(e => e.severity === 'HIGH').length;
    const totalErrors = errors.reduce((sum, e) => sum + e.count, 0);

    return {
      overview: `Análise de ${errors.length} tipos de erros diferentes, ` +
        `totalizando ${totalErrors} ocorrências. ` +
        `${highSeverityErrors} erros de alta severidade identificados.`,
      highlights: [],
      concerns: highSeverityErrors > 0 ? [
        `${highSeverityErrors} erros críticos precisam de atenção imediata`
      ] : [],
      recommendations: []
    };
  }

  private async findErrorPatterns(imports: SystemImport[]): Promise<unknown[]> {
    // Implementação simplificada de detecção de padrões
    return [];
  }

  private async generateErrorRecommendations(errors: ErrorSummary[], patterns: unknown[]): Promise<string[]> {
    const recommendations: string[] = [];

    const criticalErrors = errors.filter(e => e.severity === 'HIGH');
    if (criticalErrors.length > 0) {
      recommendations.push('Corrigir erros críticos identificados como prioridade máxima');
    }

    const frequentErrors = errors.filter(e => e.count > 5);
    if (frequentErrors.length > 0) {
      recommendations.push('Investigar e corrigir erros recorrentes para melhorar a taxa de sucesso');
    }

    return recommendations;
  }
}

// ================================
// FACTORY E UTILITÁRIOS
// ================================

/**
 * Cria gerador de relatórios
 */
export function createReportGenerator(): ImportReportGenerator {
  return new ImportReportGenerator();
}

console.log(`${ICONS.SUCCESS} Sistema de relatórios carregado`);