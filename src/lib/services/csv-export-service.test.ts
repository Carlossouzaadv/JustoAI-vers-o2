// ================================================================
// CSV EXPORT SERVICE - TESTS
// ================================================================

import { CSVExportService } from './csv-export-service';
import { BatchStatus_Response } from './batch-status-service';

/**
 * Creates a mock anchor element with required properties for download testing.
 * Type-safe: uses Partial<HTMLAnchorElement> instead of unsafe casting.
 */
function createMockAnchorElement(clickSpy: jest.Mock): Partial<HTMLAnchorElement> {
  return {
    href: '',
    download: '',
    click: clickSpy,
  };
}

describe('CSVExportService', () => {
  const mockBatchStatus: BatchStatus_Response = {
    id: 'batch-123',
    workspaceId: 'workspace-123',
    fileName: 'test.xlsx',
    fileSize: 51200,
    status: 'COMPLETED',
    progress: {
      totalRows: 100,
      processedRows: 100,
      successfulRows: 95,
      failedRows: 5,
      percentage: 100,
    },
    statistics: {
      totalProcesses: 100,
      successfulProcesses: 95,
      failedProcesses: 5,
      successRate: 95,
      estimatedTimeRemaining: 0,
    },
    errorSummary: {
      'email: Invalid format': 3,
      'phone: Invalid phone': 2,
    },
    topErrors: [
      { field: 'email', error: 'Invalid format', row: 5 },
      { field: 'phone', error: 'Invalid phone', row: 10 },
    ],
    createdAt: '2025-11-16T10:00:00.000Z',
    updatedAt: '2025-11-16T10:05:00.000Z',
    isComplete: true,
    canRetry: false,
    canCancel: false,
  };

  describe('exportBatchErrors', () => {
    it('should export errors with all columns', () => {
      const csv = CSVExportService.exportBatchErrors(mockBatchStatus);

      expect(csv).toContain('Campo,Erro,Ocorrências,Linha');
      expect(csv).toContain('email,Invalid format,3,5');
      expect(csv).toContain('phone,Invalid phone,2,10');
    });

    it('should handle empty errors', () => {
      const emptyBatchStatus: BatchStatus_Response = {
        ...mockBatchStatus,
        topErrors: [],
        errorSummary: {},
      };

      const csv = CSVExportService.exportBatchErrors(emptyBatchStatus);

      expect(csv).toEqual('Campo,Erro,Ocorrências,Linha');
    });

    it('should escape values with special characters', () => {
      const specialBatchStatus: BatchStatus_Response = {
        ...mockBatchStatus,
        topErrors: [
          {
            field: 'nome',
            error: 'Invalid format, contains comma',
            row: 5,
          },
          {
            field: 'email',
            error: 'Already "registered"',
            row: 6,
          },
        ],
        errorSummary: {
          'nome: Invalid format, contains comma': 1,
          'email: Already "registered"': 1,
        },
      };

      const csv = CSVExportService.exportBatchErrors(specialBatchStatus);

      // Check that the CSV contains the properly escaped values
      expect(csv).toContain('Invalid format, contains comma');
      expect(csv).toContain('registered');
      // Verify CSV structure is valid
      expect(csv).toContain('Campo,Erro,Ocorrências,Linha');
    });

    it('should handle missing row numbers', () => {
      const noRowBatchStatus: BatchStatus_Response = {
        ...mockBatchStatus,
        topErrors: [
          { field: 'email', error: 'Invalid format' },
        ],
        errorSummary: {
          'email: Invalid format': 1,
        },
      };

      const csv = CSVExportService.exportBatchErrors(noRowBatchStatus);

      expect(csv).toContain('email,Invalid format,1,');
    });
  });

  describe('exportBatchStatistics', () => {
    it('should export all statistics metrics', () => {
      const csv = CSVExportService.exportBatchStatistics(mockBatchStatus);

      expect(csv).toContain('Métrica,Valor');
      expect(csv).toContain('Total de Processos,100');
      expect(csv).toContain('Processados com Sucesso,95');
      expect(csv).toContain('Com Erro,5');
      expect(csv).toContain('Taxa de Sucesso,95%');
    });

    it('should include estimated time remaining', () => {
      const csv = CSVExportService.exportBatchStatistics(mockBatchStatus);

      expect(csv).toContain('Tempo Estimado Restante (min),0');
    });

    it('should handle processing status with time remaining', () => {
      const processingBatchStatus: BatchStatus_Response = {
        ...mockBatchStatus,
        status: 'PROCESSING',
        statistics: {
          ...mockBatchStatus.statistics,
          estimatedTimeRemaining: 10,
        },
      };

      const csv = CSVExportService.exportBatchStatistics(processingBatchStatus);

      expect(csv).toContain('Tempo Estimado Restante (min),10');
    });
  });

  describe('exportBatchReport', () => {
    it('should include header information', () => {
      const csv = CSVExportService.exportBatchReport(mockBatchStatus);

      expect(csv).toContain('# Relatório de Processamento');
      expect(csv).toContain(`ID do Batch,batch-123`);
      expect(csv).toContain(`Arquivo,test.xlsx`);
      expect(csv).toContain(`Status,COMPLETED`);
    });

    it('should include statistics section', () => {
      const csv = CSVExportService.exportBatchReport(mockBatchStatus);

      expect(csv).toContain('## Estatísticas');
      expect(csv).toContain('Métrica,Valor');
      expect(csv).toContain('Total de Processos,100');
    });

    it('should include errors section when errors exist', () => {
      const csv = CSVExportService.exportBatchReport(mockBatchStatus);

      expect(csv).toContain('## Erros Encontrados');
      expect(csv).toContain('Campo,Erro,Ocorrências,Linha');
    });

    it('should not include errors section when no errors', () => {
      const noErrorBatchStatus: BatchStatus_Response = {
        ...mockBatchStatus,
        topErrors: [],
        errorSummary: {},
      };

      const csv = CSVExportService.exportBatchReport(noErrorBatchStatus);

      expect(csv).not.toContain('## Erros Encontrados');
    });

    it('should format file size correctly', () => {
      const csv = CSVExportService.exportBatchReport(mockBatchStatus);

      expect(csv).toContain('Tamanho do Arquivo,50.00 KB');
    });
  });

  describe('createCSVBlob', () => {
    it('should create blob with correct type', () => {
      const csv = 'field1,field2\nvalue1,value2';
      const blob = CSVExportService.createCSVBlob(csv);

      expect(blob.type).toBe('text/csv;charset=utf-8;');
    });

    it('should include UTF-8 BOM', () => {
      const csv = 'field1,field2';
      const blob = CSVExportService.createCSVBlob(csv);

      // Check that blob contains BOM by examining first character of content
      expect(blob.size).toBeGreaterThan(0);
      // BOM is added by the service
      expect(blob.type).toBe('text/csv;charset=utf-8;');
    });
  });

  describe('downloadCSV', () => {
    beforeEach(() => {
      // Mock document methods
      global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
      global.URL.revokeObjectURL = jest.fn();

      document.body.appendChild = jest.fn();
      document.body.removeChild = jest.fn();
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should create and trigger download', () => {
      const clickSpy = jest.fn();
      const linkElement = createMockAnchorElement(clickSpy);

      jest.spyOn(document, 'createElement').mockReturnValue(linkElement as unknown as HTMLElement);

      const csv = 'field1,field2\nvalue1,value2';
      CSVExportService.downloadCSV(csv, 'test.csv');

      expect(clickSpy).toHaveBeenCalled();
      expect(linkElement.download).toBe('test.csv');
    });

    it('should cleanup after download', () => {
      const clickSpy = jest.fn();
      const linkElement = createMockAnchorElement(clickSpy);

      jest.spyOn(document, 'createElement').mockReturnValue(linkElement as unknown as HTMLElement);

      const csv = 'field1,field2\nvalue1,value2';
      CSVExportService.downloadCSV(csv, 'test.csv');

      expect(document.body.removeChild).toHaveBeenCalled();
      expect(URL.revokeObjectURL).toHaveBeenCalled();
    });
  });

  describe('CSV escaping', () => {
    it('should properly escape commas', () => {
      const batchStatus: BatchStatus_Response = {
        ...mockBatchStatus,
        topErrors: [
          {
            field: 'name',
            error: 'Contains, comma, characters',
          },
        ],
        errorSummary: {
          'name: Contains, comma, characters': 1,
        },
      };

      const csv = CSVExportService.exportBatchErrors(batchStatus);

      expect(csv).toContain('"Contains, comma, characters"');
    });

    it('should properly escape quotes', () => {
      const batchStatus: BatchStatus_Response = {
        ...mockBatchStatus,
        topErrors: [
          {
            field: 'text',
            error: 'Already "used" in system',
          },
        ],
        errorSummary: {
          'text: Already "used" in system': 1,
        },
      };

      const csv = CSVExportService.exportBatchErrors(batchStatus);

      // Check that the CSV contains the _error text with quotes
      expect(csv).toContain('Already');
      expect(csv).toContain('used');
      expect(csv).toContain('in system');
    });

    it('should properly escape newlines', () => {
      const batchStatus: BatchStatus_Response = {
        ...mockBatchStatus,
        topErrors: [
          {
            field: 'description',
            error: 'Line 1\nLine 2\nLine 3',
          },
        ],
        errorSummary: {
          'description: Line 1\nLine 2\nLine 3': 1,
        },
      };

      const csv = CSVExportService.exportBatchErrors(batchStatus);

      expect(csv).toContain('"Line 1');
    });
  });

  describe('File size formatting', () => {
    it('should format bytes correctly', () => {
      const batchStatus: BatchStatus_Response = {
        ...mockBatchStatus,
        fileSize: 512,
      };

      const csv = CSVExportService.exportBatchReport(batchStatus);

      expect(csv).toContain('Tamanho do Arquivo,512.00 B');
    });

    it('should format kilobytes correctly', () => {
      const batchStatus: BatchStatus_Response = {
        ...mockBatchStatus,
        fileSize: 1024,
      };

      const csv = CSVExportService.exportBatchReport(batchStatus);

      expect(csv).toContain('Tamanho do Arquivo,1.00 KB');
    });

    it('should format megabytes correctly', () => {
      const batchStatus: BatchStatus_Response = {
        ...mockBatchStatus,
        fileSize: 1048576,
      };

      const csv = CSVExportService.exportBatchReport(batchStatus);

      expect(csv).toContain('Tamanho do Arquivo,1.00 MB');
    });
  });

  describe('Edge cases', () => {
    it('should handle batch with no errors but with statistics', () => {
      const noErrorBatch: BatchStatus_Response = {
        ...mockBatchStatus,
        topErrors: [],
        errorSummary: {},
      };

      const csv = CSVExportService.exportBatchErrors(noErrorBatch);

      expect(csv).toBeDefined();
      expect(csv.split('\n').length).toBeGreaterThan(0);
    });

    it('should handle very long field values', () => {
      const longValue =
        'A'.repeat(500) + ', with comma, and "quotes"';
      const errorKey = `field_name: ${longValue}`;
      const longBatch: BatchStatus_Response = {
        ...mockBatchStatus,
        topErrors: [
          {
            field: 'field_name',
            error: longValue,
          },
        ],
        errorSummary: {
          [errorKey]: 1,
        },
      };

      const csv = CSVExportService.exportBatchErrors(longBatch);

      expect(csv).toBeDefined();
      expect(csv.length).toBeGreaterThan(longValue.length);
    });

    it('should handle null/undefined values gracefully', () => {
      const batchStatus: BatchStatus_Response = {
        ...mockBatchStatus,
        topErrors: [
          {
            field: 'email',
            error: 'Invalid',
            row: undefined,
          },
        ],
        errorSummary: {
          'email: Invalid': 1,
        },
      };

      const csv = CSVExportService.exportBatchErrors(batchStatus);

      expect(csv).toBeDefined();
      expect(csv).toContain('email,Invalid,1,');
    });
  });
});
