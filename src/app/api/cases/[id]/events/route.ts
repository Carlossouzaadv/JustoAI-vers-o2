import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ICONS } from '@/lib/icons';

/**
 * Type guards: Safe narrowing para dados desconhecidos
 * Padrão-Ouro: Mandato Inegociável (ZERO 'as')
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isJuditStep(value: unknown): value is { step_id?: string; step_date?: string; content?: string; step_type?: string; private?: boolean } {
  if (!isRecord(value)) return false;
  // Padrão-Ouro: Use 'in' operator para safe narrowing (ZERO 'as')
  return ('step_date' in value || 'step_id' in value || 'content' in value);
}

// Note: isTimelineMovement is currently unused but may be needed in future
// function isTimelineMovement(value: unknown): value is { date?: string; description?: string } {
//   if (!isRecord(value)) return false;
//   // Padrão-Ouro: Use 'in' operator para safe narrowing (ZERO 'as')
//   return ('date' in value || 'description' in value);
// }

/**
 * Helpers: Extração segura de valores de objetos desconhecidos
 * Padrão-Ouro: Sem casting, apenas narrowing
 */
function getStringField(obj: Record<string, unknown>, field: string): string | undefined {
  const value = obj[field];
  return typeof value === 'string' ? value : undefined;
}

function validateTimelineSource(source: unknown): TimelineEvent['source'] {
  // Padrão-Ouro: Safe narrowing (ZERO 'as')
  if (
    typeof source === 'string' &&
    (source === 'api_monitoring' ||
     source === 'pdf_analysis' ||
     source === 'csv_import' ||
     source === 'manual' ||
     source === 'lawyer_note')
  ) {
    return source;
  }
  return 'pdf_analysis'; // fallback seguro
}


/**
 * GET /api/cases/[id]/events
 *
 * Retorna eventos de timeline para um case
 * Combina dados de múltiplas fontes:
 * 1. ProcessTimelineEntry (timeline unificada)
 * 2. dadosCompletos.steps do Processo JUDIT (andamentos)
 * 3. CaseDocument (documentos carregados)
 *
 * Formato esperado pelo frontend:
 * {
 *   events: [
 *     {
 *       id: string,
 *       date: string (ISO),
 *       title: string,
 *       description?: string,
 *       type: 'document' | 'hearing' | 'deadline' | 'decision' | 'note' | 'import',
 *       source: 'api_monitoring' | 'pdf_analysis' | 'csv_import' | 'manual' | 'lawyer_note',
 *       attachments?: Array<{ id, name, type, size }>,
 *       metadata?: object
 *     }
 *   ]
 * }
 */

interface TimelineEvent {
  id: string;
  date: string;
  title: string;
  description?: string;
  type: 'document' | 'hearing' | 'deadline' | 'decision' | 'note' | 'import';
  source: 'api_monitoring' | 'pdf_analysis' | 'csv_import' | 'manual' | 'lawyer_note';
  attachments?: Array<{
    id: string;
    name: string;
    type: string;
    size: number;
  }>;
  metadata?: Record<string, unknown>;
}

/**
 * Interface para ProcessTimelineEntry (Prisma type)
 * Padrão-Ouro: Anotação explícita em callbacks .map()
 */
interface ProcessTimelineEntryType {
  id: string;
  eventDate: Date;
  eventType: string;
  description: string | null;
  source: string;
  confidence: number | null;
  sourceId: string | null;
  metadata: unknown;
}

/**
 * Interface para CaseDocument (Prisma type)
 * Padrão-Ouro: Anotação explícita em callbacks .map()
 */
interface CaseDocumentType {
  id: string;
  createdAt: Date;
  originalName: string;
  name: string | null;
  mimeType: string;
  size: number;
  type: string | null;
  pages: number | null;
  extractedText: string | null;
  sourceOrigin: string | null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const caseId = id;

    console.log(`${ICONS.TIME} Buscando eventos de timeline para case: ${caseId}`);

