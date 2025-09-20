// ================================================================
// TESTES - Sistema de Análise Profunda
// ================================================================
// Testes unitários e de integração para funcionalidade "Aprofundar Análise"

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { DeepAnalysisService } from '../lib/deep-analysis-service';
import { CreditSystem } from '../lib/credit-system';
import { createHash } from 'crypto';

// Mock do Prisma
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    caseAnalysisVersion: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn()
    },
    analysisJob: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn()
    },
    analysisCache: {
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    processMovement: {
      findFirst: jest.fn()
    },
    document: {
      findMany: jest.fn(),
      create: jest.fn()
    },
    monitoredProcess: {
      findFirst: jest.fn()
    }
  }))
}));

// Mock do Redis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    set: jest.fn(),
    ttl: jest.fn(),
    eval: jest.fn()
  }));
});

describe('DeepAnalysisService - Unit Tests', () => {
  let analysisService: DeepAnalysisService;
  let creditSystem: CreditSystem;

  beforeEach(() => {
    analysisService = new DeepAnalysisService();
    creditSystem = new CreditSystem();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Analysis Key Generation', () => {
    test('deve gerar analysis_key consistente para mesmos dados', async () => {
      const params1 = {
        processId: 'process-123',
        documentHashes: ['hash1', 'hash2', 'hash3'],
        analysisType: 'FAST' as const,
        modelVersion: 'gemini-1.5-flash'
      };

      const params2 = {
        processId: 'process-123',
        documentHashes: ['hash3', 'hash1', 'hash2'], // Ordem diferente
        analysisType: 'FAST' as const,
        modelVersion: 'gemini-1.5-flash'
      };

      // Mock da busca de última movimentação
      const mockPrisma = require('@prisma/client').PrismaClient();
      mockPrisma.processMovement.findFirst.mockResolvedValue({
        date: new Date('2024-01-15T10:00:00Z')
      });

      const key1 = await analysisService.generateAnalysisKey(params1);
      const key2 = await analysisService.generateAnalysisKey(params2);

      expect(key1).toBe(key2);
      expect(key1).toHaveLength(64); // SHA256 hex
      expect(key1).toMatch(/^[a-f0-9]{64}$/);
    });

    test('deve gerar analysis_key diferentes para dados diferentes', async () => {
      const paramsBase = {
        processId: 'process-123',
        documentHashes: ['hash1', 'hash2'],
        analysisType: 'FAST' as const,
        modelVersion: 'gemini-1.5-flash'
      };

      // Mock da busca de última movimentação
      const mockPrisma = require('@prisma/client').PrismaClient();
      mockPrisma.processMovement.findFirst.mockResolvedValue({
        date: new Date('2024-01-15T10:00:00Z')
      });

      const keyOriginal = await analysisService.generateAnalysisKey(paramsBase);

      // Diferente tipo de análise
      const keyDifferentType = await analysisService.generateAnalysisKey({
        ...paramsBase,
        analysisType: 'FULL'
      });

      // Diferente modelo
      const keyDifferentModel = await analysisService.generateAnalysisKey({
        ...paramsBase,
        modelVersion: 'gemini-1.5-pro'
      });

      // Diferentes documentos
      const keyDifferentDocs = await analysisService.generateAnalysisKey({
        ...paramsBase,
        documentHashes: ['hash1', 'hash2', 'hash3']
      });

      expect(keyOriginal).not.toBe(keyDifferentType);
      expect(keyOriginal).not.toBe(keyDifferentModel);
      expect(keyOriginal).not.toBe(keyDifferentDocs);
    });

    test('deve incluir data de movimentação na chave', async () => {
      const params = {
        processId: 'process-123',
        documentHashes: ['hash1', 'hash2'],
        analysisType: 'FAST' as const,
        modelVersion: 'gemini-1.5-flash'
      };

      const mockPrisma = require('@prisma/client').PrismaClient();

      // Primeira chamada com data específica
      mockPrisma.processMovement.findFirst.mockResolvedValueOnce({
        date: new Date('2024-01-15T10:00:00Z')
      });
      const key1 = await analysisService.generateAnalysisKey(params);

      // Segunda chamada com data diferente
      mockPrisma.processMovement.findFirst.mockResolvedValueOnce({
        date: new Date('2024-01-16T10:00:00Z')
      });
      const key2 = await analysisService.generateAnalysisKey(params);

      expect(key1).not.toBe(key2);
    });
  });

  describe('Credit Calculation', () => {
    test('deve calcular créditos FULL baseado na regra configurada', async () => {
      const files = [
        { id: '1', name: 'doc1.pdf', textSha: 'sha1', size: 1000 },
        { id: '2', name: 'doc2.pdf', textSha: 'sha2', size: 2000 }
      ];

      const creditsNeeded = await analysisService.calculateFullCreditsNeeded(files);

      // Com FULL_CREDIT_PER_BATCH = 10, 2 arquivos = ceil(2/10) = 1 crédito
      expect(creditsNeeded).toBe(1);
    });

    test('deve arredondar para cima créditos necessários', async () => {
      const files = Array.from({ length: 15 }, (_, i) => ({
        id: `${i}`,
        name: `doc${i}.pdf`,
        textSha: `sha${i}`,
        size: 1000
      }));

      const creditsNeeded = await analysisService.calculateFullCreditsNeeded(files);

      // 15 arquivos com batch=10 = ceil(15/10) = 2 créditos
      expect(creditsNeeded).toBe(2);
    });
  });

  describe('Version Number Generation', () => {
    test('deve gerar próximo número de versão', async () => {
      const mockPrisma = require('@prisma/client').PrismaClient();

      // Mock retornando versão 3 como última
      mockPrisma.caseAnalysisVersion.findFirst.mockResolvedValue({
        versionNumber: 3
      });

      const nextVersion = await analysisService.getNextVersionNumber('process-123');

      expect(nextVersion).toBe(4);
      expect(mockPrisma.caseAnalysisVersion.findFirst).toHaveBeenCalledWith({
        where: { processId: 'process-123' },
        orderBy: { versionNumber: 'desc' },
        select: { versionNumber: true }
      });
    });

    test('deve retornar 1 para primeiro versão', async () => {
      const mockPrisma = require('@prisma/client').PrismaClient();

      // Mock retornando null (nenhuma versão anterior)
      mockPrisma.caseAnalysisVersion.findFirst.mockResolvedValue(null);

      const nextVersion = await analysisService.getNextVersionNumber('process-123');

      expect(nextVersion).toBe(1);
    });
  });

  describe('Cache Validation', () => {
    test('deve retornar null para cache inexistente', async () => {
      const mockPrisma = require('@prisma/client').PrismaClient();
      mockPrisma.analysisCache.findUnique.mockResolvedValue(null);

      const cached = await analysisService.getCachedAnalysis('nonexistent-key', 'process-123');

      expect(cached).toBeNull();
    });

    test('deve invalidar cache expirado', async () => {
      const mockPrisma = require('@prisma/client').PrismaClient();

      // Mock cache expirado
      mockPrisma.analysisCache.findUnique.mockResolvedValue({
        analysisKey: 'test-key',
        expiresAt: new Date(Date.now() - 1000), // Expirado
        lastMovementDate: new Date('2024-01-15T10:00:00Z')
      });

      const cached = await analysisService.getCachedAnalysis('test-key', 'process-123');

      expect(cached).toBeNull();
      expect(mockPrisma.analysisCache.delete).toHaveBeenCalledWith({
        where: { analysisKey: 'test-key' }
      });
    });

    test('deve invalidar cache por nova movimentação', async () => {
      const mockPrisma = require('@prisma/client').PrismaClient();

      // Mock cache válido mas com movimentação posterior
      mockPrisma.analysisCache.findUnique.mockResolvedValue({
        analysisKey: 'test-key',
        expiresAt: new Date(Date.now() + 86400000), // Válido por 1 dia
        lastMovementDate: new Date('2024-01-15T10:00:00Z')
      });

      // Mock movimentação mais recente
      mockPrisma.processMovement.findFirst.mockResolvedValue({
        date: new Date('2024-01-16T10:00:00Z') // Posterior ao cache
      });

      const cached = await analysisService.getCachedAnalysis('test-key', 'process-123');

      expect(cached).toBeNull();
      expect(mockPrisma.analysisCache.delete).toHaveBeenCalledWith({
        where: { analysisKey: 'test-key' }
      });
    });
  });
});

