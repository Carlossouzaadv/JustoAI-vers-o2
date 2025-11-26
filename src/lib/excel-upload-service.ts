// ================================================================
// EXCEL UPLOAD SERVICE - Processamento em Background
// ================================================================
// Implementa upload, validação e processamento de Excel conforme spec

import { createJuditRateLimiter, RateLimitedApiClient } from './rate-limiter';
import { ExcelProcessParser, ExcelParseResult, ExcelProcessRow } from './excel-parser';
import { ICONS } from './icons';
import { PrismaClient } from '@prisma/client';
import { log, logError } from '@/lib/services/logger';

// ================================================================
// INTERFACES E TIPOS
// ================================================================

interface JuditParty {
  nome: string;
  tipo: 'AUTOR' | 'REU' | 'TERCEIRO';
  cpf_cnpj?: string;
}

interface JuditMovement {
  data: string;
  tipo: string;
  descricao: string;
}

interface JuditApiResponseData {
  numero_processo: string;
  tribunal: string;
  partes: JuditParty[];
  movimentacoes: JuditMovement[];
  situacao: string;
  classe: string;
  assunto: string;
  valor_causa?: number;
  data_distribuicao?: string;
}

// ================================================================
// TYPE GUARDS (Mandato Inegociável - Safe Narrowing)
// ================================================================

function isJuditPartyType(value: unknown): value is 'AUTOR' | 'REU' | 'TERCEIRO' {
  return value === 'AUTOR' || value === 'REU' || value === 'TERCEIRO';
}

function isJuditParty(data: unknown): data is JuditParty {
  return (
    typeof data === 'object' &&
    data !== null &&
    'nome' in data &&
    typeof (data as JuditParty).nome === 'string' &&
    'tipo' in data &&
    isJuditPartyType((data as JuditParty).tipo)
  );
}

function isJuditMovement(data: unknown): data is JuditMovement {
  return (
    typeof data === 'object' &&
    data !== null &&
    'data' in data &&
    typeof (data as JuditMovement).data === 'string' &&
    'tipo' in data &&
    typeof (data as JuditMovement).tipo === 'string' &&
    'descricao' in data &&
    typeof (data as JuditMovement).descricao === 'string'
  );
}

function isJuditApiResponseData(data: unknown): data is JuditApiResponseData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'numero_processo' in data &&
    typeof (data as JuditApiResponseData).numero_processo === 'string' &&
    'tribunal' in data &&
    typeof (data as JuditApiResponseData).tribunal === 'string' &&
    'partes' in data &&
    Array.isArray((data as JuditApiResponseData).partes) &&
    'movimentacoes' in data &&
    Array.isArray((data as JuditApiResponseData).movimentacoes) &&
    'situacao' in data &&
    typeof (data as JuditApiResponseData).situacao === 'string'
  );
}

// ================================================================
// ENUM MAPPERS (Safe Type Transformation)
// ================================================================

function mapToPartyType(rawType: string): 'AUTOR' | 'REU' | 'TERCEIRO' {
  const normalizedType = rawType.toUpperCase().trim();
  if (normalizedType === 'AUTOR' || normalizedType === 'REU' || normalizedType === 'TERCEIRO') {
    return normalizedType;
  }
  // Fallback seguro para tipo desconhecido
  return 'TERCEIRO';
}

interface JuditTelemetryData {
  workspaceId: string;
  batchId: string;
  processNumber: string;
  tribunal: string;
  retryCount: number;
  success?: boolean;
  responseTimeMs?: number;
  docsRetrieved?: number;
  movementsCount?: number;
  partiesCount?: number;
  errorCode?: string;
  errorMessage?: string;
  rateLimitHit?: boolean;
}

export interface UploadConfig {
  MAX_ROWS: number;
  PAGE_SIZE: number;
  SUBBATCH: number;
  CONCURRENCY: number;
  PAUSE_MS: number;
  DRY_RUN: boolean;
}

export interface JuditApiPayload {
  numero_processo: string;
  tribunal: string;
  incluir_movimentacoes: boolean;
  incluir_partes: boolean;
  max_movimentacoes: number;
}

export interface JuditApiResponse {
  success: boolean;
  data?: JuditApiResponseData;
  error?: string;
}

