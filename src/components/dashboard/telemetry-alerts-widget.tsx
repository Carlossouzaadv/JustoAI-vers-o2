'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ICONS } from '@/lib/icons';
import Link from 'next/link';

interface TelemetryAlert {
  id: string;
  alertType: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  message: string;
  resolved: boolean;
  createdAt: string;
}

interface TelemetryAlertsWidgetProps {
  alerts: TelemetryAlert[];
  totalCount: number;
  criticalCount: number;
  highCount: number;
  loading?: boolean;
}

export function TelemetryAlertsWidget({
  alerts,
  totalCount,
  criticalCount,
  highCount,
  loading = false,
}: TelemetryAlertsWidgetProps) {
  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="p-6">
          <div className="h-20 bg-gradient-to-r from-gray-200 to-gray-300 rounded"></div>
        </CardContent>
      </Card>
    );
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'HIGH':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'LOW':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return '🚨';
      case 'HIGH':
        return '⚠️';
      case 'MEDIUM':
        return '⚡';
      case 'LOW':
        return 'ℹ️';
      default:
        return '📋';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Agora';
    if (diffMins < 60) return `${diffMins}m atrás`;
    if (diffHours < 24) return `${diffHours}h atrás`;
    if (diffDays < 7) return `${diffDays}d atrás`;
    return date.toLocaleDateString('pt-BR');
  };

  const unresolved = alerts.filter((a) => !a.resolved);
  const displayAlerts = unresolved.slice(0, 3);

  return (
    <Card className="border-amber-200 hover:shadow-lg transition-all duration-300">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <span className="text-lg">{ICONS.WARNING}</span>
            Alertas de Sistema
          </CardTitle>
          {totalCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {totalCount}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-2 mb-3 pb-3 border-b">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Críticos</p>
              <p className="font-bold text-red-600">{criticalCount}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Altos</p>
              <p className="font-bold text-orange-600">{highCount}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Não Resolvidos</p>
              <p className="font-bold">{unresolved.length}</p>
            </div>
          </div>

          {/* Alert List */}
          {displayAlerts.length > 0 ? (
            <div className="space-y-2">
              {displayAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-2 rounded border text-xs space-y-1 ${getSeverityColor(alert.severity)}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2 flex-1">
                      <span className="text-sm mt-0.5">{getSeverityIcon(alert.severity)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{alert.title}</p>
                        <p className="opacity-75 line-clamp-1">{alert.message}</p>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs opacity-60">{formatDate(alert.createdAt)}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              <div className="text-2xl mb-2">{ICONS.SUCCESS}</div>
              <p className="text-xs">Nenhum alerta no momento</p>
            </div>
          )}

          {/* View All Link */}
          {unresolved.length > 3 && (
            <Link href="/dashboard/alerts">
              <Button variant="outline" size="sm" className="w-full mt-2">
                Ver todos ({unresolved.length})
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
