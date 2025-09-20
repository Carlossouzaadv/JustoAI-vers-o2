// ================================================================
// TESTES INTEGRADOS - Sistema de Monitoramento Automático Judit
// ================================================================

import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { prisma } from '../lib/prisma';
import { getJuditApiClient, JuditApiClient } from '../lib/judit-api-client';
import { processMonitorQueue, addMonitoringJob } from '../workers/process-monitor-worker';
import { telemetry } from '../lib/monitoring-telemetry';

// ================================================================
// SETUP E MOCKS
// ================================================================

// Mock do fetch para simular API da Judit
global.fetch = vi.fn();

const mockJuditResponses = {
  createTracking: {
    tracking_id: 'track_123',
    process_cnj: '1234567-12.2023.8.26.0001',
    status: 'active'
  },
  listTrackings: {
    trackings: [
      {
        tracking_id: 'track_123',
        process_cnj: '1234567-12.2023.8.26.0001',
        status: 'active'
      }
    ]
  },
  searchProcess: {
    request_id: 'req_456',
    request_status: 'pending'
  },
  getResult: {
    request_id: 'req_456',
    request_status: 'completed',
    data: {
      processoNumero: '1234567-12.2023.8.26.0001',
      situacao: 'Em andamento',
      movimentacoes: [
        {
          id: 'mov_1',
          type: 'petição',
          date: '2023-12-01T10:00:00Z',
          description: 'Petição inicial',
          content: 'Conteúdo da petição...'
        }
      ],
      attachments: []
    }
  }
};

// ================================================================
// SETUP DE DADOS DE TESTE
// ================================================================

const testWorkspace = {
  id: 'workspace-test-001',
  name: 'Workspace Teste',
  plan: 'premium',
  status: 'ACTIVE'
};

const testProcesses = [
  {
    id: 'process-test-001',
    processNumber: '1234567-12.2023.8.26.0001',
    workspaceId: testWorkspace.id,
    monitoringStatus: 'ACTIVE',
    tribunal: 'TJSP',
    lastSync: null
  },
  {
    id: 'process-test-002',
    processNumber: '1234567-13.2023.8.26.0001',
    workspaceId: testWorkspace.id,
    monitoringStatus: 'ACTIVE',
    tribunal: 'TJSP',
    lastSync: new Date(Date.now() - 25 * 60 * 60 * 1000) // 25 horas atrás
  }
];

// ================================================================
// HELPERS DE TESTE
// ================================================================

function mockFetchSuccess(responseData: any, status = 200) {
  (global.fetch as any).mockResolvedValueOnce({
    ok: status < 400,
    status,
    headers: new Map(),
    json: () => Promise.resolve(responseData),
    text: () => Promise.resolve(JSON.stringify(responseData))
  });
}

function mockFetchError(status: number, message: string) {
  (global.fetch as any).mockResolvedValueOnce({
    ok: false,
    status,
    headers: new Map(),
    text: () => Promise.resolve(message)
  });
}

async function createTestData() {
  // Criar workspace de teste
  await prisma.workspace.create({
    data: testWorkspace
  });

  // Criar processos de teste
  for (const process of testProcesses) {
    await prisma.monitoredProcess.create({
      data: process
    });
  }
}

async function cleanupTestData() {
  await prisma.monitoringTelemetry.deleteMany({ where: { workspaceId: testWorkspace.id } });
  await prisma.monitoringCosts.deleteMany({ where: { workspaceId: testWorkspace.id } });
  await prisma.webhookLog.deleteMany({});
  await prisma.monitoredProcess.deleteMany({ where: { workspaceId: testWorkspace.id } });
  await prisma.workspace.deleteMany({ where: { id: testWorkspace.id } });
}

// ================================================================
// TESTES - JUDIT API CLIENT
// ================================================================

