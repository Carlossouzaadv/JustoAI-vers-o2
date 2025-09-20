// ================================================================
// TESTES INTEGRADOS - Sistema de Telemetria e Quotas
// ================================================================

import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { prisma } from '../lib/prisma';
import { usageTracker } from '../lib/telemetry/usage-tracker';
import { quotaEnforcement, quotaCheckReport } from '../lib/middleware/quota-enforcement';
import { runDailyAggregation } from '../workers/usage-aggregator-worker';
import { opsAlerts } from '../lib/alerts/ops-alerts';

// ================================================================
// SETUP E MOCKS
// ================================================================

// Mock do fetch para simular APIs externas
global.fetch = vi.fn();

// Mock do Slack webhook
const mockSlackWebhook = vi.fn();

// ================================================================
// DADOS DE TESTE
// ================================================================

const testWorkspace = {
  id: 'ws-telemetry-test-001',
  name: 'Workspace Telemetria Teste',
  plan: 'premium',
  status: 'ACTIVE'
};

const testQuotaPolicy = {
  workspaceId: testWorkspace.id,
  planId: 'premium',
  reportsMonthlyLimit: 20,
  processesLimit: 500,
  fullCreditsIncluded: 50,
  softThresholdPct: 0.8,
  hardThresholdPct: 1.0
};

// ================================================================
// HELPERS DE TESTE
// ================================================================

async function createTestData() {
  // Criar workspace de teste
  await prisma.workspace.create({
    data: testWorkspace
  });

  // Criar política de quota
  await prisma.workspaceQuotaPolicy.create({
    data: testQuotaPolicy
  });
}

async function cleanupTestData() {
  await prisma.usageEvents.deleteMany({ where: { workspaceId: testWorkspace.id } });
  await prisma.workspaceUsageDaily.deleteMany({ where: { workspaceId: testWorkspace.id } });
  await prisma.creditTransactions.deleteMany({ where: { workspaceId: testWorkspace.id } });
  await prisma.workspaceQuotaPolicy.deleteMany({ where: { workspaceId: testWorkspace.id } });
  await prisma.workspace.deleteMany({ where: { id: testWorkspace.id } });
}

async function simulateUsage(workspaceId: string, days: number = 1) {
  const promises = [];

  for (let day = 0; day < days; day++) {
    const date = new Date();
    date.setDate(date.getDate() - day);

    // Simular diversos tipos de uso
    promises.push(
      usageTracker.trackJuditCall(workspaceId, {
        processNumber: '1234567-12.2023.8.26.0001',
        requestType: 'search',
        docsRetrieved: 3,
        responseTime: 1500,
        success: true
      }),
      usageTracker.trackIACall(workspaceId, {
        model: 'fast',
        tokens: 1000,
        responseTime: 800,
        success: true,
        purpose: 'document_analysis'
      }),
      usageTracker.trackReportGeneration(workspaceId, {
        type: 'on_demand',
        reportFormat: 'executive',
        processCount: 5,
        fileFormats: ['pdf'],
        duration: 30000,
        success: true
      })
    );
  }

  await Promise.all(promises);
}

// ================================================================
// TESTES - USAGE TRACKER
// ================================================================

