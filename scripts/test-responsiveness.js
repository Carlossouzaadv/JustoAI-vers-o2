// ================================================================
// SCRIPT DE TESTE DE RESPONSIVIDADE - JUSTOAI V2
// ================================================================
// Testa responsividade em diferentes tamanhos de tela usando Puppeteer

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Tamanhos de tela para teste (baseado em dispositivos reais)
const VIEWPORT_SIZES = {
  mobile: [
    { name: 'iPhone SE', width: 375, height: 667 },
    { name: 'iPhone 12/13', width: 390, height: 844 },
    { name: 'iPhone 12/13 Pro Max', width: 428, height: 926 },
    { name: 'Samsung Galaxy S21', width: 360, height: 800 },
    { name: 'Samsung Galaxy S21 Ultra', width: 384, height: 854 }
  ],
  tablet: [
    { name: 'iPad Mini', width: 768, height: 1024 },
    { name: 'iPad Air', width: 820, height: 1180 },
    { name: 'iPad Pro 11"', width: 834, height: 1194 },
    { name: 'iPad Pro 12.9"', width: 1024, height: 1366 },
    { name: 'Samsung Galaxy Tab', width: 800, height: 1280 }
  ],
  desktop: [
    { name: 'Laptop 13"', width: 1280, height: 800 },
    { name: 'Desktop HD', width: 1366, height: 768 },
    { name: 'Desktop FHD', width: 1920, height: 1080 },
    { name: 'Desktop QHD', width: 2560, height: 1440 },
    { name: 'Desktop 4K', width: 3840, height: 2160 }
  ]
};

// Páginas para testar
const PAGES_TO_TEST = [
  { name: 'Home', url: '/' },
  { name: 'Login', url: '/login' },
  { name: 'Signup', url: '/signup' },
  { name: 'Dashboard', url: '/dashboard' },
  { name: 'Upload', url: '/dashboard/upload' },
  { name: 'Pricing', url: '/pricing' },
  { name: 'Contact', url: '/contact' }
];

// Critérios de teste
const TEST_CRITERIA = {
  textReadability: {
    minFontSize: 14, // px
    minLineHeight: 1.4,
    maxLineLength: 75 // caracteres
  },
  touchTargets: {
    minSize: 44, // px - recomendação W3C/Apple
    minSpacing: 8 // px entre elementos
  },
  layout: {
    maxHorizontalScroll: 0,
    minContentWidth: 320 // px - menor viewport suportado
  }
};

async function testResponsiveness() {
  console.log('📱 Iniciando teste completo de responsividade...\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const results = {
    timestamp: new Date().toISOString(),
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    pages: {},
    summary: {
      mobile: { passed: 0, failed: 0, issues: [] },
      tablet: { passed: 0, failed: 0, issues: [] },
      desktop: { passed: 0, failed: 0, issues: [] }
    }
  };

  try {
    // Testar cada página em cada tamanho de tela
    for (const page of PAGES_TO_TEST) {
      console.log(`🔍 Testando página: ${page.name} (${page.url})`);
      results.pages[page.name] = {};

      for (const [category, viewports] of Object.entries(VIEWPORT_SIZES)) {
        results.pages[page.name][category] = [];

        for (const viewport of viewports) {
          console.log(`  📐 ${category}: ${viewport.name} (${viewport.width}x${viewport.height})`);

          const testResult = await testPageResponsiveness(
            browser,
            page.url,
            viewport,
            category
          );

          results.pages[page.name][category].push(testResult);
          results.totalTests++;

          if (testResult.passed) {
            results.passedTests++;
            results.summary[category].passed++;
          } else {
            results.failedTests++;
            results.summary[category].failed++;
            results.summary[category].issues.push(...testResult.issues);
          }
        }
      }
    }

    // Gerar relatório
    await generateReport(results);

  } catch (error) {
    console.error('❌ Erro durante os testes:', error);
  } finally {
    await browser.close();
  }

  return results;
}

