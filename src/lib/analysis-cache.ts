// ================================================================
// ANALYSIS CACHE MANAGER - Cache Redis para Análises IA
// ================================================================
// Implementa cache inteligente com TTL configurável e lock Redis
// para evitar double-processing conforme especificação
//
// EMERGENCY MODE: Se REDIS_DISABLED=true, usa mock client sem tentar conectar
//
// Type-safe cache operations com Redis types from src/lib/types/redis.ts

import { createHash } from 'crypto';
import { getDocumentHashManager } from './document-hash';
import { ICONS } from './icons';
import { getRedisClient } from './redis';
import {
  type AnalysisCacheEntry,
  CacheKeys,
  isAnalysisCacheEntry,
} from './types/redis';
import { log, logError } from '@/lib/services/logger';

export interface AnalysisCacheResult<T = Record<string, unknown>> {
  hit: boolean;
  data?: T;
  age?: number; // Idade do cache em segundos
  key: string;
}

export interface CacheLockResult {
  acquired: boolean;
  lockKey: string;
  ttl: number;
}

export class AnalysisCacheManager {
  private redis: ReturnType<typeof getRedisClient>;
  private hashManager = getDocumentHashManager();

  // Configurações baseadas na especificação
  private readonly TEXT_CACHE_TTL = 90 * 24 * 60 * 60; // 90 dias
  private readonly ANALYSIS_CACHE_TTL = 7 * 24 * 60 * 60; // 7 dias
  private readonly LOCK_TTL = 300; // 5 minutos para lock

