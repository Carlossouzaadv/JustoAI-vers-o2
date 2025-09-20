// ================================================================
// TESTES E2E - FLUXOS FRONTEND ADAPTADOS
// ================================================================
// Testes end-to-end para os novos fluxos de créditos, quotas e relatórios

import { test, expect, Page } from '@playwright/test';

// ================================================================
// SETUP E HELPERS
// ================================================================

// Mock workspace ID for tests
const TEST_WORKSPACE_ID = 'ws-test-123';

// Helper to login and navigate to dashboard
async function loginAndNavigate(page: Page) {
  await page.goto('/login');

  // Mock authentication
  await page.fill('[data-testid="email-input"]', 'test@justoai.com');
  await page.fill('[data-testid="password-input"]', 'password123');
  await page.click('[data-testid="login-button"]');

  await page.waitForURL('/dashboard');
  await expect(page.locator('[data-testid="dashboard-header"]')).toBeVisible();
}

// Helper to mock API responses
async function setupApiMocks(page: Page) {
  // Mock credits API
  await page.route('/api/billing/credits*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          balance: {
            balance: 15,
            includedCredits: 5,
            purchasedCredits: 10,
            consumedCredits: 3
          },
          quotaStatus: {
            reports: {
              current: 8,
              limit: 10,
              percentage: 80,
              status: 'soft_warning'
            }
          }
        }
      })
    });
  });

  // Mock quota check API
  await page.route('/api/reports/quota-check*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        allowed: true,
        quotaStatus: {
          current: 8,
          limit: 10,
          percentage: 80,
          status: 'soft_warning'
        },
        actions: ['buy_credits', 'schedule_night']
      })
    });
  });

  // Mock telemetry API
  await page.route('/api/telemetry/monthly-usage*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          processes: { monitored: 45, limit: 100, percentage: 45 },
          reports: { used: 8, limit: 10, percentage: 80, status: 'soft_warning' },
          credits: { consumed: 3, included: 5, purchased: 10, remaining: 12 },
          api: { juditCalls: 125, estimatedCost: 18.50 }
        }
      })
    });
  });
}

// ================================================================
// TESTES DE CRÉDITOS E DASHBOARD
// ================================================================

test.describe('Credits Dashboard Card', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
    await loginAndNavigate(page);
  });

  test('should display credits card with correct information', async ({ page }) => {
    // Navegar para dashboard principal
    await page.click('[data-testid="dashboard-nav"]');

    // Verificar se o card de créditos está visível
    const creditsCard = page.locator('[data-testid="credits-card"]');
    await expect(creditsCard).toBeVisible();

    // Verificar informações de créditos
    await expect(creditsCard.locator('[data-testid="credits-balance"]')).toContainText('15');
    await expect(creditsCard.locator('[data-testid="credits-included"]')).toContainText('5');
    await expect(creditsCard.locator('[data-testid="credits-purchased"]')).toContainText('10');
    await expect(creditsCard.locator('[data-testid="credits-consumed"]')).toContainText('3');
  });

  test('should show quota warning when at 80%', async ({ page }) => {
    await page.click('[data-testid="dashboard-nav"]');

    const creditsCard = page.locator('[data-testid="credits-card"]');

    // Verificar status de quota
    await expect(creditsCard.locator('[data-testid="quota-status"]')).toContainText('8 de 10');
    await expect(creditsCard.locator('[data-testid="quota-progress"]')).toBeVisible();

    // Verificar aviso de soft warning
    await expect(creditsCard.locator('[data-testid="quota-warning"]')).toContainText('80%');
  });

  test('should handle refresh button', async ({ page }) => {
    await page.click('[data-testid="dashboard-nav"]');

    const refreshButton = page.locator('[data-testid="credits-refresh-button"]');
    await expect(refreshButton).toBeVisible();

    await refreshButton.click();

    // Verificar se o ícone de loading aparece
    await expect(refreshButton.locator('.animate-spin')).toBeVisible();
  });
});

// ================================================================
// TESTES DE AGENDAMENTO DE RELATÓRIOS
// ================================================================

