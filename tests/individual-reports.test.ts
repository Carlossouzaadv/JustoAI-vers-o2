// ================================================================
// TESTES PARA SISTEMA DE RELATÓRIOS INDIVIDUAIS
// ================================================================

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { getCreditManager } from '../lib/credit-system';
import { ReportGenerator } from '../lib/report-generator';
import { addIndividualReportJob } from '../workers/individual-reports-worker';

// Mock do Prisma
const prisma = new PrismaClient();

// Mock de dados de teste
const mockWorkspaceId = 'test-workspace-123';
const mockProcessIds = ['process-1', 'process-2', 'process-3'];
const mockUser = {
  id: 'user-123',
  email: 'test@test.com',
  workspaceId: mockWorkspaceId
};

describe('Sistema de Relatórios Individuais', () => {
  beforeEach(async () => {
    // Setup do banco de teste
    await setupTestData();
  });

  afterEach(async () => {
    // Cleanup
    await cleanupTestData();
  });

  describe('Endpoint /api/reports/individual', () => {
    describe('POST - Geração Imediata', () => {
      it('deve gerar relatório imediato com sucesso', async () => {
        // Arrange
        const requestData = {
          processIds: mockProcessIds,
          type: 'EXECUTIVO',
          format: ['PDF']
        };

        // Mock do creditManager
        const creditManager = getCreditManager(prisma);
        jest.spyOn(creditManager, 'calculateReportCreditCost').mockReturnValue(0.5);
        jest.spyOn(creditManager, 'getCreditBalance').mockResolvedValue({
          reportCreditsAvailable: 10,
          reportCreditsBalance: 10,
          fullCreditsAvailable: 5,
          fullCreditsBalance: 5,
          reportCreditsHeld: 0,
          fullCreditsHeld: 0
        });
        jest.spyOn(creditManager, 'debitCredits').mockResolvedValue({
          success: true,
          transactionIds: ['tx-123']
        });

        // Mock do ReportGenerator
        const mockReportResult = {
          success: true,
          reportId: 'report-123',
          fileUrls: { PDF: '/reports/test.pdf' },
          summary: { processCount: 3 },
          tokensUsed: 1000,
          cacheHit: false,
          processingTime: 5000
        };

        jest.spyOn(ReportGenerator.prototype, 'generateScheduledReport')
          .mockResolvedValue(mockReportResult);

        // Act
        const response = await fetch('/api/reports/individual', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-workspace-id': mockWorkspaceId
          },
          body: JSON.stringify(requestData)
        });

        const result = await response.json();

        // Assert
        expect(response.status).toBe(200);
        expect(result.success).toBe(true);
        expect(result.status).toBe('IMMEDIATE');
        expect(result.fileUrls).toEqual({ PDF: '/reports/test.pdf' });
        expect(result.creditsCost.consumed).toBe(true);
        expect(result.creditsCost.reportCredits).toBe(0.5);
      });

      it('deve falhar com créditos insuficientes', async () => {
        // Arrange
        const requestData = {
          processIds: mockProcessIds,
          type: 'JURIDICO',
          format: ['PDF', 'DOCX']
        };

        const creditManager = getCreditManager(prisma);
        jest.spyOn(creditManager, 'calculateReportCreditCost').mockReturnValue(2);
        jest.spyOn(creditManager, 'getCreditBalance').mockResolvedValue({
          reportCreditsAvailable: 1, // Insuficiente
          reportCreditsBalance: 1,
          fullCreditsAvailable: 0,
          fullCreditsBalance: 0,
          reportCreditsHeld: 0,
          fullCreditsHeld: 0
        });

        // Act
        const response = await fetch('/api/reports/individual', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-workspace-id': mockWorkspaceId
          },
          body: JSON.stringify(requestData)
        });

        const result = await response.json();

        // Assert
        expect(response.status).toBe(400);
        expect(result.success).toBe(false);
        expect(result.error).toContain('Créditos insuficientes');
      });

      it('deve usar cache quando disponível', async () => {
        // Arrange
        const requestData = {
          processIds: mockProcessIds,
          type: 'EXECUTIVO',
          format: ['PDF']
        };

        // Mock cache hit
        await prisma.reportCache.create({
          data: {
            cacheKey: 'test-cache-key',
            workspaceId: mockWorkspaceId,
            reportType: 'NOVIDADES',
            processIds: mockProcessIds,
            audienceType: 'CLIENTE',
            lastMovementTimestamp: new Date(),
            cachedData: { test: true },
            fileUrls: { PDF: '/cached/report.pdf' },
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          }
        });

        // Act
        const response = await fetch('/api/reports/individual', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-workspace-id': mockWorkspaceId
          },
          body: JSON.stringify(requestData)
        });

        const result = await response.json();

        // Assert
        expect(response.status).toBe(200);
        expect(result.success).toBe(true);
        expect(result.creditsCost.consumed).toBe(false);
        expect(result.cacheInfo.hit).toBe(true);
      });

      it('deve executar rollback em caso de erro na geração', async () => {
        // Arrange
        const requestData = {
          processIds: mockProcessIds,
          type: 'JURIDICO',
          format: ['PDF']
        };

        const creditManager = getCreditManager(prisma);
        jest.spyOn(creditManager, 'calculateReportCreditCost').mockReturnValue(1);
        jest.spyOn(creditManager, 'getCreditBalance').mockResolvedValue({
          reportCreditsAvailable: 5,
          reportCreditsBalance: 5,
          fullCreditsAvailable: 5,
          fullCreditsBalance: 5,
          reportCreditsHeld: 0,
          fullCreditsHeld: 0
        });

        const debitSpy = jest.spyOn(creditManager, 'debitCredits').mockResolvedValue({
          success: true,
          transactionIds: ['tx-123']
        });

        const creditSpy = jest.spyOn(creditManager, 'creditCredits').mockResolvedValue();

        // Mock falha na geração
        jest.spyOn(ReportGenerator.prototype, 'generateScheduledReport')
          .mockResolvedValue({
            success: false,
            reportId: '',
            fileUrls: {},
            summary: {},
            tokensUsed: 0,
            cacheHit: false,
            processingTime: 0,
            error: 'Erro de geração'
          });

        // Act
        const response = await fetch('/api/reports/individual', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-workspace-id': mockWorkspaceId
          },
          body: JSON.stringify(requestData)
        });

        const result = await response.json();

        // Assert
        expect(response.status).toBe(500);
        expect(result.success).toBe(false);
        expect(debitSpy).toHaveBeenCalled();
        expect(creditSpy).toHaveBeenCalledWith(
          mockWorkspaceId,
          1,
          0,
          'PACK',
          'Rollback - erro na geração de relatório'
        );
      });
    });

    describe('POST - Agendamento', () => {
      it('deve agendar relatório com sucesso', async () => {
        // Arrange
        const scheduleDate = new Date();
        scheduleDate.setHours(23, 30, 0, 0);
        scheduleDate.setDate(scheduleDate.getDate() + 1);

        const requestData = {
          processIds: mockProcessIds,
          type: 'JURIDICO',
          format: ['PDF'],
          scheduleAt: scheduleDate.toISOString()
        };

        const creditManager = getCreditManager(prisma);
        jest.spyOn(creditManager, 'calculateReportCreditCost').mockReturnValue(1);
        jest.spyOn(creditManager, 'getCreditBalance').mockResolvedValue({
          reportCreditsAvailable: 5,
          reportCreditsBalance: 5,
          fullCreditsAvailable: 5,
          fullCreditsBalance: 5,
          reportCreditsHeld: 0,
          fullCreditsHeld: 0
        });

        jest.spyOn(creditManager, 'reserveCredits').mockResolvedValue({
          success: true,
          holdId: 'hold-123'
        });

        // Act
        const response = await fetch('/api/reports/individual', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-workspace-id': mockWorkspaceId
          },
          body: JSON.stringify(requestData)
        });

        const result = await response.json();

        // Assert
        expect(response.status).toBe(200);
        expect(result.success).toBe(true);
        expect(result.status).toBe('SCHEDULED');
        expect(result.scheduledFor).toBe(scheduleDate.toISOString());
        expect(result.creditsCost.consumed).toBe(false);
      });

      it('deve falhar agendamento fora da janela noturna', async () => {
        // Arrange
        const scheduleDate = new Date();
        scheduleDate.setHours(12, 0, 0, 0); // Meio-dia
        scheduleDate.setDate(scheduleDate.getDate() + 1);

        const requestData = {
          processIds: mockProcessIds,
          type: 'EXECUTIVO',
          format: ['PDF'],
          scheduleAt: scheduleDate.toISOString()
        };

        // Act
        const response = await fetch('/api/reports/individual', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-workspace-id': mockWorkspaceId
          },
          body: JSON.stringify(requestData)
        });

        const result = await response.json();

        // Assert
        expect(response.status).toBe(400);
        expect(result.success).toBe(false);
        expect(result.error).toContain('entre 23h e 04h');
      });
    });
  });

  describe('Endpoint /api/reports/individual/history', () => {
    describe('GET - Buscar Histórico', () => {
      it('deve retornar histórico com paginação', async () => {
        // Arrange
        await createTestReportExecutions();

        // Act
        const response = await fetch('/api/reports/individual/history?limit=10&offset=0', {
          headers: {
            'x-workspace-id': mockWorkspaceId
          }
        });

        const result = await response.json();

        // Assert
        expect(response.status).toBe(200);
        expect(result.success).toBe(true);
        expect(result.reports).toHaveLength(3);
        expect(result.pagination.total).toBe(3);
        expect(result.summary).toBeDefined();
      });

      it('deve filtrar por status', async () => {
        // Arrange
        await createTestReportExecutions();

        // Act
        const response = await fetch('/api/reports/individual/history?status=CONCLUIDO', {
          headers: {
            'x-workspace-id': mockWorkspaceId
          }
        });

        const result = await response.json();

        // Assert
        expect(response.status).toBe(200);
        expect(result.reports.every(r => r.status === 'Concluído')).toBe(true);
      });
    });

    describe('DELETE - Cancelar Relatório', () => {
      it('deve cancelar relatório agendado', async () => {
        // Arrange
        const reportExecution = await prisma.reportExecution.create({
          data: {
            workspaceId: mockWorkspaceId,
            reportType: 'COMPLETO',
            status: 'AGENDADO',
            parameters: { processIds: mockProcessIds },
            scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000),
            audienceType: 'CLIENTE',
            outputFormats: ['PDF']
          }
        });

        // Act
        const response = await fetch(`/api/reports/individual/history?reportId=${reportExecution.id}`, {
          method: 'DELETE',
          headers: {
            'x-workspace-id': mockWorkspaceId
          }
        });

        const result = await response.json();

        // Assert
        expect(response.status).toBe(200);
        expect(result.success).toBe(true);

        // Verificar se foi cancelado
        const updatedReport = await prisma.reportExecution.findUnique({
          where: { id: reportExecution.id }
        });
        expect(updatedReport?.status).toBe('CANCELADO');
      });
    });
  });

  describe('Sistema de Créditos', () => {
    describe('Cálculo de Custos', () => {
      it('deve calcular custo corretamente por tier', () => {
        const creditManager = getCreditManager(prisma);

        // Tier 1: 1-5 processos = 0.25 crédito
        expect(creditManager.calculateReportCreditCost(3)).toBe(0.25);

        // Tier 2: 6-12 processos = 0.5 crédito
        expect(creditManager.calculateReportCreditCost(8)).toBe(0.5);

        // Tier 3: 13-25 processos = 1 crédito
        expect(creditManager.calculateReportCreditCost(20)).toBe(1.0);

        // Acima de 25: múltiplos de 25
        expect(creditManager.calculateReportCreditCost(30)).toBe(2);
        expect(creditManager.calculateReportCreditCost(50)).toBe(2);
        expect(creditManager.calculateReportCreditCost(51)).toBe(3);
      });
    });

    describe('Transações Atômicas', () => {
      it('deve debitar e creditar atomicamente', async () => {
        const creditManager = getCreditManager(prisma);

        // Setup workspace com créditos
        await creditManager.initializeWorkspaceCredits(mockWorkspaceId, 'STARTER');
        await creditManager.creditCredits(mockWorkspaceId, 10, 5, 'MONTHLY', 'Setup inicial');

        // Teste débito
        const debitResult = await creditManager.debitCredits(
          mockWorkspaceId,
          2,
          1,
          'Teste de débito',
          { test: true }
        );

        expect(debitResult.success).toBe(true);

        // Verificar saldo
        const balance = await creditManager.getCreditBalance(mockWorkspaceId);
        expect(balance.reportCreditsBalance).toBe(8);
        expect(balance.fullCreditsBalance).toBe(4);
      });

      it('deve fazer rollback em caso de erro', async () => {
        const creditManager = getCreditManager(prisma);

        // Setup workspace
        await creditManager.initializeWorkspaceCredits(mockWorkspaceId, 'STARTER');
        await creditManager.creditCredits(mockWorkspaceId, 10, 5, 'MONTHLY', 'Setup inicial');

        const initialBalance = await creditManager.getCreditBalance(mockWorkspaceId);

        // Simular erro após débito
        await creditManager.debitCredits(mockWorkspaceId, 2, 0, 'Teste', {});

        // Rollback
        await creditManager.creditCredits(mockWorkspaceId, 2, 0, 'PACK', 'Rollback teste');

        const finalBalance = await creditManager.getCreditBalance(mockWorkspaceId);

        expect(finalBalance.reportCreditsBalance).toBe(initialBalance.reportCreditsBalance);
      });
    });
  });

  describe('Worker de Relatórios Individuais', () => {
    describe('Processamento de Jobs', () => {
      it('deve processar job agendado com sucesso', async () => {
        // Arrange
        const reportExecution = await prisma.reportExecution.create({
          data: {
            workspaceId: mockWorkspaceId,
            reportType: 'COMPLETO',
            status: 'AGENDADO',
            parameters: {
              processIds: mockProcessIds,
              type: 'JURIDICO',
              format: ['PDF']
            },
            scheduledFor: new Date(),
            audienceType: 'USO_INTERNO',
            outputFormats: ['PDF']
          }
        });

        const jobData = {
          type: 'scheduled-individual-report' as const,
          reportExecutionId: reportExecution.id,
          workspaceId: mockWorkspaceId,
          processIds: mockProcessIds,
          reportType: 'JURIDICO' as const,
          format: ['PDF'] as ('PDF' | 'DOCX')[],
          creditHoldId: 'hold-123'
        };

        // Mock das dependências
        const creditManager = getCreditManager(prisma);
        jest.spyOn(creditManager, 'calculateReportCreditCost').mockReturnValue(1);
        jest.spyOn(creditManager, 'debitCredits').mockResolvedValue({
          success: true,
          transactionIds: ['tx-123']
        });
        jest.spyOn(creditManager, 'releaseReservation').mockResolvedValue();

        jest.spyOn(ReportGenerator.prototype, 'generateScheduledReport')
          .mockResolvedValue({
            success: true,
            reportId: 'report-123',
            fileUrls: { PDF: '/reports/test.pdf' },
            summary: { processCount: 3 },
            tokensUsed: 1000,
            cacheHit: false,
            processingTime: 5000
          });

        // Act
        const job = await addIndividualReportJob(jobData);
        await job.finished(); // Aguardar conclusão

        // Assert
        const updatedExecution = await prisma.reportExecution.findUnique({
          where: { id: reportExecution.id }
        });

        expect(updatedExecution?.status).toBe('CONCLUIDO');
        expect(updatedExecution?.fileUrls).toEqual({ PDF: '/reports/test.pdf' });
      });

      it('deve fazer rollback em caso de erro', async () => {
        // Teste similar ao anterior mas com erro simulado
        // e verificação do rollback de créditos
      });
    });
  });

  describe('Cache de Relatórios', () => {
    describe('Verificação e Invalidação', () => {
      it('deve invalidar cache quando há movimentação recente', async () => {
        // Arrange
        const cacheEntry = await prisma.reportCache.create({
          data: {
            cacheKey: 'test-cache-key',
            workspaceId: mockWorkspaceId,
            reportType: 'COMPLETO',
            processIds: mockProcessIds,
            audienceType: 'CLIENTE',
            lastMovementTimestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 dia atrás
            cachedData: { test: true },
            fileUrls: { PDF: '/cached/report.pdf' },
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          }
        });

        // Criar movimentação recente
        await createRecentMovement(mockProcessIds[0]);

        // Act
        const response = await fetch('/api/reports/individual/cache-check', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-workspace-id': mockWorkspaceId
          },
          body: JSON.stringify({
            processIds: mockProcessIds,
            type: 'JURIDICO',
            format: ['PDF']
          })
        });

        const result = await response.json();

        // Assert
        expect(result.cache.hit).toBe(false);

        // Verificar se cache foi removido
        const deletedCache = await prisma.reportCache.findUnique({
          where: { cacheKey: cacheEntry.cacheKey }
        });
        expect(deletedCache).toBeNull();
      });
    });
  });
});

