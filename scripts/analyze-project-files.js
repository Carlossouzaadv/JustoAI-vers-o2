#!/usr/bin/env node

/**
 * Script de Análise de Arquivos do Projeto - JustoAI V2
 *
 * Este script analisa todos os arquivos do projeto para:
 * 1. Identificar o propósito de cada arquivo
 * 2. Encontrar TODOs e pendências
 * 3. Gerar documentação completa
 */

const fs = require('fs');
const path = require('path');

// Cores para output no terminal
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

// Função para obter todos os arquivos do projeto
function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      // Pular diretórios de build e node_modules
      if (!file.startsWith('.') &&
          file !== 'node_modules' &&
          file !== '.next' &&
          file !== 'dist') {
        arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
      }
    } else {
      // Apenas arquivos de código fonte
      if (file.match(/\.(ts|tsx|js|jsx|css|json)$/) &&
          !file.includes('.test.') &&
          !file.includes('.spec.')) {
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
  const relativePath = path.relative(process.cwd(), filePath);

  const analysis = {
    path: relativePath,
    type: getFileType(filePath),
    purpose: getFilePurpose(relativePath, content),
    todos: findTodos(content),
    imports: findImports(content),
    exports: findExports(content),
    size: content.length,
    lines: lines.length
  };

  return analysis;
}

// Função para determinar o tipo do arquivo
function getFileType(filePath) {
  const ext = path.extname(filePath);
  const fileName = path.basename(filePath);

  if (fileName === 'page.tsx') return 'Next.js Page';
  if (fileName === 'layout.tsx') return 'Next.js Layout';
  if (fileName === 'route.ts') return 'API Route';
  if (fileName === 'middleware.ts') return 'Next.js Middleware';
  if (filePath.includes('/components/')) return 'React Component';
  if (filePath.includes('/lib/')) return 'Library/Utility';
  if (filePath.includes('/hooks/')) return 'React Hook';
  if (filePath.includes('/contexts/')) return 'React Context';
  if (filePath.includes('/scripts/')) return 'Build Script';
  if (ext === '.css') return 'Stylesheet';
  if (ext === '.json') return 'Configuration';

  return 'TypeScript/JavaScript';
}

// Função para determinar o propósito do arquivo
function getFilePurpose(filePath, content) {
  // Buscar comentários no topo do arquivo
  const topComments = content.split('\n').slice(0, 10).join('\n');
  const commentMatch = topComments.match(/\/\*\*(.*?)\*\//s) || topComments.match(/\/\/(.*?)\n/);

  if (commentMatch && commentMatch[1]) {
    return commentMatch[1].trim().replace(/\*/g, '').trim();
  }

  // Inferir propósito pelo caminho e conteúdo
  if (filePath.includes('dashboard')) return 'Interface do dashboard administrativo';
  if (filePath.includes('landing')) return 'Página de landing/marketing';
  if (filePath.includes('api/auth')) return 'Autenticação de usuários';
  if (filePath.includes('api/ai')) return 'Integração com IA/análise automática';
  if (filePath.includes('api/upload')) return 'Upload de documentos/processos';
  if (filePath.includes('api/reports')) return 'Geração e gerenciamento de relatórios';
  if (filePath.includes('api/process')) return 'Gestão de processos jurídicos';
  if (filePath.includes('help/')) return 'Página de documentação/ajuda';
  if (filePath.includes('pricing')) return 'Configuração e exibição de preços';
  if (filePath.includes('components/ui')) return 'Componente de interface reutilizável';
  if (filePath.includes('security')) return 'Funcionalidade de segurança';
  if (filePath.includes('performance')) return 'Otimização de performance';
  if (filePath.includes('mobile')) return 'Otimizações para dispositivos móveis';

  // Analisar conteúdo para palavras-chave
  if (content.includes('export default function') && content.includes('return')) {
    return 'Componente React ou página';
  }
  if (content.includes('NextRequest') && content.includes('NextResponse')) {
    return 'Handler de API route';
  }
  if (content.includes('createContext') || content.includes('useContext')) {
    return 'Context provider para gerenciamento de estado';
  }
  if (content.includes('useState') || content.includes('useEffect')) {
    return 'Hook customizado ou componente com estado';
  }

  return 'Funcionalidade geral do sistema';
}

// Função para encontrar TODOs
function findTodos(content) {
  const todos = [];
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    const todoMatch = line.match(/(TODO|FIXME|HACK|XXX|NOTE)[\s:]*(.+)/i);
    if (todoMatch) {
      todos.push({
        line: index + 1,
        type: todoMatch[1].toUpperCase(),
        description: todoMatch[2].trim()
      });
    }
  });

  return todos;
}

