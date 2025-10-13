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
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
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
          formatter={(value: any, name: string, props: any) => {
            if (name === 'value') {
              return [
                <div key="tooltip" className="text-sm">
                  <div>Custo: R$ {value.toFixed(2)}</div>
                  <div>Operações: {props.payload.count}</div>
                  <div>Média: R$ {props.payload.avgCost.toFixed(2)}</div>
                </div>,
              ];
            }
            return value;
          }}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
