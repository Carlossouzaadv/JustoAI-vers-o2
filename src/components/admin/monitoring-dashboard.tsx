'use client';

import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { SystemStatusOverview } from './system-status-overview';
import { ComponentStatusGrid } from './component-status-grid';
import { MetricsAndRecovery } from './metrics-and-recovery';

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
    } catch (_error) {
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
    } catch (_error) {
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
    } catch (_error) {
      console.error('Erro ao executar ação:', error);
    } finally {
      setExecuting(null);
    }
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

  const handleQuickAction = (action: string) => {
    const parameters = action === 'circuit_breaker' ? { operation: 'reset' } : {};
    executeAction(action, parameters);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="components">Componentes</TabsTrigger>
          <TabsTrigger value="metrics">Métricas</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <SystemStatusOverview
            overall={systemStatus.overall}
            timestamp={systemStatus.timestamp}
            queueStats={systemStatus.metrics.queueStats}
            activeAlerts={systemStatus.metrics.activeAlerts}
            recommendations={systemStatus.recommendations}
            loading={loading}
            autoRefresh={autoRefresh}
            executing={executing}
            onRefresh={loadSystemStatus}
            onToggleAutoRefresh={() => setAutoRefresh(!autoRefresh)}
            onQuickAction={handleQuickAction}
          />
        </TabsContent>

        {/* Components Tab */}
        <TabsContent value="components">
          <ComponentStatusGrid
            juditApi={systemStatus.components.juditApi}
            monitoringWorker={systemStatus.components.monitoringWorker}
            database={systemStatus.components.database}
            redis={systemStatus.components.redis}
            webhooks={systemStatus.components.webhooks}
          />
        </TabsContent>

        {/* Metrics Tab */}
        <TabsContent value="metrics">
          <MetricsAndRecovery
            juditStats={systemStatus.metrics.juditStats}
            telemetryMetrics={systemStatus.metrics.telemetryMetrics}
            activeAlerts={systemStatus.metrics.activeAlerts}
            recoveryActions={recoveryActions}
            executing={executing}
            onExecuteAction={executeAction}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}