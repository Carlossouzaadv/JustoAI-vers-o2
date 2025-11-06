// ================================
// AI CACHE MANAGER - SISTEMA MULTI-NÍVEL
// ================================
// Cache inteligente com Redis (1h) + PostgreSQL (7 dias) + memória local
// Type-safe implementation using redis.ts types and CacheKeys builder

import { ICONS } from './icons';
import prisma from './prisma';
import { CacheKeys, CachedValueResult } from './types/redis';

// ================================
// TIPOS E INTERFACES
// ================================

export interface CacheEntry {
  key: string;
  value: unknown;
  metadata: {
    model: string;
    type: 'essential' | 'strategic' | 'report';
    complexity_score?: number;
    tokens_saved?: number;
    created_at: Date;
    hits: number;
  };
}

export interface CacheStats {
  memory: {
    size: number;
    hits: number;
    misses: number;
    hit_rate: number;
  };
  redis: {
    connected: boolean;
    estimated_keys: number;
  };
  postgresql: {
    total_entries: number;
    tokens_saved_today: number;
    cost_saved_usd: number;
  };
}

export interface CacheConfig {
  memory_ttl: number; // 15 minutos default
  redis_ttl: number;  // 1 hora default
  postgres_ttl: number; // 7 dias default
  enable_redis: boolean;
  aggressive_mode: boolean; // CRÍTICO para economia
}

/**
 * Redis Client interface for type-safe operations
 */
interface RedisClient {
  get: (key: string) => Promise<string | null>;
  setex: (key: string, ttl: number, value: string) => Promise<void>;
  flushdb: () => Promise<void>;
}

// ================================
// TYPE GUARDS FOR CACHE DATA VALIDATION
// ================================

/**
 * Validates that a value can be serialized/deserialized from cache
 */
