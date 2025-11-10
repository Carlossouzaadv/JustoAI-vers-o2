// ================================================================
// API ENDPOINT - Histórico de Análises
// ================================================================
// GET /process/{id}/analysis/history
// Lista versões de análise com diff entre versões

import { NextRequest, NextResponse } from 'next/server';
import { successResponse, errorResponse, requireAuth, withErrorHandler } from '@/lib/api-utils';
import { DeepAnalysisService } from '@/lib/deep-analysis-service';
import { prisma } from '@/lib/prisma';
import { ICONS } from '@/lib/icons';
import type { CaseAnalysisVersion, AnalysisJob, ProcessStatus, JobStatus } from '@prisma/client';

// ================================================================
// TYPE GUARDS & HELPERS (Padrão-Ouro - Type Safety)
// ================================================================

/**
 * Type guard: Validates that params contains the required 'id' field
 */
function isRouteParams(params: unknown): params is { id: string } {
  if (typeof params !== 'object' || params === null) {
    return false;
  }
  const p = params as Record<string, unknown>;
  return 'id' in p && typeof p.id === 'string';
}

// Types
type VersionWithJobs = CaseAnalysisVersion & {
  jobs: AnalysisJob[];
};

interface VersionDiff {
  analysisType?: {
    changed: boolean;
    from: string;
    to: string;
  };
  model?: {
    changed: boolean;
    from: string;
    to: string;
  };
  confidence?: {
    changed: boolean;
    from: number | null;
    to: number | null;
    delta: number;
  };
  sourceFiles?: {
    changed: boolean;
    from: number;
    to: number;
    delta: number;
  };
  creditsUsed?: {
    changed: boolean;
    from: number;
    to: number;
    delta: number;
  };
  totalChanges: number;
  criticalChanges: number;
  summary: string;
}

interface ProcessedVersion {
  id: string;
  versionNumber: number;
  analysisType: string;
  modelUsed: string;
  status: ProcessStatus;
  creditsUsed: {
    full: number;
    fast: number;
    total: number;
  };
  confidenceScore: number;
  processingTime: number;
  sourceFiles: {
    count: number;
    files: unknown;
  };
  createdAt: Date;
  createdBy: string | null;
  reportUrl: string | null;
  errorMessage: string | null;
  isLatest: boolean;
  diff: VersionDiff | null;
  job: {
    id: string;
    status: JobStatus;
    progress: number;
    startedAt: Date | null;
    finishedAt: Date | null;
    workerId: string | null;
    retryCount: number;
  } | null;
  content?: {
    summary: unknown;
    insights: unknown;
  };
}