  constructor() {
    // Use Redis singleton - will connect with REDIS_URL if available
    this.redis = getRedisClient();
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
   * Type-safe: usa type guards para validar dados do Redis
   */
  async checkAnalysisCache(
    textShas: string[],
    modelVersion: string,
    promptSignature: string,
    lastMovementDate?: Date
  ): Promise<AnalysisCacheResult<Record<string, unknown>>> {
    try {
      const analysisKey = this.generateAnalysisKey(textShas, modelVersion, promptSignature, lastMovementDate);
      const cacheKey = CacheKeys.analysisFull(analysisKey);

      const [data, ttl] = await Promise.all([
        this.redis.get(cacheKey) as Promise<string | null>,
        this.redis.ttl(cacheKey) as Promise<number>
      ]);

      if (!data) {
        return {
          hit: false,
          key: analysisKey
        };
      }

      let parsedData: AnalysisCacheEntry;
      try {
        parsedData = JSON.parse(data) as unknown as AnalysisCacheEntry;
      } catch (_parseError) {
        logError(`${ICONS.ERROR} Failed to parse cache data:`, 'parseError', { component: 'analysisCache' });
        await this.redis.del(cacheKey);
        return {
          hit: false,
          key: analysisKey
        };
      }

      // Type-safe validation: use type guard
      if (!isAnalysisCacheEntry(parsedData)) {
        log.warn({ msg: '${ICONS.WARNING} Invalid cache entry structure, invalidating', component: 'analysisCache' });
        await this.redis.del(cacheKey);
        return {
          hit: false,
          key: analysisKey
        };
      }

      const cacheCreatedAt = new Date(parsedData.createdAt);

      // Verificar se cache ainda é válido baseado na especificação:
      // "Se um relatório foi gerado há 10 dias, mas o processo não teve
      // nenhuma movimentação desde então, o relatório cacheado ainda é 100% válido"
      const isValidByMovement = !lastMovementDate || cacheCreatedAt > lastMovementDate;

      if (isValidByMovement) {
        log.info({ msg: '${ICONS.SUCCESS} Cache HIT', component: 'analysisCache' });
        return {
          hit: true,
          data: parsedData.result.analysis || parsedData.result,
          age: ttl > 0 ? this.ANALYSIS_CACHE_TTL - ttl : 0,
          key: analysisKey
        };
      } else {
        // Cache inválido por nova movimentação
        await this.redis.del(cacheKey);
      }

      return {
        hit: false,
        key: analysisKey
      };

    } catch (_error) {
      // In graceful mode (Vercel web), Redis connection errors are expected and OK
      // Just log and continue without cache
      const errorMsg = error instanceof Error ? error.message : String(error);

      if (errorMsg.includes('Stream isn\'t writeable') || errorMsg.includes('READONLY')) {
        log.warn({ msg: '${ICONS.WARNING} Redis temporarily unavailable (graceful degradation)', component: 'analysisCache' });
      } else {
        logError(`${ICONS.ERROR} Cache error:`, 'errorMsg', { component: 'analysisCache' });
      }

      return {
        hit: false,
        key: 'error'
      };
    }
  }

  /**
   * Salva resultado de análise no cache
   * Type-safe: garante que analysisResult é armazenado corretamente
   */
  async saveAnalysisCache(
    textShas: string[],
    modelVersion: string,
    promptSignature: string,
    analysisResult: Record<string, unknown>,
    lastMovementDate?: Date,
    workspaceId?: string
  ): Promise<boolean> {
    try {
      const analysisKey = this.generateAnalysisKey(textShas, modelVersion, promptSignature, lastMovementDate);
      const cacheKey = CacheKeys.analysisFull(analysisKey);

      const cacheData: AnalysisCacheEntry = {
        caseId: workspaceId || '',
        analysisType: 'FULL',
        result: {
          analysis: analysisResult,
        },
        modelVersion,
        tokensUsed: 0,
        costEstimated: 0,
        expiresAt: Date.now() + (this.ANALYSIS_CACHE_TTL * 1000),
        createdAt: Date.now(),
      };

      await this.redis.setex(cacheKey, this.ANALYSIS_CACHE_TTL, JSON.stringify(cacheData));

      log.info({ msg: '${ICONS.SUCCESS} Análise salva no cache: ${analysisKey.substring(0, 16)}... (TTL: ${this.ANALYSIS_CACHE_TTL}s)', component: 'analysisCache' });
      return true;

    } catch (_error) {
      // In graceful mode, it's OK if cache save fails - just log it
      const errorMsg = error instanceof Error ? error.message : String(error);

      if (!errorMsg.includes('Stream isn\'t writeable') && !errorMsg.includes('READONLY')) {
        logError(`${ICONS.ERROR} Cache save error:`, 'errorMsg', { component: 'analysisCache' });
      }
      return false;
    }
  }

  /**
   * Adquire lock Redis para evitar double-processing
   * Type-safe: usa CacheKeys builder para chave de lock
   *
   * Em modo graceful (web), se Redis não está disponível:
   * - Retorna acquired=false (sem lock, mas permite processamento)
   * - API continua funcionando mesmo sem lock distribuído
   *
   * Em modo strict (workers), falha é propagada
   */
  async acquireLock(analysisKey: string): Promise<CacheLockResult> {
    try {
      const lockKey = CacheKeys.lock(analysisKey);

      // SETNX com TTL
      const result = await (this.redis.set(lockKey, Date.now().toString(), 'EX', this.LOCK_TTL, 'NX') as Promise<string | null>);

      if (result === 'OK') {
        return {
          acquired: true,
          lockKey,
          ttl: this.LOCK_TTL
        };
      }

      // Lock já existe, verificar TTL restante
      const ttl = await (this.redis.ttl(lockKey) as Promise<number>);

      return {
        acquired: false,
        lockKey,
        ttl
      };

    } catch (_error) {
      // In graceful mode, allow processing without lock
      const errorMsg = error instanceof Error ? error.message : String(error);

      if (!errorMsg.includes('Stream isn\'t writeable') && !errorMsg.includes('READONLY')) {
        logError(`${ICONS.ERROR} Lock error:`, 'errorMsg', { component: 'analysisCache' });
      }

      // Return false but with positive ttl to avoid triggering retries
      // In web mode, this allows processing to continue
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
      log.info({ msg: '${ICONS.SUCCESS} Lock liberado: ${lockKey}', component: 'analysisCache' });
      return result > 0;
    } catch (_error) {
      logError(`${ICONS.ERROR} Erro ao liberar lock:`, 'error', { component: 'analysisCache' });
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

      log.info({ msg: '${ICONS.SUCCESS} Texto extraído salvo no cache (TTL: ${this.TEXT_CACHE_TTL}s)', component: 'analysisCache' });
      return true;
    } catch (_error) {
      logError(`${ICONS.ERROR} Erro ao cachear texto:`, 'error', { component: 'analysisCache' });
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
        log.info({ msg: '${ICONS.SUCCESS} Texto recuperado do cache', component: 'analysisCache' });
      }

      return text;
    } catch (_error) {
      logError(`${ICONS.ERROR} Erro ao recuperar texto do cache:`, 'error', { component: 'analysisCache' });
      return null;
    }
  }

