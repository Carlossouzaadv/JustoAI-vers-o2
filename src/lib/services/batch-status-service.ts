// ================================================================
// BATCH STATUS SERVICE
// ================================================================
// Serviço para gerenciar status e progresso de batches
// Usado pelo dashboard e testes para acompanhar processamento

import { prisma } from '@/lib/prisma';

// ===== TYPES =====

export enum BatchStatus {
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  PAUSED = 'PAUSED',
  CANCELLED = 'CANCELLED',
}

export interface BatchErrorDetail {
  field: string;
  error: string;
  row?: number;
  retryCount?: number;
}

export interface BatchProgress {
  totalRows: number;
  processedRows: number;
  successfulRows: number;
  failedRows: number;
  percentage: number;
}

export interface BatchStatistics {
  totalProcesses: number;
  successfulProcesses: number;
  failedProcesses: number;
  successRate: number;
  estimatedTimeRemaining: number; // minutos
}

export interface BatchStatus_Response {
  id: string;
  workspaceId: string;
  fileName: string;
  fileSize: number;
  status: string;
  progress: BatchProgress;
  statistics: BatchStatistics;
  errorSummary: Record<string, number>;
  topErrors: BatchErrorDetail[];
  createdAt: string;
  updatedAt: string;
  isComplete: boolean;
  canRetry: boolean;
  canCancel: boolean;
}

// ===== SERVICE =====

export class BatchStatusService {
  /**
   * Busca status completo de um batch
   * Type-safe com type guards para dados do banco
   */
  static async getBatchStatus(batchId: string): Promise<BatchStatus_Response> {
    // Buscar batch no banco
    const batch = await prisma.processBatchUpload.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      throw new Error(`Batch não encontrado: ${batchId}`);
    }

    // Calcular progresso
    const progress = this.calculateProgress(batch.totalRows, batch.processed);

    // Calcular estatísticas
    const statistics = this.calculateStatistics(batch, progress);

    // Parsear e processar erros
    const { errorSummary, topErrors } = this.processErrors(batch.errors as unknown);

    // Determinar ações disponíveis
    const isComplete = ['COMPLETED', 'FAILED', 'CANCELLED'].includes(batch.status);
    const canRetry = batch.status === 'FAILED' && batch.failed > 0;
    const canCancel = batch.status === 'PROCESSING';

