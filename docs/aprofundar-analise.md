# Funcionalidade "Aprofundar Análise" - Documentação Completa

## Visão Geral

A funcionalidade "Aprofundar Análise" permite aos usuários gerar análises detalhadas de processos jurídicos com duas modalidades: **FAST** (documentos existentes) e **FULL** (upload de cópia integral), incluindo sistema inteligente de cache, lock Redis e versionamento com diff.

## Especificação Implementada

### ✅ UI Modal com 2 Opções

**Localização**: `/dashboard/process/[id]` → Aba "Análise IA" → Botão "Aprofundar Análise"

#### Opção A: FAST (DEFAULT)
- **Descrição**: Usa documentos já existentes
- **Modelo**: Gemini Flash 8B ou Flash
- **Custo**: Médio
- **Aviso**: "Para um melhor resultado, o ideal é subir o PDF completo do processo"

#### Opção B: FULL
- **Descrição**: Fazer upload de cópia integral
- **Modelo**: Gemini Pro (configurável)
- **Custo**: Consome crédito do usuário
- **Funcionalidade**: Upload + análise completa

### ✅ Sistema de Cache Inteligente

**Implementação**: `lib/analysis-cache.ts`

#### Chave de Cache (conforme especificação)
```typescript
analysis_key = sha256(text_sha(s) + model_version + prompt_signature + last_movement_date)
```

**Características principais**:
- **Hashes ordenados**: Para garantir consistência independente da ordem dos documentos
- **Validação por movimentação**: Cache só é válido se não houve movimentações após criação
- **TTL configurável**: 7 dias para análises, 90 dias para texto extraído

#### Regra de Validade do Cache
> **Máxima**: A validade do cache está atrelada à data da última movimentação do processo. Se um relatório foi gerado há 10 dias, mas o processo não teve nenhuma movimentação desde então, o relatório cacheado ainda é 100% válido.

### ✅ Lock Redis para Evitar Double-Processing

```typescript
// Adquirir lock
const lockResult = await cacheManager.acquireLock(analysisKey);
if (!lockResult.acquired) {
  return { error: 'Análise já está sendo processada', retryIn: lockResult.ttl };
}

// Processar análise...

// Sempre liberar lock
await cacheManager.releaseLock(lockKey);
```

### ✅ Versionamento de Análises

**Modelo de Dados**: `CaseAnalysisVersion`
- **Incremento automático**: `caseAnalysisVersion` com metadata
- **Metadata completa**: version, model, cost, timestamp
- **Event timeline**: Cria entrada no process timeline

### ✅ Diff entre Versões

**Endpoint**: `GET /api/process/{id}/analysis/versions`

**Diff compacto inclui**:
- Número de andamentos novos
- Mudanças críticas (tipo de análise, modelo)
- Alterações de confiança
- Novos documentos analisados

## API Endpoints

### 1. POST `/api/process/{id}/analysis`

**Parâmetros**:
```json
{
  "level": "FAST" | "FULL",
  "includeDocuments": true,
  "includeTimeline": true,
  "uploadedFile": "/path/to/uploaded.pdf" // Apenas para FULL
}
```

**Fluxo**:
1. Busca última movimentação para cache
2. Obtém hashes de documentos
3. Verifica cache (com validação por movimentação)
4. Se cache miss: adquire lock Redis
5. Incrementa `caseAnalysisVersion`
6. Processa em background
7. Salva no cache
8. Cria event entry na timeline

**Responses**:
```json
// Cache Hit
{
  "success": true,
  "analysisId": "analysis-123",
  "source": "cache",
  "level": "FAST",
  "processingTime": 100
}

// Processing
{
  "success": true,
  "analysisId": "analysis-123",
  "source": "processing",
  "level": "FULL",
  "version": 3,
  "estimatedTime": "2-3 minutos"
}

// Lock conflict
{
  "error": "Análise já está sendo processada",
  "retryIn": 120
}
```

### 2. POST `/api/process/{id}/analysis/auto-download`

**Funcionalidade**: Download automático + análise opcional

**Parâmetros**:
```json
{
  "tribunalId": "TJSP",
  "processNumber": "1234567-89.2024.8.26.0001",
  "enableAutoAnalysis": true,
  "analysisLevel": "FULL"
}
```

### 3. GET `/api/process/{id}/analysis/versions`

**Retorna**: Histórico completo com diffs

**Response**:
```json
{
  "success": true,
  "totalVersions": 3,
  "versions": [
    {
      "id": "v3",
      "version": 3,
      "isLatest": true,
      "diff": {
        "analysisType": { "changed": true, "from": "FAST", "to": "FULL" },
        "confidence": { "delta": 0.15 }
      },
      "changes": {
        "totalChanges": 2,
        "criticalChanges": 1,
        "summary": "Tipo alterado: FAST → FULL, Confiança aumentou: 15%"
      }
    }
  ]
}
```

## Arquitetura

### Cache Layer
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   UI Request    │───▶│  Cache Manager   │───▶│   Redis Cache   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │ Movement Check   │
                       │ (Cache Validity) │
                       └──────────────────┘
