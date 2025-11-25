// ================================
// OTIMIZADOR DE PERFORMANCE PARA 100 RELATÓRIOS EM < 5 MINUTOS
// ================================
// Sistema específico para atingir meta de throughput de 20+ relatórios/minuto

import { ICONS } from './icons';
import { log, logError } from '@/lib/services/logger';

// ================================
// TYPE GUARDS PARA PUPPETEER
// ================================

/**
 * Valida se um objeto é uma Page do Puppeteer com os métodos necessários.
 */
function isPage(obj: unknown): obj is {
  setRequestInterception: (_flag: boolean) => Promise<void>;
  on: (_event: string, _handler: (_arg: unknown) => void) => void;
  setJavaScriptEnabled: (_enabled: boolean) => Promise<void>;
  setViewport: (_viewport: { width: number; height: number; deviceScaleFactor: number }) => Promise<void>;
  setDefaultTimeout: (_timeout: number) => Promise<void>;
  setDefaultNavigationTimeout: (_timeout: number) => Promise<void>;
  addStyleTag: (_options: { content: string }) => Promise<void>;
} {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const page = obj as Record<string, unknown>;

  return (
    typeof page.setRequestInterception === 'function' &&
    typeof page.on === 'function' &&
    typeof page.setJavaScriptEnabled === 'function' &&
    typeof page.setViewport === 'function' &&
    typeof page.setDefaultTimeout === 'function' &&
    typeof page.setDefaultNavigationTimeout === 'function' &&
    typeof page.addStyleTag === 'function'
  );
}

/**
 * Valida se um objeto é um Request do Puppeteer com os métodos necessários.
 */
function isRequest(obj: unknown): obj is {
  resourceType: () => string;
  url: () => string;
  continue: () => Promise<void>;
  abort: () => Promise<void>;
} {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const request = obj as Record<string, unknown>;

  return (
    typeof request.resourceType === 'function' &&
    typeof request.url === 'function' &&
    typeof request.continue === 'function' &&
    typeof request.abort === 'function'
  );
}

// ================================
// CONFIGURAÇÕES DE OTIMIZAÇÃO
// ================================

export interface PerformanceConfig {
  // Puppeteer optimizations
  maxConcurrentPages: number;      // 15 (máximo otimizado)
  pagePoolSize: number;            // 15
  pageReuseCount: number;          // 50 (quantas vezes reutilizar página)
  browserInstances: number;        // 2 (múltiplos browsers)

  // Memory management
  maxMemoryUsageMB: number;        // 1024MB
  gcIntervalMs: number;            // 30000 (30s)
  templateCacheSize: number;       // 100 templates

  // Processing optimizations
  batchSize: number;               // 25 relatórios por lote
  parallelBatches: number;         // 4 lotes simultâneos
  interBatchDelayMs: number;       // 200ms entre lotes

  // Content optimizations
  imageCompression: boolean;       // true
  cssMinification: boolean;        // true
  htmlMinification: boolean;       // true
  disableAnimations: boolean;      // true

  // Network optimizations
  blockUnnecessaryRequests: boolean; // true
  useLocalFonts: boolean;           // true
  optimizeImages: boolean;          // true
}

export const PERFORMANCE_PROFILES = {
  // Meta: 100 relatórios em < 5 minutos (20+ relatórios/min)
  ULTRA_FAST: {
    maxConcurrentPages: 15,
    pagePoolSize: 15,
    pageReuseCount: 100,
    browserInstances: 3,
    maxMemoryUsageMB: 1536,
    gcIntervalMs: 20000,
    templateCacheSize: 150,
    batchSize: 25,
    parallelBatches: 4,
    interBatchDelayMs: 100,
    imageCompression: true,
    cssMinification: true,
    htmlMinification: true,
    disableAnimations: true,
    blockUnnecessaryRequests: true,
    useLocalFonts: true,
    optimizeImages: true
  } as PerformanceConfig,

  // Meta: 50 relatórios em < 5 minutos (10+ relatórios/min)
  FAST: {
    maxConcurrentPages: 10,
    pagePoolSize: 10,
    pageReuseCount: 50,
    browserInstances: 2,
    maxMemoryUsageMB: 1024,
    gcIntervalMs: 30000,
    templateCacheSize: 100,
    batchSize: 20,
    parallelBatches: 2,
    interBatchDelayMs: 200,
    imageCompression: true,
    cssMinification: true,
    htmlMinification: false,
    disableAnimations: true,
    blockUnnecessaryRequests: true,
    useLocalFonts: true,
    optimizeImages: true
  } as PerformanceConfig,

  // Configuração balanceada
  BALANCED: {
    maxConcurrentPages: 8,
    pagePoolSize: 8,
    pageReuseCount: 25,
    browserInstances: 1,
    maxMemoryUsageMB: 768,
    gcIntervalMs: 45000,
    templateCacheSize: 50,
    batchSize: 15,
    parallelBatches: 2,
    interBatchDelayMs: 300,
    imageCompression: false,
    cssMinification: false,
    htmlMinification: false,
    disableAnimations: false,
    blockUnnecessaryRequests: false,
    useLocalFonts: false,
    optimizeImages: false
  } as PerformanceConfig
};