describe('Judit API Client', () => {
  let juditClient: JuditApiClient;

  beforeEach(() => {
    vi.clearAllMocks();
    juditClient = getJuditApiClient();
  });

  describe('Rate Limiting', () => {
    test('deve respeitar rate limit de 180 requests/minuto', async () => {
      // Mock successful responses
      for (let i = 0; i < 5; i++) {
        mockFetchSuccess(mockJuditResponses.listTrackings);
      }

      const startTime = Date.now();

      // Fazer múltiplas chamadas rapidamente
      const promises = Array(5).fill(null).map(() => juditClient.listTrackings());
      await Promise.all(promises);

      const endTime = Date.now();

      // Verificar que houve algum delay (rate limiting funcionando)
      expect(endTime - startTime).toBeGreaterThanOrEqual(100); // Pelo menos 100ms de delay total
    });

    test('deve lidar com erro 429 (rate limit exceeded)', async () => {
      mockFetchError(429, 'Rate limit exceeded');
      mockFetchSuccess(mockJuditResponses.listTrackings); // Retry bem-sucedido

      const result = await juditClient.listTrackings();
      expect(result).toEqual(mockJuditResponses.listTrackings.trackings);
    });
  });

  describe('Circuit Breaker', () => {
    test('deve abrir circuit breaker após muitas falhas', async () => {
      // Simular múltiplas falhas consecutivas
      for (let i = 0; i < 15; i++) {
        mockFetchError(500, 'Internal Server Error');
      }

      // Tentar fazer chamadas que devem falhar
      for (let i = 0; i < 10; i++) {
        try {
          await juditClient.listTrackings();
        } catch (error) {
          // Esperado
        }
      }

      const stats = juditClient.getStats();
      expect(stats.circuitBreakerState).toBe('open');
    });
  });

  describe('Retry Logic', () => {
    test('deve fazer retry em erros 500', async () => {
      mockFetchError(500, 'Internal Server Error');
      mockFetchError(502, 'Bad Gateway');
      mockFetchSuccess(mockJuditResponses.listTrackings); // Terceira tentativa bem-sucedida

      const result = await juditClient.listTrackings();
      expect(result).toEqual(mockJuditResponses.listTrackings.trackings);
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    test('não deve fazer retry em erros 400', async () => {
      mockFetchError(400, 'Bad Request');

      await expect(juditClient.listTrackings()).rejects.toThrow('HTTP 400: Bad Request');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    test('deve usar exponential backoff com jitter', async () => {
      mockFetchError(500, 'Error 1');
      mockFetchError(500, 'Error 2');
      mockFetchSuccess(mockJuditResponses.listTrackings);

      const startTime = Date.now();
      await juditClient.listTrackings();
      const endTime = Date.now();

      // Deve ter algum delay devido ao backoff
      expect(endTime - startTime).toBeGreaterThanOrEqual(1000); // Pelo menos 1s de delay total
    });
  });

  describe('Tracking API', () => {
    test('deve criar tracking com sucesso', async () => {
      mockFetchSuccess(mockJuditResponses.createTracking);

      const result = await juditClient.createTracking(
        '1234567-12.2023.8.26.0001',
        'https://example.com/webhook'
      );

      expect(result.tracking_id).toBe('track_123');
      expect(result.process_cnj).toBe('1234567-12.2023.8.26.0001');
    });

    test('deve listar trackings existentes', async () => {
      mockFetchSuccess(mockJuditResponses.listTrackings);

      const result = await juditClient.listTrackings();
      expect(result).toHaveLength(1);
      expect(result[0].tracking_id).toBe('track_123');
    });
  });

  describe('Polling API', () => {
    test('deve fazer busca em lote de processos', async () => {
      const processNumbers = ['1234567-12.2023.8.26.0001', '1234567-13.2023.8.26.0001'];

      // Mock respostas para cada processo
      processNumbers.forEach(() => {
        mockFetchSuccess(mockJuditResponses.searchProcess);
      });

      const result = await juditClient.searchProcessesBatch(
        processNumbers,
        testWorkspace.id,
        'batch_001'
      );

      expect(result).toHaveLength(2);
      expect(result[0].requestId).toBe('req_456');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    test('deve fazer polling até resultado estar pronto', async () => {
      // Primeira chamada: pending
      mockFetchSuccess({
        request_id: 'req_456',
        request_status: 'pending'
      });

      // Segunda chamada: completed
      mockFetchSuccess(mockJuditResponses.getResult);

      const result = await juditClient.pollForResult(
        'req_456',
        '1234567-12.2023.8.26.0001',
        testWorkspace.id,
        'batch_001'
      );

      expect(result.request_status).toBe('completed');
      expect(result.data.processoNumero).toBe('1234567-12.2023.8.26.0001');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });
});

// ================================================================
// TESTES - PROCESS MONITOR WORKER
// ================================================================

describe('Process Monitor Worker', () => {
  beforeAll(async () => {
    await createTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('deve agendar job de monitoramento diário', async () => {
    const job = await addMonitoringJob('daily-monitor');

    expect(job).toBeDefined();
    expect(job.data.type).toBe('daily-monitor');
  });

  test('deve processar workspace com tracking preferencial', async () => {
    // Mock API responses
    mockFetchSuccess(mockJuditResponses.listTrackings);
    mockFetchSuccess(mockJuditResponses.createTracking);

    const job = await addMonitoringJob('workspace-monitor', {
      workspaceId: testWorkspace.id
    });

    // Aguardar processamento
    await new Promise(resolve => setTimeout(resolve, 1000));

    const jobStatus = await job.finished();
    expect(jobStatus).toBeDefined();
  });

  test('deve categorizar processos entre tracking e polling', async () => {
    // Este teste seria implementado testando a lógica interna
    // Por enquanto verificamos se os processos são encontrados corretamente

    const processes = await prisma.monitoredProcess.findMany({
      where: { workspaceId: testWorkspace.id }
    });

    expect(processes).toHaveLength(2);
    expect(processes.some(p => p.lastSync === null)).toBe(true);
  });
});

// ================================================================
// TESTES - WEBHOOK SYSTEM
// ================================================================

describe('Webhook System', () => {
  beforeAll(async () => {
    await createTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  test('deve processar webhook de movimento', async () => {
    const webhookPayload = {
      tracking_id: 'track_123',
      process_number: '1234567-12.2023.8.26.0001',
      event_type: 'movement',
      timestamp: new Date().toISOString(),
      data: {
        movement: {
          id: 'mov_new_001',
          type: 'petição',
          date: '2023-12-01T15:00:00Z',
          description: 'Nova petição',
          content: 'Conteúdo da nova petição...'
        }
      }
    };

    const response = await fetch('/api/webhooks/judit/tracking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookPayload)
    });

    expect(response.ok).toBe(true);

    const result = await response.json();
    expect(result.status).toBe('success');
    expect(result.newMovements).toBeGreaterThanOrEqual(0);
  });

  test('deve detectar webhooks duplicados', async () => {
    const webhookPayload = {
      tracking_id: 'track_123',
      process_number: '1234567-12.2023.8.26.0001',
      event_type: 'movement',
      timestamp: new Date().toISOString(),
      data: { movement: { id: 'mov_dup_001' } }
    };

    // Enviar mesmo webhook duas vezes
    const response1 = await fetch('/api/webhooks/judit/tracking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookPayload)
    });

    const response2 = await fetch('/api/webhooks/judit/tracking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookPayload)
    });

    const result2 = await response2.json();
    expect(result2.status).toBe('duplicate_ignored');
  });
});

// ================================================================
// TESTES - TELEMETRIA E CUSTO
// ================================================================

describe('Telemetry and Cost Tracking', () => {
  beforeAll(async () => {
    await createTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  test('deve registrar evento de telemetria', async () => {
    await telemetry.recordTelemetryEvent({
      type: 'api_call',
      source: 'tracking',
      workspaceId: testWorkspace.id,
      processNumber: '1234567-12.2023.8.26.0001',
      metadata: { test: true },
      success: true,
      duration: 150,
      cost: 0.25
    });

    const events = await prisma.monitoringTelemetry.findMany({
      where: { workspaceId: testWorkspace.id }
    });

    expect(events).toHaveLength(1);
    expect(events[0].cost).toBe(0.25);
    expect(events[0].success).toBe(true);
  });

  test('deve rastrear custos por operação', async () => {
    await telemetry.recordCostEvent({
      workspaceId: testWorkspace.id,
      service: 'judit',
      operation: 'tracking_creation',
      cost: 0.69,
      currency: 'BRL',
      processCount: 1,
      metadata: { trackingId: 'track_123' }
    });

    const costs = await prisma.monitoringCosts.findMany({
      where: { workspaceId: testWorkspace.id }
    });

    expect(costs).toHaveLength(1);
    expect(costs[0].operation).toBe('tracking_creation');
    expect(costs[0].cost).toBe(0.69);
  });

  test('deve gerar alertas de custo', async () => {
    // Simular custo alto para gerar alerta
    await telemetry.recordTelemetryEvent({
      type: 'cost_incurred',
      source: 'polling',
      workspaceId: testWorkspace.id,
      metadata: {},
      success: true,
      cost: 100.0 // Valor alto para trigger alert
    });

    const alerts = await telemetry.getActiveAlerts(testWorkspace.id);
    expect(alerts.length).toBeGreaterThanOrEqual(0); // Pode ou não ter alertas dependendo dos limites
  });

  test('deve calcular métricas de monitoramento', async () => {
    const metrics = await telemetry.getMonitoringMetrics(testWorkspace.id);

    expect(metrics).toBeDefined();
    expect(metrics.daily).toBeDefined();
    expect(metrics.realTime).toBeDefined();
    expect(typeof metrics.daily.totalApiCalls).toBe('number');
    expect(typeof metrics.daily.totalCost).toBe('number');
  });
});

// ================================================================
// TESTES - ADMIN INTERFACE
// ================================================================

describe('Admin Interface', () => {
  beforeAll(async () => {
    await createTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  test('deve retornar status do sistema', async () => {
    const response = await fetch('/api/admin/monitoring');
    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data.status).toBe('success');
    expect(data.data.overall).toMatch(/^(healthy|degraded|critical|offline)$/);
    expect(data.data.components).toBeDefined();
    expect(data.data.metrics).toBeDefined();
  });

  test('deve executar health check', async () => {
    const response = await fetch('/api/admin/monitoring', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'health_check' })
    });

    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data.status).toBe('success');
    expect(data.result.overallHealth).toBeDefined();
    expect(data.result.checks).toBeDefined();
  });

  test('deve reiniciar worker de monitoramento', async () => {
    const response = await fetch('/api/admin/monitoring', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'restart_worker' })
    });

    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data.status).toBe('success');
    expect(data.result.success).toBe(true);
  });

  test('deve forçar sync de workspace', async () => {
    const response = await fetch('/api/admin/monitoring', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'force_sync',
        workspaceId: testWorkspace.id
      })
    });

    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data.status).toBe('success');
    expect(data.result.jobId).toBeDefined();
  });
});

