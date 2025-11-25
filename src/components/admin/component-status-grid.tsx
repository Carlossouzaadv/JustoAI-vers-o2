'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Zap,
  Server,
  Database,
  Activity,
  Webhook,
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

interface ComponentStatusGridProps {
  juditApi: ComponentStatus;
  monitoringWorker: ComponentStatus;
  database: ComponentStatus;
  redis: ComponentStatus;
  webhooks: ComponentStatus;
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

export function ComponentStatusGrid({
  juditApi,
  monitoringWorker,
  database,
  redis,
  webhooks,
}: ComponentStatusGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {renderComponentCard('API Judit', juditApi, Zap)}
      {renderComponentCard('Worker Monitor', monitoringWorker, Server)}
      {renderComponentCard('Banco de Dados', database, Database)}
      {renderComponentCard('Redis', redis, Activity)}
      {renderComponentCard('Webhooks', webhooks, Webhook)}
    </div>
  );
}
