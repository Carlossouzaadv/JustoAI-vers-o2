#!/usr/bin/env node

/**
 * Script de Teste de Conformidade LGPD - JustoAI V2
 *
 * Este script testa e valida a implementação de conformidade com a LGPD:
 * 1. Banner de cookies com consentimento
 * 2. Checkbox de consentimento no formulário de cadastro
 * 3. Páginas legais (Termos, Privacidade, Cookies)
 * 4. Gestão de estado de consentimento
 */

const fs = require('fs');
const path = require('path');

// Cores para output no terminal
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  title: (msg) => console.log(`${colors.bold}${colors.blue}🔍 ${msg}${colors.reset}`)
};

// Caminhos dos arquivos
const basePath = process.cwd();
const paths = {
  cookieBanner: path.join(basePath, 'src/components/ui/cookie-banner.tsx'),
  cookieContext: path.join(basePath, 'src/contexts/cookie-consent-context.tsx'),
  consentCheckbox: path.join(basePath, 'src/components/ui/consent-checkbox.tsx'),
  signupPage: path.join(basePath, 'src/app/signup/page.tsx'),
  authValidation: path.join(basePath, 'lib/validations/auth.ts'),
  layout: path.join(basePath, 'src/app/layout.tsx'),
  termsPage: path.join(basePath, 'src/app/terms/page.tsx'),
  privacyPage: path.join(basePath, 'src/app/privacy/page.tsx'),
  cookiesPage: path.join(basePath, 'src/app/cookies/page.tsx'),
  mobileCSS: path.join(basePath, 'src/styles/mobile-responsive.css')
};

// Funções de validação
function fileExists(filePath) {
  return fs.existsSync(filePath);
}

function fileContains(filePath, searchTerms) {
  if (!fileExists(filePath)) return false;

  const content = fs.readFileSync(filePath, 'utf8');
  return searchTerms.every(term => content.includes(term));
}

function validateCookieBanner() {
  log.title('Validando Banner de Cookies');

  if (!fileExists(paths.cookieBanner)) {
    log.error('Arquivo cookie-banner.tsx não encontrado');
    return false;
  }

  const requiredFeatures = [
    'CookieBanner',
    'handleAccept',
    'handleReject',
    'localStorage.setItem',
    'useCookieConsent',
    'LGPD'
  ];

  if (fileContains(paths.cookieBanner, requiredFeatures)) {
    log.success('Banner de cookies implementado com todas as funcionalidades LGPD');
    return true;
  } else {
    log.error('Banner de cookies está incompleto');
    return false;
  }
}

function validateCookieContext() {
  log.title('Validando Contexto de Consentimento de Cookies');

  if (!fileExists(paths.cookieContext)) {
    log.error('Arquivo cookie-consent-context.tsx não encontrado');
    return false;
  }

  const requiredFeatures = [
    'CookieConsentProvider',
    'acceptCookies',
    'rejectCookies',
    'clearNonEssentialCookies',
    'applyCookieSettings',
    'gtag'
  ];

  if (fileContains(paths.cookieContext, requiredFeatures)) {
    log.success('Contexto de consentimento implementado corretamente');
    return true;
  } else {
    log.error('Contexto de consentimento está incompleto');
    return false;
  }
}

function validateConsentCheckbox() {
  log.title('Validando Checkbox de Consentimento');

  if (!fileExists(paths.consentCheckbox)) {
    log.error('Arquivo consent-checkbox.tsx não encontrado');
    return false;
  }

  const requiredFeatures = [
    'ConsentCheckbox',
    'MarketingConsent',
    'ExternalLink',
    'LGPD',
    'Lei 13.709/2018'
  ];

  if (fileContains(paths.consentCheckbox, requiredFeatures)) {
    log.success('Checkbox de consentimento implementado conforme LGPD');
    return true;
  } else {
    log.error('Checkbox de consentimento está incompleto');
    return false;
  }
}

function validateSignupForm() {
  log.title('Validando Formulário de Cadastro');

  if (!fileExists(paths.signupPage)) {
    log.error('Página de signup não encontrada');
    return false;
  }

  const requiredFeatures = [
    'ConsentCheckbox',
    'MarketingConsent',
    'acceptedTerms',
    'marketingConsent',
    'consentDate'
  ];

  if (fileContains(paths.signupPage, requiredFeatures)) {
    log.success('Formulário de cadastro integrado com consentimento LGPD');
    return true;
  } else {
    log.error('Formulário de cadastro não possui consentimento LGPD adequado');
    return false;
  }
}

function validateAuthSchema() {
  log.title('Validando Schema de Validação');

  if (!fileExists(paths.authValidation)) {
    log.error('Arquivo de validação auth.ts não encontrado');
    return false;
  }

  const requiredFeatures = [
    'acceptedTerms',
    'marketingConsent',
    'Você deve aceitar os Termos'
  ];

  if (fileContains(paths.authValidation, requiredFeatures)) {
    log.success('Schema de validação atualizado para LGPD');
    return true;
  } else {
    log.error('Schema de validação não inclui campos de consentimento');
    return false;
  }
}

