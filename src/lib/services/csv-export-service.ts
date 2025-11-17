// ================================================================
// CSV EXPORT SERVICE
// ================================================================
// Serviço para exportação de dados em formato CSV
// Suporta exportação de erros e resultados de batch

import { BatchErrorDetail, BatchStatus_Response } from './batch-status-service';

export class CSVExportService {
  /**
   * Exporta erros de um batch para CSV
   * Formato: Campo, Erro, Ocorrências, Linha
   */
  static exportBatchErrors(batchStatus: BatchStatus_Response): string {
    if (batchStatus.topErrors.length === 0) {
      return this.createCSVWithHeaders(['Campo', 'Erro', 'Ocorrências', 'Linha']);
    }

    const rows: string[][] = [];

    for (const error of batchStatus.topErrors) {
      const key = `${error.field}: ${error.error}`;
      const count = batchStatus.errorSummary[key] || 0;

      rows.push([
        this.escapeCsvValue(error.field),
        this.escapeCsvValue(error.error),
        count.toString(),
        error.row?.toString() || '',
      ]);
    }

    const headers = ['Campo', 'Erro', 'Ocorrências', 'Linha'];
    return this.createCSVWithRows(headers, rows);
  }

  /**
   * Exporta estatísticas de um batch para CSV
   * Formato: Métrica, Valor
   */
  static exportBatchStatistics(batchStatus: BatchStatus_Response): string {
    const rows: string[][] = [
      ['Total de Processos', batchStatus.statistics.totalProcesses.toString()],
      ['Processados com Sucesso', batchStatus.statistics.successfulProcesses.toString()],
      ['Com Erro', batchStatus.statistics.failedProcesses.toString()],
      ['Taxa de Sucesso', `${batchStatus.statistics.successRate}%`],
      ['Tempo Estimado Restante (min)', batchStatus.statistics.estimatedTimeRemaining.toString()],
    ];

    const headers = ['Métrica', 'Valor'];
    return this.createCSVWithRows(headers, rows);
  }

  /**
   * Exporta relatório completo de um batch
   * Inclui header com informações gerais, estatísticas e erros
   */
  static exportBatchReport(batchStatus: BatchStatus_Response): string {
    const lines: string[] = [];

    // Header com informações gerais
    lines.push(`# Relatório de Processamento - ${new Date().toLocaleString('pt-BR')}`);
    lines.push('');
    lines.push(`ID do Batch,${this.escapeCsvValue(batchStatus.id)}`);
    lines.push(`Arquivo,${this.escapeCsvValue(batchStatus.fileName)}`);
    lines.push(`Tamanho do Arquivo,${formatFileSize(batchStatus.fileSize)}`);
    lines.push(`Status,${batchStatus.status}`);
    lines.push(`Data de Criação,${batchStatus.createdAt}`);
    lines.push(`Data de Atualização,${batchStatus.updatedAt}`);
    lines.push('');

    // Seção de estatísticas
    lines.push('## Estatísticas');
    lines.push('Métrica,Valor');
    lines.push(`Total de Processos,${batchStatus.statistics.totalProcesses}`);
    lines.push(`Processados com Sucesso,${batchStatus.statistics.successfulProcesses}`);
    lines.push(`Com Erro,${batchStatus.statistics.failedProcesses}`);
    lines.push(`Taxa de Sucesso,${batchStatus.statistics.successRate}%`);
    lines.push(`Tempo Estimado Restante,${batchStatus.statistics.estimatedTimeRemaining} min`);
    lines.push('');

    // Seção de erros
    if (batchStatus.topErrors.length > 0) {
      lines.push('## Erros Encontrados');
      lines.push('Campo,Erro,Ocorrências,Linha');
      for (const error of batchStatus.topErrors) {
        const key = `${error.field}: ${error.error}`;
        const count = batchStatus.errorSummary[key] || 0;
        lines.push(
          `${this.escapeCsvValue(error.field)},${this.escapeCsvValue(error.error)},${count},${
            error.row || ''
          }`
        );
      }
    }

    return lines.join('\n');
  }

  /**
   * Cria um Blob CSV pronto para download
   */
  static createCSVBlob(csvContent: string): Blob {
    // Adiciona BOM UTF-8 para garantir compatibilidade com Excel
    const bom = '\uFEFF';
    return new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
  }

  /**
   * Dispara download de arquivo CSV no navegador
   */
  static downloadCSV(csvContent: string, filename: string): void {
    const blob = this.createCSVBlob(csvContent);
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();

    // Cleanup
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Helper: escapar valores para CSV
   * Adiciona aspas se contiver vírgulas, quotes ou quebras de linha
   */
  private static escapeCsvValue(value: string): string {
    if (value === null || value === undefined) {
      return '';
    }

    const stringValue = String(value);

    // Se contém caracteres especiais, envolver em aspas e escapar aspas internas
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }

    return stringValue;
  }

  /**
   * Helper: criar CSV com headers e rows
   */
  private static createCSVWithRows(headers: string[], rows: string[][]): string {
    const headerLine = headers.map((h) => this.escapeCsvValue(h)).join(',');
    const dataLines = rows.map((row) => row.map((cell) => this.escapeCsvValue(cell)).join(','));

    return [headerLine, ...dataLines].join('\n');
  }

  /**
   * Helper: criar CSV com apenas headers
   */
  private static createCSVWithHeaders(headers: string[]): string {
    return headers.map((h) => this.escapeCsvValue(h)).join(',');
  }
}

/**
 * Formata tamanho de arquivo em unidades legíveis
 */
function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}
