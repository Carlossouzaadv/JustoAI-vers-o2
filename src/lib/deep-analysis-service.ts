// ================================================================
// DEEP ANALYSIS SERVICE
// ================================================================
// Serviço para análise FAST/FULL com cache, versioning e Redis locks
//
// EMERGENCY MODE: Se REDIS_DISABLED=true, usa mock client sem tentar conectar

import { PrismaClient, AnalysisType, JobStatus } from '@prisma/client';
import { createHash } from 'crypto';
import { Redis } from 'ioredis';
import { ICONS } from './icons';
import { getGeminiClient } from './gemini-client';
import { ModelTier } from './ai-model-router';
import { getRedisClient } from './redis';


const prisma = new PrismaClient();

// Redis connection - lazy initialization (only connect when actually used)
let redis: any = null;

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

export interface AnalysisVersionParams {
  processId: string;
  workspaceId: string;
  version: number;
  analysisType: AnalysisType;
  modelUsed: string;
  fullCreditsUsed?: number;
  fastCreditsUsed?: number;
  analysisKey?: string;
  sourceFilesMetadata: any[];
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
  metadata?: any;
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
      console.error(`${ICONS.ERROR} Erro ao validar acesso ao processo:`, error);
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

      return documents.map(doc => ({
        id: doc.id,
        name: doc.name,
        textSha: doc.textSha || '',
        size: doc.size || 0,
        cleanText: doc.cleanText || undefined
      }));
    } catch (error) {
      console.error(`${ICONS.ERROR} Erro ao buscar documentos do processo:`, error);
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

      return documents.map(doc => ({
        id: doc.id,
        name: doc.name,
        textSha: doc.textSha || '',
        size: doc.size || 0,
        cleanText: doc.cleanText || undefined
      }));
    } catch (error) {
      console.error(`${ICONS.ERROR} Erro ao buscar documentos específicos:`, error);
      return [];
    }
  }

  /**
   * Processa arquivos enviados via upload
   */
  async processUploadedFiles(
    files: File[],
    processId: string,
    workspaceId: string,
    userId: string
  ): Promise<ProcessDocument[]> {
    const processedFiles: ProcessDocument[] = [];

    try {
      for (const file of files) {
        console.log(`${ICONS.PROCESS} Processando arquivo: ${file.name}`);

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
          console.log(`${ICONS.INFO} Arquivo ${file.name} já existe, reutilizando`);
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
        const textSha = createHash('sha256').update(cleanText).digest('hex');

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

        console.log(`${ICONS.SUCCESS} Arquivo processado: ${file.name}`);
      }

      return processedFiles;
    } catch (error) {
      console.error(`${ICONS.ERROR} Erro ao processar arquivos:`, error);
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

    console.log(`${ICONS.INFO} Analysis key gerada: ${analysisKey.substring(0, 16)}...`);
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
      console.error(`${ICONS.ERROR} Erro ao buscar última movimentação:`, error);
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
  async getCachedAnalysis(analysisKey: string, processId: string): Promise<any | null> {
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
        console.log(`${ICONS.WARNING} Cache expirado para key: ${analysisKey}`);
        await this.invalidateCache(analysisKey);
        return null;
      }

      // Verificar se não houve movimentações após o cache
      const lastMovement = await this.getLastProcessMovement(processId);
      if (lastMovement && cached.lastMovementDate && lastMovement > cached.lastMovementDate) {
        console.log(`${ICONS.WARNING} Cache invalidado por nova movimentação`);
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
      console.error(`${ICONS.ERROR} Erro ao verificar cache:`, error);
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
      console.error(`${ICONS.ERROR} Erro ao incrementar acesso ao cache:`, error);
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
      console.error(`${ICONS.ERROR} Erro ao invalidar cache:`, error);
    }
  }

  /**
   * Busca job ativo para analysis_key
   */
  async getActiveJob(analysisKey: string): Promise<any | null> {
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
      console.error(`${ICONS.ERROR} Erro ao buscar job ativo:`, error);
      return null;
    }
  }

  /**
   * Busca job por version ID
   */
  async getActiveJobByVersion(versionId: string): Promise<any | null> {
    try {
      const job = await prisma.analysisJob.findFirst({
        where: {
          resultVersionId: versionId,
          status: { in: [JobStatus.QUEUED, JobStatus.RUNNING] }
        }
      });

      return job;
    } catch (error) {
      console.error(`${ICONS.ERROR} Erro ao buscar job por versão:`, error);
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
      // Tentar adquirir lock com SETNX
      const result = await redis.set(lockKey, token, 'EX', ttlSeconds, 'NX');

      if (result === 'OK') {
        console.log(`${ICONS.SUCCESS} Lock adquirido: ${lockKey}`);
        return { acquired: true, token };
      } else {
        // Lock já existe, verificar TTL
        const ttl = await redis.ttl(lockKey);
        console.log(`${ICONS.WARNING} Lock já existe, TTL: ${ttl}s`);
        return { acquired: false, ttl: ttl > 0 ? ttl : undefined };
      }
    } catch (error) {
      console.error(`${ICONS.ERROR} Erro ao adquirir lock:`, error);
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
      const lockKey = `analysis_lock:${token.split('_')[0]}`; // Simplificado
      await redis.eval(script, 1, lockKey, token);
      console.log(`${ICONS.SUCCESS} Lock liberado: ${token}`);
    } catch (error) {
      console.error(`${ICONS.ERROR} Erro ao liberar lock:`, error);
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
      console.error(`${ICONS.ERROR} Erro ao obter próximo número de versão:`, error);
      return 1;
    }
  }

  /**
   * Cria versão de análise
   */
  async createAnalysisVersion(params: AnalysisVersionParams): Promise<any> {
    try {
      const version = await prisma.caseAnalysisVersion.create({
        data: {
          case: {
            connect: { id: params.processId }
          },
          version: params.version,
          analysisType: params.analysisType,
          modelUsed: params.modelUsed,
          analysisKey: params.analysisKey,
          extractedData: params.sourceFilesMetadata,
          status: 'PENDING'
        }
      });

      console.log(`${ICONS.SUCCESS} Versão de análise criada: ${version.id}`);
      return version;
    } catch (error) {
      console.error(`${ICONS.ERROR} Erro ao criar versão de análise:`, error);
      throw error;
    }
  }

  /**
   * Cria job de análise
   */
  async createAnalysisJob(params: AnalysisJobParams): Promise<any> {
    try {
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
          metadata: params.metadata || {},
          status: JobStatus.QUEUED
        }
      });

      console.log(`${ICONS.SUCCESS} Job de análise criado: ${job.id}`);
      return job;
    } catch (error) {
      console.error(`${ICONS.ERROR} Erro ao criar job de análise:`, error);
      throw error;
    }
  }

  /**
   * Busca última análise por tipo
   */
  async getLastAnalysis(processId: string, analysisType?: string): Promise<any | null> {
    try {
      const where: any = { caseId: processId };
      if (analysisType) {
        where.analysisType = analysisType;
      }

      const analysis = await prisma.caseAnalysisVersion.findFirst({
        where,
        orderBy: { createdAt: 'desc' }
      });

      return analysis;
    } catch (error) {
      console.error(`${ICONS.ERROR} Erro ao buscar última análise:`, error);
      return null;
    }
  }

  /**
   * Processa análise em background com Gemini Pro
   */
  async processAnalysisInBackground(jobId: string): Promise<void> {
    console.log(`${ICONS.PROCESS} Iniciando processamento background para job: ${jobId}`);

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

      // Extrair texto dos documentos
      const documentTexts = documents.map(doc => ({
        id: doc.id,
        name: doc.name,
        text: doc.extractedText || 'Texto não extraído'
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
      const analysisResult = await geminiClient.generateJsonContent(analysisPrompt, {
        model: ModelTier.PRO,
        maxTokens: 8000,
        temperature: 0.2
      });

      // Atualizar progresso
      await prisma.analysisJob.update({
        where: { id: jobId },
        data: { progress: 75 }
      });

      // Salvar resultado da análise
      await prisma.caseAnalysisVersion.update({
        where: { id: job.resultVersionId || '' },
        data: {
          aiAnalysis: analysisResult,
          status: JobStatus.COMPLETED,
          modelUsed: 'gemini-2.5-pro',
          processingTime: Date.now() - (job.startedAt?.getTime() || Date.now()),
          confidence: analysisResult.metadata?.confidencia || 0.85
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

      console.log(`${ICONS.SUCCESS} Job processado com sucesso com Gemini Pro: ${jobId}`);
    } catch (error) {
      console.error(`${ICONS.ERROR} Erro no processamento background:`, error);

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
  private buildDeepAnalysisPrompt(process: any, documentTexts: any[]): string {
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