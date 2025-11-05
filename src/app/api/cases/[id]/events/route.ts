import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ICONS } from '@/lib/icons';

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
      const timelineEvents = caseData.timelineEntries.map((entry) => ({
        id: entry.id,
        date: entry.eventDate.toISOString(),
        title: entry.eventType,
        description: entry.description,
        type: mapEventType(entry.eventType),
        source: mapTimelineSource(entry.source),
        metadata: {
          confidence: entry.confidence,
          sourceId: entry.sourceId,
          ...(entry.metadata || {}),
        },
      }));

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
      const dadosCompletos = caseData.processo.dadosCompletos as unknown;

      if (dadosCompletos.steps && Array.isArray(dadosCompletos.steps)) {
        const juditEvents = dadosCompletos.steps.map((step: unknown, index: number) => ({
          id: `judit-step-${step.step_id || index}`,
          date: new Date(step.step_date).toISOString(),
          title: 'Andamento Processual',
          description: step.content,
          type: 'decision' as const,
          source: 'api_monitoring' as const,
          metadata: {
            stepId: step.step_id,
            stepType: step.step_type,
            private: step.private,
            source: 'JUDIT API',
          },
        }));

        events.push(...juditEvents);
      }
    }

    // ================================================================
    // FONTE 3: CaseDocument (documentos carregados)
    // ================================================================
    if (caseData.documents && caseData.documents.length > 0) {
      const documentEvents = caseData.documents.map((doc) => {
        // IMPORTANTE: Procurar data real do andamento/movimento
        let realEventDate = doc.createdAt; // fallback para createdAt

        // Tentar recuperar data do previewSnapshot.lastMovements (PDF inicial)
        if (caseData.previewSnapshot && typeof caseData.previewSnapshot === 'object') {
          const preview = caseData.previewSnapshot as unknown;
          if (preview.lastMovements && Array.isArray(preview.lastMovements)) {
            // Procurar movimento que corresponde ao documento
            const matchedMovement = preview.lastMovements.find(
              (m: unknown) =>
                m.description?.toLowerCase().includes(doc.originalName?.toLowerCase()) ||
                m.description?.toLowerCase().includes(doc.name?.toLowerCase())
            );

            if (matchedMovement && matchedMovement.date) {
              try {
                realEventDate = new Date(matchedMovement.date);
              } catch (e) {
                // Manter date original se não conseguir parsear
              }
            }
          }
        }

        // Se não encontrou no preview, tentar recuperar dos dados JUDIT
        if (realEventDate === doc.createdAt && caseData.processo?.dadosCompletos) {
          const dadosCompletos = caseData.processo.dadosCompletos as unknown;
          if (dadosCompletos.steps && Array.isArray(dadosCompletos.steps)) {
            // Procurar step que corresponde ao documento
            const matchedStep = dadosCompletos.steps.find(
              (s: unknown) =>
                s.content?.toLowerCase().includes(doc.originalName?.toLowerCase()) ||
                s.content?.toLowerCase().includes(doc.name?.toLowerCase())
            );

            if (matchedStep && matchedStep.step_date) {
              try {
                realEventDate = new Date(matchedStep.step_date);
              } catch (e) {
                // Manter date original se não conseguir parsear
              }
            }
          }
        }

        return {
          id: doc.id,
          date: realEventDate.toISOString(),
          title: 'Documento',
          description: doc.originalName,
          type: 'document' as const,
          source: doc.sourceOrigin === 'JUDIT_IMPORT' ? 'api_monitoring' : 'pdf_analysis' as const,
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
  } catch (error) {
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
