// ================================================================
// HOOK SERVICE WORKER - JUSTOAI V2
// ================================================================
// Hook para registrar e gerenciar Service Worker

import { useEffect, useState } from 'react';

interface ServiceWorkerStats {
  totalItems: number;
  cacheSize: number;
  itemTypes: {
    pages: number;
    images: number;
    scripts: number;
    styles: number;
    api: number;
    other: number;
  };
}

interface UseServiceWorkerReturn {
  isSupported: boolean;
  isRegistered: boolean;
  isOnline: boolean;
  updateAvailable: boolean;
  cacheStats: ServiceWorkerStats | null;
  installUpdate: () => void;
  clearCache: () => Promise<void>;
  getCacheStats: () => Promise<void>;
}

export function useServiceWorker(): UseServiceWorkerReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [cacheStats, setCacheStats] = useState<ServiceWorkerStats | null>(null);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    // Verificar suporte ao Service Worker
    if ('serviceWorker' in navigator) {
      setIsSupported(true);
      registerServiceWorker();
    }

    // Monitorar status online/offline
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Status inicial
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const registerServiceWorker = async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      setRegistration(reg);
      setIsRegistered(true);

      console.log('✅ Service Worker registrado:', reg.scope);

      // Verificar atualizações
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setUpdateAvailable(true);
              console.log('🔄 Atualização do Service Worker disponível');
            }
          });
        }
      });

      // Service Worker ativo
      if (reg.active) {
        console.log('🚀 Service Worker ativo');
      }

    } catch (error) {
      console.error('❌ Erro ao registrar Service Worker:', error);
    }
  };

  const installUpdate = () => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    }
  };

  const getCacheStats = async (): Promise<void> => {
    if (!registration?.active) return;

    try {
      const messageChannel = new MessageChannel();

      const statsPromise = new Promise<ServiceWorkerStats>((resolve) => {
        messageChannel.port1.onmessage = (event) => {
          resolve(event.data);
        };
      });

      registration.active.postMessage(
        { type: 'GET_CACHE_STATS' },
        [messageChannel.port2]
      );

      const stats = await statsPromise;
      setCacheStats(stats);

    } catch (error) {
      console.error('❌ Erro ao obter estatísticas do cache:', error);
    }
  };

  const clearCache = async (): Promise<void> => {
    if (!registration?.active) return;

    try {
      const messageChannel = new MessageChannel();

      const clearPromise = new Promise<void>((resolve) => {
        messageChannel.port1.onmessage = (event) => {
          if (event.data.success) {
            console.log('🗑️ Cache limpo com sucesso');
            setCacheStats(null);
            resolve();
          }
        };
      });

      registration.active.postMessage(
        { type: 'CLEAR_CACHE' },
        [messageChannel.port2]
      );

      await clearPromise;

    } catch (error) {
      console.error('❌ Erro ao limpar cache:', error);
      throw error;
    }
  };

  return {
    isSupported,
    isRegistered,
    isOnline,
    updateAvailable,
    cacheStats,
    installUpdate,
    clearCache,
    getCacheStats,
  };
}

// Hook simplificado para mostrar status offline
export function useOfflineStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}