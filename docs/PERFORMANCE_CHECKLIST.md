# 🚀 CHECKLIST DE PERFORMANCE - JUSTOAI V2

## 📋 Overview

Checklist completo para validação de performance e otimizações implementadas no JustoAI V2.

---

## 🖼️ COMPRESSÃO E OTIMIZAÇÃO DE ARQUIVOS

### ✅ Sistema de Compressão (`lib/compression.ts`)

- [ ] **Sharp instalado** e configurado para processamento de imagens
- [ ] **Compressão automática** de imagens nos formatos:
  - [ ] WEBP (qualidade 85%)
  - [ ] JPEG (qualidade 85%, progressive)
  - [ ] PNG (compressão nível 8)
  - [ ] AVIF (qualidade 80%)
- [ ] **Geração de thumbnails** automática (300x300px)
- [ ] **Redimensionamento inteligente** (max 1920x1080)
- [ ] **Cache de compressão** para evitar reprocessamento
- [ ] **Middleware de upload** com compressão automática
- [ ] **PDF2Pic** configurado para otimização de PDFs
- [ ] **Estatísticas de compressão** disponíveis

### 📊 Métricas de Compressão
```bash
# Verificar estatísticas
curl http://localhost:3000/api/admin/compression/stats

# Testar compressão de imagem
# Upload de arquivo e verificar taxa de compressão > 30%
```

---

## 🔄 LAZY LOADING E CARREGAMENTO OTIMIZADO

### ✅ Componentes de Lazy Loading

- [ ] **LazyImage component** (`components/ui/lazy-image.tsx`)
  - [ ] Intersection Observer implementado
  - [ ] Placeholder durante carregamento
  - [ ] BlurDataURL para smooth loading
  - [ ] Fallback para erro de carregamento
  - [ ] Responsive loading com `sizes`
- [ ] **useIntersectionObserver hook** (`hooks/use-intersection-observer.ts`)
  - [ ] Configurações customizáveis (threshold, rootMargin)
  - [ ] Trigger once option
  - [ ] Support para múltiplas observações
- [ ] **useLazyList hook** para listas grandes
  - [ ] Carregamento incremental
  - [ ] Loading states
  - [ ] Infinite scroll
- [ ] **useLazyComponent hook** para importação dinâmica

### 📊 Testes de Lazy Loading
```bash
# Verificar carregamento de imagens
# 1. Abrir dashboard com muitas imagens
# 2. Verificar que apenas imagens visíveis carregam
# 3. Scroll e verificar carregamento sob demanda
# 4. Network tab deve mostrar requests incrementais
```

---

## 📄 PAGINAÇÃO E LISTAGENS OTIMIZADAS

### ✅ Sistema de Paginação

- [ ] **Pagination component** (`components/ui/pagination.tsx`)
  - [ ] Navegação inteligente com elipses
  - [ ] Configurações de tamanho (sm/md/lg)
  - [ ] Info de itens (mostrando X de Y)
  - [ ] Primeira/última página
  - [ ] Keyboard navigation
- [ ] **usePagination hook** com estado gerenciado
- [ ] **PageSizeSelect component** para items/página
- [ ] **Pagination utilities** (`lib/pagination.ts`)
  - [ ] Schemas Zod para validação
  - [ ] Parse automático de query params
  - [ ] Response padronizada
  - [ ] Cache keys para paginação
  - [ ] Configurações padrão por recurso

### ✅ APIs com Paginação

- [ ] **GET /api/clients** - Paginação implementada
- [ ] **GET /api/processes** - Paginação implementada
- [ ] **GET /api/cases** - Paginação implementada
- [ ] **GET /api/documents** - Paginação implementada
- [ ] **GET /api/reports** - Paginação implementada
- [ ] **GET /api/users** - Paginação implementada
- [ ] **GET /api/events** - Paginação implementada

### 📊 Teste de Paginação
```bash
# Testar APIs paginadas
curl "http://localhost:3000/api/clients?page=1&limit=10&sort=name&order=asc"

# Verificar response estruturado:
# - data: array de itens
# - pagination: { page, limit, total, totalPages, hasNext, hasPrev }
# - meta: { search, sort, order }
```

---

