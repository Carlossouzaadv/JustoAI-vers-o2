// ================================================================
// HEALTH STATUS COMPONENT
// Componente para exibir status de saúde do sistema
// ================================================================

'use client';

import React from 'react';
import { Activity, Database, AlertCircle, DollarSign, CheckCircle } from 'lucide-react';
// import { HealthData } from '@/hooks/useJuditObservability';

export interface HealthData {
  status: string;
  message: string;
  components: {
    api: { status: string; errorRate: string; totalCalls: number };
    queue: { status: string; waiting: number; active: number };
    costs: { status: string; todayCost: string; operations: number };
    alerts: { status: string; unresolved: number };
  };
}

interface HealthStatusProps {
  data: HealthData;
}

export function HealthStatus({ data }: HealthStatusProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-100';
      case 'degraded':
      case 'warning':
        return 'text-yellow-600 bg-yellow-100';
      case 'unhealthy':
      case 'critical':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5" />;
      case 'degraded':
      case 'warning':
        return <AlertCircle className="w-5 h-5" />;
      case 'unhealthy':
      case 'critical':
        return <AlertCircle className="w-5 h-5" />;
      default:
        return <Activity className="w-5 h-5" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Overall Status */}
      <div
        className={`rounded-lg p-6 ${
          data.status === 'healthy'
            ? 'bg-green-50 border border-green-200'
            : data.status === 'degraded'
            ? 'bg-yellow-50 border border-yellow-200'
            : 'bg-red-50 border border-red-200'
        }`}
      >
        <div className="flex items-center">
          <div
            className={`rounded-full p-2 ${
              data.status === 'healthy'
                ? 'bg-green-100 text-green-600'
                : data.status === 'degraded'
                ? 'bg-yellow-100 text-yellow-600'
                : 'bg-red-100 text-red-600'
            }`}
          >
            {getStatusIcon(data.status)}
          </div>
          <div className="ml-4">
            <h4 className="text-lg font-semibold text-gray-900">
              System Status:{' '}
              <span className="capitalize">{data.status}</span>
            </h4>
            <p className="text-sm text-gray-600 mt-1">{data.message}</p>
          </div>
        </div>
      </div>

      {/* Component Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* API Status */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <Activity className="w-5 h-5 text-gray-400 mr-2" />
              <span className="text-sm font-medium text-gray-900">API</span>
            </div>
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                data.components.api.status
              )}`}
            >
              {data.components.api.status}
            </span>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-gray-600">
              Error Rate:{' '}
              <span className="font-medium text-gray-900">
                {data.components.api.errorRate}
              </span>
            </p>
            <p className="text-xs text-gray-600">
              Total Calls:{' '}
              <span className="font-medium text-gray-900">
                {data.components.api.totalCalls.toLocaleString()}
              </span>
            </p>
          </div>
        </div>

        {/* Queue Status */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <Database className="w-5 h-5 text-gray-400 mr-2" />
              <span className="text-sm font-medium text-gray-900">Queue</span>
            </div>
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                data.components.queue.status
              )}`}
            >
              {data.components.queue.status}
            </span>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-gray-600">
              Waiting:{' '}
              <span className="font-medium text-gray-900">
                {data.components.queue.waiting}
              </span>
            </p>
            <p className="text-xs text-gray-600">
              Active:{' '}
              <span className="font-medium text-gray-900">
                {data.components.queue.active}
              </span>
            </p>
          </div>
        </div>

        {/* Costs Status */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <DollarSign className="w-5 h-5 text-gray-400 mr-2" />
              <span className="text-sm font-medium text-gray-900">Costs</span>
            </div>
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                data.components.costs.status
              )}`}
            >
              {data.components.costs.status}
            </span>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-gray-600">
              Today:{' '}
              <span className="font-medium text-gray-900">
                {data.components.costs.todayCost}
              </span>
            </p>
            <p className="text-xs text-gray-600">
              Operations:{' '}
              <span className="font-medium text-gray-900">
                {data.components.costs.operations}
              </span>
            </p>
          </div>
        </div>

        {/* Alerts Status */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-gray-400 mr-2" />
              <span className="text-sm font-medium text-gray-900">Alerts</span>
            </div>
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                data.components.alerts.status
              )}`}
            >
              {data.components.alerts.status}
            </span>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-gray-600">
              Unresolved:{' '}
              <span className="font-medium text-gray-900">
                {data.components.alerts.unresolved}
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
