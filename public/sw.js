// ================================================================
// SERVICE WORKER - CACHE OFFLINE E PWA - JUSTOAI V2
// ================================================================
// Implementa cache inteligente para performance máxima

const CACHE_NAME = 'justoai-v2-cache-v1';
const OFFLINE_URL = '/offline';

// Recursos essenciais para cache imediato
const ESSENTIAL_RESOURCES = [
  '/',
  '/offline',
  '/optimized/logo+nome.webp',
  '/optimized/Justo_logo.webp',
  '/_next/static/css/app/layout.css',
  '/_next/static/chunks/webpack.js',
  '/_next/static/chunks/main.js'
];

// Estratégias de cache por tipo de recurso
const CACHE_STRATEGIES = {
  // Cache first - para recursos estáticos
  static: {
    regex: /\.(css|js|woff2?|eot|ttf|otf)$/,
    strategy: 'cache-first',
    maxAge: 365 * 24 * 60 * 60 * 1000 // 1 ano
  },

  // Stale while revalidate - para imagens
  images: {
    regex: /\.(png|jpg|jpeg|gif|webp|avif|svg|ico)$/,
    strategy: 'stale-while-revalidate',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 dias
  },

  // Network first - para APIs
  api: {
    regex: /\/api\//,
    strategy: 'network-first',
    maxAge: 5 * 60 * 1000 // 5 minutos
  },

  // Stale while revalidate - para páginas
  pages: {
    regex: /\/(?!api\/)/,
    strategy: 'stale-while-revalidate',
    maxAge: 24 * 60 * 60 * 1000 // 1 dia
  }
};

// ======================================
// EVENTOS DO SERVICE WORKER
// ======================================

self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker: Instalando...');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Service Worker: Cache aberto');
        return cache.addAll(ESSENTIAL_RESOURCES);
      })
      .then(() => {
        console.log('✅ Service Worker: Recursos essenciais cacheados');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('❌ Service Worker: Erro na instalação:', error);
      })
  );
});

self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker: Ativando...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('🗑️ Service Worker: Removendo cache antigo:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('✅ Service Worker: Ativado');
        return self.clients.claim();
      })
  );
});

self.addEventListener('fetch', (event) => {
  // Ignorar requests não-GET
  if (event.request.method !== 'GET') return;

  // Ignorar chrome-extension e outros protocolos
  if (!event.request.url.startsWith('http')) return;

  const url = new URL(event.request.url);
  const strategy = getStrategy(url.pathname);

  event.respondWith(
    handleRequest(event.request, strategy)
      .catch(() => {
        // Fallback para offline
        if (event.request.destination === 'document') {
          return caches.match(OFFLINE_URL);
        }
        return new Response('Recurso não disponível offline', {
          status: 408,
          headers: { 'Content-Type': 'text/plain' }
        });
      })
  );
});

// ======================================
// ESTRATÉGIAS DE CACHE
// ======================================

function getStrategy(pathname) {
  for (const [name, config] of Object.entries(CACHE_STRATEGIES)) {
    if (config.regex.test(pathname)) {
      return { name, ...config };
    }
  }
  return CACHE_STRATEGIES.pages; // Default
}

async function handleRequest(request, strategy) {
  const cache = await caches.open(CACHE_NAME);

  switch (strategy.strategy) {
    case 'cache-first':
      return cacheFirst(cache, request, strategy);

    case 'network-first':
      return networkFirst(cache, request, strategy);

    case 'stale-while-revalidate':
      return staleWhileRevalidate(cache, request, strategy);

    default:
      return fetch(request);
  }
}

// Cache First - Tenta cache primeiro, network como fallback
async function cacheFirst(cache, request, strategy) {
  const cached = await cache.match(request);

  if (cached && !isExpired(cached, strategy.maxAge)) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    if (cached) return cached;
    throw error;
  }
}

// Network First - Tenta network primeiro, cache como fallback
async function networkFirst(cache, request, strategy) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached && !isExpired(cached, strategy.maxAge)) {
      return cached;
    }
    throw error;
  }
}

// Stale While Revalidate - Retorna cache e atualiza em background
async function staleWhileRevalidate(cache, request, strategy) {
  const cached = await cache.match(request);

  // Fetch em background para atualizar cache
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => {
      // Silently fail background update
    });

  // Se tem cache válido, retorna imediatamente
  if (cached && !isExpired(cached, strategy.maxAge)) {
    return cached;
  }

  // Senão, espera o fetch
  return fetchPromise;
}

// ======================================
// UTILIDADES
// ======================================

function isExpired(response, maxAge) {
  const dateHeader = response.headers.get('date');
  if (!dateHeader) return false;

  const cacheTime = new Date(dateHeader).getTime();
  return Date.now() - cacheTime > maxAge;
}

// ======================================
// MENSAGENS DO CLIENTE
// ======================================

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'GET_CACHE_STATS') {
    getCacheStats().then((stats) => {
      event.ports[0].postMessage(stats);
    });
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    clearOldCache().then(() => {
      event.ports[0].postMessage({ success: true });
    });
  }
});

async function getCacheStats() {
  const cache = await caches.open(CACHE_NAME);
  const keys = await cache.keys();

  const stats = {
    totalItems: keys.length,
    cacheSize: 0,
    itemTypes: {
      pages: 0,
      images: 0,
      scripts: 0,
      styles: 0,
      api: 0,
      other: 0
    }
  };

  // Estimar tamanho do cache (aproximado)
  for (const request of keys) {
    const response = await cache.match(request);
    if (response) {
      const blob = await response.blob();
      stats.cacheSize += blob.size;

      // Categorizar por tipo
      const url = new URL(request.url);
      if (url.pathname.includes('/api/')) {
        stats.itemTypes.api++;
      } else if (/\.(png|jpg|jpeg|gif|webp|avif|svg)$/.test(url.pathname)) {
        stats.itemTypes.images++;
      } else if (/\.(js)$/.test(url.pathname)) {
        stats.itemTypes.scripts++;
      } else if (/\.(css)$/.test(url.pathname)) {
        stats.itemTypes.styles++;
      } else if (url.pathname === '/' || !url.pathname.includes('.')) {
        stats.itemTypes.pages++;
      } else {
        stats.itemTypes.other++;
      }
    }
  }

  return stats;
}

async function clearOldCache() {
  const cache = await caches.open(CACHE_NAME);
  const keys = await cache.keys();

  const now = Date.now();

  for (const request of keys) {
    const response = await cache.match(request);
    if (response && isExpired(response, 7 * 24 * 60 * 60 * 1000)) { // 7 dias
      await cache.delete(request);
    }
  }
}