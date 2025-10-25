// ================================================================
// SUMMARY CONSOLIDATOR
// Consolidates extracted document metadata into case summary
// ================================================================

import { prisma } from '@/lib/prisma';
import { ICONS } from '@/lib/icons';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ================================================================
// TYPES
// ================================================================

export interface DocumentSummaryData {
  id: string;
  name: string;
  originalName: string;
  type: string;
  documentDate?: Date;
  metadata?: any;
  extractedText?: string;
  summary?: string;
  sourceOrigin: string;
}

export interface ConsolidatedCaseSummary {
  description: string;
  lastUpdated: Date;
  sourceCount: number;
  documentCount: number;
  timelineSpan?: {
    earliest?: Date;
    latest?: Date;
  };
  confidence: number;
}

// ================================================================
// HELPER FUNCTIONS
// ================================================================

/**
 * Formata metadados de documento para texto legível
 */
function formatDocumentInfo(doc: DocumentSummaryData): string {
  const parts: string[] = [];

  // Nome e tipo
  parts.push(`📄 ${doc.name || doc.originalName}`);

  if (doc.type && doc.type !== 'OTHER') {
    parts.push(`  Tipo: ${formatDocumentType(doc.type)}`);
  }

  if (doc.documentDate) {
    parts.push(`  Data: ${doc.documentDate.toLocaleDateString('pt-BR')}`);
  }

  if (doc.metadata) {
    const meta = doc.metadata;

    if (meta.description) {
      parts.push(`  Descrição: ${meta.description}`);
    }

    if (meta.parties && Array.isArray(meta.parties) && meta.parties.length > 0) {
      parts.push(`  Partes: ${meta.parties.slice(0, 2).join(', ')}`);
    }

    if (meta.judge) {
      parts.push(`  Juiz: ${meta.judge}`);
    }

    if (meta.keyNumbers?.processNumber) {
      parts.push(`  Processo: ${meta.keyNumbers.processNumber}`);
    }
  }

  return parts.join('\n');
}

/**
 * Formata nome do tipo de documento para exibição
 */
function formatDocumentType(type: string): string {
  const typeMap: Record<string, string> = {
    PETIÇÃO_INICIAL: 'Petição Inicial',
    PETIÇÃO_INTERMEDIÁRIA: 'Petição',
    CONTESTAÇÃO: 'Contestação',
    DESPACHO: 'Despacho',
    DECISÃO: 'Decisão',
    SENTENÇA: 'Sentença',
    MANDADO: 'Mandado',
    CITAÇÃO: 'Citação',
    INTIMAÇÃO: 'Intimação',
    JUNTADA: 'Juntada',
    PROVA: 'Prova',
    PARECER: 'Parecer',
    PETITION: 'Petição',
    DECISION: 'Decisão',
    MOVEMENT: 'Andamento',
    EVIDENCE: 'Prova',
    CONTRACT: 'Contrato',
    MOTION: 'Moção',
    COURT_ORDER: 'Despacho',
    JUDGMENT: 'Sentença',
    APPEAL: 'Recurso',
    AGREEMENT: 'Acordo',
    CORRESPONDENCE: 'Correspondência',
    OTHER: 'Documento',
  };

  return typeMap[type] || type;
}

/**
 * Ordena documentos cronologicamente
 */
function sortDocumentsByDate(documents: DocumentSummaryData[]): DocumentSummaryData[] {
  return [...documents].sort((a, b) => {
    const dateA = a.documentDate?.getTime() || a.metadata?.createdAt?.getTime() || 0;
    const dateB = b.documentDate?.getTime() || b.metadata?.createdAt?.getTime() || 0;

    return dateA - dateB;
  });
}

/**
 * Extrai período de tempo do conjunto de documentos
 */
function extractTimelineSpan(documents: DocumentSummaryData[]): {
  earliest?: Date;
  latest?: Date;
} {
  const dates: Date[] = [];

  for (const doc of documents) {
    if (doc.documentDate) {
      dates.push(doc.documentDate);
    }
  }

  if (dates.length === 0) {
    return {};
  }

  dates.sort((a, b) => a.getTime() - b.getTime());

  return {
    earliest: dates[0],
    latest: dates[dates.length - 1],
  };
}

// ================================================================
// CONSOLIDATION LOGIC
// ================================================================

/**
 * Carrega todos os documentos de um caso
 */
async function loadCaseDocuments(caseId: string): Promise<DocumentSummaryData[]> {
  const documents = await prisma.caseDocument.findMany({
    where: { caseId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      originalName: true,
      type: true,
      documentDate: true,
      metadata: true,
      extractedText: true,
      summary: true,
      sourceOrigin: true,
      createdAt: true,
    },
  });

  return documents.map((doc) => ({
    ...doc,
    metadata: doc.metadata || {},
  })) as DocumentSummaryData[];
}

/**
 * Gera prompt para consolidação de resumo via Gemini
 */
function generateConsolidationPrompt(documents: DocumentSummaryData[], caseInfo: any): string {
  const sortedDocs = sortDocumentsByDate(documents);

  const documentsList = sortedDocs
    .map((doc) => formatDocumentInfo(doc))
    .join('\n\n');

  return `Você é um assistente jurídico especializado em processos judiciais brasileiros.

Analise os documentos a seguir de um caso judicial e gere um resumo consolidado e conciso que será exibido na aba "Resumo" do processo:

INFORMAÇÕES DO CASO:
- Número do Processo: ${caseInfo.number || 'N/A'}
- Título: ${caseInfo.title || 'N/A'}
- Status: ${caseInfo.status || 'Ativo'}
- Tipo: ${caseInfo.type || 'Civil'}

DOCUMENTOS DO CASO:
${documentsList}

INSTRUÇÕES:
1. Crie um resumo executivo (máximo 150 palavras) que capture os pontos principais do caso
2. Mencione as partes envolvidas, se disponível
3. Descreva o objeto da ação/demanda de forma clara
4. Indique os principais eventos processuais (petição, defesa, decisões) em ordem cronológica
5. Destaque qualquer decisão importante ou andamento recente
6. Use linguagem clara e profissional, adequada para visualização rápida no sistema

Forneça APENAS o resumo consolidado, sem explicações adicionais.`;
}