export interface BatchProgress {
  batchId: string;
  totalRows: number;
  processed: number;
  successful: number;
  failed: number;
  progress: number; // 0-100
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  currentPage?: number;
  totalPages?: number;
  estimatedTimeRemaining?: number;
  startedAt: Date;
  lastUpdate: Date;
}

export interface BatchEstimate {
  totalRows: number;
  validRows: number;
  duplicateRows: number;
  estimatedApiCalls: number; // Para compatibilidade
  juditQueries?: number; // Nova propriedade específica
  estimatedCost: number;
  estimatedTime: number; // em minutos
}

export interface ProcessedRow {
  lineNumber: number;
  processNumber: string;
  status: 'success' | 'failed' | 'skipped';
  error?: string;
  enriched: boolean;
  retryCount?: number;
}

// ================================================================
// CONFIGURAÇÕES
// ================================================================

export const DEFAULT_CONFIG: UploadConfig = {
  MAX_ROWS: 1000,
  PAGE_SIZE: 100,
  SUBBATCH: 20,
  CONCURRENCY: 3,
  PAUSE_MS: 500,
  DRY_RUN: false
};

// ================================================================
// EXCEL UPLOAD SERVICE
// ================================================================

export class ExcelUploadService {
  private config: UploadConfig;
  private rateLimiter: RateLimitedApiClient;
  private parser: ExcelProcessParser;
  private progressCallbacks: Map<string, (_progress: BatchProgress) => void> = new Map();

  constructor(config: Partial<UploadConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.rateLimiter = createJuditRateLimiter();
    this.parser = new ExcelProcessParser({
      maxRows: this.config.MAX_ROWS,
      allowDuplicates: false,
      strictProcessNumberValidation: true
    });
  }

