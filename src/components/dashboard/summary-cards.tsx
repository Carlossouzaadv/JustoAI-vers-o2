'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ICONS } from '@/lib/icons';

interface SummaryData {
  totalProcesses: number;
  completedAnalysis: number;
  partialAnalysis: number;
  attentionRequired: number;
  recentUpdates: number;
  pendingActions: number;
}

interface SummaryCardsProps {
  data?: SummaryData;
  loading?: boolean;
}

export function SummaryCards({ data, loading = false }: SummaryCardsProps) {
  if (loading || !data) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-1/3 mb-2" />
              <Skeleton className="h-3 w-3/4" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: 'Total de Processos',
      value: data.totalProcesses,
      icon: ICONS.PROCESS,
      description: 'Todos os processos monitorados',
      color: 'text-blue-600',
    },
    {
      title: 'Análise Completa',
      value: data.completedAnalysis,
      icon: ICONS.SUCCESS,
      description: 'Processos totalmente analisados',
      color: 'text-green-600',
      percentage: data.totalProcesses > 0 ? Math.round((data.completedAnalysis / data.totalProcesses) * 100) : 0,
    },
    {
      title: 'Monitorando',
      value: data.partialAnalysis,
      icon: ICONS.WARNING,
      description: 'Sem análise essencial/estratégica',
      color: 'text-yellow-600',
      percentage: data.totalProcesses > 0 ? Math.round((data.partialAnalysis / data.totalProcesses) * 100) : 0,
    },
    {
      title: 'Atenção Necessária',
      value: data.attentionRequired,
      icon: ICONS.ERROR,
      description: 'Prazos próximos ou ações urgentes',
      color: 'text-red-600',
      percentage: data.totalProcesses > 0 ? Math.round((data.attentionRequired / data.totalProcesses) * 100) : 0,
    },
    {
      title: 'Atualizações Recentes',
      value: data.recentUpdates,
      icon: ICONS.TIME,
      description: 'Últimas 24 horas',
      color: 'text-purple-600',
    },
    {
      title: 'Ações Pendentes',
      value: data.pendingActions,
      icon: ICONS.CALENDAR,
      description: 'Requerem intervenção',
      color: 'text-orange-600',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <Card key={card.title} className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            <span className={`text-lg ${card.color}`}>{card.icon}</span>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className={`text-2xl font-bold ${card.color}`}>
                {card.value.toLocaleString('pt-BR')}
              </div>
              {'percentage' in card && card.percentage !== undefined && (
                <span className="text-xs text-muted-foreground">
                  ({card.percentage}%)
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {card.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}