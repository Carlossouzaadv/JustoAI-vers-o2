'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ICONS } from '@/lib/icons';
import { useTelemetry } from '@/hooks/use-telemetry';
import { CostMetricsCard } from '@/components/dashboard/cost-metrics-card';
import { ApiUsageCard } from '@/components/dashboard/api-usage-card';
import { TelemetryAlertsWidget } from '@/components/dashboard/telemetry-alerts-widget';

export default function TelemetryDashboardPage() {
  const { workspaceId, loading: authLoading } = useAuth();
  const { metrics, loading: telemetryLoading } = useTelemetry(workspaceId, 60000);

  if (authLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="h-20 bg-gray-200 rounded"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            {ICONS.ACTIVITY} Telemetria em Tempo Real
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitoramento de custos, uso da API e alertas do sistema
          </p>
        </div>
        <Link href="/dashboard">
          <Button variant="outline">
            {ICONS.ARROW_LEFT} Voltar
          </Button>
        </Link>
      </div>

      {/* Main Metrics Cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {metrics && (
          <>
            <CostMetricsCard
              totalCost={metrics.monthlyUsage.totalCost}
              dailyAverage={metrics.monthlyUsage.dailyAverage}
              trend={metrics.monthlyUsage.trend}
              loading={telemetryLoading}
            />

            <ApiUsageCard
              successRate={metrics.monthlyUsage.successRate}
              avgResponseTime={metrics.monthlyUsage.avgResponseTime}
              totalOperations={metrics.monthlyUsage.operations.reduce((sum, op) => sum + op.count, 0)}
              loading={telemetryLoading}
            />

            <TelemetryAlertsWidget
              alerts={metrics.activeAlerts.alerts}
              totalCount={metrics.activeAlerts.total}
              criticalCount={metrics.activeAlerts.critical}
              highCount={metrics.activeAlerts.high}
              loading={telemetryLoading}
            />
          </>
        )}
      </section>

      {/* Usage Summary */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {ICONS.DOCUMENT} Resumo de Uso Mensal
            </CardTitle>
          </CardHeader>
          <CardContent>
            {metrics ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Documentos Enviados</p>
                  <p className="text-3xl font-bold">
                    {metrics.monthlyUsage.documentsUploaded}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Casos Criados</p>
                  <p className="text-3xl font-bold">
                    {metrics.monthlyUsage.casesCreated}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Créditos Consumidos</p>
                  <p className="text-3xl font-bold">
                    {metrics.monthlyUsage.creditConsumption.toLocaleString()}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Taxa de Sucesso</p>
                  <p className="text-3xl font-bold text-green-600">
                    {metrics.monthlyUsage.successRate.toFixed(1)}%
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">Carregando dados...</p>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Operations Breakdown */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {ICONS.PROCESS} Detalhamento de Operações
            </CardTitle>
          </CardHeader>
          <CardContent>
            {metrics && metrics.monthlyUsage.operations.length > 0 ? (
              <div className="space-y-4">
                {metrics.monthlyUsage.operations.map((op, idx) => (
                  <div key={idx} className="flex items-center justify-between pb-4 border-b last:border-b-0">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      <div>
                        <p className="font-medium">{op.type}</p>
                        <p className="text-sm text-muted-foreground">
                          {op.count} operações
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">R$ {op.cost.toFixed(2)}</p>
                      <p className="text-sm text-muted-foreground">
                        {((op.cost / metrics.monthlyUsage.totalCost) * 100).toFixed(1)}% do total
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                Nenhuma operação registrada ainda
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      {/* System Alerts Details */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {ICONS.WARNING} Alertas do Sistema (Detalhado)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {metrics && metrics.activeAlerts.alerts.length > 0 ? (
              <div className="space-y-3">
                {metrics.activeAlerts.alerts.map((alert) => {
                  const getSeverityColor = (severity: string) => {
                    switch (severity) {
                      case 'CRITICAL':
                        return 'bg-red-50 border-red-300 text-red-900';
                      case 'HIGH':
                        return 'bg-orange-50 border-orange-300 text-orange-900';
                      case 'MEDIUM':
                        return 'bg-yellow-50 border-yellow-300 text-yellow-900';
                      case 'LOW':
                        return 'bg-blue-50 border-blue-300 text-blue-900';
                      default:
                        return 'bg-gray-50 border-gray-300 text-gray-900';
                    }
                  };

                  return (
                    <div
                      key={alert.id}
                      className={`border rounded-lg p-4 ${getSeverityColor(alert.severity)}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline">
                              {alert.severity}
                            </Badge>
                            <span className="text-sm font-mono">{alert.alertType}</span>
                          </div>
                          <p className="font-medium">{alert.title}</p>
                          <p className="text-sm mt-1">{alert.message}</p>
                          <p className="text-xs mt-2 opacity-70">
                            {new Date(alert.createdAt).toLocaleString('pt-BR')}
                          </p>
                        </div>
                        {alert.resolved && (
                          <Badge className="ml-2">Resolvido</Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <div className="text-4xl mb-2">{ICONS.SUCCESS}</div>
                <p className="font-medium">Nenhum alerta no momento</p>
                <p className="text-sm">Seu sistema está operacional</p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
