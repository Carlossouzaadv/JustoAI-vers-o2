// ================================================================
// API ENDPOINT - Histórico de Versões de Análise
// ================================================================
// GET /api/process/{id}/analysis/versions

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { ICONS } from '@/lib/icons';

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const processId = params.id;

  try {
    console.log(`${ICONS.SEARCH} Buscando histórico de versões para processo: ${processId}`);

    // Buscar todas as versões de análise
    const versions = await prisma.caseAnalysisVersion.findMany({
      where: { caseId: processId },
      orderBy: { version: 'desc' },
      select: {
        id: true,
        version: true,
        status: true,
        analysisType: true,
        modelUsed: true,
        confidence: true,
        processingTime: true,
        createdAt: true,
        updatedAt: true,
        aiAnalysis: true,
        metadata: true,
        error: true
      }
    });

    if (versions.length === 0) {
      return NextResponse.json({
        success: true,
        versions: [],
        totalVersions: 0,
        message: 'Nenhuma análise encontrada para este processo'
      });
    }

    // Calcular diffs entre versões consecutivas
    const versionsWithDiffs = [];

    for (let i = 0; i < versions.length; i++) {
      const currentVersion = versions[i];
      const previousVersion = versions[i + 1]; // Próxima na lista (versão anterior cronologicamente)

      const versionData = {
        ...currentVersion,
        diff: previousVersion ? calculateVersionDiff(currentVersion, previousVersion) : null,
        isLatest: i === 0,
        changes: previousVersion ? summarizeChanges(currentVersion, previousVersion) : null
      };

      versionsWithDiffs.push(versionData);
    }

    console.log(`${ICONS.SUCCESS} Encontradas ${versions.length} versões`);

    return NextResponse.json({
      success: true,
      versions: versionsWithDiffs,
      totalVersions: versions.length,
      latestVersion: versions[0]?.version || 0
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro ao buscar versões:`, error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

/**
 * Calcula diff compacto entre duas versões
 */
function calculateVersionDiff(current: any, previous: any) {
  const diff = {
    analysisType: {
      changed: current.analysisType !== previous.analysisType,
      from: previous.analysisType,
      to: current.analysisType
    },
    model: {
      changed: current.modelUsed !== previous.modelUsed,
      from: previous.modelUsed,
      to: current.modelUsed
    },
    confidence: {
      changed: Math.abs((current.confidence || 0) - (previous.confidence || 0)) > 0.05,
      from: previous.confidence,
      to: current.confidence,
      delta: (current.confidence || 0) - (previous.confidence || 0)
    },
    content: calculateContentDiff(current.aiAnalysis, previous.aiAnalysis)
  };

  return diff;
}

/**
 * Calcula diferenças no conteúdo da análise
 */
function calculateContentDiff(currentAnalysis: any, previousAnalysis: any) {
  if (!currentAnalysis || !previousAnalysis) {
    return {
      contentChanged: true,
      summary: currentAnalysis ? 'Primeira análise' : 'Análise removida'
    };
  }

  const changes = [];

  // Verificar mudanças nos pontos principais
  if (currentAnalysis.keyPoints && previousAnalysis.keyPoints) {
    const currentPoints = Array.isArray(currentAnalysis.keyPoints) ? currentAnalysis.keyPoints : [];
    const previousPoints = Array.isArray(previousAnalysis.keyPoints) ? previousAnalysis.keyPoints : [];

    const newPoints = currentPoints.filter((point: string) => !previousPoints.includes(point));
    const removedPoints = previousPoints.filter((point: string) => !currentPoints.includes(point));

    if (newPoints.length > 0) {
      changes.push(`${newPoints.length} novo${newPoints.length > 1 ? 's' : ''} ponto${newPoints.length > 1 ? 's' : ''} principal${newPoints.length > 1 ? 'is' : ''}`);
    }

    if (removedPoints.length > 0) {
      changes.push(`${removedPoints.length} ponto${removedPoints.length > 1 ? 's' : ''} removido${removedPoints.length > 1 ? 's' : ''}`);
    }
  }

  // Verificar mudança no resumo
  if (currentAnalysis.summary !== previousAnalysis.summary) {
    changes.push('Resumo atualizado');
  }

  // Verificar mudanças na avaliação de risco
  if (currentAnalysis.riskAssessment && previousAnalysis.riskAssessment) {
    if (currentAnalysis.riskAssessment.level !== previousAnalysis.riskAssessment.level) {
      changes.push(`Risco alterado: ${previousAnalysis.riskAssessment.level} → ${currentAnalysis.riskAssessment.level}`);
    }
  }

  return {
    contentChanged: changes.length > 0,
    changes,
    summary: changes.length > 0 ? changes.join(', ') : 'Conteúdo inalterado'
  };
}

/**
 * Resume mudanças críticas entre versões
 */
function summarizeChanges(current: any, previous: any) {
  const changes = [];

  // Mudança de modelo
  if (current.modelUsed !== previous.modelUsed) {
    changes.push({
      type: 'model_upgrade',
      description: `Modelo atualizado: ${previous.modelUsed} → ${current.modelUsed}`,
      impact: 'medium'
    });
  }

  // Mudança de tipo de análise
  if (current.analysisType !== previous.analysisType) {
    changes.push({
      type: 'analysis_type',
      description: `Tipo alterado: ${previous.analysisType} → ${current.analysisType}`,
      impact: 'high'
    });
  }

  // Mudança significativa na confiança
  const confidenceDelta = (current.confidence || 0) - (previous.confidence || 0);
  if (Math.abs(confidenceDelta) > 0.1) {
    changes.push({
      type: 'confidence_change',
      description: `Confiança ${confidenceDelta > 0 ? 'aumentou' : 'diminuiu'}: ${Math.abs(confidenceDelta * 100).toFixed(1)}%`,
      impact: Math.abs(confidenceDelta) > 0.2 ? 'high' : 'medium'
    });
  }

  // Verificar se há novos andamentos detectados
  const currentMetadata = current.metadata || {};
  const previousMetadata = previous.metadata || {};

  if (currentMetadata.documentCount > previousMetadata.documentCount) {
    const newDocs = currentMetadata.documentCount - previousMetadata.documentCount;
    changes.push({
      type: 'new_documents',
      description: `${newDocs} novo${newDocs > 1 ? 's' : ''} documento${newDocs > 1 ? 's' : ''} analisado${newDocs > 1 ? 's' : ''}`,
      impact: 'medium'
    });
  }

  return {
    totalChanges: changes.length,
    criticalChanges: changes.filter(c => c.impact === 'high').length,
    changes,
    hasSignificantChanges: changes.some(c => c.impact === 'high'),
    summary: changes.length > 0 ?
      `${changes.length} mudança${changes.length > 1 ? 's' : ''} detectada${changes.length > 1 ? 's' : ''}` :
      'Nenhuma mudança significativa'
  };
}

/**
 * GET /api/process/{id}/analysis/versions/{versionId}
 * Busca versão específica
 */
export async function GET_VERSION(
  request: NextRequest,
  { params }: { params: { id: string; versionId: string } }
) {
  const { id: processId, versionId } = params;

  try {
    const version = await prisma.caseAnalysisVersion.findFirst({
      where: {
        id: versionId,
        caseId: processId
      }
    });

    if (!version) {
      return NextResponse.json(
        { error: 'Versão não encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      version
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro ao buscar versão específica:`, error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}