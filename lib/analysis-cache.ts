// ================================================================
// ANALYSIS CACHE MANAGER - Cache Redis para Análises IA
// ================================================================
// Implementa cache inteligente com TTL configurável e lock Redis
// para evitar double-processing conforme especificação
//
// EMERGENCY MODE: Se REDIS_DISABLED=true, usa mock client sem tentar conectar

import Redis from 'ioredis';
import { createHash } from 'crypto';
import { getDocumentHashManager } from './document-hash';
import { ICONS } from './icons';
import { getRedis } from './redis';

// Check if Redis should be disabled (for Railway without Redis)
const REDIS_DISABLED = process.env.REDIS_DISABLED === 'true' || !process.env.REDIS_HOST;

export interface AnalysisCacheResult {
  hit: boolean;
  data?: unknown;
  age?: number; // Idade do cache em segundos
  key: string;
}

export interface CacheLockResult {
  acquired: boolean;
  lockKey: string;
  ttl: number;
}

export class AnalysisCacheManager {
  private redis: Redis;
  private hashManager = getDocumentHashManager();

  // Configurações baseadas na especificação
  private readonly TEXT_CACHE_TTL = 90 * 24 * 60 * 60; // 90 dias
  private readonly ANALYSIS_CACHE_TTL = 7 * 24 * 60 * 60; // 7 dias
  private readonly LOCK_TTL = 300; // 5 minutos para lock

  constructor() {
    // Use mock Redis if disabled, otherwise create real connection
    if (REDIS_DISABLED) {
      console.warn('⚠️ Analysis cache Redis is disabled - using mock client');
      this.redis = getRedis(); // Returns MockRedis when disabled
    } else {
      this.redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        maxRetriesPerRequest: 1, // ⚠️ CRITICAL: Limit to 1 retry to prevent CPU spike
        enableReadyCheck: false,
        lazyConnect: true,
        enableOfflineQueue: false, // ⚠️ CRITICAL: Don't queue when offline
        reconnectOnError: null, // ⚠️ CRITICAL: Don't auto-reconnect on error
      });

      this.redis.on('error', (error) => {
        console.error(`${ICONS.ERROR} Redis connection error:`, error);
      });

