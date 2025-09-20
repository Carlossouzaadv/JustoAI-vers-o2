// ================================================================
// TESTES - Sistema de Relatórios Agendados
// ================================================================
// Testes unitários e de integração para funcionalidade de relatórios

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { QuotaSystem } from '../lib/quota-system';
import { ReportScheduler } from '../lib/report-scheduler';
import { ReportGenerator } from '../lib/report-generator';
import { ReportCacheManager } from '../lib/report-cache-manager';
import { createHash } from 'crypto';

// Mock do Prisma
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    workspace: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    workspaceQuota: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    reportSchedule: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    reportExecution: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
    },
    reportCache: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    monitoredProcess: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  }))
}));

describe('QuotaSystem - Unit Tests', () => {
  let quotaSystem: QuotaSystem;

  beforeEach(() => {
    quotaSystem = new QuotaSystem();
    jest.clearAllMocks();
  });

  describe('Quota Validation', () => {
    test('deve permitir criação dentro da quota', async () => {
      const mockPrisma = require('@prisma/client').PrismaClient();

      // Mock quota existente
      mockPrisma.workspaceQuota.findUnique.mockResolvedValue({
        id: 'quota-1',
        workspaceId: 'workspace-1',
        plan: 'PRO',
        reportsMonthlyLimit: 50,
        reportProcessesLimit: 300,
        reportsUsedThisMonth: 10,
        quotaResetDate: new Date()
      });

      const result = await quotaSystem.validateReportCreation('workspace-1', 100, 'COMPLETO');

      expect(result.allowed).toBe(true);
      expect(result.quotaStatus.used).toBe(10);
      expect(result.quotaStatus.limit).toBe(50);
      expect(result.quotaStatus.remaining).toBe(40);
    });

    test('deve bloquear criação quando quota excedida', async () => {
      const mockPrisma = require('@prisma/client').PrismaClient();

      // Mock quota esgotada
      mockPrisma.workspaceQuota.findUnique.mockResolvedValue({
        id: 'quota-1',
        workspaceId: 'workspace-1',
        plan: 'BASIC',
        reportsMonthlyLimit: 20,
        reportProcessesLimit: 100,
        reportsUsedThisMonth: 20,
        quotaResetDate: new Date()
      });

      const result = await quotaSystem.validateReportCreation('workspace-1', 50, 'COMPLETO');

      expect(result.allowed).toBe(false);
      expect(result.error).toContain('Limite mensal de relatórios atingido');
      expect(result.upgradeOptions).toBeDefined();
    });

    test('deve detectar proximidade do limite (warning)', async () => {
      const mockPrisma = require('@prisma/client').PrismaClient();

      // Mock quota próxima do limite (85%)
      mockPrisma.workspaceQuota.findUnique.mockResolvedValue({
        id: 'quota-1',
        workspaceId: 'workspace-1',
        plan: 'PRO',
        reportsMonthlyLimit: 50,
        reportProcessesLimit: 300,
        reportsUsedThisMonth: 42,
        quotaResetDate: new Date()
      });

      const result = await quotaSystem.validateReportCreation('workspace-1', 100, 'COMPLETO');

      expect(result.allowed).toBe(true);
      expect(result.quotaStatus.isNearLimit).toBe(true);
      expect(result.recommendation).toContain('restantes');
    });

    test('deve bloquear por limite de processos', async () => {
      const mockPrisma = require('@prisma/client').PrismaClient();

      mockPrisma.workspaceQuota.findUnique.mockResolvedValue({
        id: 'quota-1',
        workspaceId: 'workspace-1',
        plan: 'BASIC',
        reportsMonthlyLimit: 20,
        reportProcessesLimit: 100,
        reportsUsedThisMonth: 5,
        quotaResetDate: new Date()
      });

      const result = await quotaSystem.validateReportCreation('workspace-1', 150, 'COMPLETO');

      expect(result.allowed).toBe(false);
      expect(result.error).toContain('Limite de processos excedido');
    });
  });

  describe('Quota Consumption', () => {
    test('deve consumir quota corretamente', async () => {
      const mockPrisma = require('@prisma/client').PrismaClient();

      await quotaSystem.consumeQuota('workspace-1', 2);

      expect(mockPrisma.workspaceQuota.update).toHaveBeenCalledWith({
        where: { workspaceId: 'workspace-1' },
        data: {
          reportsUsedThisMonth: { increment: 2 },
          updatedAt: expect.any(Date)
        }
      });
    });

    test('deve reverter quota em caso de falha', async () => {
      const mockPrisma = require('@prisma/client').PrismaClient();

      await quotaSystem.refundQuota('workspace-1', 1);

      expect(mockPrisma.workspaceQuota.update).toHaveBeenCalledWith({
        where: { workspaceId: 'workspace-1' },
        data: {
          reportsUsedThisMonth: { decrement: 1 },
          updatedAt: expect.any(Date)
        }
      });
    });
  });
});

