'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ReportScheduleDialog } from '@/components/reports/report-schedule-dialog';
import { ICONS } from '@/lib/icons';

interface ClientActionsButtonProps {
  clientId: string;
  clientName: string;
}

interface ProcessOption {
  id: string;
  number: string;
  title: string;
  clientName: string;
  estimatedPages: number;
  lastUpdate: string;
}

export function ClientActionsButton({ clientId, clientName }: ClientActionsButtonProps) {
  const [processes, setProcesses] = useState<ProcessOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);

  useEffect(() => {
    if (clientId) {
      loadClientProcesses();
    }
  }, [clientId]);

  const loadClientProcesses = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/processes?clientId=${clientId}`);
      if (response.ok) {
        const data = await response.json();
        const processOptions: ProcessOption[] = (data.processes || []).map((process: any) => ({
          id: process.id,
          number: process.number,
          title: process.title,
          clientName: process.clientName || clientName,
          estimatedPages: Math.ceil((process.title?.length || 100) / 50) + 1, // Estimativa baseada no tamanho
          lastUpdate: process.updatedAt || new Date().toISOString()
        }));
        setProcesses(processOptions);
      }
    } catch (error) {
      console.error('Erro ao carregar processos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleReport = async (schedule: any) => {
    try {
      const response = await fetch('/api/reports/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(schedule)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Agendamento criado:', result);
        alert('Relatório agendado com sucesso!');
      } else {
        throw new Error('Erro ao agendar relatório');
      }
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro ao agendar relatório');
    }
  };

  const handleGenerateInstantReport = async () => {
    try {
      // Navegar para geração de relatório sob demanda
      const processIds = processes.map(p => p.id);
      const params = new URLSearchParams({
        clientId,
        processIds: processIds.join(','),
        type: 'instant'
      });

      window.open(`/reports/generate?${params}`, '_blank');
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            {ICONS.REPORTS} Relatórios
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setScheduleDialogOpen(true)}>
            {ICONS.CALENDAR} Agendar Relatório Automático
          </DropdownMenuItem>

          <DropdownMenuItem onClick={handleGenerateInstantReport}>
            {ICONS.ROCKET} Gerar Relatório Agora
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => console.log('Ver agendamentos')}>
            {ICONS.TIME} Ver Agendamentos
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ReportScheduleDialog
        clientId={clientId}
        clientName={clientName}
        availableProcesses={processes}
        onSchedule={handleScheduleReport}
        trigger={
          <div style={{ display: 'none' }} onClick={() => setScheduleDialogOpen(true)} />
        }
      />

      {scheduleDialogOpen && (
        <ReportScheduleDialog
          clientId={clientId}
          clientName={clientName}
          availableProcesses={processes}
          onSchedule={handleScheduleReport}
          trigger={null}
        />
      )}
    </>
  );
}