// Função para encontrar imports
function findImports(content) {
  const imports = [];
  const importMatches = content.match(/import.*from ['"`]([^'"`]+)['"`]/g);

  if (importMatches) {
    importMatches.forEach(match => {
      const pathMatch = match.match(/from ['"`]([^'"`]+)['"`]/);
      if (pathMatch) {
        imports.push(pathMatch[1]);
      }
    });
  }

  return [...new Set(imports)]; // Remove duplicatas
}

// Função para encontrar exports
function findExports(content) {
  const exports = [];

  // Export default
  const defaultExport = content.match(/export default (function|class|const|let|var)?\s*(\w+)/);
  if (defaultExport) {
    exports.push({ type: 'default', name: defaultExport[2] || 'anonymous' });
  }

  // Named exports
  const namedExports = content.match(/export\s+(function|class|const|let|var)\s+(\w+)/g);
  if (namedExports) {
    namedExports.forEach(exp => {
      const nameMatch = exp.match(/export\s+(?:function|class|const|let|var)\s+(\w+)/);
      if (nameMatch) {
        exports.push({ type: 'named', name: nameMatch[1] });
      }
    });
  }

  return exports;
}

// Função principal
function analyzeProject() {
  console.log(`${colors.bold}${colors.blue}==========================================`);
  console.log(`📁 ANÁLISE COMPLETA DO PROJETO - JUSTOAI V2`);
  console.log(`==========================================${colors.reset}\n`);

  const basePath = process.cwd();
  const srcPath = path.join(basePath, 'src');
  const libPath = path.join(basePath, 'lib');
  const scriptsPath = path.join(basePath, 'scripts');

  console.log(`${colors.blue}Analisando arquivos do projeto...${colors.reset}`);

  // Obter todos os arquivos
  let allFiles = [];
  if (fs.existsSync(srcPath)) allFiles = allFiles.concat(getAllFiles(srcPath));
  if (fs.existsSync(libPath)) allFiles = allFiles.concat(getAllFiles(libPath));
  if (fs.existsSync(scriptsPath)) allFiles = allFiles.concat(getAllFiles(scriptsPath));

  console.log(`${colors.green}Encontrados ${allFiles.length} arquivos para análise${colors.reset}\n`);

  // Analisar cada arquivo
  const analyses = allFiles.map(analyzeFile);

  // Agrupar por categoria
  const categories = {
    'Pages (Next.js)': analyses.filter(a => a.type === 'Next.js Page'),
    'API Routes': analyses.filter(a => a.type === 'API Route'),
    'React Components': analyses.filter(a => a.type === 'React Component'),
    'Libraries/Utilities': analyses.filter(a => a.type === 'Library/Utility'),
    'Hooks': analyses.filter(a => a.type === 'React Hook'),
    'Contexts': analyses.filter(a => a.type === 'React Context'),
    'Styles': analyses.filter(a => a.type === 'Stylesheet'),
    'Scripts': analyses.filter(a => a.type === 'Build Script'),
    'Configuration': analyses.filter(a => a.type === 'Configuration'),
    'Middleware': analyses.filter(a => a.type === 'Next.js Middleware'),
    'Layouts': analyses.filter(a => a.type === 'Next.js Layout'),
    'Other': analyses.filter(a => a.type === 'TypeScript/JavaScript')
  };

  // Gerar relatório
  let report = `# 📁 Documentação Completa do Projeto JustoAI V2\n\n`;
  report += `## Resumo do Projeto\n\n`;
  report += `- **Total de arquivos analisados**: ${analyses.length}\n`;
  report += `- **Linhas de código total**: ${analyses.reduce((sum, a) => sum + a.lines, 0).toLocaleString()}\n`;
  report += `- **Tamanho total**: ${(analyses.reduce((sum, a) => sum + a.size, 0) / 1024 / 1024).toFixed(2)} MB\n\n`;

  // TODOs globais
  const allTodos = analyses.flatMap(a => a.todos.map(t => ({ ...t, file: a.path })));
  report += `## 🔄 TODOs e Pendências (${allTodos.length})\n\n`;

  if (allTodos.length > 0) {
    const todosByType = {};
    allTodos.forEach(todo => {
      if (!todosByType[todo.type]) todosByType[todo.type] = [];
      todosByType[todo.type].push(todo);
    });

    Object.entries(todosByType).forEach(([type, todos]) => {
      report += `### ${type} (${todos.length})\n\n`;
      todos.forEach(todo => {
        report += `- **${todo.file}:${todo.line}** - ${todo.description}\n`;
      });
      report += `\n`;
    });
  } else {
    report += `✅ **Nenhum TODO encontrado** - Projeto sem pendências conhecidas\n\n`;
  }

  // Análise por categoria
  Object.entries(categories).forEach(([categoryName, files]) => {
    if (files.length === 0) return;

    report += `## ${categoryName} (${files.length} arquivos)\n\n`;

    files.forEach(file => {
      report += `### \`${file.path}\`\n\n`;
      report += `**Propósito**: ${file.purpose}\n\n`;

      if (file.exports.length > 0) {
        report += `**Exports**: `;
        report += file.exports.map(exp =>
          exp.type === 'default' ? `${exp.name} (default)` : exp.name
        ).join(', ');
        report += `\n\n`;
      }

      if (file.todos.length > 0) {
        report += `**Pendências**:\n`;
        file.todos.forEach(todo => {
          report += `- 🔄 **Linha ${todo.line}** (${todo.type}): ${todo.description}\n`;
        });
        report += `\n`;
      }

      report += `**Estatísticas**: ${file.lines} linhas, ${(file.size / 1024).toFixed(1)}KB\n\n`;

      if (file.imports.length > 5) {
        report += `**Principais dependências**: ${file.imports.slice(0, 5).join(', ')}...\n\n`;
      } else if (file.imports.length > 0) {
        report += `**Dependências**: ${file.imports.join(', ')}\n\n`;
      }

      report += `---\n\n`;
    });
  });

  // Estatísticas finais
  report += `## 📊 Estatísticas do Projeto\n\n`;
  report += `### Distribuição por Tipo de Arquivo\n\n`;
  Object.entries(categories).forEach(([categoryName, files]) => {
    if (files.length > 0) {
      const totalLines = files.reduce((sum, f) => sum + f.lines, 0);
      report += `- **${categoryName}**: ${files.length} arquivos, ${totalLines.toLocaleString()} linhas\n`;
    }
  });

  report += `\n### Arquivos Mais Complexos (Top 10)\n\n`;
  const largestFiles = analyses
    .sort((a, b) => b.lines - a.lines)
    .slice(0, 10);

  largestFiles.forEach((file, index) => {
    report += `${index + 1}. **${file.path}** - ${file.lines.toLocaleString()} linhas\n`;
  });

  report += `\n### Arquivos com Mais TODOs\n\n`;
  const filesWithTodos = analyses
    .filter(a => a.todos.length > 0)
    .sort((a, b) => b.todos.length - a.todos.length)
    .slice(0, 10);

  if (filesWithTodos.length > 0) {
    filesWithTodos.forEach((file, index) => {
      report += `${index + 1}. **${file.path}** - ${file.todos.length} pendência(s)\n`;
    });
  } else {
    report += `✅ Nenhum arquivo com TODOs pendentes\n`;
  }

  report += `\n---\n\n`;
  report += `**Relatório gerado em**: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}\n`;
  report += `**Versão**: JustoAI V2.0\n`;

  // Salvar relatório
  const reportPath = path.join(process.cwd(), 'PROJECT_FILES_DOCUMENTATION.md');
  fs.writeFileSync(reportPath, report, 'utf8');

  console.log(`${colors.green}✅ Análise concluída!${colors.reset}`);
  console.log(`${colors.blue}📄 Relatório salvo em: ${reportPath}${colors.reset}\n`);

  // Exibir resumo no terminal
  console.log(`${colors.bold}📊 RESUMO DA ANÁLISE:${colors.reset}`);
  console.log(`${colors.green}• ${analyses.length} arquivos analisados${colors.reset}`);
  console.log(`${colors.blue}• ${analyses.reduce((sum, a) => sum + a.lines, 0).toLocaleString()} linhas de código${colors.reset}`);
  console.log(`${colors.yellow}• ${allTodos.length} TODOs encontrados${colors.reset}`);
  console.log(`${colors.cyan}• ${Object.entries(categories).filter(([_, files]) => files.length > 0).length} categorias de arquivos${colors.reset}`);

  return true;
}

// Executar análise
if (require.main === module) {
  try {
    analyzeProject();
  } catch (error) {
    console.error(`${colors.red}Erro na análise: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

module.exports = { analyzeProject };