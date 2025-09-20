'use client';

// ================================================================
// BANNER DE USO MENSAL - Telemetria e Avisos
// ================================================================

import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  AlertTriangle,
  TrendingUp,
  Users,
  FileText,
  CreditCard,
  Activity,
  X,
  ChevronDown,
  ChevronUp,
  Info,
  Zap
} from 'lucide-react';

// ================================================================
// TIPOS E INTERFACES
// ================================================================

interface UsageBannerProps {
  workspaceId: string;
  className?: string;
  onUpgrade?: () => void;
  onBuyCredits?: () => void;
}

interface MonthlyUsage {
  processes: {
    monitored: number;
    limit: number;
    percentage: number;
  };
  reports: {
    used: number;
    limit: number;
    percentage: number;
    status: 'ok' | 'soft_warning' | 'hard_blocked';
  };
  credits: {
    consumed: number;
    included: number;
    purchased: number;
    remaining: number;
  };
  api: {
    juditCalls: number;
    estimatedCost: number;
  };
}

interface AlertBanner {
  type: 'soft_threshold' | 'hard_threshold' | 'credit_low' | 'api_high';
  severity: 'info' | 'warning' | 'error';
  title: string;
  message: string;
  actions?: Array<{
    label: string;
    variant: 'default' | 'outline' | 'secondary';
    onClick: () => void;
  }>;
  dismissible?: boolean;
}

// ================================================================
// COMPONENTE PRINCIPAL
// ================================================================

