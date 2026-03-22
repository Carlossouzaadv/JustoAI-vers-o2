// ================================================================
// API ROUTE: GET /api/cases/[id]/unified-timeline
// Retorna timeline unificada de múltiplas fontes
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/api-utils';
import { ICONS } from '@/lib/icons';
import { TimelineSource } from '@/lib/types/database';
import type { ProcessTimelineEntry } from '@/lib/types/database';

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
  relationType: 'DUPLICATE' | 'ENRICHMENT' | 'RELATED' | 'CONFLICT' | undefined;
  baseEventId: string | undefined;
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

interface LinkedDocument {
  id: string;
  name: string;
  originalName: string;
  type: string | null;
}

type TimelineEntryInput = ProcessTimelineEntry & {
  linkedDocuments?: LinkedDocument[];
};

/**
 * Type-Safe Document: Representa documento retornado do Prisma
 * Usado para evitar 'any' implícito no callback .map()
 */
interface DocumentForTimeline {
  id: string;
  name: string | null;
  originalName: string;
  type: string | null;
  documentDate: Date | null;
  metadata: unknown;
  sourceOrigin: string | null;
  createdAt: Date;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Type guard: Valida se um valor é um EventRelationType válido
 * Padrão-Ouro: Narrowing seguro ZERO `as any`
 * Usa readonly string[] para verificação compatível com .includes()
 */
function isValidEventRelationType(
  value: unknown
): value is 'DUPLICATE' | 'ENRICHMENT' | 'RELATED' | 'CONFLICT' {
  // Primeiro narrowing: verificar se é string
  if (typeof value !== 'string') {
    return false;
  }

  // Usar readonly string[] para a verificação
  // Isso torna 'value' (string) 100% compatível com .includes()
  const validTypes: readonly string[] = [
    'DUPLICATE',
    'ENRICHMENT',
    'RELATED',
    'CONFLICT'
  ];

  return validTypes.includes(value);
}

// Note: normalizeNullToUndefined is currently unused but may be needed in future
// /**
//  * Normaliza valores nulos para undefined
//  * Segue narrowing seguro sem casting
//  */
// function normalizeNullToUndefined<T>(value: T | null): T | undefined {
//   return value === null ? undefined : value;
// }

/**
 * Type guard: Valida se um valor unknown é um Date
 */
function isDate(value: unknown): value is Date {
  return value instanceof Date && !isNaN(value.getTime());
}

/**
 * Type guard: Valida se um valor unknown é uma string
 */
function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Type guard: Valida se um valor unknown é um número
 */
function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * Type guard: Valida se um valor unknown é TimelineSource
 */
function isTimelineSource(value: unknown): value is TimelineSource {
  if (typeof value !== 'string') {
    return false;
  }
  const validSources: readonly string[] = [
    'DOCUMENT_UPLOAD',
    'API_JUDIT',
    'MANUAL_ENTRY',
    'SYSTEM_IMPORT',
    'AI_EXTRACTION'
  ];
  return validSources.includes(value);
}

/**
 * Type guard: Valida se um valor unknown é string[]
 */
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

/**
 * Type guard: Valida se um valor unknown é TimelineOriginalTexts (Record<string, string>)
 */
function isTimelineOriginalTexts(value: unknown): value is Record<string, string> {
  if (!isRecord(value)) {
    return false;
  }
  return Object.values(value).every(v => typeof v === 'string');
}

/**
 * Enriquece entrada de timeline com ícone, metadados de fonte e dados de enriquecimento
 */
function enrichTimelineEntry(entry: TimelineEntryInput): UnifiedTimelineEntry {
  // Extrair source com type guard antes de usar como índice
  const entrySource: TimelineSource = isTimelineSource(entry.source) ? entry.source : TimelineSource.MANUAL_ENTRY;
  const sourceMetadata = SOURCE_METADATA[entrySource] || {
    icon: '📌',
    name: 'Outro',
    color: '#64748B',
    badge: 'OTHER'
  };

  // Formatar documentos vinculados para o formato esperado pelo componente
  const linkedDocuments = entry.linkedDocuments?.map((doc: LinkedDocument) => ({
    id: doc.id,
    name: doc.name || doc.originalName,
    // URL será preenchida pelo frontend se necessário
  })) || [];

  const metadata = isRecord(entry.metadata) ? entry.metadata : {};

  // Validar e normalizar relationType usando type guard
  let normalizedRelationType: 'DUPLICATE' | 'ENRICHMENT' | 'RELATED' | 'CONFLICT' | undefined;
  if (entry.relationType !== null && entry.relationType !== undefined) {
    normalizedRelationType = isValidEventRelationType(entry.relationType)
      ? entry.relationType
      : undefined;
  } else {
    normalizedRelationType = undefined;
  }

  // Extrair valores unknown de forma segura usando type guards
  const eventDate = isDate(entry.eventDate) ? entry.eventDate : new Date();
  const eventType = isString(entry.eventType) ? entry.eventType : 'UNKNOWN';
  const description = isString(entry.description) ? entry.description : '';

  // Extrair confidence com fallback seguro
  const rawConfidence = entry.confidence;
  const confidence = isNumber(rawConfidence) ? rawConfidence : 0.8;

  // Extrair arrays com type guards
  const contributingSources = isStringArray(entry.contributingSources)
    ? entry.contributingSources
    : undefined;

  const linkedDocumentIds = isStringArray(entry.linkedDocumentIds)
    ? entry.linkedDocumentIds
    : undefined;

  // Extrair originalTexts com type guard
  const originalTexts = isTimelineOriginalTexts(entry.originalTexts)
    ? entry.originalTexts
    : undefined;

  // Normalizar baseEventId: null -> undefined
  const baseEventId = isString(entry.baseEventId)
    ? entry.baseEventId
    : undefined;

  return {
    id: entry.id,
    eventDate,
    eventType,
    description,
    source: entrySource,
    sourceIcon: sourceMetadata.icon,
    sourceName: sourceMetadata.name,
    confidence,
    metadata: {
      ...metadata,
      sourceColor: sourceMetadata.color,
      sourceBadge: sourceMetadata.badge,
      linkedDocuments, // Incluir documentos nos metadados também
    },
    // ===== NOVO: Campos de enriquecimento =====
    isEnriched: undefined,
    enrichedAt: undefined,
    enrichmentModel: undefined,
    contributingSources,
    originalTexts,
    linkedDocumentIds,
    hasConflict: undefined,
    conflictDetails: undefined,
    relationType: normalizedRelationType,
    baseEventId,
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

    const { user, error: authError } = await requireAuth(request);

    if (!user) return authError!;

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
    // Type-safe mapping: documentos são convertidos para TimelineEntryInput
    const documentTimelineEntries = documents.map((doc: DocumentForTimeline): TimelineEntryInput => {
      const metadata = isRecord(doc.metadata) ? doc.metadata : {};
      const linkedDocIds: string[] = [];
      const contributingSourcesList: TimelineSource[] = [TimelineSource.DOCUMENT_UPLOAD];
      const enrichByIds: string[] = [];

      return {
        id: `doc-${doc.id}`,
        caseId,
        contentHash: '',
        eventDate: doc.documentDate || doc.createdAt,
        eventType: doc.type || 'DOCUMENTO',
        description: `📎 ${doc.name || doc.originalName}`,
        normalizedContent: '',
        source: TimelineSource.DOCUMENT_UPLOAD,
        sourceId: doc.id,
        metadata: {
          ...metadata,
          documentType: doc.type,
          originalName: doc.originalName
        },
        confidence: 0.8,
        createdAt: doc.createdAt,
        updatedAt: doc.createdAt,
        // Enriquecimento (inicial: nenhum para documentos)
        isEnriched: false,
        enrichedAt: null,
        enrichmentModel: null,
        hasConflict: false,
        conflictDetails: null,
        reviewedAt: null,
        reviewedBy: null,
        // Relacionamento entre eventos
        baseEventId: null,
        enrichedByIds: enrichByIds,
        relationType: null,
        originalTexts: null,
        contributingSources: contributingSourcesList,
        linkedDocumentIds: linkedDocIds
      };
    });

    console.log(
      `${ICONS.SUCCESS} [Unified Timeline] ${documentTimelineEntries.length} documentos convertidos para timeline`
    );

    // ============================================================
    // 5. MESCLAR TODOS OS EVENTOS
    // ============================================================

    console.log(`${ICONS.PROCESS} [Unified Timeline] Mesclando todas as fontes...`);

    const allEntries: TimelineEntryInput[] = [...timelineEntries, ...documentTimelineEntries];

    // Remover duplicatas óbvias baseado em ID
    const entriesByKey = new Map<string, TimelineEntryInput>();
    for (const entry of allEntries) {
      // Safe narrowing: eventDate is guaranteed to be Date in TimelineEntryInput
      const eventDate = entry.eventDate instanceof Date
        ? entry.eventDate
        : (typeof entry.eventDate === 'string' || typeof entry.eventDate === 'number'
          ? new Date(entry.eventDate)
          : new Date());
      const key = `${eventDate.toISOString().split('T')[0]}_${entry.eventType}`;
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
