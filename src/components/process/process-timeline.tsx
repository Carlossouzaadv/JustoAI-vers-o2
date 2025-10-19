'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ICONS } from '@/lib/icons';

interface TimelineEvent {
  id: string;
  date: string;
  title: string;
  description?: string;
  type: 'document' | 'hearing' | 'deadline' | 'decision' | 'note' | 'import';
  source: 'api_monitoring' | 'pdf_analysis' | 'csv_import' | 'manual' | 'lawyer_note';
  status?: 'pending' | 'completed' | 'cancelled';
  attachments?: Array<{
    id: string;
    name: string;
    type: string;
    size: number;
  }>;
  metadata?: {
    court?: string;
    judge?: string;
    movementCode?: string;
    originalText?: string;
  };
}

interface ProcessTimelineProps {
  processId: string;
}

export function ProcessTimeline({ processId }: ProcessTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'documents' | 'hearings' | 'notes'>('all');

  useEffect(() => {
    loadTimelineEvents();
  }, [processId]);

  const loadTimelineEvents = async () => {
    try {
      setLoading(true);

      // Timeline events will be fetched from API when endpoint is implemented
      const response = await fetch(`/api/cases/${processId}/events`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setEvents(data.events || []);
      } else {
        // No timeline events available yet - endpoint not implemented
        setEvents([]);
      }
    } catch (error) {
      console.error('Erro ao carregar timeline:', error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const getEventIcon = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'document': return ICONS.DOCUMENT;
      case 'hearing': return ICONS.CALENDAR;
      case 'deadline': return ICONS.TIME;
      case 'decision': return ICONS.PROCESS;
      case 'note': return ICONS.EDIT;
      case 'import': return ICONS.SAVE;
      default: return ICONS.INFO;
    }
  };

  const getSourceBadge = (source: TimelineEvent['source']) => {
    const sourceMap = {
      'api_monitoring': { label: 'Monitoramento', variant: 'default' as const },
      'pdf_analysis': { label: 'PDF Inicial', variant: 'secondary' as const },
      'csv_import': { label: 'Importação', variant: 'outline' as const },
      'manual': { label: 'Manual', variant: 'secondary' as const },
      'lawyer_note': { label: 'Advogado', variant: 'destructive' as const }
    };

    const config = sourceMap[source] || { label: 'Desconhecido', variant: 'outline' as const };
    return <Badge variant={config.variant} className="text-xs">{config.label}</Badge>;
  };

  const filteredEvents = events.filter(event => {
    if (filter === 'all') return true;
    if (filter === 'documents') return event.type === 'document';
    if (filter === 'hearings') return event.type === 'hearing';
    if (filter === 'notes') return event.type === 'note';
    return true;
  });

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-1/4" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
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
            {ICONS.TIME} Timeline do Processo
          </CardTitle>

          <div className="flex gap-2">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              Todos ({events.length})
            </Button>
            <Button
              variant={filter === 'documents' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('documents')}
            >
              Documentos ({events.filter(e => e.type === 'document').length})
            </Button>
            <Button
              variant={filter === 'hearings' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('hearings')}
            >
              Audiências ({events.filter(e => e.type === 'hearing').length})
            </Button>
            <Button
              variant={filter === 'notes' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('notes')}
            >
              Notas ({events.filter(e => e.type === 'note').length})
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {filteredEvents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <span className="text-4xl mb-4 block">{ICONS.TIME}</span>
            <h3 className="text-lg font-medium mb-2">Timeline vazia</h3>
            <p className="text-sm">
              {filter === 'all'
                ? 'Nenhum evento encontrado para este processo'
                : `Nenhum evento do tipo "${filter}" encontrado`
              }
            </p>
          </div>
        ) : (
          <div className="relative">
            {/* Linha vertical da timeline */}
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border"></div>

            <div className="space-y-6">
              {filteredEvents.map((event, index) => (
                <div key={event.id} className="relative flex gap-4">
                  {/* Ícone do evento */}
                  <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full border-2 bg-background">
                    <span className="text-lg">{getEventIcon(event.type)}</span>
                  </div>

                  {/* Conteúdo do evento */}
                  <div className="flex-1 min-w-0 pb-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-sm">{event.title}</h3>
                          {getSourceBadge(event.source)}
                          {event.status && (
                            <Badge
                              variant={
                                event.status === 'pending' ? 'secondary' :
                                event.status === 'completed' ? 'default' : 'destructive'
                              }
                              className="text-xs"
                            >
                              {event.status === 'pending' ? 'Pendente' :
                               event.status === 'completed' ? 'Concluído' : 'Cancelado'}
                            </Badge>
                          )}
                        </div>

                        <p className="text-xs text-muted-foreground mb-2">
                          {new Date(event.date).toLocaleString('pt-BR')}
                          {event.metadata?.court && (
                            <span className="ml-2">• {event.metadata.court}</span>
                          )}
                          {event.metadata?.judge && (
                            <span className="ml-2">• {event.metadata.judge}</span>
                          )}
                        </p>

                        {event.description && (
                          <p className="text-sm text-muted-foreground mb-3">
                            {event.description}
                          </p>
                        )}

                        {/* Anexos */}
                        {event.attachments && event.attachments.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs font-medium">Anexos:</p>
                            {event.attachments.map((attachment) => (
                              <div
                                key={attachment.id}
                                className="flex items-center gap-2 text-xs bg-muted p-2 rounded"
                              >
                                {ICONS.DOCUMENT}
                                <span>{attachment.name}</span>
                                <span className="text-muted-foreground">
                                  ({Math.round(attachment.size / 1024)} KB)
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Metadados adicionais */}
                        {event.metadata?.originalText && (
                          <details className="mt-2">
                            <summary className="text-xs cursor-pointer text-muted-foreground">
                              Ver texto original
                            </summary>
                            <p className="text-xs bg-muted p-2 rounded mt-1 font-mono">
                              {event.metadata.originalText}
                            </p>
                          </details>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            {ICONS.INFO} Timeline consolidada automaticamente de múltiplas fontes:
            monitoramento de APIs, análise de PDFs, importações CSV e anotações manuais.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}