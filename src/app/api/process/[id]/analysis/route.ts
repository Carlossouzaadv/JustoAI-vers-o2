// ================================================================
// API ENDPOINT - Análise IA (GET análises / POST criar nova)
// ================================================================
// GET  /api/process/{id}/analysis - Recuperar análises salvas
// POST /api/process/{id}/analysis?level=FAST|FULL - Gerar nova análise

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AIModelRouter } from '@/lib/ai-model-router';
import { creditService } from '@/lib/services/creditService';
import { ICONS } from '@/lib/icons';
import { juditAPI, JuditOperationType } from '@/lib/judit-api-wrapper';

interface AnalysisRequest {
  level: 'FAST' | 'FULL';
  includeDocuments?: boolean;
  includeTimeline?: boolean;
  uploadedFile?: string; // Para FULL - path do arquivo uploaded
  workspaceId: string; // Required for credit system
}

/**
 * GET - Recuperar análises salvas do processo
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: processId } = await params;

  try {
    console.log(`${ICONS.SEARCH} Buscando análises para processo: ${processId}`);

    // Buscar todas as análises do processo, ordenadas por versão (mais recentes primeiro)
    const analyses = await prisma.caseAnalysisVersion.findMany({
      where: { caseId: processId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        version: true,
        status: true,
        analysisType: true,
        modelUsed: true,
        aiAnalysis: true,
        confidence: true,
        processingTime: true,
        createdAt: true,
        metadata: true
      }
    });

    console.log(`${ICONS.SUCCESS} Encontradas ${analyses.length} análise(s)`);

    return NextResponse.json({
      success: true,
      analyses: analyses.map(a => ({
        id: a.id,
        version: a.version,
        createdAt: a.createdAt,
        status: a.status,
        analysisType: a.analysisType,
        model: a.modelUsed,
        confidence: a.confidence,
        processingTime: a.processingTime,
        summary: (a.aiAnalysis as any)?.summary || (a.aiAnalysis as any)?.resumo_executivo,
        keyPoints: (a.aiAnalysis as any)?.keyPoints || (a.aiAnalysis as any)?.pontos_principais,
        legalAssessment: (a.aiAnalysis as any)?.legalAssessment || (a.aiAnalysis as any)?.avaliacao_juridica,
        riskAssessment: (a.aiAnalysis as any)?.riskAssessment || (a.aiAnalysis as any)?.analise_risco,
        timelineAnalysis: (a.aiAnalysis as any)?.timelineAnalysis || (a.aiAnalysis as any)?.analise_cronograma,
        // Dados completos para referência
        data: a.aiAnalysis
      }))
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro ao buscar análises:`, error);
    return NextResponse.json(
      { error: 'Erro ao buscar análises' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: processId } = await params;

  try {
    console.log(`${ICONS.PROCESS} Iniciando análise para processo: ${processId}`);

    const body: AnalysisRequest = await request.json();
    const { level, includeDocuments = true, includeTimeline = true, workspaceId } = body;

    // Validar campos obrigatórios
    if (!workspaceId) {
      return NextResponse.json(
        { error: 'workspaceId é obrigatório' },
        { status: 400 }
      );
    }

    if (!['FAST', 'FULL'].includes(level)) {
      return NextResponse.json(
        { error: 'Nível de análise deve ser FAST ou FULL' },
        { status: 400 }
      );
    }

    // Verificar créditos (mock - sempre retorna sucesso)
    const creditCheck = await creditService.checkCredits(
      workspaceId,
      level === 'FULL' ? 1 : 0,
      level === 'FULL' ? 'FULL' : 'REPORT'
    );

    if (!creditCheck.available) {
      console.error(`${ICONS.ERROR} Créditos insuficientes:`, creditCheck);
      return NextResponse.json(
        { error: 'Créditos insuficientes', details: creditCheck },
        { status: 402 }
      );
    }

    console.log(`${ICONS.SUCCESS} Créditos verificados - prosseguindo com análise`);

    // Buscar documentos do caso
    const documents = await prisma.caseDocument.findMany({
      where: { caseId: processId },
      select: {
        id: true,
        cleanText: true,
        extractedText: true,
        originalName: true,
        type: true
      },
      take: 20 // Limitar para performance
    });

    console.log(`${ICONS.SEARCH} Encontrados ${documents.length} documento(s) para ${level}`);

    // Concatenar texto dos documentos
    const fullText = documents
      .map(d => d.cleanText || d.extractedText || '')
      .filter(Boolean)
      .join('\n\n');

    if (!fullText) {
      return NextResponse.json(
        {
          error: 'Nenhum texto encontrado para análise',
          suggestion: 'Faça upload de documentos ou use a opção FULL'
        },
        { status: 400 }
      );
    }

    // Selecionar modelo baseado no nível
    const modelUsed = level === 'FULL' ? 'gemini-1.5-pro' : 'gemini-1.5-flash';

    console.log(`${ICONS.INFO} Usando modelo: ${modelUsed} para análise ${level}`);

    // Criar versão em andamento
    const nextVersion = await getNextVersionNumber(processId);
    const startTime = Date.now();

    const analysisVersion = await prisma.caseAnalysisVersion.create({
      data: {
        caseId: processId,
        workspaceId,
        version: nextVersion,
        status: 'PROCESSING',
        analysisType: level === 'FULL' ? 'complete' : 'strategic',
        modelUsed,
        confidence: 0,
        metadata: {
          level,
          documentCount: documents.length,
          startedAt: new Date().toISOString()
        }
      }
    });

    console.log(`${ICONS.SUCCESS} Versão ${nextVersion} criada - ID: ${analysisVersion.id}`);

    // Track analysis request telemetry
    const analysisRequestTime = Date.now() - startTime;
    await juditAPI.trackCall({
      workspaceId,
      operationType: JuditOperationType.ANALYSIS,
      durationMs: analysisRequestTime,
      success: true,
      requestId: analysisVersion.id,
      metadata: {
        eventType: 'analysis.requested',
        level,
        model: modelUsed,
        documentCount: documents.length,
        textLength: fullText.length,
        analysisType: level === 'FULL' ? 'complete' : 'strategic',
      },
    });

    // Processar em background
    processAnalysisInBackground(
      analysisVersion.id,
      processId,
      fullText,
      level,
      modelUsed,
      workspaceId,
      documents.length
    ).catch(error => {
      console.error(`${ICONS.ERROR} Erro no processamento:`, error);
    });

    return NextResponse.json({
      success: true,
      analysisId: analysisVersion.id,
      version: nextVersion,
      level,
      model: modelUsed,
      estimatedTime: level === 'FULL' ? '20-30 segundos' : '10-15 segundos'
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro ao gerar análise:`, error);
    return NextResponse.json(
      { error: 'Erro ao gerar análise', details: error instanceof Error ? error.message : 'Desconhecido' },
      { status: 500 }
    );
  }
}

/**
 * Processa análise em background usando Gemini
 */