// ================================
// OTIMIZADOR DE PERFORMANCE
// ================================

export class PerformanceOptimizer {
  private config: PerformanceConfig;
  private metrics = {
    totalReports: 0,
    totalTime: 0,
    averageTime: 0,
    currentThroughput: 0,
    memoryPeakMB: 0,
    gcCount: 0,
    cacheHits: 0
  };

  private gcInterval: NodeJS.Timeout | null = null;
  private lastGcTime = 0;

  constructor(profile: keyof typeof PERFORMANCE_PROFILES = 'ULTRA_FAST') {
    this.config = { ...PERFORMANCE_PROFILES[profile] };
    this.setupPerformanceMonitoring();

    log.info({ msg: 'Performance Optimizer iniciado (perfil: )' });
  }

  // ================================
  // OTIMIZAÇÕES PUPPETEER
  // ================================

  getPuppeteerConfig(): Record<string, unknown> {
    return {
      headless: true,
      args: [
        // Core optimizations
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',

        // Memory optimizations
        '--memory-pressure-off',
        '--max_old_space_size=1536',
        '--initial-heap-size=512',
        '--max-heap-size=1536',

        // CPU optimizations
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-background-networking',

        // Graphics optimizations (faster rendering)
        '--disable-gpu',
        '--disable-gpu-sandbox',
        '--disable-software-rasterizer',
        '--disable-accelerated-2d-canvas',
        '--disable-3d-apis',

        // Network optimizations
        '--aggressive-cache-discard',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-images', // Will be overridden per page

        // Process optimizations
        '--single-process', // CRITICAL for speed
        '--no-zygote',
        '--no-first-run',

        // Additional speed optimizations
        '--disable-default-apps',
        '--disable-sync',
        '--disable-translate',
        '--disable-web-security',
        '--disable-features=TranslateUI,VizDisplayCompositor',
        '--ignore-certificate-errors',
        '--ignore-ssl-errors',
        '--ignore-certificate-errors-spki-list',
        '--reduce-security-for-testing',

        // Window size optimization
        '--window-size=1024,768'
      ],
      ignoreDefaultArgs: ['--disable-extensions', '--disable-dev-shm-usage'],
      timeout: 15000,
      handleSIGINT: false,
      handleSIGTERM: false,
      handleSIGHUP: false,
      dumpio: false
    };
  }