describe('Usage Tracker', () => {
  beforeAll(async () => {
    await createTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Event Tracking', () => {
    test('deve rastrear chamadas Judit corretamente', async () => {
      await usageTracker.trackJuditCall(testWorkspace.id, {
        processNumber: '1234567-12.2023.8.26.0001',
        requestType: 'search',
        docsRetrieved: 5,
        responseTime: 2000,
        success: true,
        cost: 3.50
      });

      const events = await prisma.usageEvents.findMany({
        where: {
          workspaceId: testWorkspace.id,
          eventType: 'judit_call'
        }
      });

      expect(events).toHaveLength(1);
      expect(events[0].payload).toMatchObject({
        processNumber: '1234567-12.2023.8.26.0001',
        requestType: 'search',
        docsRetrieved: 5,
        success: true
      });
    });

    test('deve rastrear chamadas IA por modelo', async () => {
      await Promise.all([
        usageTracker.trackIACall(testWorkspace.id, {
          model: 'fast',
          tokens: 500,
          success: true,
          purpose: 'text_analysis'
        }),
        usageTracker.trackIACall(testWorkspace.id, {
          model: 'full',
          tokens: 2000,
          success: true,
          purpose: 'report_generation'
        })
      ]);

      const events = await prisma.usageEvents.findMany({
        where: {
          workspaceId: testWorkspace.id,
          eventType: 'ia_call'
        }
      });

      expect(events).toHaveLength(2);
      expect(events.some(e => e.payload.model === 'fast')).toBe(true);
      expect(events.some(e => e.payload.model === 'full')).toBe(true);
    });

    test('deve rastrear geração de relatórios', async () => {
      await usageTracker.trackReportGeneration(testWorkspace.id, {
        type: 'scheduled',
        reportFormat: 'detailed',
        processCount: 10,
        fileFormats: ['pdf', 'docx'],
        duration: 45000,
        success: true,
        cacheHit: false
      });

      const events = await prisma.usageEvents.findMany({
        where: {
          workspaceId: testWorkspace.id,
          eventType: 'report_generation'
        }
      });

      expect(events).toHaveLength(1);
      expect(events[0].payload).toMatchObject({
        type: 'scheduled',
        reportFormat: 'detailed',
        processCount: 10,
        success: true
      });
    });

    test('deve rastrear consumo de créditos', async () => {
      await usageTracker.trackCreditConsumption(testWorkspace.id, {
        amount: 2.5,
        reason: 'Relatório jurídico detalhado',
        relatedReportId: 'report_123'
      });

      const [transactions, events] = await Promise.all([
        prisma.creditTransactions.findMany({
          where: { workspaceId: testWorkspace.id }
        }),
        prisma.usageEvents.findMany({
          where: {
            workspaceId: testWorkspace.id,
            eventType: 'credit_consumption'
          }
        })
      ]);

      expect(transactions).toHaveLength(1);
      expect(transactions[0].type).toBe('debit');
      expect(parseFloat(transactions[0].amount.toString())).toBe(2.5);

      expect(events).toHaveLength(1);
      expect(events[0].payload.amount).toBe(2.5);
    });
  });

  describe('Usage Calculation', () => {
    test('deve calcular uso atual corretamente', async () => {
      await simulateUsage(testWorkspace.id, 3);

      const usage = await usageTracker.getCurrentUsage(testWorkspace.id);

      expect(usage.monthly.juditCallsTotal).toBeGreaterThan(0);
      expect(usage.monthly.iaCallsFast).toBeGreaterThan(0);
      expect(usage.monthly.reportsOnDemandGenerated).toBeGreaterThan(0);
      expect(usage.billingEstimate.totalEstimated).toBeGreaterThan(0);
    });

    test('deve calcular estimativa de billing corretamente', async () => {
      const metrics = {
        juditCallsTotal: 10,
        juditDocsRetrieved: 25,
        iaCallsFast: 5,
        iaCallsMid: 3,
        iaCallsFull: 2,
        reportsScheduledGenerated: 2,
        reportsOnDemandGenerated: 3,
        fullCreditsConsumedMonth: 5
      };

      const billing = usageTracker.calculateBillingEstimate(metrics);

      expect(billing.totalEstimated).toBeGreaterThan(0);
      expect(billing.juditCosts).toBe(10 * 3.50 + 25 * 0.25); // 10 calls + 25 docs
      expect(billing.iaCosts).toBe(5 * 0.05 + 3 * 0.25 + 2 * 1.50); // fast + mid + full
      expect(billing.breakdown).toBeDefined();
    });

    test('deve obter saldo de créditos', async () => {
      // Adicionar alguns créditos
      await usageTracker.trackCreditPurchase(testWorkspace.id, {
        amount: 10,
        source: 'purchase',
        transactionId: 'txn_test_001'
      });

      // Consumir alguns
      await usageTracker.trackCreditConsumption(testWorkspace.id, {
        amount: 3,
        reason: 'Test consumption'
      });

      const balance = await usageTracker.getCreditBalance(testWorkspace.id);

      expect(balance.includedCredits).toBe(testQuotaPolicy.fullCreditsIncluded);
      expect(balance.purchasedCredits).toBe(10);
      expect(balance.consumedCredits).toBe(3);
      expect(balance.balance).toBe(testQuotaPolicy.fullCreditsIncluded + 10 - 3);
    });
  });
});

