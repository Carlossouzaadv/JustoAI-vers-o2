'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ICONS } from '@/lib/icons';
import { getApiUrl } from '@/lib/api-client';

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
      const response = await fetch(getApiUrl(`/api/processes?clientId=${clientId}`));
      if (response.ok) {
        const data = await response.json();
        const processOptions: ProcessOption[] = (data.processes || []).map((process: unknown) => ({
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
  );
}