export default function UsageBanner({
  workspaceId,
  className = '',
  onUpgrade,
  onBuyCredits
}: UsageBannerProps) {
  // Estados
  const [usage, setUsage] = useState<MonthlyUsage | null>(null);
  const [alerts, setAlerts] = useState<AlertBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  // Carregar dados de uso
  useEffect(() => {
    loadUsageData();
  }, [workspaceId]);

  // Carregar dados de uso mensal
  const loadUsageData = async () => {
    try {
      setLoading(true);

      const [usageResponse, alertsResponse] = await Promise.all([
        fetch(`/api/telemetry/monthly-usage?workspaceId=${workspaceId}`),
        fetch(`/api/telemetry/active-alerts?workspaceId=${workspaceId}`)
      ]);

      const [usageData, alertsData] = await Promise.all([
        usageResponse.json(),
        alertsResponse.json()
      ]);

      if (usageData.success) {
        setUsage(usageData.data);
      }

      if (alertsData.success) {
        const bannerAlerts = alertsData.alerts.map(alert => convertToAlertBanner(alert));
        setAlerts(bannerAlerts);
      }

    } catch (error) {
      console.error('Erro ao carregar dados de uso:', error);
    } finally {
      setLoading(false);
    }
  };

  // Converter alerta da API para banner
  const convertToAlertBanner = (alert: any): AlertBanner => {
    const baseAlert: AlertBanner = {
      type: alert.type,
      severity: alert.severity === 'critical' ? 'error' : alert.severity === 'high' ? 'warning' : 'info',
      title: alert.title,
      message: alert.message,
      dismissible: true
    };

    // Adicionar ações baseadas no tipo
    switch (alert.type) {
      case 'soft_threshold':
      case 'hard_threshold':
        baseAlert.actions = [
          {
            label: 'Fazer Upgrade',
            variant: 'default',
            onClick: () => onUpgrade?.()
          },
          {
            label: 'Comprar Créditos',
            variant: 'outline',
            onClick: () => onBuyCredits?.()
          }
        ];
        break;

      case 'credit_low':
        baseAlert.actions = [
          {
            label: 'Comprar Créditos',
            variant: 'default',
            onClick: () => onBuyCredits?.()
          }
        ];
        break;

      case 'api_high':
        baseAlert.actions = [
          {
            label: 'Ver Detalhes',
            variant: 'outline',
            onClick: () => setExpanded(true)
          }
        ];
        break;
    }

    return baseAlert;
  };

  // Dismiss alerta
  const dismissAlert = (alertType: string) => {
    setDismissedAlerts(prev => new Set(prev).add(alertType));
  };

  // Filtrar alertas não dismissados
  const activeAlerts = alerts.filter(alert => !dismissedAlerts.has(alert.type));

  // Determinar se deve mostrar banner
  const shouldShowBanner = activeAlerts.length > 0 || (usage && hasUsageConcerns(usage));

  // Verificar se há preocupações de uso
  const hasUsageConcerns = (usage: MonthlyUsage) => {
    return usage.reports.percentage >= 80 ||
           usage.credits.remaining <= 5 ||
           usage.processes.percentage >= 90;
  };

  // Loading state
  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-16 bg-gray-100 rounded-lg"></div>
      </div>
    );
  }

  if (!shouldShowBanner && !expanded) {
    return null;
  }

  return (
    <div className={className}>
      {/* Alertas ativos */}
      {activeAlerts.map((alert, index) => (
        <Alert
          key={`${alert.type}-${index}`}
          className={`mb-4 ${
            alert.severity === 'error' ? 'border-red-200 bg-red-50' :
            alert.severity === 'warning' ? 'border-orange-200 bg-orange-50' :
            'border-blue-200 bg-blue-50'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <AlertTriangle className={`w-4 h-4 mt-0.5 ${
                alert.severity === 'error' ? 'text-red-600' :
                alert.severity === 'warning' ? 'text-orange-600' :
                'text-blue-600'
              }`} />

              <div className="flex-1">
                <AlertDescription>
                  <div className="space-y-2">
                    <div className={`font-medium ${
                      alert.severity === 'error' ? 'text-red-800' :
                      alert.severity === 'warning' ? 'text-orange-800' :
                      'text-blue-800'
                    }`}>
                      {alert.title}
                    </div>
                    <div className={`text-sm ${
                      alert.severity === 'error' ? 'text-red-700' :
                      alert.severity === 'warning' ? 'text-orange-700' :
                      'text-blue-700'
                    }`}>
                      {alert.message}
                    </div>

                    {alert.actions && (
                      <div className="flex gap-2 mt-3">
                        {alert.actions.map((action, actionIndex) => (
                          <Button
                            key={actionIndex}
                            variant={action.variant}
                            size="sm"
                            onClick={action.onClick}
                          >
                            {action.label}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                </AlertDescription>
              </div>
            </div>

            {alert.dismissible && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => dismissAlert(alert.type)}
                className="p-1"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </Alert>
      ))}

      {/* Seção de uso mensal */}
      {usage && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Uso Mensal
              </h3>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </Button>
            </div>

            {/* Resumo compacto */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Processos */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Users className="w-4 h-4" />
                  <span>Processos</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {usage.processes.monitored} de {usage.processes.limit}
                  </span>
                  {usage.processes.percentage >= 90 && (
                    <Badge variant="secondary" className="text-xs">
                      {usage.processes.percentage.toFixed(0)}%
                    </Badge>
                  )}
                </div>
              </div>

              {/* Relatórios */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <FileText className="w-4 h-4" />
                  <span>Relatórios</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {usage.reports.used} de {usage.reports.limit}
                  </span>
                  {usage.reports.status !== 'ok' && (
                    <Badge
                      variant={usage.reports.status === 'hard_blocked' ? 'destructive' : 'secondary'}
                      className="text-xs"
                    >
                      {usage.reports.percentage.toFixed(0)}%
                    </Badge>
                  )}
                </div>
              </div>

              {/* Créditos */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <CreditCard className="w-4 h-4" />
                  <span>Créditos</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {usage.credits.remaining} restantes
                  </span>
                  {usage.credits.remaining <= 5 && (
                    <Badge variant="secondary" className="text-xs">
                      Baixo
                    </Badge>
                  )}
                </div>
              </div>

              {/* API Judit */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Activity className="w-4 h-4" />
                  <span>Consultas</span>
                </div>
                <div className="font-medium">
                  {usage.api.juditCalls}
                </div>
              </div>
            </div>

            {/* Detalhes expandidos */}
            {expanded && (
              <div className="mt-6 space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Processos detalhado */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Processos Monitorados
                    </h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Monitorados ativamente</span>
                        <span>{usage.processes.monitored}</span>
                      </div>
                      <Progress value={usage.processes.percentage} className="h-2" />
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>{usage.processes.percentage.toFixed(1)}% do limite</span>
                        <span>{usage.processes.limit - usage.processes.monitored} disponíveis</span>
                      </div>
                    </div>
                  </div>

                  {/* Relatórios detalhado */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Relatórios Mensais
                    </h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Gerados este mês</span>
                        <span>{usage.reports.used}</span>
                      </div>
                      <Progress
                        value={Math.min(usage.reports.percentage, 100)}
                        className="h-2"
                      />
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>{usage.reports.percentage.toFixed(1)}% usado</span>
                        <span>{Math.max(0, usage.reports.limit - usage.reports.used)} restantes</span>
                      </div>
                    </div>
                  </div>

                  {/* Créditos detalhado */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <CreditCard className="w-4 h-4" />
                      Créditos de Análise
                    </h4>
                    <div className="space-y-2">
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="text-center">
                          <div className="text-gray-500">Inclusos</div>
                          <div className="font-medium">{usage.credits.included}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-gray-500">Comprados</div>
                          <div className="font-medium">{usage.credits.purchased}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-gray-500">Usados</div>
                          <div className="font-medium">{usage.credits.consumed}</div>
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-blue-600">
                          {usage.credits.remaining} disponíveis
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* API Judit detalhado */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <Zap className="w-4 h-4" />
                      Consultas Externas
                    </h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Chamadas à API Judit</span>
                        <span>{usage.api.juditCalls}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Custo estimado</span>
                        <span>R$ {usage.api.estimatedCost.toFixed(2)}</span>
                      </div>
                      <div className="bg-gray-50 p-2 rounded text-xs text-gray-600">
                        <Info className="w-3 h-3 inline mr-1" />
                        Consultas realizadas automaticamente para monitoramento
                      </div>
                    </div>
                  </div>
                </div>

                {/* Ações rápidas */}
                <div className="flex gap-3 pt-4 border-t">
                  <Button variant="outline" onClick={onUpgrade} size="sm">
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Fazer Upgrade
                  </Button>
                  <Button variant="outline" onClick={onBuyCredits} size="sm">
                    <CreditCard className="w-4 h-4 mr-2" />
                    Comprar Créditos
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ================================================================
// COMPONENTE COMPACTO PARA HEADER
// ================================================================

interface UsageHeaderProps {
  workspaceId: string;
  onShowDetails?: () => void;
}

export function UsageHeader({ workspaceId, onShowDetails }: UsageHeaderProps) {
  const [hasWarnings, setHasWarnings] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkWarnings = async () => {
      try {
        const response = await fetch(`/api/telemetry/active-alerts?workspaceId=${workspaceId}`);
        const data = await response.json();

        if (data.success) {
          setHasWarnings(data.alerts.length > 0);
        }
      } catch (error) {
        console.error('Erro ao verificar alertas:', error);
      } finally {
        setLoading(false);
      }
    };

    checkWarnings();
  }, [workspaceId]);

  if (loading || !hasWarnings) {
    return null;
  }

  return (
    <Alert className="border-orange-200 bg-orange-50">
      <AlertTriangle className="h-4 w-4 text-orange-600" />
      <AlertDescription className="flex items-center justify-between">
        <span className="text-orange-800">
          Você já usou 80% da sua cota de relatórios.
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={onShowDetails}
          className="ml-4"
        >
          Ver Detalhes
        </Button>
      </AlertDescription>
    </Alert>
  );
}