test.describe('Report Scheduler Modal', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
    await loginAndNavigate(page);
  });

  test('should open scheduler modal and select tone', async ({ page }) => {
    // Navegar para página de processos
    await page.goto('/dashboard/processes');

    // Abrir modal de agendamento
    await page.click('[data-testid="schedule-report-button"]');

    const modal = page.locator('[data-testid="report-scheduler-modal"]');
    await expect(modal).toBeVisible();

    // Verificar opções de tom
    const toneClient = modal.locator('[data-testid="tone-client"]');
    const toneBoard = modal.locator('[data-testid="tone-board"]');
    const toneInternal = modal.locator('[data-testid="tone-internal"]');

    await expect(toneClient).toBeVisible();
    await expect(toneBoard).toBeVisible();
    await expect(toneInternal).toBeVisible();

    // Selecionar tom para cliente
    await toneClient.click();
    await expect(toneClient).toHaveClass(/selected/);

    // Verificar descrição do tom
    await expect(modal.locator('[data-testid="tone-description"]'))
      .toContainText('Linguagem acessível para apresentação ao cliente');
  });

  test('should show quota information and warnings', async ({ page }) => {
    await page.goto('/dashboard/processes');
    await page.click('[data-testid="schedule-report-button"]');

    const modal = page.locator('[data-testid="report-scheduler-modal"]');

    // Verificar informações de quota
    await expect(modal.locator('[data-testid="quota-current"]')).toContainText('8 de 10');
    await expect(modal.locator('[data-testid="quota-warning"]')).toContainText('80%');

    // Verificar barra de progresso
    await expect(modal.locator('[data-testid="quota-progress"]')).toBeVisible();
  });

  test('should offer night scheduling with discount', async ({ page }) => {
    await page.goto('/dashboard/processes');
    await page.click('[data-testid="schedule-report-button"]');

    const modal = page.locator('[data-testid="report-scheduler-modal"]');

    // Selecionar agendamento noturno
    const nightOption = modal.locator('[data-testid="schedule-night"]');
    await expect(nightOption).toBeVisible();

    await nightOption.click();

    // Verificar desconto
    await expect(modal.locator('[data-testid="night-discount"]'))
      .toContainText('50% de desconto');
  });

  test('should handle report generation', async ({ page }) => {
    // Mock report generation API
    await page.route('/api/reports/generate*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          reportId: 'rpt-123',
          status: 'generating'
        })
      });
    });

    await page.goto('/dashboard/processes');
    await page.click('[data-testid="schedule-report-button"]');

    const modal = page.locator('[data-testid="report-scheduler-modal"]');

    // Selecionar tom e gerar
    await modal.locator('[data-testid="tone-client"]').click();
    await modal.locator('[data-testid="generate-button"]').click();

    // Verificar loading state
    await expect(modal.locator('[data-testid="generating-indicator"]')).toBeVisible();
  });
});

// ================================================================
// TESTES DE BANNER DE USO E TELEMETRIA
// ================================================================

test.describe('Usage Banner and Telemetry', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
    await loginAndNavigate(page);
  });

  test('should display usage banner with alerts', async ({ page }) => {
    await page.goto('/dashboard');

    const usageBanner = page.locator('[data-testid="usage-banner"]');
    await expect(usageBanner).toBeVisible();

    // Verificar alerta de soft warning
    const alert = usageBanner.locator('[data-testid="quota-alert"]');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('80%');
  });

  test('should expand to show detailed usage', async ({ page }) => {
    await page.goto('/dashboard');

    const usageBanner = page.locator('[data-testid="usage-banner"]');
    const expandButton = usageBanner.locator('[data-testid="expand-usage"]');

    await expandButton.click();

    // Verificar seções expandidas
    await expect(usageBanner.locator('[data-testid="processes-detail"]')).toBeVisible();
    await expect(usageBanner.locator('[data-testid="reports-detail"]')).toBeVisible();
    await expect(usageBanner.locator('[data-testid="credits-detail"]')).toBeVisible();
    await expect(usageBanner.locator('[data-testid="api-detail"]')).toBeVisible();

    // Verificar números
    await expect(usageBanner.locator('[data-testid="processes-count"]')).toContainText('45');
    await expect(usageBanner.locator('[data-testid="api-calls-count"]')).toContainText('125');
  });

  test('should allow dismissing alerts', async ({ page }) => {
    await page.goto('/dashboard');

    const usageBanner = page.locator('[data-testid="usage-banner"]');
    const alert = usageBanner.locator('[data-testid="quota-alert"]');
    const dismissButton = alert.locator('[data-testid="dismiss-alert"]');

    await dismissButton.click();

    // Verificar se alerta foi removido
    await expect(alert).not.toBeVisible();
  });
});

