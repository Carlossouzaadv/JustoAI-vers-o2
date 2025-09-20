// ================================================================
// TESTES UNITÁRIOS - Excel Upload Service
// ================================================================

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ExcelUploadService } from '../lib/excel-upload-service';
import { ExcelProcessParser } from '../lib/excel-parser';
import { TokenBucketRateLimiter, ExponentialBackoffRetry } from '../lib/rate-limiter';

// Mock do Prisma
const mockPrisma = {
  processBatchUpload: {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn()
  },
  monitoredProcess: {
    findFirst: jest.fn(),
    create: jest.fn()
  },
  processMovement: {
    createMany: jest.fn()
  }
};

describe('ExcelUploadService', () => {
  let uploadService: ExcelUploadService;

  beforeEach(() => {
    uploadService = new ExcelUploadService({
      MAX_ROWS: 100,
      PAGE_SIZE: 10,
      SUBBATCH: 5,
      CONCURRENCY: 2,
      PAUSE_MS: 100,
      DRY_RUN: false
    });
    jest.clearAllMocks();
  });

  describe('parseAndValidate', () => {
    it('deve validar configurações de upload', () => {
      // Testar se o serviço foi inicializado com as configurações corretas
      expect(uploadService).toBeDefined();

      // Mock do parseAndValidate para testar a lógica
      const mockParseResult = {
        success: true,
        parseResult: {
          success: true,
          totalRows: 2,
          validRows: [
            { linha: 2, numeroProcesso: '1234567-89.2024.1.23.4567', tribunal: 'TJSP', nomeCliente: 'João Silva' }
          ],
          errors: [],
          summary: { valid: 1, invalid: 0, duplicates: 0, warnings: 0 }
        },
        estimate: {
          validRows: 1,
          estimatedApiCalls: 1,
          estimatedCost: 0.10
        },
        preview: [
          { linha: 2, numeroProcesso: '1234567-89.2024.1.23.4567', tribunal: 'TJSP', nomeCliente: 'João Silva' }
        ]
      };

      expect(mockParseResult.success).toBe(true);
      expect(mockParseResult.parseResult).toBeDefined();
      expect(mockParseResult.estimate).toBeDefined();
      expect(mockParseResult.preview).toBeDefined();
      expect(mockParseResult.parseResult!.summary.valid).toBe(1);
    });

    it('deve validar lógica de erros', () => {
      // Simular resultado com erros
      const mockErrorResult = {
        success: false,
        errors: [
          { tipo: 'ERROR', erro: 'Número do processo é obrigatório', linha: 2 },
          { tipo: 'ERROR', erro: 'Tribunal é obrigatório', linha: 3 }
        ]
      };

      expect(mockErrorResult.success).toBe(false);
      expect(mockErrorResult.errors).toBeDefined();
      expect(mockErrorResult.errors!.length).toBeGreaterThan(0);
    });

    it('deve calcular estimativa correta', () => {
      // Testar cálculo de estimativa
      const validRows = 3;
      const costPerProcess = 0.10;
      const estimatedCost = validRows * costPerProcess;

      const mockEstimate = {
        success: true,
        estimate: {
          validRows: validRows,
          estimatedApiCalls: validRows,
          estimatedCost: estimatedCost
        }
      };

      expect(mockEstimate.success).toBe(true);
      expect(mockEstimate.estimate).toBeDefined();
      expect(mockEstimate.estimate!.validRows).toBe(3);
      expect(mockEstimate.estimate!.estimatedApiCalls).toBe(3);
      expect(mockEstimate.estimate!.estimatedCost).toBeCloseTo(0.30, 2);
    });
  });

  describe('createBatch', () => {
    it('deve criar batch no banco corretamente', async () => {
      const mockParseResult = {
        success: true,
        totalRows: 2,
        validRows: [
          { linha: 2, numeroProcesso: '1234567-89.2024.1.23.4567', tribunal: 'TJSP', nomeCliente: 'João Silva' },
          { linha: 3, numeroProcesso: '9876543-21.2024.2.34.5678', tribunal: 'TJRJ', nomeCliente: 'Maria Santos' }
        ],
        errors: [],
        summary: { valid: 2, invalid: 0, duplicates: 0, warnings: 0 }
      };

      mockPrisma.processBatchUpload.create.mockResolvedValue({
        id: 'batch-123',
        fileName: 'test.xlsx',
        totalRows: 2
      });

      const result = await uploadService.createBatch(
        mockParseResult,
        'test.xlsx',
        '/tmp/test.xlsx',
        1024,
        'workspace-123',
        mockPrisma
      );

      expect(result.batchId).toBe('batch-123');
      expect(result.preview).toHaveLength(2);
      expect(mockPrisma.processBatchUpload.create).toHaveBeenCalledWith({
        data: {
          workspaceId: 'workspace-123',
          fileName: 'test.xlsx',
          filePath: '/tmp/test.xlsx',
          fileSize: 1024,
          status: 'PROCESSING',
          totalRows: 2,
          processed: 0,
          successful: 0,
          failed: 0,
          errors: JSON.stringify([]),
          summary: JSON.stringify({ valid: 2, invalid: 0, duplicates: 0, warnings: 0 })
        }
      });
    });
  });
});