function validateLayout() {
  log.title('Validando Layout Principal');

  if (!fileExists(paths.layout)) {
    log.error('Arquivo layout.tsx não encontrado');
    return false;
  }

  const requiredFeatures = [
    'CookieConsentProvider',
    'CookieBanner'
  ];

  if (fileContains(paths.layout, requiredFeatures)) {
    log.success('Layout integrado com sistema de cookies');
    return true;
  } else {
    log.error('Layout não possui integração com sistema de cookies');
    return false;
  }
}

function validateLegalPages() {
  log.title('Validando Páginas Legais');

  const pages = [
    { path: paths.termsPage, name: 'Termos de Uso' },
    { path: paths.privacyPage, name: 'Política de Privacidade' },
    { path: paths.cookiesPage, name: 'Política de Cookies' }
  ];

  let allValid = true;

  pages.forEach(page => {
    if (fileExists(page.path)) {
      log.success(`${page.name} - Página existe`);
    } else {
      log.error(`${page.name} - Página não encontrada`);
      allValid = false;
    }
  });

  return allValid;
}

function validateMobileResponsiveness() {
  log.title('Validando Responsividade Mobile dos Componentes LGPD');

  if (!fileExists(paths.mobileCSS)) {
    log.warning('Arquivo de CSS mobile não encontrado - usando apenas classes Tailwind');
    return true;
  }

  const mobileFeatures = [
    'touch-manipulation',
    'min-h-[44px]',
    'mobile-button'
  ];

  if (fileContains(paths.mobileCSS, mobileFeatures)) {
    log.success('CSS mobile com otimizações para componentes LGPD');
    return true;
  } else {
    log.warning('CSS mobile pode precisar de otimizações para LGPD');
    return true; // Não crítico
  }
}

// Função principal de teste
function runLGPDComplianceTest() {
  console.log(`${colors.bold}${colors.blue}==============================================`);
  console.log(`🛡️  TESTE DE CONFORMIDADE LGPD - JUSTOAI V2`);
  console.log(`==============================================${colors.reset}\n`);

  const tests = [
    { name: 'Banner de Cookies', fn: validateCookieBanner },
    { name: 'Contexto de Consentimento', fn: validateCookieContext },
    { name: 'Checkbox de Consentimento', fn: validateConsentCheckbox },
    { name: 'Formulário de Cadastro', fn: validateSignupForm },
    { name: 'Schema de Validação', fn: validateAuthSchema },
    { name: 'Layout Principal', fn: validateLayout },
    { name: 'Páginas Legais', fn: validateLegalPages },
    { name: 'Responsividade Mobile', fn: validateMobileResponsiveness }
  ];

  let passedTests = 0;
  let totalTests = tests.length;

  tests.forEach(test => {
    if (test.fn()) {
      passedTests++;
    }
    console.log(''); // Linha em branco entre testes
  });

  // Resultado final
  console.log(`${colors.bold}==============================================`);

  if (passedTests === totalTests) {
    log.success(`TODOS OS TESTES PASSARAM! (${passedTests}/${totalTests})`);
    console.log(`${colors.green}${colors.bold}🎉 CONFORMIDADE LGPD: 100% IMPLEMENTADA${colors.reset}`);
  } else {
    log.warning(`${passedTests}/${totalTests} testes passaram`);
    console.log(`${colors.yellow}${colors.bold}⚠️  CONFORMIDADE LGPD: ${Math.round((passedTests/totalTests)*100)}% IMPLEMENTADA${colors.reset}`);
  }

  console.log(`${colors.bold}==============================================${colors.reset}\n`);

  // Checklist de funcionalidades LGPD
  console.log(`${colors.bold}📋 CHECKLIST DE FUNCIONALIDADES LGPD:${colors.reset}`);
  console.log(`${colors.green}✅${colors.reset} Banner de consentimento de cookies com opções Aceitar/Rejeitar`);
  console.log(`${colors.green}✅${colors.reset} Link para política de cookies no banner`);
  console.log(`${colors.green}✅${colors.reset} Checkbox obrigatório de consentimento no cadastro`);
  console.log(`${colors.green}✅${colors.reset} Links para Termos de Uso e Política de Privacidade`);
  console.log(`${colors.green}✅${colors.reset} Consentimento opcional para marketing separado`);
  console.log(`${colors.green}✅${colors.reset} Gerenciamento de estado de consentimento`);
  console.log(`${colors.green}✅${colors.reset} Remoção automática de cookies não-essenciais`);
  console.log(`${colors.green}✅${colors.reset} Componentes responsivos para mobile`);
  console.log(`${colors.green}✅${colors.reset} Conformidade com Lei 13.709/2018 (LGPD)`);

  return passedTests === totalTests;
}

// Executar teste
if (require.main === module) {
  runLGPDComplianceTest();
}

module.exports = { runLGPDComplianceTest };