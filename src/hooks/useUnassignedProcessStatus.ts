'use client';

import { useState, useCallback } from 'react';
import type { UnassignedInfo } from '@/components/process/unassigned-process-badge';

/**
 * Hook que fornece informações sobre status UNASSIGNED de um processo
 * e permite fazer retry do onboarding
 */
export function useUnassignedProcessStatus(caseId: string, status: string) {
  const [unassignedInfo, setUnassignedInfo] = useState<UnassignedInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  // Carregar informações do status UNASSIGNED
  const loadUnassignedInfo = useCallback(async () => {
    if (status !== 'UNASSIGNED') {
      setUnassignedInfo(null);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/cases/${caseId}/onboarding-status`);
      if (response.ok) {
        const data = await response.json();
        setUnassignedInfo(data);
      }
    } catch (error) {
      console.error('Erro ao carregar status UNASSIGNED:', error);
    } finally {
      setIsLoading(false);
    }
  }, [caseId, status]);

  // Fazer retry do onboarding
  const retryOnboarding = useCallback(async () => {
    setIsRetrying(true);
    try {
      const response = await fetch(`/api/cases/${caseId}/onboarding-retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        // Reload info após retry
        await loadUnassignedInfo();
        return true;
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao fazer retry');
      }
    } catch (error) {
      console.error('Erro ao fazer retry:', error);
      throw error;
    } finally {
      setIsRetrying(false);
    }
  }, [caseId, loadUnassignedInfo]);

  return {
    unassignedInfo,
    isLoading,
    isRetrying,
    loadUnassignedInfo,
    retryOnboarding,
  };
}
