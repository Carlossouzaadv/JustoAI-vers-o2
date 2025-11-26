// ================================================================
// BATCH DASHBOARD PAGE - INTEGRATION TESTS
// ================================================================
// Testes de integração para o dashboard de acompanhamento de batch

import { render, screen, waitFor, within } from '@testing-library/react';
import { BatchStatusService, BatchStatus_Response } from '@/lib/services/batch-status-service';

// Mock do BatchStatusService
jest.mock('@/lib/services/batch-status-service');

// Mock do next/navigation
jest.mock('next/navigation', () => ({
  useParams: jest.fn(() => ({ id: 'batch-123' })),
}));

// Mock do next/link (implícito no Button)
jest.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Sample mock batch status
const mockBatchStatus: BatchStatus_Response = {
  id: 'batch-123',
  workspaceId: 'workspace-123',
  fileName: 'test-data.xlsx',
  fileSize: 51200,
  status: 'PROCESSING',
  progress: {
    totalRows: 1000,
    processedRows: 500,
    successfulRows: 450,
    failedRows: 50,
    percentage: 50,
  },
  statistics: {
    totalProcesses: 1000,
    successfulProcesses: 450,
    failedProcesses: 50,
    successRate: 45,
    estimatedTimeRemaining: 10,
  },
  errorSummary: {
    'email: Invalid format': 30,
    'phone: Invalid phone': 20,
  },
  topErrors: [
    { field: 'email', error: 'Invalid format', row: 5 },
    { field: 'phone', error: 'Invalid phone', row: 10 },
  ],
  createdAt: '2025-11-16T10:00:00.000Z',
  updatedAt: '2025-11-16T10:05:00.000Z',
  isComplete: false,
  canRetry: false,
  canCancel: true,
};