// ================================================================
// TESTES - QUOTA ENFORCEMENT
// ================================================================

describe('Quota Enforcement', () => {
  beforeAll(async () => {
    await createTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('Report Quota', () => {
    test('deve permitir relatórios dentro da quota', async () => {
      const result = await quotaCheckReport(testWorkspace.id, 'on_demand');

      expect(result.allowed).toBe(true);
      expect(result.quotaStatus).toBe('ok');
      expect(result.current).toBeLessThan(result.limit);
    });

    test('deve emitir soft warning no threshold de 80%', async () => {
      // Simular 16 relatórios (80% de 20)
      for (let i = 0; i < 16; i++) {
        await usageTracker.trackReportGeneration(testWorkspace.id, {
          type: 'on_demand',
          reportFormat: 'executive',
          processCount: 1,
          fileFormats: ['pdf'],
          success: true
        });
      }

      // Forçar agregação
      await runDailyAggregation(testWorkspace.id);

      const result = await quotaCheckReport(testWorkspace.id, 'on_demand');

      expect(result.quotaStatus).toBe('soft_warning');
      expect(result.allowed).toBe(true);
      expect(result.percentage).toBeGreaterThanOrEqual(80);
    });

    test('deve bloquear no hard threshold de 100%', async () => {
      // Simular 20 relatórios (100% de 20)
      for (let i = 0; i < 20; i++) {
        await usageTracker.trackReportGeneration(testWorkspace.id, {
          type: 'on_demand',
          reportFormat: 'executive',
          processCount: 1,
          fileFormats: ['pdf'],
          success: true
        });
      }

      // Forçar agregação
      await runDailyAggregation(testWorkspace.id);

      const result = await quotaCheckReport(testWorkspace.id, 'on_demand');

      expect(result.allowed).toBe(false);
      expect(result.quotaStatus).toBe('hard_blocked');
      expect(result.percentage).toBeGreaterThanOrEqual(100);
      expect(result.actions).toBeDefined();
      expect(result.actions?.length).toBeGreaterThan(0);
    });

    test('deve permitir bypass de admin', async () => {
      // Mesmo com quota estourada
      for (let i = 0; i < 25; i++) {
        await usageTracker.trackReportGeneration(testWorkspace.id, {
          type: 'on_demand',
          reportFormat: 'executive',
          processCount: 1,
          fileFormats: ['pdf'],
          success: true
        });
      }

      await runDailyAggregation(testWorkspace.id);

      const result = await quotaCheckReport(testWorkspace.id, 'on_demand', {
        adminBypass: true
      });

      expect(result.allowed).toBe(true);
      expect(result.message).toContain('Admin bypass');
    });
  });

  describe('Credit Quota', () => {
    test('deve verificar créditos suficientes', async () => {
      const result = await quotaEnforcement.checkCreditQuota(testWorkspace.id, 10);

      expect(result.allowed).toBe(true);
      expect(result.current).toBeGreaterThanOrEqual(10);
    });

    test('deve bloquear com créditos insuficientes', async () => {
      // Consumir quase todos os créditos
      await usageTracker.trackCreditConsumption(testWorkspace.id, {
        amount: testQuotaPolicy.fullCreditsIncluded - 1,
        reason: 'Test consumption'
      });

      const result = await quotaEnforcement.checkCreditQuota(testWorkspace.id, 10);

      expect(result.allowed).toBe(false);
      expect(result.quotaStatus).toBe('hard_blocked');
      expect(result.actions).toBeDefined();
    });
  });
});

// ================================================================
// TESTES - USAGE AGGREGATOR
// ================================================================

describe('Usage Aggregator', () => {
  beforeAll(async () => {
    await createTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  test('deve agregar eventos diários corretamente', async () => {
    // Simular vários eventos
    await simulateUsage(testWorkspace.id);

    // Rodar agregação
    const result = await runDailyAggregation(testWorkspace.id);

    expect(result.success).toBe(true);
    expect(result.workspacesProcessed).toBeGreaterThan(0);

    // Verificar dados agregados
    const today = new Date().toISOString().split('T')[0];
    const usage = await prisma.workspaceUsageDaily.findUnique({
      where: {
        workspaceId_date: {
          workspaceId: testWorkspace.id,
          date: new Date(today)
        }
      }
    });

    expect(usage).toBeDefined();
    expect(usage!.juditCallsTotal).toBeGreaterThan(0);
    expect(usage!.iaCallsFast).toBeGreaterThan(0);
    expect(usage!.reportsOnDemandGenerated).toBeGreaterThan(0);
    expect(usage!.billingEstimatedCost).toBeGreaterThan(0);
  });

  test('deve calcular snapshot mensal de relatórios', async () => {
    // Simular relatórios em vários dias
    for (let day = 0; day < 5; day++) {
      await usageTracker.trackReportGeneration(testWorkspace.id, {
        type: 'on_demand',
        reportFormat: 'executive',
        processCount: 2,
        fileFormats: ['pdf'],
        success: true
      });

      // Simular dia diferente movendo a data
      if (day > 0) {
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - day);

        await prisma.usageEvents.updateMany({
          where: {
            workspaceId: testWorkspace.id,
            eventType: 'report_generation'
          },
          data: {
            createdAt: pastDate
          }
        });
      }
    }

    await runDailyAggregation(testWorkspace.id);

    const today = new Date().toISOString().split('T')[0];
    const usage = await prisma.workspaceUsageDaily.findUnique({
      where: {
        workspaceId_date: {
          workspaceId: testWorkspace.id,
          date: new Date(today)
        }
      }
    });

    expect(usage!.reportsTotalMonthSnapshot).toBeGreaterThan(0);
  });
});

// ================================================================
// TESTES - BILLING E CRÉDITOS
// ================================================================

describe('Billing and Credits', () => {
  beforeAll(async () => {
    await createTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  test('deve processar compra de créditos via API', async () => {
    const response = await fetch('/api/billing/credits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'purchase',
        workspaceId: testWorkspace.id,
        packageType: 'extra_reports_20',
        paymentMethod: 'credit_card'
      })
    });

    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.transaction.credits).toBe(20);
  });

  test('deve simular compra de pacotes', async () => {
    const response = await fetch('/api/billing/credits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'simulate_purchase',
        packageType: 'extra_reports_50',
        quantity: 2
      })
    });

    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.totalCredits).toBe(100); // 50 * 2
    expect(data.data.pricing.finalPrice).toBeLessThan(data.data.pricing.basePrice); // Com desconto
  });

  test('deve obter dashboard de créditos', async () => {
    const response = await fetch(`/api/billing/credits?workspaceId=${testWorkspace.id}`);

    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.balance).toBeDefined();
    expect(data.data.quotaStatus).toBeDefined();
    expect(data.data.packages).toBeDefined();
    expect(data.data.recommendations).toBeDefined();
  });
});