      this.redis.on('connect', () => {
        console.log(`${ICONS.SUCCESS} Redis connected for analysis cache`);
      });
    }
  }

  /**
   * Gera chave de cache para análise conforme especificação
   * analysis_key = sha256(text_sha(s) + model_version + prompt_signature + last_movement_date)
   */
  private generateAnalysisKey(
    textShas: string[],
    modelVersion: string,
    promptSignature: string,
    lastMovementDate?: Date
  ): string {
    // Ordenar hashes para garantir consistência independente da ordem dos arquivos
    const sortedTextShas = [...textShas].sort();

    // Incluir data da última movimentação
    const movementDateStr = lastMovementDate?.toISOString() || 'no-movements';

    const keyData = sortedTextShas.join('|') + '|' + modelVersion + '|' + promptSignature + '|' + movementDateStr;

    return createHash('sha256').update(keyData).digest('hex');
  }

  /**
   * Verifica cache de análise conforme especificação
   * Cache é válido apenas se não houve movimentações após a criação
   */
  async checkAnalysisCache(
    textShas: string[],
    modelVersion: string,
    promptSignature: string,
    lastMovementDate?: Date
  ): Promise<AnalysisCacheResult> {
    try {
      const analysisKey = this.generateAnalysisKey(textShas, modelVersion, promptSignature, lastMovementDate);
      const cacheKey = `analysis:${analysisKey}`;

      console.log(`${ICONS.SEARCH} Verificando cache de análise: ${analysisKey.substring(0, 16)}...`);

      const [data, ttl] = await Promise.all([
        this.redis.get(cacheKey),
        this.redis.ttl(cacheKey)
      ]);

      if (data) {
        const parsedData = JSON.parse(data);
        const cacheCreatedAt = new Date(parsedData.cachedAt);

        // Verificar se cache ainda é válido baseado na especificação:
        // "Se um relatório foi gerado há 10 dias, mas o processo não teve
        // nenhuma movimentação desde então, o relatório cacheado ainda é 100% válido"
        const isValidByMovement = !lastMovementDate || cacheCreatedAt > lastMovementDate;

        if (isValidByMovement) {
          const age = this.ANALYSIS_CACHE_TTL - ttl;
          console.log(`${ICONS.SUCCESS} Cache HIT - análise válida (idade: ${Math.floor(age / 3600)}h)`);

          return {
            hit: true,
            data: parsedData.result,
            age,
            key: analysisKey
          };
        } else {
          // Cache inválido por nova movimentação
          console.log(`${ICONS.WARNING} Cache INVALID - nova movimentação detectada, removendo cache`);
          await this.redis.del(cacheKey);
        }
      }

      console.log(`${ICONS.INFO} Cache MISS - análise não encontrada ou inválida`);
      return {
        hit: false,
        key: analysisKey
      };

    } catch (error) {
      console.error(`${ICONS.ERROR} Erro ao verificar cache:`, error);
      return {
        hit: false,
        key: 'error'
      };
    }
  }

  /**
   * Salva resultado de análise no cache
   */
  async saveAnalysisCache(
    textShas: string[],
    modelVersion: string,
    promptSignature: string,
    analysisResult: unknown,
    lastMovementDate?: Date,
    workspaceId?: string
  ): Promise<boolean> {
    try {
      const analysisKey = this.generateAnalysisKey(textShas, modelVersion, promptSignature, lastMovementDate);
      const cacheKey = `analysis:${analysisKey}`;

      const cacheData = {
        textShas,
        modelVersion,
        promptSignature,
        lastMovementDate: lastMovementDate?.toISOString(),
        result: analysisResult,
        workspaceId,
        cachedAt: new Date().toISOString(),
        ttl: this.ANALYSIS_CACHE_TTL
      };

      await this.redis.setex(cacheKey, this.ANALYSIS_CACHE_TTL, JSON.stringify(cacheData));

      console.log(`${ICONS.SUCCESS} Análise salva no cache: ${analysisKey.substring(0, 16)}... (TTL: ${this.ANALYSIS_CACHE_TTL}s)`);
      return true;

    } catch (error) {
      console.error(`${ICONS.ERROR} Erro ao salvar cache:`, error);
      return false;
    }
  }

  /**
   * Adquire lock Redis para evitar double-processing
   */
  async acquireLock(analysisKey: string): Promise<CacheLockResult> {
    try {
      const lockKey = `lock:analysis:${analysisKey}`;

      console.log(`${ICONS.PROCESS} Tentando adquirir lock: ${analysisKey.substring(0, 16)}...`);

      // SETNX com TTL
      const result = await this.redis.set(lockKey, Date.now().toString(), 'EX', this.LOCK_TTL, 'NX');

      if (result === 'OK') {
        console.log(`${ICONS.SUCCESS} Lock adquirido com sucesso`);
        return {
          acquired: true,
          lockKey,
          ttl: this.LOCK_TTL
        };
      }

      // Lock já existe, verificar TTL restante
      const ttl = await this.redis.ttl(lockKey);
      console.log(`${ICONS.WARNING} Lock já existe (TTL restante: ${ttl}s)`);

      return {
        acquired: false,
        lockKey,
        ttl
      };

    } catch (error) {
      console.error(`${ICONS.ERROR} Erro ao adquirir lock:`, error);
      return {
        acquired: false,
        lockKey: '',
        ttl: 0
      };
    }
  }

  /**
   * Libera lock Redis
   */
  async releaseLock(lockKey: string): Promise<boolean> {
    try {
      const result = await this.redis.del(lockKey);
      console.log(`${ICONS.SUCCESS} Lock liberado: ${lockKey}`);
      return result > 0;
    } catch (error) {
      console.error(`${ICONS.ERROR} Erro ao liberar lock:`, error);
      return false;
    }
  }

  /**
   * Cache de texto extraído (TTL longo - 90 dias)
   */
  async cacheExtractedText(textSha: string, extractedText: string): Promise<boolean> {
    try {
      const textKey = `text:${textSha}`;

      await this.redis.setex(textKey, this.TEXT_CACHE_TTL, extractedText);

      console.log(`${ICONS.SUCCESS} Texto extraído salvo no cache (TTL: ${this.TEXT_CACHE_TTL}s)`);
      return true;
    } catch (error) {
      console.error(`${ICONS.ERROR} Erro ao cachear texto:`, error);
      return false;
    }
  }

  /**
   * Recupera texto extraído do cache
   */
  async getCachedText(textSha: string): Promise<string | null> {
    try {
      const textKey = `text:${textSha}`;
      const text = await this.redis.get(textKey);

      if (text) {
        console.log(`${ICONS.SUCCESS} Texto recuperado do cache`);
      }

      return text;
    } catch (error) {
      console.error(`${ICONS.ERROR} Erro ao recuperar texto do cache:`, error);
      return null;
    }
  }

  /**
   * Limpa caches expirados (manutenção)
   */
  async cleanupExpiredCaches(): Promise<number> {
    try {
      console.log(`${ICONS.PROCESS} Iniciando limpeza de caches expirados...`);

      const keys = await this.redis.keys('analysis:*');
      let cleanedCount = 0;

      for (const key of keys) {
        const ttl = await this.redis.ttl(key);
        if (ttl <= 0) {
          await this.redis.del(key);
          cleanedCount++;
        }
      }

      console.log(`${ICONS.SUCCESS} Limpeza concluída: ${cleanedCount} caches removidos`);
      return cleanedCount;

    } catch (error) {
      console.error(`${ICONS.ERROR} Erro na limpeza de cache:`, error);
      return 0;
    }
  }

  /**
   * Estatísticas do cache
   */
  async getCacheStats(): Promise<{
    analysis_entries: number;
    text_entries: number;
    memory_usage_bytes: number;
    memory_usage_mb: number;
    ttl_config: {
      text_cache_days: number;
      analysis_cache_days: number;
      lock_ttl_minutes: number;
    };
  } | null> {
    try {
      const [analysisKeys, textKeys] = await Promise.all([
        this.redis.keys('analysis:*'),
        this.redis.keys('text:*')
      ]);

      // Try to get memory usage, fallback to 0 if not supported
      let memoryInfo = 0;
      try {
        memoryInfo = await this.redis.call('MEMORY', 'USAGE') as number;
      } catch (error) {
        console.warn('Redis MEMORY USAGE command not supported, using fallback');
      }

      const memoryUsageBytes = memoryInfo || 0;

      return {
        analysis_entries: analysisKeys.length,
        text_entries: textKeys.length,
        memory_usage_bytes: memoryUsageBytes,
        memory_usage_mb: Math.round(memoryUsageBytes / (1024 * 1024)),
        ttl_config: {
          text_cache_days: this.TEXT_CACHE_TTL / (24 * 60 * 60),
          analysis_cache_days: this.ANALYSIS_CACHE_TTL / (24 * 60 * 60),
          lock_ttl_minutes: this.LOCK_TTL / 60
        }
      };
    } catch (error) {
      console.error(`${ICONS.ERROR} Erro ao obter estatísticas:`, error);
      return null;
    }
  }

  /**
   * Busca última data de movimentação do processo
   */
  async getLastMovementDate(processId: string, prisma: { processMovement: { findFirst: (args: unknown) => Promise<{ date: Date } | null> } }): Promise<Date | null> {
    try {
      const lastMovement = await prisma.processMovement.findFirst({
        where: {
          monitoredProcess: {
            caseId: processId
          }
        },
        orderBy: {
          date: 'desc'
        },
        select: {
          date: true
        }
      });

      return lastMovement?.date || null;
    } catch (error) {
      console.error(`${ICONS.ERROR} Erro ao buscar última movimentação:`, error);
      return null;
    }
  }

  /**
   * Busca hashes de texto dos documentos do processo
   */
  async getProcessDocumentHashes(processId: string, prisma: { caseDocument: { findMany: (args: unknown) => Promise<Array<{ textSha: string | null }>> } }): Promise<string[]> {
    try {
      const documents = await prisma.caseDocument.findMany({
        where: {
          caseId: processId,
          textSha: { not: null }
        },
        select: {
          textSha: true
        }
      });

      return documents
        .map((doc) => doc.textSha)
        .filter((hash): hash is string => Boolean(hash))
        .sort(); // Ordenar para consistência
    } catch (error) {
      console.error(`${ICONS.ERROR} Erro ao buscar hashes de documentos:`, error);
      return [];
    }
  }

  /**
   * Invalida cache quando há nova movimentação
   */
  async invalidateCacheForProcess(processId: string): Promise<void> {
    try {
      // Buscar todas as chaves de cache relacionadas ao processo
      const pattern = 'analysis:*';
      const keys = await this.redis.keys(pattern);

      let invalidatedCount = 0;

      for (const key of keys) {
        try {
          const data = await this.redis.get(key);
          if (data) {
            const parsedData = JSON.parse(data);
            // Verificar se é análise relacionada ao processo
            // (seria melhor ter processId na chave, mas por ora fazemos essa verificação)
            if (parsedData.workspaceId) {
              await this.redis.del(key);
              invalidatedCount++;
            }
          }
        } catch (error) {
          // Ignorar erros de parsing individual
        }
      }

      if (invalidatedCount > 0) {
        console.log(`${ICONS.SUCCESS} Invalidated ${invalidatedCount} cache entries for process ${processId}`);
      }
    } catch (error) {
      console.error(`${ICONS.ERROR} Erro ao invalidar cache:`, error);
    }
  }

  /**
   * Fecha conexão Redis
   */
  async disconnect(): Promise<void> {
    await this.redis.disconnect();
  }
}

// Singleton para reutilização
let analysisCacheManager: AnalysisCacheManager | null = null;

export function getAnalysisCacheManager(): AnalysisCacheManager {
  if (!analysisCacheManager) {
    analysisCacheManager = new AnalysisCacheManager();
  }
  return analysisCacheManager;
}