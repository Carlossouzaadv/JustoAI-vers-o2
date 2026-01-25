// ================================================================
// API ENDPOINT - Histórico de Versões de Análise
// ================================================================
// GET /api/process/{id}/analysis/versions

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { ICONS } from '@/lib/icons';
import { CaseAnalysisVersion } from '@/lib/types/database';
import { parseAiAnalysis } from '@/lib/services/analysis-parser';

const prisma = new PrismaClient();

// Types
interface VersionDiffDetail {
  analysisType: {
    changed: boolean;
    from: string;
    to: string;
  };
  model: {
    changed: boolean;
    from: string;
    to: string;
  };
  confidence: {
    changed: boolean;
    from: number | null;
    to: number | null;
    delta: number;
  };
  content: {
    contentChanged: boolean;
    changes?: string[];
    summary: string;
  };
}

interface ChangeDetail {
  type: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
}

interface VersionChangeSummary {
  totalChanges: number;
  criticalChanges: number;
  changes: ChangeDetail[];
  hasSignificantChanges: boolean;
  summary: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: processId } = await params;

  try {
    console.log(`${ICONS.SEARCH} Buscando histórico de versões para processo: ${processId}`);

    // Buscar todas as versões de análise
    const versions = await prisma.caseAnalysisVersion.findMany({
      where: { caseId: processId },
      orderBy: { version: 'desc' }
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
 * Type guard to safely extract string field from CaseAnalysisVersion
 */
function getStringField(obj: CaseAnalysisVersion, field: string): string {
  if (field in obj && typeof obj[field] === 'string') {
    return obj[field] as string;
  }
  return '';
}

/**
 * Type guard to safely extract number field from CaseAnalysisVersion
 */
function getNumberField(obj: CaseAnalysisVersion, field: string): number | null {
  if (field in obj) {
    const value = obj[field];
    if (typeof value === 'number') {
      return value;
    }
  }
  return null;
}

/**
 * Calcula diff compacto entre duas versões
 */
function calculateVersionDiff(current: CaseAnalysisVersion, previous: CaseAnalysisVersion): VersionDiffDetail {
  // Safely extract fields with type guards
  const currentAnalysisType = getStringField(current, 'analysisType');
  const previousAnalysisType = getStringField(previous, 'analysisType');
  const currentModelUsed = getStringField(current, 'modelUsed');
  const previousModelUsed = getStringField(previous, 'modelUsed');
  const currentConfidence = getNumberField(current, 'confidence');
  const previousConfidence = getNumberField(previous, 'confidence');

  const diff: VersionDiffDetail = {
    analysisType: {
      changed: currentAnalysisType !== previousAnalysisType,
      from: previousAnalysisType,
      to: currentAnalysisType
    },
    model: {
      changed: currentModelUsed !== previousModelUsed,
      from: previousModelUsed,
      to: currentModelUsed
    },
    confidence: {
      changed: Math.abs((currentConfidence || 0) - (previousConfidence || 0)) > 0.05,
      from: previousConfidence,
      to: currentConfidence,
      delta: (currentConfidence || 0) - (previousConfidence || 0)
    },
    content: calculateContentDiff(
      'aiAnalysis' in current ? parseAiAnalysis(current.aiAnalysis) : null,
      'aiAnalysis' in previous ? parseAiAnalysis(previous.aiAnalysis) : null
    )
  };

  return diff;
}

/**
 * Calcula diferenças no conteúdo da análise
 */
function calculateContentDiff(
  currentAnalysis: unknown,
  previousAnalysis: unknown
): { contentChanged: boolean; changes?: string[]; summary: string } {
  if (!currentAnalysis || !previousAnalysis) {
    return {
      contentChanged: true,
      summary: currentAnalysis ? 'Primeira análise' : 'Análise removida'
    };
  }

  const changes: string[] = [];

  // Type guards for analysis objects
  const isCurrent = typeof currentAnalysis === 'object' && currentAnalysis !== null;
  const isPrevious = typeof previousAnalysis === 'object' && previousAnalysis !== null;

  if (!isCurrent || !isPrevious) {
    return {
      contentChanged: true,
      summary: 'Estrutura de análise inválida'
    };
  }

  // Verificar mudanças nos pontos principais
  if ('keyPoints' in currentAnalysis && 'keyPoints' in previousAnalysis) {
    const currentPoints = Array.isArray(currentAnalysis.keyPoints) ? currentAnalysis.keyPoints : [];
    const previousPoints = Array.isArray(previousAnalysis.keyPoints) ? previousAnalysis.keyPoints : [];

    const newPoints = currentPoints.filter((point: unknown) => !previousPoints.includes(point));
    const removedPoints = previousPoints.filter((point: unknown) => !currentPoints.includes(point));

    if (newPoints.length > 0) {
      changes.push(`${newPoints.length} novo${newPoints.length > 1 ? 's' : ''} ponto${newPoints.length > 1 ? 's' : ''} principal${newPoints.length > 1 ? 'is' : ''}`);
    }

    if (removedPoints.length > 0) {
      changes.push(`${removedPoints.length} ponto${removedPoints.length > 1 ? 's' : ''} removido${removedPoints.length > 1 ? 's' : ''}`);
    }
  }

  // Verificar mudança no resumo
  if ('summary' in currentAnalysis && 'summary' in previousAnalysis) {
    if (currentAnalysis.summary !== previousAnalysis.summary) {
      changes.push('Resumo atualizado');
    }
  }

  // Verificar mudanças na avaliação de risco
  if ('riskAssessment' in currentAnalysis && 'riskAssessment' in previousAnalysis) {
    const currRisk = currentAnalysis.riskAssessment;
    const prevRisk = previousAnalysis.riskAssessment;

    if (currRisk && prevRisk && typeof currRisk === 'object' && typeof prevRisk === 'object' && 'level' in currRisk && 'level' in prevRisk) {
      if (currRisk.level !== prevRisk.level) {
        changes.push(`Risco alterado: ${prevRisk.level} → ${currRisk.level}`);
      }
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
function summarizeChanges(current: CaseAnalysisVersion, previous: CaseAnalysisVersion): VersionChangeSummary {
  const changes: ChangeDetail[] = [];

  // Safely extract fields with type guards
  const currentModelUsed = getStringField(current, 'modelUsed');
  const previousModelUsed = getStringField(previous, 'modelUsed');
  const currentAnalysisType = getStringField(current, 'analysisType');
  const previousAnalysisType = getStringField(previous, 'analysisType');
  const currentConfidence = getNumberField(current, 'confidence');
  const previousConfidence = getNumberField(previous, 'confidence');

  // Mudança de modelo
  if (currentModelUsed !== previousModelUsed) {
    changes.push({
      type: 'model_upgrade',
      description: `Modelo atualizado: ${previousModelUsed} → ${currentModelUsed}`,
      impact: 'medium'
    });
  }

  // Mudança de tipo de análise
  if (currentAnalysisType !== previousAnalysisType) {
    changes.push({
      type: 'analysis_type',
      description: `Tipo alterado: ${previousAnalysisType} → ${currentAnalysisType}`,
      impact: 'high'
    });
  }

  // Mudança significativa na confiança
  const confidenceDelta = (currentConfidence || 0) - (previousConfidence || 0);
  if (Math.abs(confidenceDelta) > 0.1) {
    changes.push({
      type: 'confidence_change',
      description: `Confiança ${confidenceDelta > 0 ? 'aumentou' : 'diminuiu'}: ${Math.abs(confidenceDelta * 100).toFixed(1)}%`,
      impact: Math.abs(confidenceDelta) > 0.2 ? 'high' : 'medium'
    });
  }

  // Verificar se há novos andamentos detectados (metadata is Json type)
  const currentMetadata = current.metadata && typeof current.metadata === 'object' && current.metadata !== null ? current.metadata : {};
  const previousMetadata = previous.metadata && typeof previous.metadata === 'object' && previous.metadata !== null ? previous.metadata : {};

  if ('documentCount' in currentMetadata && 'documentCount' in previousMetadata &&
      typeof currentMetadata.documentCount === 'number' && typeof previousMetadata.documentCount === 'number' &&
      currentMetadata.documentCount > previousMetadata.documentCount) {
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
 * TODO: Implementar com rota dinâmica separada: /process/[id]/analysis/versions/[versionId]/route.ts
 * Next.js 15 não suporta exports com nomes customizados como GET_VERSION
 */