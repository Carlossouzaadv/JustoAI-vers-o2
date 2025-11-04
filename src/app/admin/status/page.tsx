'use client';

import { useEffect, useState } from 'react';
import { Activity, AlertCircle, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';

interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'critical' | 'unknown';
  lastCheck: string;
  responseTime?: number;
  message: string;
  remediation?: string[];
}

interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'critical';
  checks: Record<string, HealthCheck>;
  timestamp: string;
}

export default function StatusPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Mock health checks - will be replaced by real API from OPÇÃO C
  const mockHealth: SystemHealth = {
    overall: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      api: {
        name: 'API Server',
        status: 'healthy',
        lastCheck: new Date(Date.now() - 5000).toISOString(),
        responseTime: 45,
        message: 'Next.js API running normally',
      },
      postgres: {
        name: 'PostgreSQL Database',
        status: 'healthy',
        lastCheck: new Date(Date.now() - 5000).toISOString(),
        responseTime: 12,
        message: 'Database connection OK',
      },
      redis: {
        name: 'Redis Cache',
        status: 'healthy',
        lastCheck: new Date(Date.now() - 5000).toISOString(),
        responseTime: 8,
        message: 'Cache server operational',
      },
      auth: {
        name: 'Supabase Auth',
        status: 'healthy',
        lastCheck: new Date(Date.now() - 5000).toISOString(),
        responseTime: 120,
        message: 'Authentication service available',
      },
      queues: {
        name: 'Bull Queues',
        status: 'healthy',
        lastCheck: new Date(Date.now() - 5000).toISOString(),
        responseTime: 25,
        message: 'All queues operational',
      },
      sentry: {
        name: 'Sentry Monitoring',
        status: 'healthy',
        lastCheck: new Date(Date.now() - 5000).toISOString(),
        responseTime: 200,
        message: 'Error tracking active',
      },
      judit: {
        name: 'JUDIT API',
        status: 'healthy',
        lastCheck: new Date(Date.now() - 5000).toISOString(),
        responseTime: 350,
        message: 'External API responding normally',
      },
      storage: {
        name: 'Supabase Storage',
        status: 'healthy',
        lastCheck: new Date(Date.now() - 5000).toISOString(),
        responseTime: 180,
        message: 'File storage service operational',
      },
    },
  };

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        // TODO: Replace with real API endpoint when OPÇÃO C is done
        // const response = await fetch('/api/admin/status');
        // if (!response.ok) throw new Error(`HTTP ${response.status}`);
        // const result = await response.json();
        // setHealth(result.health || mockHealth);

        // For now, use mock data
        setHealth(mockHealth);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch health data');
      } finally {
        setLoading(false);
      }
    };

    fetchHealth();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // TODO: Replace with real API call
      setHealth(mockHealth);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh');
    } finally {
      setIsRefreshing(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-6 h-6 text-green-600" />;
      case 'degraded':
        return <AlertTriangle className="w-6 h-6 text-yellow-600" />;
      case 'critical':
        return <AlertCircle className="w-6 h-6 text-red-600" />;
      default:
        return <Activity className="w-6 h-6 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', badge: 'bg-green-100' };
      case 'degraded':
        return { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800', badge: 'bg-yellow-100' };
      case 'critical':
        return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', badge: 'bg-red-100' };
      default:
        return { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-800', badge: 'bg-gray-100' };
    }
  };

  const getOverallStatusText = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'Todos os sistemas operacionais';
      case 'degraded':
        return 'Alguns serviços com problemas leves';
      case 'critical':
        return 'Problemas críticos detectados';
      default:
        return 'Status desconhecido';
    }
  };

  const statusOrder = ['critical', 'degraded', 'unknown', 'healthy'];
  const sortedChecks = Object.entries(health?.checks || {})
    .sort(([, a], [, b]) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Activity className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-gray-600">Carregando status do sistema...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-red-800">Erro ao carregar status: {error}</p>
        </div>
      </div>
    );
  }

  const colors = getStatusColor(health?.overall || 'unknown');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">💚 Status do Sistema</h1>
          <p className="text-gray-600 mt-1">
            Verificação de saúde dos componentes
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* Overall Status Card */}
      {health && (
        <div className={`border-2 rounded-lg p-6 ${colors.bg} ${colors.border}`}>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                {getStatusIcon(health.overall)}
                <h2 className={`text-2xl font-bold ${colors.text}`}>
                  {getOverallStatusText(health.overall)}
                </h2>
              </div>
              <p className="text-sm text-gray-600">
                Última verificação: {new Date(health.timestamp).toLocaleString('pt-BR')}
              </p>
            </div>
            <div className={`px-3 py-1 rounded-full ${colors.badge}`}>
              <p className={`text-sm font-semibold ${colors.text} capitalize`}>
                {health.overall}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Status Summary */}
      {health && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-800 font-medium mb-1">Operacionais</p>
            <p className="text-2xl font-bold text-green-600">
              {Object.values(health.checks).filter((c) => c.status === 'healthy').length}
            </p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800 font-medium mb-1">Degradados</p>
            <p className="text-2xl font-bold text-yellow-600">
              {Object.values(health.checks).filter((c) => c.status === 'degraded').length}
            </p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800 font-medium mb-1">Críticos</p>
            <p className="text-2xl font-bold text-red-600">
              {Object.values(health.checks).filter((c) => c.status === 'critical').length}
            </p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-800 font-medium mb-1">Total</p>
            <p className="text-2xl font-bold text-gray-600">
              {Object.values(health.checks).length}
            </p>
          </div>
        </div>
      )}

      {/* Detailed Health Checks */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Verificação Detalhada</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sortedChecks.map(([key, check]) => {
            const checkColors = getStatusColor(check.status);
            return (
              <div
                key={key}
                className={`border-2 rounded-lg p-4 ${checkColors.bg} ${checkColors.border}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(check.status)}
                    <div>
                      <h3 className="font-semibold text-gray-900">{check.name}</h3>
                      <p className={`text-xs ${checkColors.text} font-medium capitalize`}>
                        {check.status}
                      </p>
                    </div>
                  </div>
                </div>

                <p className="text-sm text-gray-700 mb-2">{check.message}</p>

                <div className="flex justify-between text-xs text-gray-600">
                  {check.responseTime && (
                    <span>⏱️ {check.responseTime}ms</span>
                  )}
                  <span>
                    Verificado: {new Date(check.lastCheck).toLocaleTimeString('pt-BR')}
                  </span>
                </div>

                {check.remediation && check.remediation.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-300">
                    <p className="text-xs font-semibold text-gray-700 mb-2">Recomendações:</p>
                    <ul className="text-xs text-gray-700 space-y-1">
                      {check.remediation.map((step, idx) => (
                        <li key={idx} className="flex gap-2">
                          <span className="text-gray-500">•</span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900 mb-3 font-semibold">📋 Legenda de Status</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="text-blue-800">Saudável</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-600" />
            <span className="text-blue-800">Degradado</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span className="text-blue-800">Crítico</span>
          </div>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-gray-600" />
            <span className="text-blue-800">Desconhecido</span>
          </div>
        </div>
      </div>

      {/* Tips */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900 mb-3 font-semibold">💡 Como usar</p>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Clique em "Atualizar" para fazer uma nova verificação manual</li>
          <li>• O status geral é determinado pelo componente mais crítico</li>
          <li>• Tempo de resposta mostra latência do último check</li>
          <li>• Recomendações aparecem quando há problemas detectados</li>
          <li>Note: Dados de demonstração. APIs reais serão conectadas em breve.</li>
        </ul>
      </div>
    </div>
  );
}
