'use client';

import { useEffect, useState } from 'react';
import { Activity, AlertCircle, Download, Filter, X, ChevronDown } from 'lucide-react';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  service: string;
  message: string;
  metadata?: Record<string, unknown>;
  stackTrace?: string;
}

type LogLevel = 'all' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Filters
  const [levelFilter, setLevelFilter] = useState<LogLevel>('all');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // UI State
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Mock logs - will be replaced by real API data from OPÇÃO C
  const mockLogs: LogEntry[] = [
    {
      id: '1',
      timestamp: new Date(Date.now() - 5000).toISOString(),
      level: 'INFO',
      service: 'api/documents',
      message: 'Document analysis started',
      metadata: { documentId: 'doc-123', userId: 'user-456' }
    },
    {
      id: '2',
      timestamp: new Date(Date.now() - 15000).toISOString(),
      level: 'WARN',
      service: 'api/process',
      message: 'High latency detected',
      metadata: { duration: 2500, threshold: 2000 }
    },
    {
      id: '3',
      timestamp: new Date(Date.now() - 25000).toISOString(),
      level: 'ERROR',
      service: 'api/judit',
      message: 'JUDIT API timeout',
      metadata: { endpoint: '/search', timeout: 5000 },
      stackTrace: 'Error: Request timeout at JUDIT.search()'
    },
    {
      id: '4',
      timestamp: new Date(Date.now() - 35000).toISOString(),
      level: 'INFO',
      service: 'cron/aggregation',
      message: 'Daily aggregation completed',
      metadata: { workspacesProcessed: 15, alertsCreated: 3 }
    },
    {
      id: '5',
      timestamp: new Date(Date.now() - 45000).toISOString(),
      level: 'DEBUG',
      service: 'auth',
      message: 'User authenticated',
      metadata: { userId: 'user-789', provider: 'supabase' }
    }
  ];

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        // TODO: Replace with real API endpoint when OPÇÃO C is done
        // const response = await fetch('/api/admin/logs');
        // if (!response.ok) throw new Error(`HTTP ${response.status}`);
        // const result = await response.json();
        // setLogs(result.logs || mockLogs);

        // For now, use mock data
        setLogs(mockLogs);
        setLastUpdate(new Date());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch logs');
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();

    // Auto-refresh every 5 seconds if enabled
    if (autoRefresh) {
      const interval = setInterval(fetchLogs, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const downloadLogs = () => {
    const logsJson = JSON.stringify(filteredLogs, null, 2);
    const blob = new Blob([logsJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Filter logs
  const filteredLogs = logs
    .filter((log) => {
      if (levelFilter !== 'all' && log.level !== levelFilter) return false;
      if (serviceFilter !== 'all' && log.service !== serviceFilter) return false;
      if (searchTerm && !log.message.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      return true;
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const uniqueServices = Array.from(new Set(logs.map((log) => log.service)));

  const getLevelColor = (level: LogLevel) => {
    switch (level) {
      case 'DEBUG':
        return { bg: 'bg-gray-100', text: 'text-gray-800', label: 'bg-gray-200' };
      case 'INFO':
        return { bg: 'bg-blue-100', text: 'text-blue-800', label: 'bg-blue-200' };
      case 'WARN':
        return { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'bg-yellow-200' };
      case 'ERROR':
        return { bg: 'bg-red-100', text: 'text-red-800', label: 'bg-red-200' };
      default:
        return { bg: 'bg-gray-100', text: 'text-gray-800', label: 'bg-gray-200' };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Activity className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-gray-600">Carregando logs...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-red-800">Erro ao carregar logs: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">📝 Logs do Sistema</h1>
          <p className="text-gray-600 mt-1">
            Total: {filteredLogs.length} logs | Atualizado às {lastUpdate.toLocaleTimeString('pt-BR')}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-4 py-2 rounded-lg transition ${
              autoRefresh
                ? 'bg-green-100 text-green-800 border border-green-300'
                : 'bg-gray-100 text-gray-800 border border-gray-300'
            }`}
          >
            {autoRefresh ? '● Live' : '⏸ Pausado'}
          </button>
          <button
            onClick={downloadLogs}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
          >
            <Download className="w-4 h-4" /> Download
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <p className="font-semibold text-gray-900">Filtros</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Level Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nível</label>
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value as LogLevel)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos</option>
              <option value="DEBUG">Debug</option>
              <option value="INFO">Info</option>
              <option value="WARN">Aviso</option>
              <option value="ERROR">Erro</option>
            </select>
          </div>

          {/* Service Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Serviço</label>
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos</option>
              {uniqueServices.map((service) => (
                <option key={service} value={service}>
                  {service}
                </option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Buscar</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Mensagem..."
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

          {/* Stats */}
          <div className="flex items-end">
            <div className="text-sm text-gray-600">
              <p className="font-medium">Exibindo {filteredLogs.length} de {logs.length} logs</p>
            </div>
          </div>
        </div>
      </div>

      {/* Logs List */}
      <div className="space-y-2">
        {filteredLogs.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
            <p className="text-gray-600">Nenhum log encontrado com os filtros selecionados</p>
          </div>
        ) : (
          filteredLogs.map((log) => {
            const colors = getLevelColor(log.level);
            return (
              <div
                key={log.id}
                className={`border rounded-lg overflow-hidden hover:shadow-md transition ${colors.bg}`}
              >
                {/* Log Row */}
                <div className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    {/* Log Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${colors.label}`}>
                          {log.level}
                        </span>
                        <span className="text-xs text-gray-600 bg-gray-200 px-2 py-1 rounded">
                          {log.service}
                        </span>
                        <span className="text-xs text-gray-600">
                          {new Date(log.timestamp).toLocaleTimeString('pt-BR')}
                        </span>
                      </div>

                      <p className={`text-sm font-medium ${colors.text} break-words`}>
                        {log.message}
                      </p>

                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <div className="mt-2 text-xs text-gray-700">
                          {Object.entries(log.metadata).map(([key, value]) => (
                            <span key={key} className="inline-block mr-3">
                              <span className="font-mono bg-gray-300 px-1 rounded">
                                {key}: {JSON.stringify(value)}
                              </span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Expand Button */}
                    {(log.stackTrace || (log.metadata && Object.keys(log.metadata).length > 0)) && (
                      <button
                        onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                        className="flex-shrink-0 p-2 hover:bg-gray-300 rounded transition"
                      >
                        <ChevronDown
                          className={`w-4 h-4 transition ${
                            expandedId === log.id ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                    )}
                  </div>

                  {/* Expanded Details */}
                  {expandedId === log.id && (
                    <div className="mt-3 pt-3 border-t border-gray-300 space-y-2">
                      {log.stackTrace && (
                        <div>
                          <p className="text-xs font-semibold text-gray-700 mb-1">STACK TRACE:</p>
                          <pre className="bg-gray-900 text-gray-100 p-2 rounded text-xs overflow-x-auto">
                            {log.stackTrace}
                          </pre>
                        </div>
                      )}

                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-700 mb-1">METADADOS:</p>
                          <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto border border-gray-300">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
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
          <li>• Use &quot;Live&quot; para ativar atualização automática a cada 5 segundos</li>
          <li>• Clique na seta &quot; para expandir detalhes do log (metadados, stack traces)</li>
          <li>• Use os filtros para encontrar logs específicos por nível, serviço ou mensagem</li>
          <li>• Download em JSON para análise externa ou backup</li>
          <li>Note: Dados de demonstração. APIs reais serão conectadas em breve.</li>
        </ul>
      </div>
    </div>
  );
}
