'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ICONS } from '@/lib/icons';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface CostMetricsCardProps {
  totalCost: number;
  dailyAverage: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  loading?: boolean;
}

export function CostMetricsCard({
  totalCost,
  dailyAverage,
  trend,
  loading = false,
}: CostMetricsCardProps) {
  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="p-6">
          <div className="h-20 bg-gradient-to-r from-gray-200 to-gray-300 rounded"></div>
        </CardContent>
      </Card>
    );
  }

  const getTrendIcon = () => {
    switch (trend) {
      case 'increasing':
        return <TrendingUp className="w-4 h-4 text-red-500" />;
      case 'decreasing':
        return <TrendingDown className="w-4 h-4 text-green-500" />;
      default:
        return <Minus className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getTrendColor = () => {
    switch (trend) {
      case 'increasing':
        return 'bg-red-50 border-red-200';
      case 'decreasing':
        return 'bg-green-50 border-green-200';
      default:
        return 'bg-yellow-50 border-yellow-200';
    }
  };

  const getTrendLabel = () => {
    switch (trend) {
      case 'increasing':
        return 'Custo crescente';
      case 'decreasing':
        return 'Custo decrescente';
      default:
        return 'Custo estável';
    }
  };

  return (
    <Card className={`cursor-pointer hover:shadow-lg transform hover:scale-[1.02] transition-all duration-300 border ${getTrendColor()}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <span className="text-lg">{ICONS.COINS}</span>
          Custo Mensal
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <div className="text-3xl font-bold">
              R$ {totalCost.toFixed(2)}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Consumo total este mês
            </p>
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-2">
              {getTrendIcon()}
              <Badge variant="secondary" className="text-xs">
                {getTrendLabel()}
              </Badge>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Média/dia</p>
              <p className="font-semibold">R$ {dailyAverage.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
