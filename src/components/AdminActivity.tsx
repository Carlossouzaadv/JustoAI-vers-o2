'use client';

/**
 * AdminActivity Component
 * Exibe feed de atividade em tempo real do dashboard
 * - Transações de crédito
 * - Análises de casos
 *
 * Padrão-Ouro: Dados reais da API /api/admin/activity
 */

import { useEffect, useState } from 'react';
import { Activity, AlertCircle, TrendingUp, FileText } from 'lucide-react';
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
      return <TrendingUp className="w-4 h-4 text-green-600" />;
    case 'CASE_ANALYSIS':
      return <FileText className="w-4 h-4 text-blue-600" />;
    default:
      return <Activity className="w-4 h-4 text-gray-600" />;
  }
}

function getEventColor(type: string) {
  switch (type) {
    case 'CREDIT_TRANSACTION':
      return { bg: 'bg-green-50', border: 'border-green-100' };
    case 'CASE_ANALYSIS':
      return { bg: 'bg-blue-50', border: 'border-blue-100' };
    default:
      return { bg: 'bg-gray-50', border: 'border-gray-100' };
  }
}

interface AdminActivityProps {
  limit?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export default function AdminActivity({
  limit = 10,
  autoRefresh = true,
  refreshInterval = 30000
}: AdminActivityProps) {
  const [activity, setActivity] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
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

    fetchActivity();

    if (autoRefresh) {
      const interval = setInterval(fetchActivity, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Activity className="w-5 h-5 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600">Carregando atividade...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-red-800 text-sm">Erro ao carregar atividade: {error}</p>
        </div>
      </div>
    );
  }

  if (!activity || activity.events.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
        <Activity className="w-8 h-8 text-gray-400 mx-auto mb-2" />
        <p className="text-gray-600">Nenhuma atividade recente</p>
      </div>
    );
  }

  const displayEvents = activity.events.slice(0, limit);

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold text-gray-900">Atividade Recente</h3>
        <span className="text-xs text-gray-600">
          {activity.totalEvents} eventos | Atualizado às {lastUpdate.toLocaleTimeString('pt-BR')}
        </span>
      </div>

      <div className="space-y-2">
        {displayEvents.map((event) => {
          const colors = getEventColor(event.type);
          return (
            <div
              key={event.id}
              className={`border rounded-lg p-3 ${colors.bg} ${colors.border}`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-1 flex-shrink-0">
                  {getEventIcon(event.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 mb-1">
                    {event.action}
                  </p>
                  <div className="flex flex-wrap gap-2 items-center text-xs">
                    {event.relatedEntity && (
                      <span className="bg-gray-200 text-gray-800 px-2 py-1 rounded">
                        {event.relatedEntity.name}
                      </span>
                    )}
                    <span className="text-gray-600">
                      {new Date(event.createdAt).toLocaleString('pt-BR')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {activity.totalEvents > limit && (
        <a
          href="/admin/activity"
          className="text-xs text-blue-600 hover:underline font-medium block text-center mt-2"
        >
          Ver todas as {activity.totalEvents} atividades →
        </a>
      )}
    </div>
  );
}
