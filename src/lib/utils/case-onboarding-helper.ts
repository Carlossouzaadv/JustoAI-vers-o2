/**
 * Helper para gerenciar status de onboarding de casos
 * Responsável por rastrear erros e estados de processamento
 */

import { prisma } from '@/lib/prisma';
import type { CaseStatus } from '@prisma/client';

export interface OnboardingError {
  timestamp: string;
  stage: 'PREVIEW' | 'ENRICHMENT' | 'ATTACHMENT_PROCESSING';
  errorMessage: string;
  errorCode?: string;
  retryCount: number;
  lastRetry?: string;
}

export interface OnboardingMetadata {
  [key: string]: unknown;
  onboarding_errors?: OnboardingError[];
  last_onboarding_error?: OnboardingError;
  onboarding_retry_count?: number;
  can_retry?: boolean;
  auto_mapped_case_type?: string;
  judit_data_retrieved?: boolean;
}

/**
 * Registra um erro de onboarding e atualiza o status do caso para UNASSIGNED
 */
export async function recordOnboardingError(
  caseId: string,
  stage: 'PREVIEW' | 'ENRICHMENT' | 'ATTACHMENT_PROCESSING',
  errorMessage: string,
  errorCode?: string
): Promise<void> {
  try {
    // Buscar caso atual para acessar metadata
    const currentCase = await prisma.case.findUnique({
      where: { id: caseId },
      select: { metadata: true, status: true }
    });

    if (!currentCase) {
      console.error(`[OnboardingError] Caso não encontrado: ${caseId}`);
      return;
    }

    const currentMetadata = (currentCase.metadata || {}) as OnboardingMetadata;
    const previousErrors = currentMetadata.onboarding_errors || [];
    const retryCount = (currentMetadata.onboarding_retry_count || 0) + 1;

    // Criar novo erro
    const newError: OnboardingError = {
      timestamp: new Date().toISOString(),
      stage,
      errorMessage,
      errorCode,
      retryCount,
      lastRetry: new Date().toISOString()
    };

    // Atualizar metadata com novo erro
    const updatedMetadata: OnboardingMetadata = {
      ...currentMetadata,
      onboarding_errors: [...previousErrors, newError],
      last_onboarding_error: newError,
      onboarding_retry_count: retryCount,
      can_retry: retryCount < 3 // Permitir até 3 tentativas
    };

    // Atualizar caso com error
    // Só muda para UNASSIGNED se stage for ENRICHMENT (JUDIT)
    // Se for PREVIEW, deixa como está (pode ser melhorado)
    const newStatus: CaseStatus = stage === 'ENRICHMENT' ? 'UNASSIGNED' : currentCase.status as CaseStatus;

    await prisma.case.update({
      where: { id: caseId },
      data: {
        status: newStatus,
        metadata: updatedMetadata
        // onboardingStatus remains unchanged - error is tracked in metadata
      }
    });

    console.log(`[OnboardingError] Erro registrado para caso ${caseId}:`, {
      stage,
      errorMessage,
      retryCount,
      newStatus
    });
  } catch (error) {
    console.error(`[OnboardingError] Erro ao registrar falha de onboarding:`, error);
  }
}

/**
 * Retorna informações formatadas sobre o motivo de um caso estar UNASSIGNED
 */
export async function getUnassignedReason(caseId: string): Promise<{
  status: CaseStatus;
  stage?: string;
  reason?: string;
  errorMessage?: string;
  canRetry?: boolean;
  lastError?: OnboardingError;
} | null> {
  try {
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      select: { status: true, metadata: true, onboardingStatus: true }
    });

    if (!caseData) return null;

    const metadata = (caseData.metadata || {}) as OnboardingMetadata;
    const lastError = metadata.last_onboarding_error;

    if (caseData.status === 'UNASSIGNED') {
      return {
        status: 'UNASSIGNED',
        stage: lastError?.stage || 'ENRICHMENT',
        reason: 'Falha no processamento oficial (JUDIT)',
        errorMessage: lastError?.errorMessage || 'Erro desconhecido',
        canRetry: metadata.can_retry === true,
        lastError
      };
    }

    return {
      status: caseData.status,
      canRetry: false
    };
  } catch (error) {
    console.error(`[OnboardingError] Erro ao buscar motivo:`, error);
    return null;
  }
}

/**
 * Permite retry de onboarding para um caso UNASSIGNED
 */
export async function retryOnboarding(caseId: string): Promise<boolean> {
  try {
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      select: { metadata: true, status: true, detectedCnj: true }
    });

    if (!caseData || caseData.status !== 'UNASSIGNED') {
      return false;
    }

    const metadata = (caseData.metadata || {}) as OnboardingMetadata;
    if (metadata.can_retry !== true) {
      console.warn(`[OnboardingError] Retry não permitido para caso ${caseId}`);
      return false;
    }

    if (!caseData.detectedCnj) {
      console.error(`[OnboardingError] CNJ não detectado para caso ${caseId}`);
      return false;
    }

    // Limpar erros anteriores para nova tentativa
    const clearedMetadata: OnboardingMetadata = {
      ...metadata,
      onboarding_errors: [], // Limpar histórico
      last_onboarding_error: undefined
    };

    await prisma.case.update({
      where: { id: caseId },
      data: {
        status: 'ACTIVE', // Voltar para ACTIVE para retry
        metadata: clearedMetadata,
        onboardingStatus: 'created'
      }
    });

    console.log(`[OnboardingError] Retry iniciado para caso ${caseId} (CNJ: ${caseData.detectedCnj})`);
    return true;
  } catch (error) {
    console.error(`[OnboardingError] Erro ao fazer retry:`, error);
    return false;
  }
}