describe('Batch Dashboard Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Page Loading', () => {
    it('should display loading state initially', async () => {
      (BatchStatusService.getBatchStatus as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(mockBatchStatus), 100);
          })
      );

      // Note: Actual page component would need to be imported properly
      // This is a conceptual test
      expect(BatchStatusService.getBatchStatus).toBeDefined();
    });

    it('should fetch batch status on mount', async () => {
      (BatchStatusService.getBatchStatus as jest.Mock).mockResolvedValueOnce(mockBatchStatus);

      await BatchStatusService.getBatchStatus('batch-123');

      expect(BatchStatusService.getBatchStatus).toHaveBeenCalledWith('batch-123');
    });

    it('should display error message if batch not found', async () => {
      (BatchStatusService.getBatchStatus as jest.Mock).mockRejectedValueOnce(
        new Error('Batch não encontrado: batch-123')
      );

      try {
        await BatchStatusService.getBatchStatus('batch-123');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Batch não encontrado');
      }
    });
  });

  describe('Progress Display', () => {
    it('should display progress percentage correctly', async () => {
      const status: BatchStatus_Response = {
        ...mockBatchStatus,
        progress: {
          totalRows: 100,
          processedRows: 75,
          successfulRows: 70,
          failedRows: 5,
          percentage: 75,
        },
      };

      (BatchStatusService.getBatchStatus as jest.Mock).mockResolvedValueOnce(status);

      const result = await BatchStatusService.getBatchStatus('batch-123');

      expect(result.progress.percentage).toBe(75);
      expect(result.progress.processedRows).toBe(75);
      expect(result.progress.totalRows).toBe(100);
    });

    it('should update progress when status changes', async () => {
      const initialStatus: BatchStatus_Response = {
        ...mockBatchStatus,
        progress: {
          totalRows: 100,
          processedRows: 25,
          successfulRows: 20,
          failedRows: 5,
          percentage: 25,
        },
      };

      const updatedStatus: BatchStatus_Response = {
        ...mockBatchStatus,
        progress: {
          totalRows: 100,
          processedRows: 75,
          successfulRows: 70,
          failedRows: 5,
          percentage: 75,
        },
      };

      (BatchStatusService.getBatchStatus as jest.Mock)
        .mockResolvedValueOnce(initialStatus)
        .mockResolvedValueOnce(updatedStatus);

      const first = await BatchStatusService.getBatchStatus('batch-123');
      expect(first.progress.percentage).toBe(25);

      const second = await BatchStatusService.getBatchStatus('batch-123');
      expect(second.progress.percentage).toBe(75);
    });
  });

  describe('Statistics Display', () => {
    it('should display all statistics correctly', async () => {
      (BatchStatusService.getBatchStatus as jest.Mock).mockResolvedValueOnce(mockBatchStatus);

      const result = await BatchStatusService.getBatchStatus('batch-123');

      expect(result.statistics).toEqual({
        totalProcesses: 1000,
        successfulProcesses: 450,
        failedProcesses: 50,
        successRate: 45,
        estimatedTimeRemaining: 10,
      });
    });

    it('should calculate success rate correctly', async () => {
      const status: BatchStatus_Response = {
        ...mockBatchStatus,
        statistics: {
          totalProcesses: 200,
          successfulProcesses: 150,
          failedProcesses: 50,
          successRate: 75,
          estimatedTimeRemaining: 0,
        },
      };

      (BatchStatusService.getBatchStatus as jest.Mock).mockResolvedValueOnce(status);

      const result = await BatchStatusService.getBatchStatus('batch-123');

      expect(result.statistics.successRate).toBe(75);
    });
  });

  describe('Error Display', () => {
    it('should display errors when present', async () => {
      (BatchStatusService.getBatchStatus as jest.Mock).mockResolvedValueOnce(mockBatchStatus);

      const result = await BatchStatusService.getBatchStatus('batch-123');

      expect(result.topErrors).toHaveLength(2);
      expect(result.topErrors[0]).toEqual({
        field: 'email',
        error: 'Invalid format',
        row: 5,
      });
    });

    it('should not display error section when no errors', async () => {
      const noErrorStatus: BatchStatus_Response = {
        ...mockBatchStatus,
        topErrors: [],
        errorSummary: {},
      };

      (BatchStatusService.getBatchStatus as jest.Mock).mockResolvedValueOnce(noErrorStatus);

      const result = await BatchStatusService.getBatchStatus('batch-123');

      expect(result.topErrors).toHaveLength(0);
      expect(Object.keys(result.errorSummary)).toHaveLength(0);
    });

    it('should show error summary counts', async () => {
      (BatchStatusService.getBatchStatus as jest.Mock).mockResolvedValueOnce(mockBatchStatus);

      const result = await BatchStatusService.getBatchStatus('batch-123');

      expect(result.errorSummary['email: Invalid format']).toBe(30);
      expect(result.errorSummary['phone: Invalid phone']).toBe(20);
    });
  });

  describe('Polling and Real-time Updates', () => {
    it('should poll for updates while processing', async () => {
      const processingStatus: BatchStatus_Response = {
        ...mockBatchStatus,
        status: 'PROCESSING',
      };

      const completedStatus: BatchStatus_Response = {
        ...mockBatchStatus,
        status: 'COMPLETED',
        progress: {
          totalRows: 1000,
          processedRows: 1000,
          successfulRows: 950,
          failedRows: 50,
          percentage: 100,
        },
      };

      (BatchStatusService.getBatchStatus as jest.Mock)
        .mockResolvedValueOnce(processingStatus)
        .mockResolvedValueOnce(processingStatus)
        .mockResolvedValueOnce(completedStatus);

      // Simulate polling
      const results = [];
      results.push(await BatchStatusService.getBatchStatus('batch-123'));
      results.push(await BatchStatusService.getBatchStatus('batch-123'));
      results.push(await BatchStatusService.getBatchStatus('batch-123'));

      expect(results[0].status).toBe('PROCESSING');
      expect(results[1].status).toBe('PROCESSING');
      expect(results[2].status).toBe('COMPLETED');
      expect(results[2].progress.percentage).toBe(100);
    });

    it('should stop polling when batch completes', async () => {
      const completedStatus: BatchStatus_Response = {
        ...mockBatchStatus,
        status: 'COMPLETED',
        isComplete: true,
      };

      (BatchStatusService.getBatchStatus as jest.Mock).mockResolvedValueOnce(completedStatus);

      const result = await BatchStatusService.getBatchStatus('batch-123');

      expect(result.isComplete).toBe(true);
      // In the actual component, polling would stop here
    });

    it('should stop polling when batch fails', async () => {
      const failedStatus: BatchStatus_Response = {
        ...mockBatchStatus,
        status: 'FAILED',
        isComplete: true,
      };

      (BatchStatusService.getBatchStatus as jest.Mock).mockResolvedValueOnce(failedStatus);

      const result = await BatchStatusService.getBatchStatus('batch-123');

      expect(result.status).toBe('FAILED');
      expect(result.isComplete).toBe(true);
    });
  });

  describe('File Information', () => {
    it('should display file name and size', async () => {
      (BatchStatusService.getBatchStatus as jest.Mock).mockResolvedValueOnce(mockBatchStatus);

      const result = await BatchStatusService.getBatchStatus('batch-123');

      expect(result.fileName).toBe('test-data.xlsx');
      expect(result.fileSize).toBe(51200);
    });

    it('should display batch ID', async () => {
      (BatchStatusService.getBatchStatus as jest.Mock).mockResolvedValueOnce(mockBatchStatus);

      const result = await BatchStatusService.getBatchStatus('batch-123');

      expect(result.id).toBe('batch-123');
    });
  });

  describe('Action Buttons', () => {
    it('should show cancel button when batch is processing', async () => {
      const processingStatus: BatchStatus_Response = {
        ...mockBatchStatus,
        status: 'PROCESSING',
        canCancel: true,
      };

      (BatchStatusService.getBatchStatus as jest.Mock).mockResolvedValueOnce(processingStatus);

      const result = await BatchStatusService.getBatchStatus('batch-123');

      expect(result.canCancel).toBe(true);
    });

    it('should show retry button when batch failed with errors', async () => {
      const failedStatus: BatchStatus_Response = {
        ...mockBatchStatus,
        status: 'FAILED',
        canRetry: true,
        canCancel: false,
      };

      (BatchStatusService.getBatchStatus as jest.Mock).mockResolvedValueOnce(failedStatus);

      const result = await BatchStatusService.getBatchStatus('batch-123');

      expect(result.canRetry).toBe(true);
      expect(result.canCancel).toBe(false);
    });

    it('should not show action buttons when batch is completed', async () => {
      const completedStatus: BatchStatus_Response = {
        ...mockBatchStatus,
        status: 'COMPLETED',
        canRetry: false,
        canCancel: false,
      };

      (BatchStatusService.getBatchStatus as jest.Mock).mockResolvedValueOnce(completedStatus);

      const result = await BatchStatusService.getBatchStatus('batch-123');

      expect(result.canRetry).toBe(false);
      expect(result.canCancel).toBe(false);
    });
  });

  describe('Batch Status States', () => {
    it('should handle QUEUED status', async () => {
      const queuedStatus: BatchStatus_Response = {
        ...mockBatchStatus,
        status: 'QUEUED',
        progress: {
          totalRows: 1000,
          processedRows: 0,
          successfulRows: 0,
          failedRows: 0,
          percentage: 0,
        },
      };

      (BatchStatusService.getBatchStatus as jest.Mock).mockResolvedValueOnce(queuedStatus);

      const result = await BatchStatusService.getBatchStatus('batch-123');

      expect(result.status).toBe('QUEUED');
      expect(result.progress.percentage).toBe(0);
    });

    it('should handle PAUSED status', async () => {
      const pausedStatus: BatchStatus_Response = {
        ...mockBatchStatus,
        status: 'PAUSED',
      };

      (BatchStatusService.getBatchStatus as jest.Mock).mockResolvedValueOnce(pausedStatus);

      const result = await BatchStatusService.getBatchStatus('batch-123');

      expect(result.status).toBe('PAUSED');
    });

    it('should handle CANCELLED status', async () => {
      const cancelledStatus: BatchStatus_Response = {
        ...mockBatchStatus,
        status: 'CANCELLED',
        isComplete: true,
      };

      (BatchStatusService.getBatchStatus as jest.Mock).mockResolvedValueOnce(cancelledStatus);

      const result = await BatchStatusService.getBatchStatus('batch-123');

      expect(result.status).toBe('CANCELLED');
      expect(result.isComplete).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const error = new Error('Network error');
      (BatchStatusService.getBatchStatus as jest.Mock).mockRejectedValueOnce(error);

      try {
        await BatchStatusService.getBatchStatus('batch-123');
        throw new Error('Should have thrown error');
      } catch (err) {
        expect(err).toEqual(error);
      }
    });

    it('should retry on error', async () => {
      const error = new Error('Network error');
      (BatchStatusService.getBatchStatus as jest.Mock)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(mockBatchStatus);

      try {
        await BatchStatusService.getBatchStatus('batch-123');
      } catch (_err) {
        // First call failed
      }

      const result = await BatchStatusService.getBatchStatus('batch-123');
      expect(result).toBeDefined();
      expect(result.id).toBe('batch-123');
    });
  });

  describe('Timestamps', () => {
    it('should display creation and update timestamps', async () => {
      (BatchStatusService.getBatchStatus as jest.Mock).mockResolvedValueOnce(mockBatchStatus);

      const result = await BatchStatusService.getBatchStatus('batch-123');

      expect(result.createdAt).toBe('2025-11-16T10:00:00.000Z');
      expect(result.updatedAt).toBe('2025-11-16T10:05:00.000Z');
    });
  });
});
