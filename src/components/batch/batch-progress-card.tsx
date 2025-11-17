// ================================================================
// BATCH PROGRESS CARD - Component
// ================================================================
// Exibe progresso visual do processamento (barra + percentual)

'use client';

import { Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface BatchProgressCardProps {
  percentage: number;
  totalRows: number;
  processedRows: number;
  estimatedTimeRemaining: number;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'PAUSED' | 'CANCELLED';
}

export function BatchProgressCard({
  percentage,
  totalRows,
  processedRows,
  estimatedTimeRemaining,
  status,
}: BatchProgressCardProps) {
  const isComplete = status === 'COMPLETED';
  const isFailed = status === 'FAILED';
  const isProcessing = status === 'PROCESSING';

  // Cor da barra baseada no status
  const barColor = isFailed
    ? 'bg-red-500'
    : isComplete
      ? 'bg-green-500'
      : 'bg-blue-500';

  // Cor do texto do percentual
  const percentColor = isFailed
    ? 'text-red-600'
    : isComplete
      ? 'text-green-600'
      : 'text-blue-600';

  return (
    <Card className="p-6">
      <div className="space-y-4">
        {/* Header com titulo e status */}
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Progresso do Processamento</h3>
          <div className="flex items-center gap-2">
            {isComplete && (
              <div className="flex items-center gap-1 text-green-600 text-sm font-medium">
                <CheckCircle2 className="w-4 h-4" />
                Concluído
              </div>
            )}
            {isFailed && (
              <div className="flex items-center gap-1 text-red-600 text-sm font-medium">
                <AlertCircle className="w-4 h-4" />
                Falhou
              </div>
            )}
            {isProcessing && (
              <div className="flex items-center gap-1 text-blue-600 text-sm font-medium">
                <Clock className="w-4 h-4 animate-spin" />
                Processando
              </div>
            )}
          </div>
        </div>

        {/* Barra de progresso */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>{processedRows} de {totalRows} processados</span>
            <span className={`font-semibold ${percentColor}`}>{percentage}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-500 ${barColor}`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        {/* Tempo estimado */}
        {isProcessing && estimatedTimeRemaining > 0 && (
          <div className="flex items-center gap-2 text-sm text-gray-600 bg-blue-50 p-3 rounded">
            <Clock className="w-4 h-4 text-blue-600" />
            <span>
              Tempo estimado: <strong>{estimatedTimeRemaining} minuto{estimatedTimeRemaining !== 1 ? 's' : ''}</strong>
            </span>
          </div>
        )}

        {/* Mensagem de conclusão */}
        {isComplete && (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 p-3 rounded">
            <CheckCircle2 className="w-4 h-4" />
            <span>Processamento concluído com sucesso!</span>
          </div>
        )}

        {isFailed && (
          <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 p-3 rounded">
            <AlertCircle className="w-4 h-4" />
            <span>Processamento falhou. Veja os erros abaixo.</span>
          </div>
        )}
      </div>
    </Card>
  );
}
