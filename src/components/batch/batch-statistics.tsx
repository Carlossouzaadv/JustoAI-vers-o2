// ================================================================
// BATCH STATISTICS - Component
// ================================================================
// Exibe estatísticas agregadas (total, sucesso, erro, taxa)

'use client';

import { Check, X, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface BatchStatisticsProps {
  totalProcesses: number;
  successfulProcesses: number;
  failedProcesses: number;
  successRate: number;
}

export function BatchStatistics({
  totalProcesses,
  successfulProcesses,
  failedProcesses,
  successRate,
}: BatchStatisticsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {/* Total */}
      <Card className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-600 font-medium">Total de Processos</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{totalProcesses}</p>
          </div>
          <div className="p-2 bg-blue-100 rounded-lg">
            <div className="w-6 h-6 text-blue-600" />
          </div>
        </div>
      </Card>

      {/* Sucesso */}
      <Card className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-600 font-medium">Processados com Sucesso</p>
            <p className="text-3xl font-bold text-green-600 mt-1">{successfulProcesses}</p>
          </div>
          <div className="p-2 bg-green-100 rounded-lg">
            <Check className="w-6 h-6 text-green-600" />
          </div>
        </div>
      </Card>

      {/* Erro */}
      <Card className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-600 font-medium">Com Erro</p>
            <p className="text-3xl font-bold text-red-600 mt-1">{failedProcesses}</p>
          </div>
          <div className="p-2 bg-red-100 rounded-lg">
            <X className="w-6 h-6 text-red-600" />
          </div>
        </div>
      </Card>

      {/* Taxa de Sucesso */}
      <Card className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-600 font-medium">Taxa de Sucesso</p>
            <p className="text-3xl font-bold text-purple-600 mt-1">{successRate}%</p>
          </div>
          <div className="p-2 bg-purple-100 rounded-lg">
            <TrendingUp className="w-6 h-6 text-purple-600" />
          </div>
        </div>
      </Card>
    </div>
  );
}
