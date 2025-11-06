'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, AlertTriangle, TrendingUp, Activity, Zap, Timer } from 'lucide-react';
import { getErrorMessage } from '@/lib/error-handling';

interface ObservabilityData {
  sentry: {
    errors?: {
      total: number;
      rate: number;
      recent: unknown[];
      top: unknown[];
    };
    health?: {
      status: 'healthy' | 'degraded' | 'critical';
      message: string;
    };
    performance?: {
      p50: number;
      p95: number;
      p99: number;
    };
  };
  queues?: {
    summary: {
      totalQueues: number;
      activeQueues: number;
      healthyQueues: number;
    };
  };
  system?: {
    status: string;
    components: {
      queues: { status: string };
      redis: { status: string };
    };
  };
}

export default function ObservabilityPage() {
  const [data, setData] = useState<ObservabilityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/admin/observability');
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const result = await response.json();
        if (result.success) {
          setData(result.observability);
          setLastUpdate(new Date());
        }
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Activity className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-gray-600">Carregando dados de observabilidade...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-red-800">Erro ao carregar dados: {error}</p>
        </div>
      </div>
    );
  }

  const health = data?.sentry?.health;
  const errors = data?.sentry?.errors;
  const performance = data?.sentry?.performance;
  const queues = data?.queues;

  const getHealthColor = (status?: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'degraded':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getHealthIcon = (status?: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5" />;
      case 'degraded':
        return <AlertTriangle className="w-5 h-5" />;
      case 'critical':
        return <AlertCircle className="w-5 h-5" />;
      default:
        return <Activity className="w-5 h-5" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Observabilidade do Sistema</h1>
          <p className="text-gray-600 mt-1">
            Último update: {lastUpdate.toLocaleTimeString('pt-BR')}
          </p>
        </div>
        <a
          href="https://sentry.io/organizations/justoai/issues/"
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          Ir para Sentry
        </a>
      </div>

      {/* Health Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Sentry Health */}
        {health && (
          <div className={`border rounded-lg p-4 ${getHealthColor(health.status)}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold capitalize">{health.status}</p>
                <p className="text-sm mt-1">{health.message}</p>
              </div>
              {getHealthIcon(health.status)}
            </div>
          </div>
        )}

        {/* Queue Health */}
        {queues && (
          <div className={`border rounded-lg p-4 ${getHealthColor(
            queues.summary?.healthyQueues === queues.summary?.totalQueues ? 'healthy' : 'degraded'
          )}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">Filas Bull</p>
                <p className="text-sm mt-1">
                  {queues.summary?.healthyQueues}/{queues.summary?.totalQueues} saudáveis
                </p>
              </div>
              <Zap className="w-5 h-5" />
            </div>
          </div>
        )}
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Error Count */}
        {errors && (
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-gray-600 text-sm font-semibold">ERROS (24h)</p>
              <AlertCircle className="w-4 h-4 text-red-500" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{errors.total}</p>
            <p className="text-xs text-red-600 mt-2">Taxa: {errors.rate.toFixed(2)}%</p>
          </div>
        )}

        {/* Performance P50 */}
        {performance && (
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-gray-600 text-sm font-semibold">P50 LATÊNCIA</p>
              <Timer className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{performance.p50}ms</p>
            <p className="text-xs text-gray-600 mt-2">50º percentil</p>
          </div>
        )}

        {/* Performance P95 */}
        {performance && (
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-gray-600 text-sm font-semibold">P95 LATÊNCIA</p>
              <TrendingUp className="w-4 h-4 text-yellow-500" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{performance.p95}ms</p>
            <p className="text-xs text-gray-600 mt-2">95º percentil</p>
          </div>
        )}

        {/* Performance P99 */}
        {performance && (
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-gray-600 text-sm font-semibold">P99 LATÊNCIA</p>
              <AlertTriangle className="w-4 h-4 text-red-500" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{performance.p99}ms</p>
            <p className="text-xs text-gray-600 mt-2">99º percentil</p>
          </div>
        )}
      </div>

      {/* Recent Errors Table */}
      {errors && errors.recent.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Erros Recentes</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-2 font-semibold text-gray-900">Tipo</th>
                  <th className="text-left py-2 px-2 font-semibold text-gray-900">Ocorrências</th>
                  <th className="text-left py-2 px-2 font-semibold text-gray-900">Nível</th>
                  <th className="text-left py-2 px-2 font-semibold text-gray-900">Usuários</th>
                  <th className="text-left py-2 px-2 font-semibold text-gray-900">Última</th>
                </tr>
              </thead>
              <tbody>
                {errors.recent.map((error: any, idx: number) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-2">
                      <span className="text-gray-900 font-medium truncate block">{error.title}</span>
                      <span className="text-xs text-gray-600">{error.culprit}</span>
                    </td>
                    <td className="py-2 px-2 text-gray-900">{error.count}</td>
                    <td className="py-2 px-2">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        error.level === 'error' ? 'bg-red-100 text-red-800' :
                        error.level === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {error.level}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-gray-900">{error.userCount}</td>
                    <td className="py-2 px-2 text-gray-600 text-xs">
                      {new Date(error.lastSeen).toLocaleString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top Errors */}
      {errors && errors.top.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Top Erros (por ocorrências)</h2>
          <div className="space-y-2">
            {errors.top.slice(0, 5).map((error: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div>
                  <p className="font-medium text-gray-900">{error.title}</p>
                  <p className="text-xs text-gray-600">{error.culprit}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-red-600">{error.count}</p>
                  <p className="text-xs text-gray-600">ocorrências</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Links */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900 mb-3 font-semibold">🔗 Links Úteis</p>
        <div className="flex flex-wrap gap-2">
          <a
            href="https://sentry.io/organizations/justoai/issues/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline text-sm"
          >
            Dashboard Sentry →
          </a>
          <a
            href="/admin/queues"
            className="text-blue-600 hover:underline text-sm"
          >
            Bull Board →
          </a>
          <a
            href="/api/admin/observability"
            className="text-blue-600 hover:underline text-sm"
          >
            API JSON →
          </a>
        </div>
      </div>
    </div>
  );
}