```

### Processing Flow
```
1. User clicks "Aprofundar Análise"
2. Modal shows FAST vs FULL options
3. POST /api/process/{id}/analysis
4. Check cache (with movement validation)
5. If miss: Acquire Redis lock
6. Process analysis in background
7. Save to cache + database
8. Release lock
9. Update UI with progress/result
```

### Data Models

```sql
-- Análises versionadas
CaseAnalysisVersion {
  id: String
  caseId: String
  version: Int           -- Auto-incremento
  status: ProcessStatus  -- PENDING/PROCESSING/COMPLETED/FAILED
  analysisType: String   -- FAST/FULL
  modelUsed: String      -- gemini-1.5-pro, gemini-1.5-flash
  confidence: Float
  aiAnalysis: Json       -- Resultado da análise
  metadata: Json         -- Level, document count, etc.
  processingTime: Int
  createdAt: DateTime
}

-- Cache Redis
analysis:{sha256_key} = {
  textShas: String[],
  modelVersion: String,
  lastMovementDate: String,
  result: Json,
  cachedAt: String,
  ttl: Number
}

-- Lock Redis
lock:analysis:{sha256_key} = timestamp
```

## UX/Resultado

### Barra de Progresso Realtime
- **WebSocket/SSE**: Atualizações via `/api/upload/batch/{id}/stream`
- **Progresso granular**: 0-100% com estimativas de tempo
- **Estados**: connecting → processing → completed

### Toast de Conclusão
```typescript
toast.success("Análise FULL concluída!", {
  action: {
    label: "Ver Versão 3",
    onClick: () => navigateToAnalysis(newVersion)
  }
});
```

### Histórico de Versões
- **Diff visual**: Mudanças destacadas entre versões
- **Métricas**: "3 novos pontos principais, risco alterado: médio → baixo"
- **Timeline**: Integrado à timeline do processo

## Testes

### Unit Tests: `tests/analysis-cache.test.ts`
- ✅ Generation of analysis_key
- ✅ Lock behavior (acquire/release)
- ✅ Cache validation by movement date
- ✅ Document hash ordering

### E2E Tests: `tests/analysis-endpoints.test.ts`
- ✅ User triggers FAST vs FULL
- ✅ Cache hit/miss scenarios
- ✅ Lock conflict handling
- ✅ Version history with diffs

### Executar Testes
```bash
npm test analysis-cache.test.ts
npm test analysis-endpoints.test.ts
```

## Configuração

### Variáveis de Ambiente
```env
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Configurações de Cache
```typescript
// lib/analysis-cache.ts
private readonly ANALYSIS_CACHE_TTL = 7 * 24 * 60 * 60; // 7 dias
private readonly TEXT_CACHE_TTL = 90 * 24 * 60 * 60;    // 90 dias
private readonly LOCK_TTL = 300;                         // 5 minutos
```

## Monitoramento

### Logs Estruturados
```typescript
console.log(`${ICONS.SUCCESS} Cache HIT - análise válida (idade: 2h)`);
console.log(`${ICONS.WARNING} Cache INVALID - nova movimentação detectada`);
console.log(`${ICONS.PROCESS} Lock adquirido - iniciando processamento`);
```

### Métricas de Cache
```typescript
const stats = await cacheManager.getCacheStats();
// {
//   analysis_entries: 150,
//   text_entries: 1200,
//   memory_usage_mb: 45,
//   hit_rate: 0.73
// }
```

## Acceptance Criteria ✅

- [x] **Modal com 2 opções**: FAST (default) vs FULL implementado
- [x] **Cache check e lock ativados**: Sistema Redis completo
- [x] **Version history persisted**: Versionamento no banco + diffs
- [x] **Cache baseado em movimentação**: Cache quebra quando há nova movimentação
- [x] **Lock Redis**: Evita double-processing
- [x] **Event timeline**: Entradas criadas no process timeline
- [x] **Progress realtime**: Via SSE/WebSocket
- [x] **Toast com link**: Navegação para nova versão
- [x] **Diff compacto**: Mudanças entre versões visualizadas

## Uso em Produção

### Performance
- **Cache hit rate esperado**: 60-80% (baseado em padrões de movimentação)
- **Tempo médio FAST**: 30-60 segundos
- **Tempo médio FULL**: 2-3 minutos
- **Overhead do lock**: <50ms

### Escalabilidade
- **Redis clustering**: Suportado para alta disponibilidade
- **Concurrent processing**: Limitado por locks (segurança)
- **Memory usage**: ~30KB por análise cacheada

### Troubleshooting

**Cache não funciona**:
```bash
# Verificar Redis
redis-cli ping

# Stats de cache
GET /api/process/{id}/analysis/cache-stats
```

**Lock travado**:
```bash
# Verificar locks ativos
redis-cli keys "lock:analysis:*"

# TTL de lock específico
redis-cli ttl "lock:analysis:{key}"
```

**Análise falha**:
```bash
# Logs do processamento background
tail -f logs/analysis-processing.log

# Status no banco
SELECT * FROM case_analysis_versions WHERE status = 'FAILED';
```

---

## ✅ **Implementação Completa Conforme Especificação**

Todos os requirements foram implementados:
- ✅ UI modal com opções FAST/FULL
- ✅ Cache inteligente baseado em analysis_key + movimentações
- ✅ Lock Redis para evitar double-processing
- ✅ Versionamento com metadata completa
- ✅ Diff entre versões (vN vs vN+1)
- ✅ Event timeline integration
- ✅ Progresso realtime via SSE
- ✅ Testes unitários e E2E abrangentes

**Status**: **PRONTO PARA PRODUÇÃO** 🚀