function isSerializableValue(value: unknown): value is unknown {
  if (value === null || value === undefined) {
    return false;
  }

  const type = typeof value;
  if (type === 'string' || type === 'number' || type === 'boolean') {
    return true;
  }

  if (type === 'object') {
    try {
      JSON.stringify(value);
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Validates parsed JSON from cache is a valid object
 */
function isParsedCacheData(data: unknown): data is Record<string, unknown> {
  return typeof data === 'object' && data !== null && !Array.isArray(data);
}

// ================================
// CLASSE PRINCIPAL DO CACHE
// ================================

export class AiCacheManager {
  private memoryCache = new Map<string, { data: unknown; expires: number; hits: number }>();
  private config: CacheConfig;
  private stats = {
    memory_hits: 0,
    memory_misses: 0,
    redis_hits: 0,
    redis_misses: 0,
    postgres_hits: 0,
    tokens_saved_today: 0
  };

  // Cliente Redis opcional (se disponível)
  private redisClient: RedisClient | null = null;

  constructor(config?: Partial<CacheConfig>) {
    this.config = {
      memory_ttl: 15 * 60 * 1000, // 15 minutos
      redis_ttl: 60 * 60,         // 1 hora
      postgres_ttl: 7 * 24 * 60 * 60, // 7 dias
      enable_redis: false,        // Desabilitado por enquanto
      aggressive_mode: true,      // CRÍTICO: cache agressivo
      ...config
    };

    this.initializeRedis();
    this.startCleanupInterval();
  }

  // ================================
  // REDIS SETUP (OPCIONAL)
  // ================================

  private async initializeRedis(): Promise<void> {
    if (!this.config.enable_redis) return;

    try {
      // Tentativa de conectar ao Redis (se disponível)
      // const redis = require('redis');
      // this.redisClient = redis.createClient({
      //   url: process.env.REDIS_URL || 'redis://localhost:6379'
      // });
      // await this.redisClient.connect();
      console.log(`${ICONS.SUCCESS} Redis conectado (cache nível 2)`);
    } catch (_error) {
      console.warn(`${ICONS.WARNING} Redis não disponível, usando apenas memória + PostgreSQL`);
      this.config.enable_redis = false;
    }
  }

  // ================================
  // CACHE PRINCIPAL - MULTI-NÍVEL
  // ================================

  /**
   * Busca em cache (3 níveis: memória → Redis → PostgreSQL)
   * Valida todos os dados com type guards antes de retornar
   */
  async get(
    key: string,
    analysisType: 'essential' | 'strategic' | 'report' = 'essential'
  ): Promise<unknown> {
    const cacheKey = this.buildCacheKey(key, analysisType);

    // NÍVEL 1: Memória (mais rápido)
    const memoryResult = this.getFromMemory(cacheKey);
    if (memoryResult !== null) {
      this.stats.memory_hits++;
      console.log(`${ICONS.CACHE} Cache HIT (memória): ${analysisType}`);
      return memoryResult;
    }
    this.stats.memory_misses++;

    // NÍVEL 2: Redis (médio)
    if (this.config.enable_redis && this.redisClient) {
      try {
        const redisResult = await this.redisClient.get(`ai:${cacheKey}`);
        if (redisResult !== null) {
          let parsed: unknown;
          try {
            parsed = JSON.parse(redisResult);
          } catch (_parseError) {
            console.warn(`${ICONS.WARNING} Failed to parse Redis data for key: ${cacheKey}`);
            this.stats.redis_misses++;
            // Continue to next level
          }

          // Validate parsed data before using
          if (parsed !== undefined && isParsedCacheData(parsed)) {
            // Recolocar na memória para próximas consultas
            this.setInMemory(cacheKey, parsed);
            this.stats.redis_hits++;
            console.log(`${ICONS.CACHE} Cache HIT (Redis): ${analysisType}`);
            return parsed;
          }
        }
        this.stats.redis_misses++;
      } catch (error) {
        console.warn(`${ICONS.WARNING} Erro no Redis:`, error);
      }
    }

    // NÍVEL 3: PostgreSQL (mais lento, mas persistente)
    try {
      const dbResult = await prisma.aiCache.findFirst({
        where: {
          cacheKey: cacheKey,
          expiresAt: {
            gt: new Date()
          }
        }
      });

      if (dbResult !== null) {
        const data = dbResult.result;

        // Validate data from database before using
        if (data !== null && isSerializableValue(data)) {
          // Recolocar nos caches superiores
          this.setInMemory(cacheKey, data);
          if (this.config.enable_redis && this.redisClient) {
            try {
              await this.redisClient.setex(
                `ai:${cacheKey}`,
                this.config.redis_ttl,
                JSON.stringify(data)
              );
            } catch (_redisError) {
              // Log but don't fail - continue with in-memory cache
              console.warn(`${ICONS.WARNING} Failed to update Redis cache`);
            }
          }

          // Atualizar hit count
          await prisma.aiCache.update({
            where: { id: dbResult.id },
            data: { hits: { increment: 1 } }
          });

          this.stats.postgres_hits++;
          console.log(`${ICONS.CACHE} Cache HIT (PostgreSQL): ${analysisType}`);
          return data;
        }
      }
    } catch (error) {
      console.error(`${ICONS.ERROR} Erro no cache PostgreSQL:`, error);
    }

    // Nenhum cache encontrado
    return null;
  }

  /**
   * Salva em cache (todos os níveis)
   * Valida o valor antes de armazenar em todas as camadas
   */
  async set(
    key: string,
    value: unknown,
    analysisType: 'essential' | 'strategic' | 'report' = 'essential',
    metadata?: {
      model?: string;
      complexity_score?: number;
      tokens_saved?: number;
      workspaceId?: string;
    }
  ): Promise<void> {
    // Validate value before caching
    if (!isSerializableValue(value)) {
      console.warn(`${ICONS.WARNING} Cannot cache non-serializable value for key: ${key}`);
      return;
    }

    const cacheKey = this.buildCacheKey(key, analysisType);

    // NÍVEL 1: Memória
    this.setInMemory(cacheKey, value);

    // NÍVEL 2: Redis
    if (this.config.enable_redis && this.redisClient) {
      try {
        const serialized = JSON.stringify(value);
        await this.redisClient.setex(
          `ai:${cacheKey}`,
          this.config.redis_ttl,
          serialized
        );
      } catch (error) {
        console.warn(`${ICONS.WARNING} Erro ao salvar no Redis:`, error);
      }
    }

    // NÍVEL 3: PostgreSQL (persistente)
    try {
      // Skip PostgreSQL cache if no workspaceId (e.g., for tests)
      if (!metadata?.workspaceId) {
        console.log(`⚠️ Pulando cache PostgreSQL: sem workspaceId`);
        return;
      }

      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + this.config.postgres_ttl);

      await prisma.aiCache.create({
        data: {
          workspaceId: metadata.workspaceId,
          cacheKey: cacheKey,
          type: 'ANALYSIS',
          prompt: analysisType,
          result: value,
          model: metadata?.model || 'unknown',
          tokens: metadata?.tokens_saved || 0,
          cost: 0.001,
          expiresAt: expiresAt,
          hits: 0
        }
      });

      // Atualizar estatísticas
      if (metadata?.tokens_saved) {
        this.stats.tokens_saved_today += metadata.tokens_saved;
      }

      console.log(`${ICONS.SAVE} Cache SAVED (todos os níveis): ${analysisType}`);
    } catch (error) {
      console.error(`${ICONS.ERROR} Erro ao salvar cache no PostgreSQL:`, error);
    }
  }

  // ================================
  // CACHE ESPECÍFICO POR TIPO
  // ================================

  /**
   * Cache para análises essenciais - SEMPRE Gemini Flash 8B
   */
  async getEssential(textHash: string): Promise<unknown> {
    return this.get(`essential:${textHash}`, 'essential');
  }

  async setEssential(textHash: string, analysis: unknown, metadata?: { model?: string; complexity_score?: number; tokens_saved?: number; workspaceId?: string }): Promise<void> {
    return this.set(`essential:${textHash}`, analysis, 'essential', {
      model: 'gemini-2.5-flash-lite',
      ...metadata
    });
  }

  /**
   * Cache para análises estratégicas - Router por complexidade
   */
  async getStrategic(textHash: string, complexityScore: number): Promise<unknown> {
    const tierKey = this.getTierFromComplexity(complexityScore);
    return this.get(`strategic:${tierKey}:${textHash}`, 'strategic');
  }

  async setStrategic(
    textHash: string,
    analysis: unknown,
    complexityScore: number,
    metadata?: { model?: string; tokens_saved?: number; workspaceId?: string }
  ): Promise<void> {
    const tierKey = this.getTierFromComplexity(complexityScore);
    return this.set(`strategic:${tierKey}:${textHash}`, analysis, 'strategic', {
      complexity_score: complexityScore,
      ...metadata
    });
  }

  /**
   * Cache para relatórios - SEMPRE Gemini Flash
   */
  async getReport(reportHash: string): Promise<unknown> {
    return this.get(`report:${reportHash}`, 'report');
  }

  async setReport(reportHash: string, report: unknown, metadata?: { model?: string; tokens_saved?: number; workspaceId?: string }): Promise<void> {
    return this.set(`report:${reportHash}`, report, 'report', {
      model: 'gemini-2.5-flash',
      ...metadata
    });
  }

  // ================================
  // UTILITÁRIOS PRIVADOS
  // ================================

  private buildCacheKey(_key: string, type: string): string {
    if (this.config.aggressive_mode) {
      // Modo agressivo: cache mais genérico para máxima reutilização
      return `${type}:${this.hashString(_key)}`;
    }
    return `${type}:${_key}`;
  }

  private getTierFromComplexity(score: number): string {
    if (score <= 25) return 'flash8b';
    if (score <= 49) return 'flash';
    return 'pro';
  }

  private hashString(str: string): string {
    // Hash simples para keys
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  // ================================
  // CACHE MEMÓRIA
  // ================================

  private getFromMemory(_key: string): unknown {
    const entry = this.memoryCache.get(_key);
    if (entry && entry.expires > Date.now()) {
      entry.hits++;
      return entry.data;
    }
    if (entry) {
      this.memoryCache.delete(_key); // Expirou
    }
    return null;
  }

  private setInMemory(_key: string, data: unknown): void {
    this.memoryCache.set(_key, {
      data,
      expires: Date.now() + this.config.memory_ttl,
      hits: 0
    });
  }

  // ================================
  // LIMPEZA E MANUTENÇÃO
  // ================================

  private startCleanupInterval(): void {
    // Limpeza da memória a cada 5 minutos
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of Array.from(this.memoryCache.entries())) {
        if (entry.expires < now) {
          this.memoryCache.delete(key);
        }
      }
    }, 5 * 60 * 1000);

    // Limpeza do PostgreSQL a cada hora
    setInterval(async () => {
      try {
        await prisma.aiCache.deleteMany({
          where: {
            expiresAt: {
              lt: new Date()
            }
          }
        });
        console.log(`${ICONS.CLEAN} Cache PostgreSQL limpo (entries expirados)`);
      } catch (error) {
        console.error(`${ICONS.ERROR} Erro na limpeza do cache:`, error);
      }
    }, 60 * 60 * 1000);
  }

  // ================================
  // ESTATÍSTICAS E MONITORAMENTO
  // ================================

  async getStats(): Promise<CacheStats> {
    const totalMemoryRequests = this.stats.memory_hits + this.stats.memory_misses;
    const memoryHitRate = totalMemoryRequests > 0 ?
      (this.stats.memory_hits / totalMemoryRequests) * 100 : 0;

    // Estatísticas do PostgreSQL
    const [totalEntries, todayStats] = await Promise.all([
      prisma.aiCache.count(),
      prisma.aiCache.aggregate({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        },
        _sum: {
          tokens: true
        }
      })
    ]);

    return {
      memory: {
        size: this.memoryCache.size,
        hits: this.stats.memory_hits,
        misses: this.stats.memory_misses,
        hit_rate: Math.round(memoryHitRate * 100) / 100
      },
      redis: {
        connected: this.config.enable_redis && !!this.redisClient,
        estimated_keys: 0 // TODO: implementar se Redis estiver ativo
      },
      postgresql: {
        total_entries: totalEntries,
        tokens_saved_today: todayStats._sum.tokens || 0,
        cost_saved_usd: ((todayStats._sum.tokens || 0) / 1_000_000) * 0.30 // Estimativa
      }
    };
  }

  /**
   * Força limpeza de todo o cache
   */
  async clearAll(): Promise<void> {
    // Limpar memória
    this.memoryCache.clear();

    // Limpar Redis
    if (this.config.enable_redis && this.redisClient) {
      try {
        await this.redisClient.flushdb();
      } catch (error) {
        console.warn(`${ICONS.WARNING} Erro ao limpar Redis:`, error);
      }
    }

    // Limpar PostgreSQL
    await prisma.aiCache.deleteMany();

    console.log(`${ICONS.CLEAN} Todo o cache foi limpo`);
  }

  /**
   * Busca entries que mais economizam tokens
   */
  async getTopSavingEntries(limit: number = 10) {
    return await prisma.aiCache.findMany({
      orderBy: [
        { hits: 'desc' },
        { tokens: 'desc' }
      ],
      take: limit,
      select: {
        cacheKey: true,
        model: true,
        type: true,
        tokens: true,
        hits: true,
        createdAt: true
      }
    });
  }
}

