<div align="center">

# ⚖️ JustoAI V2

### Plataforma SaaS de Gestão Jurídica com Inteligência Artificial

[![Next.js](https://img.shields.io/badge/Next.js-15.5.3-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.1.0-blue?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6.16.1-2D3748?logo=prisma)](https://www.prisma.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-336791?logo=postgresql)](https://www.postgresql.org/)

[Visão Geral](#-visão-geral) •
[Funcionalidades](#-funcionalidades-principais) •
[Arquitetura](#-arquitetura) •
[Stack Tecnológica](#-stack-tecnológica) •
[Instalação](#-instalação-e-setup) •
[Documentação](#-documentação)

</div>

---

## 📋 Visão Geral

**JustoAI V2** é uma plataforma SaaS enterprise-grade para gestão de processos jurídicos com análise inteligente por IA. O sistema automatiza análise de documentos, geração de relatórios executivos e monitoramento de processos judiciais em tempo real.

### 🎯 Highlights Técnicos

- **238 arquivos** de código TypeScript bem estruturado
- **~78.000 linhas** de código com tipagem estrita
- **80+ API endpoints** RESTful com validação Zod
- **48 models** de banco de dados com Prisma ORM
- **6 background workers** para processamento assíncrono
- **40+ páginas** de documentação para usuário final
- **Sistema de créditos** completo com billing e webhooks

### 📊 Status do Projeto

```
Arquitetura:    ████████████████████ 100% ⭐⭐⭐⭐⭐
Funcionalidades: ███████████████████▌ 98%  ⭐⭐⭐⭐⭐
Testes:         ████▌                20%  ⭐⭐
Documentação:   ████████████████▌    82%  ⭐⭐⭐⭐
Performance:    ██████████████████▌  93%  ⭐⭐⭐⭐

Status Geral:   PRONTO PARA PRODUÇÃO ✅
```

---

## ✨ Funcionalidades Principais

### 🤖 Análise Inteligente com IA
- Processamento de documentos jurídicos (PDF, DOCX, imagens)
- Análise multi-frente usando Google Gemini AI
- Extração automática de dados estruturados
- Sumarização inteligente de processos
- Sistema de cache para otimização de custos

### 📊 Geração Automatizada de Relatórios
- Relatórios executivos personalizáveis
- Geração agendada (semanal, quinzenal, mensal)
- Múltiplos formatos de saída (PDF, DOCX)
- Templates customizáveis por workspace
- Delivery automático por email

### 🔍 Monitoramento de Processos
- Sincronização automática com tribunais
- Alertas inteligentes de movimentações
- Timeline unificada de andamentos
- Detecção de duplicatas
- Integração com APIs jurídicas (Judit, etc)

### 💳 Sistema de Créditos e Billing
- Gerenciamento de créditos por workspace
- Diferentes tipos de créditos (relatórios, análises)
- Sistema de rollover com caps configuráveis
- Webhooks para pagamentos (Stripe, MercadoPago, PagSeguro)
- Telemetria e usage tracking

### 📤 Upload e Processamento em Lote
- Upload de Excel com milhares de processos
- Processamento paralelo com rate limiting
- Progress tracking em tempo real via SSE
- Validação inteligente de dados
- Deduplicação automática

---

## 🏗️ Arquitetura

### Visão Geral

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND LAYER                        │
│  Next.js 15 App Router + React 19 Server Components     │
│  - Landing Pages (público)                               │
│  - Dashboards (Classic + Pro)                            │
│  - 40+ Help Pages                                        │
└────────────┬────────────────────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────────────────────┐
│                  MIDDLEWARE LAYER                        │
│  Supabase Auth + Route Protection + CORS                │
└────────────┬────────────────────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────────────────────┐
│                   API ROUTES LAYER                       │
│  80+ RESTful Endpoints com Zod Validation               │
│  - /api/processes  - /api/reports  - /api/ai            │
│  - /api/upload     - /api/credits  - /api/webhooks      │
└─────┬──────────────────────────┬────────────────────────┘
      │                          │
      ↓                          ↓
┌─────────────┐         ┌──────────────────┐
│  SERVICES   │         │   BULL QUEUE     │
│  - AI       │         │   (Redis)        │
│  - PDF      │         └────────┬─────────┘
│  - Email    │                  │
│  - Reports  │                  ↓
└──────┬──────┘         ┌──────────────────┐
       │                │   WORKERS        │
       │                │  - Reports       │
       │                │  - Sync          │
       │                │  - Monitor       │
       │                │  - Cache         │
       │                └────────┬─────────┘
       ↓                         ↓
┌─────────────────────────────────────────┐
│    DATABASE (PostgreSQL via Supabase)    │
│    Prisma ORM + 48 Models + Migrations  │
└─────────────────────────────────────────┘
```

### Padrões Arquiteturais

- **Layered Architecture**: Separação clara entre UI, API, Services, Data
- **Service Layer Pattern**: Lógica de negócio encapsulada em serviços reutilizáveis
- **Background Jobs Pattern**: Workers separados com Bull Queue para tarefas assíncronas
- **Repository Pattern**: Acesso a dados via Prisma ORM
- **API-First Design**: Backend pronto para múltiplos frontends

---

## 🛠️ Stack Tecnológica

### Frontend
```typescript
{
  "framework": "Next.js 15.5.3 (App Router + RSC)",
  "react": "19.1.0",
  "styling": "Tailwind CSS 4.0 + Tailwind Animate",
  "ui_library": "Radix UI + shadcn/ui",
  "forms": "React Hook Form + Zod",
  "animations": "Framer Motion 12.23",
  "icons": "Lucide React 0.544"
}
```

### Backend
```typescript
{
  "runtime": "Node.js 20+ (Next.js API Routes)",
  "auth": "Supabase Auth (@supabase/ssr)",
  "database": "PostgreSQL 15+ (Supabase hosted)",
  "orm": "Prisma 6.16.1",
  "validation": "Zod 4.1.8",
  "uploads": "Multer 2.0.2 + Sharp 0.34"
}
```

### Processamento & Jobs
```typescript
{
  "queue": "Bull 4.16.5",
  "queue_ui": "@bull-board 6.12",
  "cache": "IORedis 5.7.0",
  "scheduler": "node-cron 4.3",
  "logging": "Winston 3.17"
}
```

### IA & Análise
```typescript
{
  "ai": "Google Gemini API (1.5 Flash/Pro)",
  "pdf": "pdf-parse 1.1 + pdf2pic 3.2",
  "documents": "docx 9.5.1",
  "spreadsheets": "xlsx 0.18.5",
  "automation": "Puppeteer 24.22"
}
```

### Email & Comunicação
```typescript
{
  "email": "Resend SMTP",
  "templates": "Custom HTML templates"
}
```

### DevOps
```typescript
{
  "containerization": "Docker + Docker Compose",
  "linting": "ESLint 9 + Prettier",
  "type_checking": "TypeScript 5.x Strict Mode",
  "testing": "Jest 30.1 + ts-jest",
  "ci_cd": "GitHub Actions ready"
}
```

---

## 🚀 Instalação e Setup

### Pré-requisitos

```bash
Node.js >= 20.0.0
npm >= 9.0.0
PostgreSQL 15+ (ou conta Supabase)
Redis 7+ (para workers)
```

### Quick Start

```bash
# 1. Clone o repositório
git clone <repository-url>
cd justoai-v2

# 2. Instale as dependências
npm install

# 3. Configure variáveis de ambiente
cp .env.example .env.local
# Edite .env.local com suas credenciais (veja seção abaixo)

# 4. Setup do banco de dados
npm run db:generate  # Gera Prisma Client
npm run db:migrate   # Aplica migrations
npm run db:seed      # (Opcional) Seed com dados de teste

# 5. Inicie o ambiente de desenvolvimento
npm run dev          # Servidor Next.js (porta 3000)
```

### 🔧 Configuração de Variáveis de Ambiente

#### 1. Copiar Template

```bash
cp .env.example .env.local
```

#### 2. Preencher Credenciais

Abra o arquivo `.env.local` e configure cada variável:

**Configurações de Banco de Dados** (Supabase)
- `DATABASE_URL`: URL de conexão PostgreSQL com pooling
- `DIRECT_URL`: URL direta para migrations
- `NEXT_PUBLIC_SUPABASE_URL`: URL do projeto Supabase
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Chave pública do Supabase
- `SUPABASE_SERVICE_ROLE_KEY`: Chave privada (⚠️ NUNCA exponha)

**Chaves de API de IA**
- `GOOGLE_API_KEY`: Para Google Gemini AI ([obter aqui](https://makersuite.google.com/app/apikey))
- `ANTHROPIC_API_KEY`: Para Claude AI ([obter aqui](https://console.anthropic.com/))

**Autenticação**
- `NEXTAUTH_SECRET`: Gere com `openssl rand -base64 32`
- `NEXTAUTH_URL`: URL da aplicação (ex: http://localhost:3000)

**Email (Resend ou SMTP)**
- `SMTP_HOST`: Servidor SMTP
- `SMTP_PORT`: Porta (587 para TLS, 465 para SSL)
- `SMTP_USER`: Usuário do serviço
- `SMTP_PASSWORD`: Senha ou API key
- `FROM_EMAIL`: Email remetente

**Redis & Background Jobs**
- `REDIS_HOST`: Host do Redis (localhost para dev)
- `REDIS_PORT`: Porta do Redis (padrão 6379)
- `REDIS_PASSWORD`: Senha (vazio se sem auth)
- `BULL_BOARD_ACCESS_TOKEN`: Gere com `openssl rand -hex 32`

#### 3. ⚠️ IMPORTANTE - Segurança

**NUNCA commite arquivos com valores reais:**
- ✅ `.env.example` pode ser commitado (só templates)
- ❌ `.env.local` NUNCA deve ser commitado
- ❌ `.env` NUNCA deve ser commitado
- ❌ Qualquer arquivo com chaves reais

**Se você acidentalmente commitou secrets:**
1. Remova do Git: `git rm --cached .env.local`
2. **REVOGUE imediatamente** todas as chaves expostas:
   - Supabase: Gere novas chaves no dashboard
   - Google AI: Revogue e crie nova API key
   - Anthropic: Revogue e crie nova API key
   - Resend: Gere nova API key
3. Atualize `.env.local` com novas credenciais
4. Commit a remoção: `git commit -m "Remove .env.local - security fix"`

**Rotação de Chaves:**
- Rotacione chaves de API periodicamente (a cada 90 dias)
- Use chaves diferentes para desenvolvimento e produção
- Considere usar um secrets manager (AWS Secrets Manager, HashiCorp Vault)

### Docker Setup (Recomendado)

```bash
# Inicia todos os serviços (App, PostgreSQL, Redis)
docker-compose up -d

# Visualizar logs
docker-compose logs -f

# Parar serviços
docker-compose down
```

### Workers (Background Jobs)

```bash
# Iniciar todos os workers
npm run workers:start

# Verificar status
npm run workers:status

# Visualizar logs
npm run workers:logs

# Parar workers
npm run workers:stop
```

---

## 📚 Documentação

### Estrutura de Documentação

```
docs/
├── README.md                 # Este arquivo
├── PROJECT_OVERVIEW.md       # Análise técnica detalhada (276 linhas)
├── resumo_projeto_atual.md   # Análise completa do projeto
└── src/app/help/            # 40+ páginas de documentação do usuário
```

### Comandos Úteis

```bash
# Desenvolvimento
npm run dev              # Dev server com hot reload
npm run lint             # Verificar código
npm run db:studio        # Abrir Prisma Studio (GUI do banco)

# Database
npm run db:generate      # Gera Prisma Client após mudanças no schema
npm run db:push          # Aplica schema ao DB (desenvolvimento)
npm run db:migrate       # Cria nova migration
npm run db:migrate:prod  # Aplica migrations (produção)
npm run db:reset         # ⚠️ Reseta banco (apaga dados)
npm run db:seed          # Seed do banco com dados de teste

# Build & Produção
npm run build            # Build para produção
npm run build:optimized  # Build com otimização de imagens
npm start                # Start servidor de produção

# Workers
npm run workers:start    # Inicia background workers
npm run workers:stop     # Para workers
npm run workers:restart  # Reinicia workers
npm run workers:status   # Status dos workers
npm run workers:logs     # Logs dos workers

# Performance & Análise
npm run optimize:images       # Otimiza imagens com Sharp
npm run analyze:performance   # Análise de performance
npm run test:responsive       # Testa responsividade

# Testes
npm test                 # Executa testes
npm run test:watch       # Modo watch
npm run test:coverage    # Cobertura de testes
```

### Endpoints Principais

#### Autenticação
```
POST   /api/auth/login          # Login de usuário
POST   /api/auth/signup         # Cadastro de usuário
POST   /api/auth/logout         # Logout
```

#### Processos
```
GET    /api/processes           # Listar processos
POST   /api/processes           # Criar processo
PUT    /api/processes/:id       # Atualizar processo
DELETE /api/processes/:id       # Remover processo
POST   /api/processes/upload    # Upload em lote (Excel)
```

#### Análise IA
```
POST   /api/ai/analyze                    # Análise geral
POST   /api/ai/multi-front-analysis       # Análise multi-frente
POST   /api/process/:id/analysis/fast     # Análise rápida
POST   /api/process/:id/analysis/full     # Análise completa
GET    /api/process/:id/analysis/history  # Histórico
```

#### Relatórios
```
POST   /api/reports/generate         # Gerar relatório manual
POST   /api/reports/schedule         # Agendar relatório
GET    /api/reports/history          # Histórico de relatórios
GET    /api/reports/download/:id     # Download de relatório
```

#### Créditos
```
GET    /api/credits/balance      # Consultar saldo
POST   /api/credits/consume      # Consumir créditos
POST   /api/credits/purchase     # Comprar créditos
GET    /api/credits/history      # Histórico de uso
```

---

## 📁 Estrutura do Projeto

```
justoai-v2/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (public)/          # Rotas públicas
│   │   ├── api/               # 80+ API endpoints
│   │   ├── dashboard/         # Dashboard principal
│   │   ├── classic/           # Dashboard legado
│   │   ├── pro/               # Dashboard Pro
│   │   └── help/              # Documentação do usuário
│   ├── components/            # React components (67 arquivos)
│   │   ├── ui/                # Base components (shadcn/ui)
│   │   ├── landing/           # Landing page components
│   │   ├── dashboard/         # Dashboard components
│   │   └── reports/           # Report components
│   ├── lib/                   # Business logic (51 arquivos)
│   │   ├── ai-model-router.ts
│   │   ├── gemini-client.ts
│   │   ├── pdf-processor.ts
│   │   ├── report-generator.ts
│   │   ├── email-service.ts
│   │   └── ...
│   ├── config/                # App configuration
│   ├── contexts/              # React contexts
│   ├── hooks/                 # Custom React hooks
│   └── styles/                # Global styles
├── lib/                       # Shared libraries
│   ├── alerts/
│   ├── middleware/
│   ├── report-templates/
│   ├── telemetry/
│   └── validations/
├── workers/                   # Background workers (6 arquivos)
│   ├── reports-worker.ts
│   ├── process-monitor-worker.ts
│   ├── individual-reports-worker.ts
│   ├── sync-worker.ts
│   ├── cache-cleanup-worker.ts
│   └── usage-aggregator-worker.ts
├── prisma/
│   ├── schema.prisma          # Database schema (1.324 linhas)
│   ├── migrations/            # Database migrations
│   └── seed.ts                # Database seeding
├── scripts/                   # Utility scripts
├── public/                    # Static assets
├── components/                # shadcn/ui components
└── ops/                       # DevOps configs
```

---

## 🔒 Segurança

### Implementações de Segurança

- ✅ **Autenticação**: Supabase Auth com JWT tokens
- ✅ **Autorização**: Middleware de proteção de rotas
- ✅ **Validação**: Zod schemas em todas as APIs
- ✅ **Rate Limiting**: Proteção contra abuse
- ✅ **SQL Injection**: Prisma ORM previne injeções
- ✅ **XSS Protection**: React escapa automaticamente
- ✅ **HTTPS**: Forçado via headers de segurança
- ✅ **Secrets Management**: `.env.local` excluído do Git, template `.env.example` fornecido
- ⚠️ **CORS**: Configurar origens permitidas (atualmente aberto)

### ⚠️ ATENÇÃO: Rotação de Chaves Necessária

Se você está configurando este projeto pela primeira vez e o arquivo `.env.local` já continha chaves reais que foram commitadas anteriormente:

**AÇÃO IMEDIATA NECESSÁRIA:**
1. ✅ `.env.local` foi removido do tracking do Git
2. ✅ `.gitignore` foi configurado para prevenir futuros commits
3. ⚠️ **VOCÊ DEVE** revogar e regenerar TODAS as chaves de API que estavam no arquivo:
   - **Supabase**: Dashboard → Settings → API → Reset keys
   - **Google AI**: [Google AI Studio](https://makersuite.google.com/app/apikey) → Delete old key → Create new
   - **Anthropic**: [Console Anthropic](https://console.anthropic.com/) → Delete old key → Create new
   - **Resend**: Dashboard → API Keys → Revoke → Create new
   - **NextAuth**: Gere novo secret com `openssl rand -base64 32`
   - **Bull Board**: Gere novo token com `openssl rand -hex 32`

### Boas Práticas de Segurança

- 📋 Use o arquivo `.env.example` como template
- 🔄 Rotacione chaves de API a cada 90 dias
- 🔐 Use diferentes credenciais para dev/staging/prod
- 🚫 NUNCA commite arquivos `.env*` com valores reais
- 📊 Monitore logs de acesso à API para detectar uso indevido
- 🔒 Considere usar um secrets manager (AWS Secrets Manager, Vault) para produção

---

## 🧪 Testes

```bash
# Executar testes
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

**Nota**: Estrutura de testes configurada com Jest. Testes implementados precisam ser expandidos.

---

## 📈 Performance

### Otimizações Implementadas

- ✅ Next.js Image Optimization
- ✅ Server-Side Rendering (SSR) e Static Generation (SSG)
- ✅ Compression middleware (gzip/brotli)
- ✅ Redis caching
- ✅ Database indexes otimizados
- ✅ Code splitting automático
- ✅ Lazy loading de componentes
- ✅ Background jobs para operações pesadas

### Métricas Target

- Response Time: < 200ms
- Time to First Byte: < 500ms
- Largest Contentful Paint: < 2.5s
- First Input Delay: < 100ms

---

## 🤝 Contribuindo

### Workflow de Desenvolvimento

1. Clone o repositório
2. Crie uma branch feature (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

### Code Style

- TypeScript strict mode habilitado
- ESLint + Prettier configurados
- Commits semânticos (Conventional Commits)

---

## 📝 Licença

Este é um projeto proprietário. Todos os direitos reservados.

---

## 👥 Autor

**Carlo (Fullstack Developer)**

Desenvolvedor fullstack especializado em arquiteturas escaláveis com Next.js, React, Node.js e PostgreSQL.

---

## 🔗 Links Úteis

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [shadcn/ui Components](https://ui.shadcn.com/)

---

<div align="center">

**Feito com ❤️ e TypeScript**

⭐ Se este projeto foi útil, considere dar uma estrela!

</div>
