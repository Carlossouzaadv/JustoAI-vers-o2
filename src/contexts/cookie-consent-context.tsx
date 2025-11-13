'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

interface CookieConsentContextType {
  consent: 'accepted' | 'rejected' | null;
  isLoading: boolean;
  hasConsented: boolean;
  hasAccepted: boolean;
  hasRejected: boolean;
  acceptCookies: () => void;
  rejectCookies: () => void;
  resetConsent: () => void;
  consentDate: string | null;
}

const CookieConsentContext = createContext<CookieConsentContextType | undefined>(undefined);

interface CookieConsentProviderProps {
  children: React.ReactNode;
}

export const CookieConsentProvider: React.FC<CookieConsentProviderProps> = ({ children }) => {
  const [consent, setConsent] = useState<'accepted' | 'rejected' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [consentDate, setConsentDate] = useState<string | null>(null);

  // Carregar dados do localStorage ao inicializar
  useEffect(() => {
    const loadConsentData = () => {
      try {
        const savedConsent = localStorage.getItem('cookieConsent') as 'accepted' | 'rejected' | null;
        const savedDate = localStorage.getItem('cookieConsentDate');

        setConsent(savedConsent);
        setConsentDate(savedDate);
        setIsLoading(false);

        // Aplicar configurações baseadas no consentimento
        if (savedConsent) {
          applyCookieSettings(savedConsent);
        }
      } catch (error) {
        console.error('Erro ao carregar configurações de cookies:', error);
        setIsLoading(false);
      }
    };

    loadConsentData();
  }, []);

  // Aplicar configurações de cookies baseadas no consentimento
  const applyCookieSettings = (consentType: 'accepted' | 'rejected') => {
    if (typeof window === 'undefined') return;

    if (consentType === 'accepted') {
      // Habilitar Google Analytics e outros cookies opcionais
      if (window.gtag) {
        window.gtag('consent', 'update', {
          analytics_storage: 'granted',
          ad_storage: 'granted',
          functionality_storage: 'granted',
          personalization_storage: 'granted'
        });
      }

      // Disparar evento para outros scripts
      window.dispatchEvent(new CustomEvent('cookiesAccepted'));
    } else {
      // Rejeitar cookies opcionais
      if (window.gtag) {
        window.gtag('consent', 'update', {
          analytics_storage: 'denied',
          ad_storage: 'denied',
          functionality_storage: 'denied',
          personalization_storage: 'denied'
        });
      }

      // Limpar cookies existentes
      clearNonEssentialCookies();

      // Disparar evento
      window.dispatchEvent(new CustomEvent('cookiesRejected'));
    }
  };

  // Limpar cookies não essenciais
  const clearNonEssentialCookies = () => {
    if (typeof window === 'undefined') return;

    const cookiesToClear = [
      '_ga', '_gid', '_gat', '_gat_gtag_UA_', '_gcl_au', '_fbp', '_fbc',
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'
    ];

    cookiesToClear.forEach(cookieName => {
      // Limpar para o domínio atual
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;

      // Limpar para o domínio principal
      const domain = window.location.hostname.split('.').slice(-2).join('.');
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${domain};`;
    });
  };

  const acceptCookies = () => {
    const timestamp = new Date().toISOString();

    localStorage.setItem('cookieConsent', 'accepted');
    localStorage.setItem('cookieConsentDate', timestamp);

    setConsent('accepted');
    setConsentDate(timestamp);

    applyCookieSettings('accepted');

    // Analytics - registrar evento de consentimento
    if (window.gtag) {
      window.gtag('event', 'cookies_accepted', {
        event_category: 'privacy',
        event_label: 'cookie_banner'
      });
    }
  };

  const rejectCookies = () => {
    const timestamp = new Date().toISOString();

    localStorage.setItem('cookieConsent', 'rejected');
    localStorage.setItem('cookieConsentDate', timestamp);

    setConsent('rejected');
    setConsentDate(timestamp);

    applyCookieSettings('rejected');

    // Analytics - registrar evento de rejeição (se já estiver ativo)
    if (window.gtag) {
      window.gtag('event', 'cookies_rejected', {
        event_category: 'privacy',
        event_label: 'cookie_banner'
      });
    }
  };

  const resetConsent = () => {
    localStorage.removeItem('cookieConsent');
    localStorage.removeItem('cookieConsentDate');

    setConsent(null);
    setConsentDate(null);

    clearNonEssentialCookies();

    // Resetar configurações do Google Analytics
    if (window.gtag) {
      window.gtag('consent', 'default', {
        analytics_storage: 'denied',
        ad_storage: 'denied',
        functionality_storage: 'denied',
        personalization_storage: 'denied',
        wait_for_update: 500
      });
    }
  };

  // Verificar se o consentimento expirou (6 meses)
  useEffect(() => {
    if (consentDate) {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const consentDateObj = new Date(consentDate);

      if (consentDateObj < sixMonthsAgo) {
        // Consentimento expirado - resetar
        resetConsent();
      }
    }
  }, [consentDate]);

  const value: CookieConsentContextType = {
    consent,
    isLoading,
    hasConsented: consent !== null,
    hasAccepted: consent === 'accepted',
    hasRejected: consent === 'rejected',
    acceptCookies,
    rejectCookies,
    resetConsent,
    consentDate
  };

  return (
    <CookieConsentContext.Provider value={value}>
      {children}
    </CookieConsentContext.Provider>
  );
};

// Hook para usar o contexto
export const useCookieConsent = (): CookieConsentContextType => {
  const context = useContext(CookieConsentContext);

  if (context === undefined) {
    throw new Error('useCookieConsent deve ser usado dentro de um CookieConsentProvider');
  }

  return context;
};

// Hook para verificar se pode usar analytics
export const useAnalytics = () => {
  const { hasAccepted, isLoading } = useCookieConsent();

  return {
    canUseAnalytics: hasAccepted,
    isLoading
  };
};

// Declaração de tipos para window.gtag
// Usando tipo genérico para compatibilidade com diferentes versões do gtag
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}