## 🗄️ ÍNDICES DE BANCO DE DADOS

### ✅ Índices Implementados (`prisma/migrations/001_performance_indexes.sql`)

#### Índices Primários
- [ ] **users_email_idx** - Login por email
- [ ] **users_created_at_idx** - Listagem ordenada
- [ ] **clients_workspace_idx** - Clientes por workspace
- [ ] **clients_name_idx** - Busca por nome
- [ ] **cases_client_idx** - Casos por cliente
- [ ] **cases_status_idx** - Filtro por status
- [ ] **case_events_case_date_idx** - Timeline de eventos
- [ ] **ai_cache_key_idx** - Cache lookup

#### Índices Compostos
- [ ] **clients_workspace_created_idx** - Listagem paginada
- [ ] **cases_workspace_status_idx** - Dashboard filtrado
- [ ] **ai_cache_cleanup_idx** - Limpeza de cache
- [ ] **report_schedules_execution_queue_idx** - Fila de relatórios

#### Índices de Busca Textual (GIN)
- [ ] **clients_name_search_idx** - Busca full-text
- [ ] **cases_title_search_idx** - Busca full-text
- [ ] **case_events_description_search_idx** - Busca full-text

### 📊 Verificação de Índices
```sql
-- Verificar índices criados
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('users', 'clients', 'cases', 'ai_cache')
ORDER BY tablename, indexname;

-- Verificar uso de índices em queries
EXPLAIN ANALYZE SELECT * FROM clients WHERE "workspaceId" = 'xxx' ORDER BY "createdAt" DESC;
```

---

## 📝 LOGS ESTRUTURADOS

### ✅ Sistema Winston (`lib/logger.ts`)

- [ ] **Winston configurado** com níveis hierárquicos
- [ ] **Daily rotation** de logs (7 dias combined, 14 dias error)
- [ ] **Logs estruturados JSON** em produção
- [ ] **Logs coloridos** em desenvolvimento
- [ ] **Separação por tipo:**
  - [ ] `logs/error-%DATE%.log` - Apenas erros
  - [ ] `logs/combined-%DATE%.log` - Todos os logs
  - [ ] `logs/http-%DATE%.log` - Requests HTTP
  - [ ] `logs/performance-%DATE%.log` - Métricas
  - [ ] `logs/exceptions-%DATE%.log` - Exceções não capturadas
  - [ ] `logs/rejections-%DATE%.log` - Promise rejections

### ✅ Loggers Especializados
- [ ] **httpLogger** - Requests e responses
- [ ] **performanceLogger** - Métricas de performance
- [ ] **workerLogger** - Background jobs
- [ ] **aiLogger** - Operações de IA
- [ ] **dbLogger** - Operações de banco

### ✅ Middleware de Logging
- [ ] **requestLoggingMiddleware** - Logs automáticos de request
- [ ] **errorLoggingMiddleware** - Captura de erros
- [ ] **Sanitização de dados** sensíveis (passwords, tokens)

### 📊 Verificação de Logs
```bash
# Verificar logs sendo gerados
tail -f logs/combined-2025-09-14.log
tail -f logs/http-2025-09-14.log

# Testar estrutura JSON
curl http://localhost:3000/api/health
# Verificar log estruturado gerado
```

---

## ⚡ OTIMIZAÇÕES GERAIS DE PERFORMANCE

### ✅ Frontend

- [ ] **React.memo** em componentes custosos
- [ ] **useMemo/useCallback** em computações pesadas
- [ ] **Code splitting** com dynamic imports
- [ ] **Bundle analyzer** para identificar módulos grandes
- [ ] **Service Worker** para cache de assets
- [ ] **Preload** de recursos críticos
- [ ] **Image optimization** automática do Next.js
- [ ] **Font optimization** com next/font

### ✅ Backend

- [ ] **Connection pooling** no Prisma
- [ ] **Query optimization** com select específicos
- [ ] **Batch operations** para múltiplas queries
- [ ] **Response compression** (gzip/brotli)
- [ ] **ETag headers** para cache
- [ ] **Rate limiting** implementado
- [ ] **Memory leak prevention** nos workers
- [ ] **Graceful shutdown** de serviços

### ✅ Cache Strategy