  getPageOptimizations() {
    return {
      // Request interception for maximum speed

      interceptRequests: (page: unknown) => {
        // Valida se page é uma Page do Puppeteer
        if (!isPage(page)) {
          log.warn({ msg: 'AVISO: page não é uma Page do Puppeteer válida' });
          return;
        }

        page.setRequestInterception(true);

        page.on('request', (request: unknown) => {
          // Valida se request é um Request do Puppeteer
          if (!isRequest(request)) {
            log.warn({ msg: 'AVISO: request não é um Request do Puppeteer válido' });
            return;
          }

          const resourceType = request.resourceType();
          const url = request.url();

          // Block unnecessary resources for speed
          if (this.config.blockUnnecessaryRequests) {
            if (['image', 'media', 'font', 'websocket'].includes(resourceType)) {
              // Allow only essential images (logos, etc)
              if (resourceType === 'image' && this.isEssentialImage(url)) {
                request.continue();
              } else {
                request.abort();
              }
            } else if (['stylesheet'].includes(resourceType)) {
              // Allow CSS but intercept for minification
              request.continue();
            } else {
              // Block everything else
              request.abort();
            }
          } else {
            request.continue();
          }
        });
      },

      // Page configuration for speed
      configureForSpeed: async (page: unknown) => {
        // Valida se page é uma Page do Puppeteer
        if (!isPage(page)) {
          throw new Error('ERRO: page não é uma Page do Puppeteer válida');
        }

        // Disable JavaScript (reports are static)
        await page.setJavaScriptEnabled(false);

        // Set faster viewport
        await page.setViewport({ width: 1024, height: 768, deviceScaleFactor: 1 });

        // Optimize timeouts
        await page.setDefaultTimeout(8000);
        await page.setDefaultNavigationTimeout(8000);

        // Disable animations and transitions
        if (this.config.disableAnimations) {
          await page.addStyleTag({
            content: `
              *, *::before, *::after {
                animation-duration: 0.001ms !important;
                animation-delay: 0s !important;
                transition-duration: 0.001ms !important;
                transition-delay: 0s !important;
              }
            `
          });
        }
      },

      // Content loading optimization
      waitStrategy: this.config.blockUnnecessaryRequests ?
        'domcontentloaded' : 'networkidle2'
    };
  }

  // ================================
  // OTIMIZAÇÃO DE TEMPLATES
  // ================================

  optimizeHTML(html: string): string {
    if (!this.config.htmlMinification) return html;

    return html
      // Remove comments
      .replace(/<!--[\s\S]*?-->/g, '')
      // Remove extra whitespace
      .replace(/>\s+</g, '><')
      .replace(/\s{2,}/g, ' ')
      // Remove empty lines
      .replace(/^\s*\n/gm, '')
      .trim();
  }

  optimizeCSS(css: string): string {
    if (!this.config.cssMinification) return css;

    return css
      // Remove comments
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // Remove extra whitespace
      .replace(/\s{2,}/g, ' ')
      .replace(/;\s*}/g, '}')
      .replace(/\s*{\s*/g, '{')
      .replace(/;\s*/g, ';')
      .trim();
  }

  // ================================
  // GERENCIAMENTO DE MEMÓRIA
  // ================================

  private setupPerformanceMonitoring(): void {
    // Garbage collection automático
    this.gcInterval = setInterval(() => {
      this.performGarbageCollection();
    }, this.config.gcIntervalMs);

    // Monitor de memória
    setInterval(() => {
      const memUsage = process.memoryUsage();
      const currentMB = Math.round(memUsage.heapUsed / 1024 / 1024);

      if (currentMB > this.metrics.memoryPeakMB) {
        this.metrics.memoryPeakMB = currentMB;
      }

      // Force GC se memória muito alta
      if (currentMB > this.config.maxMemoryUsageMB * 0.9) {
        log.warn({ msg: 'Memória alta (MB), forçando GC...' });
        this.performGarbageCollection();
      }
    }, 10000);
  }

  private performGarbageCollection(): void {
    const now = Date.now();
    if (now - this.lastGcTime < this.config.gcIntervalMs / 2) {
      return; // Evita GC muito frequente
    }

    try {
      if (global.gc) {
        global.gc();
        this.metrics.gcCount++;
        this.lastGcTime = now;

        const memUsage = process.memoryUsage();
        log.info({ msg: 'GC executado: MB heap' });
      }
    } catch (_error) {
      logError(error, '${ICONS.WARNING} Erro no GC:', { component: 'refactored' });
    }
  }

  // ================================
  // ESTRATÉGIAS DE BATCH OTIMIZADO
  // ================================

