'use client';

import { useState, useEffect } from 'react';
import { SummaryCards } from '@/components/dashboard/summary-cards';
import { ProcessList } from '@/components/dashboard/process-list';
import { useDashboard } from './layout';

interface DashboardData {
  summary: {
    totalProcesses: number;
    completedAnalysis: number;
    partialAnalysis: number;
    attentionRequired: number;
    recentUpdates: number;
    pendingActions: number;
  };
}

export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const { selectedClientId, selectedClientName, setSelectedClient } = useDashboard();

  useEffect(() => {
    loadDashboardData();
  }, [selectedClientId]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Carregar dados gerais do dashboard
      const dashboardResponse = await fetch('/api/workspaces/current/summary');
      let summaryData = {
        totalProcesses: 0,
        completedAnalysis: 0,
        partialAnalysis: 0,
        attentionRequired: 0,
        recentUpdates: 0,
        pendingActions: 0,
      };

      if (dashboardResponse.ok) {
        const data = await dashboardResponse.json();
        summaryData = data.summary || summaryData;
      }

      // Se um cliente está selecionado, buscar nome do cliente
      if (selectedClientId && !selectedClientName) {
        const clientResponse = await fetch(`/api/clients/${selectedClientId}`);
        if (clientResponse.ok) {
          const clientData = await clientResponse.json();
          const clientName = clientData.client?.name || '';
          setSelectedClient(selectedClientId, clientName);
        }
      }

      setDashboardData({
        summary: summaryData,
      });

    } catch (error) {
      console.error('Erro ao carregar dados do dashboard:', error);

      // Dados de fallback para desenvolvimento
      setDashboardData({
        summary: {
          totalProcesses: 150,
          completedAnalysis: 85,
          partialAnalysis: 45,
          attentionRequired: 20,
          recentUpdates: 12,
          pendingActions: 8,
        }
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cards de Resumo */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Resumo Geral</h2>
        <SummaryCards
          data={dashboardData?.summary}
          loading={loading}
        />
      </section>

      {/* Lista de Processos */}
      <section>
        <ProcessList
          clientId={selectedClientId}
          clientName={selectedClientName}
        />
      </section>
    </div>
  );
}