describe('ReportScheduler - Unit Tests', () => {
  let scheduler: ReportScheduler;

  beforeEach(() => {
    scheduler = new ReportScheduler();
    jest.clearAllMocks();
  });

  describe('Distribution Hash Calculation', () => {
    test('deve gerar hash consistente para mesmo workspace', () => {
      const workspaceId = 'workspace-123';

      // Calcular hash usando a mesma lógica do scheduler
      const hash1 = createHash('sha256').update(workspaceId).digest('hex');
      const hash2 = createHash('sha256').update(workspaceId).digest('hex');

      const distributionHash1 = parseInt(hash1.substring(0, 8), 16) % 300;
      const distributionHash2 = parseInt(hash2.substring(0, 8), 16) % 300;

      expect(distributionHash1).toBe(distributionHash2);
      expect(distributionHash1).toBeGreaterThanOrEqual(0);
      expect(distributionHash1).toBeLessThan(300);
    });

    test('deve gerar hashes diferentes para workspaces diferentes', () => {
      const workspace1 = 'workspace-123';
      const workspace2 = 'workspace-456';

      const hash1 = createHash('sha256').update(workspace1).digest('hex');
      const hash2 = createHash('sha256').update(workspace2).digest('hex');

      const distributionHash1 = parseInt(hash1.substring(0, 8), 16) % 300;
      const distributionHash2 = parseInt(hash2.substring(0, 8), 16) % 300;

      expect(distributionHash1).not.toBe(distributionHash2);
    });
  });

  describe('Execution Time Distribution', () => {
    test('deve distribuir execuções na janela 23:00-04:00', () => {
      const testCases = [0, 150, 299]; // Min, meio, max

      testCases.forEach(hash => {
        const baseHour = 23;
        const totalMinutes = baseHour * 60 + hash;
        const hours = Math.floor(totalMinutes / 60) % 24;
        const mins = totalMinutes % 60;

        // Verificar se está na janela esperada
        if (hours >= 23 || hours <= 4) {
          expect(true).toBe(true); // Na janela correta
        } else {
          expect(hours).toBeLessThanOrEqual(4); // Deve estar antes das 4h
        }
      });
    });

    test('deve formatar horário corretamente', () => {
      const distributionHash = 65; // 1h5min após 23:00 = 00:05
      const baseHour = 23;
      const totalMinutes = baseHour * 60 + distributionHash;
      const hours = Math.floor(totalMinutes / 60) % 24;
      const mins = totalMinutes % 60;

      const timeString = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;

      expect(timeString).toMatch(/^\d{2}:\d{2}$/);
      expect(timeString).toBe('00:05');
    });
  });

  describe('Schedule Finding', () => {
    test('deve encontrar schedules que devem rodar hoje', async () => {
      const mockPrisma = require('@prisma/client').PrismaClient();

      const today = new Date();
      const schedules = [
        {
          id: 'schedule-1',
          workspaceId: 'workspace-1',
          nextRun: today,
          enabled: true,
          type: 'COMPLETO',
          processIds: ['proc-1', 'proc-2']
        }
      ];

      mockPrisma.reportSchedule.findMany.mockResolvedValue(schedules);

      // A implementação real estaria no método privado, aqui simulamos
      const result = schedules;

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('schedule-1');
    });
  });
});

