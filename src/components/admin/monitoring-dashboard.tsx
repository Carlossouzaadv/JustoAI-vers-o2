'use client';

// ================================================================
// DASHBOARD ADMINISTRATIVO - Monitoramento e Recovery
// ================================================================

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Zap,
  Database,
  Server,
  Webhook,
  BarChart3,
  AlertCircle,
  Play,
  Square,
  RotateCcw,
  Trash2,
  Shield,
  Gauge
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ================================================================
// TIPOS E INTERFACES
// ================================================================

interface ComponentStatus {
  status: 'healthy' | 'degraded' | 'critical' | 'offline';
  lastCheck: string;
  responseTime?: number;
  details: string;
  metrics?: Record<string, unknown>;
}

interface QueueStats {
  queue: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  };
}

interface JuditStats {
  totalCalls: number;
  successfulCalls: number;
  rateLimitHits: number;
  circuitBreakerState: 'open' | 'closed' | 'half-open';
  averageResponseTime: number;
}

interface TelemetryMetrics {
  daily: {
    totalApiCalls: number;
    totalWebhooks: number;
    totalCost: number;
    processesMonitored: number;
    trackingsActive: number;
  };
}

interface Alert {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
}

interface SystemStatus {
  timestamp: string;
  overall: 'healthy' | 'degraded' | 'critical' | 'offline';
  components: {
    juditApi: ComponentStatus;
    monitoringWorker: ComponentStatus;
    database: ComponentStatus;
    redis: ComponentStatus;
    webhooks: ComponentStatus;
  };
  metrics: {
    queueStats: QueueStats;
    juditStats: JuditStats;
    telemetryMetrics: TelemetryMetrics;
    activeAlerts: Alert[];
  };
  recommendations: string[];
}

interface RecoveryAction {
  id: string;
  type: string;
  description: string;
  risk: 'low' | 'medium' | 'high';
  estimatedDuration: string;
  requiredParameters?: string[];
}

// ================================================================
// TYPE GUARDS
// ================================================================

function isComponentStatus(data: unknown): data is ComponentStatus {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.status === 'string' &&
    ['healthy', 'degraded', 'critical', 'offline'].includes(obj.status as string) &&
    typeof obj.lastCheck === 'string' &&
    typeof obj.details === 'string'
  );
}

function isQueueStats(data: unknown): data is QueueStats {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  const queue = obj.queue;
  if (typeof queue !== 'object' || queue === null) return false;
  const q = queue as Record<string, unknown>;
  return (
    typeof q.waiting === 'number' &&
    typeof q.active === 'number' &&
    typeof q.completed === 'number' &&
    typeof q.failed === 'number'
  );
}

function isJuditStats(data: unknown): data is JuditStats {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.totalCalls === 'number' &&
    typeof obj.successfulCalls === 'number' &&
    typeof obj.rateLimitHits === 'number' &&
    typeof obj.circuitBreakerState === 'string' &&
    ['open', 'closed', 'half-open'].includes(obj.circuitBreakerState as string) &&
    typeof obj.averageResponseTime === 'number'
  );
}

function isTelemetryMetrics(data: unknown): data is TelemetryMetrics {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  const daily = obj.daily;
  if (typeof daily !== 'object' || daily === null) return false;
  const d = daily as Record<string, unknown>;
  return (
    typeof d.totalApiCalls === 'number' &&
    typeof d.totalWebhooks === 'number' &&
    typeof d.totalCost === 'number' &&
    typeof d.processesMonitored === 'number' &&
    typeof d.trackingsActive === 'number'
  );
}

function isAlert(data: unknown): data is Alert {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.type === 'string' &&
    typeof obj.severity === 'string' &&
    ['low', 'medium', 'high', 'critical'].includes(obj.severity as string) &&
    typeof obj.message === 'string'
  );
}

