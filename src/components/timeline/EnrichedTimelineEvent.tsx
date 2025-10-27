'use client';

import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ICONS } from '@/lib/icons';
import {
  getSourceIcon,
  getSourceLabel,
  getSourceBadgeVariant,
  getSourcePriority,
  isJuditSource,
} from '@/lib/utils/timelineSourceUtils';
import { TimelineSource } from '@prisma/client';
import { AlertTriangle, ExternalLink, Sparkles } from 'lucide-react';

export interface EnrichedTimelineEventProps {
  id: string;
  eventDate: Date | string;
  eventType?: string;
  description: string;
  source: TimelineSource;
  isEnriched?: boolean;
  enrichedAt?: Date | string;
  enrichmentModel?: string;
  contributingSources?: TimelineSource[];
  originalTexts?: Record<string, string>;
  linkedDocumentIds?: string[];
  linkedDocuments?: Array<{
    id: string;
    name: string;
    url?: string;
  }>;
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
  confidence?: number;
  relationType?: 'DUPLICATE' | 'ENRICHMENT' | 'RELATED' | 'CONFLICT';
  baseEventId?: string;
  onConflictReview?: (eventId: string) => void;
}

/**
 * Componente enriquecido que exibe um evento de timeline com:
 * - Badges de todas as fontes contribuintes
 * - Badge "Enriquecido por IA" quando aplicável
 * - Accordion com textos originais por fonte
 * - Links para documentos vinculados
 * - Alerta visual para conflitos
 */
