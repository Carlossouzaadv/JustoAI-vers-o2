// ================================================================
// JUDIT MONITORING DASHBOARD PAGE
// Dashboard completo de observabilidade da integração JUDIT
// ================================================================

'use client';

export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import {
  Activity,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  BarChart3,
} from 'lucide-react';
import {
  useJuditHealth,
  useJuditMetrics,
  useJuditCosts,
  useJuditAlerts,
  type HealthData,
  type MetricsData,
  type CostsData,
  type AlertsData,
} from '@/hooks/useJuditObservability';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { StatCard } from '@/components/dashboard/StatCard';
import { HealthStatus } from '@/components/dashboard/HealthStatus';
import { CostsChart } from '@/components/dashboard/CostsChart';
import { CostBreakdownChart } from '@/components/dashboard/CostBreakdownChart';
import { LatencyChart } from '@/components/dashboard/LatencyChart';
import { AlertsTable } from '@/components/dashboard/AlertsTable';
import { DashboardFilters, FilterState } from '@/components/dashboard/DashboardFilters';
import { ExportButton } from '@/components/dashboard/ExportButton';

export default function JuditDashboardPage() {
  const [filters, setFilters] = useState<FilterState>({
    period: '30',
  });

  // Calculate date range based on filters
  const getDateRange = () => {
    if (filters.period === 'custom') {
      return {
        startDate: filters.startDate,
        endDate: filters.endDate,
      };
    }
    return {
      days: parseInt(filters.period),
    };
  };

  // Fetch data
  const { data: healthData, isLoading: healthLoading } = useJuditHealth();
  const { data: metricsData, isLoading: metricsLoading } = useJuditMetrics();
  const { data: costsData, isLoading: costsLoading } = useJuditCosts(getDateRange());
  const {
    data: alertsData,
    isLoading: alertsLoading,
    refetch: refetchAlerts,
  } = useJuditAlerts({ resolved: false });

  const health: HealthData | undefined = healthData?.data;
  const metrics: MetricsData | undefined = metricsData?.data;
  const costs: CostsData | undefined = costsData?.data;
  const alerts: AlertsData | undefined = alertsData?.data;

  // Extract latency data from metrics with type guard
  const getLatencyData = (): {
    p50?: number;
    p95?: number;
    p99?: number;
    avg: number;
    min: number;
    max: number;
  } | null => {
    if (!metrics?.metrics) return null;

    const latencyMetric = Object.entries(metrics.metrics).find(([key]) =>
      key.includes('judit.api.latency_ms')
    );

    if (!latencyMetric) return null;

    const data = latencyMetric[1];

    // Type guard: validate the structure
    if (
      typeof data !== 'object' ||
      data === null ||
      !('avg' in data) ||
      !('min' in data) ||
      !('max' in data) ||
      typeof data.avg !== 'number' ||
      typeof data.min !== 'number' ||
      typeof data.max !== 'number'
    ) {
      return null;
    }

    return data as {
      p50?: number;
      p95?: number;
      p99?: number;
      avg: number;
      min: number;
      max: number;
    };
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              JUDIT Integration Monitoring
            </h1>
            <p className="text-gray-600 mt-1">
              Real-time observability and cost tracking
            </p>
          </div>
          {costs && (
            <ExportButton
              data={costs}
              filename="judit-costs-report"
              formats={['csv', 'json']}
            />
          )}
        </div>
      </div>

      {/* Filters */}
      <DashboardFilters filters={filters} onChange={setFilters} />

      {/* Health Status */}
      {health && (
        <DashboardCard
          title="System Health"
          subtitle="Overall system status and component health"
          className="mb-6"
          loading={healthLoading}
        >
          <HealthStatus data={health} />
        </DashboardCard>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <StatCard
          title="Total API Calls"
          value={metrics?.summary.totalApiCalls.toLocaleString() || '0'}
          icon={Activity}
          iconColor="text-blue-600"
          iconBgColor="bg-blue-100"
        />
        <StatCard
          title="Avg Latency"
          value={`${metrics?.summary.avgLatency.toFixed(0) || '0'}ms`}
          icon={TrendingUp}
          iconColor="text-green-600"
          iconBgColor="bg-green-100"
        />
        <StatCard
          title="Total Cost"
          value={`R$ ${costs?.summary.totalCost.toFixed(2) || '0.00'}`}
          icon={DollarSign}
          iconColor="text-purple-600"
          iconBgColor="bg-purple-100"
        />
        <StatCard
          title="Active Alerts"
          value={alerts?.total || 0}
          icon={AlertTriangle}
          iconColor="text-red-600"
          iconBgColor="bg-red-100"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Costs Over Time */}
        {costs?.dailyCosts && (
          <DashboardCard
            title="Costs Over Time"
            subtitle={`Projected monthly: R$ ${costs.summary.projectedMonthlyCost.toFixed(2)}`}
            loading={costsLoading}
          >
            <CostsChart data={costs.dailyCosts} />
          </DashboardCard>
        )}

        {/* Cost Breakdown */}
        {costs?.breakdown && costs.breakdown.length > 0 && (
          <DashboardCard
            title="Cost Breakdown by Operation Type"
            subtitle={`${costs.summary.operationsCount} operations`}
            loading={costsLoading}
          >
            <CostBreakdownChart data={costs.breakdown} />
          </DashboardCard>
        )}
      </div>

      {/* Latency Chart */}
      {(() => {
        const latencyData = getLatencyData();
        return latencyData ? (
          <DashboardCard
            title="API Latency Distribution"
            subtitle="Response time percentiles"
            className="mb-6"
            loading={metricsLoading}
          >
            <LatencyChart data={latencyData} />
          </DashboardCard>
        ) : null;
      })()}

      {/* Alerts Table */}
      <DashboardCard
        title="Active Alerts"
        subtitle={`${alerts?.total || 0} unresolved alerts`}
        loading={alertsLoading}
        action={
          <button
            onClick={() => refetchAlerts()}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            Refresh
          </button>
        }
      >
        <AlertsTable
          alerts={alerts?.alerts || []}
          onAlertResolved={() => refetchAlerts()}
        />
      </DashboardCard>

      {/* Cost Summary Cards */}
      {costs && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h4 className="text-sm font-medium text-gray-600 mb-2">
              Average Cost per Operation
            </h4>
            <p className="text-2xl font-bold text-gray-900">
              R$ {costs.summary.avgCostPerOperation.toFixed(2)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Based on {costs.summary.operationsCount} operations
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h4 className="text-sm font-medium text-gray-600 mb-2">Cost Trend</h4>
            <p className="text-2xl font-bold text-gray-900 capitalize">
              {costs.summary.costTrend}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Compared to previous period
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h4 className="text-sm font-medium text-gray-600 mb-2">
              Projected Monthly Cost
            </h4>
            <p className="text-2xl font-bold text-gray-900">
              R$ {costs.summary.projectedMonthlyCost.toFixed(2)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Based on current usage
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
