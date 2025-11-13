'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ICONS, UI_TEXT } from '@/lib/icons';

interface Process {
  id: string;
  number: string;
  title: string;
  court: string;
  phase: string;
  value?: number;
  status: 'complete' | 'partial' | 'attention';
  lastUpdate: string;
  nextDeadline?: string;
  urgentActions?: number;
  clientName: string;
}

interface ProcessListProps {
  clientId?: string;
  clientName?: string;
}

// Constants for sorting - moved outside component to avoid TDZ issues
const STATUS_ORDER = { attention: 0, partial: 1, complete: 2 } as const;

export function ProcessList({ clientId, clientName }: ProcessListProps) {
  const [processes, setProcesses] = useState<Process[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'complete' | 'partial' | 'attention'>('all');

  useEffect(() => {
    if (clientId) {
      loadProcesses();
    } else {
      setProcesses([]);
    }
  }, [clientId]);

  const loadProcesses = async () => {
    if (!clientId) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/processes?clientId=${clientId}`);
      if (response.ok) {
        const data = await response.json();
        setProcesses(data.processes || []);
      }
    } catch (error) {
      console.error('Erro ao carregar processos:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: Process['status']) => {
    switch (status) {
      case 'complete':
        return <span className="text-green-600" title="Análise completa">{ICONS.SUCCESS}</span>;
      case 'partial':
        return <span className="text-yellow-600" title="Monitorando - falta análise">{ICONS.WARNING}</span>;
      case 'attention':
        return <span className="text-red-600" title="Atenção necessária">{ICONS.ERROR}</span>;
      default:
        return <span className="text-gray-400">{ICONS.CIRCLE_EMPTY}</span>;
    }
  };

  const getStatusText = (status: Process['status']) => {
    switch (status) {
      case 'complete':
        return UI_TEXT.PROCESS_COMPLETE;
      case 'partial':
        return UI_TEXT.PROCESS_PARTIAL;
      case 'attention':
        return UI_TEXT.PROCESS_ATTENTION;
      default:
        return 'Status desconhecido';
    }
  };

  const filteredProcesses = processes
    .filter(process => {
      if (filter !== 'all' && process.status !== filter) return false;
      if (!searchTerm) return true;

      const searchLower = searchTerm.toLowerCase();
      return (
        process.number.toLowerCase().includes(searchLower) ||
        process.title.toLowerCase().includes(searchLower) ||
        process.court.toLowerCase().includes(searchLower) ||
        process.phase.toLowerCase().includes(searchLower)
      );
    })
    .sort((a, b) => {
      // Ordenar por prioridade: attention > partial > complete
      if (a.status !== b.status) {
        return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      }
      // Depois por data de atualização (mais recente primeiro)
      return new Date(b.lastUpdate).getTime() - new Date(a.lastUpdate).getTime();
    });

  const statusCounts = {
    all: processes.length,
    complete: processes.filter(p => p.status === 'complete').length,
    partial: processes.filter(p => p.status === 'partial').length,
    attention: processes.filter(p => p.status === 'attention').length,
  };

  if (!clientId) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center text-muted-foreground">
            <span className="text-4xl mb-4 block">{ICONS.CLIENT}</span>
            <h3 className="text-lg font-medium mb-2">Selecione um Cliente</h3>
            <p className="text-sm">Escolha um cliente na barra lateral para ver seus processos</p>
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
            {ICONS.PROCESS} Processos - {clientName}
          </CardTitle>
          <Button variant="outline" size="sm" onClick={loadProcesses}>
            {ICONS.SEARCH} Atualizar
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mt-4">
          <Input
            placeholder="Buscar por número, título, vara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1"
          />

          <div className="flex gap-2">
            {Object.entries(statusCounts).map(([key, count]) => {
              // Type guard to ensure key is a valid filter value
              const isValidFilter = (
                k: string
              ): k is 'all' | 'complete' | 'partial' | 'attention' => {
                return k === 'all' || k === 'complete' || k === 'partial' || k === 'attention';
              };

              if (!isValidFilter(key)) {
                return null;
              }

              return (
                <Button
                  key={key}
                  variant={filter === key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter(key)}
                >
                  {key === 'all' ? 'Todos' :
                   key === 'complete' ? ICONS.SUCCESS :
                   key === 'partial' ? ICONS.WARNING : ICONS.ERROR
                  } ({count})
                </Button>
              );
            })}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="p-4">
                <Skeleton className="h-4 w-1/3 mb-2" />
                <Skeleton className="h-5 w-3/4 mb-2" />
                <div className="flex gap-4">
                  <Skeleton className="h-3 w-1/4" />
                  <Skeleton className="h-3 w-1/4" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </Card>
            ))}
          </div>
        ) : filteredProcesses.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <span className="text-4xl mb-4 block">{ICONS.PROCESS}</span>
            <h3 className="text-lg font-medium mb-2">Nenhum processo encontrado</h3>
            <p className="text-sm">
              {searchTerm || filter !== 'all' ?
                'Tente ajustar os filtros de busca' :
                'Este cliente ainda não possui processos cadastrados'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredProcesses.map((process) => (
              <Card key={process.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(process.status)}
                      <div>
                        <h3 className="font-medium text-sm text-blue-600">
                          {process.number}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {getStatusText(process.status)}
                        </p>
                      </div>
                    </div>

                    {process.urgentActions && process.urgentActions > 0 && (
                      <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">
                        {process.urgentActions} ação{process.urgentActions > 1 ? 'ões' : ''}
                      </span>
                    )}
                  </div>

                  <h4 className="font-medium mb-2 line-clamp-2">
                    {process.title}
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
                    <div>
                      <span className="font-medium">Vara:</span> {process.court}
                    </div>
                    <div>
                      <span className="font-medium">Fase:</span> {process.phase}
                    </div>
                    <div>
                      <span className="font-medium">Valor:</span>{' '}
                      {process.value
                        ? `R$ ${process.value.toLocaleString('pt-BR')}`
                        : 'Não informado'
                      }
                    </div>
                  </div>

                  <div className="flex justify-between items-center mt-3 pt-3 border-t">
                    <div className="text-xs text-muted-foreground">
                      Atualização: {new Date(process.lastUpdate).toLocaleDateString('pt-BR')}
                      {process.nextDeadline && (
                        <span className="ml-2">
                          {ICONS.TIME} Próximo prazo: {new Date(process.nextDeadline).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.location.href = `/dashboard/process/${process.id}`}
                    >
                      Ver Detalhes
                    </Button>
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