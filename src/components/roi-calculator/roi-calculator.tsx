'use client';

import { useState } from 'react';
import { calculateROI, formatCurrency, getROIMessage, getROISentiment, type ROIInputs, type ROICalculation } from '@/lib/roi-calculator';
import { TrendingUp, Clock, DollarSign, Zap } from 'lucide-react';

export function ROICalculator() {
  const [inputs, setInputs] = useState<ROIInputs>({
    hoursPerWeek: 20,
    hourlyRate: 250,
    numClients: 10,
    reportFrequency: 'weekly',
    selectedPlan: 'gestao'
  });

  const [results, setResults] = useState<ROICalculation | null>(null);

  const handleInputChange = (field: keyof ROIInputs, value: unknown) => {
    const updatedInputs = { ...inputs, [field]: value };
    setInputs(updatedInputs);
    setResults(calculateROI(updatedInputs));
  };

  // Calculate on mount
  if (!results) {
    setResults(calculateROI(inputs));
  }

  const sentiment = results ? getROISentiment(results.roiPercentage) : 'neutral';
  const message = results ? getROIMessage(results.roiPercentage) : '';

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold text-gray-900">Calculadora de ROI</h1>
        <p className="text-lg text-gray-600">
          Descubra quanto você pode economizar com JustoAI
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Left: Input Form */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                ⏱️ Horas/semana em relatórios executivos
              </label>
              <input
                type="number"
                min="1"
                max="40"
                value={inputs.hoursPerWeek}
                onChange={(e) => handleInputChange('hoursPerWeek', parseFloat(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-lg font-semibold focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Tempo gasto preparando relatórios para clientes</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                💰 Valor da sua hora (R$)
              </label>
              <input
                type="number"
                min="50"
                step="50"
                value={inputs.hourlyRate}
                onChange={(e) => handleInputChange('hourlyRate', parseFloat(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-lg font-semibold focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Quanto você cobra/fatura por hora</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                👥 Número de clientes
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={inputs.numClients}
                onChange={(e) => handleInputChange('numClients', parseInt(e.target.value, 10))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-lg font-semibold focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Clientes que recebem relatórios</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                📅 Frequência dos relatórios
              </label>
              <select
                value={inputs.reportFrequency}
                onChange={(e) => handleInputChange('reportFrequency', e.target.value as 'weekly' | 'biweekly' | 'monthly')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="weekly">Semanal</option>
                <option value="biweekly">Quinzenal</option>
                <option value="monthly">Mensal</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                🚀 Plano escolhido
              </label>
              <select
                value={inputs.selectedPlan}
                onChange={(e) => handleInputChange('selectedPlan', e.target.value as 'gestao' | 'performance')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="gestao">Gestão - R$ 497/mês</option>
                <option value="performance">Performance - R$ 1.197/mês</option>
              </select>
            </div>
          </div>
        </div>

        {/* Right: Results */}
        <div className="space-y-6">
          {results && (
            <>
              {/* ROI Highlight Card */}
              <div className={`rounded-lg p-6 text-white ${
                sentiment === 'positive' ? 'bg-gradient-to-r from-green-500 to-emerald-600' :
                sentiment === 'neutral' ? 'bg-gradient-to-r from-blue-500 to-cyan-600' :
                'bg-gradient-to-r from-gray-600 to-gray-700'
              }`}>
                <div className="text-center space-y-3">
                  <p className="text-sm font-medium opacity-90">ROI em 30 dias</p>
                  <p className="text-5xl font-bold">{results.roiPercentage}%</p>
                  <p className="text-sm font-medium opacity-90">{message}</p>
                </div>
              </div>

              {/* Key Metrics Grid */}
              <div className="grid grid-cols-2 gap-4">
                {/* Monthly Savings */}
                <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-gray-600">
                    <DollarSign className="w-5 h-5" />
                    <p className="text-xs font-medium">Economia Mensal</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(results.netMonthlySavingsBRL)}</p>
                  <p className="text-xs text-gray-500">Depois do custo do plano</p>
                </div>

                {/* Hours Saved */}
                <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock className="w-5 h-5" />
                    <p className="text-xs font-medium">Tempo/Mês</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{results.savedMonthlyHours}h</p>
                  <p className="text-xs text-gray-500">Horas economizadas</p>
                </div>

                {/* Payback Period */}
                <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Zap className="w-5 h-5" />
                    <p className="text-xs font-medium">Payback</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{results.paybackPeriodDays}d</p>
                  <p className="text-xs text-gray-500">Dias para se pagar</p>
                </div>

                {/* Annual Savings */}
                <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-gray-600">
                    <TrendingUp className="w-5 h-5" />
                    <p className="text-xs font-medium">Economia Anual</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(results.annualSavingsBRL)}</p>
                  <p className="text-xs text-gray-500">Acumulado em 12 meses</p>
                </div>
              </div>

              {/* Detailed Comparison */}
              <div className="bg-gray-50 rounded-lg border border-gray-200 p-6 space-y-4">
                <h3 className="font-semibold text-gray-900">Comparação Detalhada</h3>

                <div className="space-y-3">
                  <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                    <span className="text-sm text-gray-600">Status atual (sem JustoAI)</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(results.currentMonthlyCost)}/mês</span>
                  </div>

                  <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                    <span className="text-sm text-gray-600">Horas/mês em relatórios</span>
                    <span className="font-semibold text-gray-900">{results.currentMonthlyHours}h</span>
                  </div>

                  <div className="bg-white p-3 rounded border border-green-200">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-green-700">Com JustoAI - Economia</span>
                      <span className="font-semibold text-green-700">{formatCurrency(results.savedMonthlyCostBRL)}/mês</span>
                    </div>
                    <p className="text-xs text-gray-600">{results.savedMonthlyHours}h economizadas</p>
                  </div>

                  <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                    <span className="text-sm text-gray-600">Custo do plano</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(results.planMonthlyCostBRL)}/mês</span>
                  </div>

                  <div className="bg-blue-50 p-3 rounded border border-blue-200">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-blue-700">Benefício líquido/mês</span>
                      <span className={`font-semibold ${results.netMonthlySavingsBRL > 0 ? 'text-green-600' : 'text-orange-600'}`}>
                        {formatCurrency(results.netMonthlySavingsBRL)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <p className="text-xs text-gray-600">
                    ✨ <strong>Em 1 ano:</strong> {results.annualHoursFreed} livres + {formatCurrency(results.annualSavingsBRL)} economizados
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* CTA */}
      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-200 p-8 text-center space-y-4">
        <h3 className="text-2xl font-bold text-gray-900">Pronto para começar?</h3>
        <p className="text-gray-600 max-w-lg mx-auto">
          Inicie seu trial de 7 dias gratuitamente. Sem cartão de crédito necessário. Acesso completo a todas as funcionalidades.
        </p>
        <div className="flex gap-4 justify-center">
          <a
            href="/signup"
            className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            Começar Trial Grátis
          </a>
          <a
            href="/contact"
            className="px-8 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition"
          >
            Falar com Especialista
          </a>
        </div>
      </div>
    </div>
  );
}
