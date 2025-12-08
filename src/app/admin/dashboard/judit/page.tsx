'use client';
export const dynamic = 'force-dynamic';

/**
 * Admin Dashboard - JUDIT API Consumption
 * /admin/dashboard/judit
 *
 * Dashboard interno para análise de consumo JUDIT
 * - Gráficos de consumo
 * - Análise de custos
 * - Calculadora de pricing
 * - Projeções
 */

import React, { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { AlertCircle, RefreshCw, DollarSign } from 'lucide-react';

// ================================================================
// Types
// ================================================================

interface ConsumptionReport {
  period: {
    start: string;
    end: string;
    days: number;
  };
  totalRequests: number;
  completedRequests: number;
  failedRequests: number;
  successRate: number;
  totalCost: number;
  avgCostPerRequest: number;
  byOrigin: Record<string, number>;
  bySearchType: Record<string, number>;
  byResponseType: Record<string, number>;
  byStatus: Record<string, number>;
  withAttachments: number;
  costBreakdown: {
    apiRequests: number;
    trackingRequests: number;
    attachments: number;
    total: number;
  };
  cachedAt: string;
}

// ================================================================
// Component
// ================================================================

export default function JuditDashboard() {
  const [report, setReport] = useState<ConsumptionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);

  // Fetch data
  useEffect(() => {
    fetchConsumption();
  }, []);

  async function fetchConsumption() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/admin/judit-consumption');

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Não autorizado. Faça login primeiro.');
        }
        throw new Error('Erro ao buscar dados de consumo');
      }

      const data = await response.json();
      setReport(data.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await fetchConsumption();
    setRefreshing(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando dados de consumo...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-red-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            <p className="font-bold flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Erro
            </p>
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-yellow-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-3 rounded">
            Sem dados de consumo disponíveis para o período selecionado.
          </div>
        </div>
      </div>
    );
  }

  // Prepare chart data
  const byOriginData = Object.entries(report.byOrigin).map(([name, value]) => ({
    name: name.toUpperCase(),
    value,
    percentage: report.totalRequests > 0
      ? ((value / report.totalRequests) * 100).toFixed(1)
      : '0.0'
  })).filter(item => item.value > 0);

  const bySearchTypeData = Object.entries(report.bySearchType)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({
      name: name.toUpperCase(),
      value,
      percentage: ((value / report.totalRequests) * 100).toFixed(1)
    }));

  const costBreakdownData = [
    { name: 'API Requests', value: report.costBreakdown.apiRequests },
    { name: 'Tracking', value: report.costBreakdown.trackingRequests },
    { name: 'Attachments', value: report.costBreakdown.attachments }
  ].filter(item => item.value > 0);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">
            JUDIT API Dashboard
          </h1>
          <p className="text-slate-600">
            Período: <span className="font-semibold">{report.period.start}</span> a{' '}
            <span className="font-semibold">{report.period.end}</span> ({report.period.days} dias)
          </p>
          <p className="text-sm text-slate-500 mt-1">
            Atualizado em: {new Date(report.cachedAt).toLocaleString('pt-BR')}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 mb-8">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
          <button
            onClick={() => setShowCalculator(!showCalculator)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            <DollarSign className="w-4 h-4" />
            Calculadora de Preço
          </button>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <MetricCard
            title="Total de Requisições"
            value={report.totalRequests}
            icon="📊"
          />
          <MetricCard
            title="Taxa de Sucesso"
            value={`${report.successRate.toFixed(1)}%`}
            icon="✅"
          />
          <MetricCard
            title="Custo Total"
            value={`R$ ${report.totalCost.toFixed(2)}`}
            icon="💰"
          />
          <MetricCard
            title="Custo Médio"
            value={`R$ ${report.avgCostPerRequest.toFixed(2)}`}
            icon="📈"
          />
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* By Origin */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Por Origem</h2>
            {byOriginData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={byOriginData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percentage }) => `${name} (${percentage}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {byOriginData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => value} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-slate-400">
                Sem dados por origem
              </div>
            )}
          </div>

          {/* By Search Type */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Por Tipo de Busca</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={bySearchTypeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cost Breakdown */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Detalhamento de Custos</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {costBreakdownData.map((item) => (
              <div key={item.name} className="bg-slate-50 p-4 rounded-lg">
                <p className="text-slate-600 text-sm font-medium">{item.name}</p>
                <p className="text-2xl font-bold text-slate-900 mt-2">
                  R$ {item.value.toFixed(2)}
                </p>
              </div>
            ))}
            <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
              <p className="text-blue-600 text-sm font-medium">TOTAL</p>
              <p className="text-2xl font-bold text-blue-900 mt-2">
                R$ {report.costBreakdown.total.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* Details Table */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Detalhes</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-slate-600">Requisições Completadas</p>
              <p className="text-lg font-bold">{report.completedRequests}</p>
            </div>
            <div>
              <p className="text-slate-600">Requisições Falhadas</p>
              <p className="text-lg font-bold text-red-600">{report.failedRequests}</p>
            </div>
            <div>
              <p className="text-slate-600">Com Anexos</p>
              <p className="text-lg font-bold">{report.withAttachments}</p>
            </div>
            <div>
              <p className="text-slate-600">Custo/Dia (Médio)</p>
              <p className="text-lg font-bold">
                R$ {(report.totalCost / report.period.days).toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* Calculator Section */}
        {showCalculator && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">
              Calculadora de Pricing
            </h2>
            <PricingCalculator />
          </div>
        )}
      </div>
    </div>
  );
}

// ================================================================
// Subcomponents
// ================================================================

function MetricCard({
  title,
  value,
  icon
}: {
  title: string;
  value: string | number;
  icon: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-600 text-sm font-medium">{title}</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">{value}</p>
        </div>
        <span className="text-3xl">{icon}</span>
      </div>
    </div>
  );
}

function PricingCalculator() {
  const [margin, setMargin] = useState(70);
  const [selectedPlan, setSelectedPlan] = useState<'A' | 'B'>('A');

  // Base costs (from real consumption)
  const plans = {
    A: { name: 'Starter', costPerMonth: 148.91 },
    B: { name: 'Professional', costPerMonth: 446.73 }
  };

  const plan = plans[selectedPlan];
  const monthlyPrice = plan.costPerMonth / (1 - margin / 100);
  const monthlyProfit = monthlyPrice - plan.costPerMonth;
  const yearlyProfit = monthlyProfit * 12;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Plano
          </label>
          <select
            value={selectedPlan}
            onChange={(e) => setSelectedPlan(e.target.value as 'A' | 'B')}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
          >
            <option value="A">Plano A (Starter)</option>
            <option value="B">Plano B (Professional)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Margem de Lucro: {margin}%
          </label>
          <input
            type="range"
            min="10"
            max="90"
            value={margin}
            onChange={(e) => setMargin(parseInt(e.target.value))}
            className="w-full"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-50 p-4 rounded-lg">
          <p className="text-slate-600 text-sm">Custo Operacional</p>
          <p className="text-2xl font-bold mt-2">
            R$ {plan.costPerMonth.toFixed(2)}
          </p>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg">
          <p className="text-blue-600 text-sm font-medium">Preço Mensal</p>
          <p className="text-2xl font-bold text-blue-900 mt-2">
            R$ {monthlyPrice.toFixed(2)}
          </p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <p className="text-green-600 text-sm font-medium">Lucro/Mês</p>
          <p className="text-2xl font-bold text-green-900 mt-2">
            R$ {monthlyProfit.toFixed(2)}
          </p>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <p className="text-purple-600 text-sm font-medium">Lucro/Ano</p>
          <p className="text-2xl font-bold text-purple-900 mt-2">
            R$ {yearlyProfit.toFixed(2)}
          </p>
        </div>
      </div>
    </div>
  );
}
