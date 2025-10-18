'use client';

import { useContext } from 'react';
import type { DashboardContextType } from '../app/dashboard/layout';
import { DashboardContext } from '../app/dashboard/layout';

/**
 * Hook para acessar o contexto do dashboard
 * Extraído para arquivo separado para evitar TDZ durante minificação
 *
 * Deve ser usado dentro de um DashboardLayout
 */
export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within DashboardLayout');
  }
  return context;
}
