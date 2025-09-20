// ================================================================
// TESTES UNITÁRIOS - Sistema de Cache de Análise
// ================================================================

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AnalysisCacheManager } from '../lib/analysis-cache';

// Mock Redis
const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
  ttl: jest.fn(),
  keys: jest.fn(),
  disconnect: jest.fn(),
  on: jest.fn(),
  memory: jest.fn()
};

// Mock do constructor Redis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedis);
});

describe('AnalysisCacheManager', () => {
  let cacheManager: AnalysisCacheManager;

  beforeEach(() => {
    jest.clearAllMocks();
    cacheManager = new AnalysisCacheManager();
  });

  describe('generateAnalysisKey', () => {
    it('deve gerar chaves consistentes para mesmos inputs', () => {
      const textShas = ['hash1', 'hash2', 'hash3'];
      const modelVersion = 'gemini-1.5-pro';
      const promptSignature = 'prompt123';
      const lastMovementDate = new Date('2024-01-15T10:00:00Z');

      // Gerar chave duas vezes com mesmos parâmetros
      const key1 = (cacheManager as any).generateAnalysisKey(
        textShas, modelVersion, promptSignature, lastMovementDate
      );
      const key2 = (cacheManager as any).generateAnalysisKey(
        textShas, modelVersion, promptSignature, lastMovementDate
      );

      expect(key1).toBe(key2);
      expect(key1).toMatch(/^[a-f0-9]{64}$/); // Hash SHA256
    });

    it('deve gerar chaves diferentes para hashes em ordem diferente', () => {
      const textShas1 = ['hash1', 'hash2', 'hash3'];
      const textShas2 = ['hash3', 'hash1', 'hash2']; // Mesmos hashes, ordem diferente
      const modelVersion = 'gemini-1.5-pro';
      const promptSignature = 'prompt123';

      const key1 = (cacheManager as any).generateAnalysisKey(textShas1, modelVersion, promptSignature);
      const key2 = (cacheManager as any).generateAnalysisKey(textShas2, modelVersion, promptSignature);

      // Devem ser iguais porque internamente os hashes são ordenados
      expect(key1).toBe(key2);
    });

    it('deve gerar chaves diferentes quando há nova movimentação', () => {
      const textShas = ['hash1', 'hash2'];
      const modelVersion = 'gemini-1.5-pro';
      const promptSignature = 'prompt123';
      const date1 = new Date('2024-01-15T10:00:00Z');
      const date2 = new Date('2024-01-16T10:00:00Z');

      const key1 = (cacheManager as any).generateAnalysisKey(textShas, modelVersion, promptSignature, date1);
      const key2 = (cacheManager as any).generateAnalysisKey(textShas, modelVersion, promptSignature, date2);

      expect(key1).not.toBe(key2);
    });
  });

  describe('checkAnalysisCache', () => {
    it('deve retornar cache hit quando encontrado e válido', async () => {
      const textShas = ['hash1', 'hash2'];
      const modelVersion = 'gemini-1.5-pro';
      const promptSignature = 'prompt123';
      const lastMovementDate = new Date('2024-01-15T10:00:00Z');

      const mockCacheData = {
        result: { summary: 'Análise cached' },
        cachedAt: new Date('2024-01-16T10:00:00Z').toISOString() // Após última movimentação
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(mockCacheData));
      mockRedis.ttl.mockResolvedValue(3600);

      const result = await cacheManager.checkAnalysisCache(
        textShas, modelVersion, promptSignature, lastMovementDate
      );

      expect(result.hit).toBe(true);
      expect(result.data).toEqual(mockCacheData.result);
    });

    it('deve invalidar cache quando há movimentação mais recente', async () => {
      const textShas = ['hash1', 'hash2'];
      const modelVersion = 'gemini-1.5-pro';
      const promptSignature = 'prompt123';
      const lastMovementDate = new Date('2024-01-16T10:00:00Z'); // Movimentação após cache

      const mockCacheData = {
        result: { summary: 'Análise cached' },
        cachedAt: new Date('2024-01-15T10:00:00Z').toISOString() // Cache antes da movimentação
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(mockCacheData));
      mockRedis.del.mockResolvedValue(1);

      const result = await cacheManager.checkAnalysisCache(
        textShas, modelVersion, promptSignature, lastMovementDate
      );

      expect(result.hit).toBe(false);
      expect(mockRedis.del).toHaveBeenCalled(); // Cache deve ser removido
    });

    it('deve retornar miss quando cache não encontrado', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await cacheManager.checkAnalysisCache(
        ['hash1'], 'gemini-1.5-pro', 'prompt123'
      );

      expect(result.hit).toBe(false);
      expect(result.key).toBeTruthy();
    });
  });

  describe('saveAnalysisCache', () => {
    it('deve salvar análise no cache com TTL correto', async () => {
      const textShas = ['hash1', 'hash2'];
      const modelVersion = 'gemini-1.5-pro';
      const promptSignature = 'prompt123';
      const analysisResult = { summary: 'Nova análise' };
      const lastMovementDate = new Date('2024-01-15T10:00:00Z');

      mockRedis.setex.mockResolvedValue('OK');

      const result = await cacheManager.saveAnalysisCache(
        textShas, modelVersion, promptSignature, analysisResult, lastMovementDate
      );

      expect(result).toBe(true);
      expect(mockRedis.setex).toHaveBeenCalled();

      const setexCall = mockRedis.setex.mock.calls[0];
      expect(setexCall[0]).toMatch(/^analysis:/); // Chave de cache
      expect(setexCall[1]).toBe(7 * 24 * 60 * 60); // TTL de 7 dias

      const savedData = JSON.parse(setexCall[2]);
      expect(savedData.result).toEqual(analysisResult);
      expect(savedData.textShas).toEqual(textShas);
    });
  });

  describe('acquireLock', () => {
    it('deve adquirir lock com sucesso', async () => {
      const analysisKey = 'test-analysis-key';
      mockRedis.set.mockResolvedValue('OK');

      const result = await cacheManager.acquireLock(analysisKey);

      expect(result.acquired).toBe(true);
      expect(result.lockKey).toBe(`lock:analysis:${analysisKey}`);
      expect(mockRedis.set).toHaveBeenCalledWith(
        `lock:analysis:${analysisKey}`,
        expect.any(String),
        'EX',
        300, // 5 minutos
        'NX'
      );
    });

    it('deve falhar quando lock já existe', async () => {
      const analysisKey = 'test-analysis-key';
      mockRedis.set.mockResolvedValue(null); // Lock já existe
      mockRedis.ttl.mockResolvedValue(120); // 2 minutos restantes

      const result = await cacheManager.acquireLock(analysisKey);

      expect(result.acquired).toBe(false);
      expect(result.ttl).toBe(120);
    });
  });

  describe('releaseLock', () => {
    it('deve liberar lock corretamente', async () => {
      const lockKey = 'lock:analysis:test-key';
      mockRedis.del.mockResolvedValue(1);

      const result = await cacheManager.releaseLock(lockKey);

      expect(result).toBe(true);
      expect(mockRedis.del).toHaveBeenCalledWith(lockKey);
    });
  });

  describe('getLastMovementDate', () => {
    it('deve buscar última movimentação corretamente', async () => {
      const processId = 'process-123';
      const lastMovementDate = new Date('2024-01-15T10:00:00Z');

      const mockPrisma = {
        processMovement: {
          findFirst: jest.fn().mockResolvedValue({
            date: lastMovementDate
          })
        }
      };

      const result = await cacheManager.getLastMovementDate(processId, mockPrisma);

      expect(result).toEqual(lastMovementDate);
      expect(mockPrisma.processMovement.findFirst).toHaveBeenCalledWith({
        where: {
          monitoredProcess: { caseId: processId }
        },
        orderBy: { date: 'desc' },
        select: { date: true }
      });
    });

    it('deve retornar null quando não há movimentações', async () => {
      const processId = 'process-123';

      const mockPrisma = {
        processMovement: {
          findFirst: jest.fn().mockResolvedValue(null)
        }
      };

      const result = await cacheManager.getLastMovementDate(processId, mockPrisma);

      expect(result).toBeNull();
    });
  });

  describe('getProcessDocumentHashes', () => {
    it('deve buscar hashes de documentos e ordenar', async () => {
      const processId = 'process-123';
      const mockDocuments = [
        { textSha: 'hash3' },
        { textSha: 'hash1' },
        { textSha: 'hash2' },
        { textSha: null } // Deve ser filtrado
      ];

      const mockPrisma = {
        caseDocument: {
          findMany: jest.fn().mockResolvedValue(mockDocuments)
        }
      };

      const result = await cacheManager.getProcessDocumentHashes(processId, mockPrisma);

      expect(result).toEqual(['hash1', 'hash2', 'hash3']); // Ordenado e filtrado
      expect(mockPrisma.caseDocument.findMany).toHaveBeenCalledWith({
        where: {
          caseId: processId,
          textSha: { not: null }
        },
        select: { textSha: true }
      });
    });
  });

  describe('getCacheStats', () => {
    it('deve retornar estatísticas corretas', async () => {
      mockRedis.keys.mockImplementation((pattern: string) => {
        if (pattern === 'analysis:*') return Promise.resolve(['analysis:key1', 'analysis:key2']);
        if (pattern === 'text:*') return Promise.resolve(['text:key1']);
        return Promise.resolve([]);
      });
      mockRedis.memory.mockResolvedValue(1048576); // 1MB

      const stats = await cacheManager.getCacheStats();

      expect(stats.analysis_entries).toBe(2);
      expect(stats.text_entries).toBe(1);
      expect(stats.memory_usage_mb).toBe(1);
      expect(stats.ttl_config.analysis_cache_days).toBe(7);
    });
  });
});