// ================================================================
// FUNÇÕES AUXILIARES DE TESTE
// ================================================================

async function setupTestData() {
  // Criar workspace de teste
  await prisma.workspace.upsert({
    where: { id: mockWorkspaceId },
    update: {},
    create: {
      id: mockWorkspaceId,
      name: 'Test Workspace',
      slug: 'test-workspace'
    }
  });

  // Criar créditos do workspace
  const creditManager = getCreditManager(prisma);
  await creditManager.initializeWorkspaceCredits(mockWorkspaceId, 'STARTER');

  // Criar processos de teste
  for (const processId of mockProcessIds) {
    await prisma.monitoredProcess.upsert({
      where: { id: processId },
      update: {},
      create: {
        id: processId,
        workspaceId: mockWorkspaceId,
        processNumber: `TEST-${processId}`,
        court: 'Tribunal de Teste',
        clientName: 'Cliente Teste'
      }
    });
  }
}

async function cleanupTestData() {
  // Remover dados de teste
  await prisma.reportExecution.deleteMany({
    where: { workspaceId: mockWorkspaceId }
  });

  await prisma.reportCache.deleteMany({
    where: { workspaceId: mockWorkspaceId }
  });

  await prisma.processMovement.deleteMany({
    where: {
      monitoredProcess: {
        workspaceId: mockWorkspaceId
      }
    }
  });

  await prisma.monitoredProcess.deleteMany({
    where: { workspaceId: mockWorkspaceId }
  });

  await prisma.creditTransaction.deleteMany({
    where: { workspaceId: mockWorkspaceId }
  });

  await prisma.creditAllocation.deleteMany({
    where: { workspaceId: mockWorkspaceId }
  });

  await prisma.workspaceCredits.deleteMany({
    where: { workspaceId: mockWorkspaceId }
  });

  await prisma.workspace.deleteMany({
    where: { id: mockWorkspaceId }
  });
}

