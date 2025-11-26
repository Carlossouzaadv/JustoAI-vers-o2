// ================================================================
// ALERTS TABLE COMPONENT
// Tabela interativa de alertas com ações
// ================================================================

'use client';

import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { CheckCircle } from 'lucide-react';
import { Alert, useResolveAlert } from '@/hooks/useJuditObservability';

interface AlertsTableProps {
  alerts: Alert[];
  onAlertResolved?: () => void;
}

export function AlertsTable({ alerts, onAlertResolved }: AlertsTableProps) {
  const resolveAlert = useResolveAlert();
  const [selectedAlerts, setSelectedAlerts] = useState<Set<string>>(new Set());

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'HIGH':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'LOW':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getAlertTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      API_ERROR: 'Erro na API',
      RATE_LIMIT: 'Rate Limit',
      CIRCUIT_BREAKER: 'Circuit Breaker',
      HIGH_COST: 'Custo Alto',
      TIMEOUT: 'Timeout',
      ATTACHMENT_TRIGGER: 'Anexos Buscados',
      MONITORING_FAILED: 'Monitoramento Falhou',
    };
    return labels[type] || type;
  };

  const handleResolve = async (alertId: string) => {
    try {
      await resolveAlert.mutateAsync(alertId);
      onAlertResolved?.();
    } catch (error) {
      console.error('Failed to resolve alert:', error);
    }
  };

  const toggleSelect = (alertId: string) => {
    const newSelected = new Set(selectedAlerts);
    if (newSelected.has(alertId)) {
      newSelected.delete(alertId);
    } else {
      newSelected.add(alertId);
    }
    setSelectedAlerts(newSelected);
  };

  const handleBulkResolve = async () => {
    try {
      await Promise.all(
        Array.from(selectedAlerts).map((id) => resolveAlert.mutateAsync(id))
      );
      setSelectedAlerts(new Set());
      onAlertResolved?.();
    } catch (error) {
      console.error('Failed to bulk resolve alerts:', error);
    }
  };

  if (alerts.length === 0) {
    return (
      <div className="text-center py-12">
        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
        <p className="text-gray-600">Nenhum alerta ativo</p>
        <p className="text-sm text-gray-500 mt-1">Todos os sistemas operacionais</p>
      </div>
    );
  }

  return (
    <div>
      {/* Bulk Actions */}
      {selectedAlerts.size > 0 && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md flex items-center justify-between">
          <span className="text-sm text-blue-800">
            {selectedAlerts.size} alerta(s) selecionado(s)
          </span>
          <button
            onClick={handleBulkResolve}
            disabled={resolveAlert.isPending}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            Resolver Selecionados
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedAlerts.size === alerts.length}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedAlerts(new Set(alerts.map((a) => a.id)));
                    } else {
                      setSelectedAlerts(new Set());
                    }
                  }}
                  className="rounded border-gray-300"
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Severidade
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tipo
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Mensagem
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                CNJ
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Data
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {alerts.map((alert) => (
              <tr
                key={alert.id}
                className={`hover:bg-gray-50 ${
                  alert.resolved ? 'opacity-60' : ''
                }`}
              >
                <td className="px-3 py-4">
                  {!alert.resolved && (
                    <input
                      type="checkbox"
                      checked={selectedAlerts.has(alert.id)}
                      onChange={() => toggleSelect(alert.id)}
                      className="rounded border-gray-300"
                    />
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${getSeverityColor(
                      alert.severity
                    )}`}
                  >
                    {alert.severity}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {getAlertTypeLabel(alert.alertType)}
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900">{alert.title}</div>
                  <div className="text-sm text-gray-500">{alert.message}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {alert.numeroCnj || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {format(parseISO(alert.createdAt), 'dd/MM/yyyy HH:mm')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  {!alert.resolved ? (
                    <button
                      onClick={() => handleResolve(alert.id)}
                      disabled={resolveAlert.isPending}
                      className="text-blue-600 hover:text-blue-900 disabled:opacity-50"
                      title="Resolver alerta"
                    >
                      <CheckCircle className="w-5 h-5 inline" />
                    </button>
                  ) : (
                    <span className="text-green-600 text-xs">Resolvido</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
