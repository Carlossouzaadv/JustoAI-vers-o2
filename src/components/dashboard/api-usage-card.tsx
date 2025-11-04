'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ICONS } from '@/lib/icons';

interface ApiUsageCardProps {
  successRate: number;
  avgResponseTime: number;
  totalOperations: number;
  loading?: boolean;
}

export function ApiUsageCard({
  successRate,
  avgResponseTime,
  totalOperations,
  loading = false,
}: ApiUsageCardProps) {
  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="p-6">
          <div className="h-20 bg-gradient-to-r from-gray-200 to-gray-300 rounded"></div>
        </CardContent>
      </Card>
    );
  }

  const getStatusColor = (rate: number) => {
    if (rate >= 95) return 'text-green-600';
    if (rate >= 80) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusBadge = (rate: number) => {
    if (rate >= 95) return { text: 'Excelente', variant: 'default' as const };
    if (rate >= 80) return { text: 'Bom', variant: 'secondary' as const };
    return { text: 'Atenção', variant: 'destructive' as const };
  };

  const status = getStatusBadge(successRate);

  return (
    <Card className="cursor-pointer hover:shadow-lg transform hover:scale-[1.02] transition-all duration-300">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <span className="text-lg">{ICONS.ACTIVITY}</span>
          Taxa de Sucesso API
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <div className={`text-3xl font-bold ${getStatusColor(successRate)}`}>
              {successRate.toFixed(1)}%
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Das requisições foram bem-sucedidas
            </p>
          </div>

          <Progress value={successRate} className="h-2" />

          <div className="flex items-center justify-between pt-2 border-t">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Status</p>
              <Badge variant={status.variant}>{status.text}</Badge>
            </div>
            <div className="text-right space-y-1">
              <p className="text-xs text-muted-foreground">Latência média</p>
              <p className="font-semibold">{avgResponseTime.toFixed(0)}ms</p>
            </div>
          </div>

          <div className="text-center pt-2 border-t">
            <p className="text-sm font-medium">{totalOperations} operações hoje</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