/**
 * Chama Gemini para gerar resumo consolidado
 */
async function generateConsolidatedSummaryWithAI(
  documents: DocumentSummaryData[],
  caseInfo: any
): Promise<string> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY não configurada');
    }

    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = generateConsolidationPrompt(documents, caseInfo);

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        topP: 0.8,
        topK: 20,
        maxOutputTokens: 500,
      },
    });

    const response = result.response;
    const text = response.text();

    if (!text) {
      throw new Error('Resposta vazia do Gemini');
    }

    return text.trim();
  } catch (error) {
    console.error(`${ICONS.ERROR} [Summary Consolidator] Erro ao chamar Gemini:`, error);
    throw error;
  }
}

/**
 * Gera resumo fallback se AI não funcionar
 */
function generateFallbackSummary(documents: DocumentSummaryData[]): string {
  const sortedDocs = sortDocumentsByDate(documents);
  const parts: string[] = [];

  // Primeiro documento (geralmente a petição inicial)
  if (sortedDocs.length > 0) {
    const first = sortedDocs[0];
    parts.push(
      `Processo iniciado com ${formatDocumentType(first.type || 'documento')} em ${first.documentDate?.toLocaleDateString('pt-BR') || 'data desconhecida'}.`
    );
  }

  // Resumo simples baseado nos documentos
  const documentTypes = new Set(sortedDocs.map((d) => formatDocumentType(d.type || 'Other')));
  if (documentTypes.size > 0) {
    parts.push(`Documentação: ${Array.from(documentTypes).join(', ')}.`);
  }

  // Período de tempo
  const timeSpan = extractTimelineSpan(sortedDocs);
  if (timeSpan.earliest && timeSpan.latest) {
    parts.push(
      `Período: de ${timeSpan.earliest.toLocaleDateString('pt-BR')} a ${timeSpan.latest.toLocaleDateString('pt-BR')}.`
    );
  }

  return parts.join(' ') || 'Processo com documentação disponível para análise.';
}

// ================================================================
// MAIN CONSOLIDATOR
// ================================================================

/**
 * Consolida resumo do caso a partir de documentos extraídos
 */
export async function consolidateCaseSummary(caseId: string): Promise<ConsolidatedCaseSummary> {
  try {
    console.log(`${ICONS.PROCESS} [Summary Consolidator] Consolidando resumo do caso: ${caseId}`);

    // Carregar informações do caso
    const caseInfo = await prisma.case.findUnique({
      where: { id: caseId },
      select: {
        id: true,
        number: true,
        title: true,
        type: true,
        status: true,
        description: true,
      },
    });

    if (!caseInfo) {
      throw new Error(`Caso não encontrado: ${caseId}`);
    }

    // Carregar documentos
    const documents = await loadCaseDocuments(caseId);

    if (documents.length === 0) {
      console.log(`${ICONS.INFO} [Summary Consolidator] Nenhum documento encontrado para ${caseId}`);
      return {
        description: 'Nenhum documento disponível para gerar resumo.',
        lastUpdated: new Date(),
        sourceCount: 0,
        documentCount: 0,
        confidence: 0,
      };
    }

    // Gerar resumo consolidado
    let consolidatedDescription = '';
    let confidence = 0.5;

    try {
      console.log(
        `${ICONS.EXTRACT} [Summary Consolidator] Gerando resumo com IA para ${documents.length} documentos`
      );
      consolidatedDescription = await generateConsolidatedSummaryWithAI(documents, caseInfo);
      confidence = 0.85;
    } catch (aiError) {
      console.warn(`${ICONS.WARNING} [Summary Consolidator] Falha na IA, usando fallback`, aiError);
      consolidatedDescription = generateFallbackSummary(documents);
      confidence = 0.6;
    }

    const result: ConsolidatedCaseSummary = {
      description: consolidatedDescription,
      lastUpdated: new Date(),
      sourceCount: new Set(documents.map((d) => d.sourceOrigin)).size,
      documentCount: documents.length,
      timelineSpan: extractTimelineSpan(documents),
      confidence,
    };

    console.log(`${ICONS.SUCCESS} [Summary Consolidator] Resumo consolidado:`, {
      documentCount: result.documentCount,
      sourceCount: result.sourceCount,
      confidence: result.confidence,
      hasTimelineSpan: !!result.timelineSpan?.earliest,
    });

    return result;
  } catch (error) {
    console.error(`${ICONS.ERROR} [Summary Consolidator] Erro ao consolidar resumo:`, error);
    throw error;
  }
}

/**
 * Atualiza descrição do caso com resumo consolidado
 */
export async function updateCaseSummaryDescription(caseId: string): Promise<string> {
  try {
    const consolidated = await consolidateCaseSummary(caseId);

    // Atualizar caso com novo resumo
    const updated = await prisma.case.update({
      where: { id: caseId },
      data: {
        description: consolidated.description,
      },
      select: {
        id: true,
        description: true,
      },
    });

    console.log(`${ICONS.SUCCESS} [Summary Consolidator] Descrição do caso atualizada`);

    return updated.description || '';
  } catch (error) {
    console.error(`${ICONS.ERROR} [Summary Consolidator] Erro ao atualizar descrição:`, error);
    throw error;
  }
}