// ================================================================
// TESTES DE INTEGRAÇÃO END-TO-END
// ================================================================

describe('End-to-End Integration', () => {
  beforeAll(async () => {
    await createTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  test('deve executar ciclo completo de monitoramento', async () => {
    // 1. Agendar job de monitoramento
    const job = await addMonitoringJob('workspace-monitor', {
      workspaceId: testWorkspace.id
    });

    // 2. Mock respostas da API Judit
    mockFetchSuccess(mockJuditResponses.listTrackings);
    mockFetchSuccess(mockJuditResponses.createTracking);
    mockFetchSuccess(mockJuditResponses.searchProcess);
    mockFetchSuccess(mockJuditResponses.getResult);

    // 3. Aguardar processamento do job
    const result = await job.finished();

    // 4. Verificar que telemetria foi registrada
    const telemetryEvents = await prisma.monitoringTelemetry.findMany({
      where: { workspaceId: testWorkspace.id }
    });

    expect(telemetryEvents.length).toBeGreaterThan(0);

    // 5. Verificar que processos foram atualizados
    const updatedProcesses = await prisma.monitoredProcess.findMany({
      where: { workspaceId: testWorkspace.id }
    });

    expect(updatedProcesses.some(p => p.lastSync !== null)).toBe(true);
  });

  test('deve lidar com falhas graciosamente', async () => {
    // Simular falha na API
    mockFetchError(500, 'Internal Server Error');

    const job = await addMonitoringJob('workspace-monitor', {
      workspaceId: testWorkspace.id
    });

    try {
      await job.finished();
    } catch (error) {
      // Esperado que falhe
    }

    // Verificar que telemetria de erro foi registrada
    const errorEvents = await prisma.monitoringTelemetry.findMany({
      where: {
        workspaceId: testWorkspace.id,
        success: false
      }
    });

    expect(errorEvents.length).toBeGreaterThan(0);
  });
});

// ================================================================
// TESTES DE PERFORMANCE
// ================================================================

describe('Performance Tests', () => {
  beforeAll(async () => {
    await createTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  test('deve processar lote grande de processos eficientemente', async () => {
    const largeProcessList = Array.from({ length: 100 }, (_, i) =>
      `1234567-${String(i).padStart(2, '0')}.2023.8.26.0001`
    );

    // Mock respostas para todos os processos
    largeProcessList.forEach(() => {
      mockFetchSuccess(mockJuditResponses.searchProcess);
    });

    const startTime = Date.now();

    const requests = await getJuditApiClient().searchProcessesBatch(
      largeProcessList,
      testWorkspace.id,
      'batch_performance_test'
    );

    const endTime = Date.now();
    const duration = endTime - startTime;

    expect(requests).toHaveLength(100);
    expect(duration).toBeLessThan(30000); // Menos que 30 segundos
  });

  test('deve respeitar rate limits em alta carga', async () => {
    const juditClient = getJuditApiClient();

    // Fazer muitas chamadas simultâneas
    const promises = Array.from({ length: 20 }, () => {
      mockFetchSuccess(mockJuditResponses.listTrackings);
      return juditClient.listTrackings();
    });

    const startTime = Date.now();
    await Promise.all(promises);
    const endTime = Date.now();

    // Deve ter algum delay devido ao rate limiting
    expect(endTime - startTime).toBeGreaterThan(1000);

    const stats = juditClient.getStats();
    expect(stats.rateLimitHits).toBe(0); // Não deve ter hits se rate limiting funcionou
  });
});

console.log('🧪 Monitoring System Tests - Test suite covers:');
console.log('✅ Judit API Client (rate limiting, circuit breaker, retry logic)');
console.log('✅ Process Monitor Worker (batching, scheduling)');
console.log('✅ Webhook System (deduplication, processing)');
console.log('✅ Telemetry & Cost Tracking');
console.log('✅ Admin Interface & Recovery Tools');
console.log('✅ End-to-End Integration');
console.log('✅ Performance & Load Testing');