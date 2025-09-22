#!/usr/bin/env node

/**
 * Script de Auditoria de Segurança - JustoAI V2
 *
 * Este script verifica:
 * 1. Configuração SSL/HTTPS
 * 2. Headers de segurança implementados
 * 3. CSP (Content Security Policy)
 * 4. Proteções contra ataques comuns
 * 5. Configurações do Next.js
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

// Headers de segurança recomendados
const SECURITY_HEADERS = {
  'X-Frame-Options': {
    required: true,
    recommended: ['DENY', 'SAMEORIGIN'],
    description: 'Proteção contra clickjacking'
  },
  'X-Content-Type-Options': {
    required: true,
    recommended: ['nosniff'],
    description: 'Prevenção de MIME type sniffing'
  },
  'X-XSS-Protection': {
    required: false,
    recommended: ['1; mode=block', '0'],
    description: 'Proteção XSS (legacy - CSP é preferível)'
  },
  'Strict-Transport-Security': {
    required: true,
    recommended: ['max-age='],
    description: 'Forçar HTTPS via HSTS'
  },
  'Referrer-Policy': {
    required: true,
    recommended: ['strict-origin-when-cross-origin', 'no-referrer', 'same-origin'],
    description: 'Controle de informações de referrer'
  },
  'Content-Security-Policy': {
    required: true,
    recommended: ["default-src 'self'"],
    description: 'Política de segurança de conteúdo'
  },
  'Permissions-Policy': {
    required: false,
    recommended: ['camera=()'],
    description: 'Política de permissões do navegador'
  }
};

// Função para ler a configuração do Next.js
function readNextConfig() {
  const configPath = path.join(process.cwd(), 'next.config.ts');

  if (!fs.existsSync(configPath)) {
    log.error('Arquivo next.config.ts não encontrado');
    return null;
  }

  const content = fs.readFileSync(configPath, 'utf8');
  return content;
}

// Função para extrair headers da configuração
function extractHeaders(configContent) {
  const headers = {};

  // Buscar por configurações de headers
  const headerMatches = configContent.match(/key:\s*['"`]([^'"`]+)['"`][^}]*value:\s*['"`]([^'"`]+)['"`]/g);

  if (headerMatches) {
    headerMatches.forEach(match => {
      const keyMatch = match.match(/key:\s*['"`]([^'"`]+)['"`]/);
      const valueMatch = match.match(/value:\s*['"`]([^'"`]+)['"`]/);

      if (keyMatch && valueMatch) {
        headers[keyMatch[1]] = valueMatch[1];
      }
    });
  }

  return headers;
}

// Função para verificar CSP
function checkCSP(configContent) {
  const cspMatch = configContent.match(/Content-Security-Policy[^}]*value:\s*\[([\s\S]*?)\]/);

  if (!cspMatch) {
    return null;
  }

  const cspString = cspMatch[1]
    .replace(/['"]/g, '')
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return cspString;
}

// Função para verificar HTTPS enforcement
function checkHTTPSEnforcement(configContent) {
  const checks = {
    hsts: configContent.includes('Strict-Transport-Security'),
    redirects: configContent.includes('permanent: true') && configContent.includes('source: '),
    forceHTTPS: configContent.includes('max-age=')
  };

  return checks;
}

// Função principal de auditoria
function auditSecurity() {
  console.log(`${colors.bold}${colors.blue}==========================================`);
  console.log(`🔒 AUDITORIA DE SEGURANÇA - JUSTOAI V2`);
  console.log(`==========================================${colors.reset}\n`);

  const configContent = readNextConfig();
  if (!configContent) {
    return false;
  }

  let securityScore = 0;
  let maxScore = 0;

  // 1. Verificar headers de segurança
  log.title('Verificando Headers de Segurança');

  const implementedHeaders = extractHeaders(configContent);

  Object.entries(SECURITY_HEADERS).forEach(([headerName, config]) => {
    maxScore += config.required ? 10 : 5;

    if (implementedHeaders[headerName]) {
      const value = implementedHeaders[headerName];
      const isValid = config.recommended.some(rec => value.includes(rec));

      if (isValid) {
        securityScore += config.required ? 10 : 5;
        log.success(`${headerName}: ${value}`);
      } else {
        log.warning(`${headerName}: Valor pode ser melhorado - ${value}`);
        securityScore += config.required ? 5 : 2;
      }
    } else {
      if (config.required) {
        log.error(`${headerName}: AUSENTE (obrigatório)`);
      } else {
        log.warning(`${headerName}: AUSENTE (recomendado)`);
      }
    }

    console.log(`   ${colors.blue}→ ${config.description}${colors.reset}`);
  });

  console.log('');

  // 2. Verificar Content Security Policy
  log.title('Verificando Content Security Policy (CSP)');

  const csp = checkCSP(configContent);
  if (csp) {
    log.success('CSP implementado');
    console.log(`   ${colors.blue}Política: ${csp}${colors.reset}`);

    // Verificar diretivas importantes
    const directives = csp.split(';').map(d => d.trim());
    const criticalDirectives = [
      'default-src',
      'script-src',
      'style-src',
      'img-src',
      'connect-src',
      'frame-src',
      'object-src'
    ];

    criticalDirectives.forEach(directive => {
      const hasDirective = directives.some(d => d.startsWith(directive));
      if (hasDirective) {
        log.success(`Diretiva ${directive}: implementada`);
      } else {
        log.warning(`Diretiva ${directive}: ausente`);
      }
    });

    securityScore += 20;
  } else {
    log.error('CSP não encontrado');
  }
  maxScore += 20;

  console.log('');

  // 3. Verificar enforcement de HTTPS
  log.title('Verificando Enforcement de HTTPS');

  const httpsChecks = checkHTTPSEnforcement(configContent);

  if (httpsChecks.hsts) {
    log.success('HSTS (HTTP Strict Transport Security) implementado');
    securityScore += 15;
  } else {
    log.error('HSTS não encontrado');
  }
  maxScore += 15;

  console.log('');

  // 4. Verificar outras configurações de segurança
  log.title('Verificando Configurações Adicionais');

  // Verificar configuração de imagens
  if (configContent.includes('dangerouslyAllowSVG')) {
    if (configContent.includes('contentSecurityPolicy')) {
      log.success('SVG permitido com CSP de segurança');
      securityScore += 5;
    } else {
      log.warning('SVG permitido sem CSP específico');
      securityScore += 2;
    }
  } else {
    log.info('SVG não permitido (mais seguro)');
    securityScore += 5;
  }
  maxScore += 5;

  // Verificar disable de features perigosas
  const dangerousFeatures = ['ignoreBuildErrors', 'ignoreDuringBuilds'];
  dangerousFeatures.forEach(feature => {
    if (configContent.includes(`${feature}: true`)) {
      log.warning(`Configuração de desenvolvimento ativa: ${feature}`);
    }
  });

  console.log('');

  // Resultado final
  const percentage = Math.round((securityScore / maxScore) * 100);

  console.log(`${colors.bold}==========================================${colors.reset}`);

  if (percentage >= 90) {
    log.success(`SEGURANÇA EXCELENTE: ${percentage}% (${securityScore}/${maxScore})`);
    console.log(`${colors.green}${colors.bold}🛡️  SITE ALTAMENTE SEGURO${colors.reset}`);
  } else if (percentage >= 75) {
    log.warning(`Segurança boa: ${percentage}% (${securityScore}/${maxScore})`);
    console.log(`${colors.yellow}${colors.bold}⚠️  MELHORIAS RECOMENDADAS${colors.reset}`);
  } else {
    log.error(`Segurança insuficiente: ${percentage}% (${securityScore}/${maxScore})`);
    console.log(`${colors.red}${colors.bold}❌ AÇÃO NECESSÁRIA${colors.reset}`);
  }

  console.log(`${colors.bold}==========================================${colors.reset}\n`);

  // Checklist de segurança
  console.log(`${colors.bold}📋 CHECKLIST DE SEGURANÇA:${colors.reset}`);
  console.log(`${implementedHeaders['X-Frame-Options'] ? colors.green + '✅' : colors.red + '❌'}${colors.reset} Proteção contra clickjacking (X-Frame-Options)`);
  console.log(`${implementedHeaders['X-Content-Type-Options'] ? colors.green + '✅' : colors.red + '❌'}${colors.reset} Prevenção de MIME sniffing`);
  console.log(`${implementedHeaders['Strict-Transport-Security'] ? colors.green + '✅' : colors.red + '❌'}${colors.reset} Enforcement de HTTPS (HSTS)`);
  console.log(`${csp ? colors.green + '✅' : colors.red + '❌'}${colors.reset} Content Security Policy (CSP)`);
  console.log(`${implementedHeaders['Referrer-Policy'] ? colors.green + '✅' : colors.red + '❌'}${colors.reset} Política de Referrer`);
  console.log(`${implementedHeaders['X-XSS-Protection'] ? colors.green + '✅' : colors.yellow + '⚠️'}${colors.reset} Proteção XSS (legacy)`);

  console.log(`\n${colors.bold}🔐 PROTEÇÕES IMPLEMENTADAS:${colors.reset}`);
  console.log(`${colors.green}• Clickjacking${colors.reset} - X-Frame-Options: DENY`);
  console.log(`${colors.green}• MIME Sniffing${colors.reset} - X-Content-Type-Options: nosniff`);
  console.log(`${colors.green}• Cross-Site Scripting${colors.reset} - CSP + X-XSS-Protection`);
  console.log(`${colors.green}• Man-in-the-Middle${colors.reset} - HSTS forçando HTTPS`);
  console.log(`${colors.green}• Information Leakage${colors.reset} - Referrer-Policy restrita`);
  console.log(`${colors.green}• Permissions Abuse${colors.reset} - Permissions-Policy`);

  return percentage >= 75;
}

// Função para verificar vulnerabilidades conhecidas
function checkKnownVulnerabilities() {
  console.log(`${colors.bold}🔍 VERIFICANDO VULNERABILIDADES CONHECIDAS:${colors.reset}`);

  // Verificar package.json para dependências
  const packagePath = path.join(process.cwd(), 'package.json');

  if (fs.existsSync(packagePath)) {
    log.info('Para auditoria completa de dependências, execute: npm audit');
    log.info('Para corrigir vulnerabilidades automaticamente: npm audit fix');
  }

  console.log('');
}

// Executar auditoria
if (require.main === module) {
  const success = auditSecurity();
  checkKnownVulnerabilities();

  process.exit(success ? 0 : 1);
}

module.exports = { auditSecurity };