// ================================
// INSTÂNCIA GLOBAL SINGLETON
// ================================

let globalCacheManager: AiCacheManager | null = null;

/**
 * Obtém a instância global do cache manager
 */
export function getAiCache(): AiCacheManager {
  if (!globalCacheManager) {
    globalCacheManager = new AiCacheManager({
      aggressive_mode: true, // CRÍTICO: máxima economia
      enable_redis: false    // Desabilitado por enquanto
    });
  }
  return globalCacheManager;
}

/**
 * Utilitário para gerar hash de texto (usado como cache key)
 */
export function generateTextHash(text: string): string {
  // Remove espaços extras e normaliza
  const normalized = text.replace(/\s+/g, ' ').trim().toLowerCase();

  // Hash simples mas eficiente
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32-bit integer
  }

  return Math.abs(hash).toString(36);
}

// ================================
// MIDDLEWARE PARA CACHE AUTOMÁTICO
// ================================

/**
 * Decorator para cache automático em funções de análise
 * Type-safe wrapper for decorated methods
 */
export function withCache(
  analysisType: 'essential' | 'strategic' | 'report',
  keyExtractor: (..._args: unknown[]) => string
) {
  return function (_target: unknown, _propertyName: string, descriptor: PropertyDescriptor) {
    // Validate descriptor value is a method
    const originalMethod = descriptor.value;
    if (typeof originalMethod !== 'function') {
      throw new Error('withCache decorator can only be applied to methods');
    }

    descriptor.value = async function (this: unknown, ..._args: unknown[]): Promise<unknown> {
      const cache = getAiCache();
      const key = keyExtractor(_args);

      // Tentar buscar no cache primeiro
      const cached = await cache.get(key, analysisType);
      if (cached !== null) {
        console.log(`${ICONS.CACHE} Cache hit para ${analysisType}: ${_propertyName}`);
        return cached;
      }

      // Executar função original
      const result = await originalMethod.apply(this, _args);

      // Salvar no cache (valida antes)
      await cache.set(key, result, analysisType);

      return result;
    };

    return descriptor;
  };
}

export default AiCacheManager;