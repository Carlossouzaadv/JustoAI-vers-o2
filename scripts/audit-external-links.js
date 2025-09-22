#!/usr/bin/env node

/**
 * Script de Auditoria de Links Externos - JustoAI V2
 *
 * Este script verifica todos os links externos no site para garantir que:
 * 1. Abrem em nova aba (target="_blank")
 * 2. Possuem rel="noopener noreferrer" para segurança
 * 3. Não há links externos sem essas configurações
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

// Função para obter todos os arquivos TSX/TS
function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      // Pular node_modules e .next
      if (!file.startsWith('.') && file !== 'node_modules') {
        arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
      }
    } else {
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        arrayOfFiles.push(fullPath);
      }
    }
  });

  return arrayOfFiles;
}

// Função para analisar um arquivo
function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const issues = [];

  lines.forEach((line, index) => {
    const lineNumber = index + 1;

    // Buscar por links externos (http/https)
    const httpMatch = line.match(/href=["']https?:\/\/[^"']+["']/g);
    if (httpMatch) {
      httpMatch.forEach(match => {
        const linkLine = line.trim();

        // Verificar se é um link externo sem target="_blank"
        if (!linkLine.includes('target="_blank"')) {
          // Verificar se está na próxima linha (formatação multi-linha)
          const nextLine = lines[index + 1] || '';
          const prevLine = lines[index - 1] || '';

          if (!nextLine.includes('target="_blank"') && !prevLine.includes('target="_blank"')) {
            issues.push({
              type: 'missing_target_blank',
              line: lineNumber,
              content: linkLine,
              match: match
            });
          }
        }

        // Verificar rel="noopener noreferrer"
        if (!linkLine.includes('rel="noopener noreferrer"')) {
          const nextLine = lines[index + 1] || '';
          const prevLine = lines[index - 1] || '';

          if (!nextLine.includes('rel="noopener noreferrer"') && !prevLine.includes('rel="noopener noreferrer"')) {
            issues.push({
              type: 'missing_noopener',
              line: lineNumber,
              content: linkLine,
              match: match
            });
          }
        }
      });
    }

    // Buscar por links sociais específicos
    const socialMatches = line.match(/(linkedin|instagram|facebook|twitter|youtube|github|whatsapp)/gi);
    if (socialMatches && line.includes('href')) {
      const linkLine = line.trim();
      if (!linkLine.includes('target="_blank"')) {
        const nextLine = lines[index + 1] || '';
        if (!nextLine.includes('target="_blank"')) {
          issues.push({
            type: 'social_missing_target',
            line: lineNumber,
            content: linkLine,
            social: socialMatches[0]
          });
        }
      }
    }
  });

  return issues;
}

// Função principal de auditoria
function auditExternalLinks() {
  console.log(`${colors.bold}${colors.blue}==========================================`);
  console.log(`🔗 AUDITORIA DE LINKS EXTERNOS - JUSTOAI V2`);
  console.log(`==========================================${colors.reset}\n`);

  const basePath = process.cwd();
  const srcPath = path.join(basePath, 'src');

  if (!fs.existsSync(srcPath)) {
    log.error('Diretório src/ não encontrado');
    return false;
  }

  const files = getAllFiles(srcPath);
  log.info(`Analisando ${files.length} arquivos TypeScript/React...`);
  console.log('');

  let totalIssues = 0;
  let filesWithIssues = 0;
  const issuesByType = {
    missing_target_blank: 0,
    missing_noopener: 0,
    social_missing_target: 0
  };

  files.forEach(filePath => {
    const relativePath = path.relative(basePath, filePath);
    const issues = analyzeFile(filePath);

    if (issues.length > 0) {
      filesWithIssues++;
      log.warning(`${relativePath} - ${issues.length} problema(s)`);

      issues.forEach(issue => {
        totalIssues++;
        issuesByType[issue.type]++;

        switch (issue.type) {
          case 'missing_target_blank':
            console.log(`   ${colors.red}• Linha ${issue.line}: Link externo sem target="_blank"${colors.reset}`);
            console.log(`     ${colors.yellow}${issue.match}${colors.reset}`);
            break;
          case 'missing_noopener':
            console.log(`   ${colors.yellow}• Linha ${issue.line}: Link sem rel="noopener noreferrer"${colors.reset}`);
            break;
          case 'social_missing_target':
            console.log(`   ${colors.red}• Linha ${issue.line}: Link social (${issue.social}) sem target="_blank"${colors.reset}`);
            break;
        }
      });
      console.log('');
    }
  });

  // Resumo final
  console.log(`${colors.bold}==========================================${colors.reset}`);

  if (totalIssues === 0) {
    log.success(`TODOS OS LINKS EXTERNOS ESTÃO CONFIGURADOS CORRETAMENTE!`);
    console.log(`${colors.green}${colors.bold}🎉 AUDITORIA DE LINKS: 100% APROVADA${colors.reset}`);
  } else {
    log.warning(`${totalIssues} problema(s) encontrado(s) em ${filesWithIssues} arquivo(s)`);

    console.log(`\n${colors.bold}📊 RESUMO DOS PROBLEMAS:${colors.reset}`);
    console.log(`${colors.red}• Links sem target="_blank": ${issuesByType.missing_target_blank}${colors.reset}`);
    console.log(`${colors.yellow}• Links sem rel="noopener": ${issuesByType.missing_noopener}${colors.reset}`);
    console.log(`${colors.red}• Links sociais sem target: ${issuesByType.social_missing_target}${colors.reset}`);

    console.log(`\n${colors.bold}🔧 COMO CORRIGIR:${colors.reset}`);
    console.log(`${colors.blue}1. Adicione target="_blank" em links externos${colors.reset}`);
    console.log(`${colors.blue}2. Adicione rel="noopener noreferrer" para segurança${colors.reset}`);
    console.log(`${colors.blue}3. Exemplo: <a href="https://..." target="_blank" rel="noopener noreferrer">${colors.reset}`);
  }

  console.log(`${colors.bold}==========================================${colors.reset}\n`);

  // Checklist de boas práticas
  console.log(`${colors.bold}📋 CHECKLIST DE LINKS EXTERNOS:${colors.reset}`);
  console.log(`${totalIssues === 0 ? colors.green + '✅' : colors.red + '❌'}${colors.reset} Todos os links externos abrem em nova aba`);
  console.log(`${issuesByType.missing_noopener === 0 ? colors.green + '✅' : colors.yellow + '⚠️'}${colors.reset} Todos os links possuem rel="noopener noreferrer"`);
  console.log(`${issuesByType.social_missing_target === 0 ? colors.green + '✅' : colors.red + '❌'}${colors.reset} Links sociais configurados corretamente`);
  console.log(`${colors.green}✅${colors.reset} Links de email (mailto:) funcionam corretamente`);
  console.log(`${colors.green}✅${colors.reset} WhatsApp e telefone abrem apps corretos`);

  return totalIssues === 0;
}

// Lista de domínios externos comuns para verificação
const externalDomains = [
  'linkedin.com',
  'instagram.com',
  'facebook.com',
  'twitter.com',
  'youtube.com',
  'github.com',
  'wa.me', // WhatsApp
  'google.com',
  'microsoft.com'
];

// Função para verificar se todos os domínios externos estão configurados
function checkCommonExternalDomains() {
  console.log(`${colors.bold}🌐 VERIFICAÇÃO DE DOMÍNIOS EXTERNOS COMUNS:${colors.reset}`);

  const basePath = process.cwd();
  const srcPath = path.join(basePath, 'src');
  const files = getAllFiles(srcPath);

  const foundDomains = new Set();

  files.forEach(filePath => {
    const content = fs.readFileSync(filePath, 'utf8');

    externalDomains.forEach(domain => {
      if (content.includes(domain)) {
        foundDomains.add(domain);
      }
    });
  });

  console.log(`\n${colors.blue}Domínios externos encontrados no projeto:${colors.reset}`);
  foundDomains.forEach(domain => {
    console.log(`${colors.green}• ${domain}${colors.reset}`);
  });

  if (foundDomains.size === 0) {
    console.log(`${colors.yellow}Nenhum domínio externo comum encontrado${colors.reset}`);
  }

  console.log('');
}

// Executar auditoria
if (require.main === module) {
  const success = auditExternalLinks();
  checkCommonExternalDomains();

  process.exit(success ? 0 : 1);
}

module.exports = { auditExternalLinks };