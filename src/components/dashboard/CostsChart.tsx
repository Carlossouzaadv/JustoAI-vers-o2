// ================================================================
// COSTS CHART COMPONENT
// Gráfico de linha para visualizar custos ao longo do tempo
// ================================================================

'use client';

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format, parseISO } from 'date-fns';

interface CostsChartProps {
  data: Array<{
    date: string;
    cost: number;
    operations: number;
  }>;
}

export function CostsChart({ data }: CostsChartProps) {
  // Format data for chart
  const chartData = data.map((item) => ({
    date: format(parseISO(item.date), 'dd/MM'),
    cost: item.cost,
    operations: item.operations,
    fullDate: item.date,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="date"
          stroke="#6b7280"
          style={{ fontSize: '12px' }}
        />
        <YAxis
          yAxisId="left"
          stroke="#3b82f6"
          style={{ fontSize: '12px' }}
          label={{ value: 'Custo (R$)', angle: -90, position: 'insideLeft' }}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          stroke="#10b981"
          style={{ fontSize: '12px' }}
          label={{ value: 'Operações', angle: 90, position: 'insideRight' }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
          }}
          formatter={(value: any, name: string) => {
            if (name === 'cost') {
              return [`R$ ${value.toFixed(2)}`, 'Custo'];
            }
            return [value, 'Operações'];
          }}
          labelFormatter={(label, payload) => {
            if (payload && payload[0]) {
              return `Data: ${payload[0].payload.fullDate}`;
            }
            return label;
          }}
        />
        <Legend />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="cost"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={{ fill: '#3b82f6', r: 4 }}
          activeDot={{ r: 6 }}
          name="Custo (R$)"
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="operations"
          stroke="#10b981"
          strokeWidth={2}
          dot={{ fill: '#10b981', r: 4 }}
          activeDot={{ r: 6 }}
          name="Operações"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
