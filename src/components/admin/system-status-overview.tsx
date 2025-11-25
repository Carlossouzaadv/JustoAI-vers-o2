'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Play,
  Square,
  BarChart3,
  AlertCircle,
  Shield,
  RotateCcw,
  Trash2,
  Zap,
  Gauge,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

interface Alert {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
}

interface SystemStatusOverviewProps {
  overall: 'healthy' | 'degraded' | 'critical' | 'offline';
  timestamp: string;
  queueStats: QueueStats;
  activeAlerts: Alert[];
  recommendations: string[];
  loading: boolean;
  autoRefresh: boolean;
  executing: string | null;
  onRefresh: () => void;
  onToggleAutoRefresh: () => void;
  onQuickAction: (action: string) => void;
}

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

export function SystemStatusOverview({
  overall,
  timestamp,
  queueStats,
  activeAlerts,
  recommendations,
  loading,
  autoRefresh,
  executing,
  onRefresh,
  onToggleAutoRefresh,
  onQuickAction,
}: SystemStatusOverviewProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Activity className="w-8 h-8" />
            Dashboard de Monitoramento
          </h1>
          <p className="text-gray-600 mt-1">
            Status geral: {renderStatusBadge(overall)}
            <span className="ml-2 text-sm">
              Última atualização: {format(new Date(timestamp), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}
            </span>
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          <Button
            variant={autoRefresh ? 'default' : 'outline'}
            onClick={onToggleAutoRefresh}
          >
            {autoRefresh ? <Square className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
            Auto-refresh
          </Button>
        </div>
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <Alert className={overall === 'critical' ? 'border-red-500 bg-red-50' : ''}>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              {recommendations.map((rec, index) => (
                <div key={index}>{rec}</div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Overall Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="w-5 h-5" />
              Status Geral
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-2">
              {renderStatusBadge(overall)}
              <p className="text-sm text-gray-600">
                Sistema {overall === 'healthy' ? 'funcionando normalmente' : 'com problemas'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Queue Stats */}
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
                <span className="font-medium">{queueStats.queue.waiting}</span>
              </div>
              <div className="flex justify-between">
                <span>Ativo:</span>
                <span className="font-medium">{queueStats.queue.active}</span>
              </div>
              <div className="flex justify-between">
                <span>Completado:</span>
                <span className="font-medium text-green-600">{queueStats.queue.completed}</span>
              </div>
              <div className="flex justify-between">
                <span>Falhado:</span>
                <span className="font-medium text-red-600">{queueStats.queue.failed}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Alerts */}
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
                {activeAlerts.length}
              </div>
              <p className="text-sm text-gray-600">
                {activeAlerts.length === 0 ? 'Nenhum alerta' : 'alertas requerem atenção'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Ações Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button
              variant="outline"
              onClick={() => onQuickAction('health_check')}
              disabled={executing === 'health_check'}
            >
              <Shield className="w-4 h-4 mr-2" />
              Health Check
            </Button>

            <Button
              variant="outline"
              onClick={() => onQuickAction('restart_worker')}
              disabled={executing === 'restart_worker'}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Restart Worker
            </Button>

            <Button
              variant="outline"
              onClick={() => onQuickAction('clear_queue')}
              disabled={executing === 'clear_queue'}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Limpar Fila
            </Button>

            <Button
              variant="outline"
              onClick={() => onQuickAction('circuit_breaker')}
              disabled={executing === 'circuit_breaker'}
            >
              <Zap className="w-4 h-4 mr-2" />
              Reset CB
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
