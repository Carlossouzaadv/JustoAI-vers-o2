# Guia de Testes - JustoAI V2

## 📋 Visão Geral

Este projeto utiliza uma suite completa de testes automatizados para garantir qualidade e confiabilidade.

### Tecnologias

- **Jest**: Framework de testes
- **React Testing Library**: Testes de componentes React
- **Testing Library User Event**: Simulação de interações do usuário
- **Node Mocks HTTP**: Testes de API routes

## 🚀 Executando Testes

### Comandos Disponíveis

```bash
# Executar todos os testes
npm test

# Executar testes em modo watch (desenvolvimento)
npm run test:watch

# Executar testes com relatório de cobertura
npm run test:coverage

# Executar testes para CI/CD
npm run test:ci
```

## 📁 Estrutura de Testes

```
src/
├── components/
│   └── ui/
│       ├── button.tsx
│       └── __tests__/
│           └── button.test.tsx
├── lib/
│   ├── utils.ts
│   └── __tests__/
│       └── utils.test.ts
├── app/
│   └── api/
│       └── health/
│           ├── route.ts
│           └── __tests__/
│               └── route.test.ts
└── hooks/
    ├── use-mobile.ts
    └── __tests__/
        └── use-mobile.test.ts
```

## 🎯 Cobertura de Código

### Metas de Cobertura

- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%
- **Statements**: 70%

### Visualizar Relatório de Cobertura

Após executar `npm run test:coverage`, abra:

```bash
# Windows
start coverage/lcov-report/index.html

# Linux/Mac
open coverage/lcov-report/index.html
```

## ✍️ Escrevendo Testes

### Testes de Componentes

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '../button'

describe('Button Component', () => {
  it('renders button with correct text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument()
  })

  it('calls onClick handler when clicked', async () => {
    const user = userEvent.setup()
    const handleClick = jest.fn()

    render(<Button onClick={handleClick}>Click me</Button>)
    await user.click(screen.getByRole('button'))

    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})
```

### Testes de Hooks

```typescript
import { renderHook, act } from '@testing-library/react'
import { useIsMobile } from '../use-mobile'

describe('useIsMobile Hook', () => {
  it('returns false for desktop width', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    })

    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })
})
```

### Testes de API Routes

```typescript
/**
 * @jest-environment node
 */
import { GET } from '../route'
import { NextRequest } from 'next/server'

describe('/api/health', () => {
  it('returns 200 for healthy status', async () => {
    const mockRequest = new NextRequest('http://localhost:3000/api/health')
    const response = await GET(mockRequest)

    expect(response.status).toBe(200)
  })
})
```

### Testes de Utilitários

```typescript
import { validateEmail, formatDate } from '../utils'

describe('Utils Library', () => {
  describe('validateEmail', () => {
    it('validates correct email', () => {
      expect(validateEmail('test@example.com')).toBe(true)
    })

    it('rejects invalid email', () => {
      expect(validateEmail('invalid-email')).toBe(false)
    })
  })
})
```

## 🔧 Configuração

### jest.config.js

Configuração principal do Jest com Next.js.

### jest.setup.js

Configurações globais e mocks:
- Mock do Next.js Router
- Mock do Next.js Image
- Variáveis de ambiente para testes

## 🎭 Mocks

### Mock de Módulos

```typescript
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}))
```

### Mock de Funções

```typescript
const mockFn = jest.fn()
mockFn.mockResolvedValue({ success: true })
```

## 🐛 Debugging Testes

### Executar teste específico

```bash
# Por nome do arquivo
npm test button.test

# Por describe/it
npm test -t "Button Component"
```

### Debug com VS Code

Adicione ao `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand", "--no-cache"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

## 📊 CI/CD

### GitHub Actions

Os testes são executados automaticamente em:
- Push para `main` ou `develop`
- Pull Requests

Workflows configurados:
- `.github/workflows/test.yml` - Executa testes
- `.github/workflows/quality.yml` - Verifica qualidade do código

## 📚 Boas Práticas

1. **Organize os testes** junto ao código que testam
2. **Use describes** para agrupar testes relacionados
3. **Nomes descritivos** para os testes
4. **Arrange-Act-Assert** pattern
5. **Mock apenas o necessário**
6. **Limpe mocks** entre testes com `jest.clearAllMocks()`
7. **Teste casos de erro** além dos casos de sucesso
8. **Mantenha testes simples** e focados

## 🆘 Troubleshooting

### Erro: Cannot find module

```bash
npm install
```

### Testes falhando no CI mas passando localmente

```bash
npm run test:ci
```

### Problemas com cache

```bash
npm test -- --clearCache
```

## 📖 Recursos

- [Jest Documentation](https://jestjs.io/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
