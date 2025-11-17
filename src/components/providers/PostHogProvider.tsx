'use client';

/**
 * PostHogProvider (Client-Side - Padrão-Ouro)
 *
 * Encapsula a configuração do PostHog client-side para rastreamento de eventos de UI.
 * Type Safe: Zero any, zero as, zero @ts-ignore.
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

export function PostHogProvider({ children }: PostHogProviderProps): JSX.Element {
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
        sampleRate: 0.1, // Gravar 10% das sessões para economizar banda
      },
      autocapture: true, // Autocapture de cliques e formulários
      mask_all_text: true, // Mascarar texto sensível
      mask_all_input_on_document: true, // Mascarar inputs sensíveis
    });

  }, []);

  return (
    <PostHogReactProvider client={posthog}>
      {children}
    </PostHogReactProvider>
  );
}
