'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';

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

interface RecoveryAction {
  id: string;
  type: string;
  description: string;
  risk: 'low' | 'medium' | 'high';
  estimatedDuration: string;
  requiredParameters?: string[];
}

interface MetricsAndRecoveryProps {
  juditStats: JuditStats;
  telemetryMetrics: TelemetryMetrics;
  activeAlerts: Alert[];
  recoveryActions: RecoveryAction[];
  executing: string | null;
  onExecuteAction: (actionId: string, parameters: Record<string, unknown>) => void;
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

export function MetricsAndRecovery({
  juditStats,
  telemetryMetrics,
  activeAlerts,
  recoveryActions,
  executing,
  onExecuteAction,
}: MetricsAndRecoveryProps) {
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [actionParameters, setActionParameters] = useState<Record<string, string>>({});

  const handleExecuteAction = (actionId: string) => {
    onExecuteAction(actionId, actionParameters);
    setActionParameters({});
  };

  return (
    <div className="space-y-6">
      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Judit API Metrics */}
        {isJuditStats(juditStats) && (
          <Card>
            <CardHeader>
              <CardTitle>Métricas API Judit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Total de Chamadas:</span>
                  <span className="font-medium">{juditStats.totalCalls}</span>
                </div>
                <div className="flex justify-between">
                  <span>Taxa de Sucesso:</span>
                  <span className="font-medium">
                    {juditStats.totalCalls > 0
                      ? ((juditStats.successfulCalls / juditStats.totalCalls) * 100).toFixed(1)
                      : 100}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Rate Limits:</span>
                  <span className="font-medium">{juditStats.rateLimitHits}</span>
                </div>
                <div className="flex justify-between">
                  <span>Circuit Breaker:</span>
                  <Badge variant={juditStats.circuitBreakerState === 'closed' ? 'default' : 'destructive'}>
                    {juditStats.circuitBreakerState}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Tempo Médio:</span>
                  <span className="font-medium">{Math.round(juditStats.averageResponseTime)}ms</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Telemetry Metrics */}
        {isTelemetryMetrics(telemetryMetrics) && (
          <Card>
            <CardHeader>
              <CardTitle>Métricas Diárias</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Chamadas API:</span>
                  <span className="font-medium">{telemetryMetrics.daily.totalApiCalls}</span>
                </div>
                <div className="flex justify-between">
                  <span>Webhooks:</span>
                  <span className="font-medium">{telemetryMetrics.daily.totalWebhooks}</span>
                </div>
                <div className="flex justify-between">
                  <span>Custo Total:</span>
                  <span className="font-medium">R$ {telemetryMetrics.daily.totalCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Processos Monitorados:</span>
                  <span className="font-medium">{telemetryMetrics.daily.processesMonitored}</span>
                </div>
                <div className="flex justify-between">
                  <span>Trackings Ativos:</span>
                  <span className="font-medium">{telemetryMetrics.daily.trackingsActive}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recovery and Alerts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recovery Actions */}
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
                  onClick={() => handleExecuteAction(selectedAction)}
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

        {/* Active Alerts */}
        <Card>
          <CardHeader>
            <CardTitle>Alertas Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            {activeAlerts.length === 0 ? (
              <p className="text-gray-500">Nenhum alerta ativo</p>
            ) : (
              <div className="space-y-2">
                {activeAlerts.slice(0, 5).map((alert, index) => {
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
    </div>
  );
}
