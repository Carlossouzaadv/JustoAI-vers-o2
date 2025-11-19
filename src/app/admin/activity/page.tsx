'use client';

/**
 * Admin Activity Feed Page
 * Exibe o feed completo de atividade do sistema em tempo real
 * Padrão-Ouro: Dados reais da API /api/admin/activity
 */

import { useEffect, useState } from 'react';
import { Activity, AlertCircle, TrendingUp, FileText, RefreshCw } from 'lucide-react';
import { getErrorMessage } from '@/lib/error-handling';

interface ActivityEvent {
  id: string;
  type: 'CREDIT_TRANSACTION' | 'CASE_ANALYSIS';
  action: string;
  workspaceId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  relatedEntity?: {
    id: string;
    name: string;
  };
}

interface ActivityData {
  events: ActivityEvent[];
  totalEvents: number;
  creditTransactionsCount: number;
  analysisVersionsCount: number;
}

function getEventIcon(type: string) {
  switch (type) {
    case 'CREDIT_TRANSACTION':
      return <TrendingUp className="w-5 h-5 text-green-600" />;
    case 'CASE_ANALYSIS':
      return <FileText className="w-5 h-5 text-blue-600" />;
    default:
      return <Activity className="w-5 h-5 text-gray-600" />;
  }
}

function getEventColor(type: string) {
  switch (type) {
    case 'CREDIT_TRANSACTION':
      return { bg: 'bg-green-50', border: 'border-green-100', badge: 'bg-green-100 text-green-800' };
    case 'CASE_ANALYSIS':
      return { bg: 'bg-blue-50', border: 'border-blue-100', badge: 'bg-blue-100 text-blue-800' };
    default:
      return { bg: 'bg-gray-50', border: 'border-gray-100', badge: 'bg-gray-100 text-gray-800' };
  }
}

export default function ActivityPage() {
  const [activity, setActivity] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchActivity = async () => {
    try {
      const response = await fetch('/api/admin/activity');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      if (result.success && result.activity) {
        setActivity(result.activity);
        setLastUpdate(new Date());
        setError(null);
      } else {
        throw new Error(result.error || 'Invalid response');
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivity();
    // Refresh every 30 seconds
    const interval = setInterval(fetchActivity, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Activity className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-gray-600">Carregando atividade...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-red-800">Erro ao carregar atividade: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">📊 Feed de Atividade</h1>
          <p className="text-gray-600 mt-1">
            {activity?.totalEvents || 0} eventos totais | Atualizado às {lastUpdate.toLocaleTimeString('pt-BR')}
          </p>
        </div>
        <button
          onClick={fetchActivity}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-gray-600 text-sm font-semibold mb-2">Total de Eventos</p>
          <p className="text-3xl font-bold text-gray-900">{activity?.totalEvents || 0}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-800 text-sm font-semibold mb-2">Transações de Crédito</p>
          <p className="text-3xl font-bold text-green-600">{activity?.creditTransactionsCount || 0}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-800 text-sm font-semibold mb-2">Análises de Casos</p>
          <p className="text-3xl font-bold text-blue-600">{activity?.analysisVersionsCount || 0}</p>
        </div>
      </div>

      {/* Activity List */}
      {!activity || activity.events.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Nenhuma atividade registrada</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activity.events.map((event) => {
            const colors = getEventColor(event.type);
            return (
              <div
                key={event.id}
                className={`border rounded-lg p-4 ${colors.bg} ${colors.border}`}
              >
                <div className="flex items-start gap-4">
                  <div className="mt-1 flex-shrink-0">
                    {getEventIcon(event.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {event.action}
                        </p>
                        {event.relatedEntity && (
                          <p className="text-xs text-gray-600 mt-1">
                            Entidade: {event.relatedEntity.name}
                          </p>
                        )}
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-semibold flex-shrink-0 ${colors.badge}`}>
                        {event.type === 'CREDIT_TRANSACTION' ? 'Crédito' : 'Análise'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="text-xs text-gray-600 bg-gray-200 px-2 py-1 rounded">
                        {event.workspaceId}
                      </span>
                      <span className="text-xs text-gray-600">
                        {new Date(event.createdAt).toLocaleString('pt-BR')}
                      </span>
                    </div>

                    {/* Metadata Display */}
                    {event.metadata && Object.keys(event.metadata).length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-300">
                        <p className="text-xs font-semibold text-gray-700 mb-2">Detalhes:</p>
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(event.metadata).map(([key, value]) => (
                            <div key={key} className="text-xs">
                              <span className="font-medium text-gray-700">{key}:</span>
                              <span className="text-gray-600 ml-1">{String(value)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tips */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900 mb-3 font-semibold">💡 Informações</p>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Este feed mostra eventos em tempo real do sistema</li>
          <li>• Inclui transações de crédito e versões de análise de casos</li>
          <li>• Os eventos são atualizados automaticamente a cada 30 segundos</li>
          <li>• Use o botão &quot;Atualizar&quot; para carregar dados mais recentes</li>
          <li>✅ Todos os dados são carregados da API real (Padrão-Ouro)</li>
        </ul>
      </div>
    </div>
  );
}
