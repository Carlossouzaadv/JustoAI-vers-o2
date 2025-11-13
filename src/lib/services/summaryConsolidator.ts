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

/**
 * Interface representing the Prisma query result for case documents
 */
interface PrismaCaseDocument {
  id: string;
  name: string;
  originalName: string;
  type: string;
  documentDate: Date | null;
  metadata: Record<string, unknown> | null;
  extractedText: string | null;
  summary: string | null;
  sourceOrigin: string;
  createdAt: Date;
}

export interface DocumentSummaryData {
  id: string;
  name: string;
  originalName: string;
  type: string;
  documentDate?: Date;
  metadata?: Record<string, unknown>;
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
 * Type guard: check if data is an object with processNumber property (string)
 */
function isKeyNumbersWithProcess(data: unknown): data is { processNumber: string } {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const obj = data as Record<string, unknown>;
  return 'processNumber' in obj && typeof obj.processNumber === 'string';
}

/**
 * Safely extract processNumber from keyNumbers metadata using type guard
 */
function getProcessNumber(keyNumbers: unknown): string | null {
  if (isKeyNumbersWithProcess(keyNumbers)) {
    // After type guard narrows the type, we can safely access processNumber
    return keyNumbers.processNumber;
  }
  return null;
}

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

    if (meta.description && typeof meta.description === 'string') {
      parts.push(`  Descrição: ${meta.description}`);
    }

    if (meta.parties && Array.isArray(meta.parties) && meta.parties.length > 0) {
      parts.push(`  Partes: ${meta.parties.slice(0, 2).join(', ')}`);
    }

    if (meta.judge && typeof meta.judge === 'string') {
      parts.push(`  Juiz: ${meta.judge}`);
    }

