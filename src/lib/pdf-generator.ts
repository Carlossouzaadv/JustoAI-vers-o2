// ================================
// GERADOR DE PDF COM PUPPETEER OTIMIZADO
// ================================
// Sistema otimizado para processar 100 relatórios em < 5 minutos

import puppeteer, { Browser, Page, LaunchOptions } from 'puppeteer';
import { promises as fs } from 'fs';
import { ICONS } from './icons';
import { log, logError } from '@/lib/services/logger';
import {
  generateReportTemplate,
  ReportType,
  ReportData,
  ReportCustomization
} from './report-templates';

// ================================
// TIPOS E INTERFACES
// ================================

export interface PDFGenerationOptions {
  format?: 'A4' | 'Letter';
  orientation?: 'portrait' | 'landscape';
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
  displayHeaderFooter?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
  printBackground?: boolean;
  scale?: number;
  quality?: number;
}

export interface BatchGenerationJob {
  id: string;
  reportType: ReportType;
  data: ReportData;
  customization: ReportCustomization;
  options?: PDFGenerationOptions;
  outputPath?: string;
}

export interface BatchGenerationResult {
  jobId: string;
  success: boolean;
  outputPath?: string;
  _error?: string;
  generationTime: number;
  fileSize?: number;
}

export interface BatchGenerationStats {
  totalJobs: number;
  successful: number;
  failed: number;
  totalTime: number;
  averageTime: number;
  totalSize: number;
  throughput: number; // relatórios por minuto
}

// ================================
// CLASSE PRINCIPAL DO GERADOR PDF
// ================================

export class PDFGenerator {
  private browser: Browser | null = null;
  private pagePool: Page[] = [];
  private readonly maxConcurrentPages: number;

  private readonly puppeteerOptions: LaunchOptions;

