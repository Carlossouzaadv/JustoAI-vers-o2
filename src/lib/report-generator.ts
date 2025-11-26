
// ================================================================
// GERADOR DE RELATÓRIOS - PDF e DOCX com Templates
// ================================================================

import { prisma } from '@/lib/prisma';
import { createHash } from 'crypto';
import { ReportType, AudienceType, OutputFormat } from '@/lib/types/database';
import { ICONS } from '@/lib/icons';
import { getGeminiClient } from './gemini-client';
import { ModelTier } from './ai-model-router';
import fs from 'fs/promises';
import path from 'path';
import { PDFTemplateEngine, PDFTemplateOptions } from './report-templates/pdf-template-engine';
import { DOCXTemplateEngine, DOCXTemplateOptions } from './report-templates/docx-template-engine';
import {
  ReportFileUrls,
  CachedReportData,
} from '@/lib/types/json-fields';
import {
  isReportFileUrls,
  isCachedReportData,
} from '@/lib/types/type-guards';
import { log, logError } from '@/lib/services/logger';

// Type definitions for Gemini API result
interface GeminiResult {
  content: string;
  metadata?: {
    tokensUsed?: number;
  };
}

// Type definitions for process in payload
interface PayloadProcess {
  id: string;
  number: unknown;
  client: unknown;
  status: unknown;
  recentMovements?: unknown[];
  movements?: unknown[];
}

// Type guard to validate Gemini API result
function isGeminiResult(data: unknown): data is GeminiResult {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const obj = data as Record<string, unknown>;
  return 'content' in obj && typeof obj.content === 'string';
}

// Type guard to validate process object in payload
function isPayloadProcess(process: unknown): process is PayloadProcess {
  if (typeof process !== 'object' || process === null) {
    return false;
  }
  const obj = process as Record<string, unknown>;
  return 'id' in obj && 'number' in obj && 'client' in obj && 'status' in obj;
}

// ================================================================
// INTERFACES PARA QUERIES PRISMA - Padrão-Ouro Type Safety
// ================================================================

/**
 * Representa um processo monitorado retornado pela query Prisma
 * com includes de case.client e movements
 */
interface MonitoredProcessFromQuery {
  id: string;
  processNumber: string;
  monitoringStatus: string;
  case: {
    client: {
      name: string;
      type: string;
    } | null;
  } | null;
  movements: ProcessMovementFromQuery[];
}

/**
 * Representa uma movimentação processual retornada pela query Prisma
 */
interface ProcessMovementFromQuery {
  date: Date;
  description: string;
  type: string | null;
}

/**
 * Converte ReportSummary para objeto JSON-safe para armazenar em Prisma
 * Padrão-Ouro: Serialização segura JSON.parse(JSON.stringify) + validação de estrutura
 *
 * O Prisma Json type aceita o resultado de JSON.parse(JSON.stringify(...))
 * que é garantidamente um objeto JSON válido sem funções, símbolos, etc
 */
function convertReportSummaryToJsonSafe(summary: ReportSummary): object {
  try {
    // JSON.parse(JSON.stringify(...)) faz duas coisas importantes:
    // 1. Serializa: Remove funções, símbolos, undefined, etc
    // 2. Deserializa: Retorna um objeto JavaScript puro que é 100% JSON-safe
    // 3. ZERO casting perigoso necessário
    const jsonSafe = JSON.parse(JSON.stringify(summary));

    // Verificação de sanidade: garantir que é um objeto
    if (typeof jsonSafe !== 'object' || jsonSafe === null) {
      throw new Error('Summary serializad não é um objeto válido');
    }

    return jsonSafe;
  } catch (error) {
    logError(`${ICONS.ERROR} Erro ao converter ReportSummary para JSON-safe:`, '_error', { component: 'reportGenerator' });
    // Fallback: retornar objeto minimalista garantidamente JSON-safe
    return {
      totalProcesses: summary.totalProcesses,
      error: 'Falha ao serializar summary completo'
    };
  }
}

// Interfaces para o gerador
export interface ReportGenerationRequest {
  workspaceId: string;
  reportType: ReportType;
  processIds: string[];
  audienceType: AudienceType;
  outputFormats: OutputFormat[];
  deltaDataOnly?: boolean;
  customTemplate?: string;
}