    return {
      id: batch.id,
      workspaceId: batch.workspaceId,
      fileName: batch.fileName,
      fileSize: batch.fileSize,
      status: batch.status,
      progress,
      statistics,
      errorSummary,
      topErrors: topErrors.slice(0, 5), // Top 5 erros
      createdAt: batch.createdAt.toISOString(),
      updatedAt: batch.updatedAt.toISOString(),
      isComplete,
      canRetry,
      canCancel,
    };
  }

  /**
   * Calcula progresso (percentual e quantidade)
   */
  private static calculateProgress(total: number, processed: number): BatchProgress {
    const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;

    return {
      totalRows: total,
      processedRows: processed,
      successfulRows: 0, // Note: Using statistics.successfulProcesses for accurate data
      failedRows: 0, // Note: Using statistics.failedProcesses for accurate data
      percentage,
    };
  }

  /**
   * Calcula estatísticas (taxa de sucesso, ETA, etc)
   */
  private static calculateStatistics(
    batch: {
      totalRows: number;
      processed: number;
      successful: number;
      failed: number;
      status: string;
      createdAt: Date;
    },
    progress: BatchProgress
  ): BatchStatistics {
    // Taxa de sucesso
    const successRate = batch.totalRows > 0
      ? Math.round((batch.successful / batch.totalRows) * 100)
      : 0;

    // ETA (tempo estimado restante)
    let estimatedTimeRemaining = 0;
    if (batch.status === 'PROCESSING' && batch.processed > 0) {
      const elapsed = Date.now() - batch.createdAt.getTime();
      const rate = batch.processed / elapsed; // itens por ms
      const remaining = batch.totalRows - batch.processed;
      estimatedTimeRemaining = Math.ceil((remaining / rate) / 1000 / 60); // minutos
    }

    return {
      totalProcesses: batch.totalRows,
      successfulProcesses: batch.successful,
      failedProcesses: batch.failed,
      successRate,
      estimatedTimeRemaining: Math.max(0, estimatedTimeRemaining),
    };
  }

  /**
   * Processa erros armazenados em JSON
   * Type-safe com validação de estrutura
   */
  private static processErrors(
    errorsJson: unknown
  ): {
    errorSummary: Record<string, number>;
    topErrors: BatchErrorDetail[];
  } {
    const errorSummary: Record<string, number> = {};
    const topErrors: BatchErrorDetail[] = [];

    if (!errorsJson) {
      return { errorSummary, topErrors };
    }

    try {
      // Parse JSON se for string
      let errors: unknown[] = [];
      if (typeof errorsJson === 'string') {
        errors = JSON.parse(errorsJson);
      } else if (Array.isArray(errorsJson)) {
        errors = errorsJson;
      }

      // Type guard e processamento
      for (const err of errors) {
        const errorDetail = this.parseBatchError(err);
        if (errorDetail) {
          topErrors.push(errorDetail);

          // Aggregate summary
          const key = `${errorDetail.field}: ${errorDetail.error}`;
          errorSummary[key] = (errorSummary[key] || 0) + 1;
        }
      }

      // Sort by frequency
      topErrors.sort((a, b) => {
        const keyA = `${a.field}: ${a.error}`;
        const keyB = `${b.field}: ${b.error}`;
        return (errorSummary[keyB] || 0) - (errorSummary[keyA] || 0);
      });
    } catch (_error) {
      // Continua com erro summary vazio
    }

    return { errorSummary, topErrors };
  }

  /**
   * Valida e extrai erro individual (type-safe)
   */
  private static parseBatchError(error: unknown): BatchErrorDetail | null {
    // Type guard: deve ser objeto
    if (typeof error !== 'object' || error === null) {
      return null;
    }

    const obj = error as Record<string, unknown>;

    // Type guard: deve ter field e error
    if (
      !('field' in obj) ||
      typeof obj.field !== 'string' ||
      !('error' in obj) ||
      typeof obj.error !== 'string'
    ) {
      return null;
    }

    return {
      field: obj.field,
      error: obj.error,
      row: typeof obj.row === 'number' ? obj.row : undefined,
      retryCount: typeof obj.retryCount === 'number' ? obj.retryCount : undefined,
    };
  }

  /**
   * Lista todos os batches de um workspace
   */
  static async listBatches(workspaceId: string, limit: number = 20) {
    const batches = await prisma.processBatchUpload.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        fileName: true,
        status: true,
        totalRows: true,
        processed: true,
        successful: true,
        failed: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return batches.map((batch) => ({
      ...batch,
      progress: Math.round((batch.processed / batch.totalRows) * 100),
      createdAt: batch.createdAt.toISOString(),
      updatedAt: batch.updatedAt.toISOString(),
    }));
  }

  /**
   * Busca estatísticas agregadas de um workspace
   */
  static async getWorkspaceStats(workspaceId: string) {
    const batches = await prisma.processBatchUpload.findMany({
      where: { workspaceId },
    });

    const totalBatches = batches.length;
    const completedBatches = batches.filter((b) => b.status === 'COMPLETED').length;
    const failedBatches = batches.filter((b) => b.status === 'FAILED').length;
    const processingBatches = batches.filter((b) => b.status === 'PROCESSING').length;

    const totalProcesses = batches.reduce((acc, b) => acc + b.totalRows, 0);
    const successfulProcesses = batches.reduce((acc, b) => acc + b.successful, 0);
    const failedProcesses = batches.reduce((acc, b) => acc + b.failed, 0);

    return {
      totalBatches,
      completedBatches,
      failedBatches,
      processingBatches,
      totalProcesses,
      successfulProcesses,
      failedProcesses,
      successRate: totalProcesses > 0
        ? Math.round((successfulProcesses / totalProcesses) * 100)
        : 0,
    };
  }
}