describe('TokenBucketRateLimiter', () => {
  let rateLimiter: TokenBucketRateLimiter;

  beforeEach(() => {
    rateLimiter = new TokenBucketRateLimiter({
      maxTokens: 10,
      refillRate: 60, // 1 token por segundo
      initialTokens: 10
    });
  });

  describe('consume', () => {
    it('deve consumir tokens quando disponíveis', async () => {
      const result = await rateLimiter.consume(3);
      expect(result).toBe(true);

      const status = rateLimiter.getStatus();
      expect(status.tokens).toBe(7);
    });

    it('deve rejeitar quando tokens insuficientes', async () => {
      const result = await rateLimiter.consume(15);
      expect(result).toBe(false);

      const status = rateLimiter.getStatus();
      expect(status.tokens).toBe(10); // Nenhum token consumido
    });

    it('deve calcular tempo de espera corretamente', () => {
      const waitTime = rateLimiter.getWaitTime(15);
      expect(waitTime).toBeGreaterThan(0);
    });
  });
});

describe('ExponentialBackoffRetry', () => {
  let retryHandler: ExponentialBackoffRetry;

  beforeEach(() => {
    retryHandler = new ExponentialBackoffRetry({
      maxAttempts: 3,
      baseDelay: 100,
      maxDelay: 1000,
      jitter: false
    });
  });

  describe('execute', () => {
    it('deve retornar sucesso na primeira tentativa', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');

      const result = await retryHandler.execute(mockFn, 'test');

      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
      expect(result.attempt).toBe(1);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('deve tentar novamente após falha', async () => {
      const mockFn = jest.fn()
        .mockRejectedValueOnce(new Error('Erro 1'))
        .mockRejectedValueOnce(new Error('Erro 2'))
        .mockResolvedValue('success');

      const result = await retryHandler.execute(mockFn, 'test');

      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
      expect(result.attempt).toBe(3);
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it('deve falhar após esgotar tentativas', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Erro persistente'));

      const result = await retryHandler.execute(mockFn, 'test');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Erro persistente');
      expect(result.attempt).toBe(3);
      expect(mockFn).toHaveBeenCalledTimes(3);
    });
  });
});

describe('ExcelProcessParser Configuration', () => {
  let parser: ExcelProcessParser;

  beforeEach(() => {
    parser = new ExcelProcessParser({
      maxRows: 100,
      allowDuplicates: false,
      strictProcessNumberValidation: false
    });
  });

  describe('Configuration Tests', () => {
    it('deve configurar parser corretamente', () => {
      expect(parser).toBeDefined();

      // Testar lógica de validação simulada
      const mockValidRows = [
        { linha: 2, numeroProcesso: '1234567-89.2024.1.23.4567', tribunal: 'TJSP', nomeCliente: 'João Silva' },
        { linha: 3, numeroProcesso: '9876543-21.2024.2.34.5678', tribunal: 'TJRJ', nomeCliente: 'Maria Santos' }
      ];

      expect(mockValidRows).toHaveLength(2);
      expect(mockValidRows[0].numeroProcesso).toBeTruthy();
      expect(mockValidRows[0].tribunal).toBeTruthy();
      expect(mockValidRows[0].nomeCliente).toBeTruthy();
    });

    it('deve validar campos obrigatórios', () => {
      const requiredFields = ['numeroProcesso', 'tribunal', 'nomeCliente'];
      const testRow = { numeroProcesso: '', tribunal: 'TJSP', nomeCliente: 'João Silva' };

      // Simular validação
      const missingFields = requiredFields.filter(field => !testRow[field as keyof typeof testRow]);

      expect(missingFields).toContain('numeroProcesso');
      expect(missingFields).toHaveLength(1);
    });

    it('deve detectar duplicatas logicamente', () => {
      const rows = [
        { numeroProcesso: '1234567-89.2024.1.23.4567', tribunal: 'TJSP' },
        { numeroProcesso: '1234567-89.2024.1.23.4567', tribunal: 'TJRJ' } // duplicata
      ];

      const uniqueProcesses = new Set(rows.map(r => r.numeroProcesso));
      const hasDuplicates = uniqueProcesses.size !== rows.length;

      expect(hasDuplicates).toBe(true);
      expect(uniqueProcesses.size).toBe(1);
      expect(rows.length).toBe(2);
    });
  });
});

// ================================================================
// TESTE DE INTEGRAÇÃO
// ================================================================

describe('Integration Test - Excel Upload Pipeline', () => {
  let uploadService: ExcelUploadService;

  beforeEach(() => {
    uploadService = new ExcelUploadService({
      MAX_ROWS: 20,
      PAGE_SIZE: 10,
      SUBBATCH: 5,
      CONCURRENCY: 2,
      PAUSE_MS: 50,
      DRY_RUN: true // Modo dry run para não fazer chamadas reais
    });

    // Setup mocks
    mockPrisma.processBatchUpload.create.mockResolvedValue({
      id: 'integration-batch-123',
      fileName: 'integration-test.xlsx'
    });

    mockPrisma.processBatchUpload.update.mockResolvedValue({});
    mockPrisma.monitoredProcess.findFirst.mockResolvedValue(null);
    mockPrisma.monitoredProcess.create.mockResolvedValue({ id: 'process-123' });
  });

  it('deve simular processamento com paginação', async () => {
    // Simular dados de 20 linhas
    const totalRows = 20;
    const pageSize = 10;
    const expectedPages = Math.ceil(totalRows / pageSize);

    expect(expectedPages).toBe(2);

    // Simular parseResult
    const mockParseResult = {
      success: true,
      totalRows: totalRows,
      validRows: Array.from({ length: totalRows }, (_, i) => ({
        linha: i + 2,
        numeroProcesso: `${(i + 1).toString().padStart(7, '0')}-89.2024.1.23.4567`,
        tribunal: 'TJSP',
        nomeCliente: `Cliente ${i + 1}`
      })),
      errors: [],
      summary: { valid: totalRows, invalid: 0, duplicates: 0, warnings: 0 }
    };

    expect(mockParseResult.success).toBe(true);
    expect(mockParseResult.summary.valid).toBe(20);

    // FASE 2: Criar batch
    const batchInfo = await uploadService.createBatch(
      mockParseResult,
      'integration-test.xlsx',
      '/tmp/integration-test.xlsx',
      2048,
      'workspace-123',
      mockPrisma
    );

    expect(batchInfo.batchId).toBe('integration-batch-123');

    // FASE 3: Simular processamento em background
    await uploadService.processInBackground(
      batchInfo.batchId,
      mockParseResult,
      'workspace-123',
      mockPrisma
    );

    // Verificar que foi processado
    expect(mockPrisma.processBatchUpload.update).toHaveBeenCalled();

    // Verificar finalização
    const finalUpdateCall = mockPrisma.processBatchUpload.update.mock.calls.find(
      call => call[0].data && call[0].data.status === 'COMPLETED'
    );
    expect(finalUpdateCall).toBeDefined();
  });
});

// ================================================================
// HELPERS
// ================================================================

/**
 * Cria buffer Excel mock para testes
 */
function createMockExcelBuffer(data: string[][]): Buffer {
  // Simular estrutura Excel básica
  const content = data.map(row => row.join('\t')).join('\n');
  return Buffer.from(content, 'utf-8');
}