export interface ReportSummary {
  totalProcesses: number;
  contentLength?: number;
  audienceType?: string;
  generatedAt?: string;
  model?: string;
  error?: string;
  [key: string]: unknown;
}

export interface ReportGenerationResult {
  success: boolean;
  reportId: string;
  fileUrls: Record<string, string>;
  summary: ReportSummary;
  tokensUsed: number;
  cacheHit: boolean;
  cacheKey?: string;
  processingTime: number;
  error?: string;
}

export interface ProcessData {
  id: string;
  number: string;
  client: {
    name: string;
    type: string;
  };
  status: string;
  lastMovement?: {
    date: Date;
    description: string;
  };
  movements: Array<{
    date: Date;
    description: string;
    type: string;
  }>;
  summary?: string;
}

export interface ReportTemplate {
  id: string;
  name: string;
  headerContent?: string;
  footerContent?: string;
  styles: unknown;
}

export class ReportGenerator {
  private pdfEngine = new PDFTemplateEngine();
  private docxEngine = new DOCXTemplateEngine();

  /**
   * Gera relatório agendado completo
   */
  async generateScheduledReport(request: ReportGenerationRequest): Promise<ReportGenerationResult> {
    const startTime = Date.now();
    log.info({ msg: '${ICONS.PROCESS} Iniciando geração de relatório ${request.reportType} para ${request.processIds.length} processos', component: 'reportGenerator' });

    try {
      // 1. Verificar cache
      const cacheResult = await this.checkReportCache(request);
      if (cacheResult.hit) {
        log.info({ msg: '${ICONS.SUCCESS} Cache hit para relatório', component: 'reportGenerator' });

        // Build summary safely from cached data
        let cacheSummary: ReportSummary = {
          totalProcesses: 0
        };
        if (cacheResult.summary !== undefined && cacheResult.summary !== null && typeof cacheResult.summary === 'object') {
          const summaryObj = cacheResult.summary as Record<string, unknown>;
          cacheSummary = {
            totalProcesses: typeof summaryObj.totalProcesses === 'number' ? summaryObj.totalProcesses : 0,
            ...summaryObj
          };
        }

        return {
          success: true,
          reportId: cacheResult.reportId!,
          fileUrls: cacheResult.fileUrls!,
          summary: cacheSummary,
          tokensUsed: 0,
          cacheHit: true,
          cacheKey: cacheResult.cacheKey,
          processingTime: Date.now() - startTime
        };
      }

      // 2. Carregar dados dos processos
      const processData = await this.loadProcessData(request.workspaceId, request.processIds);

      // 3. Preparar payload para Gemini
      const prompt = this.buildPrompt(request, processData);
      const payload = request.deltaDataOnly
        ? this.buildDeltaPayload(processData)
        : this.buildFullPayload(processData);

      // 4. Gerar conteúdo com Gemini (placeholder)
      const geminiResult = await this.generateContentWithGemini(prompt, payload, request.audienceType);

      // 5. Carregar template
      const template = await this.loadTemplate(request.workspaceId, request.customTemplate);

      // 6. Gerar arquivos nos formatos solicitados
      const fileUrls: Record<string, string> = {};

      for (const format of request.outputFormats) {
        const fileUrl = await this.generateFile(
          format,
          geminiResult.content,
          template,
          request.workspaceId,
          processData
        );
        fileUrls[format] = fileUrl;
      }

      // 7. Salvar cache
      const cacheKey = this.generateCacheKey(request, processData);
      await this.saveReportCache(cacheKey, request, {
        summary: geminiResult.summary,
        fileUrls,
        tokensUsed: geminiResult.tokensUsed
      });

      const reportId = `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      log.info({ msg: '${ICONS.SUCCESS} Relatório gerado com sucesso em ${Date.now() - startTime}ms', component: 'reportGenerator' });

      return {
        success: true,
        reportId,
        fileUrls,
        summary: geminiResult.summary,
        tokensUsed: geminiResult.tokensUsed,
        cacheHit: false,
        cacheKey,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      logError(`${ICONS.ERROR} Erro na geração do relatório:`, '_error', { component: 'reportGenerator' });
      return {
        success: false,
        reportId: '',
        fileUrls: {},
        summary: {
          totalProcesses: 0
        },
        tokensUsed: 0,
        cacheHit: false,
        processingTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }

  /**
   * Verifica cache existente
   */
  private async checkReportCache(request: ReportGenerationRequest): Promise<{
    hit: boolean;
    cacheKey?: string;
    reportId?: string;
    fileUrls?: Record<string, string>;
    summary?: unknown;
  }> {
    try {
      // Carregar últimas movimentações para gerar chave de cache
      const processData = await this.loadProcessData(request.workspaceId, request.processIds);
      const cacheKey = this.generateCacheKey(request, processData);

      const cached = await prisma.reportCache.findUnique({
        where: { cacheKey }
      });

      if (!cached) {
        return { hit: false };
      }

      // Verificar se cache ainda é válido
      if (cached.expiresAt < new Date()) {
        // Cache expirado, deletar
        await prisma.reportCache.delete({
          where: { cacheKey }
        });
        return { hit: false };
      }

      // Validar fileUrls com type guard
      if (!isReportFileUrls(cached.fileUrls)) {
        log.warn({ msg: '${ICONS.WARNING} Cache fileUrls validation failed, skipping cache', component: 'reportGenerator' });
        return { hit: false };
      }

      // Validar cachedData se for CachedReportData
      if (cached.cachedData !== null && !isCachedReportData(cached.cachedData)) {
        log.warn({ msg: '${ICONS.WARNING} Cache data validation failed, skipping cache', component: 'reportGenerator' });
        return { hit: false };
      }

      const fileUrls: ReportFileUrls = cached.fileUrls;
      const cachedData: CachedReportData | null = cached.cachedData ? (cached.cachedData as CachedReportData) : null;

      // Converter fileUrls para Record<string, string>, filtrando undefined
      const cleanFileUrls = Object.fromEntries(
        Object.entries(fileUrls).filter(([, v]) => v !== undefined)
      ) as Record<string, string>;

      return {
        hit: true,
        cacheKey,
        reportId: cached.id,
        fileUrls: cleanFileUrls,
        summary: cachedData
      };

    } catch (error) {
      logError(`${ICONS.ERROR} Erro ao verificar cache:`, '_error', { component: 'reportGenerator' });
      return { hit: false };
    }
  }

  /**
   * Carrega dados dos processos
   */
  private async loadProcessData(workspaceId: string, processIds: string[]): Promise<ProcessData[]> {
    const processes = await prisma.monitoredProcess.findMany({
      where: {
        id: { in: processIds },
        workspaceId
      },
      include: {
        case: {
          include: {
            client: true
          }
        },
        movements: {
          orderBy: { date: 'desc' },
          take: 10
        }
      }
    });

    return processes.map((process: MonitoredProcessFromQuery) => ({
      id: process.id,
      number: process.processNumber,
      client: {
        name: process.case?.client?.name || 'Cliente não informado',
        type: process.case?.client?.type || 'INDIVIDUAL'
      },
      status: process.monitoringStatus,
      lastMovement: process.movements[0] ? {
        date: process.movements[0].date,
        description: process.movements[0].description
      } : undefined,
      movements: process.movements.map((mov: ProcessMovementFromQuery) => ({
        date: mov.date,
        description: mov.description,
        type: mov.type || 'MOVIMENTO'
      }))
      // summary não está disponível no modelo MonitoredProcess
    }));
  }

  /**
   * Constrói prompt baseado no tipo de relatório e audiência
   */
  private buildPrompt(request: ReportGenerationRequest, _processData: ProcessData[]): string {
    const audienceMap = {
      CLIENTE: 'linguagem acessível para leigos, evitando jargões jurídicos',
      DIRETORIA: 'linguagem executiva, focando em impactos e resultados',
      USO_INTERNO: 'linguagem técnica jurídica, detalhada para advogados'
    };

    const audienceStyle = audienceMap[request.audienceType];

    if (request.reportType === 'NOVIDADES' && request.deltaDataOnly) {
      return `
        Você é um assistente jurídico especializado. Crie um relatório de NOVIDADES dos processos,
        usando ${audienceStyle}.

        INSTRUÇÕES:
        - Foque apenas nas movimentações recentes (últimos 7 dias)
        - Destaque impactos e próximos passos
        - Use tom profissional mas ${request.audienceType === 'CLIENTE' ? 'didático' : 'direto'}
        - Inclua resumo executivo e próximas ações
        - Total máximo: 2 páginas

        ESTRUTURA:
        1. Resumo Executivo
        2. Novidades por Processo
        3. Ações Recomendadas
        4. Prazos Importantes
      `;
    }

    return `
      Você é um assistente jurídico especializado. Crie um relatório COMPLETO dos processos,
      usando ${audienceStyle}.

      INSTRUÇÕES:
      - Análise completa de todos os processos
      - Histórico relevante e situação atual
      - Estratégias e recomendações
      - Use tom profissional e ${request.audienceType === 'CLIENTE' ? 'explicativo' : 'técnico'}
      - Inclua gráficos/estatísticas quando relevante

      ESTRUTURA:
      1. Sumário Executivo
      2. Análise por Processo
      3. Estatísticas Gerais
      4. Riscos e Oportunidades
      5. Recomendações Estratégicas
      6. Cronograma de Ações
    `;
  }

  /**
   * Constrói payload delta (apenas novidades)
   */
  private buildDeltaPayload(processData: ProcessData[]): Record<string, unknown> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return {
      type: 'delta',
      summary: 'Movimentações dos últimos 7 dias',
      processes: processData.map(process => ({
        id: process.id,
        number: process.number,
        client: process.client.name,
        recentMovements: process.movements.filter(mov => mov.date >= sevenDaysAgo),
        lastSummary: process.summary
      })),
      totalProcesses: processData.length,
      totalRecentMovements: processData.reduce((sum, p) =>
        sum + p.movements.filter(mov => mov.date >= sevenDaysAgo).length, 0
      )
    };
  }

  /**
   * Constrói payload completo
   */
  private buildFullPayload(processData: ProcessData[]): Record<string, unknown> {
    return {
      type: 'full',
      summary: 'Relatório completo de todos os processos',
      processes: processData.map(process => ({
        id: process.id,
        number: process.number,
        client: process.client,
        status: process.status,
        movements: process.movements,
        lastMovement: process.lastMovement,
        summary: process.summary
      })),
      statistics: {
        totalProcesses: processData.length,
        byStatus: this.calculateStatusStats(processData),
        avgMovementsPerProcess: processData.reduce((sum, p) => sum + p.movements.length, 0) / processData.length
      }
    };
  }

  /**
   * Calcula estatísticas por status
   */
  private calculateStatusStats(processData: ProcessData[]): Record<string, number> {
    const stats: Record<string, number> = {};
    processData.forEach(process => {
      stats[process.status] = (stats[process.status] || 0) + 1;
    });
    return stats;
  }

  /**
   * Gera conteúdo com Gemini API real
   */
  private async generateContentWithGemini(
    prompt: string,
    payload: Record<string, unknown>,
    audienceType: AudienceType
  ): Promise<{
    content: string;
    summary: ReportSummary;
    tokensUsed: number;
  }> {
    log.info({ msg: '${ICONS.PROCESS} Chamando Gemini API real para gerar conteúdo...', component: 'reportGenerator' });

    try {
      const geminiClient = getGeminiClient();

      // Usar modelo apropriado baseado no tipo de audiência
      const modelTier = audienceType === 'DIRETORIA' ? ModelTier.PRO : ModelTier.BALANCED;

      const result = await geminiClient.generateJsonContent(prompt, {
        model: modelTier,
        maxTokens: 6000,
        temperature: 0.3
      });

      log.info({ msg: '${ICONS.SUCCESS} Conteúdo gerado com sucesso via Gemini ${modelTier}', component: 'reportGenerator' });

      // Validate result with type guard
      if (!isGeminiResult(result)) {
        log.warn({ msg: '${ICONS.WARNING} Gemini result validation failed, using mock content', component: 'reportGenerator' });
        const mockContent = this.generateMockContent(payload, audienceType);
        const totalProcesses = typeof payload.totalProcesses === 'number' ? payload.totalProcesses : 0;

        return {
          content: mockContent,
          summary: {
            totalProcesses,
            contentLength: mockContent.length,
            audienceType,
            generatedAt: new Date().toISOString(),
            error: 'Gemini result validation failed'
          },
          tokensUsed: Math.floor(mockContent.length / 4)
        };
      }

      // Safely extract data from validated GeminiResult
      const totalProcesses = typeof payload.totalProcesses === 'number' ? payload.totalProcesses : 0;
      const contentLength = result.content.length;

      // Extract metadata safely
      let tokensUsed = Math.floor(contentLength / 4);
      if (result.metadata !== undefined && result.metadata !== null) {
        const metaObj = result.metadata;
        if (typeof metaObj.tokensUsed === 'number') {
          tokensUsed = metaObj.tokensUsed;
        }
      }

      const summary: ReportSummary = {
        totalProcesses,
        contentLength,
        audienceType,
        generatedAt: new Date().toISOString(),
        model: modelTier
      };

      return {
        content: result.content,
        summary,
        tokensUsed
      };
    } catch (error) {
      logError(`${ICONS.ERROR} Erro ao chamar Gemini API:`, '_error', { component: 'reportGenerator' });

      // Fallback para conteúdo mock em caso de erro
      const mockContent = this.generateMockContent(payload, audienceType);
      const totalProcesses = typeof payload.totalProcesses === 'number' ? payload.totalProcesses : 0;

      const summary: ReportSummary = {
        totalProcesses,
        contentLength: mockContent.length,
        audienceType,
        generatedAt: new Date().toISOString(),
        error: 'Fallback para conteúdo mock devido a erro na API'
      };

      return {
        content: mockContent,
        summary,
        tokensUsed: Math.floor(mockContent.length / 4)
      };
    }
  }

  /**
   * Gera conteúdo mock para testes
   */
  private generateMockContent(payload: Record<string, unknown>, audienceType: AudienceType): string {
    const clientLanguage = audienceType === 'CLIENTE';

    // Validate payload structure safely
    const payloadType = typeof payload.type === 'string' ? payload.type : 'full';
    const totalProcesses = typeof payload.totalProcesses === 'number' ? payload.totalProcesses : 0;

    // Validate and filter processes
    let processItems: PayloadProcess[] = [];
    if (Array.isArray(payload.processes)) {
      processItems = payload.processes.filter(isPayloadProcess);
    }

    return `
# RELATÓRIO ${payloadType === 'delta' ? 'DE NOVIDADES' : 'COMPLETO'} - ${new Date().toLocaleDateString()}

## ${clientLanguage ? 'Resumo' : 'Sumário Executivo'}

${clientLanguage
  ? 'Este relatório apresenta as principais atualizações dos seus processos jurídicos.'
  : 'Análise consolidada dos processos monitorados no período.'
}

**Total de processos:** ${totalProcesses}

## Processos Analisados

${processItems.map((process, index) => {
  // Safe property access within validated context (process is PayloadProcess)
  const number = String(process.number ?? 'N/A');
  const clientInfo = process.client;
  const status = String(process.status ?? 'N/A');
  const recentMovements = process.recentMovements;
  const movements = process.movements;

  let clientDisplay = 'Cliente não informado';
  if (clientInfo !== null && clientInfo !== undefined) {
    if (typeof clientInfo === 'object') {
      const clientObj = clientInfo as Record<string, unknown>;
      clientDisplay = typeof clientObj.name === 'string' ? clientObj.name : String(clientInfo);
    } else {
      clientDisplay = String(clientInfo);
    }
  }

  const recentCount = Array.isArray(recentMovements) ? recentMovements.length : 0;
  const movementCount = Array.isArray(movements) ? movements.length : 0;

  return `
### ${index + 1}. Processo ${number}
**Cliente:** ${clientDisplay}
**Status:** ${status}

${recentMovements !== undefined ?
  `**Novidades:** ${recentCount} movimentações recentes` :
  `**Movimentações:** ${movementCount} registradas`
}

${clientLanguage ?
  'Situação atual favorável, sem pendências críticas.' :
  'Status processual dentro da normalidade esperada.'
}
`;
}).join('\n')}

## ${clientLanguage ? 'Próximos Passos' : 'Recomendações'}

${clientLanguage ?
  '1. Acompanhar prazos em andamento\n2. Manter documentação atualizada\n3. Contatar escritório para dúvidas' :
  '1. Monitorar movimentações críticas\n2. Revisar estratégias processuais\n3. Atualizar cronograma de ações'
}

---
*Relatório gerado automaticamente em ${new Date().toLocaleString()}*
    `;
  }

  /**
   * Carrega template personalizado
   */
  private async loadTemplate(workspaceId: string, templateId?: string): Promise<ReportTemplate | null> {
    if (!templateId) {
      // Carregar template padrão
      const defaultTemplate = await prisma.reportTemplate.findFirst({
        where: {
          workspaceId,
          isDefault: true
        }
      });

      return defaultTemplate ? {
        ...defaultTemplate,
        headerContent: defaultTemplate.headerContent || undefined,
        footerContent: defaultTemplate.footerContent || undefined
      } : null;
    }

    const template = await prisma.reportTemplate.findFirst({
      where: {
        id: templateId,
        workspaceId
      }
    });

    return template ? {
      ...template,
      headerContent: template.headerContent || undefined,
      footerContent: template.footerContent || undefined
    } : null;
  }

  /**
   * Gera arquivo PDF ou DOCX
   */
  private async generateFile(
    format: OutputFormat,
    content: string,
    template: ReportTemplate | null,
    workspaceId: string,
    processData: ProcessData[]
  ): Promise<string> {
    const timestamp = new Date().toISOString().split('T')[0];
    const fileName = `relatorio_${timestamp}_${Math.random().toString(36).substr(2, 9)}.${format.toLowerCase()}`;
    const filePath = path.join('reports', workspaceId, timestamp, fileName);

    // Criar diretório se não existir
    const dirPath = path.dirname(filePath);
    await fs.mkdir(dirPath, { recursive: true });

    if (format === 'PDF') {
      await this.generatePDF(content, template, filePath, processData);
    } else if (format === 'DOCX') {
      await this.generateDOCX(content, template, filePath, processData);
    }

    // Retornar URL do arquivo (ajustar conforme necessário)
    const fileUrl = `/files/${filePath}`;
    log.info({ msg: '${ICONS.SUCCESS} Arquivo ${format} gerado: ${fileUrl}', component: 'reportGenerator' });

    return fileUrl;
  }

  /**
   * Gera arquivo PDF
   */
  private async generatePDF(
    content: string,
    template: ReportTemplate | null,
    filePath: string,
    _processData: ProcessData[]
  ): Promise<void> {
    // ✅ Implementar geração real de PDF com Puppeteer
    try {
      log.info({ msg: '${ICONS.PROCESS} Gerando PDF: ${filePath}', component: 'reportGenerator' });

      // Aplicar template ao conteúdo HTML
      const htmlContent = this.applyTemplate(content, template, 'PDF');

      // Usar PDF Template Engine para gerar PDF real
      const pdfOptions: PDFTemplateOptions = {
        reportType: 'JURIDICO',
        audienceType: 'CLIENTE',
        customization: {
          companyName: 'JustoAI',
          primaryColor: '#007bff',
          secondaryColor: '#6c757d',
          accentColor: '#28a745',
          showPageNumbers: true,
          showGeneratedBy: true
        },
        metadata: {
          workspaceName: 'JustoAI V2',
          generatedAt: new Date(),
          generatedBy: 'ReportGenerator',
          processCount: _processData.length
        }
      };

      const result = await this.pdfEngine.generatePDF(htmlContent, pdfOptions, filePath);

      if (result.success) {
        log.info({ msg: '${ICONS.SUCCESS} PDF gerado com sucesso: ${filePath} (${result.fileSize} bytes, ${result.pageCount} páginas)', component: 'reportGenerator' });
      } else {
        throw new Error(result.error || 'Erro desconhecido ao gerar PDF');
      }
    } catch (error) {
      logError(`${ICONS.ERROR} Erro ao gerar PDF:`, '_error', { component: 'reportGenerator' });
      throw error;
    }
  }

  /**
   * Gera arquivo DOCX
   */
  private async generateDOCX(
    content: string,
    template: ReportTemplate | null,
    filePath: string,
    _processData: ProcessData[]
  ): Promise<void> {
    // ✅ Implementar geração real de DOCX com docx library
    try {
      log.info({ msg: '${ICONS.PROCESS} Gerando DOCX: ${filePath}', component: 'reportGenerator' });

      // Converter HTML para conteúdo estruturado para DOCX
      const htmlContent = this.applyTemplate(content, template, 'DOCX');

      // Usar DOCX Template Engine para gerar DOCX real
      const docxOptions: DOCXTemplateOptions = {
        reportType: 'JURIDICO',
        audienceType: 'CLIENTE',
        customization: {
          companyName: 'JustoAI',
          primaryColor: '#007bff',
          secondaryColor: '#6c757d',
          accentColor: '#28a745',
          showPageNumbers: true,
          showGeneratedBy: true
        },
        metadata: {
          workspaceName: 'JustoAI V2',
          generatedAt: new Date(),
          generatedBy: 'ReportGenerator',
          processCount: _processData.length
        }
      };

      const result = await this.docxEngine.generateDOCX(
        htmlContent,
        _processData,
        docxOptions,
        filePath
      );

      if (result.success) {
        log.info({ msg: '${ICONS.SUCCESS} DOCX gerado com sucesso: ${filePath} (${result.fileSize} bytes)', component: 'reportGenerator' });
      } else {
        throw new Error(result.error || 'Erro desconhecido ao gerar DOCX');
      }
    } catch (error) {
      logError(`${ICONS.ERROR} Erro ao gerar DOCX:`, '_error', { component: 'reportGenerator' });
      throw error;
    }
  }

  /**
   * Aplica template ao conteúdo
   */
  private applyTemplate(
    content: string,
    template: ReportTemplate | null,
    format: string
  ): string {
    if (!template) {
      return `[${format}] ${content}`;
    }

    let templatedContent = content;

    if (template.headerContent) {
      templatedContent = `${template.headerContent}\n\n${templatedContent}`;
    }

    if (template.footerContent) {
      templatedContent = `${templatedContent}\n\n${template.footerContent}`;
    }

    return `[${format} com template: ${template.name}]\n\n${templatedContent}`;
  }

  /**
   * Gera chave de cache
   */
  private generateCacheKey(request: ReportGenerationRequest, processData: ProcessData[]): string {
    const lastMovementTimestamp = Math.max(
      ...processData.map(p => p.lastMovement?.date.getTime() || 0)
    );

    const keyData = [
      request.workspaceId,
      request.reportType,
      request.audienceType,
      request.processIds.sort().join('|'),
      lastMovementTimestamp.toString(),
      request.deltaDataOnly ? 'delta' : 'full'
    ].join('||');

    return createHash('sha256').update(keyData).digest('hex');
  }

  /**
   * Salva resultado no cache
   */
  private async saveReportCache(
    cacheKey: string,
    request: ReportGenerationRequest,
    result: {
      summary: ReportSummary;
      fileUrls: Record<string, string>;
      tokensUsed: number;
    }
  ): Promise<void> {
    try {
      // Validar fileUrls
      if (!isReportFileUrls(result.fileUrls)) {
        throw new Error('FileUrls inválidos: falha na validação de tipo');
      }

      const fileUrls: ReportFileUrls = result.fileUrls;
      const summary = result.summary;

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // Cache por 7 dias

      // Converter summary para formato JSON-safe - Padrão-Ouro (ZERO casting perigoso)
      const jsonSafeSummary = convertReportSummaryToJsonSafe(summary);

      await prisma.reportCache.create({
        data: {
          cacheKey,
          workspaceId: request.workspaceId,
          reportType: request.reportType,
          processIds: request.processIds,
          audienceType: request.audienceType,
          lastMovementTimestamp: new Date(),
          cachedData: jsonSafeSummary,
          fileUrls,
          expiresAt
        }
      });

      log.info({ msg: '${ICONS.SUCCESS} Cache salvo com chave: ${cacheKey}', component: 'reportGenerator' });

    } catch (error) {
      logError(`${ICONS.ERROR} Erro ao salvar cache:`, '_error', { component: 'reportGenerator' });
      // Não falhar por erro de cache
    }
  }
}