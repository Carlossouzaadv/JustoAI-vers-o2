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
import { CaseAnalysisVersion, AnalysisJob, ProcessStatus, JobStatus } from '@/lib/types/database';

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

/**
 * Safely extracts a number from unknown, with fallback
 */
function safeNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && !isNaN(value)) {
    return value;
  }
  return fallback;
}

/**
 * Safely extracts a string from unknown, with fallback
 */
function safeString(value: unknown, fallback: string): string {
  if (typeof value === 'string') {
    return value;
  }
  return fallback;
}

/**
 * Safely extracts a nullable string from unknown
 */
function safeNullableString(value: unknown): string | null {
  if (typeof value === 'string') {
    return value;
  }
  if (value === null) {
    return null;
  }
  return null;
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

      // Safe extraction of properties from Record<string, unknown>
      const costEstimate = safeNumber(current.costEstimate, 0);
      const confidence = safeNumber(current.confidence, 0);
      const processingTime = safeNumber(current.processingTime, 0);
      const analysisType = safeString(current.analysisType, 'UNKNOWN');
      const modelUsed = safeString(current.modelUsed, 'unknown');
      const errorMessage = safeNullableString(current.error);

      const versionData: ProcessedVersion = {
        id: current.id,
        versionNumber: safeNumber(current.version, 0),
        analysisType,
        modelUsed,
        status: safeString(current.status, 'PENDING') as ProcessStatus,
        creditsUsed: {
          full: costEstimate,
          fast: 0,
          total: costEstimate
        },
        confidenceScore: confidence,
        processingTime,
        sourceFiles: {
          count: current.metadata && typeof current.metadata === 'object' && 'sourceFiles' in current.metadata && Array.isArray(current.metadata.sourceFiles)
            ? current.metadata.sourceFiles.length
            : 0,
          files: current.metadata && typeof current.metadata === 'object' && 'sourceFiles' in current.metadata
            ? current.metadata.sourceFiles
            : null
        },
        createdAt: current.createdAt instanceof Date ? current.createdAt : new Date(String(current.createdAt)),
        createdBy: null,
        reportUrl: null,
        errorMessage,
        isLatest: i === 0,
        diff,
        job: latestJob ? {
          id: latestJob.id,
          status: safeString(latestJob.status, 'PENDING') as JobStatus,
          progress: safeNumber(latestJob.progress, 0),
          startedAt: latestJob.startedAt instanceof Date ? latestJob.startedAt : (latestJob.startedAt ? new Date(String(latestJob.startedAt)) : null),
          finishedAt: latestJob.finishedAt instanceof Date ? latestJob.finishedAt : (latestJob.finishedAt ? new Date(String(latestJob.finishedAt)) : null),
          workerId: safeNullableString(latestJob.workerId),
          retryCount: safeNumber(latestJob.retryCount, 0)
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
        fast: versions.filter((v: VersionWithJobs) => safeString(v.analysisType, '') === 'FAST').length,
        full: versions.filter((v: VersionWithJobs) => safeString(v.analysisType, '') === 'FULL').length
      },
      byStatus: {
        completed: versions.filter((v: VersionWithJobs) => safeString(v.status, '') === 'COMPLETED').length,
        failed: versions.filter((v: VersionWithJobs) => safeString(v.status, '') === 'FAILED').length,
        processing: versions.filter((v: VersionWithJobs) => safeString(v.status, '') === 'PROCESSING').length,
        pending: versions.filter((v: VersionWithJobs) => safeString(v.status, '') === 'PENDING').length
      },
      totalCreditsUsed: {
        full: versions.reduce((sum: number, v: VersionWithJobs) => sum + safeNumber(v.costEstimate, 0), 0),
        fast: 0
      },
      avgConfidence: versions
        .filter((v: VersionWithJobs) => {
          const conf = safeNumber(v.confidence, -1);
          const status = safeString(v.status, '');
          return conf >= 0 && status === 'COMPLETED';
        })
        .reduce((sum: number, v: VersionWithJobs, _: number, arr: VersionWithJobs[]) => {
          const conf = safeNumber(v.confidence, 0);
          return sum + conf / arr.length;
        }, 0),
      dateRange: {
        first: versions[versions.length - 1]?.createdAt instanceof Date
          ? versions[versions.length - 1]?.createdAt
          : (versions[versions.length - 1]?.createdAt ? new Date(String(versions[versions.length - 1]?.createdAt)) : undefined),
        last: versions[0]?.createdAt instanceof Date
          ? versions[0]?.createdAt
          : (versions[0]?.createdAt ? new Date(String(versions[0]?.createdAt)) : undefined)
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

  // Safe extraction of values for comparison
  const prevAnalysisType = safeString(previous.analysisType, '');
  const currAnalysisType = safeString(current.analysisType, '');
  const prevModelUsed = safeString(previous.modelUsed, '');
  const currModelUsed = safeString(current.modelUsed, '');
  const prevConfidence = safeNumber(previous.confidence, 0);
  const currConfidence = safeNumber(current.confidence, 0);
  const prevCredits = safeNumber(previous.costEstimate, 0);
  const currCredits = safeNumber(current.costEstimate, 0);

  // Mudança de tipo de análise
  if (prevAnalysisType !== currAnalysisType) {
    changes.analysisType = {
      changed: true,
      from: prevAnalysisType,
      to: currAnalysisType
    };
    changes.criticalChanges++;
    summaryParts.push(`Tipo: ${prevAnalysisType} → ${currAnalysisType}`);
  }

  // Mudança de modelo
  if (prevModelUsed !== currModelUsed) {
    changes.model = {
      changed: true,
      from: prevModelUsed,
      to: currModelUsed
    };
    changes.criticalChanges++;
    summaryParts.push(`Modelo: ${prevModelUsed} → ${currModelUsed}`);
  }

  // Mudança de confiança
  const confDiff = currConfidence - prevConfidence;
  if (Math.abs(confDiff) > 0.05) { // Mudança significativa > 5%
    changes.confidence = {
      changed: true,
      from: prevConfidence,
      to: currConfidence,
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