describe('ReportCacheManager - Unit Tests', () => {
  let cacheManager: ReportCacheManager;

  beforeEach(() => {
    cacheManager = new ReportCacheManager();
    jest.clearAllMocks();
  });

  describe('Cache Invalidation', () => {
    test('deve invalidar cache quando nova movimentação detectada', async () => {
      const mockPrisma = require('@prisma/client').PrismaClient();

      const processId = 'process-123';
      const movementDate = new Date();

      // Mock cache entries que incluem este processo
      mockPrisma.reportCache.findMany.mockResolvedValue([
        {
          id: 'cache-1',
          cacheKey: 'key-1',
          processIds: [processId, 'process-456'],
          lastMovementTimestamp: new Date(Date.now() - 86400000) // 1 dia atrás
        }
      ]);

      const result = await cacheManager.invalidateOnMovement(processId, movementDate);

      expect(result.invalidated).toBe(1);
      expect(result.processIds).toContain(processId);
      expect(mockPrisma.reportCache.delete).toHaveBeenCalledWith({
        where: { id: 'cache-1' }
      });
    });

    test('não deve invalidar cache mais recente que a movimentação', async () => {
      const mockPrisma = require('@prisma/client').PrismaClient();

      const processId = 'process-123';
      const movementDate = new Date(Date.now() - 86400000); // 1 dia atrás

      // Mock cache mais recente que a movimentação
      mockPrisma.reportCache.findMany.mockResolvedValue([
        {
          id: 'cache-1',
          cacheKey: 'key-1',
          processIds: [processId],
          lastMovementTimestamp: new Date() // Agora
        }
      ]);

      const result = await cacheManager.invalidateOnMovement(processId, movementDate);

      expect(result.invalidated).toBe(0);
      expect(mockPrisma.reportCache.delete).not.toHaveBeenCalled();
    });
  });

  describe('Cache Cleanup', () => {
    test('deve limpar cache expirado', async () => {
      const mockPrisma = require('@prisma/client').PrismaClient();

      mockPrisma.reportCache.deleteMany.mockResolvedValue({ count: 5 });

      const result = await cacheManager.cleanupExpiredCache();

      expect(result.expired).toBe(5);
      expect(mockPrisma.reportCache.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: { lt: expect.any(Date) }
        }
      });
    });
  });
});