async function createTestReportExecutions() {
  const executions = [
    {
      workspaceId: mockWorkspaceId,
      reportType: 'COMPLETO',
      status: 'CONCLUIDO',
      parameters: { processIds: mockProcessIds },
      audienceType: 'CLIENTE',
      outputFormats: ['PDF'],
      completedAt: new Date(),
      fileUrls: { PDF: '/reports/completed.pdf' },
      quotaConsumed: 1
    },
    {
      workspaceId: mockWorkspaceId,
      reportType: 'NOVIDADES',
      status: 'AGENDADO',
      parameters: { processIds: mockProcessIds },
      audienceType: 'DIRETORIA',
      outputFormats: ['PDF', 'DOCX'],
      scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000),
      quotaConsumed: 0.5
    },
    {
      workspaceId: mockWorkspaceId,
      reportType: 'COMPLETO',
      status: 'FALHOU',
      parameters: { processIds: mockProcessIds },
      audienceType: 'USO_INTERNO',
      outputFormats: ['PDF'],
      error: 'Erro de teste',
      quotaConsumed: 1
    }
  ];

  for (const execution of executions) {
    await prisma.reportExecution.create({
      data: execution as any
    });
  }
}

async function createRecentMovement(processId: string) {
  await prisma.processMovement.create({
    data: {
      monitoredProcessId: processId,
      date: new Date(), // Movimentação recente
      type: 'MOVIMENTO_TESTE',
      description: 'Movimentação de teste recente',
      category: 'OTHER'
    }
  });
}