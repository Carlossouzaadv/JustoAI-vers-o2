// ================================================================
// API ENDPOINT - Análise por Versão
// ================================================================
// GET /process/{id}/analysis/{version}
// Retorna análise específica por número de versão

import { NextRequest } from 'next/server';
import { successResponse, errorResponse, requireAuth, withErrorHandler } from '@/lib/api-utils';
import { DeepAnalysisService } from '@/lib/deep-analysis-service';
import { prisma } from '@/lib/prisma';
import { ICONS } from '@/lib/icons';
import { CaseAnalysisVersion } from '@/lib/types/database';

export const GET = withErrorHandler(async (
  request: NextRequest,
  context?: { params: Promise<Record<string, string>> }
) => {
  if (!context) {
    return errorResponse('Missing route parameters', 500);
  }
  const params = await context.params;
  const { id: processId, version } = params;
  const versionNumber = parseInt(version);
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId');

  if (!workspaceId) {
    return errorResponse('workspaceId é obrigatório', 400);
  }

  if (isNaN(versionNumber) || versionNumber < 1) {
    return errorResponse('Número de versão inválido', 400);
  }

  // Auth check
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  console.log(`${ICONS.PROCESS} Buscando análise v${versionNumber} para processo: ${processId}`);

  try {
    const analysisService = new DeepAnalysisService();

    // Verificar acesso ao processo
    const hasAccess = await analysisService.validateProcessAccess(processId, workspaceId);
    if (!hasAccess) {
      return errorResponse('Processo não encontrado ou acesso negado', 404);
    }

    // Buscar versão específica
    const analysis = await prisma.caseAnalysisVersion.findFirst({
      where: {
        caseId: processId,
        workspaceId,
        version: versionNumber
      },
      include: {
        jobs: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!analysis) {
      return errorResponse(`Análise versão ${versionNumber} não encontrada`, 404);
    }

    // Buscar versão anterior para diff
    const previousAnalysis = await prisma.caseAnalysisVersion.findFirst({
      where: {
        caseId: processId,
        workspaceId,
        version: versionNumber - 1
      }
    });

    // Calcular diff se houver versão anterior
    const diff = previousAnalysis ? calculateVersionDiff(previousAnalysis, analysis) : null;

    // Job mais recente
    const latestJob = analysis.jobs[0] || null;

    // Preparar resposta
    const responseData = {
      analysis: {
        id: analysis.id,
        processId: analysis.caseId,
        versionNumber: analysis.version,
        analysisType: analysis.analysisType,
        modelUsed: analysis.modelUsed,
        status: analysis.status,
        creditsUsed: {
          full: 0, // Not available in schema
          fast: 0, // Not available in schema
          total: analysis.costEstimate
        },
        content: {
          summary: analysis.aiAnalysis,
          insights: analysis.extractedData
        },
        confidenceScore: analysis.confidence,
        processingTime: analysis.processingTime,
        sourceFiles: {
          count: 0, // Not available in schema
          files: []  // Not available in schema
        },
        reportUrl: null, // Not available in schema
        analysisKey: analysis.analysisKey,
        createdAt: analysis.createdAt,
        updatedAt: analysis.updatedAt,
        createdBy: null, // Not available in schema
        errorMessage: analysis.error
      },
      job: latestJob ? {
        id: latestJob.id,
        status: latestJob.status,
        progress: latestJob.progress,
        startedAt: latestJob.startedAt,
        finishedAt: latestJob.finishedAt,
        workerId: latestJob.workerId,
        retryCount: latestJob.retryCount,
        metadata: latestJob.metadata
      } : null,
      diff,
      context: {
        isLatest: await isLatestVersion(processId, versionNumber),
        hasPrevious: !!previousAnalysis,
        hasNext: await hasNextVersion(processId, versionNumber)
      }
    };

    console.log(`${ICONS.SUCCESS} Análise v${versionNumber} carregada`);

    return successResponse(responseData);

  } catch (_error) {
    console.error(`${ICONS.ERROR} Erro ao buscar análise:`, error);
    return errorResponse(
      error instanceof Error ? error.message : 'Erro interno do servidor',
      500
    );
  }
});

/**
 * Verifica se é a versão mais recente
 */
async function isLatestVersion(processId: string, versionNumber: number): Promise<boolean> {
  try {
    const latest = await prisma.caseAnalysisVersion.findFirst({
      where: { caseId: processId },
      orderBy: { version: 'desc' },
      select: { version: true }
    });

    return latest?.version === versionNumber;
  } catch (_error) {
    return false;
  }
}

/**
 * Verifica se existe próxima versão
 */
async function hasNextVersion(processId: string, versionNumber: number): Promise<boolean> {
  try {
    const next = await prisma.caseAnalysisVersion.findFirst({
      where: {
        caseId: processId,
        version: { gt: versionNumber }
      }
    });

    return !!next;
  } catch (_error) {
    return false;
  }
}

interface VersionDiff {
  analysisType?: {
    from: string;
    to: string;
  };
  model?: {
    from: string;
    to: string;
  };
  confidence?: {
    from: number;
    to: number;
    delta: number;
  };
  totalChanges: number;
  summary: string;
}

/**
 * Safely extracts a string property from unknown object
 */
function getStringProperty(obj: unknown, prop: string): string {
  if (typeof obj !== 'object' || obj === null) {
    return '';
  }
  const value = (obj as Record<string, unknown>)[prop];
  return typeof value === 'string' ? value : '';
}

/**
 * Safely extracts a number property from unknown object
 */
function getNumberProperty(obj: unknown, prop: string): number | null {
  if (typeof obj !== 'object' || obj === null) {
    return null;
  }
  const value = (obj as Record<string, unknown>)[prop];
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

/**
 * Calcula diff entre duas versões (simplificado)
 */
function calculateVersionDiff(
  previous: CaseAnalysisVersion,
  current: CaseAnalysisVersion
): VersionDiff {
  const changes: Partial<VersionDiff> = {
    totalChanges: 0,
    summary: ''
  };

  const summaryParts: string[] = [];

  // Extract properties safely
  const prevAnalysisType = getStringProperty(previous, 'analysisType');
  const currAnalysisType = getStringProperty(current, 'analysisType');
  const prevModelUsed = getStringProperty(previous, 'modelUsed');
  const currModelUsed = getStringProperty(current, 'modelUsed');
  const prevConfidence = getNumberProperty(previous, 'confidence');
  const currConfidence = getNumberProperty(current, 'confidence');

  // Tipo de análise
  if (prevAnalysisType && currAnalysisType && prevAnalysisType !== currAnalysisType) {
    changes.analysisType = {
      from: prevAnalysisType,
      to: currAnalysisType
    };
    summaryParts.push(`Tipo: ${prevAnalysisType} → ${currAnalysisType}`);
  }

  // Modelo
  if (prevModelUsed && currModelUsed && prevModelUsed !== currModelUsed) {
    changes.model = {
      from: prevModelUsed,
      to: currModelUsed
    };
    summaryParts.push(`Modelo alterado`);
  }

  // Confiança
  if (prevConfidence !== null && currConfidence !== null) {
    const confDiff = currConfidence - prevConfidence;
    if (Math.abs(confDiff) > 0.05) {
      changes.confidence = {
        from: prevConfidence,
        to: currConfidence,
        delta: confDiff
      };

      if (confDiff > 0) {
        summaryParts.push(`Confiança melhorou`);
      } else {
        summaryParts.push(`Confiança diminuiu`);
      }
    }
  }

  const totalChanges = summaryParts.length;
  const summary = summaryParts.length > 0
    ? summaryParts.join(', ')
    : 'Nenhuma mudança estrutural detectada';

  return {
    ...changes,
    totalChanges,
    summary
  } as VersionDiff;
}