// ================================================================
// TESTES DE ANÁLISE DE PROCESSO COM CACHE
// ================================================================

test.describe('Process Analysis Modal with Cache', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
    await loginAndNavigate(page);
  });

  test('should show cache status for FAST analysis', async ({ page }) => {
    // Mock cache status API
    await page.route('/api/process/*/analysis/cache-status*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          cacheStatus: {
            hasCachedAnalysis: true,
            lastAnalysisDate: '2024-01-15T10:30:00Z',
            cacheAge: '2 horas atrás',
            documentsChanged: false
          }
        })
      });
    });

    await page.goto('/dashboard/processes/proc-123');
    await page.click('[data-testid="deep-analysis-button"]');

    const modal = page.locator('[data-testid="deep-analysis-modal"]');
    await expect(modal).toBeVisible();

    // Selecionar análise FAST
    await modal.locator('[data-testid="analysis-fast"]').click();

    // Verificar status do cache
    const cacheStatus = modal.locator('[data-testid="cache-status"]');
    await expect(cacheStatus).toBeVisible();
    await expect(cacheStatus).toContainText('Cache disponível');
    await expect(cacheStatus).toContainText('resultado instantâneo');
  });

  test('should handle analysis with cached results', async ({ page }) => {
    // Mock FAST analysis API
    await page.route('/api/process/*/analysis/fast*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          fromCache: true,
          data: {
            summary: 'Análise carregada do cache',
            confidence: 0.95
          }
        })
      });
    });

    await page.goto('/dashboard/processes/proc-123');
    await page.click('[data-testid="deep-analysis-button"]');

    const modal = page.locator('[data-testid="deep-analysis-modal"]');

    // Executar análise FAST
    await modal.locator('[data-testid="analysis-fast"]').click();
    await modal.locator('[data-testid="start-analysis"]').click();

    // Verificar loading com indicação de cache
    await expect(modal.locator('[data-testid="cache-loading"]'))
      .toContainText('Carregando análise do cache');

    // Verificar conclusão
    await expect(modal.locator('[data-testid="analysis-complete"]'))
      .toContainText('Análise carregada do cache');
  });
});

// ================================================================
// TESTES DE UPLOAD EXCEL APRIMORADO
// ================================================================

test.describe('Enhanced Excel Upload', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
    await loginAndNavigate(page);
  });

  test('should show Excel batch import option', async ({ page }) => {
    await page.goto('/dashboard/upload');

    // Verificar opção de lote via Excel
    const excelOption = page.locator('[data-testid="document-type-excel"]');
    await expect(excelOption).toBeVisible();
    await expect(excelOption).toContainText('Importação em Lote');
    await expect(excelOption).toContainText('Recomendado para escritórios');

    await excelOption.click();

    // Verificar instruções específicas para Excel
    await expect(page.locator('[data-testid="excel-instructions"]')).toBeVisible();
    await expect(page.locator('[data-testid="required-columns"]')).toBeVisible();
    await expect(page.locator('[data-testid="download-template"]')).toBeVisible();
  });

  test('should validate and preview Excel file', async ({ page }) => {
    await page.goto('/dashboard/upload');
    await page.click('[data-testid="document-type-excel"]');

    // Simular upload de arquivo Excel
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'processos.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from('mock excel data')
    });

    // Verificar preview
    await expect(page.locator('[data-testid="excel-preview"]')).toBeVisible();
    await expect(page.locator('[data-testid="preview-stats"]'))
      .toContainText('15 processos detectados');
  });

  test('should handle Excel processing with results', async ({ page }) => {
    // Mock Excel processing API
    await page.route('/api/process/*/analysis/excel-batch*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            totalProcesses: 15,
            successfulImports: 13,
            errors: 2,
            summary: 'Importação concluída: 13 processos criados com sucesso'
          }
        })
      });
    });

    await page.goto('/dashboard/upload');
    await page.click('[data-testid="document-type-excel"]');

    // Upload e processar
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'processos.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from('mock excel data')
    });

    await page.click('[data-testid="confirm-process"]');

    // Verificar resultados
    await expect(page.locator('[data-testid="batch-results"]')).toBeVisible();
    await expect(page.locator('[data-testid="successful-imports"]')).toContainText('13');
    await expect(page.locator('[data-testid="import-errors"]')).toContainText('2');
  });
});

