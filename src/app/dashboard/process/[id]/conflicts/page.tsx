'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ICONS } from '@/lib/icons';
import {
  getSourceLabel,
  getSourceBadgeVariant,
  getSourceIcon,
} from '@/lib/utils/timelineSourceUtils';
import { TimelineSource } from '@/lib/types/database';
import { AlertTriangle, CheckCircle, Copy, Merge, X } from 'lucide-react';

interface TimelineEvent {
  id: string;
  eventDate: Date | string;
  eventType: string;
  description: string;
  source: string;
  isEnriched?: boolean;
  enrichedAt?: Date | string;
  enrichmentModel?: string;
  contributingSources?: string[];
  originalTexts?: Record<string, string>;
  linkedDocumentIds?: string[];
  hasConflict?: boolean;
  conflictDetails?: {
    type: 'DATE_MISMATCH' | 'TYPE_MISMATCH' | 'DESCRIPTION_CONTRADICTION';
    severity: 'low' | 'medium' | 'high';
    message: string;
    sources?: {
      source1: TimelineSource;
      source2: TimelineSource;
      value1: string | Date;
      value2: string | Date;
    };
  };
  relationType?: string;
  baseEventId?: string;
}

interface ConflictResolution {
  eventId: string;
  resolution: 'keep_judit' | 'use_document' | 'merge' | 'keep_both';
  mergedDescription?: string;
}