export function EnrichedTimelineEvent({
  id,
  eventDate,
  eventType = 'Evento',
  description,
  source,
  isEnriched = false,
  enrichedAt,
  enrichmentModel,
  contributingSources = [],
  originalTexts = {},
  linkedDocumentIds = [],
  linkedDocuments = [],
  hasConflict = false,
  conflictDetails,
  confidence = 0.75,
  relationType,
  baseEventId,
  onConflictReview,
}: EnrichedTimelineEventProps) {
  const [showDetails, setShowDetails] = useState(false);

  // Ordenar fontes por prioridade
  const sortedSources = [...(contributingSources || [])].sort(
    (a, b) => (getSourcePriority(b) || 0) - (getSourcePriority(a) || 0)
  );

  // Fonte principal (JUDIT se disponível, senão a atual)
  const primarySource = sortedSources.find(s => isJuditSource(s)) || source;

  // Formatar data
  const formattedDate = new Date(eventDate).toLocaleString('pt-BR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Determinar ícone do tipo de evento
  const getEventTypeIcon = () => {
    const typeMap: Record<string, string> = {
      'Andamento': ICONS.PROCESS,
      'Despacho': ICONS.EDIT,
      'Sentença': ICONS.SUCCESS,
      'Audiência': ICONS.CALENDAR,
      'Juntada': ICONS.SAVE,
      'Petição': ICONS.DOCUMENT,
      'Recurso': ICONS.WARNING,
      'Finalização': ICONS.SUCCESS,
    };

    // Tentar encontrar correspondência exata ou parcial
    if (eventType) {
      for (const [key, icon] of Object.entries(typeMap)) {
        if (eventType.includes(key)) return icon;
      }
    }

    return ICONS.INFO;
  };

  return (
    <div className="space-y-3">
      {/* ================================================================
          ALERTA DE CONFLITO - Se houver conflito, mostrar destaque
          ================================================================ */}
      {hasConflict && conflictDetails && (
        <Alert variant="destructive" className="bg-red-50 border-red-300">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-sm mb-1">
                  {conflictDetails.type === 'DATE_MISMATCH' && '⚠️ Conflito de Data'}
                  {conflictDetails.type === 'TYPE_MISMATCH' && '⚠️ Conflito de Tipo'}
                  {conflictDetails.type === 'DESCRIPTION_CONTRADICTION' && '⚠️ Descrição Contradita'}
                </p>
                <p className="text-sm">{conflictDetails.message}</p>
                {conflictDetails.sources && (
                  <p className="text-xs mt-1 opacity-90">
                    {getSourceLabel(conflictDetails.sources.source1)} vs{' '}
                    {getSourceLabel(conflictDetails.sources.source2)}
                  </p>
                )}
              </div>
              {onConflictReview && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 border-red-300 hover:bg-red-50"
                  onClick={() => onConflictReview(id)}
                >
                  Revisar
                </Button>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* ================================================================
          CORPO PRINCIPAL DO EVENTO
          ================================================================ */}
      <div className="border rounded-lg p-4 bg-card hover:bg-accent/50 transition-colors">
        {/* Header com tipo, data e ícone */}
        <div className="flex items-start gap-3 mb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-sm">
            {getEventTypeIcon()}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap mb-1">
              <h3 className="font-medium text-sm">{eventType}</h3>
              <span className="text-xs text-muted-foreground">{formattedDate}</span>
            </div>

            {/* Descrição principal */}
            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
              {description}
            </p>

            {/* ============================================================
                BADGES DE FONTES E STATUS
                ============================================================ */}
            <div className="flex items-center gap-2 flex-wrap mb-3">
              {/* Badge de fonte principal (JUDIT ou outra) */}
              <Badge
                variant={getSourceBadgeVariant(primarySource) as any}
                className="text-xs"
              >
                <span className="mr-1">{getSourceIcon(primarySource)}</span>
                {getSourceLabel(primarySource)}
              </Badge>

              {/* Badge de enriquecimento por IA */}
              {isEnriched && (
                <Badge variant="default" className="text-xs bg-gradient-to-r from-purple-600 to-pink-600">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Enriquecido por IA
                </Badge>
              )}

              {/* Badges de fontes contribuintes (se houver múltiplas) */}
              {sortedSources.length > 1 && (
                <Badge variant="outline" className="text-xs">
                  +{sortedSources.length - 1} fonte(s)
                </Badge>
              )}

              {/* Badge de relação (se houver) */}
              {relationType && relationType !== 'DUPLICATE' && (
                <Badge variant="secondary" className="text-xs">
                  {relationType === 'ENRICHMENT' && '🔀 Enriquece'}
                  {relationType === 'RELATED' && '🔗 Relacionado'}
                  {relationType === 'CONFLICT' && '⚠️ Conflito'}
                </Badge>
              )}

              {/* Indicador de confiança */}
              {confidence < 1 && (
                <Badge variant="outline" className="text-xs">
                  {(confidence * 100).toFixed(0)}% confiança
                </Badge>
              )}
            </div>

            {/* ============================================================
                DETALHES EXPANSÍVEIS
                ============================================================ */}
            {(contributingSources && contributingSources.length > 1) ||
            linkedDocuments?.length > 0 ||
            Object.keys(originalTexts).length > 0 ? (
              <div className="space-y-2 mt-3">
                {/* Textos originais por fonte */}
                {Object.keys(originalTexts).length > 0 && (
                  <details className="group cursor-pointer">
                    <summary className="text-xs font-medium text-primary hover:text-primary/80 select-none py-1">
                      📝 Textos originais ({Object.keys(originalTexts).length})
                    </summary>
                    <div className="space-y-2 mt-2 pl-2 border-l-2 border-muted-foreground/20">
                      {Object.entries(originalTexts).map(([src, text]) => (
                        <div
                          key={src}
                          className="bg-muted/50 rounded p-2 border border-border/50"
                        >
                          <p className="text-xs font-semibold mb-1 flex items-center gap-1">
                            <span>{getSourceIcon(src as TimelineSource)}</span>
                            {getSourceLabel(src as TimelineSource)}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono whitespace-pre-wrap break-words max-h-24 overflow-y-auto">
                            {text}
                          </p>
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                {/* Documentos vinculados */}
                {linkedDocuments && linkedDocuments.length > 0 && (
                  <details className="group cursor-pointer">
                    <summary className="text-xs font-medium text-primary hover:text-primary/80 select-none py-1">
                      📎 Documentos vinculados ({linkedDocuments.length})
                    </summary>
                    <div className="space-y-2 mt-2 pl-2 border-l-2 border-muted-foreground/20">
                      {linkedDocuments.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between bg-muted/50 rounded p-2 border border-border/50"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-sm">{ICONS.DOCUMENT}</span>
                            <p className="text-xs font-medium truncate">{doc.name}</p>
                          </div>
                          {doc.url && (
                            <a
                              href={doc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:text-primary/80 ml-2"
                              title={`Abrir ${doc.name}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                {/* Informações técnicas */}
                {(isEnriched || baseEventId || relationType) && (
                  <details className="group cursor-pointer">
                    <summary className="text-xs font-medium text-primary hover:text-primary/80 select-none py-1">
                      ⚙️ Detalhes técnicos
                    </summary>
                    <div className="space-y-2 mt-2 pl-2 border-l-2 border-muted-foreground/20">
                      {isEnriched && (
                        <div className="text-xs bg-muted/50 rounded p-2">
                          <p className="font-semibold mb-1">Enriquecimento por IA:</p>
                          <p className="text-muted-foreground">
                            Modelo: <code className="text-xs bg-muted px-1 rounded">{enrichmentModel || 'gemini-1.5-flash'}</code>
                          </p>
                          {enrichedAt && (
                            <p className="text-muted-foreground">
                              Em: {new Date(enrichedAt).toLocaleString('pt-BR')}
                            </p>
                          )}
                        </div>
                      )}

                      {baseEventId && (
                        <div className="text-xs bg-muted/50 rounded p-2">
                          <p className="font-semibold mb-1">Evento Base:</p>
                          <p className="text-muted-foreground">
                            <code className="text-xs bg-muted px-1 rounded">{baseEventId}</code>
                          </p>
                        </div>
                      )}

                      {relationType && (
                        <div className="text-xs bg-muted/50 rounded p-2">
                          <p className="font-semibold mb-1">Tipo de Relação:</p>
                          <p className="text-muted-foreground capitalize">{relationType}</p>
                        </div>
                      )}

                      {confidence < 1 && (
                        <div className="text-xs bg-muted/50 rounded p-2">
                          <p className="font-semibold mb-1">Confiança:</p>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div
                              className="bg-primary rounded-full h-2 transition-all"
                              style={{ width: `${confidence * 100}%` }}
                            />
                          </div>
                          <p className="text-muted-foreground mt-1">
                            {(confidence * 100).toFixed(1)}%
                          </p>
                        </div>
                      )}
                    </div>
                  </details>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default EnrichedTimelineEvent;