  /**
   * Limpa caches expirados (manutenção)
   */
  async cleanupExpiredCaches(): Promise<number> {
    try {
      log.info({ msg: '${ICONS.PROCESS} Iniciando limpeza de caches expirados...', component: 'analysisCache' });

      const keys = await this.redis.keys('analysis:*');
      let cleanedCount = 0;

      for (const key of keys) {
        const ttl = await this.redis.ttl(key);
        if (ttl <= 0) {
          await this.redis.del(key);
          cleanedCount++;
        }
      }

      log.info({ msg: '${ICONS.SUCCESS} Limpeza concluída: ${cleanedCount} caches removidos', component: 'analysisCache' });
      return cleanedCount;

    } catch (_error) {
      logError(`${ICONS.ERROR} Erro na limpeza de cache:`, 'error', { component: 'analysisCache' });
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
      } catch (_error) {
        log.warn({ msg: 'Redis MEMORY USAGE command not supported, using fallback', component: 'analysisCache' });
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
    } catch (_error) {
      logError(`${ICONS.ERROR} Erro ao obter estatísticas:`, 'error', { component: 'analysisCache' });
      return null;
    }
  }

  /**
   * Busca última data de movimentação do processo
   * Type-safe: processId parameter agora é usado corretamente
   */
  async getLastMovementDate(
    processId: string,
    prisma: {
      processMovement: {
        findFirst: (_args: unknown) => Promise<{ date: Date } | null>;
      };
    }
  ): Promise<Date | null> {
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
      } as unknown);

      return lastMovement?.date || null;
    } catch (_error) {
      logError(`${ICONS.ERROR} Erro ao buscar última movimentação:`, 'error', { component: 'analysisCache' });
      return null;
    }
  }

  /**
   * Busca hashes de texto dos documentos do processo
   */
  async getProcessDocumentHashes(processId: string, prisma: { caseDocument: { findMany: (_args: unknown) => Promise<Array<{ textSha: string | null }>> } }): Promise<string[]> {
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
    } catch (_error) {
      logError(`${ICONS.ERROR} Erro ao buscar hashes de documentos:`, 'error', { component: 'analysisCache' });
      return [];
    }
  }

  /**
   * Invalida cache quando há nova movimentação
   * Type-safe: usa type guard para validação de cache entries
   */
  async invalidateCacheForProcess(processId: string): Promise<void> {
    try {
      // Buscar todas as chaves de cache relacionadas ao processo
      const pattern = CacheKeys.analysisFull('*');
      const keys = await (this.redis.keys(pattern) as Promise<string[]>);

      let invalidatedCount = 0;

      for (const key of keys) {
        try {
          const data = await (this.redis.get(key) as Promise<string | null>);
          if (!data) continue;

          let parsedData: unknown;
          try {
            parsedData = JSON.parse(data) as unknown;
          } catch {
            continue;
          }

          // Type-safe validation
          if (isAnalysisCacheEntry(parsedData)) {
            if (parsedData.caseId === processId) {
              await this.redis.del(key);
              invalidatedCount++;
            }
          }
        } catch (_error) {
          // Ignorar erros de processamento individual
          console.debug(`${ICONS.WARNING} Error processing cache key ${key}:`, error);
        }
      }

      if (invalidatedCount > 0) {
        log.info({ msg: '${ICONS.SUCCESS} Invalidated ${invalidatedCount} cache entries for process ${processId}', component: 'analysisCache' });
      }
    } catch (_error) {
      logError(`${ICONS.ERROR} Erro ao invalidar cache:`, 'error', { component: 'analysisCache' });
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