async function processAnalysisInBackground(
  analysisVersionId: string,
  processId: string,
  fullText: string,
  level: 'FAST' | 'FULL',
  modelUsed: string,
  workspaceId: string,
  documentCount: number
) {
  try {
    console.log(`${ICONS.PROCESS} Iniciando processamento background para análise ${analysisVersionId}`);

    const startTime = Date.now();

    // Chamar Gemini para análise real
    let analysisResult;

    if (level === 'FULL') {
      // FULL: Análise estratégica completa com Gemini Pro
      console.log(`${ICONS.STAR} Executando análise FULL com Gemini Pro...`);
      analysisResult = await AIModelRouter.analyzeStrategic(
        fullText,
        Math.ceil(fullText.length / 1024 / 1024), // Estimar MB
        workspaceId
      );
    } else {
      // FAST: Análise rápida com Gemini Flash
      console.log(`${ICONS.ZOOMBIN} Executando análise FAST com Gemini Flash...`);
      analysisResult = await AIModelRouter.analyzePhase1(
        fullText,
        Math.ceil(fullText.length / 1024 / 1024), // Estimar MB
        workspaceId
      );
    }

    const processingTime = Date.now() - startTime;

    // Salvar resultado
    await prisma.caseAnalysisVersion.update({
      where: { id: analysisVersionId },
      data: {
        status: 'COMPLETED',
        aiAnalysis: analysisResult.result,
        modelUsed: analysisResult.modelUsed || modelUsed,
        confidence: level === 'FULL' ? 0.95 : 0.85,
        processingTime,
        metadata: {
          level,
          documentCount,
          completedAt: new Date().toISOString(),
          processingTimeMs: processingTime,
          creditsConsumed: level === 'FULL' ? 1 : 0
        }
      }
    });

    // Debitar crédito (mock)
    if (level === 'FULL') {
      await creditService.debitCredits(
        workspaceId,
        1,
        'FULL',
        {
          reason: 'strategic_analysis',
          caseId: processId,
          analysisId: analysisVersionId,
          level
        }
      );
    }

    console.log(
      `${ICONS.SUCCESS} Análise ${analysisVersionId} concluída em ${(processingTime / 1000).toFixed(1)}s`
    );

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro ao processar análise:`, error);

    // Marcar como erro no banco
    await prisma.caseAnalysisVersion.update({
      where: { id: analysisVersionId },
      data: {
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        metadata: {
          error: error instanceof Error ? error.message : 'Erro desconhecido',
          failedAt: new Date().toISOString()
        }
      }
    });

    console.error(`${ICONS.ERROR} Falha na análise ${analysisVersionId}:`, error instanceof Error ? error.message : 'Desconhecido');
  }
}

/**
 * Gera próximo número de versão
 */
async function getNextVersionNumber(processId: string): Promise<number> {
  const lastVersion = await prisma.caseAnalysisVersion.findFirst({
    where: { caseId: processId },
    orderBy: { version: 'desc' },
    select: { version: true }
  });

  return (lastVersion?.version || 0) + 1;
}

