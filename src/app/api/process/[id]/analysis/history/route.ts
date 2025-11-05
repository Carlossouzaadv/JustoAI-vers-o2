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

export const GET = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: processId } = await params;
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
        processId,
        workspaceId
      },
      orderBy: { versionNumber: 'desc' },
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
    const processedVersions = [];

    for (let i = 0; i < versions.length; i++) {
      const current = versions[i];
      const previous = i < versions.length - 1 ? versions[i + 1] : null;

      // Calcular diff se houver versão anterior
      const diff = previous ? calculateVersionDiff(previous, current) : null;

      // Buscar job mais recente para esta versão
      const latestJob = current.jobs[0] || null;

      const versionData: unknown = {
        id: current.id,
        versionNumber: current.versionNumber,
        analysisType: current.analysisType,
        modelUsed: current.modelUsed,
        status: current.status,
        creditsUsed: {
          full: current.fullCreditsUsed,
          fast: current.fastCreditsUsed,
          total: Number(current.fullCreditsUsed) + Number(current.fastCreditsUsed)
        },
        confidenceScore: current.confidenceScore,
        processingTime: current.processingTimeMs,
        sourceFiles: {
          count: Array.isArray(current.sourceFilesMetadata) ? current.sourceFilesMetadata.length : 0,
          files: current.sourceFilesMetadata
        },
        createdAt: current.createdAt,
        createdBy: current.createdBy,
        reportUrl: current.reportUrl,
        errorMessage: current.errorMessage,
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
          summary: current.summaryJson,
          insights: current.insightsJson
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
        full: versions.reduce((sum, v) => sum + Number(v.fullCreditsUsed), 0),
        fast: versions.reduce((sum, v) => sum + Number(v.fastCreditsUsed), 0)
      },
      avgConfidence: versions
        .filter(v => v.confidenceScore && v.status === 'COMPLETED')
        .reduce((sum, v, _, arr) => sum + Number(v.confidenceScore!) / arr.length, 0),
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
function calculateVersionDiff(previous: unknown, current: unknown): unknown {
  const changes: unknown = {
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
  if (previous.confidenceScore && current.confidenceScore) {
    const confDiff = Number(current.confidenceScore) - Number(previous.confidenceScore);
    if (Math.abs(confDiff) > 0.05) { // Mudança significativa > 5%
      changes.confidence = {
        changed: true,
        from: previous.confidenceScore,
        to: current.confidenceScore,
        delta: confDiff
      };
      changes.totalChanges++;

      if (confDiff > 0) {
        summaryParts.push(`Confiança aumentou: +${(confDiff * 100).toFixed(1)}%`);
      } else {
        summaryParts.push(`Confiança diminuiu: ${(confDiff * 100).toFixed(1)}%`);
      }
    }
  }

  // Mudança no número de arquivos
  const prevFiles = Array.isArray(previous.sourceFilesMetadata) ? previous.sourceFilesMetadata.length : 0;
  const currFiles = Array.isArray(current.sourceFilesMetadata) ? current.sourceFilesMetadata.length : 0;

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
  const prevCredits = Number(previous.fullCreditsUsed) + Number(previous.fastCreditsUsed);
  const currCredits = Number(current.fullCreditsUsed) + Number(current.fastCreditsUsed);

  if (prevCredits !== currCredits) {
    changes.creditsUsed = {
      changed: true,
      from: prevCredits,
      to: currCredits,
      delta: currCredits - prevCredits
    };
    changes.totalChanges++;

    if (currCredits > prevCredits) {
      summaryParts.push(`+${currCredits - prevCredits} créditos`);
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