function isSystemStatus(data: unknown): data is SystemStatus {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  const components = obj.components;
  if (typeof components !== 'object' || components === null) return false;
  const c = components as Record<string, unknown>;

  return (
    typeof obj.timestamp === 'string' &&
    typeof obj.overall === 'string' &&
    ['healthy', 'degraded', 'critical', 'offline'].includes(obj.overall as string) &&
    isComponentStatus(c.juditApi) &&
    isComponentStatus(c.monitoringWorker) &&
    isComponentStatus(c.database) &&
    isComponentStatus(c.redis) &&
    isComponentStatus(c.webhooks) &&
    typeof obj.metrics === 'object' &&
    obj.metrics !== null &&
    isQueueStats((obj.metrics as Record<string, unknown>).queueStats) &&
    isJuditStats((obj.metrics as Record<string, unknown>).juditStats) &&
    isTelemetryMetrics((obj.metrics as Record<string, unknown>).telemetryMetrics) &&
    Array.isArray((obj.metrics as Record<string, unknown>).activeAlerts) &&
    ((obj.metrics as Record<string, unknown>).activeAlerts as unknown[]).every(isAlert) &&
    Array.isArray(obj.recommendations) &&
    (obj.recommendations as unknown[]).every(r => typeof r === 'string')
  );
}

