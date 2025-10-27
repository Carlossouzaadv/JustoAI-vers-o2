# 📅 Timeline Unificada Inteligente - Implementação

**Objetivo**: Transformar a Timeline atual em um **Motor de Fusão e Enriquecimento** com JUDIT como espinha dorsal.

**Data de Início**: 27 de Outubro de 2025
**Status**: 🟡 Em Progresso

---

## 📊 Progresso Geral

```
Sprint 1 (Schema):        [████████████████░░] 100% ✅
Sprint 2 (Enriquecimento): [██████████████░░░░] 80%  🟡
Sprint 3 (Integração):     [████░░░░░░░░░░░░░░] 33%  🟡
Sprint 4 (UI):             [░░░░░░░░░░░░░░░░░░] 0%
Sprint 5 (Conflitos):      [░░░░░░░░░░░░░░░░░░] 0%
────────────────────────────────────────────────
TOTAL:                     [███████████░░░░░░░░] 45%
```

---

## ✅ SPRINT 1: Fundação (Schema + Configuração)

### 1.1 Migration do Schema Prisma ✅
- [x] Adicionar campos a `ProcessTimelineEntry`:
  - [x] `baseEventId String?` - Vinculação a evento JUDIT base
  - [x] `enrichedByIds String[]` - IDs de eventos enriquecedores
  - [x] `relationType EventRelationType?` - Tipo de relação
  - [x] `originalTexts Json?` - Textos originais por fonte
  - [x] `contributingSources TimelineSource[]` - Array de fontes
  - [x] `linkedDocumentIds String[]` - IDs dos documentos vinculados
  - [x] `isEnriched Boolean @default(false)` - Flag de enriquecimento IA
  - [x] `enrichedAt DateTime?` - Timestamp do enriquecimento
  - [x] `enrichmentModel String?` - Modelo usado (gemini-1.5-flash)
  - [x] `hasConflict Boolean @default(false)` - Flag de conflito
  - [x] `conflictDetails Json?` - Detalhes do conflito
  - [x] `reviewedBy String?` - userId que resolveu conflito
  - [x] `reviewedAt DateTime?` - Timestamp da revisão
  - [x] `baseEvent ProcessTimelineEntry? @relation("EventEnrichment", fields: [baseEventId])`
  - [x] `enrichingEvents ProcessTimelineEntry[] @relation("EventEnrichment")`
  - [x] `linkedDocuments CaseDocument[] @relation("TimelineDocumentLinks")`

- [x] Criar enum `EventRelationType`:
  - [x] DUPLICATE
  - [x] ENRICHMENT
  - [x] RELATED
  - [x] CONFLICT

- [x] Atualizar `CaseDocument`:
  - [x] Adicionar `timelineEntries ProcessTimelineEntry[] @relation("TimelineDocumentLinks")`

- [x] Criar migration SQL e aplicar:
  - [x] Arquivo: `SQL_TIMELINE_UNIFICADA.sql` (pronto para Supabase)
  - [x] Executado no SQL Editor do Supabase
  - [x] `npm run db:generate` executado com sucesso

**Status**: ✅ COMPLETO

### 1.2 Arquivo de Configuração ✅
- [x] Criar `src/lib/config/timelineConfig.ts`:
  - [x] `getTimelineConfig()` - função para carregar config
  - [x] `similarityThresholdEnrichment` (padrão: 0.85)
  - [x] `similarityThresholdRelated` (padrão: 0.70)
  - [x] `dateProximityDays` (padrão: 2)
  - [x] `validateTimelineConfig()` - validar valores
  - [x] `debugTimelineConfig()` - exibir valores atuais
  - [x] Ler valores de `.env` com fallback

- [ ] Atualizar `.env.example`:
  - [ ] `TIMELINE_SIMILARITY_THRESHOLD_ENRICHMENT=0.85`
  - [ ] `TIMELINE_SIMILARITY_THRESHOLD_RELATED=0.70`
  - [ ] `TIMELINE_DATE_PROXIMITY_DAYS=2`

**Status**: ✅ COMPLETO (arquivos criados, .env.example pendente)

