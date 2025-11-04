import { useState, useEffect } from 'react';
import { getApiUrl } from '@/lib/api-client';

export interface TelemetryMetrics {
  monthlyUsage: {
    totalCost: number;
    dailyAverage: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    creditConsumption: number;
    documentsUploaded: number;
    casesCreated: number;
    successRate: number;
    avgResponseTime: number;
    operations: Array<{
      type: string;
      count: number;
      cost: number;
    }>;
  };
  activeAlerts: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    alerts: Array<{
      id: string;
      alertType: string;
      severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
      title: string;
      message: string;
      resolved: boolean;
      createdAt: string;
    }>;
  };
}

export function useTelemetry(workspaceId: string | null, refreshInterval: number = 300000) {
  const [metrics, setMetrics] = useState<TelemetryMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId) {
      setLoading(false);
      return;
    }

    const fetchTelemetry = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch monthly usage and alerts in parallel
        const [usageRes, alertsRes] = await Promise.all([
          fetch(getApiUrl('/api/telemetry/monthly-usage'), {
            credentials: 'include',
          }),
          fetch(getApiUrl('/api/telemetry/active-alerts'), {
            credentials: 'include',
          }),
        ]);

        if (!usageRes.ok || !alertsRes.ok) {
          throw new Error('Failed to fetch telemetry data');
        }

        const usageData = await usageRes.json();
        const alertsData = await alertsRes.json();

        setMetrics({
          monthlyUsage: usageData.monthlyUsage || {
            totalCost: 0,
            dailyAverage: 0,
            trend: 'stable',
            creditConsumption: 0,
            documentsUploaded: 0,
            casesCreated: 0,
            successRate: 0,
            avgResponseTime: 0,
            operations: [],
          },
          activeAlerts: alertsData.activeAlerts || {
            total: 0,
            critical: 0,
            high: 0,
            medium: 0,
            low: 0,
            alerts: [],
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        console.error('Error fetching telemetry:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTelemetry();

    // Set up refresh interval
    const interval = setInterval(fetchTelemetry, refreshInterval);
    return () => clearInterval(interval);
  }, [workspaceId, refreshInterval]);

  return { metrics, loading, error };
}