export const GET = withErrorHandler(async (
  request: NextRequest,
  context?: { params: Promise<Record<string, string>> }
) => {
  if (!context?.params) {
    return errorResponse('Process ID is required', 400);
  }

  // Type narrowing: Extract and validate params
  const resolvedParams = await context.params;
  if (!isRouteParams(resolvedParams)) {
    return errorResponse('Invalid route parameters', 400);
  }
  const { id: processId } = resolvedParams;
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId');
  const includeContent = searchParams.get('includeContent') === 'true';

  if (!workspaceId) {
    return errorResponse('workspaceId é obrigatório', 400);
  }

  // Auth check
  const { user, error: authError } = await requireAuth(request);
  if (authError) return authError;

  console.log(`${ICONS.PROCESS} Buscando histórico de análises para processo: ${processId}`);

  try {
    const analysisService = new DeepAnalysisService();

    // Verificar acesso ao processo
    const hasAccess = await analysisService.validateProcessAccess(processId, workspaceId);
    if (!hasAccess) {
      return errorResponse('Processo não encontrado ou acesso negado', 404);
    }

    // Buscar todas as versões de análise
    const versions = await prisma.caseAnalysisVersion.findMany({
      where: {
        caseId: processId,
        workspaceId
      },
      orderBy: { version: 'desc' },
      include: {
        jobs: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (versions.length === 0) {
      return successResponse({
        hasHistory: false,
        totalVersions: 0,
        versions: [],
        message: 'Nenhuma análise encontrada para este processo'
      });
    }

    // Processar versões com diff
    const processedVersions: ProcessedVersion[] = [];

    for (let i = 0; i < versions.length; i++) {
      const current = versions[i];
      const previous = i < versions.length - 1 ? versions[i + 1] : null;

      // Calcular diff se houver versão anterior
      const diff = previous ? calculateVersionDiff(previous, current) : null;

      // Buscar job mais recente para esta versão
      const latestJob = current.jobs[0] || null;

      const versionData: ProcessedVersion = {
        id: current.id,
        versionNumber: current.version,
        analysisType: current.analysisType,
        modelUsed: current.modelUsed,
        status: current.status,
        creditsUsed: {
          full: current.costEstimate,
          fast: 0,
          total: current.costEstimate
        },
        confidenceScore: current.confidence,
        processingTime: current.processingTime,
        sourceFiles: {
          count: current.metadata && typeof current.metadata === 'object' && 'sourceFiles' in current.metadata && Array.isArray(current.metadata.sourceFiles)
            ? current.metadata.sourceFiles.length
            : 0,
          files: current.metadata && typeof current.metadata === 'object' && 'sourceFiles' in current.metadata
            ? current.metadata.sourceFiles
            : null
        },
        createdAt: current.createdAt,
        createdBy: null,
        reportUrl: null,
        errorMessage: current.error,
        isLatest: i === 0,
        diff,
        job: latestJob ? {
          id: latestJob.id,
          status: latestJob.status,
          progress: latestJob.progress,
          startedAt: latestJob.startedAt,
          finishedAt: latestJob.finishedAt,
          workerId: latestJob.workerId,
          retryCount: latestJob.retryCount
        } : null
      };

      // Incluir conteúdo completo se solicitado
      if (includeContent && current.status === 'COMPLETED') {
        versionData.content = {
          summary: current.aiAnalysis,
          insights: current.extractedData
        };
      }

      processedVersions.push(versionData);
    }

    // Estatísticas gerais
    const stats = {
      totalVersions: versions.length,
      byType: {
        fast: versions.filter(v => v.analysisType === 'FAST').length,
        full: versions.filter(v => v.analysisType === 'FULL').length
      },
      byStatus: {
        completed: versions.filter(v => v.status === 'COMPLETED').length,
        failed: versions.filter(v => v.status === 'FAILED').length,
        processing: versions.filter(v => v.status === 'PROCESSING').length,
        pending: versions.filter(v => v.status === 'PENDING').length
      },
      totalCreditsUsed: {
        full: versions.reduce((sum, v) => sum + v.costEstimate, 0),
        fast: 0
      },
      avgConfidence: versions
        .filter(v => v.confidence && v.status === 'COMPLETED')
        .reduce((sum, v, _, arr) => sum + v.confidence / arr.length, 0),
      dateRange: {
        first: versions[versions.length - 1]?.createdAt,
        last: versions[0]?.createdAt
      }
    };

    console.log(`${ICONS.SUCCESS} Histórico carregado: ${versions.length} versões`);

    return successResponse({
      hasHistory: true,
      stats,
      versions: processedVersions,
      meta: {
        processId,
        includeContent,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro ao buscar histórico de análises:`, error);
    return errorResponse(
      error instanceof Error ? error.message : 'Erro interno do servidor',
      500
    );
  }
});

/**
 * Calcula diff entre duas versões de análise
 */
function calculateVersionDiff(previous: VersionWithJobs, current: VersionWithJobs): VersionDiff {
  const changes: VersionDiff = {
    totalChanges: 0,
    criticalChanges: 0,
    summary: ''
  };

  const summaryParts: string[] = [];

  // Mudança de tipo de análise
  if (previous.analysisType !== current.analysisType) {
    changes.analysisType = {
      changed: true,
      from: previous.analysisType,
      to: current.analysisType
    };
    changes.criticalChanges++;
    summaryParts.push(`Tipo: ${previous.analysisType} → ${current.analysisType}`);
  }

  // Mudança de modelo
  if (previous.modelUsed !== current.modelUsed) {
    changes.model = {
      changed: true,
      from: previous.modelUsed,
      to: current.modelUsed
    };
    changes.criticalChanges++;
    summaryParts.push(`Modelo: ${previous.modelUsed} → ${current.modelUsed}`);
  }

  // Mudança de confiança
  const confDiff = current.confidence - previous.confidence;
  if (Math.abs(confDiff) > 0.05) { // Mudança significativa > 5%
    changes.confidence = {
      changed: true,
      from: previous.confidence,
      to: current.confidence,
      delta: confDiff
    };
    changes.totalChanges++;

    if (confDiff > 0) {
      summaryParts.push(`Confiança aumentou: +${(confDiff * 100).toFixed(1)}%`);
    } else {
      summaryParts.push(`Confiança diminuiu: ${(confDiff * 100).toFixed(1)}%`);
    }
  }

  // Helper to get source files count from metadata
  const getSourceFilesCount = (version: VersionWithJobs): number => {
    if (version.metadata && typeof version.metadata === 'object' && 'sourceFiles' in version.metadata && Array.isArray(version.metadata.sourceFiles)) {
      return version.metadata.sourceFiles.length;
    }
    return 0;
  };

  // Mudança no número de arquivos
  const prevFiles = getSourceFilesCount(previous);
  const currFiles = getSourceFilesCount(current);

  if (prevFiles !== currFiles) {
    changes.sourceFiles = {
      changed: true,
      from: prevFiles,
      to: currFiles,
      delta: currFiles - prevFiles
    };
    changes.totalChanges++;

    if (currFiles > prevFiles) {
      summaryParts.push(`+${currFiles - prevFiles} arquivo(s)`);
    } else {
      summaryParts.push(`-${prevFiles - currFiles} arquivo(s)`);
    }
  }

  // Mudança nos créditos usados
  const prevCredits = previous.costEstimate;
  const currCredits = current.costEstimate;

  if (prevCredits !== currCredits) {
    changes.creditsUsed = {
      changed: true,
      from: prevCredits,
      to: currCredits,
      delta: currCredits - prevCredits
    };
    changes.totalChanges++;

    if (currCredits > prevCredits) {
      summaryParts.push(`+${(currCredits - prevCredits).toFixed(2)} créditos`);
    }
  }

  // Gerar resumo
  if (summaryParts.length > 0) {
    changes.summary = summaryParts.join(', ');
    changes.totalChanges = Math.max(changes.totalChanges, summaryParts.length);
  } else {
    changes.summary = 'Nenhuma mudança significativa detectada';
  }

  return changes;
}