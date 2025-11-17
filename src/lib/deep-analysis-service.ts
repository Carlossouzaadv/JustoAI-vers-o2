// ================================================================
// DEEP ANALYSIS SERVICE
// ================================================================
// Serviço para análise FAST/FULL com cache, versioning e Redis locks
//
// EMERGENCY MODE: Se REDIS_DISABLED=true, usa mock client sem tentar conectar

import { PrismaClient } from '@prisma/client'
import { JobStatus, type AnalysisType, type CaseAnalysisVersion, type AnalysisJob, type MonitoredProcess, type InputJsonValue, type CaseAnalysisVersionWhereInput } from '@/lib/types/database';
import { createHash } from 'crypto';
import { Redis } from 'ioredis';
import { ICONS } from './icons';
import { getGeminiClient } from './gemini-client';
import { ModelTier } from './ai-model-router';
import { getRedisClient } from './redis';
import type {
  AnalysisMetadata,
} from './types/json-fields';
import {
  isAnalysisMetadata,
  createAIAnalysisData,
} from './types/type-guards';
import { log, logError } from '@/lib/services/logger';


const prisma = new PrismaClient();

// Redis connection - lazy initialization (only connect when actually used)
// Type: unknown because getRedisClient() returns Redis | MockRedis
// We use type guards before accessing methods
let redis: unknown = null;

/**
 * Type guard to verify redis is initialized and has required methods
 */
function isRedisClient(client: unknown): client is Redis {
  if (!client || typeof client !== 'object') {
    return false;
  }

  const obj = client as Record<string, unknown>;
  return (
    typeof obj.set === 'function' &&
    typeof obj.get === 'function' &&
    typeof obj.ttl === 'function' &&
    typeof obj.eval === 'function'
  );
}

export interface AnalysisKeyParams {
  processId: string;
  documentHashes: string[];
  analysisType: AnalysisType;
  modelVersion: string;
  promptSignature?: string;
}

export interface ProcessDocument {
  id: string;
  name: string;
  textSha: string;
  size: number;
  pages?: number;
  cleanText?: string;
}

export interface AnalysisDocument {
  id: string;
  name: string;
  text: string;
}

/**
 * Interface for Prisma query result with document selection
 */
interface PrismaCaseDocumentSelect {
  id: string;
  name: string;
  textSha: string | null;
  size: number | null;
  cleanText: string | null;
}

/**
 * Interface for Prisma query result with extracted text selection
 */
interface PrismaCaseDocumentWithText {
  id: string;
  name: string;
  extractedText: string | null;
}

export interface AnalysisVersionParams {
  processId: string;
  workspaceId: string;
  version: number;
  analysisType: AnalysisType;
  modelUsed: string;
  fullCreditsUsed?: number;
  fastCreditsUsed?: number;
  analysisKey?: string;
  sourceFilesMetadata: InputJsonValue[];
  createdBy?: string;
}

export interface AnalysisJobParams {
  processId: string;
  workspaceId: string;
  analysisKey: string;
  analysisType: AnalysisType;
  modelHint: string;
  filesMetadata: ProcessDocument[];
  resultVersionId: string;
  lockToken: string;
  metadata?: AnalysisMetadata;
}

export interface LockResult {
  acquired: boolean;
  token?: string;
  ttl?: number;
}

export class DeepAnalysisService {
  private readonly CACHE_TTL = 7 * 24 * 60 * 60; // 7 dias
  private readonly LOCK_TTL = 600; // 10 minutos default
  private readonly FULL_CREDIT_PER_BATCH = parseInt(process.env.FULL_CREDIT_PER_REANALYSIS_BATCH || '10');

  constructor() {
    // Lazy initialization of Redis connection on first use
    // getRedisClient() returns Redis | MockRedis (never null)
    if (!redis) {
      redis = getRedisClient();
    }
  }