- [ ] **Redis cache** para dados frequentes
- [ ] **Application-level cache** em memória
- [ ] **CDN-ready** headers configurados
- [ ] **Cache invalidation** estratégico
- [ ] **Cache warming** para dados críticos

---

## 🧪 TESTES DE PERFORMANCE

### ✅ Load Testing

```bash
# Teste básico de carga
ab -n 1000 -c 10 http://localhost:3000/api/health

# Teste de API com autenticação
# Usar ferramenta como k6 ou artillery

# Teste de upload de arquivos
# Verificar compressão automática

# Teste de paginação
# APIs devem responder < 200ms para queries simples
```

### ✅ Database Performance

```sql
-- Verificar slow queries
SELECT query, mean_time, calls, total_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Verificar uso de índices
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE tablename = 'clients'
ORDER BY n_distinct DESC;
```

### ✅ Metrics de Referência

- [ ] **Tempo de resposta API** < 200ms (queries simples)
- [ ] **Tempo de resposta API** < 500ms (queries complexas)
- [ ] **First Contentful Paint** < 1.5s
- [ ] **Largest Contentful Paint** < 2.5s
- [ ] **Cumulative Layout Shift** < 0.1
- [ ] **Time to Interactive** < 3.5s
- [ ] **Bundle size** < 500KB (gzipped)
- [ ] **Image compression** > 60% de redução
- [ ] **Database queries** < 50ms (média)

---

## 🔧 FERRAMENTAS DE MONITORAMENTO

### ✅ Development Tools

- [ ] **Next.js Bundle Analyzer** configurado
- [ ] **React DevTools** para profiling
- [ ] **Prisma Studio** para queries
- [ ] **Bull Board** para background jobs
- [ ] **Winston logs** estruturados

### ✅ Production Ready

- [ ] **Health checks** em `/api/health`
- [ ] **Metrics endpoint** em `/api/metrics`
- [ ] **Prometheus** ready (opcional)
- [ ] **Error tracking** (Sentry ready)
- [ ] **Performance monitoring** (New Relic ready)

---

## 📊 CHECKLIST FINAL DE VALIDAÇÃO

### ✅ Pré-Deploy

- [ ] **Todos os testes passando**
- [ ] **Build sem warnings**
- [ ] **Database migrations** aplicadas
- [ ] **Índices criados** e verificados
- [ ] **Logs funcionando** corretamente
- [ ] **Workers iniciando** sem erros
- [ ] **APIs respondendo** dentro do SLA
- [ ] **Compressão funcionando** nos uploads

### ✅ Pós-Deploy

- [ ] **Monitorar logs** por 24h
- [ ] **Verificar métricas** de performance
- [ ] **Testar fluxos críticos** de usuário
- [ ] **Validar background jobs** executando
- [ ] **Conferir cache hit rates**
- [ ] **Monitorar uso de memória**
- [ ] **Verificar disk I/O** dos logs

---

## 🚨 TROUBLESHOOTING

### Problemas Comuns

**Imagens não comprimindo:**
```bash
# Verificar Sharp instalado
npm list sharp
# Verificar logs de upload
tail -f logs/combined-*.log | grep compression
```

**Queries lentas:**
```sql
-- Identificar queries sem índice
EXPLAIN ANALYZE SELECT * FROM clients WHERE name ILIKE '%test%';
-- Deve usar index scan, não sequential scan
```

**Logs não rotacionando:**
```bash
# Verificar permissões do diretório
ls -la logs/
# Verificar configuração Winston
```

**Workers não processando:**
```bash
# Verificar Redis
redis-cli ping
# Verificar workers
npm run workers:status
```

---

## ✅ COMANDOS RÁPIDOS DE VALIDAÇÃO

```bash
# Performance geral
npm run build && npm run lint

# Testes de carga básico
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3000/api/health

# Verificar logs
find logs/ -name "*.log" -exec wc -l {} \;

# Status dos workers
npm run workers:status

# Métricas de banco
npm run db:studio

# Análise de bundle
npm run build:analyze
```

---

**Status**: ✅ **SISTEMA OTIMIZADO PARA PRODUÇÃO**

*Checklist criado em: 14/09/2025 19:45*
*Versão: 1.0 - Otimizações completas implementadas*