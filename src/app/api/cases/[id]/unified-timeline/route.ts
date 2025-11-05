// ================================================================
// API ROUTE: GET /api/cases/[id]/unified-timeline
// Retorna timeline unificada de múltiplas fontes
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth-helper';
import { ICONS } from '@/lib/icons';

// ================================================================
// TYPES
// ================================================================

interface UnifiedTimelineEntry {
  id: string;
  eventDate: Date;
  eventType: string;
  description: string;
  source: 'DOCUMENT_UPLOAD' | 'API_JUDIT' | 'MANUAL_ENTRY' | 'SYSTEM_IMPORT' | 'AI_EXTRACTION';
  sourceIcon: string;
  sourceName: string;
  confidence: number;
  metadata?: unknown;
  // ===== NOVO: Campos de enriquecimento =====
  isEnriched?: boolean;
  enrichedAt?: Date;
  enrichmentModel?: string;
  contributingSources?: string[];
  originalTexts?: Record<string, string>;
  linkedDocumentIds?: string[];
  hasConflict?: boolean;
  conflictDetails?: unknown;
  relationType?: 'DUPLICATE' | 'ENRICHMENT' | 'RELATED' | 'CONFLICT';
  baseEventId?: string;
}

// ================================================================
// CONSTANTS
// ================================================================

const SOURCE_METADATA = {
  DOCUMENT_UPLOAD: {
    icon: '📄',
    name: 'Documento Enviado',
    color: '#3B82F6',
    badge: 'DOC'
  },
  API_JUDIT: {
    icon: '⚖️',
    name: 'API Judiciária',
    color: '#EF4444',
    badge: 'JUDIT'
  },
  MANUAL_ENTRY: {
    icon: '📝',
    name: 'Entrada Manual',
    color: '#8B5CF6',
    badge: 'MANUAL'
  },
  SYSTEM_IMPORT: {
    icon: '📥',
    name: 'Importação do Sistema',
    color: '#10B981',
    badge: 'IMPORT'
  },
  AI_EXTRACTION: {
    icon: '🤖',
    name: 'Extração por IA',
    color: '#F59E0B',
    badge: 'IA'
  }
};

// ================================================================
// HELPER FUNCTIONS
// ================================================================

/**
 * Enriquece entrada de timeline com ícone, metadados de fonte e dados de enriquecimento
 */
function enrichTimelineEntry(entry: unknown): UnifiedTimelineEntry {
  const sourceMetadata = SOURCE_METADATA[entry.source] || {
    icon: '📌',
    name: 'Outro',
    color: '#64748B',
    badge: 'OTHER'
  };

  // Formatar documentos vinculados para o formato esperado pelo componente
  const linkedDocuments = entry.linkedDocuments?.map((doc: unknown) => ({
    id: doc.id,
    name: doc.name || doc.originalName,
    // URL será preenchida pelo frontend se necessário
  })) || [];

  return {
    id: entry.id,
    eventDate: entry.eventDate,
    eventType: entry.eventType,
    description: entry.description,
    source: entry.source,
    sourceIcon: sourceMetadata.icon,
    sourceName: sourceMetadata.name,
    confidence: entry.confidence || 0.8,
    metadata: {
      ...entry.metadata,
      sourceColor: sourceMetadata.color,
      sourceBadge: sourceMetadata.badge,
      linkedDocuments, // Incluir documentos nos metadados também
    },
    // ===== NOVO: Campos de enriquecimento =====
    isEnriched: entry.isEnriched,
    enrichedAt: entry.enrichedAt,
    enrichmentModel: entry.enrichmentModel,
    contributingSources: entry.contributingSources,
    originalTexts: entry.originalTexts as Record<string, string>,
    linkedDocumentIds: entry.linkedDocumentIds,
    hasConflict: entry.hasConflict,
    conflictDetails: entry.conflictDetails,
    relationType: entry.relationType,
    baseEventId: entry.baseEventId,
  };
}

/**
 * Ordena timeline cronologicamente (mais antigos primeiro)
 */
function sortTimelineChronologically(entries: UnifiedTimelineEntry[]): UnifiedTimelineEntry[] {
  return [...entries].sort((a, b) => {
    const dateA = new Date(a.eventDate).getTime();
    const dateB = new Date(b.eventDate).getTime();
    return dateA - dateB; // Crescente (mais antigos primeiro)
  });
}

/**
 * Calcula estatísticas da timeline
 */
function calculateStats(entries: UnifiedTimelineEntry[]) {
  const sourceCount: Record<string, number> = {};
  let earliestDate: Date | undefined;
  let latestDate: Date | undefined;
  let totalConfidence = 0;

  for (const entry of entries) {
    // Contar por fonte
    sourceCount[entry.source] = (sourceCount[entry.source] || 0) + 1;

    // Data mais antiga e mais recente
    const entryDate = new Date(entry.eventDate);
    if (!earliestDate || entryDate < earliestDate) {
      earliestDate = entryDate;
    }
    if (!latestDate || entryDate > latestDate) {
      latestDate = entryDate;
    }

    // Média de confiança
    totalConfidence += entry.confidence;
  }

  const avgConfidence = entries.length > 0 ? totalConfidence / entries.length : 0;

  return {
    totalEntries: entries.length,
    sourceCount,
    earliestDate,
    latestDate,
    avgConfidence: Math.round(avgConfidence * 100) / 100
  };
}