  /**
   * Valida se o processo existe e pertence ao workspace
   */
  async validateProcessAccess(processId: string, workspaceId: string): Promise<boolean> {
    try {
      const process = await prisma.monitoredProcess.findFirst({
        where: {
          id: processId,
          workspaceId
        }
      });

      return !!process;
    } catch (error) {
      logError(`${ICONS.ERROR} Erro ao validar acesso ao processo:`, "error", { component: "deepAnalysisService" });
      return false;
    }
  }

  /**
   * Busca documentos anexados ao processo
   */
  async getProcessDocuments(processId: string): Promise<ProcessDocument[]> {
    try {
      const documents = await prisma.caseDocument.findMany({
        where: {
          caseId: processId
        },
        select: {
          id: true,
          name: true,
          textSha: true,
          size: true,
          cleanText: true
        }
      });

      return documents.map((doc: PrismaCaseDocumentSelect) => ({
        id: doc.id,
        name: doc.name,
        textSha: doc.textSha || '',
        size: doc.size || 0,
        cleanText: doc.cleanText || undefined
      }));
    } catch (error) {
      logError(`${ICONS.ERROR} Erro ao buscar documentos do processo:`, "error", { component: "deepAnalysisService" });
      return [];
    }
  }

  /**
   * Busca documentos específicos por IDs
   */
  async getProcessDocumentsByIds(processId: string, fileIds: string[]): Promise<ProcessDocument[]> {
    try {
      const documents = await prisma.caseDocument.findMany({
        where: {
          id: { in: fileIds },
          caseId: processId
        },
        select: {
          id: true,
          name: true,
          textSha: true,
          size: true,
          cleanText: true
        }
      });

      return documents.map((doc: PrismaCaseDocumentSelect) => ({
        id: doc.id,
        name: doc.name,
        textSha: doc.textSha || '',
        size: doc.size || 0,
        cleanText: doc.cleanText || undefined
      }));
    } catch (error) {
      logError(`${ICONS.ERROR} Erro ao buscar documentos específicos:`, "error", { component: "deepAnalysisService" });
      return [];
    }
  }

  /**
   * Processa arquivos enviados via upload
   */
  async processUploadedFiles(
    files: File[],
    processId: string,
    _workspaceId: string,
    _userId: string
  ): Promise<ProcessDocument[]> {
    const processedFiles: ProcessDocument[] = [];

    try {
      for (const file of files) {
        log.info({ msg: "${ICONS.PROCESS} Processando arquivo: ${file.name}", component: "deepAnalysisService" });

        // Converter File para Buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Calcular hash do arquivo
        const fileHash = createHash('sha256').update(buffer).digest('hex');

        // Verificar se arquivo já existe (deduplicação)
        const existingDoc = await prisma.caseDocument.findFirst({
          where: {
            textSha: fileHash,
            caseId: processId
          }
        });

        if (existingDoc) {
          log.info({ msg: "${ICONS.INFO} Arquivo ${file.name} já existe, reutilizando", component: "deepAnalysisService" });
          processedFiles.push({
            id: existingDoc.id,
            name: existingDoc.name,
            textSha: existingDoc.textSha || '',
            size: existingDoc.size || 0
          });
          continue;
        }

        // Extrair texto do PDF (simulação - implementar extração real)
        const extractedText = await this.extractTextFromPDF(buffer, file.name);
        const cleanText = this.cleanExtractedText(extractedText);

        // Salvar documento no banco
        const savedDoc = await prisma.caseDocument.create({
          data: {
            caseId: processId,
            name: file.name,
            originalName: file.name,
            type: 'OTHER',
            mimeType: file.type || 'application/octet-stream',
            size: file.size,
            url: `/uploads/${processId}/${fileHash}`,
            path: `/uploads/${processId}/${fileHash}`,
            textSha: fileHash,
            cleanText,
            extractedText: extractedText,
            textExtractedAt: new Date()
          }
        });

        processedFiles.push({
          id: savedDoc.id,
          name: savedDoc.name,
          textSha: savedDoc.textSha || '',
          size: savedDoc.size || 0,
          cleanText: savedDoc.cleanText || undefined
        });

        log.info({ msg: "${ICONS.SUCCESS} Arquivo processado: ${file.name}", component: "deepAnalysisService" });
      }

      return processedFiles;
    } catch (error) {
      logError(`${ICONS.ERROR} Erro ao processar arquivos:`, "error", { component: "deepAnalysisService" });
      throw new Error('Falha no processamento dos arquivos enviados');
    }
  }