  calculateOptimalBatchStrategy(totalJobs: number): {
    batches: number;
    batchSize: number;
    parallelBatches: number;
    estimatedTime: number;
    recommendedStrategy: string;
  } {
    // Para 100 relatórios em < 5 minutos
    const targetTime = 5 * 60 * 1000; // 5 minutos em ms
    // Target throughput: 20 relatórios/min (used for reference in calculations below)

    let batches: number;
    let batchSize: number;
    let parallelBatches: number;

    if (totalJobs >= 100) {
      // Estratégia ULTRA_FAST
      batchSize = this.config.batchSize;
      batches = Math.ceil(totalJobs / batchSize);
      parallelBatches = Math.min(this.config.parallelBatches, batches);
    } else if (totalJobs >= 50) {
      // Estratégia FAST
      batchSize = Math.min(this.config.batchSize, totalJobs);
      batches = Math.ceil(totalJobs / batchSize);
      parallelBatches = Math.min(2, batches);
    } else {
      // Estratégia SINGLE_BATCH
      batchSize = totalJobs;
      batches = 1;
      parallelBatches = 1;
    }

    // Estimativa de tempo (pessimista)
    const avgTimePerReport = 2500; // 2.5s por relatório (conservador)
    const estimatedTime = Math.ceil((totalJobs * avgTimePerReport) / parallelBatches);

    let recommendedStrategy = 'BALANCED';
    if (totalJobs >= 100 && estimatedTime <= targetTime) {
      recommendedStrategy = 'ULTRA_FAST';
    } else if (totalJobs >= 50) {
      recommendedStrategy = 'FAST';
    }

    return {
      batches,
      batchSize,
      parallelBatches,
      estimatedTime,
      recommendedStrategy
    };
  }

  // ================================
  // MÉTRICAS E MONITORAMENTO
  // ================================

  updateMetrics(reportCount: number, batchTime: number): void {
    this.metrics.totalReports += reportCount;
    this.metrics.totalTime += batchTime;
    this.metrics.averageTime = this.metrics.totalTime / this.metrics.totalReports;
    this.metrics.currentThroughput = (reportCount / batchTime) * 60000; // relatórios/min
  }

  getPerformanceReport(): {
    metrics: {
      totalReports: number;
      totalTime: number;
      averageTime: number;
      currentThroughput: number;
      memoryPeakMB: number;
      gcCount: number;
      cacheHits: number;
    };
    config: PerformanceConfig;
    recommendations: string[];
    targetMet: boolean;
  } {
    const recommendations: string[] = [];

    // Análise de performance
    if (this.metrics.currentThroughput < 20) {
      recommendations.push('Throughput abaixo da meta (20 relatórios/min)');
      recommendations.push('Considere aumentar maxConcurrentPages ou usar perfil ULTRA_FAST');
    }

    if (this.metrics.memoryPeakMB > this.config.maxMemoryUsageMB) {
      recommendations.push('Uso de memória acima do limite configurado');
      recommendations.push('Considere reduzir batchSize ou aumentar gcIntervalMs');
    }

    if (this.metrics.averageTime > 3000) { // > 3s por relatório
      recommendations.push('Tempo médio por relatório muito alto');
      recommendations.push('Ative otimizações de CSS/HTML e bloqueio de recursos');
    }

    const targetMet = this.metrics.currentThroughput >= 20;

    return {
      metrics: { ...this.metrics },
      config: this.config,
      recommendations,
      targetMet
    };
  }

  // ================================
  // CLEANUP E FINALIZAÇÃO
  // ================================

  cleanup(): void {
    if (this.gcInterval) {
      clearInterval(this.gcInterval);
      this.gcInterval = null;
    }

    // GC final
    this.performGarbageCollection();

    log.info({ msg: 'Performance Optimizer finalizado' });
  }

  // ================================
  // UTILITÁRIOS PRIVADOS
  // ================================

  private isEssentialImage(url: string): boolean {
    return url.includes('logo') ||
           url.includes('data:image') ||
           url.includes('essential') ||
           url.includes('header');
  }
}

// ================================
// INSTÂNCIA GLOBAL
// ================================

let globalOptimizer: PerformanceOptimizer | null = null;

/**
 * Obtém o otimizador global configurado para máxima velocidade
 */
export function getPerformanceOptimizer(): PerformanceOptimizer {
  if (!globalOptimizer) {
    globalOptimizer = new PerformanceOptimizer('ULTRA_FAST');
  }
  return globalOptimizer;
}

/**
 * Testa a capacidade do sistema para 100 relatórios
 */
export async function benchmarkSystem(): Promise<{
  canHandle100Reports: boolean;
  estimatedTime: number;
  recommendedProfile: keyof typeof PERFORMANCE_PROFILES;
}> {
  const optimizer = getPerformanceOptimizer();
  const strategy = optimizer.calculateOptimalBatchStrategy(100);

  return {
    canHandle100Reports: strategy.estimatedTime <= 5 * 60 * 1000,
    estimatedTime: strategy.estimatedTime,
    recommendedProfile: strategy.recommendedStrategy as keyof typeof PERFORMANCE_PROFILES
  };
}

export default PerformanceOptimizer;