describe('Cache Integration Tests', () => {
  it('deve demonstrar fluxo completo de cache', async () => {
    const cacheManager = new AnalysisCacheManager();
    const textShas = ['doc1', 'doc2'];
    const modelVersion = 'gemini-1.5-pro';
    const promptSignature = 'test-prompt';
    const lastMovementDate = new Date('2024-01-15T10:00:00Z');

    // Mock Redis responses
    mockRedis.get.mockResolvedValue(null); // Cache miss inicial
    mockRedis.setex.mockResolvedValue('OK');
    mockRedis.set.mockResolvedValue('OK'); // Lock acquired

    // 1. Verificar cache (miss)
    const cacheCheck = await cacheManager.checkAnalysisCache(
      textShas, modelVersion, promptSignature, lastMovementDate
    );
    expect(cacheCheck.hit).toBe(false);

    // 2. Adquirir lock
    const lockResult = await cacheManager.acquireLock(cacheCheck.key);
    expect(lockResult.acquired).toBe(true);

    // 3. Salvar resultado no cache
    const analysisResult = { summary: 'Análise completa' };
    const saveResult = await cacheManager.saveAnalysisCache(
      textShas, modelVersion, promptSignature, analysisResult, lastMovementDate
    );
    expect(saveResult).toBe(true);

    // 4. Liberar lock
    mockRedis.del.mockResolvedValue(1);
    const releaseResult = await cacheManager.releaseLock(lockResult.lockKey);
    expect(releaseResult).toBe(true);

    // 5. Verificar cache novamente (hit)
    mockRedis.get.mockResolvedValue(JSON.stringify({
      result: analysisResult,
      cachedAt: new Date('2024-01-16T10:00:00Z').toISOString()
    }));
    mockRedis.ttl.mockResolvedValue(3600);

    const cacheCheck2 = await cacheManager.checkAnalysisCache(
      textShas, modelVersion, promptSignature, lastMovementDate
    );
    expect(cacheCheck2.hit).toBe(true);
    expect(cacheCheck2.data).toEqual(analysisResult);
  });
});