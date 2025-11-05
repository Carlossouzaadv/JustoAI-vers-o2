'use client';

import { useEffect, useCallback } from 'react';
import { useOnboarding } from '@/components/ui/onboarding';

interface OnboardingConfig {
  storageKey?: string;
  autoStart?: boolean;
  startDelay?: number;
  skipOnMobile?: boolean;
}

export function useOnboardingIntegration(config: OnboardingConfig = {}) {
  const {
    storageKey = 'app-onboarding',
    autoStart = true,
    startDelay = 1500,
    skipOnMobile = true
  } = config;

  const {
    isCompleted,
    isActive,
    startOnboarding,
    completeOnboarding,
    skipOnboarding,
    resetOnboarding
  } = useOnboarding(storageKey);

  // Detectar se é mobile
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // Auto-iniciar onboarding
  useEffect(() => {
    if (autoStart && !isCompleted && !isActive) {
      // Pular em mobile se configurado
      if (skipOnMobile && isMobile) {
        completeOnboarding();
        return;
      }

      // Delay para garantir que o DOM esteja pronto
      const timer = setTimeout(() => {
        startOnboarding();
      }, startDelay);

      return () => clearTimeout(timer);
    }
  }, [autoStart, isCompleted, isActive, skipOnMobile, isMobile, startDelay, startOnboarding, completeOnboarding]);

  // Verificar se todos os elementos do tour existem
  const validateTourElements = useCallback((targets: string[]) => {
    const missingElements: string[] = [];

    targets.forEach(target => {
      const element = document.querySelector(target);
      if (!element) {
        missingElements.push(target);
      }
    });

    if (missingElements.length > 0) {
      console.warn('Onboarding: Elementos não encontrados:', missingElements);
    }

    return missingElements.length === 0;
  }, []);

  // Marcar elemento como visitado durante o tour
  const markElementVisited = useCallback((target: string) => {
    const element = document.querySelector(target);
    if (element) {
      element.setAttribute('data-onboarding-visited', 'true');
    }
  }, []);

  // Limpar marcações de elementos visitados
  const clearVisitedMarkers = useCallback(() => {
    const visitedElements = document.querySelectorAll('[data-onboarding-visited]');
    visitedElements.forEach(element => {
      element.removeAttribute('data-onboarding-visited');
    });
  }, []);

  // Analytics/tracking para o onboarding
  const trackOnboardingEvent = useCallback((event: string, data?: Record<string, unknown>) => {
    // Integrar com sua solução de analytics
    console.log('Onboarding Event:', event, data);

    // Exemplo de integração com Google Analytics
    if (typeof window !== 'undefined' && (window as unknown).gtag) {
      (window as unknown).gtag('event', 'onboarding', {
        event_category: 'user_engagement',
        event_label: event,
        custom_parameters: data
      });
    }
  }, []);

  return {
    // Estado
    isCompleted,
    isActive,
    isMobile,

    // Controles
    startOnboarding: () => {
      startOnboarding();
      trackOnboardingEvent('started');
    },
    completeOnboarding: () => {
      completeOnboarding();
      clearVisitedMarkers();
      trackOnboardingEvent('completed');
    },
    skipOnboarding: () => {
      skipOnboarding();
      clearVisitedMarkers();
      trackOnboardingEvent('skipped');
    },
    resetOnboarding: () => {
      resetOnboarding();
      trackOnboardingEvent('reset');
    },

    // Utilitários
    validateTourElements,
    markElementVisited,
    clearVisitedMarkers,
    trackOnboardingEvent
  };
}

// Hook específico para diferentes tipos de usuário
export function useRoleBasedOnboarding(userRole: 'admin' | 'lawyer' | 'client' | 'viewer') {
  const roleConfigs = {
    admin: {
      storageKey: 'admin-onboarding',
      autoStart: true,
      startDelay: 2000
    },
    lawyer: {
      storageKey: 'lawyer-onboarding',
      autoStart: true,
      startDelay: 1500
    },
    client: {
      storageKey: 'client-onboarding',
      autoStart: true,
      startDelay: 1000,
      skipOnMobile: false // Clientes podem usar mobile
    },
    viewer: {
      storageKey: 'viewer-onboarding',
      autoStart: false // Viewers não precisam de tour automático
    }
  };

  return useOnboardingIntegration(roleConfigs[userRole]);
}

// Hook para onboarding contextual (baseado na página)
export function useContextualOnboarding(context: string) {
  return useOnboardingIntegration({
    storageKey: `onboarding-${context}`,
    autoStart: true,
    startDelay: 1000
  });
}