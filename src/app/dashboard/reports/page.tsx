'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScheduledReportsList } from '@/components/reports/scheduled-reports-list';
import { ReportScheduleDialog } from '@/components/reports/report-schedule-dialog';
import { ICONS } from '@/lib/icons';

export default function ReportsPage() {
  const [selectedTab, setSelectedTab] = useState('scheduled');

  // Dados simulados para demonstração
  const mockProcesses = [
    {
      id: 'proc_1',
      number: '0001234-56.2024.8.26.0100',
      title: 'Ação de Indenização por Danos Morais',
      clientName: 'Empresa ABC Ltda',
      estimatedPages: 3,
      lastUpdate: '2024-01-20T10:00:00Z'
    },
    {
      id: 'proc_2',
      number: '0002345-67.2024.8.26.0100',
      title: 'Recurso de Apelação Cível',
      clientName: 'Empresa ABC Ltda',
      estimatedPages: 5,
      lastUpdate: '2024-01-18T14:30:00Z'
    }
  ];

  const handleScheduleReport = async (schedule: any) => {
    try {
      const response = await fetch('/api/reports/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(schedule)
      });

      if (response.ok) {
        alert('Relatório agendado com sucesso!');
        // Recarregar a lista de agendamentos
      } else {
        throw new Error('Erro ao agendar relatório');
      }
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro ao agendar relatório');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                {ICONS.REPORTS} Centro de Relatórios
              </CardTitle>
              <p className="text-muted-foreground mt-1">
                Gerencie relatórios automáticos e sob demanda
              </p>
            </div>

            <div className="flex gap-2">
              <ReportScheduleDialog
                clientId="demo_client"
                clientName="Cliente Demonstração"
                availableProcesses={mockProcesses}
                onSchedule={handleScheduleReport}
                trigger={
                  <Button>
                    {ICONS.ADD} Novo Agendamento
                  </Button>
                }
              />

              <Button variant="outline">
                {ICONS.ROCKET} Gerar Relatório
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Tabs de conteúdo */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="scheduled" className="flex items-center gap-2">
            {ICONS.CALENDAR} Agendados
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            {ICONS.TIME} Histórico
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            {ICONS.SETTINGS} Configurações
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="scheduled" className="mt-0">
            <ScheduledReportsList />
          </TabsContent>

          <TabsContent value="history" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Execuções</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <span className="text-4xl mb-4 block">{ICONS.TIME}</span>
                  <h3 className="text-lg font-medium mb-2">Histórico em Desenvolvimento</h3>
                  <p className="text-sm">
                    Em breve você poderá visualizar o histórico completo de execuções
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle>Configurações Globais</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <h3 className="font-medium mb-2">Horário Padrão de Execução</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Relatórios automáticos são processados às 23h do domingo e entregues na segunda-feira.
                    </p>
                    <Button variant="outline" size="sm">
                      Alterar Configuração
                    </Button>
                  </div>

                  <div>
                    <h3 className="font-medium mb-2">Limites de Uso</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div className="p-3 bg-muted rounded">
                        <p className="font-medium">Relatórios/Mês</p>
                        <p className="text-2xl font-bold text-blue-600">120</p>
                        <p className="text-xs text-muted-foreground">Limite: 500</p>
                      </div>
                      <div className="p-3 bg-muted rounded">
                        <p className="font-medium">Tokens Usados</p>
                        <p className="text-2xl font-bold text-green-600">85K</p>
                        <p className="text-xs text-muted-foreground">Limite: 1M</p>
                      </div>
                      <div className="p-3 bg-muted rounded">
                        <p className="font-medium">Custo Mensal</p>
                        <p className="text-2xl font-bold text-purple-600">$47.50</p>
                        <p className="text-xs text-muted-foreground">Orçamento: $200</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-medium mb-2">Notificações</h3>
                    <div className="space-y-2">
                      <label className="flex items-center space-x-2">
                        <input type="checkbox" defaultChecked className="rounded" />
                        <span className="text-sm">Notificar quando relatório for gerado</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input type="checkbox" defaultChecked className="rounded" />
                        <span className="text-sm">Notificar em caso de erro na geração</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input type="checkbox" className="rounded" />
                        <span className="text-sm">Resumo semanal de atividades</span>
                      </label>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}