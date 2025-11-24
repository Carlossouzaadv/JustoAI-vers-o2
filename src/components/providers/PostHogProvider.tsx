'use client';

/**
 * PostHogProvider (Client-Side - Padrão-Ouro)
 *
 * Encapsula a configuração do PostHog client-side para rastreamento de eventos de UI.
 * Type Safe: Zero any, zero as, zero @ts-expect-error.
 *
 * Uso:
 * <PostHogProvider>
 *   <YourApp />
 * </PostHogProvider>
 */

import { ReactNode, useEffect } from 'react';
import posthog from 'posthog-js';
import { PostHogProvider as PostHogReactProvider } from 'posthog-js/react';

type PostHogProviderProps = {
  children: ReactNode;
};

export function PostHogProvider({ children }: PostHogProviderProps): ReactNode {
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;

    // Se a chave não está configurada, não inicializar
    if (!apiKey) {
      console.warn('[PostHog] NEXT_PUBLIC_POSTHOG_KEY não configurada - Analytics desabilitado');
      return;
    }

    // Inicializar PostHog
    posthog.init(apiKey, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.posthog.com',
      person_profiles: 'identified_only', // Rastrear apenas usuários identificados
      session_recording: {
        maskAllInputs: true, // Mascarar todos os inputs sensíveis
      },
      autocapture: true, // Autocapture de cliques e formulários
      mask_all_text: true, // Mascarar texto sensível
      mask_all_element_attributes: true, // Mascarar atributos de elementos
    });

  }, []);

  return (
    <PostHogReactProvider client={posthog}>
      {children}
    </PostHogReactProvider>
  );
}
