// ================================================================
// API ENDPOINT - Análise IA (GET análises / POST criar nova)
// ================================================================
// GET  /api/process/{id}/analysis - Recuperar análises salvas
// POST /api/process/{id}/analysis?level=FAST|FULL - Gerar nova análise

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getAnalysisCacheManager } from '@/lib/analysis-cache';
import { getCreditManager } from '@/lib/credit-system';
import { ICONS } from '@/lib/icons';

const prisma = new PrismaClient();
const cacheManager = getAnalysisCacheManager();

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
    const { level, includeDocuments = true, includeTimeline = true, uploadedFile, workspaceId } = body;

    // Validate required fields
    if (!workspaceId) {
      return NextResponse.json(
        { error: 'workspaceId é obrigatório' },
        { status: 400 }
      );
    }

    // Validar nível
    if (!['FAST', 'FULL'].includes(level)) {
      return NextResponse.json(
        { error: 'Nível de análise deve ser FAST ou FULL' },
        { status: 400 }
      );
    }

    // 1. Buscar última movimentação para cache
    const lastMovementDate = await cacheManager.getLastMovementDate(processId, prisma);
    console.log(`${ICONS.INFO} Última movimentação: ${lastMovementDate?.toISOString() || 'nenhuma'}`);

    // 2. Buscar documentos
    let documentHashes: string[] = [];

    if (level === 'FAST') {
      // FAST: usar documentos já anexados
      documentHashes = await cacheManager.getProcessDocumentHashes(processId, prisma);
      console.log(`${ICONS.SEARCH} FAST - Usando ${documentHashes.length} documentos existentes`);

      if (documentHashes.length === 0) {
        return NextResponse.json(
          {
            error: 'Nenhum documento encontrado para análise FAST',
            suggestion: 'Use a opção FULL para fazer upload do PDF completo'
          },
          { status: 400 }
        );
      }
    } else if (level === 'FULL') {
      // FULL: usar arquivo uploaded (se fornecido) + documentos existentes
      if (uploadedFile) {
        // TODO: Processar arquivo uploaded e gerar hash
        console.log(`${ICONS.SUCCESS} FULL - Processando arquivo uploaded: ${uploadedFile}`);
      }

      // Incluir documentos existentes também
      const existingHashes = await cacheManager.getProcessDocumentHashes(processId, prisma);
      documentHashes = [...existingHashes];

      console.log(`${ICONS.SEARCH} FULL - Usando ${documentHashes.length} documentos total`);
    }

    // 3. Configurar modelo e prompt baseado no nível
    const modelVersion = level === 'FULL' ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
    const promptSignature = generatePromptSignature(level, includeDocuments, includeTimeline);

    console.log(`${ICONS.INFO} Configuração: ${level} | ${modelVersion} | prompt: ${promptSignature}`);

    // 4. Verificar cache
    const cacheResult = await cacheManager.checkAnalysisCache(
      documentHashes,
      modelVersion,
      promptSignature,
      lastMovementDate
    );

    // 5. Calcular custos de crédito (antes do cache hit para logs)
    const creditSystem = getCreditManager(prisma);
    const processCount = documentHashes.length || 1; // Pelo menos 1 processo

    let reportCreditsRequired = 0;
    let fullCreditsRequired = 0;

    if (level === 'FAST') {
      reportCreditsRequired = creditSystem.calculateReportCreditCost(processCount);
    } else if (level === 'FULL') {
      fullCreditsRequired = Math.ceil(processCount / 10); // 10 processes per FULL credit
    }

    console.log(`${ICONS.INFO} Custos calculados: ${reportCreditsRequired} report + ${fullCreditsRequired} full credits`);

    if (cacheResult.hit) {
      console.log(`${ICONS.SUCCESS} Cache HIT - Retornando análise cacheada (sem cobrança)`);

      // Criar nova versão no banco apontando para o cache
      const analysisVersion = await prisma.caseAnalysisVersion.create({
        data: {
          caseId: processId,
          version: await getNextVersionNumber(processId),
          status: 'COMPLETED',
          analysisType: level,
          modelUsed: modelVersion,
          aiAnalysis: cacheResult.data,
          confidence: 0.95,
          processingTime: 100, // Cache é rápido
          metadata: {
            source: 'cache',
            cacheAge: cacheResult.age,
            level,
            documentCount: documentHashes.length
          }
        }
      });

      return NextResponse.json({
        success: true,
        analysisId: analysisVersion.id,
        source: 'cache',
        level,
        model: modelVersion,
        processingTime: 100
      });
    }

    // 6. Verificar saldo de créditos antes do processamento
    const balanceResult = await creditSystem.getWorkspaceCredits(workspaceId);
    if (!balanceResult.success) {
      return NextResponse.json(
        { error: 'Erro ao verificar saldo de créditos' },
        { status: 500 }
      );
    }

    const { reportCreditsBalance, fullCreditsBalance } = balanceResult.credits!;

    // Verificar se há créditos suficientes
    if (reportCreditsRequired > reportCreditsBalance) {
      return NextResponse.json(
        {
          error: 'Créditos report insuficientes',
          required: reportCreditsRequired,
          available: reportCreditsBalance,
          creditType: 'report'
        },
        { status: 402 } // Payment Required
      );
    }

    if (fullCreditsRequired > fullCreditsBalance) {
      return NextResponse.json(
        {
          error: 'Créditos FULL insuficientes',
          required: fullCreditsRequired,
          available: fullCreditsBalance,
          creditType: 'full'
        },
        { status: 402 } // Payment Required
      );
    }

    console.log(`${ICONS.SUCCESS} Créditos suficientes - Prosseguindo com análise`);

    // 7. Adquirir lock para evitar double-processing
    const lockResult = await cacheManager.acquireLock(cacheResult.key);

    if (!lockResult.acquired) {
      console.log(`${ICONS.WARNING} Lock não adquirido - processamento em andamento`);
      return NextResponse.json(
        {
          error: 'Análise já está sendo processada',
          retryIn: lockResult.ttl
        },
        { status: 429 }
      );
    }

    try {
      console.log(`${ICONS.SUCCESS} Lock adquirido - iniciando processamento`);

      // 8. Consumir créditos ANTES do processamento
      const debitResult = await creditSystem.debitCredits(
        workspaceId,
        reportCreditsRequired,
        fullCreditsRequired,
        `Análise ${level} - Processo ${processId}`,
        {
          processId,
          level,
          modelUsed: modelVersion,
          documentCount: documentHashes.length
        }
      );

      if (!debitResult.success) {
        console.error(`${ICONS.ERROR} Falha ao debitar créditos:`, debitResult.error);
        return NextResponse.json(
          { error: 'Erro ao consumir créditos: ' + debitResult.error },
          { status: 500 }
        );
      }

      console.log(`${ICONS.SUCCESS} Créditos debitados: ${reportCreditsRequired}R + ${fullCreditsRequired}F`);

      // 9. Incrementar caseAnalysisVersion
      const nextVersion = await getNextVersionNumber(processId);

      const analysisVersion = await prisma.caseAnalysisVersion.create({
        data: {
          caseId: processId,
          version: nextVersion,
          status: 'PROCESSING',
          analysisType: level,
          modelUsed: modelVersion,
          metadata: {
            level,
            documentCount: documentHashes.length,
            lastMovementDate: lastMovementDate?.toISOString(),
            startedAt: new Date().toISOString(),
            creditCost: {
              reportCredits: reportCreditsRequired,
              fullCredits: fullCreditsRequired,
              allocationsUsed: debitResult.allocationsUsed
            }
          }
        }
      });

      console.log(`${ICONS.SUCCESS} Versão ${nextVersion} criada no banco`);

      // 10. Processar análise em background
      processAnalysisInBackground(
        analysisVersion.id,
        processId,
        level,
        documentHashes,
        modelVersion,
        promptSignature,
        lastMovementDate,
        cacheResult.key,
        lockResult.lockKey,
        workspaceId,
        reportCreditsRequired,
        fullCreditsRequired
      ).catch(error => {
        console.error(`${ICONS.ERROR} Erro no processamento background:`, error);
      });

      // 8. Criar event entry no process timeline
      await createTimelineEvent(processId, level, nextVersion);

      return NextResponse.json({
        success: true,
        analysisId: analysisVersion.id,
        source: 'processing',
        level,
        model: modelVersion,
        version: nextVersion,
        estimatedTime: level === 'FULL' ? '2-3 minutos' : '30-60 segundos'
      });

    } catch (error) {
      // Liberar lock em caso de erro
      await cacheManager.releaseLock(lockResult.lockKey);
      throw error;
    }

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro na análise:`, error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

/**
 * Processa análise em background
 */
async function processAnalysisInBackground(
  analysisVersionId: string,
  processId: string,
  level: 'FAST' | 'FULL',
  documentHashes: string[],
  modelVersion: string,
  promptSignature: string,
  lastMovementDate: Date | null,
  cacheKey: string,
  lockKey: string,
  workspaceId: string,
  reportCreditsRequired: number,
  fullCreditsRequired: number
) {
  try {
    console.log(`${ICONS.PROCESS} Iniciando processamento background para ${analysisVersionId}`);

    // Simular processamento (em produção, chamar Gemini aqui)
    const processingTime = level === 'FULL' ? 8000 : 3000;

    await new Promise(resolve => setTimeout(resolve, processingTime));

    // Mock result baseado no nível
    const mockResult = generateMockAnalysis(level);

    // Salvar resultado no banco
    await prisma.caseAnalysisVersion.update({
      where: { id: analysisVersionId },
      data: {
        status: 'COMPLETED',
        aiAnalysis: mockResult,
        confidence: level === 'FULL' ? 0.95 : 0.85,
        processingTime,
        updatedAt: new Date()
      }
    });

    // Salvar no cache
    await cacheManager.saveAnalysisCache(
      documentHashes,
      modelVersion,
      promptSignature,
      mockResult,
      lastMovementDate,
      workspaceId
    );

    // Log usage event
    const creditSystem = getCreditManager(prisma);
    await creditSystem.logUsageEvent({
      workspaceId,
      eventType: 'analysis_completed',
      resourceType: level === 'FULL' ? 'full_analysis' : 'analysis',
      resourceId: processId,
      reportCreditsCost: reportCreditsRequired,
      fullCreditsCost: fullCreditsRequired,
      status: 'completed',
      metadata: {
        analysisVersionId,
        level,
        modelUsed: modelVersion,
        processingTime,
        documentCount: documentHashes.length
      }
    });

    console.log(`${ICONS.SUCCESS} Análise ${analysisVersionId} concluída e cacheada`);

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro no processamento:`, error);

    // Marcar como erro no banco
    await prisma.caseAnalysisVersion.update({
      where: { id: analysisVersionId },
      data: {
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }
    });

    // Log failed usage event
    const creditSystem = getCreditManager(prisma);
    await creditSystem.logUsageEvent({
      workspaceId,
      eventType: 'analysis_failed',
      resourceType: level === 'FULL' ? 'full_analysis' : 'analysis',
      resourceId: processId,
      reportCreditsCost: reportCreditsRequired,
      fullCreditsCost: fullCreditsRequired,
      status: 'failed',
      metadata: {
        analysisVersionId,
        level,
        modelUsed: modelVersion,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        documentCount: documentHashes.length
      }
    });
  } finally {
    // Sempre liberar lock
    await cacheManager.releaseLock(lockKey);
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

/**
 * Gera signature do prompt
 */
function generatePromptSignature(level: string, includeDocuments: boolean, includeTimeline: boolean): string {
  const promptConfig = { level, includeDocuments, includeTimeline };
  const combined = JSON.stringify(promptConfig);
  return require('crypto').createHash('sha256').update(combined).digest('hex').substring(0, 16);
}

/**
 * Cria evento na timeline do processo
 */
async function createTimelineEvent(processId: string, level: string, version: number) {
  try {
    await prisma.processTimelineEntry.create({
      data: {
        caseId: processId,
        contentHash: `analysis_${level}_v${version}_${Date.now()}`,
        eventDate: new Date(),
        eventType: 'ANÁLISE_IA',
        description: `Análise ${level} gerada - Versão ${version}`,
        normalizedContent: `Análise por IA nivel ${level} versão ${version}`,
        source: 'AI_EXTRACTION',
        confidence: 1.0,
        metadata: {
          analysisLevel: level,
          version,
          generatedAt: new Date().toISOString()
        }
      }
    });
  } catch (error) {
    console.error(`${ICONS.ERROR} Erro ao criar evento timeline:`, error);
  }
}

/**
 * Gera análise mock baseada no nível
 */
function generateMockAnalysis(level: 'FAST' | 'FULL') {
  const baseAnalysis = {
    summary: `Análise ${level} - Processo com fundamentação sólida`,
    keyPoints: [
      'Documentação adequada para o tipo de ação',
      'Jurisprudência favorável identificada',
      `Análise ${level} - ${level === 'FULL' ? 'Completa e detalhada' : 'Baseada em documentos existentes'}`
    ],
    confidence: level === 'FULL' ? 0.95 : 0.85,
    model: level === 'FULL' ? 'gemini-2.5-pro' : 'gemini-2.5-flash',
    level
  };

  if (level === 'FULL') {
    return {
      ...baseAnalysis,
      detailedAnalysis: {
        strengths: ['Análise completa com documento integral', 'Maior precisão'],
        weaknesses: ['Identificados pontos de atenção específicos'],
        recommendations: ['Estratégias baseadas em análise completa']
      },
      riskAssessment: {
        level: 'medium',
        factors: ['Análise detalhada do processo completo'],
        confidence: 0.95
      }
    };
  }

  return baseAnalysis;
}