  /**
   * Extrai texto de PDF (simulação)
   */
  private async extractTextFromPDF(buffer: Buffer, fileName: string): Promise<string> {
    // TODO: Implementar extração real com pdf-parse ou similar
    // Por enquanto, texto simulado
    return `Texto extraído do arquivo ${fileName}\n\nConteúdo simulado do PDF com informações processuais relevantes para análise de IA.\n\nEste é um placeholder que será substituído pela extração real de texto.`;
  }

  /**
   * Limpa texto extraído
   */
  private cleanExtractedText(rawText: string): string {
    return rawText
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s\-.,;:()]/g, '')
      .trim();
  }

  /**
   * Calcula créditos FULL necessários
   */
  async calculateFullCreditsNeeded(files: ProcessDocument[]): Promise<number> {
    // Por enquanto, usa a regra simples: ceil(files.length / FULL_CREDIT_PER_BATCH)
    return Math.ceil(files.length / this.FULL_CREDIT_PER_BATCH);
  }

  /**
   * Gera chave única para análise (analysis_key)
   */
  async generateAnalysisKey(params: AnalysisKeyParams): Promise<string> {
    // Buscar última movimentação do processo
    const lastMovement = await this.getLastProcessMovement(params.processId);
    const lastMovementDate = lastMovement?.toISOString() || 'no-movements';

    // Ordenar hashes para garantir consistência
    const sortedHashes = [...params.documentHashes].sort();

    // Prompt signature (simplificado)
    const promptSignature = params.promptSignature || this.generatePromptSignature(params.analysisType);

    // Concatenar todos os componentes
    const keyData = [
      sortedHashes.join('|'),
      params.modelVersion,
      promptSignature,
      lastMovementDate
    ].join('||');

    // Gerar SHA256
    const analysisKey = createHash('sha256').update(keyData).digest('hex');

    log.info({ msg: "${ICONS.INFO} Analysis key gerada: ${analysisKey.substring(0, 16)}...", component: "deepAnalysisService" });
    return analysisKey;
  }

  /**
   * Busca última movimentação do processo
   */
  private async getLastProcessMovement(processId: string): Promise<Date | null> {
    try {
      const lastMovement = await prisma.processMovement.findFirst({
        where: { monitoredProcessId: processId },
        orderBy: { date: 'desc' },
        select: { date: true }
      });

      return lastMovement?.date || null;
    } catch (error) {
      logError(`${ICONS.ERROR} Erro ao buscar última movimentação:`, "error", { component: "deepAnalysisService" });
      return null;
    }
  }

  /**
   * Gera assinatura do prompt
   */
  private generatePromptSignature(analysisType: string): string {
    const promptConfig = {
      type: analysisType,
      version: '1.0',
      includeTimeline: true,
      includeParties: true
    };

    return createHash('sha256')
      .update(JSON.stringify(promptConfig))
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Verifica cache de análise
   */
  async getCachedAnalysis(analysisKey: string, processId: string): Promise<CaseAnalysisVersion | null> {
    try {
      // Buscar no cache
      const cached = await prisma.analysisCache.findUnique({
        where: { analysisKey }
      });

      if (!cached) {
        return null;
      }

      // Verificar se cache ainda é válido (não expirado)
      if (cached.expiresAt && cached.expiresAt < new Date()) {
        log.info({ msg: "${ICONS.WARNING} Cache expirado para key: ${analysisKey}", component: "deepAnalysisService" });
        await this.invalidateCache(analysisKey);
        return null;
      }

      // Verificar se não houve movimentações após o cache
      const lastMovement = await this.getLastProcessMovement(processId);
      if (lastMovement && cached.lastMovementDate && lastMovement > cached.lastMovementDate) {
        log.info({ msg: "${ICONS.WARNING} Cache invalidado por nova movimentação", component: "deepAnalysisService" });
        await this.invalidateCache(analysisKey);
        return null;
      }

      // Cache válido - buscar versão de análise correspondente
      const analysisVersion = await prisma.caseAnalysisVersion.findFirst({
        where: { analysisKey },
        orderBy: { createdAt: 'desc' }
      });

      return analysisVersion;
    } catch (error) {
      logError(`${ICONS.ERROR} Erro ao verificar cache:`, "error", { component: "deepAnalysisService" });
      return null;
    }
  }

  /**
   * Incrementa contador de acesso ao cache
   */
  async incrementCacheAccess(analysisKey: string): Promise<void> {
    try {
      await prisma.analysisCache.update({
        where: { analysisKey },
        data: {
          accessCount: { increment: 1 },
          lastAccessedAt: new Date()
        }
      });
    } catch (error) {
      logError(`${ICONS.ERROR} Erro ao incrementar acesso ao cache:`, "error", { component: "deepAnalysisService" });
    }
  }

  /**
   * Invalida entrada do cache
   */
  async invalidateCache(analysisKey: string): Promise<void> {
    try {
      await prisma.analysisCache.delete({
        where: { analysisKey }
      });
    } catch (error) {
      logError(`${ICONS.ERROR} Erro ao invalidar cache:`, "error", { component: "deepAnalysisService" });
    }
  }

  /**
   * Busca job ativo para analysis_key
   */
  async getActiveJob(analysisKey: string) {
    try {
      const job = await prisma.analysisJob.findFirst({
        where: {
          analysisKey,
          status: { in: [JobStatus.QUEUED, JobStatus.RUNNING] }
        },
        orderBy: { createdAt: 'desc' }
      });

      return job;
    } catch (error) {
      logError(`${ICONS.ERROR} Erro ao buscar job ativo:`, "error", { component: "deepAnalysisService" });
      return null;
    }
  }

  /**
   * Busca job por version ID
   */
  async getActiveJobByVersion(versionId: string) {
    try {
      const job = await prisma.analysisJob.findFirst({
        where: {
          resultVersionId: versionId,
          status: { in: [JobStatus.QUEUED, JobStatus.RUNNING] }
        }
      });

      return job;
    } catch (error) {
      logError(`${ICONS.ERROR} Erro ao buscar job por versão:`, "error", { component: "deepAnalysisService" });
      return null;
    }
  }

  /**
   * Adquire lock Redis para análise
   */
  async acquireAnalysisLock(analysisKey: string, ttlSeconds: number = this.LOCK_TTL): Promise<LockResult> {
    const lockKey = `analysis_lock:${analysisKey}`;
    const token = `${Date.now()}_${Math.random().toString(36)}`;

    try {
      // Validate redis client before using
      if (!isRedisClient(redis)) {
        log.error({ msg: "${ICONS.ERROR} Redis client não disponível", component: "deepAnalysisService" });
        return { acquired: false };
      }

      // Tentar adquirir lock com SETNX
      const result = await redis.set(lockKey, token, 'EX', ttlSeconds, 'NX');

      if (result === 'OK') {
        log.info({ msg: "${ICONS.SUCCESS} Lock adquirido: ${lockKey}", component: "deepAnalysisService" });
        return { acquired: true, token };
      } else {
        // Lock já existe, verificar TTL
        const ttl = await redis.ttl(lockKey);
        log.info({ msg: "${ICONS.WARNING} Lock já existe, TTL: ${ttl}s", component: "deepAnalysisService" });
        return { acquired: false, ttl: ttl > 0 ? ttl : undefined };
      }
    } catch (error) {
      logError(`${ICONS.ERROR} Erro ao adquirir lock:`, "error", { component: "deepAnalysisService" });
      return { acquired: false };
    }
  }

  /**
   * Libera lock Redis
   */
  async releaseAnalysisLock(token: string): Promise<void> {
    // Implementar script Lua para release seguro
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    try {
      // Validate redis client before using
      if (!isRedisClient(redis)) {
        log.error({ msg: "${ICONS.ERROR} Redis client não disponível", component: "deepAnalysisService" });
        return;
      }

      const lockKey = `analysis_lock:${token.split('_')[0]}`; // Simplificado
      await redis.eval(script, 1, lockKey, token);
      log.info({ msg: "${ICONS.SUCCESS} Lock liberado: ${token}", component: "deepAnalysisService" });
    } catch (error) {
      logError(`${ICONS.ERROR} Erro ao liberar lock:`, "error", { component: "deepAnalysisService" });
    }
  }

  /**
   * Obtém próximo número de versão
   */
  async getNextVersionNumber(processId: string): Promise<number> {
    try {
      const lastVersion = await prisma.caseAnalysisVersion.findFirst({
        where: { caseId: processId },
        orderBy: { version: 'desc' },
        select: { version: true }
      });

      return (lastVersion?.version || 0) + 1;
    } catch (error) {
      logError(`${ICONS.ERROR} Erro ao obter próximo número de versão:`, "error", { component: "deepAnalysisService" });
      return 1;
    }
  }

  /**
   * Cria versão de análise
   * Valida sourceFilesMetadata antes de salvar no banco
   */
  async createAnalysisVersion(params: AnalysisVersionParams): Promise<CaseAnalysisVersion> {
    try {
      // sourceFilesMetadata deve ser um array de objetos que podem ser serializados como JSON
      // InputJsonValue permite qualquer JSON-serializable value
      // Validamos que é um array antes de persistir
      if (!Array.isArray(params.sourceFilesMetadata)) {
        throw new Error('sourceFilesMetadata must be an array');
      }

      const version = await prisma.caseAnalysisVersion.create({
        data: {
          case: {
            connect: { id: params.processId }
          },
          workspace: {
            connect: { id: params.workspaceId }
          },
          version: params.version,
          analysisType: params.analysisType,
          modelUsed: params.modelUsed,
          analysisKey: params.analysisKey,
          extractedData: params.sourceFilesMetadata,
          status: 'PENDING'
        }
      });

      log.info({ msg: "${ICONS.SUCCESS} Versão de análise criada: ${version.id}", component: "deepAnalysisService" });
      return version;
    } catch (error) {
      logError(`${ICONS.ERROR} Erro ao criar versão de análise:`, "error", { component: "deepAnalysisService" });
      throw error;
    }
  }

  /**
   * Cria job de análise
   * Valida metadata e filesMetadata antes de salvar
   */
  async createAnalysisJob(params: AnalysisJobParams) {
    try {
      // Valida metadata se fornecida
      const validatedMetadata: AnalysisMetadata = params.metadata || {};
      if (!isAnalysisMetadata(validatedMetadata)) {
        throw new Error('Invalid metadata: failed type validation');
      }

      // filesMetadata deve ser serializável para JSON
      if (!Array.isArray(params.filesMetadata)) {
        throw new Error('filesMetadata must be an array');
      }

      // Convert metadata to JSON-serializable format for Prisma
      const metadataAsJson: InputJsonValue = JSON.parse(JSON.stringify(validatedMetadata));

      const job = await prisma.analysisJob.create({
        data: {
          processId: params.processId,
          workspaceId: params.workspaceId,
          analysisKey: params.analysisKey,
          analysisType: params.analysisType,
          modelHint: params.modelHint,
          filesMetadata: JSON.stringify(params.filesMetadata),
          resultVersionId: params.resultVersionId,
          lockToken: params.lockToken,
          metadata: metadataAsJson,
          status: JobStatus.QUEUED
        }
      });

      log.info({ msg: "${ICONS.SUCCESS} Job de análise criado: ${job.id}", component: "deepAnalysisService" });
      return job;
    } catch (error) {
      logError(`${ICONS.ERROR} Erro ao criar job de análise:`, "error", { component: "deepAnalysisService" });
      throw error;
    }
  }

  /**
   * Busca última análise por tipo
   */
  async getLastAnalysis(processId: string, analysisType?: string): Promise<CaseAnalysisVersion | null> {
    try {
      const where: CaseAnalysisVersionWhereInput = { caseId: processId };
      if (analysisType) {
        where.analysisType = analysisType as AnalysisType;
      }

      const analysis = await prisma.caseAnalysisVersion.findFirst({
        where,
        orderBy: { createdAt: 'desc' }
      });

      return analysis;
    } catch (error) {
      logError(`${ICONS.ERROR} Erro ao buscar última análise:`, "error", { component: "deepAnalysisService" });
      return null;
    }
  }

  /**
   * Processa análise em background com Gemini Pro
   * Valida tipos de dados retornados do Gemini antes de persistir
   */
  async processAnalysisInBackground(jobId: string): Promise<void> {
    log.info({ msg: "${ICONS.PROCESS} Iniciando processamento background para job: ${jobId}", component: "deepAnalysisService" });

    try {
      // Buscar job no banco
      const job = await prisma.analysisJob.findUnique({
        where: { id: jobId }
      });

      if (!job) {
        throw new Error(`Job não encontrado: ${jobId}`);
      }

      // Buscar documentos do processo
      const documents = await prisma.caseDocument.findMany({
        where: { caseId: job.processId },
        select: {
          id: true,
          name: true,
          extractedText: true
        }
      });

      // Atualizar progresso para em processamento
      await prisma.analysisJob.update({
        where: { id: jobId },
        data: {
          status: JobStatus.RUNNING,
          progress: 25,
          startedAt: new Date()
        }
      });

      // Extrair texto dos documentos com validação de tipo
      const documentTexts = documents.map((doc: PrismaCaseDocumentWithText) => ({
        id: doc.id,
        name: doc.name,
        // extractedText pode vir como unknown do Prisma, garantir string
        text: typeof doc.extractedText === 'string' ? doc.extractedText : 'Texto não extraído'
      }));

      // Atualizar progresso
      await prisma.analysisJob.update({
        where: { id: jobId },
        data: { progress: 50 }
      });

      // Buscar informações do processo
      const processInfo = await prisma.monitoredProcess.findFirst({
        where: { id: job.processId }
      });

      // Preparar prompt para análise completa com Gemini Pro
      const analysisPrompt = this.buildDeepAnalysisPrompt(processInfo, documentTexts);

      // Usar Gemini Pro para análise completa
      const geminiClient = getGeminiClient();
      const rawAnalysisResult = await geminiClient.generateJsonContent(analysisPrompt, {
        model: ModelTier.PRO,
        maxTokens: 8000,
        temperature: 0.2
      });

      // Validar resultado da análise contra tipo esperado
      // Se não for AIAnalysisData válido, lançar erro
      const analysisResult = createAIAnalysisData(rawAnalysisResult);

      // Atualizar progresso
      await prisma.analysisJob.update({
        where: { id: jobId },
        data: { progress: 75 }
      });

      // Extrair confidence do metadata, com fallback seguro
      let confidenceValue = 0.85;
      if (analysisResult.metadados_analise && typeof analysisResult.metadados_analise === 'object') {
        const metadata = analysisResult.metadados_analise as Record<string, unknown>;
        if (typeof metadata.confidencia === 'number') {
          confidenceValue = metadata.confidencia;
        } else if (typeof metadata.confidence === 'number') {
          confidenceValue = metadata.confidence;
        }
      }

      // Convert analysisResult to JSON-serializable format for Prisma
      const analysisResultAsJson: InputJsonValue = JSON.parse(JSON.stringify(analysisResult));

      // Salvar resultado da análise
      await prisma.caseAnalysisVersion.update({
        where: { id: job.resultVersionId || '' },
        data: {
          aiAnalysis: analysisResultAsJson,
          status: JobStatus.COMPLETED,
          modelUsed: 'gemini-2.5-pro',
          processingTime: Date.now() - (job.startedAt?.getTime() || Date.now()),
          confidence: confidenceValue
        }
      });

      // Marcar job como concluído
      await prisma.analysisJob.update({
        where: { id: jobId },
        data: {
          status: JobStatus.COMPLETED,
          progress: 100,
          finishedAt: new Date()
        }
      });

      log.info({ msg: "${ICONS.SUCCESS} Job processado com sucesso com Gemini Pro: ${jobId}", component: "deepAnalysisService" });
    } catch (error) {
      logError(`${ICONS.ERROR} Erro no processamento background:`, "error", { component: "deepAnalysisService" });

      await prisma.analysisJob.update({
        where: { id: jobId },
        data: {
          status: JobStatus.FAILED,
          finishedAt: new Date()
        }
      });
    }
  }

  /**
   * Constrói prompt para análise profunda com Gemini Pro
   */
  private buildDeepAnalysisPrompt(process: MonitoredProcess | null, documentTexts: AnalysisDocument[]): string {
    return `
Você é um especialista em análise jurídica. Analise o processo judicial a seguir e forneça uma análise completa e detalhada.

**INFORMAÇÕES DO PROCESSO:**
- Número: ${process?.processNumber || 'Não informado'}
- Tribunal: ${process?.court || 'Não informado'}
- Cliente: ${process?.clientName || 'Não informado'}
- Status do Monitoramento: ${process?.monitoringStatus || 'Não informado'}

**DOCUMENTOS ANALISADOS:**
${documentTexts.map((doc, index) => `
${index + 1}. **${doc.name}**
${doc.text.substring(0, 4000)}${doc.text.length > 4000 ? '...' : ''}
`).join('\n')}

**INSTRUÇÕES:**
Analise os documentos e forneça uma análise jurídica completa seguindo esta estrutura JSON:

{
  "resumo_executivo": "Resumo geral do processo em 2-3 parágrafos",
  "situacao_atual": "Status atual do processo e última movimentação",
  "pontos_criticos": [
    "Lista de pontos que merecem atenção especial"
  ],
  "proximos_passos": [
    "Ações recomendadas e prazos importantes"
  ],
  "analise_juridica": {
    "fundamentos": "Fundamentos jurídicos identificados",
    "jurisprudencia": "Jurisprudência aplicável se identificada",
    "riscos": "Riscos processuais identificados",
    "oportunidades": "Oportunidades processuais identificadas"
  },
  "timeline": [
    {
      "data": "YYYY-MM-DD",
      "evento": "Descrição do evento",
      "relevancia": "ALTA|MEDIA|BAIXA"
    }
  ],
  "recomendacoes": [
    "Lista de recomendações específicas para o caso"
  ],
  "metadata": {
    "confidencia": 0.85,
    "tokensUsed": 1500,
    "analysisDate": "${new Date().toISOString()}"
  }
}

Retorne apenas o JSON válido, sem texto adicional.`;
  }

  /**
   * Gera versão única para análise
   */
  private generateAnalysisVersion(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = Math.random().toString(36).substring(2, 8);
    return `v${timestamp}-${random}`;
  }
}