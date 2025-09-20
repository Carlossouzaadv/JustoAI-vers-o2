'use client';

import React from 'react';
import { Onboarding, useOnboarding, type OnboardingStep } from '@/components/ui/onboarding';

const dashboardSteps: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Bem-vindo ao JustoAI! 🎉',
    content: 'Vamos fazer um tour rápido pelas principais funcionalidades da plataforma. Este tour leva apenas 2 minutos.',
    target: '[data-onboarding="dashboard-header"]',
    placement: 'bottom',
    showSkip: true
  },
  {
    id: 'add-client',
    title: 'Adicione seu primeiro cliente',
    content: 'Comece adicionando um cliente. Você pode importar dados ou criar manualmente. Clique aqui para começar!',
    target: '[data-onboarding="add-client-button"]',
    placement: 'bottom',
    action: {
      label: 'Adicionar Cliente',
      onClick: () => {
        // Aqui você pode abrir o modal de adicionar cliente
        console.log('Abrir modal de adicionar cliente');
      }
    }
  },
  {
    id: 'process-list',
    title: 'Gerencie seus processos',
    content: 'Aqui você verá todos os processos dos seus clientes. Você pode importar via CSV/Excel ou integrar com APIs jurídicas.',
    target: '[data-onboarding="process-list"]',
    placement: 'top'
  },
  {
    id: 'ai-analysis',
    title: 'Análise Automática com IA',
    content: 'Nossa IA analisa automaticamente seus processos e gera insights estratégicos. Clique em qualquer processo para ver a mágica acontecer!',
    target: '[data-onboarding="ai-analysis-button"]',
    placement: 'left'
  },
  {
    id: 'reports',
    title: 'Relatórios Automáticos',
    content: 'Configure relatórios automáticos para seus clientes. Eles receberão updates profissionais por email sem você fazer nada.',
    target: '[data-onboarding="reports-section"]',
    placement: 'top'
  },
  {
    id: 'dashboard-overview',
    title: 'Dashboard Inteligente',
    content: 'Aqui você tem uma visão completa: processos por status, prazos críticos, e métricas em tempo real.',
    target: '[data-onboarding="dashboard-stats"]',
    placement: 'bottom'
  },
  {
    id: 'settings',
    title: 'Configurações e Integrações',
    content: 'Configure integrações com APIs jurídicas, personalize relatórios e ajuste notificações no menu de configurações.',
    target: '[data-onboarding="settings-menu"]',
    placement: 'left'
  },
  {
    id: 'complete',
    title: 'Pronto para começar! 🚀',
    content: 'Você agora conhece as principais funcionalidades. Comece adicionando seu primeiro cliente e experimente nossa análise automática!',
    target: '[data-onboarding="main-content"]',
    placement: 'top'
  }
];

interface DashboardOnboardingProps {
  onComplete?: () => void;
}

export function DashboardOnboarding({ onComplete }: DashboardOnboardingProps) {
  const {
    isCompleted,
    isActive,
    completeOnboarding,
    skipOnboarding,
    resetOnboarding
  } = useOnboarding('dashboard-onboarding');

  const handleComplete = () => {
    completeOnboarding();
    onComplete?.();
  };

  const handleSkip = () => {
    skipOnboarding();
    onComplete?.();
  };

  return (
    <>
      <Onboarding
        steps={dashboardSteps}
        isActive={isActive}
        onComplete={handleComplete}
        onSkip={handleSkip}
      />

      {/* Botão para resetar o tour (útil para desenvolvimento/testes) */}
      {isCompleted && process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 right-4 z-50">
          <button
            onClick={resetOnboarding}
            className="px-4 py-2 bg-accent-500 text-white rounded-lg shadow-lg hover:bg-accent-600 transition-colors text-sm"
          >
            🔄 Reiniciar Tour
          </button>
        </div>
      )}
    </>
  );
}

// Hook personalizado para o dashboard
export function useDashboardOnboarding() {
  return useOnboarding('dashboard-onboarding');
}