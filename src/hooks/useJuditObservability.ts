// ================================================================
// JUDIT OBSERVABILITY - REACT HOOKS
// Custom hooks para fetch de dados de observabilidade
// ================================================================

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ================================================================
// TYPES
// ================================================================

export interface DateRange {
  startDate?: string;
  endDate?: string;
  days?: number;
}

export interface HealthData {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  components: {
    api: {
      status: string;
      errorRate: string;
      totalCalls: number;
      totalErrors: number;
    };
    queue: {
      status: string;
      waiting: number;
      active: number;
      completed: number;
      failed: number;
    };
    costs: {
      status: string;
      todayCost: string;
      operations: number;
    };
    alerts: {
      status: string;
      unresolved: number;
    };
  };
}

export interface MetricsData {
  summary: {
    totalApiCalls: number;
    totalErrors: number;
    avgLatency: number;
    totalOnboardings: number;
    totalMonitoringChecks: number;
    attachmentFetchesTriggered: number;
    queueJobsTotal: number;
  };
  metrics: Record<string, any>;
}

export interface CostsData {
  summary: {
    totalCost: number;
    searchCost: number;
    attachmentsCost: number;
    operationsCount: number;
    avgCostPerOperation: number;
    projectedMonthlyCost: number;
    costTrend: 'increasing' | 'decreasing' | 'stable';
  };
  breakdown: Array<{
    operationType: string;
    count: number;
    totalCost: number;
    avgCost: number;
  }>;
  dailyCosts: Array<{
    date: string;
    cost: number;
    operations: number;
  }>;
}

export interface Alert {
  id: string;
  alertType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  message: string;
  numeroCnj?: string;
  requestId?: string;
  resolved: boolean;
  createdAt: string;
  resolvedAt?: string;
}

export interface AlertsData {
  alerts: Alert[];
  counts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  total: number;
}

// ================================================================
// HOOKS
// ================================================================

/**
 * Hook para buscar health status
 */
export function useJuditHealth(refetchInterval: number = 30000) {
  return useQuery<{ success: boolean; data: HealthData }>({
    queryKey: ['judit', 'health'],
    queryFn: async () => {
      const res = await fetch('/api/judit/observability/health');
      if (!res.ok) throw new Error('Failed to fetch health');
      return res.json();
    },
    refetchInterval,
  });
}

/**
 * Hook para buscar métricas
 */
export function useJuditMetrics(refetchInterval: number = 30000) {
  return useQuery<{ success: boolean; data: MetricsData }>({
    queryKey: ['judit', 'metrics'],
    queryFn: async () => {
      const res = await fetch('/api/judit/observability/metrics');
      if (!res.ok) throw new Error('Failed to fetch metrics');
      return res.json();
    },
    refetchInterval,
  });
}

/**
 * Hook para buscar custos
 */
export function useJuditCosts(
  filters: DateRange & { workspaceId?: string } = {},
  refetchInterval: number = 60000
) {
  return useQuery<{ success: boolean; data: CostsData }>({
    queryKey: ['judit', 'costs', filters],
    queryFn: async () => {
      const params = new URLSearchParams();

      if (filters.workspaceId) params.append('workspaceId', filters.workspaceId);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.days) params.append('days', filters.days.toString());

      const res = await fetch(`/api/judit/observability/costs?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch costs');
      return res.json();
    },
    refetchInterval,
  });
}

/**
 * Hook para buscar alertas
 */
export function useJuditAlerts(
  filters: {
    workspaceId?: string;
    resolved?: boolean;
    severity?: string;
    limit?: number;
  } = {},
  refetchInterval: number = 15000
) {
  return useQuery<{ success: boolean; data: AlertsData }>({
    queryKey: ['judit', 'alerts', filters],
    queryFn: async () => {
      const params = new URLSearchParams();

      if (filters.workspaceId) params.append('workspaceId', filters.workspaceId);
      if (filters.resolved !== undefined)
        params.append('resolved', String(filters.resolved));
      if (filters.severity) params.append('severity', filters.severity);
      if (filters.limit) params.append('limit', String(filters.limit));

      const res = await fetch(`/api/judit/observability/alerts?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch alerts');
      return res.json();
    },
    refetchInterval,
  });
}

/**
 * Hook para resolver um alerta
 */
export function useResolveAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (alertId: string) => {
      const res = await fetch('/api/judit/observability/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId, action: 'resolve' }),
      });

      if (!res.ok) throw new Error('Failed to resolve alert');
      return res.json();
    },
    onSuccess: () => {
      // Invalidate alerts query to refetch
      queryClient.invalidateQueries({ queryKey: ['judit', 'alerts'] });
    },
  });
}

/**
 * Hook para buscar estatísticas da fila
 */
export function useJuditQueueStats(refetchInterval: number = 15000) {
  return useQuery({
    queryKey: ['judit', 'queue', 'stats'],
    queryFn: async () => {
      const res = await fetch('/api/judit/queue/stats');
      if (!res.ok) throw new Error('Failed to fetch queue stats');
      return res.json();
    },
    refetchInterval,
  });
}
