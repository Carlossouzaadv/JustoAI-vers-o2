// ================================================================
// DASHBOARD FILTERS COMPONENT
// Filtros para período e tipo de operação
// ================================================================

'use client';

import React from 'react';
import { Calendar, Filter } from 'lucide-react';

export interface FilterState {
  period: '7' | '30' | '90' | 'custom';
  startDate?: string;
  endDate?: string;
  operationType?: string;
}

interface DashboardFiltersProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
}

export function DashboardFilters({ filters, onChange }: DashboardFiltersProps) {
  const periods = [
    { value: '7', label: 'Últimos 7 dias' },
    { value: '30', label: 'Últimos 30 dias' },
    { value: '90', label: 'Últimos 90 dias' },
    { value: 'custom', label: 'Período customizado' },
  ];

  const operationTypes = [
    { value: '', label: 'Todos os tipos' },
    { value: 'ONBOARDING', label: 'Onboarding' },
    { value: 'MONITORING_CHECK', label: 'Monitoramento' },
    { value: 'ATTACHMENT_FETCH', label: 'Busca de Anexos' },
    { value: 'MANUAL_SEARCH', label: 'Busca Manual' },
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Filter className="w-5 h-5 text-gray-500" />
        <h3 className="text-sm font-medium text-gray-900">Filtros</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Period Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Período
          </label>
          <select
            value={filters.period}
            onChange={(e) =>
              onChange({ ...filters, period: e.target.value as FilterState['period'] })
            }
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            {periods.map((period) => (
              <option key={period.value} value={period.value}>
                {period.label}
              </option>
            ))}
          </select>
        </div>

        {/* Custom Date Range */}
        {filters.period === 'custom' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data Inicial
              </label>
              <input
                type="date"
                value={filters.startDate || ''}
                onChange={(e) =>
                  onChange({ ...filters, startDate: e.target.value })
                }
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data Final
              </label>
              <input
                type="date"
                value={filters.endDate || ''}
                onChange={(e) =>
                  onChange({ ...filters, endDate: e.target.value })
                }
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </>
        )}

        {/* Operation Type Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tipo de Operação
          </label>
          <select
            value={filters.operationType || ''}
            onChange={(e) =>
              onChange({ ...filters, operationType: e.target.value })
            }
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            {operationTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