// ================================================================
// TESTES DE INTEGRAÇÃO COMPLETA
// ================================================================

test.describe('Full Integration Flow', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
    await loginAndNavigate(page);
  });

  test('should complete full workflow: upload → analysis → report', async ({ page }) => {
    // 1. Upload de documento
    await page.goto('/dashboard/upload');
    await page.click('[data-testid="document-type-single"]');

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'documento.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('mock pdf data')
    });

    await page.click('[data-testid="analyze-button"]');

    // 2. Verificar análise concluída
    await expect(page.locator('[data-testid="analysis-completed"]')).toBeVisible();

    // 3. Navegar para processo criado
    await page.click('[data-testid="view-process"]');

    // 4. Gerar relatório
    await page.click('[data-testid="schedule-report-button"]');

    const modal = page.locator('[data-testid="report-scheduler-modal"]');
    await modal.locator('[data-testid="tone-client"]').click();
    await modal.locator('[data-testid="generate-button"]').click();

    // 5. Verificar relatório gerado
    await expect(page.locator('[data-testid="report-success"]')).toBeVisible();
  });

  test('should handle quota limits and credit purchase flow', async ({ page }) => {
    // Mock quota exceeded response
    await page.route('/api/reports/quota-check*', async route => {
      await route.fulfill({
        status: 402,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Quota exceeded',
          quotaStatus: {
            current: 10,
            limit: 10,
            percentage: 100,
            status: 'hard_blocked'
          },
          actions: ['buy_credits', 'upgrade_plan']
        })
      });
    });

    await page.goto('/dashboard/processes/proc-123');
    await page.click('[data-testid="schedule-report-button"]');

    const modal = page.locator('[data-testid="report-scheduler-modal"]');

    // Verificar bloqueio por quota
    await expect(modal.locator('[data-testid="quota-blocked"]')).toBeVisible();
    await expect(modal.locator('[data-testid="quota-blocked"]'))
      .toContainText('Limite mensal atingido');

    // Verificar ações disponíveis
    await expect(modal.locator('[data-testid="buy-credits-action"]')).toBeVisible();
    await expect(modal.locator('[data-testid="upgrade-plan-action"]')).toBeVisible();
  });
});

// ================================================================
// TESTES DE ACESSIBILIDADE E UX
// ================================================================

test.describe('Accessibility and UX', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
    await loginAndNavigate(page);
  });

  test('should have proper ARIA labels and keyboard navigation', async ({ page }) => {
    await page.goto('/dashboard');

    // Verificar labels do card de créditos
    const creditsCard = page.locator('[data-testid="credits-card"]');
    await expect(creditsCard).toHaveAttribute('aria-label');

    // Testar navegação por teclado
    await creditsCard.focus();
    await page.keyboard.press('Tab');

    // Verificar se botões são focáveis
    const refreshButton = page.locator('[data-testid="credits-refresh-button"]');
    await expect(refreshButton).toBeFocused();
  });

  test('should display Portuguese messages consistently', async ({ page }) => {
    await page.goto('/dashboard');

    // Verificar textos em português
    await expect(page.locator('[data-testid="credits-title"]'))
      .toContainText('Seus Créditos');
    await expect(page.locator('[data-testid="usage-title"]'))
      .toContainText('Uso Mensal');

    // Verificar formatação de números em português
    await expect(page.locator('[data-testid="quota-usage"]'))
      .toContainText('de'); // "8 de 10"
  });
});