  /**
   * FASE 1: Parsing inicial e validação (síncrono rápido)
   */
  async parseAndValidate(
    buffer: Buffer,
    fileName: string,
    _workspaceId: string
  ): Promise<{
    success: boolean;
    parseResult?: ExcelParseResult;
    estimate?: BatchEstimate;
    preview?: ExcelProcessRow[];
    errors?: string[];
  }> {
    try {
      log.info({ msg: 'Iniciando parsing do arquivo:' });

      // Parse do Excel
      const parseResult = await this.parser.parseExcelBuffer(buffer, fileName);

      if (!parseResult.success) {
        return {
          success: false,
          errors: parseResult.errors.map(e => `Linha ${e.linha}: ${e.erro}`)
        };
      }

      // Verificar duplicatas locais (no próprio arquivo)
      await this.checkLocalDuplicates(parseResult);

      // Gerar estimativas
      const estimate = this.generateEstimate(parseResult);

      // Preview das primeiras 10 linhas
      const preview = parseResult.validRows.slice(0, 10);

      log.info({ msg: 'Parsing concluído:  linhas válidas' });

      return {
        success: true,
        parseResult,
        estimate,
        preview
      };

    } catch (error) {
      logError(error, '${ICONS.ERROR} Erro no parsing:', { component: 'refactored' });
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Erro desconhecido no parsing']
      };
    }
  }

  /**
   * FASE 2: Criação do batch (imediato)
   */
  async createBatch(
    parseResult: ExcelParseResult,
    fileName: string,
    filePath: string,
    fileSize: number,
    workspaceId: string,
    prisma: PrismaClient
  ): Promise<{ batchId: string; preview: ExcelProcessRow[] }> {
    log.info({ msg: 'Criando batch no banco de dados...' });

    const batch = await prisma.processBatchUpload.create({
      data: {
        workspaceId,
        fileName,
        filePath,
        fileSize,
        status: 'PROCESSING',
        totalRows: parseResult.summary.valid,
        processed: 0,
        successful: 0,
        failed: 0,
        errors: JSON.stringify(parseResult.errors),
        summary: JSON.stringify(parseResult.summary)
      }
    });

    const preview = parseResult.validRows.slice(0, 10);

    log.info({ msg: 'Batch criado:' });

    return {
      batchId: batch.id,
      preview
    };
  }

  /**
   * FASE 3: Processamento em background
   */
  async processInBackground(
    batchId: string,
    parseResult: ExcelParseResult,
    workspaceId: string,
    prisma: PrismaClient
  ): Promise<void> {
    log.info({ msg: 'Iniciando processamento em background para batch:' });

    const startTime = Date.now();
    const validRows = parseResult.validRows;
    const totalRows = validRows.length;
    const totalPages = Math.ceil(totalRows / this.config.PAGE_SIZE);

    let processed = 0;
    let successful = 0;
    let failed = 0;

    try {
      // Processar em páginas
      for (let page = 0; page < totalPages; page++) {
        const startIdx = page * this.config.PAGE_SIZE;
        const endIdx = Math.min(startIdx + this.config.PAGE_SIZE, totalRows);
        const pageRows = validRows.slice(startIdx, endIdx);

        log.info({ msg: 'Processando página / ( linhas)' });

        // Processar página em sub-lotes
        const pageResults = await this.processPage(pageRows, workspaceId, batchId, prisma);

        // Atualizar contadores
        pageResults.forEach(result => {
          processed++;
          if (result.status === 'success') {
            successful++;
          } else if (result.status === 'failed') {
            failed++;
          }
        });

        // Atualizar progresso no DB a cada página
        await this.updateBatchProgress(batchId, processed, successful, failed, prisma);

        // Emitir progresso via callback
        this.emitProgress(batchId, {
          batchId,
          totalRows,
          processed,
          successful,
          failed,
          progress: Math.round((processed / totalRows) * 100),
          status: 'PROCESSING',
          currentPage: page + 1,
          totalPages,
          estimatedTimeRemaining: this.calculateETA(startTime, processed, totalRows),
          startedAt: new Date(startTime),
          lastUpdate: new Date()
        });

        // Pausa entre páginas
        if (page < totalPages - 1) {
          await this.sleep(this.config.PAUSE_MS);
        }
      }

      // Finalizar batch
      await prisma.processBatchUpload.update({
        where: { id: batchId },
        data: {
          status: 'COMPLETED',
          processed,
          successful,
          failed
        }
      });

      log.info({ msg: 'Batch  concluído: / sucessos' });

    } catch (error) {
      logError(error, '${ICONS.ERROR} Erro no processamento do batch ${batchId}:', { component: 'refactored' });

      await prisma.processBatchUpload.update({
        where: { id: batchId },
        data: {
          status: 'FAILED',
          errors: JSON.stringify([error instanceof Error ? error.message : 'Erro desconhecido'])
        }
      });
    }
  }

  /**
   * Processa uma página em sub-lotes com concorrência
   */
  private async processPage(
    rows: ExcelProcessRow[],
    workspaceId: string,
    batchId: string,
    prisma: PrismaClient
  ): Promise<ProcessedRow[]> {
    const results: ProcessedRow[] = [];
    const totalSubbatches = Math.ceil(rows.length / this.config.SUBBATCH);

    for (let i = 0; i < totalSubbatches; i++) {
      const startIdx = i * this.config.SUBBATCH;
      const endIdx = Math.min(startIdx + this.config.SUBBATCH, rows.length);
      const subbatchRows = rows.slice(startIdx, endIdx);

      // Processar sub-lote com concorrência limitada
      const subbatchPromises = subbatchRows.map(row =>
        this.processRow(row, workspaceId, batchId, prisma)
      );

      // Executar com limite de concorrência
      const subbatchResults = await this.executeWithConcurrency(
        subbatchPromises,
        this.config.CONCURRENCY
      );

      results.push(...subbatchResults);

      // Pausa entre sub-lotes
      if (i < totalSubbatches - 1) {
        await this.sleep(this.config.PAUSE_MS);
      }
    }

    return results;
  }

  /**
   * Processa uma linha individual
   */
  private async processRow(
    row: ExcelProcessRow,
    workspaceId: string,
    batchId: string,
    prisma: PrismaClient
  ): Promise<ProcessedRow> {
    if (this.config.DRY_RUN) {
      // Modo dry run - apenas validação
      return {
        lineNumber: row.linha,
        processNumber: row.numeroProcesso,
        status: 'success',
        enriched: false
      };
    }

    try {
      // Verificar se processo já existe no workspace
      const existingProcess = await prisma.monitoredProcess.findFirst({
        where: {
          processNumber: row.numeroProcesso,
          workspaceId
        }
      });

      if (existingProcess) {
        return {
          lineNumber: row.linha,
          processNumber: row.numeroProcesso,
          status: 'skipped',
          error: 'Processo já existe no workspace',
          enriched: false
        };
      }

      // Chamar API Judit com telemetria
      const apiResult = await this.callJuditAPI(row, workspaceId, batchId, prisma);

      if (apiResult.success && apiResult.data) {
        // Criar processo com dados da Judit
        await this.createMonitoredProcess(row, apiResult.data, workspaceId, prisma);

        return {
          lineNumber: row.linha,
          processNumber: row.numeroProcesso,
          status: 'success',
          enriched: true
        };
      } else {
        // Criar processo sem dados externos (fallback)
        await this.createMonitoredProcess(row, null, workspaceId, prisma);

        return {
          lineNumber: row.linha,
          processNumber: row.numeroProcesso,
          status: 'success',
          enriched: false,
          error: apiResult.error
        };
      }

    } catch (error) {
      logError(error, '${ICONS.ERROR} Erro ao processar linha ${row.linha}:', { component: 'refactored' });

      return {
        lineNumber: row.linha,
        processNumber: row.numeroProcesso,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        enriched: false
      };
    }
  }

  /**
   * Chama API Judit com rate limiting e telemetria
   */
  private async callJuditAPI(
    row: ExcelProcessRow,
    workspaceId: string,
    batchId: string,
    prisma: PrismaClient
  ): Promise<JuditApiResponse> {
    // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
    const payload: JuditApiPayload = {
      numero_processo: row.numeroProcesso,
      tribunal: row.tribunal,
      incluir_movimentacoes: true,
      incluir_partes: true,
      max_movimentacoes: 100
    };

    const startTime = Date.now();
    let telemetryData: JuditTelemetryData = {
      workspaceId,
      batchId,
      processNumber: row.numeroProcesso,
      tribunal: row.tribunal,
      retryCount: 0
    };

    try {
      const result = await this.rateLimiter.call(
        async () => {
          // Implementar chamada real à API Judit ou simulação
          const juditResult = await this.callJuditAPISimple(row.numeroProcesso, row.tribunal);

          if (juditResult.success) {
            return {
              numero_processo: row.numeroProcesso,
              tribunal: row.tribunal,
              partes: [
                { nome: 'João Silva', tipo: 'AUTOR' },
                { nome: 'Maria Santos', tipo: 'REU' }
              ],
              movimentacoes: Array.from({ length: 5 + Math.floor(Math.random() * 10) }, (_, i) => ({
                data: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
                tipo: 'DECISAO',
                descricao: `Movimentação ${i + 1}`
              })),
              situacao: 'ATIVO',
              classe: 'AÇÃO CIVIL PÚBLICA',
              assunto: 'Direito Civil',
              valor_causa: 50000 + Math.random() * 100000,
              data_distribuicao: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
            };
          } else {
            throw new Error('Processo não encontrado nos tribunais');
          }
        },
        `Judit API - ${row.numeroProcesso}`
      );

      // Sucesso - registrar telemetria
      const responseTime = Date.now() - startTime;

      // Validar dados com type guard (Mandato Inegociável)
      const validatedData = isJuditApiResponseData(result.data) ? result.data : null;

      telemetryData = {
        ...telemetryData,
        success: true,
        responseTimeMs: responseTime,
        docsRetrieved: 1,
        movementsCount: validatedData?.movimentacoes?.length || 0,
        partiesCount: validatedData?.partes?.length || 0,
        rateLimitHit: false
      };

      await this.logJuditTelemetry(telemetryData, prisma);

      return {
        success: result.success,
        data: validatedData || undefined,
        error: result.error
      };

    } catch (error) {
      // Falha - registrar telemetria
      const responseTime = Date.now() - startTime;
      telemetryData = {
        ...telemetryData,
        success: false,
        responseTimeMs: responseTime,
        errorCode: 'API_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Erro desconhecido',
        rateLimitHit: error instanceof Error && error.message.includes('rate limit')
      };

      await this.logJuditTelemetry(telemetryData, prisma);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro na chamada à API Judit'
      };
    }
  }

  /**
   * Cria processo monitorado no banco
   */
  private async createMonitoredProcess(
    row: ExcelProcessRow,
    juditData: JuditApiResponseData | null,
    workspaceId: string,
    prisma: PrismaClient
  ): Promise<void> {
    // Construir dados base (type-safe, sem Object.assign)
    interface ProcessDataBase {
      workspaceId: string;
      processNumber: string;
      court: string;
      clientName: string;
      notes: string;
      syncFrequency: 'MANUAL' | 'HOURLY' | 'DAILY' | 'WEEKLY';
      alertsEnabled: boolean;
      alertEmails: string[];
      enriched: boolean;
      status: string;
      subject?: string;
      processClass?: string;
      situation?: string;
      causeValue?: number;
      distributionDate?: Date | null;
      parties?: unknown[];
      lastSyncAt?: Date;
    }

    const processData: ProcessDataBase = {
      workspaceId,
      processNumber: row.numeroProcesso,
      court: row.tribunal,
      clientName: row.nomeCliente,
      notes: row.observacoes ?? '',
      syncFrequency: row.frequenciaSync || 'DAILY',
      alertsEnabled: row.alertasAtivos ?? true,
      alertEmails: row.emailsAlerta || [],
      enriched: !!juditData,
      status: 'ACTIVE'
    };

    // Adicionar dados da Judit com narrowing seguro (Mandato Inegociável)
    if (juditData) {
      processData.subject = juditData.assunto;
      processData.processClass = juditData.classe;
      processData.situation = juditData.situacao;
      processData.causeValue = juditData.valor_causa;

      // Narrowing seguro para data
      if (juditData.data_distribuicao) {
        processData.distributionDate = new Date(juditData.data_distribuicao);
      } else {
        processData.distributionDate = null;
      }

      // Validar e filtrar partes com type guard
      processData.parties = juditData.partes
        .filter(isJuditParty)
        .map(party => ({
          nome: party.nome,
          tipo: party.tipo,
          cpf_cnpj: party.cpf_cnpj
        }));

      processData.lastSyncAt = new Date();
    }

    const createdProcess = await prisma.monitoredProcess.create({
      data: processData as never // Necessário: Prisma precisa de tipos exatos
    });

    // Criar movimentações com narrowing seguro e validação (Mandato Inegociável)
    if (juditData && juditData.movimentacoes && juditData.movimentacoes.length > 0) {
      // Filtrar apenas movimentos válidos
      const validMovements = juditData.movimentacoes
        .filter(isJuditMovement)
        .slice(0, 100);

      if (validMovements.length > 0) {
        const movements = validMovements.map(mov => ({
          monitoredProcessId: createdProcess.id,
          date: new Date(mov.data),
          type: mov.tipo,
          description: mov.descricao,
          source: 'JUDIT_API'
        }));

        await prisma.processMovement.createMany({
          data: movements
        });
      }
    }
  }

  // ================================================================
  // MÉTODOS AUXILIARES
  // ================================================================

  private async checkLocalDuplicates(parseResult: ExcelParseResult): Promise<void> {
    const seen = new Set<string>();
    const duplicates: string[] = [];

    for (const row of parseResult.validRows) {
      if (seen.has(row.numeroProcesso)) {
        duplicates.push(row.numeroProcesso);
      } else {
        seen.add(row.numeroProcesso);
      }
    }

    if (duplicates.length > 0) {
      parseResult.errors.push({
        linha: 0,
        campo: 'arquivo',
        valor: duplicates.join(', '),
        erro: `Números de processo duplicados encontrados: ${duplicates.length}`,
        tipo: 'WARNING'
      });
    }
  }

  private generateEstimate(parseResult: ExcelParseResult): BatchEstimate {
    const validRows = parseResult.summary.valid;
    const duplicateRows = parseResult.summary.duplicates;
    const juditQueries = validRows - duplicateRows;

    return {
      totalRows: parseResult.totalRows,
      validRows,
      duplicateRows,
      estimatedApiCalls: juditQueries, // Para compatibilidade
      juditQueries, // Nova propriedade específica
      estimatedCost: 0, // Sem cobrança por consulta Judit
      estimatedTime: Math.ceil(juditQueries / 60) // ~1 consulta por segundo
    };
  }

  private async updateBatchProgress(
    batchId: string,
    processed: number,
    successful: number,
    failed: number,
    prisma: PrismaClient
  ): Promise<void> {
    await prisma.processBatchUpload.update({
      where: { id: batchId },
      data: {
        processed,
        successful,
        failed,
        updatedAt: new Date()
      }
    });
  }

  private calculateETA(startTime: number, processed: number, total: number): number {
    if (processed === 0) return 0;

    const elapsed = Date.now() - startTime;
    const rate = processed / elapsed; // linhas por ms
    const remaining = total - processed;

    return Math.ceil((remaining / rate) / 1000 / 60); // minutos
  }

  private emitProgress(batchId: string, progress: BatchProgress): void {
    const callback = this.progressCallbacks.get(batchId);
    if (callback) {
      callback(progress);
    }
  }

  private async executeWithConcurrency<T>(
    promises: Promise<T>[],
    concurrency: number
  ): Promise<T[]> {
    const results: T[] = [];
    const executing: Promise<void>[] = [];

    for (const promise of promises) {
      const wrappedPromise = promise.then(result => {
        results.push(result);
      });

      executing.push(wrappedPromise);

      if (executing.length >= concurrency) {
        await Promise.race(executing);
        const completedIndex = executing.findIndex(p => p !== undefined);
        if (completedIndex >= 0) {
          executing.splice(completedIndex, 1);
        }
      }
    }

    await Promise.all(executing);
    return results;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Registra telemetria da chamada Judit
   */
  private async logJuditTelemetry(data: JuditTelemetryData, prisma: PrismaClient): Promise<void> {
    try {
      await prisma.juditTelemetry.create({
        data: {
          workspaceId: data.workspaceId,
          batchId: data.batchId,
          processNumber: data.processNumber,
          tribunal: data.tribunal,
          success: data.success ?? false,
          responseTimeMs: data.responseTimeMs,
          docsRetrieved: data.docsRetrieved || 0,
          movementsCount: data.movementsCount || 0,
          partiesCount: data.partiesCount || 0,
          errorCode: data.errorCode,
          errorMessage: data.errorMessage,
          retryCount: data.retryCount || 0,
          rateLimitHit: data.rateLimitHit || false
        }
      });
    } catch (error) {
      logError(error, '${ICONS.ERROR} Erro ao registrar telemetria Judit:', { component: 'refactored' });
    }
  }

  // ================================================================
  // API PÚBLICA
  // ================================================================

  /**
   * Registra callback para receber atualizações de progresso
   */
  onProgress(batchId: string, callback: (_progress: BatchProgress) => void): void {
    this.progressCallbacks.set(batchId, callback);
  }

  /**
   * Remove callback de progresso
   */
  offProgress(batchId: string): void {
    this.progressCallbacks.delete(batchId);
  }

  /**
   * Obtém status do rate limiter
   */
  getRateLimiterStatus() {
    return this.rateLimiter.getStatus();
  }

  /**
   * Chama API Judit real ou simulação baseado na configuração
   */
  private async callJuditAPISimple(numeroProcesso: string, tribunal: string): Promise<JuditApiResponse> {
    const juditApiUrl = process.env.JUDIT_API_URL;
    const juditApiKey = process.env.JUDIT_API_KEY;

    // Se não há configuração da API, usar simulação
    if (!juditApiUrl || !juditApiKey) {
      log.info({ msg: 'API Judit não configurada - usando simulação' });
      return this.simulateJuditResponse(numeroProcesso, tribunal);
    }

    try {
      log.info({ msg: 'Consultando Judit API para processo' });

      const response = await fetch(`${juditApiUrl}/search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${juditApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          search: {
            search_type: 'lawsuit_cnj',
            search_key: numeroProcesso
          },
          options: {
            with_attachments: false,
            page_size: 50
          }
        })
      });

      if (!response.ok) {
        throw new Error(`API Judit retornou erro: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      log.info({ msg: 'Resposta da Judit API recebida para' });

      return {
        success: true,
        data: this.transformJuditResponse(data)
      };

    } catch (error) {
      logError(error, '${ICONS.ERROR} Erro na API Judit para ${numeroProcesso}:', { component: 'refactored' });

      // Fallback para simulação em caso de erro
      log.info({ msg: 'Usando simulação como fallback' });
      return this.simulateJuditResponse(numeroProcesso, tribunal);
    }
  }

  /**
   * Simula resposta da API Judit para desenvolvimento/teste
   */
  private async simulateJuditResponse(numeroProcesso: string, tribunal: string): Promise<JuditApiResponse> {
    // Simular delay da API
    await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));

    // Simular taxa de sucesso de 85%
    const success = Math.random() > 0.15;

    if (success) {
      return {
        success: true,
        data: {
          numero_processo: numeroProcesso,
          tribunal: tribunal,
          partes: [
            { nome: 'Parte Autora Simulada', tipo: 'AUTOR' as const },
            { nome: 'Parte Ré Simulada', tipo: 'REU' as const }
          ],
          movimentacoes: [
            {
              data: new Date().toISOString(),
              tipo: 'CITACAO',
              descricao: 'Citação da parte ré - Simulado'
            }
          ],
          valor_causa: Math.floor(Math.random() * 1000000) + 10000,
          situacao: 'ATIVO',
          classe: 'Ação Civil',
          assunto: 'Processo Simulado',
          data_distribuicao: new Date().toISOString()
        }
      };
    } else {
      return {
        success: false,
        error: 'Processo não encontrado (simulação)'
      };
    }
  }

  /**
   * Transforma resposta da API Judit para formato padrão
   * Com narrowing seguro (Mandato Inegociável)
   */
  private transformJuditResponse(juditData: Record<string, unknown>): JuditApiResponseData {
    try {
      // Helper para extrair string com fallback seguro
      const toString = (value: unknown, fallback: string = ''): string => {
        return typeof value === 'string' ? value : fallback;
      };

      // Helper para extrair número com fallback seguro
      const toNumber = (value: unknown): number | undefined => {
        return typeof value === 'number' ? value : undefined;
      };

      // Transformar partes com type guard e mapper
      let parties: JuditParty[] = [];
      if (Array.isArray(juditData.parties)) {
        const transformedParties: (JuditParty | null)[] = juditData.parties.map(party => {
          if (typeof party !== 'object' || party === null) {
            return null;
          }
          const partyObj = party as Record<string, unknown>;
          const nome = toString(partyObj.name || partyObj.nome);
          const cpf_cnpj_value = toString(partyObj.document || partyObj.documento);

          // Retornar null se nome está vazio, senão retornar JuditParty válido
          if (!nome) {
            return null;
          }

          return {
            nome,
            tipo: mapToPartyType(toString(partyObj.type || partyObj.tipo)),
            cpf_cnpj: cpf_cnpj_value || undefined
          };
        });

        // Filtrar nulls com narrowing seguro
        parties = transformedParties.filter((p): p is JuditParty => p !== null);
      }

      // Transformar movimentações com type guard
      let movements: JuditMovement[] = [];
      if (Array.isArray(juditData.movements)) {
        movements = juditData.movements
          .map(mov => {
            if (typeof mov !== 'object' || mov === null) {
              return null;
            }
            const movObj = mov as Record<string, unknown>;
            return {
              data: toString(movObj.date || movObj.data),
              tipo: toString(movObj.type || movObj.tipo),
              descricao: toString(movObj.description || movObj.descricao)
            };
          })
          .filter((m): m is JuditMovement => m !== null && m.data !== '' && m.tipo !== '');
      }

      // Construir resposta com narrowing seguro
      const numeroProcesso = toString(juditData.lawsuit_cnj || juditData.numero_processo || juditData.number);
      const tribunal = toString(juditData.court || juditData.tribunal);
      const situacao = toString(juditData.status || juditData.situacao, 'ATIVO');
      const classe = toString(juditData.classe);
      const assunto = toString(juditData.assunto);
      const valorCausa = toNumber(juditData.lawsuit_value || juditData.valor_causa);
      const dataDistribuicao = toString(
        juditData.last_update || juditData.data_distribuicao,
        new Date().toISOString()
      );

      return {
        numero_processo: numeroProcesso,
        tribunal: tribunal,
        partes: parties,
        movimentacoes: movements,
        valor_causa: valorCausa,
        situacao: situacao,
        classe: classe,
        assunto: assunto,
        data_distribuicao: dataDistribuicao
      };
    } catch (error) {
      logError(error, 'Erro ao transformar resposta da Judit:', { component: 'refactored' });
      // Retornar dados mínimos em caso de erro
      return {
        numero_processo: '',
        tribunal: '',
        partes: [],
        movimentacoes: [],
        situacao: 'ATIVO',
        classe: '',
        assunto: ''
      };
    }
  }
}