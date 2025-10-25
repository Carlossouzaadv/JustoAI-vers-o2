'use client';

import { useState, useCallback } from 'react';

export interface BulkUpdateResult {
  success: boolean;
  message: string;
  updated: number;
  failed: number;
  updatedFields?: string[];
}

/**
 * Hook para operações em massa em casos
 * Permite atualizar múltiplos casos em uma única requisição
 */
export function useBulkCaseUpdate() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Atualiza múltiplos casos com os mesmos dados
   *
   * @param caseIds - Array de IDs dos casos a atualizar
   * @param updates - Objeto com os campos a atualizar (clientId, status, priority, etc)
   * @returns Resultado da operação
   */
  const updateCases = useCallback(
    async (
      caseIds: string[],
      updates: Record<string, any>
    ): Promise<BulkUpdateResult> => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/cases/bulk', {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            caseIds,
            updates,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Erro ao atualizar casos');
        }

        const data = await response.json();
        return data;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Especificamente para atualizar cliente em múltiplos casos
   */
  const updateClientsInBulk = useCallback(
    async (caseIds: string[], clientId: string) => {
      return updateCases(caseIds, { clientId });
    },
    [updateCases]
  );

  /**
   * Especificamente para mudar status em múltiplos casos
   */
  const updateStatusInBulk = useCallback(
    async (caseIds: string[], status: string) => {
      return updateCases(caseIds, { status });
    },
    [updateCases]
  );

  /**
   * Especificamente para mudar prioridade em múltiplos casos
   */
  const updatePriorityInBulk = useCallback(
    async (caseIds: string[], priority: string) => {
      return updateCases(caseIds, { priority });
    },
    [updateCases]
  );

  return {
    updateCases,
    updateClientsInBulk,
    updateStatusInBulk,
    updatePriorityInBulk,
    loading,
    error,
  };
}