  constructor(maxConcurrentPages: number = 10) {
    this.maxConcurrentPages = maxConcurrentPages;

    // Otimizações para máxima velocidade
    this.puppeteerOptions = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--disable-extensions',
        '--disable-default-apps',
        '--disable-sync',
        '--metrics-recording-only',
        '--no-default-browser-check',
        '--mute-audio',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ],
      ignoreDefaultArgs: ['--disable-extensions'],
      timeout: 30000
    };
  }

  // ================================
  // INICIALIZAÇÃO E CLEANUP
  // ================================

  async initialize(): Promise<void> {
    try {
      log.info({ msg: 'Inicializando Puppeteer para geração de PDF...' });

      this.browser = await puppeteer.launch(this.puppeteerOptions);

      // Criar pool de páginas reutilizáveis
      for (let i = 0; i < this.maxConcurrentPages; i++) {
        const page = await this.browser.newPage();

        // Otimizações da página
        await page.setDefaultTimeout(10000);
        await page.setDefaultNavigationTimeout(10000);

        // Desabilitar recursos desnecessários para velocidade
        await page.setRequestInterception(true);
        page.on('request', (request) => {
          const resourceType = request.resourceType();
          if (['image', 'font'].includes(resourceType)) {
            // Permitir apenas imagens e fontes essenciais
            request.continue();
          } else if (['stylesheet'].includes(resourceType)) {
            // Permitir CSS
            request.continue();
          } else {
            // Bloquear outros recursos
            request.abort();
          }
        });

        this.pagePool.push(page);
      }

      log.info({ msg: 'Puppeteer inicializado com  páginas simultâneas' });

    } catch (error) {
      logError(error, `${ICONS.ERROR} Erro ao inicializar Puppeteer:`, { component: 'refactored' });
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.pagePool = [];
      log.info({ msg: 'Puppeteer finalizado' });
    }
  }

  // ================================
  // GERAÇÃO DE PDF INDIVIDUAL
  // ================================

  async generatePDF(
    reportType: ReportType,
    data: ReportData,
    customization: ReportCustomization,
    options?: PDFGenerationOptions
  ): Promise<Buffer> {
    const startTime = Date.now();

    if (!this.browser || this.pagePool.length === 0) {
      await this.initialize();
    }

    // Obter página do pool
    const page = this.pagePool.pop();
    if (!page) {
      throw new Error('Nenhuma página disponível no pool');
    }

    try {
      // Gerar HTML do template
      const html = generateReportTemplate(reportType, data, customization);

      // Carregar HTML na página
      await page.setContent(html, {
        waitUntil: 'networkidle0',
        timeout: 10000
      });

      // Configurações padrão do PDF otimizadas
      const defaultOptions: PDFGenerationOptions = {
        format: 'A4',
        orientation: 'portrait',
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        },
        printBackground: true,
        displayHeaderFooter: false,
        scale: 0.8,
        ...options
      };

      // Gerar PDF
      const pdfBuffer = await page.pdf({
        format: (defaultOptions.format || 'A4') as 'A4' | 'Letter',
        landscape: defaultOptions.orientation === 'landscape',
        margin: defaultOptions.margin,
        printBackground: defaultOptions.printBackground,
        displayHeaderFooter: defaultOptions.displayHeaderFooter,
        headerTemplate: defaultOptions.headerTemplate,
        footerTemplate: defaultOptions.footerTemplate,
        scale: defaultOptions.scale
      });

      const generationTime = Date.now() - startTime;
      log.info({ msg: 'PDF gerado em ms (KB)' });

      return Buffer.from(pdfBuffer);

    } catch (error) {
      logError(error, `${ICONS.ERROR} Erro na geração de PDF:`, { component: 'refactored' });
      throw error;
    } finally {
      // Retornar página ao pool
      this.pagePool.push(page);
    }
  }

  // ================================
  // BATCH PROCESSING OTIMIZADO
  // ================================

  async generateBatch(jobs: BatchGenerationJob[]): Promise<{
    results: BatchGenerationResult[];
    stats: BatchGenerationStats;
  }> {
    const startTime = Date.now();
    const results: BatchGenerationResult[] = [];

    log.info({ msg: 'Iniciando batch de  relatórios...' });

    if (!this.browser) {
      await this.initialize();
    }

    // Processar em lotes para otimizar memória
    const batchSize = Math.min(this.maxConcurrentPages, 10);
    const batches = this.chunkArray(jobs, batchSize);

    let successful = 0;
    let failed = 0;
    let totalSize = 0;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      log.info({ msg: 'Processando lote / ( relatórios)' });

      // Processar lote em paralelo
      const batchPromises = batch.map(async (job) => {
        const jobStartTime = Date.now();

        try {
          const pdfBuffer = await this.generatePDF(
            job.reportType,
            job.data,
            job.customization,
            job.options
          );

          const generationTime = Date.now() - jobStartTime;
          successful++;
          totalSize += pdfBuffer.length;

          const result: BatchGenerationResult = {
            jobId: job.id,
            success: true,
            generationTime,
            fileSize: pdfBuffer.length
          };

          // Salvar arquivo se especificado
          if (job.outputPath) {
            await fs.writeFile(job.outputPath, pdfBuffer);
            result.outputPath = job.outputPath;
          }

          return result;

        } catch (error) {
          logError(error, `${ICONS.ERROR} Erro no job ${job.id}:`, { component: 'refactored' });
          failed++;

          return {
            jobId: job.id,
            success: false,
            _error: error instanceof Error ? error.message : 'Erro desconhecido',
            generationTime: Date.now() - jobStartTime
          } as BatchGenerationResult;
        }
      });

      // Aguardar conclusão do lote
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Pequena pausa entre lotes para estabilidade
      if (i < batches.length - 1) {
        await this.sleep(100);
      }
    }

    const totalTime = Date.now() - startTime;
    const averageTime = results.length > 0 ?
      results.reduce((sum, r) => sum + r.generationTime, 0) / results.length : 0;
    const throughput = (successful / totalTime) * 60000; // relatórios por minuto

    const stats: BatchGenerationStats = {
      totalJobs: jobs.length,
      successful,
      failed,
      totalTime,
      averageTime,
      totalSize,
      throughput
    };

    log.info({ msg: 'Batch concluído: / sucessos em ms' });
    log.info({ msg: 'Throughput:  relatórios/min' });

    return { results, stats };
  }

  // ================================
  // GERAÇÃO RÁPIDA COM TEMPLATE CACHE
  // ================================

  private templateCache = new Map<string, string>();

  async generatePDFCached(
    reportType: ReportType,
    data: ReportData,
    customization: ReportCustomization,
    options?: PDFGenerationOptions
  ): Promise<Buffer> {
    // Cache key baseado na customização
    const cacheKey = this.generateCacheKey(reportType, customization);

    if (!this.browser || this.pagePool.length === 0) {
      await this.initialize();
    }

    const page = this.pagePool.pop();
    if (!page) {
      throw new Error('Nenhuma página disponível no pool');
    }

    try {
      let html: string;

      // Verificar cache de template
      if (this.templateCache.has(cacheKey)) {
        const template = this.templateCache.get(cacheKey)!;
        // Substituir dados dinâmicos no template cacheado
        html = this.injectDataIntoTemplate(template, data);
      } else {
        // Gerar e cachear template
        html = generateReportTemplate(reportType, data, customization);
        this.templateCache.set(cacheKey, html);
      }

      // Resto do processo igual
      await page.setContent(html, {
        waitUntil: 'domcontentloaded', // Mais rápido que networkidle0
        timeout: 5000
      });

      const defaultOptions: PDFGenerationOptions = {
        format: 'A4',
        orientation: 'portrait',
        margin: {
          top: '15mm',
          right: '10mm',
          bottom: '15mm',
          left: '10mm'
        },
        printBackground: true,
        displayHeaderFooter: false,
        scale: 0.9, // Menor para ser mais rápido
        ...options
      };

      const pdfBuffer = await page.pdf({
        format: (defaultOptions.format || 'A4') as 'A4' | 'Letter',
        landscape: defaultOptions.orientation === 'landscape',
        margin: defaultOptions.margin,
        printBackground: defaultOptions.printBackground,
        scale: defaultOptions.scale
      });

      return Buffer.from(pdfBuffer);

    } finally {
      this.pagePool.push(page);
    }
  }

  // ================================
  // UTILITÁRIOS PRIVADOS
  // ================================

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateCacheKey(
    reportType: ReportType,
    customization: ReportCustomization
  ): string {
    const keyData = {
      reportType,
      companyName: customization.company_name,
      primaryColor: customization.primary_color,
      hasLogo: !!customization.client_logo
    };
    return btoa(JSON.stringify(keyData));
  }

  private injectDataIntoTemplate(template: string, data: ReportData): string {
    // Substituição simples de placeholders dinâmicos
    // Em implementação real, usaria um engine de template mais sofisticado
    return template
      .replace(/{{TITLE}}/g, data.title)
      .replace(/{{GENERATED_AT}}/g, data.generated_at.toLocaleDateString('pt-BR'))
      .replace(/{{GENERATED_BY}}/g, data.generated_by);
  }

  // ================================
  // MÉTRICAS E MONITORAMENTO
  // ================================

  async getPerformanceMetrics(): Promise<{
    poolSize: number;
    availablePages: number;
    cacheSize: number;
    memoryUsage: NodeJS.MemoryUsage;
  }> {
    return {
      poolSize: this.maxConcurrentPages,
      availablePages: this.pagePool.length,
      cacheSize: this.templateCache.size,
      memoryUsage: process.memoryUsage()
    };
  }

  clearTemplateCache(): void {
    this.templateCache.clear();
    log.info({ msg: 'Cache de templates limpo' });
  }
}

