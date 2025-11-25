'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { Activity, AlertCircle, AlertTriangle, Bell, CheckCircle, Trash2, X } from 'lucide-react';

interface Alert {
  id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  alertType: string;
  title: string;
  message: string;
  workspaceId?: string;
  resolved: boolean;
  createdAt: string;
  resolvedAt?: string;
  metadata?: Record<string, unknown>;
}

type SeverityFilter = 'all' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Filters
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [showResolved, setShowResolved] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // UI State
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Fetch real alerts from API (removed mock data)

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const response = await fetch('/api/admin/alerts');
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} - Failed to fetch alerts`);
        }

        const result = await response.json();
        if (result.success && result.alerts) {
          setAlerts(result.alerts);
        } else {
          throw new Error(result.error || 'Invalid response from API');
        }
        setLastUpdate(new Date());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch alerts');
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();
    // Refresh every 30 seconds
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleResolveAlert = (alertId: string) => {
    setAlerts((prev) =>
      prev.map((alert) =>
        alert.id === alertId
          ? { ...alert, resolved: true, resolvedAt: new Date().toISOString() }
          : alert
      )
    );
  };

  const handleDeleteAlert = (alertId: string) => {
    setAlerts((prev) => prev.filter((alert) => alert.id !== alertId));
  };

  // Filter alerts
  const filteredAlerts = alerts
    .filter((alert) => {
      if (!showResolved && alert.resolved) return false;
      if (severityFilter !== 'all' && alert.severity !== severityFilter) return false;
      if (searchTerm && !alert.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !alert.message.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      // Sort by: unresolved first, then by severity, then by date
      if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;
      const severityOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      if (a.severity !== b.severity) return severityOrder[a.severity] - severityOrder[b.severity];
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const unresolvdCount = alerts.filter((a) => !a.resolved).length;
  const criticalCount = alerts.filter((a) => a.severity === 'CRITICAL' && !a.resolved).length;
  const highCount = alerts.filter((a) => a.severity === 'HIGH' && !a.resolved).length;

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'HIGH':
        return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      case 'MEDIUM':
        return <Bell className="w-5 h-5 text-yellow-600" />;
      case 'LOW':
        return <CheckCircle className="w-5 h-5 text-blue-600" />;
      default:
        return <Activity className="w-5 h-5 text-gray-600" />;
    }
  };

  const getSeverityColor = (severity: string, resolved: boolean) => {
    if (resolved) {
      return { bg: 'bg-gray-50', border: 'border-gray-200', badge: 'bg-gray-100', text: 'text-gray-800' };
    }
    switch (severity) {
      case 'CRITICAL':
        return { bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100', text: 'text-red-800' };
      case 'HIGH':
        return { bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-100', text: 'text-orange-800' };
      case 'MEDIUM':
        return { bg: 'bg-yellow-50', border: 'border-yellow-200', badge: 'bg-yellow-100', text: 'text-yellow-800' };
      case 'LOW':
        return { bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-100', text: 'text-blue-800' };
      default:
        return { bg: 'bg-gray-50', border: 'border-gray-200', badge: 'bg-gray-100', text: 'text-gray-800' };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Activity className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-gray-600">Carregando alertas...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-red-800">Erro ao carregar alertas: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">🚨 Alertas do Sistema</h1>
          <p className="text-gray-600 mt-1">
            {unresolvdCount} alertas ativos | Atualizado às {lastUpdate.toLocaleTimeString('pt-BR')}
          </p>
        </div>
      </div>

      {/* Alert Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800 font-medium mb-1">Críticos</p>
          <p className="text-3xl font-bold text-red-600">{criticalCount}</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <p className="text-sm text-orange-800 font-medium mb-1">Altos</p>
          <p className="text-3xl font-bold text-orange-600">{highCount}</p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800 font-medium mb-1">Médios</p>
          <p className="text-3xl font-bold text-yellow-600">
            {alerts.filter((a) => a.severity === 'MEDIUM' && !a.resolved).length}
          </p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800 font-medium mb-1">Resolvidos</p>
          <p className="text-3xl font-bold text-blue-600">
            {alerts.filter((a) => a.resolved).length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Severity Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Severidade</label>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as SeverityFilter)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos</option>
              <option value="CRITICAL">Crítico</option>
              <option value="HIGH">Alto</option>
              <option value="MEDIUM">Médio</option>
              <option value="LOW">Baixo</option>
            </select>
          </div>

          {/* Show Resolved */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Mostrar</label>
            <select
              value={showResolved ? 'all' : 'unresolved'}
              onChange={(e) => setShowResolved(e.target.value === 'all')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="unresolved">Apenas Não Resolvidos</option>
              <option value="all">Todos</option>
            </select>
          </div>

          {/* Search */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Buscar</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Título ou mensagem..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-2 p-1 hover:bg-gray-100 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        {filteredAlerts.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
            <p className="text-gray-600">Nenhum alerta encontrado com os filtros selecionados</p>
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const colors = getSeverityColor(alert.severity, alert.resolved);
            return (
              <div
                key={alert.id}
                className={`border-2 rounded-lg overflow-hidden hover:shadow-md transition ${colors.bg} ${colors.border}`}
              >
                {/* Alert Row */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    {/* Alert Header */}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {getSeverityIcon(alert.severity)}
                      <div className="flex-1 min-w-0">
                        <h3 className={`font-semibold text-gray-900 mb-1 ${alert.resolved ? 'line-through' : ''}`}>
                          {alert.title}
                        </h3>
                        <p className={`text-sm text-gray-700 mb-2 ${alert.resolved ? 'opacity-75' : ''}`}>
                          {alert.message}
                        </p>
                        <div className="flex flex-wrap gap-2 items-center">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${colors.badge} ${colors.text}`}>
                            {alert.severity}
                          </span>
                          {alert.resolved && (
                            <span className="px-2 py-1 rounded text-xs font-semibold bg-green-100 text-green-800">
                              ✓ Resolvido
                            </span>
                          )}
                          {alert.workspaceId && (
                            <span className="text-xs text-gray-600 bg-gray-200 px-2 py-1 rounded">
                              {alert.workspaceId}
                            </span>
                          )}
                          <span className="text-xs text-gray-600">
                            {new Date(alert.createdAt).toLocaleString('pt-BR')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 flex-shrink-0">
                      {!alert.resolved && (
                        <button
                          onClick={() => handleResolveAlert(alert.id)}
                          className="p-2 rounded border border-green-300 text-green-700 hover:bg-green-50 transition"
                          title="Marcar como resolvido"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteAlert(alert.id)}
                        className="p-2 rounded border border-gray-300 text-gray-700 hover:bg-red-50 transition"
                        title="Remover alerta"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setExpandedId(expandedId === alert.id ? null : alert.id)}
                        className="px-3 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-100 text-sm font-medium transition"
                      >
                        {expandedId === alert.id ? '−' : '+'}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expandedId === alert.id && (
                    <div className="mt-3 pt-3 border-t border-gray-300 space-y-3">
                      <div>
                        <p className="text-xs font-semibold text-gray-700 mb-1">CRIADO:</p>
                        <p className="text-xs text-gray-600">
                          {new Date(alert.createdAt).toLocaleString('pt-BR')}
                        </p>
                      </div>

                      {alert.resolvedAt && (
                        <div>
                          <p className="text-xs font-semibold text-gray-700 mb-1">RESOLVIDO EM:</p>
                          <p className="text-xs text-gray-600">
                            {new Date(alert.resolvedAt).toLocaleString('pt-BR')}
                          </p>
                        </div>
                      )}

                      {alert.metadata && Object.keys(alert.metadata).length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-700 mb-1">METADADOS:</p>
                          <pre className="bg-gray-800 text-gray-100 p-2 rounded text-xs overflow-x-auto">
                            {JSON.stringify(alert.metadata, null, 2)}
                          </pre>
                        </div>
                      )}

                      {alert.severity === 'CRITICAL' && !alert.resolved && (
                        <div className="bg-red-100 border border-red-300 rounded p-2">
                          <p className="text-xs font-semibold text-red-800 mb-1">⚠️ AÇÃO RECOMENDADA:</p>
                          <p className="text-xs text-red-700">
                            Este é um alerta crítico. Investigue imediatamente e tome as medidas necessárias.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Tips */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900 mb-3 font-semibold">💡 Como usar</p>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Use o ícone ✓ para marcar alertas como resolvidos (cliente)</li>
          <li>• Use a lixeira para remover alertas do dashboard (cliente)</li>
          <li>• Clique &quot;+&quot; para expandir detalhes e metadados do alerta</li>
          <li>• Alertas críticos aparecem sempre no topo e em destaque vermelho</li>
          <li>✅ Dados agora são carregados em tempo real (API real conectada)</li>
          <li>• Dashboard atualiza automaticamente a cada 30 segundos</li>
        </ul>
      </div>
    </div>
  );
}
