'use client';

import React, { useState, useEffect } from 'react';
import { Cookie, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface CookieBannerProps {
  className?: string;
}

export const CookieBanner: React.FC<CookieBannerProps> = ({ className }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    // Verificar se o usuário já deu consentimento
    const hasConsent = localStorage.getItem('cookieConsent');
    if (!hasConsent) {
      // Mostrar banner após 1 segundo para melhor UX
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookieConsent', 'accepted');
    localStorage.setItem('cookieConsentDate', new Date().toISOString());
    closeBanner();

    // Habilitar cookies de analytics/marketing se necessário
    enableAnalyticsCookies();
  };

  const handleReject = () => {
    localStorage.setItem('cookieConsent', 'rejected');
    localStorage.setItem('cookieConsentDate', new Date().toISOString());
    closeBanner();

    // Garantir que apenas cookies essenciais sejam mantidos
    disableNonEssentialCookies();
  };

  const closeBanner = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsVisible(false);
      setIsClosing(false);
    }, 300);
  };

  const enableAnalyticsCookies = () => {
    // Implementar habilitação de cookies de analytics
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('consent', 'update', {
        analytics_storage: 'granted',
        ad_storage: 'granted'
      });
    }
  };

  const disableNonEssentialCookies = () => {
    // Implementar desabilitação de cookies não essenciais
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('consent', 'update', {
        analytics_storage: 'denied',
        ad_storage: 'denied'
      });
    }

    // Remover cookies não essenciais existentes
    const cookiesToRemove = ['_ga', '_gid', '_gat', '_fbp', '_gcl_au'];
    cookiesToRemove.forEach(cookie => {
      document.cookie = `${cookie}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      document.cookie = `${cookie}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${window.location.hostname};`;
    });
  };

  if (!isVisible) return null;

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 transform transition-all duration-300 ease-in-out',
        isClosing ? 'translate-y-full opacity-0' : 'translate-y-0 opacity-100',
        className
      )}
    >
      {/* Backdrop para mobile */}
      <div className="bg-black/20 backdrop-blur-sm lg:hidden absolute inset-0 -top-screen" />

      <div className="bg-white border-t border-gray-200 shadow-2xl lg:shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Conteúdo principal */}
            <div className="flex-1 pr-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-1">
                  <Cookie className="w-5 h-5 text-primary-600" />
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold text-gray-900 text-sm sm:text-base">
                    🍪 Utilizamos cookies em nosso site
                  </h3>

                  <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                    Utilizamos cookies essenciais para o funcionamento do site e cookies opcionais
                    para análise de tráfego e personalização de conteúdo. Você pode escolher aceitar
                    ou rejeitar cookies não essenciais. Conforme LGPD (Lei 13.709/2018).
                  </p>

                  <Link
                    href="/cookies"
                    className="inline-flex items-center gap-1 text-xs sm:text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors"
                  >
                    Ver nossa Política de Cookies
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </div>

            {/* Botões de ação */}
            <div className="flex flex-col sm:flex-row gap-2 lg:flex-shrink-0">
              <button
                onClick={handleReject}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors min-h-[44px] touch-manipulation"
              >
                Rejeitar
              </button>

              <button
                onClick={handleAccept}
                className="px-6 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors min-h-[44px] touch-manipulation"
              >
                Aceitar Todos
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Hook para verificar status do consentimento
export const useCookieConsent = () => {
  const [consent, setConsent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkConsent = () => {
      const savedConsent = localStorage.getItem('cookieConsent');
      setConsent(savedConsent);
      setIsLoading(false);
    };

    // Verificar imediatamente
    checkConsent();

    // Escutar mudanças no localStorage
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'cookieConsent') {
        setConsent(e.newValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const updateConsent = (newConsent: 'accepted' | 'rejected') => {
    localStorage.setItem('cookieConsent', newConsent);
    localStorage.setItem('cookieConsentDate', new Date().toISOString());
    setConsent(newConsent);
  };

  const clearConsent = () => {
    localStorage.removeItem('cookieConsent');
    localStorage.removeItem('cookieConsentDate');
    setConsent(null);
  };

  return {
    consent,
    isLoading,
    hasConsented: consent !== null,
    hasAccepted: consent === 'accepted',
    hasRejected: consent === 'rejected',
    updateConsent,
    clearConsent
  };
};

// Componente para configurações de cookies (opcional)
export const CookieSettings: React.FC = () => {
  const { consent, updateConsent } = useCookieConsent();

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Configurações de Cookies
      </h3>

      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <h4 className="font-medium text-gray-900">Cookies Essenciais</h4>
            <p className="text-sm text-gray-600">
              Necessários para o funcionamento básico do site
            </p>
          </div>
          <div className="text-sm text-gray-500 font-medium">
            Sempre Ativo
          </div>
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <h4 className="font-medium text-gray-900">Cookies de Analytics</h4>
            <p className="text-sm text-gray-600">
              Nos ajudam a entender como você usa nosso site
            </p>
          </div>
          <div className="text-sm">
            Status: {consent === 'accepted' ? 'Aceito' : 'Rejeitado'}
          </div>
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button
          onClick={() => updateConsent('rejected')}
          className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Rejeitar Opcionais
        </button>
        <button
          onClick={() => updateConsent('accepted')}
          className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg"
        >
          Aceitar Todos
        </button>
      </div>
    </div>
  );
};