'use client';

import { useEffect, useState } from 'react';
import { Activity, AlertCircle, CheckCircle, AlertTriangle, Zap, TrendingUp, Timer, Copy, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface DashboardData {
  sentry?: {
    errors?: {
      total: number;
      rate: number;
      recent: any[];
      top: any[];
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
  alerts?: {
    totalUnresolved: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  system?: {
    status: string;
    components: Record<string, { status: string; message?: string }>;
  };
}

interface NavCard {
  label: string;
  href: string;
  icon: string;
  description: string;
  color: 'blue' | 'purple' | 'green' | 'orange' | 'red' | 'pink';
}

const NAV_CARDS: NavCard[] = [
  { label: 'JUDIT Monitor', href: '/admin/dashboard/judit', icon: '📊', description: 'Real-time JUDIT metrics', color: 'blue' },
  { label: 'Observabilidade', href: '/admin/observability', icon: '🔍', description: 'Sentry + Performance', color: 'purple' },
  { label: 'Filas (Bull)', href: '/admin/queues', icon: '⚙️', description: 'Queue dashboard', color: 'orange' },
  { label: 'Logs', href: '/admin/logs', icon: '📝', description: 'System logs', color: 'green' },
  { label: 'Alertas', href: '/admin/alerts', icon: '🚨', description: 'Active alerts', color: 'red' },
  { label: 'Status', href: '/admin/status', icon: '💚', description: 'Health checks', color: 'pink' },
];

export default function AdminHomePage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const copyToClipboard = (errorId: string, errorData: any) => {
    const errorText = `
ERROR REPORT
============
Title: ${errorData.title}
Culprit: ${errorData.culprit}
Level: ${errorData.level}
Count: ${errorData.count}
Users Affected: ${errorData.userCount}
Last Seen: ${new Date(errorData.lastSeen).toLocaleString('pt-BR')}

Navigate to: /admin/errors for full details
    `.trim();

    navigator.clipboard.writeText(errorText).then(() => {
      setCopiedId(errorId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const getHealthColor = (status?: string) => {
    switch (status) {
      case 'healthy':
        return { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-600' };
      case 'degraded':
        return { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-600' };
      case 'critical':
        return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-600' };
      default:
        return { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-600' };
    }
  };

  const getHealthIcon = (status?: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'degraded':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'critical':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Activity className="w-5 h-5 text-gray-600" />;
    }
  };

  const getCardColor = (color: string) => {
    const colors: Record<string, string> = {
      blue: 'from-blue-50 to-blue-100 border-blue-200 hover:border-blue-300',
      purple: 'from-purple-50 to-purple-100 border-purple-200 hover:border-purple-300',
      green: 'from-green-50 to-green-100 border-green-200 hover:border-green-300',
      orange: 'from-orange-50 to-orange-100 border-orange-200 hover:border-orange-300',
      red: 'from-red-50 to-red-100 border-red-200 hover:border-red-300',
      pink: 'from-pink-50 to-pink-100 border-pink-200 hover:border-pink-300',
    };
    return colors[color] || colors.blue;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Activity className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-gray-600">Carregando dashboard...</p>
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">🏠 Admin Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Sistema atualizado às {lastUpdate.toLocaleTimeString('pt-BR')}
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
        >
          ↻ Atualizar
        </button>
      </div>

      {/* System Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Sentry Health */}
        {health && (
          <div className={`border rounded-lg p-4 ${getHealthColor(health.status).bg} ${getHealthColor(health.status).border} border`}>
            <div className="flex items-center justify-between mb-2">
              <p className="font-semibold text-gray-900">Sentry</p>
              {getHealthIcon(health.status)}
            </div>
            <p className={`text-sm capitalize font-medium ${getHealthColor(health.status).text}`}>
              {health.status}
            </p>
            <p className="text-xs text-gray-600 mt-2">{health.message}</p>
          </div>
        )}

        {/* Queue Health */}
        {queues && (
          <div className={`border rounded-lg p-4 ${getHealthColor(
            queues.summary?.healthyQueues === queues.summary?.totalQueues ? 'healthy' : 'degraded'
          ).bg} ${getHealthColor(
            queues.summary?.healthyQueues === queues.summary?.totalQueues ? 'healthy' : 'degraded'
          ).border} border`}>
            <div className="flex items-center justify-between mb-2">
              <p className="font-semibold text-gray-900">Filas Bull</p>
              <Zap className="w-5 h-5 text-yellow-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {queues.summary?.healthyQueues}/{queues.summary?.totalQueues}
            </p>
            <p className="text-xs text-gray-600 mt-2">filas saudáveis</p>
          </div>
        )}

        {/* Placeholder - JUDIT Status */}
        <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
          <div className="flex items-center justify-between mb-2">
            <p className="font-semibold text-gray-900">JUDIT API</p>
            <CheckCircle className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">100%</p>
          <p className="text-xs text-gray-600 mt-2">disponibilidade</p>
        </div>
      </div>

      {/* Quick Stats Grid */}
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

      {/* Recent Errors with Copy Button */}
      {errors && errors.recent && errors.recent.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">5 Erros Mais Recentes</h2>
            <a
              href="/admin/errors"
              className="text-blue-600 hover:underline text-sm font-medium flex items-center gap-1"
            >
              Ver todos <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="space-y-2">
            {errors.recent.slice(0, 5).map((error: any, idx: number) => (
              <div
                key={idx}
                className="flex items-start justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition border border-gray-100"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{error.title}</p>
                  <p className="text-xs text-gray-600 truncate mt-1">{error.culprit}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      error.level === 'error' ? 'bg-red-100 text-red-800' :
                      error.level === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {error.level}
                    </span>
                    <span className="text-xs text-gray-600">
                      {error.count} ocorrências
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => copyToClipboard(`error-${idx}`, error)}
                  className={`ml-2 flex-shrink-0 p-2 rounded transition ${
                    copiedId === `error-${idx}`
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                  title="Copiar para Claude Code"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Navigation Cards */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Acesso Rápido</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {NAV_CARDS.map((card) => (
            <a
              key={card.href}
              href={card.href}
              className={`bg-gradient-to-br ${getCardColor(card.color)} border-2 rounded-lg p-4 transition hover:shadow-lg cursor-pointer`}
            >
              <p className="text-2xl mb-2">{card.icon}</p>
              <p className="font-semibold text-sm text-gray-900">{card.label}</p>
              <p className="text-xs text-gray-600 mt-1">{card.description}</p>
            </a>
          ))}
        </div>
      </div>

      {/* Tips Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900 mb-3 font-semibold">💡 Dicas</p>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Clique nos botões 📋 dos erros para copiar o contexto direto pro Claude Code</li>
          <li>• Use a aba "Erros" para filtrar por severidade, tipo ou período</li>
          <li>• Todos os dashboards se atualizam automaticamente a cada 30 segundos</li>
          <li>• Navegue com a barra lateral para acessar Logs, Alertas e Status do sistema</li>
        </ul>
      </div>
    </div>
  );
}