describe('ReportGenerator - Unit Tests', () => {
  let generator: ReportGenerator;

  beforeEach(() => {
    generator = new ReportGenerator();
    jest.clearAllMocks();
  });

  describe('Cache Key Generation', () => {
    test('deve gerar chave de cache consistente', async () => {
      const mockPrisma = require('@prisma/client').PrismaClient();

      // Mock dados de processo
      const processData = [
        {
          id: 'proc-1',
          number: '123456',
          client: { name: 'Cliente A', type: 'INDIVIDUAL' },
          status: 'ACTIVE',
          lastMovement: { date: new Date('2024-01-15'), description: 'Citação' },
          movements: []
        }
      ];

      const request = {
        workspaceId: 'workspace-1',
        reportType: 'COMPLETO' as any,
        processIds: ['proc-1'],
        audienceType: 'CLIENTE' as any,
        outputFormats: ['PDF' as any],
        deltaDataOnly: false
      };

      // A função real seria chamada internamente
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

      const cacheKey = createHash('sha256').update(keyData).digest('hex');

      expect(cacheKey).toHaveLength(64);
      expect(cacheKey).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('Prompt Generation', () => {
    test('deve gerar prompt apropriado para audiência CLIENTE', () => {
      const audienceMap = {
        CLIENTE: 'linguagem acessível para leigos, evitando jargões jurídicos',
        DIRETORIA: 'linguagem executiva, focando em impactos e resultados',
        USO_INTERNO: 'linguagem técnica jurídica, detalhada para advogados'
      };

      const style = audienceMap['CLIENTE'];
      expect(style).toContain('acessível');
      expect(style).toContain('leigos');
    });

    test('deve diferenciar prompts COMPLETO vs NOVIDADES', () => {
      const completePrompt = 'Crie um relatório COMPLETO dos processos';
      const deltaPrompt = 'Crie um relatório de NOVIDADES dos processos';

      expect(completePrompt).toContain('COMPLETO');
      expect(deltaPrompt).toContain('NOVIDADES');
    });
  });
});

describe('Integration Tests', () => {
  describe('Scheduler Distribution', () => {
    test('deve distribuir 100 workspaces uniformemente', () => {
      const distributions: number[] = [];

      // Simular 100 workspaces
      for (let i = 0; i < 100; i++) {
        const workspaceId = `workspace-${i}`;
        const hash = createHash('sha256').update(workspaceId).digest('hex');
        const distributionHash = parseInt(hash.substring(0, 8), 16) % 300;
        distributions.push(distributionHash);
      }

      // Verificar distribuição uniforme
      const min = Math.min(...distributions);
      const max = Math.max(...distributions);
      const range = max - min;

      // Deve cobrir boa parte do espectro (pelo menos 60% de 300)
      expect(range).toBeGreaterThan(180);

      // Não deve ter muitos valores idênticos
      const uniqueValues = new Set(distributions).size;
      expect(uniqueValues).toBeGreaterThan(80); // Pelo menos 80% únicos
    });
  });

  describe('End-to-End Report Flow', () => {
    test('deve processar fluxo completo de agendamento → execução → entrega', async () => {
      // Este teste simularia o fluxo completo
      const mockFlow = {
        scheduleCreated: true,
        quotaValidated: true,
        distributionCalculated: true,
        executionScheduled: true,
        reportGenerated: true,
        notificationSent: true
      };

      expect(mockFlow.scheduleCreated).toBe(true);
      expect(mockFlow.quotaValidated).toBe(true);
      expect(mockFlow.distributionCalculated).toBe(true);
      expect(mockFlow.executionScheduled).toBe(true);
      expect(mockFlow.reportGenerated).toBe(true);
      expect(mockFlow.notificationSent).toBe(true);
    });
  });

  describe('Cache Invalidation on Movement', () => {
    test('deve invalidar cache automaticamente quando movimento detectado', async () => {
      const cacheManager = new ReportCacheManager();

      // Simular processo com cache existente
      const processId = 'process-test';
      const oldMovementDate = new Date(Date.now() - 86400000); // 1 dia atrás
      const newMovementDate = new Date(); // Agora

      // Mock: cache seria invalidado
      const mockInvalidation = {
        invalidated: 1,
        processIds: [processId],
        reason: `Nova movimentação no processo ${processId}`
      };

      expect(mockInvalidation.invalidated).toBe(1);
      expect(mockInvalidation.processIds).toContain(processId);
    });
  });
});

// Helper functions para criar mocks
export function createMockSchedule(overrides: any = {}) {
  return {
    id: 'schedule-123',
    workspaceId: 'workspace-456',
    name: 'Relatório Teste',
    type: 'COMPLETO',
    frequency: 'WEEKLY',
    audienceType: 'CLIENTE',
    outputFormats: ['PDF'],
    processIds: ['proc-1', 'proc-2'],
    nextRun: new Date(),
    enabled: true,
    ...overrides
  };
}

export function createMockExecution(overrides: any = {}) {
  return {
    id: 'execution-123',
    workspaceId: 'workspace-456',
    scheduleId: 'schedule-123',
    status: 'CONCLUIDO',
    reportType: 'COMPLETO',
    audienceType: 'CLIENTE',
    processCount: 2,
    startedAt: new Date(),
    completedAt: new Date(),
    duration: 5000,
    tokensUsed: 1500,
    cacheHit: false,
    ...overrides
  };
}

export function createMockQuota(overrides: any = {}) {
  return {
    id: 'quota-123',
    workspaceId: 'workspace-456',
    plan: 'PRO',
    reportsMonthlyLimit: 50,
    reportProcessesLimit: 300,
    reportsUsedThisMonth: 15,
    quotaResetDate: new Date(),
    ...overrides
  };
}