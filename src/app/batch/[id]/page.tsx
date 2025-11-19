// ================================================================
// BATCH DASHBOARD PAGE - /batch/[id]
// ================================================================
// Exibe dashboard completo com progresso, estatísticas e erros
// Atualiza em tempo real a cada 5 segundos durante processamento

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, Download, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BatchStatusService, BatchStatus_Response, BatchStatus } from '@/lib/services/batch-status-service';

// Type guard for valid batch status values
function isValidBatchStatus(status: string): status is 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'PAUSED' | 'CANCELLED' {
  return ['QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'PAUSED', 'CANCELLED'].includes(status);
}
import { CSVExportService } from '@/lib/services/csv-export-service';
import { BatchProgressCard } from '@/components/batch/batch-progress-card';
import { BatchStatistics } from '@/components/batch/batch-statistics';
import { BatchErrorsTable } from '@/components/batch/batch-errors-table';

const POLLING_INTERVAL = 5000; // 5 segundos
const MAX_RETRIES = 3;

export default function BatchPage() {
  const params = useParams();
  const batchId = params.id as string;

  const [status, setStatus] = useState<BatchStatus_Response | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Buscar status do batch
  const fetchStatus = async () => {
    try {
      const batchStatus = await BatchStatusService.getBatchStatus(batchId);
      setStatus(batchStatus);
      setError(null);
      setRetryCount(0);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao buscar status do batch';
      setError(message);
      setRetryCount((prev) => prev + 1);
    } finally {
      setIsLoading(false);
    }
  };

  // Buscar status inicial
  useEffect(() => {
    fetchStatus();
  }, [batchId]);

  // Polling para atualizar status durante processamento
  useEffect(() => {
    if (!status || status.status === BatchStatus.COMPLETED || status.status === BatchStatus.FAILED) {
      return; // Não fazer polling se completo ou falhou
    }

    const interval = setInterval(() => {
      fetchStatus();
    }, POLLING_INTERVAL);

    return () => clearInterval(interval);
  }, [status?.status, batchId]);

  // Exportar erros como CSV
  const handleExportErrors = async () => {
    if (!status || status.topErrors.length === 0) return;

    setIsExporting(true);
    try {
      const csv = CSVExportService.exportBatchErrors(status);
      CSVExportService.downloadCSV(csv, `batch-${batchId}-errors.csv`);
    } catch (err) {
      console.error('Erro ao exportar erros:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Exportar relatório completo como CSV
  const handleExportReport = async () => {
    if (!status) return;

    setIsExporting(true);
    try {
      const csv = CSVExportService.exportBatchReport(status);
      CSVExportService.downloadCSV(csv, `batch-${batchId}-report.csv`);
    } catch (err) {
      console.error('Erro ao exportar relatório:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Estado de carregamento
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Carregando status do processamento...</p>
        </div>
      </div>
    );
  }

  // Estado de erro
  if (error) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4">
        <Card className="p-6 border-red-200 bg-red-50">
          <div className="flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-red-900 mb-2">Erro ao carregar batch</h2>
              <p className="text-red-800 mb-4">{error}</p>
              <div className="flex gap-2">
                <Button onClick={fetchStatus} variant="outline" className="text-red-600 border-red-200">
                  Tentar novamente
                </Button>
                {retryCount >= MAX_RETRIES && (
                  <a href="/workspace" className="inline-block">
                    <Button variant="outline">Voltar</Button>
                  </a>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Batch não encontrado</p>
      </div>
    );
  }

  // Validate status is a valid BatchStatus value
  if (!isValidBatchStatus(status.status)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Status inválido do batch</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Acompanhamento do Processamento</h1>
        <p className="text-gray-600">
          Arquivo: <span className="font-mono text-blue-600">{status.fileName}</span> ({formatFileSize(status.fileSize)})
        </p>
        <p className="text-sm text-gray-500">
          ID do Batch: <span className="font-mono">{status.id}</span>
        </p>
      </div>

      {/* Progress Card */}
      <BatchProgressCard
        percentage={status.progress.percentage}
        totalRows={status.progress.totalRows}
        processedRows={status.progress.processedRows}
        estimatedTimeRemaining={status.statistics.estimatedTimeRemaining}
        status={status.status}
      />

      {/* Statistics */}
      <BatchStatistics
        totalProcesses={status.statistics.totalProcesses}
        successfulProcesses={status.statistics.successfulProcesses}
        failedProcesses={status.statistics.failedProcesses}
        successRate={status.statistics.successRate}
      />

      {/* Errors Table */}
      {status.topErrors.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Detalhes dos Erros</h2>
            <div className="flex gap-2">
              <Button
                onClick={handleExportErrors}
                disabled={isExporting}
                size="sm"
                variant="outline"
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                {isExporting ? 'Exportando...' : 'Exportar Erros (CSV)'}
              </Button>
            </div>
          </div>
          <BatchErrorsTable
            errors={status.topErrors}
            errorSummary={status.errorSummary}
            totalErrors={Object.values(status.errorSummary).reduce((a, b) => a + b, 0)}
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={handleExportReport}
          disabled={isExporting}
          variant="outline"
          className="gap-2"
        >
          <Download className="w-4 h-4" />
          {isExporting ? 'Exportando...' : 'Exportar Relatório (CSV)'}
        </Button>

        {status.canRetry && (
          <Button
            onClick={() => {
              // TODO: Implementar retry
              console.log('Retry batch:', batchId);
            }}
            variant="outline"
          >
            Tentar Novamente
          </Button>
        )}
        {status.canCancel && (
          <Button
            onClick={() => {
              // TODO: Implementar cancel
              console.log('Cancel batch:', batchId);
            }}
            variant="destructive"
          >
            Cancelar
          </Button>
        )}
        <a href="/workspace" className="ml-auto">
          <Button variant="outline">Voltar</Button>
        </a>
      </div>

      {/* Auto-refresh indicator */}
      {status.status === BatchStatus.PROCESSING && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
          Atualizando a cada 5 segundos...
        </div>
      )}
    </div>
  );
}

// Utility function to format file size
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
