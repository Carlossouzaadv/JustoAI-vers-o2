// ================================================================
// BATCH STATUS SERVICE - TESTS
// ================================================================

import { BatchStatusService, BatchStatus, BatchErrorDetail } from './batch-status-service';
import { prisma } from '@/lib/prisma';

// Mock prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    processBatchUpload: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

describe('BatchStatusService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getBatchStatus', () => {
    it('should return complete batch status with all fields', async () => {
      const mockBatch = {
        id: 'batch-123',
        workspaceId: 'workspace-123',
        fileName: 'test.xlsx',
        fileSize: 51200,
        status: BatchStatus.PROCESSING,
        totalRows: 100,
        processed: 50,
        successful: 45,
        failed: 5,
        errors: [
          { field: 'email', _error: 'Invalid email format', row: 5 },
          { field: 'email', _error: 'Invalid email format', row: 10 },
          { field: 'phone', _error: 'Invalid phone format', row: 15 },
        ],
        createdAt: new Date('2025-11-16T10:00:00Z'),
        updatedAt: new Date('2025-11-16T10:05:00Z'),
      };

      (prisma.processBatchUpload.findUnique as jest.Mock).mockResolvedValueOnce(mockBatch);

      const result = await BatchStatusService.getBatchStatus('batch-123');

      expect(result).toEqual({
        id: 'batch-123',
        workspaceId: 'workspace-123',
        fileName: 'test.xlsx',
        fileSize: 51200,
        status: BatchStatus.PROCESSING,
        progress: {
          totalRows: 100,
          processedRows: 50,
          successfulRows: 0,
          failedRows: 0,
          percentage: 50,
        },
        statistics: expect.objectContaining({
          totalProcesses: 100,
          successfulProcesses: 45,
          failedProcesses: 5,
          successRate: 45,
        }),
        errorSummary: {
          'email: Invalid email format': 2,
          'phone: Invalid phone format': 1,
        },
        topErrors: expect.arrayContaining([
          expect.objectContaining({ field: 'email' }),
          expect.objectContaining({ field: 'phone' }),
        ]),
        createdAt: '2025-11-16T10:00:00.000Z',
        updatedAt: '2025-11-16T10:05:00.000Z',
        isComplete: false,
        canRetry: false,
        canCancel: true,
      });
    });

    it('should throw _error if batch not found', async () => {
      (prisma.processBatchUpload.findUnique as jest.Mock).mockResolvedValueOnce(null);

      await expect(BatchStatusService.getBatchStatus('non-existent')).rejects.toThrow(
        'Batch não encontrado: non-existent'
      );
    });

    it('should mark batch as complete when status is COMPLETED', async () => {
      const mockBatch = {
        id: 'batch-123',
        workspaceId: 'workspace-123',
        fileName: 'test.xlsx',
        fileSize: 51200,
        status: BatchStatus.COMPLETED,
        totalRows: 100,
        processed: 100,
        successful: 100,
        failed: 0,
        errors: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.processBatchUpload.findUnique as jest.Mock).mockResolvedValueOnce(mockBatch);

      const result = await BatchStatusService.getBatchStatus('batch-123');

      expect(result.isComplete).toBe(true);
      expect(result.canRetry).toBe(false);
      expect(result.canCancel).toBe(false);
    });

    it('should allow retry when batch failed with errors', async () => {
      const mockBatch = {
        id: 'batch-123',
        workspaceId: 'workspace-123',
        fileName: 'test.xlsx',
        fileSize: 51200,
        status: BatchStatus.FAILED,
        totalRows: 100,
        processed: 100,
        successful: 95,
        failed: 5,
        errors: [{ field: 'email', _error: 'Invalid email', row: 10 }],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.processBatchUpload.findUnique as jest.Mock).mockResolvedValueOnce(mockBatch);

      const result = await BatchStatusService.getBatchStatus('batch-123');

      expect(result.isComplete).toBe(true);
      expect(result.canRetry).toBe(true);
      expect(result.canCancel).toBe(false);
    });

    it('should calculate success rate correctly', async () => {
      const mockBatch = {
        id: 'batch-123',
        workspaceId: 'workspace-123',
        fileName: 'test.xlsx',
        fileSize: 51200,
        status: BatchStatus.COMPLETED,
        totalRows: 1000,
        processed: 1000,
        successful: 333, // 33.3%
        failed: 667,
        errors: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.processBatchUpload.findUnique as jest.Mock).mockResolvedValueOnce(mockBatch);

      const result = await BatchStatusService.getBatchStatus('batch-123');

      expect(result.statistics.successRate).toBe(33);
    });
  });

  describe('listBatches', () => {
    it('should return list of recent batches', async () => {
      const mockBatches = [
        {
          id: 'batch-1',
          fileName: 'file1.xlsx',
          status: BatchStatus.COMPLETED,
          totalRows: 100,
          processed: 100,
          successful: 100,
          failed: 0,
          createdAt: new Date('2025-11-16T10:00:00Z'),
          updatedAt: new Date('2025-11-16T10:05:00Z'),
        },
        {
          id: 'batch-2',
          fileName: 'file2.xlsx',
          status: BatchStatus.PROCESSING,
          totalRows: 200,
          processed: 50,
          successful: 45,
          failed: 5,
          createdAt: new Date('2025-11-16T09:00:00Z'),
          updatedAt: new Date('2025-11-16T09:10:00Z'),
        },
      ];

      (prisma.processBatchUpload.findMany as jest.Mock).mockResolvedValueOnce(mockBatches);

      const result = await BatchStatusService.listBatches('workspace-123', 20);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'batch-1',
        fileName: 'file1.xlsx',
        status: BatchStatus.COMPLETED,
        totalRows: 100,
        processed: 100,
        successful: 100,
        failed: 0,
        progress: 100,
        createdAt: '2025-11-16T10:00:00.000Z',
        updatedAt: '2025-11-16T10:05:00.000Z',
      });
    });

    it('should respect limit parameter', async () => {
      (prisma.processBatchUpload.findMany as jest.Mock).mockResolvedValueOnce([]);

      await BatchStatusService.listBatches('workspace-123', 50);

      expect(prisma.processBatchUpload.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
        })
      );
    });
  });

  describe('getWorkspaceStats', () => {
    it('should aggregate stats across all workspace batches', async () => {
      const mockBatches = [
        {
          status: BatchStatus.COMPLETED,
          totalRows: 100,
          successful: 100,
          failed: 0,
        },
        {
          status: BatchStatus.FAILED,
          totalRows: 200,
          successful: 180,
          failed: 20,
        },
        {
          status: BatchStatus.PROCESSING,
          totalRows: 150,
          successful: 75,
          failed: 0,
        },
      ];

      (prisma.processBatchUpload.findMany as jest.Mock).mockResolvedValueOnce(mockBatches);

      const result = await BatchStatusService.getWorkspaceStats('workspace-123');

      expect(result).toEqual({
        totalBatches: 3,
        completedBatches: 1,
        failedBatches: 1,
        processingBatches: 1,
        totalProcesses: 450,
        successfulProcesses: 355,
        failedProcesses: 20,
        successRate: 79, // 355/450 = 78.88% rounds to 79%
      });
    });

    it('should return zero success rate for empty workspace', async () => {
      (prisma.processBatchUpload.findMany as jest.Mock).mockResolvedValueOnce([]);

      const result = await BatchStatusService.getWorkspaceStats('workspace-123');

      expect(result.successRate).toBe(0);
    });
  });

  describe('_error processing', () => {
    it('should parse JSON errors correctly', async () => {
      const mockBatch = {
        id: 'batch-123',
        workspaceId: 'workspace-123',
        fileName: 'test.xlsx',
        fileSize: 51200,
        status: BatchStatus.COMPLETED,
        totalRows: 10,
        processed: 10,
        successful: 8,
        failed: 2,
        errors: JSON.stringify([
          { field: 'email', _error: 'Invalid email', row: 1 },
          { field: 'phone', _error: 'Invalid phone', row: 2 },
          { field: 'email', _error: 'Invalid email', row: 3 },
        ]),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.processBatchUpload.findUnique as jest.Mock).mockResolvedValueOnce(mockBatch);

      const result = await BatchStatusService.getBatchStatus('batch-123');

      expect(result.errorSummary).toEqual({
        'email: Invalid email': 2,
        'phone: Invalid phone': 1,
      });
      expect(result.topErrors).toHaveLength(3);
    });

    it('should handle empty errors gracefully', async () => {
      const mockBatch = {
        id: 'batch-123',
        workspaceId: 'workspace-123',
        fileName: 'test.xlsx',
        fileSize: 51200,
        status: BatchStatus.COMPLETED,
        totalRows: 10,
        processed: 10,
        successful: 10,
        failed: 0,
        errors: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.processBatchUpload.findUnique as jest.Mock).mockResolvedValueOnce(mockBatch);

      const result = await BatchStatusService.getBatchStatus('batch-123');

      expect(result.errorSummary).toEqual({});
      expect(result.topErrors).toEqual([]);
    });

    it('should filter out malformed errors', async () => {
      const mockBatch = {
        id: 'batch-123',
        workspaceId: 'workspace-123',
        fileName: 'test.xlsx',
        fileSize: 51200,
        status: BatchStatus.COMPLETED,
        totalRows: 5,
        processed: 5,
        successful: 3,
        failed: 2,
        errors: JSON.stringify([
          { field: 'email', _error: 'Invalid email' },
          { field: 'phone' }, // Missing _error field
          { _error: 'No field' }, // Missing field
          { field: 'name', _error: 'Too long' },
          null, // Invalid
        ]),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.processBatchUpload.findUnique as jest.Mock).mockResolvedValueOnce(mockBatch);

      const result = await BatchStatusService.getBatchStatus('batch-123');

      // Only valid errors should be included
      expect(result.topErrors).toHaveLength(2);
      expect(result.topErrors.map((e) => e.field)).toEqual(['email', 'name']);
    });
  });
});