export default function TimelineConflictsPage() {
  const params = useParams();
  const router = useRouter();
  const caseId = params.id as string;

  const [conflicts, setConflicts] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [resolutions, setResolutions] = useState<ConflictResolution[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  useEffect(() => {
    if (caseId) {
      loadConflicts();
    }
  }, [caseId]);

  const loadConflicts = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/cases/${caseId}/unified-timeline`, {
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Erro ao carregar timeline');

      const data = await response.json();
      const conflictEvents = (data.timeline || []).filter(
        (e: TimelineEvent) => e.hasConflict === true
      );

      setConflicts(conflictEvents);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar conflitos');
      console.error('Erro ao carregar conflitos:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResolution = (
    eventId: string,
    resolution: ConflictResolution['resolution'],
    mergedDescription?: string
  ) => {
    setResolutions((prev) => {
      const existing = prev.findIndex((r) => r.eventId === eventId);
      const newResolution: ConflictResolution = {
        eventId,
        resolution,
        mergedDescription,
      };

      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = newResolution;
        return updated;
      }
      return [...prev, newResolution];
    });

    setEditingId(null);
    setEditingText('');
  };

  const saveResolutions = async () => {
    try {
      setSaving(true);

      const response = await fetch(
        `/api/cases/${caseId}/timeline/conflicts/resolve`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resolutions }),
        }
      );

      if (!response.ok) throw new Error('Erro ao salvar resoluções');

      alert('Conflitos resolvidos com sucesso!');
      router.push(`/dashboard/process/${caseId}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const getResolution = (eventId: string) =>
    resolutions.find((r) => r.eventId === eventId);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-1/3" />
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-2/3" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            {ICONS.WARNING} Revisão de Conflitos
          </h1>
          <p className="text-muted-foreground mt-1">
            {conflicts.length} conflito(s) detectado(s) na timeline
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => router.push(`/dashboard/process/${caseId}`)}
        >
          Voltar para Timeline
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Erro ao carregar</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {conflicts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
            <h3 className="text-lg font-medium mb-2">Sem conflitos!</h3>
            <p className="text-muted-foreground text-center mb-4">
              Nenhum conflito foi detectado na timeline deste caso.
            </p>
            <Button onClick={() => router.push(`/dashboard/process/${caseId}`)}>
              Voltar para Timeline
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Conflicts List */}
          <div className="space-y-4">
            {conflicts.map((conflict, idx) => {
              const resolution = getResolution(conflict.id);
              const isEditing = editingId === conflict.id;

              return (
                <Card key={conflict.id} className="border-orange-200">
                  <CardHeader className="bg-orange-50">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-orange-600" />
                          Conflito {idx + 1}: {conflict.eventType}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground mt-2">
                          {conflict.conflictDetails?.message}
                        </p>
                      </div>
                      {resolution && (
                        <Badge
                          variant="outline"
                          className="text-green-600 border-green-300 bg-green-50"
                        >
                          ✓ Resolvido
                        </Badge>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="pt-6">
                    {/* Detalhes do Conflito */}
                    <div className="mb-6 p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm font-semibold mb-3">
                        Discrepâncias Detectadas:
                      </p>
                      {conflict.conflictDetails?.sources && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">
                              {getSourceLabel(conflict.conflictDetails.sources.source1)}
                            </p>
                            <p className="text-sm bg-white p-2 rounded border">
                              {String(conflict.conflictDetails.sources.value1)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">
                              {getSourceLabel(conflict.conflictDetails.sources.source2)}
                            </p>
                            <p className="text-sm bg-white p-2 rounded border">
                              {String(conflict.conflictDetails.sources.value2)}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Current Description */}
                    <div className="mb-6">
                      <p className="text-sm font-semibold mb-2">Descrição Atual:</p>
                      <p className="text-sm p-3 bg-muted rounded">
                        {conflict.description}
                      </p>
                    </div>

                    {/* Resolution Options */}
                    {!resolution ? (
                      <div className="space-y-3">
                        <p className="text-sm font-semibold">
                          Como você deseja resolver?
                        </p>

                        {/* Option 1: Keep JUDIT */}
                        <Button
                          variant="outline"
                          className="w-full justify-start h-auto py-3 text-left"
                          onClick={() => handleResolution(conflict.id, 'keep_judit')}
                        >
                          <div className="flex items-start gap-3 w-full">
                            <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="font-semibold text-sm">
                                Manter JUDIT (Oficial)
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Descarta o evento conflitante e mantém a versão oficial
                              </p>
                            </div>
                          </div>
                        </Button>

                        {/* Option 2: Use Document */}
                        <Button
                          variant="outline"
                          className="w-full justify-start h-auto py-3 text-left"
                          onClick={() =>
                            handleResolution(conflict.id, 'use_document')
                          }
                        >
                          <div className="flex items-start gap-3 w-full">
                            <Copy className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="font-semibold text-sm">
                                Usar Documento
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Substitui o evento JUDIT pela versão do documento
                              </p>
                            </div>
                          </div>
                        </Button>

                        {/* Option 3: Merge Manually */}
                        <Button
                          variant="outline"
                          className="w-full justify-start h-auto py-3 text-left"
                          onClick={() => {
                            setEditingId(conflict.id);
                            setEditingText(conflict.description);
                          }}
                        >
                          <div className="flex items-start gap-3 w-full">
                            <Merge className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="font-semibold text-sm">
                                Mesclar Manualmente
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Edite a descrição combinando as melhores informações
                              </p>
                            </div>
                          </div>
                        </Button>

                        {/* Option 4: Keep Both */}
                        <Button
                          variant="outline"
                          className="w-full justify-start h-auto py-3 text-left"
                          onClick={() =>
                            handleResolution(conflict.id, 'keep_both')
                          }
                        >
                          <div className="flex items-start gap-3 w-full">
                            <Copy className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="font-semibold text-sm">
                                Manter Ambos
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Cria um evento separado e marca como relacionado
                              </p>
                            </div>
                          </div>
                        </Button>
                      </div>
                    ) : (
                      <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-sm text-green-900">
                              Resolução: {resolution.resolution}
                            </p>
                            {resolution.mergedDescription && (
                              <p className="text-xs text-green-800 mt-1">
                                {resolution.mergedDescription}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setResolutions((prev) =>
                              prev.filter((r) => r.eventId !== conflict.id)
                            )}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Merge Editor */}
                    {isEditing && (
                      <div className="mt-4 p-4 bg-muted/50 rounded-lg border-2 border-blue-300">
                        <p className="text-sm font-semibold mb-2">
                          Edite a descrição combinada:
                        </p>
                        <textarea
                          className="w-full min-h-24 p-2 text-sm border rounded bg-white mb-3 font-mono"
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          placeholder="Digite a descrição mesclada..."
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() =>
                              handleResolution(conflict.id, 'merge', editingText)
                            }
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Confirmar Mesclagem
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingId(null)}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Save Button */}
          {resolutions.length > 0 && (
            <div className="fixed bottom-6 right-6 flex gap-2">
              <Button
                variant="outline"
                onClick={() => router.push(`/dashboard/process/${caseId}`)}
              >
                Cancelar
              </Button>
              <Button
                onClick={saveResolutions}
                disabled={saving || resolutions.length !== conflicts.length}
              >
                {saving ? 'Salvando...' : `Salvar ${resolutions.length}/${conflicts.length}`}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