export default function MonitoringDashboard() {
  // Estados
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [recoveryActions, setRecoveryActions] = useState<RecoveryAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [actionParameters, setActionParameters] = useState<Record<string, string>>({});

  // Carregar dados iniciais
  useEffect(() => {
    loadSystemStatus();
    loadRecoveryActions();
  }, []);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      if (!executing) {
        loadSystemStatus();
      }
    }, 30000); // 30 segundos

    return () => clearInterval(interval);
  }, [autoRefresh, executing]);

  // Carregar status do sistema
  const loadSystemStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/monitoring');
      const data = await response.json();

      if (data.status === 'success' && isSystemStatus(data.data)) {
        setSystemStatus(data.data);
      } else {
        console.error('Status inválido recebido:', data.data);
      }
    } catch (error) {
      console.error('Erro ao carregar status:', error);
    } finally {
      setLoading(false);
    }
  };

  // Carregar ações de recovery
  const loadRecoveryActions = async () => {
    try {
      const response = await fetch('/api/admin/monitoring', { method: 'PUT' });
      const data = await response.json();

      if (data.status === 'success') {
        setRecoveryActions(data.availableActions);
      }
    } catch (error) {
      console.error('Erro ao carregar ações:', error);
    }
  };

  // Executar ação administrativa
  const executeAction = async (action: string, parameters: Record<string, unknown> = {}) => {
    try {
      setExecuting(action);

      const response = await fetch('/api/admin/monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, parameters })
      });

      const data = await response.json();

      if (data.status === 'success') {
        console.log('Ação executada com sucesso:', data.result);
        // Recarregar status após ação
        await loadSystemStatus();
      } else {
        console.error('Erro na ação:', data.error);
      }
    } catch (error) {
      console.error('Erro ao executar ação:', error);
    } finally {
      setExecuting(null);
    }
  };

  // Renderizar status badge
  const renderStatusBadge = (status: ComponentStatus['status']) => {
    const statusConfig = {
      healthy: { variant: 'default' as const, icon: CheckCircle, text: 'Saudável' },
      degraded: { variant: 'secondary' as const, icon: AlertTriangle, text: 'Degradado' },
      critical: { variant: 'destructive' as const, icon: XCircle, text: 'Crítico' },
      offline: { variant: 'outline' as const, icon: XCircle, text: 'Offline' }
    };

    const config = statusConfig[status];
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {config.text}
      </Badge>
    );
  };

  // Renderizar card de componente
  const renderComponentCard = (name: string, component: ComponentStatus, icon: React.ElementType) => {
    const Icon = icon;

    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Icon className="w-5 h-5" />
              {name}
            </CardTitle>
            {renderStatusBadge(component.status)}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-600">{component.details}</p>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-gray-500">Última verificação:</span>
              <p className="font-medium">
                {format(new Date(component.lastCheck), 'HH:mm:ss', { locale: ptBR })}
              </p>
            </div>
            {component.responseTime && (
              <div>
                <span className="text-gray-500">Tempo resposta:</span>
                <p className="font-medium">{component.responseTime}ms</p>
              </div>
            )}
          </div>

          {component.metrics && Object.keys(component.metrics).length > 0 && (
            <div className="space-y-1">
              <span className="text-xs text-gray-500">Métricas:</span>
              <div className="bg-gray-50 p-2 rounded text-xs">
                {Object.entries(component.metrics).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="capitalize">{key.replace(/([A-Z])/g, ' $1')}:</span>
                    <span className="font-medium">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2">Carregando dashboard...</span>
      </div>
    );
  }

  if (!systemStatus) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Não foi possível carregar o status do sistema.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Cabeçalho */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Activity className="w-8 h-8" />
            Dashboard de Monitoramento
          </h1>
          <p className="text-gray-600 mt-1">
            Status geral: {renderStatusBadge(systemStatus.overall)}
            <span className="ml-2 text-sm">
              Última atualização: {format(new Date(systemStatus.timestamp), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}
            </span>
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={loadSystemStatus}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          <Button
            variant={autoRefresh ? 'default' : 'outline'}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? <Square className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
            Auto-refresh
          </Button>
        </div>
      </div>

      {/* Alertas e Recomendações */}
      {systemStatus.recommendations.length > 0 && (
        <Alert className={systemStatus.overall === 'critical' ? 'border-red-500 bg-red-50' : ''}>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              {systemStatus.recommendations.map((rec, index) => (
                <div key={index}>{rec}</div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs principais */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="components">Componentes</TabsTrigger>
          <TabsTrigger value="metrics">Métricas</TabsTrigger>
          <TabsTrigger value="recovery">Recovery</TabsTrigger>
        </TabsList>

        {/* Visão Geral */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Status geral */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gauge className="w-5 h-5" />
                  Status Geral
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center space-y-2">
                  {renderStatusBadge(systemStatus.overall)}
                  <p className="text-sm text-gray-600">
                    Sistema {systemStatus.overall === 'healthy' ? 'funcionando normalmente' : 'com problemas'}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Queue Stats */}
            {isQueueStats(systemStatus.metrics.queueStats) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Fila de Monitoramento
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Aguardando:</span>
                      <span className="font-medium">{systemStatus.metrics.queueStats.queue.waiting}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Ativo:</span>
                      <span className="font-medium">{systemStatus.metrics.queueStats.queue.active}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Completado:</span>
                      <span className="font-medium text-green-600">{systemStatus.metrics.queueStats.queue.completed}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Falhado:</span>
                      <span className="font-medium text-red-600">{systemStatus.metrics.queueStats.queue.failed}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Alertas ativos */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Alertas Ativos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {systemStatus.metrics.activeAlerts.length}
                  </div>
                  <p className="text-sm text-gray-600">
                    {systemStatus.metrics.activeAlerts.length === 0 ? 'Nenhum alerta' : 'alertas requerem atenção'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Ações rápidas */}
          <Card>
            <CardHeader>
              <CardTitle>Ações Rápidas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Button
                  variant="outline"
                  onClick={() => executeAction('health_check')}
                  disabled={executing === 'health_check'}
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Health Check
                </Button>

                <Button
                  variant="outline"
                  onClick={() => executeAction('restart_worker')}
                  disabled={executing === 'restart_worker'}
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Restart Worker
                </Button>

                <Button
                  variant="outline"
                  onClick={() => executeAction('clear_queue')}
                  disabled={executing === 'clear_queue'}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Limpar Fila
                </Button>

                <Button
                  variant="outline"
                  onClick={() => executeAction('circuit_breaker', { operation: 'reset' })}
                  disabled={executing === 'circuit_breaker'}
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Reset CB
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Componentes */}
        <TabsContent value="components" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {renderComponentCard('API Judit', systemStatus.components.juditApi, Zap)}
            {renderComponentCard('Worker Monitor', systemStatus.components.monitoringWorker, Server)}
            {renderComponentCard('Banco de Dados', systemStatus.components.database, Database)}
            {renderComponentCard('Redis', systemStatus.components.redis, Activity)}
            {renderComponentCard('Webhooks', systemStatus.components.webhooks, Webhook)}
          </div>
        </TabsContent>

        {/* Métricas */}
        <TabsContent value="metrics" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Métricas da API Judit */}
            {isJuditStats(systemStatus.metrics.juditStats) && (
              <Card>
                <CardHeader>
                  <CardTitle>Métricas API Judit</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>Total de Chamadas:</span>
                      <span className="font-medium">{systemStatus.metrics.juditStats.totalCalls}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Taxa de Sucesso:</span>
                      <span className="font-medium">
                        {systemStatus.metrics.juditStats.totalCalls > 0
                          ? ((systemStatus.metrics.juditStats.successfulCalls / systemStatus.metrics.juditStats.totalCalls) * 100).toFixed(1)
                          : 100}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Rate Limits:</span>
                      <span className="font-medium">{systemStatus.metrics.juditStats.rateLimitHits}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Circuit Breaker:</span>
                      <Badge variant={systemStatus.metrics.juditStats.circuitBreakerState === 'closed' ? 'default' : 'destructive'}>
                        {systemStatus.metrics.juditStats.circuitBreakerState}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Tempo Médio:</span>
                      <span className="font-medium">{Math.round(systemStatus.metrics.juditStats.averageResponseTime)}ms</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Métricas de Telemetria */}
            {isTelemetryMetrics(systemStatus.metrics.telemetryMetrics) && (
              <Card>
                <CardHeader>
                  <CardTitle>Métricas Diárias</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>Chamadas API:</span>
                      <span className="font-medium">{systemStatus.metrics.telemetryMetrics.daily.totalApiCalls}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Webhooks:</span>
                      <span className="font-medium">{systemStatus.metrics.telemetryMetrics.daily.totalWebhooks}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Custo Total:</span>
                      <span className="font-medium">R$ {systemStatus.metrics.telemetryMetrics.daily.totalCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Processos Monitorados:</span>
                      <span className="font-medium">{systemStatus.metrics.telemetryMetrics.daily.processesMonitored}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Trackings Ativos:</span>
                      <span className="font-medium">{systemStatus.metrics.telemetryMetrics.daily.trackingsActive}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Recovery */}
        <TabsContent value="recovery" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Ações de Recovery */}
            <Card>
              <CardHeader>
                <CardTitle>Ações de Recovery</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Selecionar Ação</Label>
                  <Select value={selectedAction} onValueChange={setSelectedAction}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha uma ação" />
                    </SelectTrigger>
                    <SelectContent>
                      {recoveryActions.map((action) => (
                        <SelectItem key={action.id} value={action.id}>
                          {action.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedAction && (
                  <div className="space-y-3">
                    {/* Detalhes da ação */}
                    {(() => {
                      const action = recoveryActions.find(a => a.id === selectedAction);
                      if (!action) return null;

                      return (
                        <div className="p-3 bg-gray-50 rounded">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge variant={action.risk === 'high' ? 'destructive' : action.risk === 'medium' ? 'secondary' : 'default'}>
                                Risco: {action.risk}
                              </Badge>
                              <span className="text-sm text-gray-600">
                                Duração: {action.estimatedDuration}
                              </span>
                            </div>
                            <p className="text-sm">{action.description}</p>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Parâmetros necessários */}
                    {(() => {
                      const action = recoveryActions.find(a => a.id === selectedAction);
                      if (!action?.requiredParameters) return null;

                      return (
                        <div className="space-y-2">
                          {action.requiredParameters.map((param) => (
                            <div key={param}>
                              <Label>{param}</Label>
                              <Input
                                value={actionParameters[param] || ''}
                                onChange={(e) => setActionParameters(prev => ({
                                  ...prev,
                                  [param]: e.target.value
                                }))}
                                placeholder={`Digite ${param}`}
                              />
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    <Button
                      onClick={() => executeAction(selectedAction, actionParameters)}
                      disabled={executing === selectedAction}
                      className="w-full"
                    >
                      {executing === selectedAction && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                      Executar Ação
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Logs e Alertas */}
            <Card>
              <CardHeader>
                <CardTitle>Alertas Ativos</CardTitle>
              </CardHeader>
              <CardContent>
                {systemStatus.metrics.activeAlerts.length === 0 ? (
                  <p className="text-gray-500">Nenhum alerta ativo</p>
                ) : (
                  <div className="space-y-2">
                    {systemStatus.metrics.activeAlerts.slice(0, 5).map((alert, index) => {
                      if (!isAlert(alert)) return null;
                      return (
                        <div key={index} className="p-2 bg-orange-50 border border-orange-200 rounded">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-orange-600" />
                            <span className="text-sm font-medium">{alert.type}</span>
                            <Badge variant="secondary">{alert.severity}</Badge>
                          </div>
                          <p className="text-xs text-gray-600 mt-1">{alert.message}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}