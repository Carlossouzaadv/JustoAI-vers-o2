'use client';

import { useState, useEffect , useCallback} from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ICONS } from '@/lib/icons';
import { EnrichedTimelineEvent, EnrichedTimelineEventProps } from '@/components/timeline/EnrichedTimelineEvent';

interface TimelineEvent extends EnrichedTimelineEventProps {
  // Extensão com campos adicionais se necessário
  metadata?: unknown;
}

// Type Guard: Valida se um objeto é TimelineStats
function isTimelineStats(data: unknown): data is { totalEntries: number; avgConfidence: number } {
  return (
    typeof data === 'object' &&
    data !== null &&
    'totalEntries' in data &&
    typeof (data as { totalEntries: unknown }).totalEntries === 'number' &&
    'avgConfidence' in data &&
    typeof (data as { avgConfidence: unknown }).avgConfidence === 'number'
  );
}

// Type Guard: Valida se um array é do tipo linkedDocuments
function isLinkedDocumentsArray(
  data: unknown
): data is { id: string; name: string; url?: string }[] {
  return (
    Array.isArray(data) &&
    data.every(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        'id' in item &&
        typeof (item as { id: unknown }).id === 'string' &&
        'name' in item &&
        typeof (item as { name: unknown }).name === 'string'
    )
  );
}

// Helper: Extrai linkedDocuments de metadata de forma segura
function getLinkedDocuments(
  metadata: unknown
): { id: string; name: string; url?: string }[] | undefined {
  if (
    typeof metadata === 'object' &&
    metadata !== null &&
    'linkedDocuments' in metadata
  ) {
    const linkedDocuments = (metadata as { linkedDocuments: unknown }).linkedDocuments;
    if (isLinkedDocumentsArray(linkedDocuments)) {
      return linkedDocuments;
    }
  }
  return undefined;
}

interface ProcessTimelineProps {
  processId: string;
  caseId?: string; // Novo: para usar a API unificada
}

export function ProcessTimeline({ processId, caseId }: ProcessTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'enriched' | 'conflicts' | 'judit'>('all');
  const [stats, setStats] = useState<unknown>(null);

  const loadTimelineEvents = useCallback(async () => {
    try {
      setLoading(true);

      // Usar unified-timeline API se caseId disponível, senão fallback para eventos antigos
      const apiUrl = caseId
        ? `/api/cases/${caseId}/unified-timeline`
        : `/api/cases/${processId}/events`;

      const response = await fetch(apiUrl, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();

        if (data.timeline) {
          // Nova API unificada (com enriquecimento)
          setEvents(data.timeline);
          setStats(data.stats);
        } else if (data.events) {
          // API legada
          setEvents(data.events);
        } else {
          setEvents([]);
        }
      } else {
        console.warn('Erro ao carregar timeline:', response.status);
        setEvents([]);
      }
    } catch (_error) {
      console.error('Erro ao carregar timeline:', error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [processId, caseId]);

  useEffect(() => {
    loadTimelineEvents();
  }, [processId, caseId, loadTimelineEvents]);

  const filteredEvents = events.filter(event => {
    if (filter === 'all') return true;
    if (filter === 'enriched') return event.isEnriched === true;
    if (filter === 'conflicts') return event.hasConflict === true;
    if (filter === 'judit') return event.source === 'API_JUDIT';
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

  const countEnriched = events.filter(e => e.isEnriched).length;
  const countConflicts = events.filter(e => e.hasConflict).length;
  const countJudit = events.filter(e => e.source === 'API_JUDIT').length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <CardTitle className="flex items-center gap-2">
            {ICONS.TIME} Timeline Unificada
          </CardTitle>

          <div className="flex gap-2 flex-wrap">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              Todos ({events.length})
            </Button>
            <Button
              variant={filter === 'judit' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('judit')}
            >
              JUDIT ({countJudit})
            </Button>
            <Button
              variant={filter === 'enriched' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('enriched')}
            >
              ✨ Enriquecidos ({countEnriched})
            </Button>
            {countConflicts > 0 && (
              <Button
                variant={filter === 'conflicts' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('conflicts')}
                className="border-orange-200"
              >
                ⚠️ Conflitos ({countConflicts})
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {filteredEvents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <span className="text-4xl mb-4 block">{ICONS.TIME}</span>
            <h3 className="text-lg font-medium mb-2">Sem eventos para exibir</h3>
            <p className="text-sm">
              {filter === 'all'
                ? 'Nenhum evento encontrado para este caso'
                : `Nenhum evento ${filter === 'enriched' ? 'enriquecido' : filter === 'conflicts' ? 'com conflito' : 'JUDIT'} encontrado`
              }
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredEvents.map((event) => (
              <EnrichedTimelineEvent
                key={event.id}
                {...event}
                eventDate={event.eventDate}
                description={event.description}
                linkedDocuments={getLinkedDocuments(event.metadata)}
              />
            ))}
          </div>
        )}

        {isTimelineStats(stats) && (
          <div className="mt-6 pt-4 border-t">
            <div className="text-xs text-muted-foreground space-y-1">
              <p>
                {ICONS.INFO} Timeline unificada com inteligência:
                <strong> {stats.totalEntries} eventos</strong>,
                <strong> {countEnriched} enriquecidos por IA</strong>,
                <strong> {countConflicts} conflitos detectados</strong>
              </p>
              <p>
                Confiança média: <strong>{(stats.avgConfidence * 100).toFixed(0)}%</strong>
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}