    // Buscar o case com relacionamentos necessários
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        timelineEntries: {
          orderBy: { eventDate: 'desc' },
        },
        documents: {
          orderBy: { createdAt: 'desc' },
        },
        processo: true,
      },
    });

    if (!caseData) {
      return NextResponse.json(
        { error: 'Case não encontrado' },
        { status: 404 }
      );
    }

    const events: TimelineEvent[] = [];

    // ================================================================
    // FONTE 1: ProcessTimelineEntry (timeline unificada)
    // ================================================================
    if (caseData.timelineEntries && caseData.timelineEntries.length > 0) {
      const timelineEvents = caseData.timelineEntries.map((entry: ProcessTimelineEntryType) => {
        // Padrão-Ouro: Safe narrowing para entry.metadata
        const entryMetadata = isRecord(entry.metadata) ? entry.metadata : {};

        return {
          id: entry.id,
          date: entry.eventDate.toISOString(),
          title: entry.eventType,
          description: entry.description ?? undefined,
          type: mapEventType(entry.eventType),
          source: mapTimelineSource(entry.source),
          metadata: {
            confidence: entry.confidence,
            sourceId: entry.sourceId,
            ...entryMetadata,
          },
        };
      });

      events.push(...timelineEvents);
    }

    // ================================================================
    // FONTE 2: dadosCompletos.steps do Processo JUDIT (andamentos)
    // ================================================================
    if (
      caseData.processo &&
      caseData.processo.dadosCompletos &&
      typeof caseData.processo.dadosCompletos === 'object'
    ) {
      // Padrão-Ouro: Safe narrowing (ZERO 'as')
      const dadosCompletos = caseData.processo.dadosCompletos;
      if (isRecord(dadosCompletos) && dadosCompletos.steps && Array.isArray(dadosCompletos.steps)) {
        const juditEvents = dadosCompletos.steps
          .filter(isJuditStep) // Type guard filtra apenas objetos válidos
          .map((step, index: number) => {
            // Agora step é garantidamente { step_id?, step_date?, ... }
            const stepDate = getStringField(step, 'step_date');
            const stepId = getStringField(step, 'step_id');
            const content = getStringField(step, 'content');
            const stepType = getStringField(step, 'step_type');
            const isPrivate = step['private'];

            return {
              id: `judit-step-${stepId || index}`,
              date: stepDate ? new Date(stepDate).toISOString() : new Date().toISOString(),
              title: 'Andamento Processual',
              description: content,
              type: 'decision' as const,
              source: 'api_monitoring' as const,
              metadata: {
                stepId,
                stepType,
                private: typeof isPrivate === 'boolean' ? isPrivate : undefined,
                source: 'JUDIT API',
              },
            };
          });

        events.push(...juditEvents);
      }
    }

    // ================================================================
    // FONTE 3: CaseDocument (documentos carregados)
    // ================================================================
    if (caseData.documents && caseData.documents.length > 0) {
      const documentEvents = caseData.documents.map((doc: CaseDocumentType) => {
        // IMPORTANTE: Procurar data real do andamento/movimento
        let realEventDate = doc.createdAt; // fallback para createdAt

        // Tentar recuperar data do previewSnapshot.lastMovements (PDF inicial)
        if (caseData.previewSnapshot && typeof caseData.previewSnapshot === 'object') {
          // Padrão-Ouro: Safe narrowing (ZERO 'as')
          const preview = caseData.previewSnapshot;
          if (isRecord(preview) && preview.lastMovements && Array.isArray(preview.lastMovements)) {
            // Procurar movimento que corresponde ao documento
            const matchedMovement = preview.lastMovements.find(
              (m: unknown): m is Record<string, unknown> => {
                if (!isRecord(m)) return false;
                const desc = getStringField(m, 'description');
                return !!(
                  desc?.toLowerCase().includes(doc.originalName?.toLowerCase() || '') ||
                  desc?.toLowerCase().includes(doc.name?.toLowerCase() || '')
                );
              }
            );

            if (matchedMovement && isRecord(matchedMovement)) {
              // Padrão-Ouro: Safe narrowing com typeof (após isRecord check)
              const dateValue = matchedMovement['date'];
              if (typeof dateValue === 'string') {
                try {
                  realEventDate = new Date(dateValue);
                } catch {
                  // Manter date original se não conseguir parsear
                }
              }
            }
          }
        }

        // Se não encontrou no preview, tentar recuperar dos dados JUDIT
        if (realEventDate === doc.createdAt && caseData.processo?.dadosCompletos) {
          const dadosCompletos = caseData.processo.dadosCompletos;
          if (isRecord(dadosCompletos) && dadosCompletos.steps && Array.isArray(dadosCompletos.steps)) {
            // Procurar step que corresponde ao documento
            const matchedStep = dadosCompletos.steps.find(
              (s: unknown): s is Record<string, unknown> => {
                if (!isRecord(s)) return false;
                const content = getStringField(s, 'content');
                return !!(
                  content?.toLowerCase().includes(doc.originalName?.toLowerCase() || '') ||
                  content?.toLowerCase().includes(doc.name?.toLowerCase() || '')
                );
              }
            );

            if (matchedStep && isRecord(matchedStep)) {
              // Padrão-Ouro: Safe narrowing com typeof (após isRecord check)
              const stepDateValue = matchedStep['step_date'];
              if (typeof stepDateValue === 'string') {
                try {
                  realEventDate = new Date(stepDateValue);
                } catch {
                  // Manter date original se não conseguir parsear
                }
              }
            }
          }
        }

        // Padrão-Ouro: Validar source com type guard
        const documentSource = validateTimelineSource(
          doc.sourceOrigin === 'JUDIT_IMPORT' ? 'api_monitoring' : 'pdf_analysis'
        );

        return {
          id: doc.id,
          date: realEventDate.toISOString(),
          title: 'Documento',
          description: doc.originalName,
          type: 'document' as const,
          source: documentSource,
          attachments: [
            {
              id: doc.id,
              name: doc.originalName,
              type: doc.mimeType,
              size: doc.size,
            },
          ],
          metadata: {
            documentType: doc.type,
            pages: doc.pages,
            hasExtractedText: !!doc.extractedText,
            sourceOrigin: doc.sourceOrigin,
          },
        };
      });

      events.push(...documentEvents);
    }

    // ================================================================
    // ORDENAR POR DATA (mais recente primeiro)
    // ================================================================
    events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    console.log(`${ICONS.SUCCESS} Timeline carregada com ${events.length} eventos para case: ${caseId}`);

    return NextResponse.json({
      success: true,
      events,
      count: events.length,
      case: {
        id: caseData.id,
        number: caseData.number,
        title: caseData.title,
        status: caseData.status,
      },
    });
  } catch (_error) {
    console.error(`${ICONS.ERROR} Erro ao buscar timeline:`, error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Erro ao buscar timeline',
      },
      { status: 500 }
    );
  }
}