### 1.3 Helper Functions de UI ✅
- [x] Criar `src/lib/utils/timelineSourceUtils.ts`:
  - [x] `getSourceIcon(source: TimelineSource): ReactNode` - Ícones Lucide
  - [x] `getSourceLabel(source: TimelineSource): string` - Labels em PT
  - [x] `getSourceBadgeVariant(source): 'primary'|'secondary'|'outline'`
  - [x] `getSourcePriorityColor(source): string` - Classes Tailwind
  - [x] `getSourcePriority(source): number` - Prioridade (10-3)
  - [x] `getSourceDescription(source): string` - Descrição para tooltips
  - [x] `getSourceEmoji(source): string` - Emoji representativo
  - [x] `formatSourcesList(sources): string` - Lista formatada
  - [x] `isJuditSource()`, `isAiSource()` - checks úteis
  - [x] `debugSourcesConfig()` - exibir todas as configurações

**Status**: ✅ COMPLETO

---

## 🟡 SPRINT 2: Motor de Enriquecimento (60%)

### 2.1 Serviço TimelineEnricher ✅
- [x] Criar `src/lib/services/timelineEnricher.ts`:
  - [x] Classe `TimelineEnricherService`
  - [x] `associateToBaseEvent()` - Associar evento novo a JUDIT base
  - [x] `calculateSimilarity()` - Calcular similaridade textual
  - [x] `levenshteinDistance()` - Distância de Levenshtein
  - [x] `enrichDescription()` - Chamar Gemini Flash para enriquecimento
  - [x] `detectConflicts()` - Identificar conflitos entre fontes
  - [x] Implementar estratégia de associação:
    - [x] Hash exato (normalização) → DUPLICATE
    - [x] Data + Tipo + similaridade > 0.85 → ENRICHMENT
    - [x] Data + Tipo + similaridade > 0.70 → RELATED
    - [x] Data ±2 dias + similaridade alta → RELATED
    - [x] Data igual + info conflitante → CONFLICT
  - [x] `prepareEnrichmentData()` - Preparar dados para upsert
  - [x] `prepareRelatedEventData()` - Preparar evento relacionado
  - [x] `prepareConflictData()` - Preparar dados de conflito
  - [x] Singleton pattern com factory function

**Status**: ✅ COMPLETO

### 2.2 Prompt de Enriquecimento ✅
- [x] Criar `src/lib/prompts/enrichTimelineEvent.ts`:
  - [x] Função `buildEnrichmentPrompt()`
  - [x] Prompt otimizado para descrições jurídicas
  - [x] Limite: 250 caracteres (configurável)
  - [x] Exemplos claros no prompt
  - [x] `validateEnrichmentInput()` - Validar entrada
  - [x] `cleanEnrichmentOutput()` - Limpar resposta IA
  - [x] Variações de prompt para testes A/B (v1, v2_simple, v3_structured)

**Status**: ✅ COMPLETO

### 2.3 Política de Créditos ⏳
- [ ] Implementar em `timelineEnricher.ts`:
  - [ ] Check preventivo antes de chamar IA
  - [ ] Custo: ~0.001 crédito por enriquecimento
  - [ ] Débito apenas em caso de sucesso
  - [ ] Fallback sem custo: concatenação simples
  - [ ] Logging de tentativas vs sucessos
  - [ ] **Pendente**: Integração com creditService (quando usar timelineUnifier)

**Status**: ⏳ Aguardando integração no Sprint 3

---

## 🟡 SPRINT 3: Integração no Fluxo (33%)

### 3.1 Modificar timelineUnifier.ts ✅
- [x] Atualizar `mergeTimelines()` - versão V2 com enriquecimento:
  - [x] Extrair eventos JUDIT primeiro (espinha dorsal)
  - [x] Criar/atualizar eventos JUDIT no banco
  - [x] Extrair eventos PDF/IA
  - [x] Para cada evento não-JUDIT:
    - [x] Chamar `associateToBaseEvent()` do TimelineEnricherService
    - [x] Lógica ENRICHMENT: enriquecer descrição + atualizar base
    - [x] Lógica RELATED: criar novo evento + vincular via baseEventId
    - [x] Lógica CONFLICT: marcar hasConflict=true + salvar conflictDetails
    - [x] Fallback: novo evento se nenhuma associação
  - [x] Vincular documentos aos eventos via linkedDocumentIds
  - [x] Atualizar interface TimelineUnificationResult com novos campos:
    - [x] enriched (contador de eventos enriquecidos)
    - [x] related (contador de eventos relacionados)
    - [x] conflicts (contador de conflitos detectados)
  - [x] Log detalhado com breakdown final

**Status**: ✅ COMPLETO

### 3.2 Atualizar upload PDF
- [ ] Arquivo: `src/app/api/documents/upload/route.ts`
  - [ ] Passar `documentId` para `mergeEntries()`
  - [ ] Preencher `linkedDocumentIds` ao criar eventos

