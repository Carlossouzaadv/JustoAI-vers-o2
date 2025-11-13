// ================================================================
// LATENCY CHART COMPONENT
// Gráfico de barras para visualizar latências (p50, p95, p99)
// ================================================================

'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface LatencyChartProps {
  data: {
    p50?: number;
    p95?: number;
    p99?: number;
    avg: number;
    min: number;
    max: number;
  };
}

export function LatencyChart({ data }: LatencyChartProps) {
  const chartData = [
    { name: 'Mínimo', value: data.min },
    { name: 'P50', value: data.p50 || 0 },
    { name: 'Média', value: data.avg },
    { name: 'P95', value: data.p95 || 0 },
    { name: 'P99', value: data.p99 || 0 },
    { name: 'Máximo', value: data.max },
  ];

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="name" stroke="#6b7280" style={{ fontSize: '12px' }} />
        <YAxis
          stroke="#6b7280"
          style={{ fontSize: '12px' }}
          label={{ value: 'Latência (ms)', angle: -90, position: 'insideLeft' }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
          }}
          formatter={(value: unknown) => {
            // Type guard to ensure value is a number before calling toFixed
            if (typeof value === 'number') {
              return [`${value.toFixed(0)} ms`, 'Latência'];
            }
            return ['0 ms', 'Latência'];
          }}
        />
        <Legend />
        <Bar dataKey="value" fill="#3b82f6" name="Latência (ms)" />
      </BarChart>
    </ResponsiveContainer>
  );
}
