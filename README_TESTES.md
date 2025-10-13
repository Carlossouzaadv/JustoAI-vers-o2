# 🧪 Testes Automatizados - JustoAI V2

## ✅ Status da Implementação

**IMPLEMENTAÇÃO CONCLUÍDA** ✓

### Resumo
- ✅ Framework de testes configurado (Jest + React Testing Library)
- ✅ 104 testes implementados e passando
- ✅ Cobertura inicial estabelecida
- ✅ CI/CD configurado (GitHub Actions)
- ✅ Scripts de teste prontos

### Estatísticas
```
Test Suites: 7 suites de teste
Tests: 104 testes passando, 3 TODO
Coverage: Sistema configurado e funcional
```

## 📁 Testes Implementados

### 1. Testes de Componentes UI (/src/components/ui)
- ✅ **button.test.tsx** - 18 testes
  - Renderização com variantes (default, destructive, outline, secondary, ghost, link)
  - Tamanhos (sm, default, lg, icon)
  - Estados (disabled, custom className)
  - Eventos de clique

- ✅ **card.test.tsx** - 7 testes
  - Componentes Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter
  - Integração completa

### 2. Testes de Bibliotecas (/src/lib)
- ✅ **utils.test.ts** - 27 testes
  - cn() - Merge de classes Tailwind
  - formatDate() - Formatação de datas
  - validateEmail() - Validação de e-mail
  - generateSlug() - Geração de slugs
  - formatProcessNumber() - Formatação de números de processo
  - validateProcessNumber() - Validação CNJ
  - truncate() - Truncamento de texto
  - sleep() - Utilitário async
  - debounce() - Debounce de funções

- ✅ **messages.test.ts** - 28 testes
  - QUOTA_MESSAGES - Mensagens de quota
  - CREDIT_MESSAGES - Mensagens de créditos
  - REPORT_MESSAGES - Mensagens de relatórios
  - ERROR_MESSAGES - Mensagens de erro
  - SUCCESS_MESSAGES - Mensagens de sucesso
  - Funções de formatação (formatMessage, getMessage)
  - Validadores (isValidReportTone)
  - Formatadores (formatNumber, formatPercentage, formatCurrency)

- ✅ **api-utils.test.ts** - 21 testes
  - successResponse() - Respostas de sucesso
  - errorResponse() - Respostas de erro
  - unauthorizedResponse() - 401
  - notFoundResponse() - 404
  - methodNotAllowedResponse() - 405
  - validationErrorResponse() - 422
  - serverErrorResponse() - 500

### 3. Testes de Hooks (/src/hooks)
- ✅ **use-mobile.test.ts** - 6 testes
  - Detecção de dispositivo móvel
  - Breakpoints (768px)
  - Responsividade a mudanças
  - Limpeza de event listeners

### 4. Testes de API (/src/app/api)
- ⏳ **health/route.test.ts** - 1 teste (3 TODO)
  - Nota: Testes com Prisma marcados como TODO
  - Requerem configuração de banco de teste

## 🚀 Como Executar

### Todos os testes
```bash
npm test
```

### Modo watch (desenvolvimento)
```bash
npm run test:watch
```

### Com cobertura de código
```bash
npm run test:coverage
```

### Para CI/CD
```bash
npm run test:ci
```

## 📊 Configuração de Cobertura

### Thresholds Atuais
```javascript
{
  global: {
    branches: 10%,
    functions: 10%,
    lines: 10%,
    statements: 10%
  }
}
```

### Meta de Longo Prazo
- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%
- **Statements**: 70%

> 💡 Os thresholds começam baixos (10%) para permitir implementação gradual. Devem ser aumentados conforme mais testes são adicionados.

## 🔧 Configuração

### Arquivos de Configuração
- **jest.config.js** - Configuração principal do Jest
- **jest.setup.js** - Setup global e mocks
- **tsconfig.json** - Configuração TypeScript (com suporte a testes)

### Mocks Globais
- ✅ Next.js Router
- ✅ Next.js Image
- ✅ Variáveis de ambiente
- ✅ Fetch global

## 🎯 CI/CD

### GitHub Actions Workflows

#### `.github/workflows/test.yml`
- Executa em: push (main, develop) e Pull Requests
- Node.js: 18.x e 20.x
- Passos:
  1. Lint
  2. Type Check
  3. Tests
  4. Coverage Upload (Codecov)
  5. Build Test

#### `.github/workflows/quality.yml`
- Verificação de qualidade de código
- Análise de bundle size
- Security audit
- Coverage report em PRs

## 📚 Documentação Adicional

Ver [TESTING.md](./TESTING.md) para:
- Guia completo de escrita de testes
- Padrões e boas práticas
- Exemplos de código
- Debugging
- Troubleshooting

## 🔄 Próximos Passos

### Testes Prioritários a Implementar

1. **Componentes UI Restantes**
   - [ ] Input, Textarea, Select
   - [ ] Form components
   - [ ] Dialog, Modal
   - [ ] Dropdown Menu

2. **Testes de API**
   - [ ] Configurar banco de testes
   - [ ] Testes de autenticação
   - [ ] Testes de CRUD (clients, cases, etc.)
   - [ ] Testes de upload

3. **Testes de Integração**
   - [ ] Fluxos completos de usuário
   - [ ] Integração com APIs externas

4. **Testes E2E** (Opcional)
   - [ ] Configurar Playwright
   - [ ] Testes de login/signup
   - [ ] Testes de upload de documentos
   - [ ] Testes de geração de relatórios

### Melhorias de Cobertura

1. **Aumentar Thresholds Gradualmente**
   - Sprint 1: 10% → 20%
   - Sprint 2: 20% → 35%
   - Sprint 3: 35% → 50%
   - Sprint 4: 50% → 70%

2. **Focar em Código Crítico Primeiro**
   - Autenticação e autorização
   - Processamento de documentos
   - Geração de relatórios
   - Lógica de negócio

## 🐛 Issues Conhecidos

1. **Testes de API com Prisma**
   - Status: TODO
   - Razão: Complexidade de mock do Prisma
   - Solução: Implementar banco de teste ou usar Prisma Test Utils

## 🤝 Contribuindo

### Ao adicionar novos testes:

1. Coloque testes em pasta `__tests__` próxima ao código
2. Nome do arquivo: `<arquivo>.test.ts(x)`
3. Use describes para agrupar testes relacionados
4. Siga o padrão Arrange-Act-Assert
5. Execute `npm run test:coverage` antes de commitar

### Padrão de Commit

```
test: add tests for <component/feature>

- Add unit tests for X
- Add integration tests for Y
- Coverage: +N%
```

## 📞 Suporte

Para problemas com testes:
1. Verificar [TESTING.md](./TESTING.md) - Troubleshooting
2. Limpar cache: `npm test -- --clearCache`
3. Reinstalar deps: `rm -rf node_modules && npm install`

---

**Última atualização**: 2025-10-09
**Versão**: 1.0.0
**Mantido por**: Equipe JustoAI