async function testPageResponsiveness(browser, url, viewport, category) {
  const page = await browser.newPage();
  const testResult = {
    device: viewport.name,
    viewport: viewport,
    category,
    passed: true,
    issues: [],
    metrics: {}
  };

  try {
    // Configurar viewport
    await page.setViewport({
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 1
    });

    // Navegar para a página
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    await page.goto(`${baseUrl}${url}`, {
      waitUntil: 'networkidle0',
      timeout: 10000
    });

    // Aguardar carregamento completo
    await page.waitForTimeout(2000);

    // Teste 1: Verificar scroll horizontal
    const horizontalScroll = await page.evaluate(() => {
      return document.body.scrollWidth > window.innerWidth;
    });

    if (horizontalScroll) {
      testResult.issues.push('Scroll horizontal detectado');
      testResult.passed = false;
    }

    // Teste 2: Verificar tamanhos de fonte
    const fontSizes = await page.evaluate(() => {
      const elements = document.querySelectorAll('p, span, div, a, button, input, label');
      const sizes = [];

      for (const el of elements) {
        const computedStyle = window.getComputedStyle(el);
        const fontSize = parseFloat(computedStyle.fontSize);
        if (fontSize > 0 && el.textContent.trim()) {
          sizes.push({
            fontSize,
            element: el.tagName,
            text: el.textContent.trim().substring(0, 50)
          });
        }
      }

      return sizes;
    });

    const smallFonts = fontSizes.filter(item => item.fontSize < TEST_CRITERIA.textReadability.minFontSize);
    if (smallFonts.length > 0) {
      testResult.issues.push(`${smallFonts.length} elementos com fonte muito pequena (< ${TEST_CRITERIA.textReadability.minFontSize}px)`);
      testResult.passed = false;
    }

    // Teste 3: Verificar touch targets (apenas mobile)
    if (category === 'mobile') {
      const touchTargets = await page.evaluate((minSize) => {
        const interactiveElements = document.querySelectorAll('button, a, input, select, textarea, [onclick], [role="button"]');
        const smallTargets = [];

        for (const el of interactiveElements) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            if (rect.width < minSize || rect.height < minSize) {
              smallTargets.push({
                element: el.tagName,
                size: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
                text: el.textContent?.trim().substring(0, 30) || el.type || 'sem texto'
              });
            }
          }
        }

        return smallTargets;
      }, TEST_CRITERIA.touchTargets.minSize);

      if (touchTargets.length > 0) {
        testResult.issues.push(`${touchTargets.length} elementos interativos muito pequenos (< ${TEST_CRITERIA.touchTargets.minSize}px)`);
        testResult.passed = false;
      }
    }

    // Teste 4: Verificar navegação mobile
    if (category === 'mobile') {
      const mobileNav = await page.evaluate(() => {
        // Procurar menu hambúrguer
        const hamburger = document.querySelector('[class*="hamburger"], [class*="menu-toggle"], button[class*="mobile"]');

        // Verificar se navegação desktop está escondida em mobile
        const desktopNav = document.querySelector('nav [class*="hidden"][class*="lg:flex"], [class*="hidden"][class*="md:flex"]');

        return {
          hasHamburger: !!hamburger,
          hasHiddenDesktopNav: !!desktopNav,
          hamburgerVisible: hamburger ? window.getComputedStyle(hamburger).display !== 'none' : false
        };
      });

      if (!mobileNav.hasHamburger && !mobileNav.hasHiddenDesktopNav) {
        testResult.issues.push('Navegação mobile não implementada corretamente');
        testResult.passed = false;
      }
    }

    // Teste 5: Verificar formulários (se existirem)
    const formIssues = await page.evaluate(() => {
      const forms = document.querySelectorAll('form');
      const issues = [];

      for (const form of forms) {
        const inputs = form.querySelectorAll('input, select, textarea');

        for (const input of inputs) {
          const rect = input.getBoundingClientRect();

          // Verificar se input é muito pequeno
          if (rect.height < 40) {
            issues.push(`Input muito baixo: ${rect.height}px`);
          }

          // Verificar se tem label
          const hasLabel = input.labels?.length > 0 ||
                          input.getAttribute('aria-label') ||
                          input.getAttribute('placeholder');

          if (!hasLabel) {
            issues.push(`Input sem label adequado: ${input.type || input.tagName}`);
          }
        }
      }

      return issues;
    });

    if (formIssues.length > 0) {
      testResult.issues.push(...formIssues);
      testResult.passed = false;
    }

    // Capturar métricas adicionais
    testResult.metrics = await page.evaluate(() => {
      return {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        contentWidth: document.body.scrollWidth,
        contentHeight: document.body.scrollHeight,
        hasHorizontalScroll: document.body.scrollWidth > window.innerWidth,
        totalElements: document.querySelectorAll('*').length,
        interactiveElements: document.querySelectorAll('button, a, input, select, textarea').length
      };
    });

    // Capturar screenshot para evidência
    const screenshotDir = path.join(__dirname, '../screenshots');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    const screenshotPath = path.join(screenshotDir, `${url.replace(/\//g, '_')}_${viewport.name.replace(/\s+/g, '_')}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    testResult.screenshot = screenshotPath;

  } catch (error) {
    testResult.issues.push(`Erro durante o teste: ${error.message}`);
    testResult.passed = false;
  } finally {
    await page.close();
  }

  return testResult;
}

async function generateReport(results) {
  const reportPath = path.join(__dirname, '../responsiveness-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));

  // Gerar relatório em markdown
  const markdownReport = generateMarkdownReport(results);
  const markdownPath = path.join(__dirname, '../RESPONSIVENESS_REPORT.md');
  fs.writeFileSync(markdownPath, markdownReport);

  console.log('\n📊 RELATÓRIO DE RESPONSIVIDADE\n');
  console.log('================================');
  console.log(`✅ Testes realizados: ${results.totalTests}`);
  console.log(`✅ Testes aprovados: ${results.passedTests}`);
  console.log(`❌ Testes reprovados: ${results.failedTests}`);
  console.log(`📊 Taxa de sucesso: ${((results.passedTests / results.totalTests) * 100).toFixed(1)}%`);

  console.log('\n📱 RESUMO POR CATEGORIA:');
  for (const [category, summary] of Object.entries(results.summary)) {
    const total = summary.passed + summary.failed;
    const percentage = total > 0 ? ((summary.passed / total) * 100).toFixed(1) : 0;
    console.log(`${category.toUpperCase()}: ${summary.passed}/${total} (${percentage}%)`);

    if (summary.issues.length > 0) {
      console.log(`  ⚠️  Principais problemas:`);
      const uniqueIssues = [...new Set(summary.issues)];
      uniqueIssues.slice(0, 3).forEach(issue => {
        console.log(`    • ${issue}`);
      });
    }
  }

  console.log(`\n📄 Relatórios salvos:`);
  console.log(`  • JSON: ${reportPath}`);
  console.log(`  • Markdown: ${markdownPath}`);
  console.log(`  • Screenshots: ${path.join(__dirname, '../screenshots/')}`);
}

function generateMarkdownReport(results) {
  const successRate = ((results.passedTests / results.totalTests) * 100).toFixed(1);

  let markdown = `# 📱 Relatório de Responsividade - JustoAI V2

**Data**: ${new Date(results.timestamp).toLocaleString('pt-BR')}
**Taxa de Sucesso**: ${successRate}% (${results.passedTests}/${results.totalTests})

## 📊 Resumo Executivo

`;

  // Resumo por categoria
  for (const [category, summary] of Object.entries(results.summary)) {
    const total = summary.passed + summary.failed;
    const percentage = total > 0 ? ((summary.passed / total) * 100).toFixed(1) : 0;

    markdown += `### ${category.charAt(0).toUpperCase() + category.slice(1)}
- **Taxa de Sucesso**: ${percentage}% (${summary.passed}/${total})
- **Problemas Encontrados**: ${summary.failed}

`;

    if (summary.issues.length > 0) {
      const uniqueIssues = [...new Set(summary.issues)];
      markdown += `**Principais Problemas**:
${uniqueIssues.slice(0, 5).map(issue => `- ${issue}`).join('\n')}

`;
    }
  }

  // Detalhes por página
  markdown += `## 📄 Detalhes por Página

`;

  for (const [pageName, pageResults] of Object.entries(results.pages)) {
    markdown += `### ${pageName}

`;

    for (const [category, tests] of Object.entries(pageResults)) {
      const passed = tests.filter(t => t.passed).length;
      const total = tests.length;
      const percentage = ((passed / total) * 100).toFixed(1);

      markdown += `#### ${category.charAt(0).toUpperCase() + category.slice(1)} (${percentage}%)

| Dispositivo | Status | Problemas |
|-------------|--------|-----------|
`;

      for (const test of tests) {
        const status = test.passed ? '✅' : '❌';
        const issues = test.issues.length > 0 ? test.issues.join(', ') : 'Nenhum';
        markdown += `| ${test.device} | ${status} | ${issues} |
`;
      }
      markdown += '\n';
    }
  }

  markdown += `## 🔧 Recomendações

`;

  // Gerar recomendações baseadas nos problemas encontrados
  const allIssues = Object.values(results.summary).flatMap(s => s.issues);
  const issueFrequency = {};
  allIssues.forEach(issue => {
    issueFrequency[issue] = (issueFrequency[issue] || 0) + 1;
  });

  const topIssues = Object.entries(issueFrequency)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5);

  if (topIssues.length > 0) {
    markdown += `### Problemas Mais Frequentes:

`;
    topIssues.forEach(([issue, count]) => {
      markdown += `${count}x - ${issue}
`;
    });
  }

  return markdown;
}

// Executar testes se chamado diretamente
if (require.main === module) {
  testResponsiveness().catch(console.error);
}

module.exports = { testResponsiveness };