// ================================
// INSTÂNCIA SINGLETON GLOBAL
// ================================

let globalPDFGenerator: PDFGenerator | null = null;

/**
 * Obtém a instância global do gerador PDF
 */
export function getPDFGenerator(maxConcurrentPages: number = 10): PDFGenerator {
  if (!globalPDFGenerator) {
    globalPDFGenerator = new PDFGenerator(maxConcurrentPages);
  }
  return globalPDFGenerator;
}

/**
 * Cleanup global
 */
export async function cleanupGlobalPDFGenerator(): Promise<void> {
  if (globalPDFGenerator) {
    await globalPDFGenerator.cleanup();
    globalPDFGenerator = null;
  }
}

// ================================
// UTILITÁRIOS DE ALTO NÍVEL
// ================================

/**
 * Geração rápida de PDF individual
 */
export async function generateQuickPDF(
  reportType: ReportType,
  data: ReportData,
  customization: ReportCustomization,
  options?: PDFGenerationOptions
): Promise<Buffer> {
  const generator = getPDFGenerator();
  return await generator.generatePDFCached(reportType, data, customization, options);
}

/**
 * Batch processing otimizado
 */
export async function generateBatchPDFs(
  jobs: BatchGenerationJob[]
): Promise<{ results: BatchGenerationResult[]; stats: BatchGenerationStats }> {
  const generator = getPDFGenerator(Math.min(jobs.length, 15)); // Máximo 15 páginas concorrentes
  return await generator.generateBatch(jobs);
}

export default PDFGenerator;