// ================================================================
// MAIN HANDLER
// ================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    // ============================================================
    // 1. AUTENTICAÇÃO
    // ============================================================

    const user = await getAuthenticatedUser(request);

    if (!user) {
      return unauthorizedResponse('Não autenticado');
    }

    const caseId = id;

    console.log(`${ICONS.PROCESS} [Unified Timeline] Obtendo timeline unificada para caso ${caseId}`);

    // ============================================================
    // 2. VALIDAR CASE E PERMISSÕES
    // ============================================================

    const caseData = await prisma.case.findFirst({
      where: {
        id: caseId,
        workspace: {
          users: {
            some: {
              userId: user.id
            }
          }
        }
      },
      select: {
        id: true,
        number: true,
        title: true,
        description: true
      }
    });

    if (!caseData) {
      return NextResponse.json(
        { success: false, error: 'Caso não encontrado ou acesso negado' },
        { status: 404 }
      );
    }

    console.log(`${ICONS.SUCCESS} [Unified Timeline] Caso validado: ${caseData.number}`);

    // ============================================================
    // 3. CARREGAR TIMELINE DO BANCO
    // ============================================================

    console.log(`${ICONS.EXTRACT} [Unified Timeline] Carregando entradas do banco...`);

    const timelineEntries = await prisma.processTimelineEntry.findMany({
      where: { caseId },
      orderBy: [{ eventDate: 'asc' }, { createdAt: 'asc' }],
      include: {
        // Carregar documentos vinculados
        linkedDocuments: {
          select: {
            id: true,
            name: true,
            originalName: true,
            type: true,
          }
        }
      }
    });

    console.log(`${ICONS.SUCCESS} [Unified Timeline] ${timelineEntries.length} entradas carregadas do banco`);

    // ============================================================
    // 4. CARREGAR DOCUMENTOS E EXTRAIR TIMELINE
    // ============================================================

    console.log(`${ICONS.EXTRACT} [Unified Timeline] Carregando documentos...`);

    const documents = await prisma.caseDocument.findMany({
      where: { caseId },
      select: {
        id: true,
        name: true,
        originalName: true,
        type: true,
        documentDate: true,
        metadata: true,
        sourceOrigin: true,
        createdAt: true
      }
    });

    // Converter documentos em entradas de timeline
    const documentTimelineEntries = documents.map((doc) => ({
      id: `doc-${doc.id}`,
      eventDate: doc.documentDate || doc.createdAt,
      eventType: doc.type || 'DOCUMENTO',
      description: `📎 ${doc.name || doc.originalName}`,
      source: 'DOCUMENT_UPLOAD' as const,
      sourceId: doc.id,
      metadata: {
        ...doc.metadata,
        documentType: doc.type,
        originalName: doc.originalName
      },
      confidence: 0.8,
      createdAt: doc.createdAt
    }));

    console.log(
      `${ICONS.SUCCESS} [Unified Timeline] ${documentTimelineEntries.length} documentos convertidos para timeline`
    );

    // ============================================================
    // 5. MESCLAR TODOS OS EVENTOS
    // ============================================================

    console.log(`${ICONS.PROCESS} [Unified Timeline] Mesclando todas as fontes...`);

    const allEntries = [...timelineEntries, ...documentTimelineEntries];

    // Remover duplicatas óbvias baseado em ID
    const entriesByKey = new Map();
    for (const entry of allEntries) {
      const key = `${entry.eventDate.toISOString().split('T')[0]}_${entry.eventType}`;
      if (!entriesByKey.has(key)) {
        entriesByKey.set(key, entry);
      }
    }

    const uniqueEntries = Array.from(entriesByKey.values());

    // Enriquecer e ordenar
    const enrichedEntries = uniqueEntries.map(enrichTimelineEntry);
    const sortedEntries = sortTimelineChronologically(enrichedEntries);

    console.log(
      `${ICONS.SUCCESS} [Unified Timeline] ${sortedEntries.length} eventos únicos na timeline`
    );

    // ============================================================
    // 6. CALCULAR ESTATÍSTICAS
    // ============================================================

    const stats = calculateStats(sortedEntries);

    console.log(`${ICONS.SUCCESS} [Unified Timeline] Timeline completa:`, {
      totalEntries: stats.totalEntries,
      sources: stats.sourceCount,
      avgConfidence: stats.avgConfidence
    });

    // ============================================================
    // 7. RETORNAR RESPOSTA
    // ============================================================

    return NextResponse.json(
      {
        success: true,
        case: caseData,
        timeline: sortedEntries,
        stats: {
          ...stats,
          timelineSpan: {
            start: stats.earliestDate,
            end: stats.latestDate
          }
        }
      },
      { status: 200 }
    );

  } catch (error) {
    console.error(`${ICONS.ERROR} [Unified Timeline] Erro:`, error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao obter timeline unificada'
      },
      { status: 500 }
    );
  }
}
