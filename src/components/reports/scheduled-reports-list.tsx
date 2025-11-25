'use client';

import { useState, useEffect , useCallback} from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ICONS } from '@/lib/icons';

interface ScheduledReport {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  processIds: string[];
  frequency: 'weekly' | 'biweekly' | 'monthly';
  reportType: 'complete' | 'updates';
  deliveryMethod: 'email' | 'whatsapp';
  deliveryTime: string;
  recipientEmail?: string;
  recipientPhone?: string;
  isActive: boolean;
  estimatedCost: {
    monthly: number;
    perReport: number;
    tokensEstimate: number;
  };
  createdAt: string;
  updatedAt: string;
  nextExecution: string;
  lastExecution?: string;
  executionCount: number;
}

interface ScheduledReportsListProps {
  clientId?: string;
}

export function ScheduledReportsList({ clientId }: ScheduledReportsListProps) {
  const [schedules, setSchedules] = useState<ScheduledReport[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSchedules = useCallback(async () => {
    try {
      setLoading(true);
      const params = clientId ? `?clientId=${clientId}` : '';
      const response = await fetch(`/api/reports/schedule${params}`);

      if (response.ok) {
        const data = await response.json();
        setSchedules(data.schedules || []);
      }
    } catch (_error) {
      console.error('Erro ao carregar agendamentos:', error);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadSchedules();
  }, [clientId, loadSchedules]);

  const handleAction = async (scheduleId: string, action: string) => {
    try {
      const response = await fetch(`/api/reports/schedule/${scheduleId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });

      if (response.ok) {
        const result = await response.json();
        console.log(result.message);

        if (action === 'execute_now') {
          alert('Relatório sendo gerado...');
        } else {
          loadSchedules(); // Recarregar lista
        }
      }
    } catch (_error) {
      console.error('Erro na ação:', error);
    }
  };

  const handleDelete = async (scheduleId: string) => {
    if (!confirm('Tem certeza que deseja excluir este agendamento?')) return;

    try {
      const response = await fetch(`/api/reports/schedule/${scheduleId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setSchedules(prev => prev.filter(s => s.id !== scheduleId));
      }
    } catch (_error) {
      console.error('Erro ao excluir:', error);
    }
  };

  const getFrequencyLabel = (frequency: string) => {
    switch (frequency) {
      case 'weekly': return 'Semanal';
      case 'biweekly': return 'Quinzenal';
      case 'monthly': return 'Mensal';
      default: return frequency;
    }
  };

  const getReportTypeLabel = (type: string) => {
    switch (type) {
      case 'complete': return 'Completo';
      case 'updates': return 'Novidades';
      default: return type;
    }
  };

  const getStatusColor = (isActive: boolean, nextExecution: string) => {
    if (!isActive) return 'secondary';

    const next = new Date(nextExecution);
    const now = new Date();
    const hoursUntilNext = (next.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilNext < 24) return 'destructive'; // Próximo
    if (hoursUntilNext < 72) return 'default'; // Em breve
    return 'outline'; // Futuro
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-1/4" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {ICONS.CALENDAR} Relatórios Agendados ({schedules.length})
          </CardTitle>

          <Button onClick={loadSchedules} variant="outline" size="sm">
            {ICONS.SEARCH} Atualizar
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {schedules.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <span className="text-4xl mb-4 block">{ICONS.CALENDAR}</span>
            <h3 className="text-lg font-medium mb-2">Nenhum relatório agendado</h3>
            <p className="text-sm">
              {clientId
                ? 'Este cliente ainda não possui relatórios agendados'
                : 'Nenhum relatório foi agendado ainda'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {schedules.map((schedule) => (
              <Card key={schedule.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-medium text-sm">{schedule.name}</h3>
                        <Badge variant={getStatusColor(schedule.isActive, schedule.nextExecution)}>
                          {schedule.isActive ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </div>

                      <div className="space-y-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-4">
                          <span>{ICONS.CLIENT} {schedule.clientName}</span>
                          <span>{ICONS.TIME} {getFrequencyLabel(schedule.frequency)}</span>
                          <span>{ICONS.DOCUMENT} {getReportTypeLabel(schedule.reportType)}</span>
                        </div>

                        <div className="flex items-center gap-4">
                          <span>{ICONS.CALENDAR} Próx: {new Date(schedule.nextExecution).toLocaleString('pt-BR')}</span>
                          <span>{ICONS.MONEY} ${schedule.estimatedCost.monthly.toFixed(2)}/mês</span>
                          <span>📧 {schedule.deliveryTime}</span>
                        </div>

                        <div className="flex items-center gap-4">
                          <span>{schedule.processIds.length} processo(s)</span>
                          <span>{schedule.executionCount} execução(ões)</span>
                          {schedule.lastExecution && (
                            <span>Último: {new Date(schedule.lastExecution).toLocaleDateString('pt-BR')}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          {ICONS.EDIT} Ações
                        </Button>
                      </DropdownMenuTrigger>

                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleAction(schedule.id, 'execute_now')}>
                          {ICONS.ROCKET} Executar Agora
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onClick={() => handleAction(schedule.id, schedule.isActive ? 'pause' : 'resume')}
                        >
                          {schedule.isActive ? (
                            <>{ICONS.WARNING} Pausar</>
                          ) : (
                            <>{ICONS.SUCCESS} Retomar</>
                          )}
                        </DropdownMenuItem>

                        <DropdownMenuItem onClick={() => handleAction(schedule.id, 'test_delivery')}>
                          {ICONS.INFO} Testar Entrega
                        </DropdownMenuItem>

                        <DropdownMenuItem onClick={() => console.log('Editar', schedule.id)}>
                          {ICONS.EDIT} Editar
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onClick={() => handleDelete(schedule.id)}
                          className="text-red-600"
                        >
                          {ICONS.DELETE} Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}