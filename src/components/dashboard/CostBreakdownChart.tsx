// ================================================================
// COST BREAKDOWN CHART COMPONENT
// Gráfico de pizza para breakdown de custos por tipo de operação
// ================================================================

'use client';

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface CostBreakdownChartProps {
  data: Array<{
    operationType: string;
    count: number;
    totalCost: number;
    avgCost: number;
  }>;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const OPERATION_LABELS: Record<string, string> = {
  ONBOARDING: 'Onboarding',
  MONITORING_CHECK: 'Monitoramento',
  ATTACHMENT_FETCH: 'Busca de Anexos',
  MANUAL_SEARCH: 'Busca Manual',
};

// Type guard for label props
function isValidPieLabel(obj: unknown): obj is { name: string; percent: number } {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'name' in obj &&
    'percent' in obj &&
    typeof (obj as Record<string, unknown>).name === 'string' &&
    typeof (obj as Record<string, unknown>).percent === 'number'
  );
}

// Type guard for tooltip props
function isValidTooltipProps(obj: unknown): obj is { payload: Record<string, unknown> } {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'payload' in obj &&
    typeof (obj as Record<string, unknown>).payload === 'object'
  );
}

export function CostBreakdownChart({ data }: CostBreakdownChartProps) {
  // Format data for chart
  const chartData = data.map((item) => ({
    name: OPERATION_LABELS[item.operationType] || item.operationType,
    value: item.totalCost,
    count: item.count,
    avgCost: item.avgCost,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={(obj) => {
            if (!isValidPieLabel(obj)) return '';
            return `${obj.name} ${(obj.percent * 100).toFixed(0)}%`;
          }}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
          }}
          formatter={(value: unknown, name: string, props: unknown): React.ReactNode => {
            if (name === 'value' && typeof value === 'number' && isValidTooltipProps(props)) {
              const count = props.payload.count;
              const avgCost = props.payload.avgCost;

              // Type-safe extraction
              const countValue = typeof count === 'number' ? count : 0;
              const avgCostValue = typeof avgCost === 'number' ? avgCost : 0;

              return (
                <div className="text-sm">
                  <div>Custo: R$ {value.toFixed(2)}</div>
                  <div>Operações: {countValue}</div>
                  <div>Média: R$ {avgCostValue.toFixed(2)}</div>
                </div>
              );
            }
            // Type-safe fallback: convert unknown to string
            return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
          }}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