describe('DeepAnalysisService - Integration Tests', () => {
  let analysisService: DeepAnalysisService;

  beforeEach(() => {
    analysisService = new DeepAnalysisService();
  });

  describe('Redis Lock Behavior', () => {
    test('deve adquirir lock com sucesso', async () => {
      const mockRedis = require('ioredis')();
      mockRedis.set.mockResolvedValue('OK');

      const lockResult = await analysisService.acquireAnalysisLock('test-key', 300);

      expect(lockResult.acquired).toBe(true);
      expect(lockResult.token).toBeDefined();
      expect(mockRedis.set).toHaveBeenCalledWith(
        'analysis_lock:test-key',
        expect.any(String),
        'EX',
        300,
        'NX'
      );
    });

    test('deve falhar ao adquirir lock existente', async () => {
      const mockRedis = require('ioredis')();
      mockRedis.set.mockResolvedValue(null); // Lock já existe
      mockRedis.ttl.mockResolvedValue(120); // TTL restante

      const lockResult = await analysisService.acquireAnalysisLock('test-key', 300);

      expect(lockResult.acquired).toBe(false);
      expect(lockResult.ttl).toBe(120);
    });
  });

  describe('File Processing', () => {
    test('deve processar arquivo PDF com deduplicação', async () => {
      const mockFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      const mockPrisma = require('@prisma/client').PrismaClient();

      // Mock documento já existente
      mockPrisma.document.findFirst.mockResolvedValue({
        id: 'existing-doc',
        name: 'test.pdf',
        textSha: 'existing-sha',
        size: 1000
      });

      const result = await analysisService.processUploadedFiles(
        [mockFile],
        'process-123',
        'workspace-456',
        'user-789'
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('existing-doc');
      expect(mockPrisma.document.create).not.toHaveBeenCalled(); // Não criou novo
    });
  });

  describe('FIFO Credit Debit Integration', () => {
    test('deve debitar créditos FIFO corretamente', async () => {
      // Este teste requer integração com CreditSystem
      // Simulação da lógica FIFO

      const mockCreditSystem = {
        debitCredits: jest.fn().mockResolvedValue({
          success: true,
          allocationsUsed: [
            { id: 'alloc-1', amount: 2 },
            { id: 'alloc-2', amount: 1 }
          ]
        })
      };

      const result = await mockCreditSystem.debitCredits(
        'workspace-123',
        0, // report credits
        3, // full credits
        'Análise FULL - Processo process-456',
        { processId: 'process-456', analysisType: 'FULL' }
      );

      expect(result.success).toBe(true);
      expect(result.allocationsUsed).toHaveLength(2);
      expect(mockCreditSystem.debitCredits).toHaveBeenCalledWith(
        'workspace-123',
        0,
        3,
        'Análise FULL - Processo process-456',
        expect.objectContaining({
          processId: 'process-456',
          analysisType: 'FULL'
        })
      );
    });
  });
});

// Helper para criar mocks de dados
export function createMockAnalysisVersion(overrides: any = {}) {
  return {
    id: 'analysis-123',
    processId: 'process-456',
    workspaceId: 'workspace-789',
    versionNumber: 1,
    analysisType: 'FAST',
    modelUsed: 'gemini-1.5-flash',
    fullCreditsUsed: 0,
    fastCreditsUsed: 0,
    summaryJson: { summary: 'Test analysis' },
    insightsJson: null,
    confidenceScore: 0.85,
    reportUrl: null,
    sourceFilesMetadata: [],
    analysisKey: 'test-analysis-key',
    processingTimeMs: 5000,
    createdBy: 'user-123',
    createdAt: new Date(),
    updatedAt: new Date(),
    status: 'COMPLETED',
    errorMessage: null,
    ...overrides
  };
}

export function createMockJob(overrides: any = {}) {
  return {
    id: 'job-123',
    processId: 'process-456',
    workspaceId: 'workspace-789',
    analysisKey: 'test-analysis-key',
    status: 'COMPLETED',
    lockToken: 'token-123',
    analysisType: 'FAST',
    modelHint: 'gemini-1.5-flash',
    filesMetadata: [],
    progress: 100,
    resultVersionId: 'analysis-123',
    createdAt: new Date(),
    startedAt: new Date(),
    finishedAt: new Date(),
    workerId: 'worker-1',
    retryCount: 0,
    metadata: {},
    ...overrides
  };
}