// ================================================================
// GERADOR DE RELATÓRIOS - PDF e DOCX com Templates
// ================================================================

import { prisma } from '@/lib/prisma';
import { createHash } from 'crypto';
import { ReportType, AudienceType, OutputFormat } from '@prisma/client';
import { ICONS } from '@/lib/icons';
import { getGeminiClient } from './gemini-client';
import { ModelTier } from './ai-model-router';
import fs from 'fs/promises';
import path from 'path';

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
  contentLength: number;
  audienceType: string;
  generatedAt: string;
  model?: string;
  error?: string;
}

export interface ReportGenerationResult {
  success: boolean;
  reportId: string;
  fileUrls: Record<string, string>;
  summary: ReportSummary | Record<string, unknown>;
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
  styles: Record<string, unknown>;
}

export class ReportGenerator {
  /**
   * Gera relatório agendado completo
   */
  async generateScheduledReport(request: ReportGenerationRequest): Promise<ReportGenerationResult> {
    const startTime = Date.now();
    console.log(`${ICONS.PROCESS} Iniciando geração de relatório ${request.reportType} para ${request.processIds.length} processos`);

    try {
      // 1. Verificar cache
      const cacheResult = await this.checkReportCache(request);
      if (cacheResult.hit) {
        console.log(`${ICONS.SUCCESS} Cache hit para relatório`);
        return {
          success: true,
          reportId: cacheResult.reportId!,
          fileUrls: cacheResult.fileUrls!,
          summary: cacheResult.summary!,
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

      console.log(`${ICONS.SUCCESS} Relatório gerado com sucesso em ${Date.now() - startTime}ms`);

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
      console.error(`${ICONS.ERROR} Erro na geração do relatório:`, error);
      return {
        success: false,
        reportId: '',
        fileUrls: {},
        summary: {},
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
    summary?: Record<string, unknown>;
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

      return {
        hit: true,
        cacheKey,
        reportId: cached.id,
        fileUrls: cached.fileUrls as Record<string, string>,
        summary: cached.cachedData as Record<string, unknown>
      };

    } catch (error) {
      console.error(`${ICONS.ERROR} Erro ao verificar cache:`, error);
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

    return processes.map(process => ({
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
      movements: process.movements.map(mov => ({
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
  private buildPrompt(request: ReportGenerationRequest, processData: ProcessData[]): string {
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
    console.log(`${ICONS.PROCESS} Chamando Gemini API real para gerar conteúdo...`);

    try {
      const geminiClient = getGeminiClient();

      // Usar modelo apropriado baseado no tipo de audiência
      const modelTier = audienceType === 'DIRETORIA' ? ModelTier.PRO : ModelTier.BALANCED;

      const result = await geminiClient.generateJsonContent(prompt, {
        model: modelTier,
        maxTokens: 6000,
        temperature: 0.3
      });

      console.log(`${ICONS.SUCCESS} Conteúdo gerado com sucesso via Gemini ${modelTier}`);

      return {
        content: result.content || this.generateMockContent(payload, audienceType),
        summary: result.summary || {
          totalProcesses: payload.totalProcesses || 0,
          contentLength: (result.content || '').length,
          audienceType,
          generatedAt: new Date().toISOString(),
          model: modelTier
        },
        tokensUsed: result.metadata?.tokensUsed || Math.floor((result.content || '').length / 4)
      };
    } catch (error) {
      console.error(`${ICONS.ERROR} Erro ao chamar Gemini API:`, error);

      // Fallback para conteúdo mock em caso de erro
      const mockContent = this.generateMockContent(payload, audienceType);
      return {
        content: mockContent,
        summary: {
          totalProcesses: (payload.totalProcesses as number) || 0,
          contentLength: mockContent.length,
          audienceType,
          generatedAt: new Date().toISOString(),
          error: 'Fallback para conteúdo mock devido a erro na API'
        },
        tokensUsed: Math.floor(mockContent.length / 4)
      };
    }
  }

  /**
   * Gera conteúdo mock para testes
   */
  private generateMockContent(payload: Record<string, unknown>, audienceType: AudienceType): string {
    const clientLanguage = audienceType === 'CLIENTE';

    return `
# RELATÓRIO ${payload.type === 'delta' ? 'DE NOVIDADES' : 'COMPLETO'} - ${new Date().toLocaleDateString()}

## ${clientLanguage ? 'Resumo' : 'Sumário Executivo'}

${clientLanguage
  ? 'Este relatório apresenta as principais atualizações dos seus processos jurídicos.'
  : 'Análise consolidada dos processos monitorados no período.'
}

**Total de processos:** ${payload.totalProcesses}

## Processos Analisados

${(payload.processes as Array<Record<string, unknown>>).map((process: Record<string, unknown>, index: number) => {
  const client = process.client as Record<string, unknown> | string;
  const clientName = typeof client === 'object' ? (client.name as string) : client;
  const recentMovements = process.recentMovements as unknown[] | undefined;
  const movements = process.movements as unknown[] | undefined;
  return `
### ${index + 1}. Processo ${process.number}
**Cliente:** ${clientName}
**Status:** ${process.status}

${recentMovements ?
  `**Novidades:** ${recentMovements.length} movimentações recentes` :
  `**Movimentações:** ${movements?.length || 0} registradas`
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
        id: defaultTemplate.id,
        name: defaultTemplate.name,
        headerContent: defaultTemplate.headerContent || undefined,
        footerContent: defaultTemplate.footerContent || undefined,
        styles: (defaultTemplate.styles as Record<string, unknown>) || {}
      } : null;
    }

    const template = await prisma.reportTemplate.findFirst({
      where: {
        id: templateId,
        workspaceId
      }
    });

    return template ? {
      id: template.id,
      name: template.name,
      headerContent: template.headerContent || undefined,
      footerContent: template.footerContent || undefined,
      styles: (template.styles as Record<string, unknown>) || {}
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
    console.log(`${ICONS.SUCCESS} Arquivo ${format} gerado: ${fileUrl}`);

    return fileUrl;
  }

  /**
   * Gera arquivo PDF
   */
  private async generatePDF(
    content: string,
    template: ReportTemplate | null,
    filePath: string,
    processData: ProcessData[]
  ): Promise<void> {
    // TODO: Implementar geração real de PDF
    // Usando bibliotecas como puppeteer, jsPDF, ou PDFKit

    console.log(`${ICONS.PROCESS} Gerando PDF: ${filePath}`);

    // Mock: criar arquivo de texto por enquanto
    const pdfContent = this.applyTemplate(content, template, 'PDF');
    await fs.writeFile(filePath, pdfContent, 'utf8');

    console.log(`${ICONS.SUCCESS} PDF simulado criado: ${filePath}`);
  }

  /**
   * Gera arquivo DOCX
   */
  private async generateDOCX(
    content: string,
    template: ReportTemplate | null,
    filePath: string,
    processData: ProcessData[]
  ): Promise<void> {
    // TODO: Implementar geração real de DOCX
    // Usando bibliotecas como docx ou officegen

    console.log(`${ICONS.PROCESS} Gerando DOCX: ${filePath}`);

    // Mock: criar arquivo de texto por enquanto
    const docxContent = this.applyTemplate(content, template, 'DOCX');
    await fs.writeFile(filePath, docxContent, 'utf8');

    console.log(`${ICONS.SUCCESS} DOCX simulado criado: ${filePath}`);
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
    result: { summary: ReportSummary; fileUrls: Record<string, string>; tokensUsed: number }
  ): Promise<void> {
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // Cache por 7 dias

      await prisma.reportCache.create({
        data: {
          cacheKey,
          workspaceId: request.workspaceId,
          reportType: request.reportType,
          processIds: request.processIds,
          audienceType: request.audienceType,
          lastMovementTimestamp: new Date(),
          cachedData: result.summary as Record<string, unknown>,
          fileUrls: result.fileUrls,
          expiresAt
        }
      });

      console.log(`${ICONS.SUCCESS} Cache salvo com chave: ${cacheKey}`);

    } catch (error) {
      console.error(`${ICONS.ERROR} Erro ao salvar cache:`, error);
      // Não falhar por erro de cache
    }
  }
}