    // Use type guard helper to safely extract processNumber
    const processNumber = getProcessNumber(meta.keyNumbers);
    if (processNumber) {
      parts.push(`  Processo: ${processNumber}`);
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
 * Safely extract date from metadata using type guard
 */
function getMetadataDate(metadata: Record<string, unknown> | undefined): Date | null {
  if (!metadata) return null;

  const createdAt = metadata.createdAt;

  // Type guard: check if createdAt is a Date object
  if (createdAt instanceof Date) {
    return createdAt;
  }

  // Type guard: check if createdAt is a date string and parse it
  if (typeof createdAt === 'string') {
    const parsed = new Date(createdAt);
    // Verify the date is valid
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
}

/**
 * Ordena documentos cronologicamente
 */
function sortDocumentsByDate(documents: DocumentSummaryData[]): DocumentSummaryData[] {
  return [...documents].sort((a, b) => {
    // First try documentDate, then fall back to metadata createdAt using narrowing
    const dateA = a.documentDate?.getTime() ?? (getMetadataDate(a.metadata)?.getTime() ?? 0);
    const dateB = b.documentDate?.getTime() ?? (getMetadataDate(b.metadata)?.getTime() ?? 0);

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

  return documents.map((doc: PrismaCaseDocument): DocumentSummaryData => ({
    ...doc,
    metadata: doc.metadata || {},
  }));
}

/**
 * Gera prompt para consolidação de resumo via Gemini
 */
function generateConsolidationPrompt(documents: DocumentSummaryData[], caseInfo: Record<string, unknown>): string {
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
  caseInfo: Record<string, unknown>
): Promise<string> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY não configurada');
    }

    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = generateConsolidationPrompt(documents, caseInfo);

    console.log(`${ICONS.EXTRACT} [Summary Consolidator] Enviando prompt para Gemini (${prompt.length} chars, ${documents.length} docs)`);

    try {
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

      console.log(`${ICONS.SUCCESS} [Summary Consolidator] Resposta recebida do Gemini: ${text.length} chars`);
      return text.trim();
    } catch (geminiError: unknown) {
      // Tratamento específico de erros da Gemini API
      const error = geminiError as Record<string, unknown>;
      console.error(`${ICONS.ERROR} [Summary Consolidator] Erro específico do Gemini:`, {
        error: geminiError,
        message: error?.message,
        status: error?.status,
        code: error?.code
      });

      // Se é erro de quota ou rate limit, mencionar isto
      if (error?.status === 429 || (error?.message as string)?.includes('rate limit')) {
        throw new Error('Limite de requisições da API Gemini atingido. Tente novamente em alguns minutos.');
      }

      if (error?.status === 403 || (error?.message as string)?.includes('permission denied')) {
        throw new Error('Permissão negada na API Gemini. Verifique a configuração da chave.');
      }

      if ((error?.message as string)?.includes('INVALID_ARGUMENT')) {
        throw new Error('Erro na configuração do prompt ou parâmetros da Gemini API.');
      }

      throw geminiError;
    }
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
 * Gera resumo a partir da timeline e documentos já processados (SEM chamar Gemini novamente)
 * Usado para regeneração rápida após atualizações
 */
export async function generateSummaryFromTimeline(caseId: string): Promise<string> {
  try {
    console.log(`${ICONS.PROCESS} [Summary Consolidator] Gerando resumo a partir da timeline: ${caseId}`);

    // Carregar informações do caso
    const caseInfo = await prisma.case.findUnique({
      where: { id: caseId },
      select: {
        id: true,
        number: true,
        title: true,
        type: true,
        status: true,
      },
    });

    if (!caseInfo) {
      throw new Error(`Caso não encontrado: ${caseId}`);
    }

    // Carregar timeline do caso (já processada e unificada)
    const timelineEntries = await prisma.processTimelineEntry.findMany({
      where: { caseId },
      orderBy: { eventDate: 'asc' },
      select: {
        eventDate: true,
        eventType: true,
        description: true,
        source: true,
      },
    });

    // Carregar documentos com metadados já extraídos
    const documents = await loadCaseDocuments(caseId);

    if (documents.length === 0 && timelineEntries.length === 0) {
      console.log(`${ICONS.INFO} [Summary Consolidator] Nenhum dado para gerar resumo`);
      return 'Nenhum documento ou evento processado disponível.';
    }

    // Construir resumo a partir dos dados já processados
    const parts: string[] = [];

    // 1. Título e tipo do caso
    if (caseInfo.title) {
      parts.push(`**Caso**: ${caseInfo.title}`);
    }
    if (caseInfo.number) {
      parts.push(`**Processo**: ${caseInfo.number}`);
    }

    // 2. Status do caso
    if (caseInfo.status) {
      parts.push(`**Status**: ${caseInfo.status}`);
    }

    // 3. Resumo dos documentos
    if (documents.length > 0) {
      const documentTypes = new Set(documents.map((d) => formatDocumentType(d.type || 'OTHER')));
      parts.push(`**Documentação**: ${Array.from(documentTypes).join(', ')} (${documents.length} documentos)`);

      // Períodos importantes dos documentos
      const timeSpan = extractTimelineSpan(documents);
      if (timeSpan.earliest && timeSpan.latest) {
        parts.push(`**Período**: ${timeSpan.earliest.toLocaleDateString('pt-BR')} a ${timeSpan.latest.toLocaleDateString('pt-BR')}`);
      }
    }

    // 4. Andamentos principais (últimos 5 de cada tipo importante)
    if (timelineEntries.length > 0) {
      // Agrupar andamentos por tipo
      const eventsByType: Record<string, typeof timelineEntries> = {};
      for (const entry of timelineEntries) {
        if (!eventsByType[entry.eventType]) {
          eventsByType[entry.eventType] = [];
        }
        eventsByType[entry.eventType].push(entry);
      }

      // Selecionar tipos mais importantes
      const importantTypes = ['DECISION', 'JUDGMENT', 'SENTENÇA', 'Decisão', 'Sentença'];
      const recentEvents: string[] = [];

      // Pegar últimos eventos de cada tipo importante
      for (const type of importantTypes) {
        const eventsOfType = eventsByType[type];
        if (eventsOfType && eventsOfType.length > 0) {
          const lastEvent = eventsOfType[eventsOfType.length - 1];
          recentEvents.push(`- ${lastEvent.eventType} (${lastEvent.eventDate.toLocaleDateString('pt-BR')}): ${lastEvent.description.substring(0, 100)}`);
        }
      }

      // Se não houver eventos importantes, pegar os 3 últimos gerais
      if (recentEvents.length === 0) {
        const lastThree = timelineEntries.slice(-3);
        for (const event of lastThree) {
          recentEvents.push(`- ${event.eventType} (${event.eventDate.toLocaleDateString('pt-BR')}): ${event.description.substring(0, 100)}`);
        }
      }

      if (recentEvents.length > 0) {
        parts.push(`**Andamentos Recentes**:\n${recentEvents.join('\n')}`);
      }
    }

    const consolidatedDescription = parts.join('\n\n') || 'Processo com dados em processamento.';

    console.log(`${ICONS.SUCCESS} [Summary Consolidator] Resumo gerado a partir da timeline e documentos`);
    return consolidatedDescription;

  } catch (error) {
    console.error(`${ICONS.ERROR} [Summary Consolidator] Erro ao gerar resumo da timeline:`, error);
    throw error;
  }
}

/**
 * Consolida resumo do caso a partir de documentos extraídos
 * NOTA: Usado apenas na primeira análise (fase inicial com Gemini)
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