**Status**: ⏳ Aguardando Sprint 2

### 3.3 Atualizar webhook JUDIT
- [ ] Arquivo: `src/app/api/webhook/judit/callback/route.ts`
  - [ ] Marcar eventos JUDIT com metadata especial
  - [ ] Garantir criação de JUDIT antes de enriquecimentos

**Status**: ⏳ Aguardando Sprint 2

---

## 🔵 SPRINT 4: Interface (UI)

### 4.1 Componente EnrichedTimelineEvent
- [ ] Criar `src/components/timeline/EnrichedTimelineEvent.tsx`:
  - [ ] Badges de TODAS as fontes contribuintes
  - [ ] Badge "Enriquecido por IA" com Sparkles icon
  - [ ] Accordion com textos originais por fonte
  - [ ] Links clicáveis para documentos vinculados
  - [ ] Alerta visual para conflitos

**Status**: ⏳ Aguardando Sprint 3

### 4.2 Atualizar API unified-timeline
- [ ] Arquivo: `src/app/api/cases/[id]/unified-timeline/route.ts`
  - [ ] Novo formato de resposta com:
    - [ ] `isEnriched: boolean`
    - [ ] `contributingSources: TimelineSource[]`
    - [ ] `originalTexts?: Record<TimelineSource, string>`
    - [ ] `linkedDocuments?: Array<{id, name, url}>`
    - [ ] `hasConflict: boolean`
    - [ ] `conflictDetails?: ConflictDetails`
    - [ ] `relatedEvents?: Array<{id, relation}>`

**Status**: ⏳ Aguardando Sprint 3

### 4.3 Atualizar process-timeline.tsx
- [ ] Arquivo: `src/components/process/process-timeline.tsx`
  - [ ] Usar `EnrichedTimelineEvent` em vez de componente simples
  - [ ] Adicionar filtro "Mostrar apenas enriquecidos"
  - [ ] Contador de eventos por fonte

**Status**: ⏳ Aguardando Sprint 3

---

## 🔵 SPRINT 5: Gestão de Conflitos

### 5.1 Página de Revisão de Conflitos
- [ ] Criar `src/app/(dashboard)/cases/[id]/timeline/conflicts/page.tsx`:
  - [ ] Lista de eventos com `hasConflict=true`
  - [ ] Comparação lado a lado (JUDIT vs outro)
  - [ ] 4 opções de resolução:
    - [ ] Manter JUDIT (descarta outro)
    - [ ] Usar Documento (substitui JUDIT)
    - [ ] Mesclar Manualmente (editor inline)
    - [ ] Manter Ambos (separados + relacionados)

**Status**: ⏳ Aguardando Sprint 4

### 5.2 API de Resolução de Conflitos
- [ ] Criar `src/app/api/cases/[id]/timeline/conflicts/resolve/route.ts`:
  - [ ] Endpoint POST para resolver
  - [ ] Registra `reviewedBy` e `reviewedAt`
  - [ ] Salva decisão em metadata

**Status**: ⏳ Aguardando Sprint 4

---

## ✅ Tarefas Transversais

### Testes & Validação
- [ ] Testes unitários para `timelineEnricher.ts`
- [ ] Testes de integração para `mergeTimelines()`
- [ ] Testes de UI para `EnrichedTimelineEvent`
- [ ] Testes de conflito (cenários de data/tipo divergente)

### Documentação
- [ ] Comentários no código
- [ ] Atualizar documentação interna
- [ ] Exemplos de uso

### Build & Lint
- [ ] Verificar build completo: `npm run build`
- [ ] Verificar lint: `npm run lint`
- [ ] TypeScript strict mode

---

## 📝 Notas

- **Versão do Prompt de Enriquecimento**: v1 - pode ser refinado empiricamente
- **Limiares de Similaridade**: 0.85/0.70 são valores iniciais, ajustáveis via `.env`
- **Custo de Enriquecimento**: ~0.001 crédito (100 tokens Gemini Flash)
- **Fallback**: Concatenação simples sem custo de créditos

---

## 🔗 Referências

- Schema Prisma atual: `prisma/schema.prisma` (linhas 270-289)
- TimelineUnifier: `src/lib/services/timelineUnifier.ts`
- TimelineMerge: `src/lib/timeline-merge.ts`
- API Unified Timeline: `src/app/api/cases/[id]/unified-timeline/route.ts`
- UI Timeline: `src/components/process/process-timeline.tsx`

---

**Last Updated**: 27 de Outubro de 2025
**Atualizado Automaticamente**: Sim
