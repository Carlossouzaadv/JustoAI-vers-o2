/* eslint-disable react/no-unescaped-entities */
'use client';

import { useEffect, useState } from 'react';
import { Activity, AlertCircle, Copy, ExternalLink, Filter, X } from 'lucide-react';

interface ErrorItem {
  id: string;
  title: string;
  culprit: string;
  level: string;
  count: number;
  userCount: number;
  lastSeen: string;
  firstSeen: string;
  status: string;
  shortId: string;
  errorDetails?: {
    stackTrace?: string;
    tags?: Record<string, string>;
  };
}

interface ErrorsData {
  errors?: ErrorItem[];
  total?: number;
  health?: {
    status: 'healthy' | 'degraded' | 'critical';
    message: string;
  };
}

type SeverityFilter = 'all' | 'error' | 'warning' | 'fatal' | 'info';
type TimeRange = '1h' | '24h' | '7d' | '30d';

export default function ErrorsPage() {
  const [data, setData] = useState<ErrorsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Filters
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'count' | 'recent' | 'oldest'>('count');

  // UI State
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  const copyToClipboard = (errorData: ErrorItem) => {
    const errorText = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔴 SENTRY ERROR REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TÍTULO: ${errorData.title}
CULPRIT: ${errorData.culprit}
NÍVEL: ${errorData.level.toUpperCase()}
OCORRÊNCIAS: ${errorData.count}
USUÁRIOS AFETADOS: ${errorData.userCount}

DATAS:
• Última ocorrência: ${new Date(errorData.lastSeen).toLocaleString('pt-BR')}
• Primeira ocorrência: ${new Date(errorData.firstSeen).toLocaleString('pt-BR')}

ID SENTRY: ${errorData.shortId || errorData.id}
STATUS: ${errorData.status}

${errorData.errorDetails?.stackTrace ? `STACK TRACE:
${errorData.errorDetails.stackTrace}` : ''}

${errorData.errorDetails?.tags ? `TAGS:
${Object.entries(errorData.errorDetails.tags)
  .map(([key, value]) => `• ${key}: ${value}`)
  .join('\n')}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Enviado de: JustoAI Admin Dashboard
    `.trim();

    navigator.clipboard.writeText(errorText).then(() => {
      setCopiedId(errorData.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  // Filter and sort errors
  const filteredErrors = (data?.errors || [])
    .filter((err) => {
      if (severityFilter !== 'all' && err.level !== severityFilter) {
        return false;
      }
      if (searchTerm && !err.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !err.culprit.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'count') return b.count - a.count;
      if (sortBy === 'recent') return new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime();
      return new Date(a.firstSeen).getTime() - new Date(b.firstSeen).getTime();
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Activity className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-gray-600">Carregando erros...</p>
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">⚠️ Rastreamento de Erros</h1>
          <p className="text-gray-600 mt-1">
            Total: {data?.errors?.length || 0} erros | Atualizado às {lastUpdate.toLocaleTimeString('pt-BR')}
          </p>
        </div>
        <a
          href="https://sentry.io/organizations/justoai/issues/"
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
        >
          Abrir no Sentry <ExternalLink className="w-4 h-4" />
        </a>
      </div>

      {/* Health Status */}
      {data?.health && (
        <div className={`border rounded-lg p-4 ${
          data.health.status === 'healthy' ? 'bg-green-50 border-green-200' :
          data.health.status === 'degraded' ? 'bg-yellow-50 border-yellow-200' :
          'bg-red-50 border-red-200'
        }`}>
          <p className={`font-semibold capitalize ${
            data.health.status === 'healthy' ? 'text-green-800' :
            data.health.status === 'degraded' ? 'text-yellow-800' :
            'text-red-800'
          }`}>
            {data.health.status}
          </p>
          <p className={`text-sm mt-1 ${
            data.health.status === 'healthy' ? 'text-green-700' :
            data.health.status === 'degraded' ? 'text-yellow-700' :
            'text-red-700'
          }`}>
            {data.health.message}
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <p className="font-semibold text-gray-900">Filtros</p>
        </div>

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
              <option value="error">Erro</option>
              <option value="warning">Aviso</option>
              <option value="fatal">Fatal</option>
              <option value="info">Info</option>
            </select>
          </div>

          {/* Time Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Período</label>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as TimeRange)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="1h">Última hora</option>
              <option value="24h">Últimas 24h</option>
              <option value="7d">Últimos 7 dias</option>
              <option value="30d">Últimos 30 dias</option>
            </select>
          </div>

          {/* Sort */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Ordenar por</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'count' | 'recent' | 'oldest')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="count">Mais ocorrências</option>
              <option value="recent">Mais recente</option>
              <option value="oldest">Mais antigo</option>
            </select>
          </div>

          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Buscar</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Título ou culprit..."
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

      {/* Errors List */}
      <div className="space-y-3">
        {filteredErrors.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
            <p className="text-gray-600">Nenhum erro encontrado com os filtros selecionados</p>
          </div>
        ) : (
          filteredErrors.map((err) => (
            <div
              key={err.id}
              className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition"
            >
              {/* Error Row */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-4">
                  {/* Error Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        err.level === 'error' ? 'bg-red-100 text-red-800' :
                        err.level === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                        err.level === 'fatal' ? 'bg-red-200 text-red-900' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {err.level.toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                        {err.status || 'unresolved'}
                      </span>
                    </div>

                    <h3 className="text-base font-semibold text-gray-900 mb-1 truncate">
                      {err.title}
                    </h3>

                    <p className="text-xs text-gray-600 mb-2 truncate">
                      {err.culprit}
                    </p>

                    <div className="flex flex-wrap gap-3 text-xs text-gray-600">
                      <span>📊 {err.count} ocorrências</span>
                      <span>👥 {err.userCount} usuários</span>
                      <span>🕐 {new Date(err.lastSeen).toLocaleString('pt-BR')}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => copyToClipboard(err)}
                      className={`p-2 rounded transition ${
                        copiedId === err.id
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                      title="Copiar para Claude Code"
                    >
                      <Copy className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => setExpandedId(expandedId === err.id ? null : err.id)}
                      className="px-3 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium transition"
                    >
                      {expandedId === err.id ? '−' : '+'}
                    </button>

                    <a
                      href={`https://sentry.io/organizations/justoai/issues/${err.shortId || err.id}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded hover:bg-gray-100 transition text-gray-700"
                      title="Abrir no Sentry"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedId === err.id && (
                  <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-gray-600 mb-1">PRIMEIRA OCORRÊNCIA:</p>
                      <p className="text-xs text-gray-600">{new Date(err.firstSeen).toLocaleString('pt-BR')}</p>
                    </div>

                    {err.errorDetails?.stackTrace && (
                      <div>
                        <p className="text-xs font-semibold text-gray-600 mb-1">STACK TRACE:</p>
                        <pre className="bg-gray-900 text-gray-100 p-2 rounded text-xs overflow-x-auto max-h-48">
                          {err.errorDetails.stackTrace}
                        </pre>
                      </div>
                    )}

                    {err.errorDetails?.tags && Object.keys(err.errorDetails.tags).length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-600 mb-1">TAGS:</p>
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(err.errorDetails.tags).map(([key, value]) => (
                            <div key={key} className="bg-gray-50 p-2 rounded border border-gray-200">
                              <p className="text-xs font-medium text-gray-600">{key}:</p>
                              <p className="text-xs text-gray-900 break-words">{String(value)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Tips */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900 mb-3 font-semibold">💡 Como usar</p>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Clique no botão 📋 para copiar o erro completo com contexto</li>
          <li>• Use o botão &quot;+&quot; para expandir detalhes do erro (stack trace, tags)</li>
          <li>• Clique no ícone de link externo para abrir o erro diretamente no Sentry</li>
          <li>• Use os filtros para encontrar erros específicos ou por período</li>
        </ul>
      </div>
    </div>
  );
}