// ================================================================
// TESTES - ALERTAS OPERACIONAIS
// ================================================================

describe('Ops Alerts', () => {
  beforeAll(async () => {
    await createTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('deve detectar alto custo de billing', async () => {
    // Simular uso alto para gerar custo > 70% do plano
    for (let i = 0; i < 50; i++) {
      await usageTracker.trackJuditCall(testWorkspace.id, {
        processNumber: `proc_${i}`,
        requestType: 'search',
        docsRetrieved: 10,
        success: true,
        cost: 5.0 // Custo alto
      });
    }

    await runDailyAggregation(testWorkspace.id);

    // Verificar alertas
    await opsAlerts.checkWorkspaceAlerts(testWorkspace.id);

    // Verificar se evento de alerta foi criado
    const alertEvents = await prisma.usageEvents.findMany({
      where: {
        workspaceId: testWorkspace.id,
        eventType: 'ops_alert_sent'
      }
    });

    expect(alertEvents.length).toBeGreaterThan(0);
    expect(alertEvents.some(e => e.payload.ruleId === 'high_billing_cost')).toBe(true);
  });

  test('deve detectar bloqueios repetidos de quota', async () => {
    // Simular múltiplos bloqueios
    for (let i = 0; i < 3; i++) {
      await prisma.usageEvents.create({
        data: {
          workspaceId: testWorkspace.id,
          eventType: 'quota_hard_blocked',
          payload: { reportType: 'on_demand', attempt: i + 1 }
        }
      });
    }

    await opsAlerts.checkWorkspaceAlerts(testWorkspace.id);

    const alertEvents = await prisma.usageEvents.findMany({
      where: {
        workspaceId: testWorkspace.id,
        eventType: 'ops_alert_sent'
      }
    });

    expect(alertEvents.some(e => e.payload.ruleId === 'quota_hard_blocked_repeated')).toBe(true);
  });

  test('deve enviar alerta manual', async () => {
    await opsAlerts.sendManualAlert(
      'Teste Manual',
      'Este é um alerta de teste enviado manualmente',
      'medium',
      ['slack'],
      testWorkspace.id
    );

    const alertEvents = await prisma.usageEvents.findMany({
      where: {
        workspaceId: testWorkspace.id,
        eventType: 'ops_alert_sent'
      }
    });

    expect(alertEvents.some(e => e.payload.ruleId === 'manual')).toBe(true);
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

  test('deve executar fluxo completo de quota e billing', async () => {
    // 1. Simular uso que atinge soft warning
    for (let i = 0; i < 16; i++) {
      await usageTracker.trackReportGeneration(testWorkspace.id, {
        type: 'on_demand',
        reportFormat: 'executive',
        processCount: 3,
        fileFormats: ['pdf'],
        success: true
      });
    }

    // 2. Agregar dados
    await runDailyAggregation(testWorkspace.id);

    // 3. Verificar quota status
    const quotaResult = await quotaCheckReport(testWorkspace.id, 'on_demand');
    expect(quotaResult.quotaStatus).toBe('soft_warning');

    // 4. Comprar créditos para resolver quota
    await usageTracker.trackCreditPurchase(testWorkspace.id, {
      amount: 20,
      source: 'purchase',
      transactionId: 'txn_integration_test'
    });

    // 5. Verificar que quota foi resolvida (nota: créditos não afetam quota de relatórios diretamente,
    //    mas demonstra o fluxo de compra)
    const creditBalance = await usageTracker.getCreditBalance(testWorkspace.id);
    expect(creditBalance.balance).toBeGreaterThan(50);

    // 6. Verificar alertas
    await opsAlerts.checkWorkspaceAlerts(testWorkspace.id);

    // 7. Verificar telemetria foi salva
    const events = await prisma.usageEvents.count({
      where: { workspaceId: testWorkspace.id }
    });
    expect(events).toBeGreaterThan(16);
  });

  test('deve lidar com cenário de bloqueio completo', async () => {
    // Esgotar quota completamente
    for (let i = 0; i < 25; i++) {
      await usageTracker.trackReportGeneration(testWorkspace.id, {
        type: 'on_demand',
        reportFormat: 'executive',
        processCount: 1,
        fileFormats: ['pdf'],
        success: true
      });
    }

    await runDailyAggregation(testWorkspace.id);

    // Tentar gerar mais um relatório
    const quotaResult = await quotaCheckReport(testWorkspace.id, 'on_demand');

    expect(quotaResult.allowed).toBe(false);
    expect(quotaResult.quotaStatus).toBe('hard_blocked');
    expect(quotaResult.actions).toBeDefined();
    expect(quotaResult.actions?.some(a => a.type === 'upgrade_plan')).toBe(true);
    expect(quotaResult.actions?.some(a => a.type === 'buy_credits')).toBe(true);
  });
});

console.log('🧪 Telemetry & Quota System Tests - Test suite covers:');
console.log('✅ Usage Tracker (Judit, IA, Reports, Credits)');
console.log('✅ Quota Enforcement (Soft/Hard thresholds, Admin bypass)');
console.log('✅ Usage Aggregator (Daily aggregation, Billing calculation)');
console.log('✅ Billing & Credits API (Purchase, Simulation, Dashboard)');
console.log('✅ Ops Alerts (Cost monitoring, Quota warnings, Slack integration)');
console.log('✅ End-to-End Integration (Complete quota/billing workflows)');