/**
 * Mapeia tipo de evento JUDIT para tipo de frontend
 */
function mapEventType(
  eventType: string
): 'document' | 'hearing' | 'deadline' | 'decision' | 'note' | 'import' {
  const lowerType = eventType.toLowerCase();

  if (
    lowerType.includes('audiência') ||
    lowerType.includes('hearing') ||
    lowerType.includes('sessão')
  ) {
    return 'hearing';
  }

  if (
    lowerType.includes('prazo') ||
    lowerType.includes('deadline') ||
    lowerType.includes('vencimento')
  ) {
    return 'deadline';
  }

  if (
    lowerType.includes('sentença') ||
    lowerType.includes('decisão') ||
    lowerType.includes('julgamento') ||
    lowerType.includes('despacho')
  ) {
    return 'decision';
  }

  if (
    lowerType.includes('documento') ||
    lowerType.includes('juntada') ||
    lowerType.includes('anexo') ||
    lowerType.includes('petição')
  ) {
    return 'document';
  }

  return 'note';
}

/**
 * Mapeia fonte da timeline (enum TimelineSource) para tipo de frontend
 * TimelineSource enum values: DOCUMENT_UPLOAD, API_JUDIT, MANUAL_ENTRY, SYSTEM_IMPORT, AI_EXTRACTION
 */
function mapTimelineSource(
  source: string
): 'api_monitoring' | 'pdf_analysis' | 'csv_import' | 'manual' | 'lawyer_note' {
  const sourceUpper = source.toUpperCase();

  // API_JUDIT → api_monitoring (monitoramento via API)
  if (sourceUpper === 'API_JUDIT') {
    return 'api_monitoring';
  }

  // DOCUMENT_UPLOAD, AI_EXTRACTION → pdf_analysis (análise de PDF)
  if (sourceUpper === 'DOCUMENT_UPLOAD' || sourceUpper === 'AI_EXTRACTION') {
    return 'pdf_analysis';
  }

  // SYSTEM_IMPORT → csv_import (importação de sistema)
  if (sourceUpper === 'SYSTEM_IMPORT') {
    return 'csv_import';
  }

  // MANUAL_ENTRY → manual (entrada manual)
  if (sourceUpper === 'MANUAL_ENTRY') {
    return 'manual';
  }

  // Default
  return 'manual';
}
