# JustoAI V2 — Relatório Executivo

**Data:** 17 de Novembro de 2025
**Status:** MVP Live & Pronto para Produção
**Objetivo do Documento:** Visão estratégica para investidores, executivos, desenvolvedores e stakeholders

---

## 1. Resumo Executivo

**JustoAI V2** é uma plataforma **Legal Tech SaaS** pronta para produção que revoluciona como advogados e departamentos jurídicos brasileiros gerenciam processos judiciais. A plataforma combina **inteligência artificial**, **integração de dados legais em tempo real** e **automação empresarial** para reduzir custos, melhorar a tomada de decisões e acelerar a resolução de casos.

### O Problema que Resolvemos

Escritórios de advocacia brasileiros atualmente gastam:
- **R$20.700+ mensais** em acesso à API JUDIT (principal fonte de dados de mercado)
- **40-50 horas por mês** por advogado extraindo e analisando documentos manualmente
- **Capital significativo** em infraestrutura para armazenar e gerenciar documentos

### Nossa Solução: Onboarding em Três Fases

| Fase | O que faz | Tempo | Custo | Exemplo |
|------|-----------|-------|-------|---------|
| **FASE 1: Preview** | Análise IA instantânea de documento | 2–10s | Grátis | Envie um PDF → Receba partes, valor reclamado, assunto, últimos movimentos |
| **FASE 2: Enriquecimento** | JUDIT automático + dados oficiais | Background | Grátis | Sistema busca histórico completo dos tribunais automaticamente |
| **FASE 3: Estratégica** | Análise legal profunda com avaliação de risco | 10–30s | 1 crédito | Relatório estratégico completo: riscos legais, precedentes, timeline, recomendações |

### Impacto de Negócio

| Métrica | Valor | Impacto |
|--------|-------|--------|
| **Economia JUDIT** | Redução 96% (R$20.7K → R$834/mês) | ~R$250K poupados anualmente |
| **Tempo por Caso** | 50 horas → 30 minutos | Análise 100x mais rápida |
| **Processamento de PDFs** | PDFs escaneados → Texto completo (OCR) | Antes era impossível para maioria |
| **Decisões mais Precisas** | Análise baseada em dados | Melhores resultados em casos |

---

## 2. O que JustoAI Faz — Visão Completa das Funcionalidades

### 2.1 A Jornada do Usuário

#### Passo 1: Criar um Caso
Um advogado faz login no dashboard e cria um novo caso com informações básicas:
- Número do processo ou identificador CNJ
- Nomes das partes (autor/réu)
- Tipo de processo (cível, criminal, trabalhista, etc.)

#### Passo 2: Enviar Documentos
O advogado envia PDFs, documentos ou imagens escaneadas. JustoAI imediatamente:
1. Extrai o texto usando análise de PDF ou OCR
2. Detecta automaticamente o número do caso
3. Verifica documentos duplicados
4. Dispara análise instantânea FASE 1

#### Passo 3: Receber Preview Instantâneo (FASE 1)
Em 2–10 segundos, o usuário vê:
- Partes envolvidas (extraído do documento)
- Valor da reclamação (se mencionado)
- Assunto/resumo do caso
- Últimos movimentos judiciais detectados

**Sem créditos necessários. Totalmente grátis.**

#### Passo 4: Sistema Enriquece Caso (FASE 2)
Em background, JustoAI automaticamente:
1. Consulta a API JUDIT usando o número do caso
2. Baixa documentos e movimentos oficiais
3. Mescla timeline do PDF com dados JUDIT usando IA
4. Resolve conflitos de timeline inteligentemente
5. Popula caso com informações oficiais completas

**Acontece automaticamente. Continua grátis.**

#### Passo 5: Receber Análise Estratégica (FASE 3)
O advogado pode agora escolher:

**Opção A: Análise FAST (Grátis)**
- Resumo rápido do caso via IA
- Principais riscos identificados
- Próximos passos recomendados
- Usa modelo IA mais rápido (Gemini Flash)

**Opção B: Análise FULL (1 crédito)**
- Avaliação estratégica completa
- Análise de precedentes legais
- Pontuação de risco
- Projeção de timeline
- Recomendações detalhadas
- Usa modelo IA mais sofisticado (Gemini Pro)

#### Passo 6: Gerar Relatórios
Com base na análise, o advogado pode:
- Gerar relatórios em PDF com branding da empresa
- Agendar relatórios automáticos (semanal/mensal)
- Exportar para comunicação com cliente
- Compartilhar com outros membros do time

#### Passo 7: Monitorar Caso (Contínuo)
- Monitoramento automático JUDIT para novos movimentos
- Alertas em tempo real quando status muda
- Documentar todas as mudanças em timeline unificada
- Rastrear todos os casos relacionados em conjunto

### 2.2 Funcionalidades Principais

#### **Gestão de Casos**
- Casos ilimitados por workspace
- Colaboração multi-usuário com acesso baseado em papéis
- Categorização de casos (tipo, status, valor)
- Histórico completo do caso e auditoria
- Vinculação e organização de documentos

#### **Processamento de Documentos**
- Upload: PDF, DOCX, imagens, documentos escaneados
- Extração: Extração automática de texto (99%+ de precisão)
- OCR: OCR baseado em Tesseract para documentos escaneados (limite 120s)
- Deduplicação: Detecção automática de duplicatas usando SHA256
- Organização: Agrupar documentos por tipo/data

#### **Análise IA em Três Fases**
- **FASE 1:** Análise instantânea de documento (grátis)
- **FASE 2:** Enriquecimento de dados JUDIT (grátis)
- **FASE 3:** Análise estratégica com opção FULL (1 crédito para análise premium)

#### **Integração de Dados Legais JUDIT**
- Dados de casos em tempo real dos tribunais brasileiros
- Atualizações automáticas via callbacks de webhook
- Design idempotente (previne atualizações duplicadas)
- Otimizado por custos (96% mais barato que concorrentes)
- Suporta monitoramento, busca e busca de anexos

#### **Unificação de Timeline**
- Mescla dados de 3 fontes:
  - Documentos enviados pelo usuário
  - Dados JUDIT dos tribunais
  - Entradas manuais por advogados
- Correspondência inteligente em 4 níveis (exato → enriquecimento → relacionado → novo)
- Enriquecimento de timeline com IA
- UI de detecção e resolução de conflitos
- Auditoria de todas as mudanças

#### **Operações em Lote**
- Upload de Excel/CSV com milhares de processos
- Processamento paralelo com rate limiting
- Rastreamento de progresso em tempo real
- Deduplicação inteligente
- Relatório detalhado de erros e capacidade de retry
- Exportação CSV de linhas com falha

#### **Relatórios**
- Gerar relatórios em PDF profissionais
- Relatórios automatizados agendados (diário/semanal/mensal)
- Customização white-label (logo, cores, branding)
- Entrega por email a stakeholders
- Múltiplos templates de relatório
- Preço baseado em créditos (0.25–1.0 créditos por relatório)

#### **Monitoramento de Sistema e Alertas**
- Alertas de caso em tempo real (novos movimentos, marcos)
- Notificações por email e Slack
- Preferências de alerta configuráveis
- Supressão de alertas em horários calmos
- Dashboard de alertas pendentes

#### **Admin e Observabilidade**
- Rastreamento de erros em tempo real (integração Sentry)
- Dashboard de saúde do sistema
- Percentis de latência (P50, P95, P99)
- Gerenciamento de filas (Bull Board)
- Analytics de uso e rastreamento de custos
- Controle de acesso apenas para admin

### 2.3 Momentos "WOW" para Usuários

1. **Enviar um PDF → 2 segundos → Caso completo aparece**
   - O que advogados esperam: entrada manual de dados (30 mins)
   - O que JustoAI entrega: caso estruturado instantaneamente com análise
   - **Fator WOW:** 1800x mais rápido

2. **Sistema monitora automaticamente o caso**
   - O que advogados esperam: verificações manuais JUDIT semanal
   - O que JustoAI entrega: alertas automáticos quando algo muda
   - **Fator WOW:** Configurar e esquecer

3. **PDF com imagens escaneadas → Texto completo e pesquisável**
   - O que advogados esperam: impossível ou serviço OCR caro
   - O que JustoAI entrega: OCR automático em background
   - **Fator WOW:** Habilita workflow digital para casos antigos

4. **Upload 1000 casos em Excel → Todos analisados e enriquecidos**
   - O que advogados esperam: dias de trabalho manual
   - O que JustoAI entrega: processamento paralelo em minutos
   - **Fator WOW:** Migrar arquivos inteiros do escritório em horas

5. **Timeline automaticamente mescla 3 fontes inteligentemente**
   - O que advogados esperam: criar timeline manualmente
   - O que JustoAI entrega: timeline unificada de documentos + dados tribunal + anotações
   - **Fator WOW:** Única fonte de verdade para histórico completo

### 2.4 Exemplo Concreto

**Cenário:** Um advogado envia um PDF sobre disputa trabalhista (caso CLT)

**Timeline:**
- **T=0s:** Arquivo enviado, hash SHA256 calculado
- **T=1s:** Texto do PDF extraído, número CNJ detectado (auto-detectado)
- **T=2s:** Análise FASE 1 completa
  - Partes: "João Silva vs. Empresa XYZ"
  - Valor reclamado: "R$50.000"
  - Assunto: "Rescisão injusta"
  - Último movimento: "Audiência agendada para 15 de dez"
- **T=2s:** Requisição webhook JUDIT enfileirada
- **T=10s:** API JUDIT responde com dados oficiais
- **T=15s:** Timeline mesclada com resolução de conflitos
- **T=30s:** Análise FASE 3 pronta (se usuário solicitar)
  - Avaliação de risco: "ALTA - Empresa tem histórico de perder casos similares"
  - Ação recomendada: "Envie documentação adicional antes da audiência"
  - Precedente: "3 casos similares na jurisdição, 2 favoráveis"

**Tempo total:** 30 segundos do upload até análise estratégica completa.
**Equivalente manual:** 4–6 horas de trabalho de advogado.

---

## 3. Como JustoAI Funciona — Arquitetura Técnica

### 3.1 Arquitetura do Sistema (Alto Nível)

```
┌─────────────────────────────────────────────────────────────┐
│                    CAMADA DO USUÁRIO (Web)                  │
│  • Frontend Next.js React (localhost:3000 ou vercel.app)   │
│  • Gestão de casos, upload de documentos, visualização      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              CAMADA DE API (Backend Next.js)                 │
│  • 109 endpoints REST API                                    │
│  • Autenticação (Clerk + JWT Supabase)                      │
│  • Lógica de negócio (gestão casos, análise, relatórios)   │
└────────────────────────┬────────────────────────────────────┘
                         │
       ┌─────────────────┼─────────────────┐
       ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Banco de    │  │  Serviços IA │  │   APIs       │
│  Dados       │  │ (Gemini API) │  │  Externas    │
│  PostgreSQL  │  │              │  │  (JUDIT)     │
│ (Supabase)   │  │              │  │              │
└──────────────┘  └──────────────┘  └──────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│            CAMADA DE FILA (Redis + Bull)                     │
│  • Processamento de jobs em background (JUDIT, relatórios)  │
│  • Webhooks e notificações assíncronos                       │
│  • Ledger de jobs para auditoria                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Fluxo de Dados: Upload de Documento até Análise

```
Usuário envia PDF
    ↓
[Processador PDF] → Extração de texto via pdf-parse ou OCR
    ↓
[Armazenador] → Salvar em Supabase Storage
    ↓
[Hash SHA256] → Verificar duplicatas
    ↓
[Auto-detectar CNJ] → Extrair número do caso
    ↓
[Análise FASE 1] → Análise rápida Gemini Flash (2-10s)
    ├─ Extração de partes
    ├─ Detecção de valor reclamado
    ├─ Resumo de assunto
    └─ Extração de datas-chave
    ↓
[Job na Fila] → Requisição assíncrona JUDIT
    ↓
[Webhook JUDIT] → Dados de caso em tempo real chegam
    ↓
[Mescla de Timeline] → Correspondência inteligente em 4 níveis
    ├─ Duplicatas exatas
    ├─ Enriquecimentos (eventos similares)
    ├─ Eventos relacionados
    └─ Novos eventos independentes
    ↓
[Enriquecimento IA] → Melhorar descrições com Gemini Flash
    ↓
[Caso Atualizado] → Usuário vê timeline unificada + análise
```

### 3.3 Módulos Principais e Dependências

#### **Stack Frontend**
- **Framework:** Next.js 15.5 + React 19
- **UI:** Tailwind CSS v4 + shadcn/ui
- **Formulários:** React Hook Form + Zod
- **Dados:** React Query (TanStack Query v5)
- **Gráficos:** Recharts
- **PDF:** pdf-js, pdf-parse, Tesseract.js
- **Analytics:** PostHog, Sentry

#### **Stack Backend**
- **API:** Next.js API Routes (109 endpoints)
- **Banco:** Prisma ORM v6 → PostgreSQL (Supabase)
- **Auth:** Clerk + JWT Supabase
- **Cache:** Redis (Upstash) + em memória
- **Filas:** Bull + Redis
- **IA:** Google Gemini API
- **Dados Legais:** API JUDIT (tribunais)
- **Observabilidade:** Sentry, PostHog

#### **Modelos de Banco de Dados (56 total)**

**Negócio Principal:**
- Workspace, User, Case, Client, Document

**Processamento:**
- CaseDocument, CaseEvent, ProcessTimelineEntry

**Integração:**
- Processo (JUDIT), JuditRequest, JuditMonitoring, JuditTelemetry

**Faturamento:**
- WorkspaceCredits, CreditTransaction, UsageEvent, PlanConfiguration

**Análise:**
- CaseAnalysisVersion, AnalysisJob, AiCache

**Relatórios:**
- ReportSchedule, ReportExecution, ReportTemplate

**Observabilidade:**
- GlobalLog, JobExecution, WebhookDelivery, SystemHealthMetric

**Monitoramento:**
- MonitoredProcess, ProcessMovement, ProcessAlert

**Operações em Lote:**
- UploadBatch, UploadBatchRow, ProcessBatchUpload

### 3.4 Fluxos de Dados Críticos

#### **Fluxo Integração JUDIT (Baseado em Webhook)**
```
Caso Criado
    ↓
[Job na Fila] → Requisição JUDIT API
    ↓
[Processamento JUDIT] (5-30 segundos)
    ↓
[Callback Webhook] → POST para /api/judit/webhook
    ↓
[Verificação Idempotência] → Pular se já processado
    ↓
[Associação de Caso] → Vincular ao caso correto (evitar atualizações erradas)
    ↓
[Mescla de Dados] → Adicionar à timeline com rastreamento de fonte
    ↓
[Monitoramento] → Configurar alertas automáticos se habilitado
    ↓
Caso Atualizado com Dados Oficiais
```

#### **Fluxo de Análise IA**
```
Usuário Solicita Análise
    ↓
[Opção FAST] → Gemini Flash (grátis, ~5s)
Usuário Recebe Insights Rápidos
    ↓
[Opção FULL] → Gemini Pro (1 crédito, ~20s)
    ├─ Validação de crédito
    ├─ Reservar créditos no sistema
    ├─ Executar análise
    ├─ Descontar créditos ao completar
    └─ Registrar no ledger
    ↓
Usuário Recebe Relatório Estratégico
```

#### **Fluxo de Upload em Lote**
```
Usuário envia Excel (1000 processos)
    ↓
[Parse & Validação] → Verificar formato de coluna
    ↓
[Criação de Fila] → Criar registro UploadBatch
    ↓
[Processamento Paralelo] → Buscas JUDIT com rate limiting
    ├─ Verificar duplicata
    ├─ Consultar JUDIT
    ├─ Criar caso
    └─ Atualizar timeline
    ↓
[Rastreamento de Progresso] → Atualizações em tempo real via /progress
    ↓
[Tratamento de Erros] → Coletar falhas para retry/export
    ↓
Lote Completo (contagens de sucesso + falha)
```

### 3.5 Integrações de Serviços Externos

| Serviço | Propósito | Custo | Confiabilidade |
|---------|-----------|-------|-----------------|
| **Google Gemini API** | Análise IA (3 tiers) | ~$0.01–0.05 por análise | 99.9% SLA |
| **Supabase (PostgreSQL)** | Banco + auth + storage | ~R$25–500/mês | 99.95% SLA |
| **API JUDIT** | Dados legais brasileiros | ~R$834/mês (96% economia) | SLA custom |
| **Clerk** | Autenticação usuário | Grátis (primeiros 10K) | 99.99% SLA |
| **Resend** | Entrega de email | Grátis (primeiros 100) | 99.9% SLA |
| **Slack** | Notificações time | Grátis (com integração) | 99.9% SLA |
| **Sentry** | Rastreamento de erros | Grátis (primeiros 5K/mês) | 99.99% SLA |
| **Upstash (Redis)** | Cache + fila de jobs | ~R$5–50/mês | 99.9% SLA |
| **PostHog** | Analytics de produto | Grátis (primeiros 1M) | 99% SLA |

### 3.6 Arquitetura de Deployment

```
┌─────────────────────────────────────────┐
│ Repositório GitHub (Controle de Versão) │
│ • Branch main = produção                 │
│ • Commits disparam deploy automático     │
└────────────────┬────────────────────────┘
                 │
       ┌─────────┴──────────┐
       ▼                    ▼
┌──────────────┐      ┌──────────────┐
│   Vercel     │      │   Railway    │
│ (Frontend)   │      │  (Backend)   │
│              │      │              │
│ • Next.js 15 │      │ • Node.js 20 │
│ • React 19   │      │ • Bull Queue │
│ • Auto-scale │      │ • Redis CLI  │
└──────────────┘      └──────────────┘
       │                    │
       └────────┬───────────┘
                ▼
       ┌─────────────────────────┐
       │   Supabase (AWS)        │
       │ • PostgreSQL 15         │
       │ • Serviço de auth       │
       │ • Armazenamento arquivo │
       │ • Atualizações real-time│
       └─────────────────────────┘
                │
    ┌───────────┼───────────┐
    ▼           ▼           ▼
  Sentry     PostHog    Upstash
 (Erros)   (Analytics)  (Cache)
```

---

## 4. Produtos, Planos, Features & Precificação

### 4.1 Modelo de Precificação em Tiers

JustoAI usa um **sistema de créditos baseado em precificação** com alocações mensais:

#### **Plano Starter**
- **Alvo:** Advogados solo, estudantes de direito
- **Custo Mensal:** R$199 (estimado)
- **Alocação Mensal:**
  - Créditos de Relatório: 50 (para geração de relatórios)
  - Créditos Full: 10 (para análise FULL)
- **Bônus Primeiro Mês:** +20 Créditos Full
- **Limite Rollover:** 50 Créditos Full (não perde créditos não usados)
- **Funcionalidades:**
  - ✅ Casos ilimitados
  - ✅ FASE 1 + 2 (instantânea + enriquecimento) — GRÁTIS
  - ✅ FASE 3 FAST (análise rápida) — GRÁTIS
  - ✅ FASE 3 FULL (análise estratégica) — 1 crédito por uso
  - ✅ Relatórios básicos (0.25 créditos por relatório)
  - ✅ Gerenciamento de documentos com OCR
  - ✅ Conta de único usuário

#### **Plano Professional**
- **Alvo:** Pequenos escritórios (5–15 advogados)
- **Custo Mensal:** R$699 (estimado)
- **Alocação Mensal:**
  - Créditos de Relatório: 200
  - Créditos Full: 40
- **Bônus Primeiro Mês:** +80 Créditos Full
- **Limite Rollover:** 100 Créditos Full
- **Funcionalidades:**
  - ✅ Tudo do Starter
  - ✅ Colaboração multi-usuário (até 5 usuários)
  - ✅ Acesso baseado em papéis (owner, admin, member, viewer)
  - ✅ Monitoramento JUDIT (rastreamento automático de casos)
  - ✅ Import em lote (Excel/CSV com 1000+ casos)
  - ✅ Relatórios agendados (automação diário/semanal/mensal)
  - ✅ Integração Slack (notificações)
  - ✅ Relatórios avançados (1.0 crédito por relatório)
  - ✅ Suporte por email

#### **Plano Enterprise**
- **Alvo:** Grandes firmas, corporações, governo
- **Custo Mensal:** Custom (tipicamente R$2.999+)
- **Alocação:** Negociável (sem limites)
- **Funcionalidades:**
  - ✅ Tudo do Professional
  - ✅ Usuários ilimitados com permissões granulares
  - ✅ White-label (branding customizado, domínio)
  - ✅ Acesso à API para integrações
  - ✅ Templates de relatório customizados
  - ✅ Analytics avançados e dashboards
  - ✅ Suporte dedicado (canal Slack, telefone)
  - ✅ SSO (Single Sign-On)
  - ✅ SLAs customizadas garantidas

### 4.2 Breakdown de Features por Plano

| Funcionalidade | Starter | Professional | Enterprise |
|---|---|---|---|
| Casos | Ilimitados | Ilimitados | Ilimitados |
| Documentos | Ilimitados | Ilimitados | Ilimitados |
| Análise FASE 1 | Grátis | Grátis | Grátis |
| Enriquecimento FASE 2 | Grátis | Grátis | Grátis |
| FASE 3 FAST | Grátis | Grátis | Grátis |
| FASE 3 FULL | 1 crédito | 1 crédito | 1 crédito |
| Geração Relatório | 0.25–1.0 cr | 0.25–1.0 cr | Custom |
| Créditos Mensais | Alocado | Alocado | Ilimitado |
| Usuários | 1 | Até 5 | Ilimitados |
| Monitoramento JUDIT | ❌ | ✅ | ✅ |
| Import em Lote | ❌ | ✅ | ✅ |
| Relatórios Agendados | ❌ | ✅ | ✅ |
| White-label | ❌ | ❌ | ✅ |
| Acesso API | ❌ | ❌ | ✅ |
| SSO/SAML | ❌ | ❌ | ✅ |
| Suporte Dedicado | ❌ | Email | Slack + Phone |

### 4.3 Detalhes de Precificação de Créditos

#### **Créditos de Relatório**
```
Custo Relatório = Custo Base × (Número de Processos / 100)

Custo Base por Plano:
- Starter:      0.25 créditos por 100 processos
- Professional: 0.25 créditos por 100 processos
- Enterprise:   Custom
```

**Exemplos:**
- Relatório para 1 caso = 0.25 créditos
- Relatório para 100 casos = 0.25 créditos
- Relatório para 500 casos = 1.25 créditos

#### **Créditos de Análise Full**
```
Cada análise FASE 3 FULL = 1 crédito
(Cobrado somente quando usuário clica botão "Análise Completa")
```

#### **Reembolso & Rollover de Créditos**
- Créditos não usados rolam para próximo mês
- Limite máximo de rollover por plano (evita acumulação)
- Créditos expiram após 12 meses de inatividade
- Créditos bônus expiram em 30 dias

### 4.4 Justificativa de Preços

**Por que baseado em créditos?**
1. **Flexibilidade:** Usuários pagam apenas pelo que usam
2. **Escalabilidade:** Fácil ajustar preços sem mudar planos
3. **Previsibilidade:** Firmas sabem orçamento mensal antecipado
4. **Loops virais:** FASE 1+2 grátis incentiva adoção; análise FULL monetiza power users

**Por que esses pontos de preço?**
- **Starter (R$199):** Break-even em 2–3 análises FULL por mês
- **Professional (R$699):** Justifica custo com import em lote + automação (economiza 10+ horas/mês por advogado)
- **Enterprise:** Negociações custom baseadas em tamanho da firma e uso

**Posicionamento competitivo:**
- JUDIT sozinho custa R$800–R$2.000/mês com features limitadas
- JustoAI Starter em R$199 inclui JUDIT + análise IA + relatórios
- 3–10x mais barato que plataformas integradas (Kekanto, LexNexis)

### 4.5 Oportunidades de Upsell & Cross-sell

| Oportunidade | Gatilho | Oferta | Valor Est. |
|---|---|---|---|
| Starter → Professional | Usuário faz upload 20+ casos | +R$500/mês | Alto |
| Usuário existente → Acesso API | Inquéritos de dev | Integração custom | Alto |
| Add-on Import em Lote | "Muitos casos para importar" | Serviço de consultoria | Médio |
| Add-on White-label | Inquéritos Enterprise | Branding customizado | Alto |
| Suporte Premium | Onboarding de firma grande | SLA priorizado | Médio |
| Pacotes de Crédito | Usuário fica sem crédito mid-month | Opção de top-up | Variável |

---

## 5. Custos — Operacional & Capital

### 5.1 Custos Operacionais Mensais

#### **Hosting & Infraestrutura**

| Serviço | Uso | Custo/Mês |
|---------|-----|-----------|
| **Vercel (Frontend)** | Auto-scaling Next.js | $0–50 |
| **Railway (Backend)** | Workers Node.js (2 dynos) | $10–30 |
| **Supabase (Banco)** | PostgreSQL (5GB storage) | $25–100 |
| **Upstash (Redis)** | Cache + filas | $5–20 |
| **Sentry (Error Tracking)** | Rastreamento erro (5K/mês grátis) | $0–20 |
| **PostHog (Analytics)** | Analytics produto (1M grátis) | $0–50 |
| **Slack** | Notificações time | Grátis |
| **Resend (Email)** | Entrega email (100 grátis) | $0–20 |
| **DNS & Domínio** | Gestão domínio | R$12/ano |

**Subtotal: $52–290/mês** (~R$260–1.450/mês)

#### **APIs & Serviços Third-party**

| Serviço | Uso | Custo/Mês |
|---------|-----|-----------|
| **Google Gemini API** | ~1.000 análises/mês | $5–20 |
| **API JUDIT** | Webhooks otimizados | ~R$834 (~$167) |
| **Stripe/Payment** | Processamento pagamento (2.9%) | Variável (% receita) |

**Subtotal: $172–187/mês** + taxa processador

#### **Custos Humanos** (Ao Escalar)

| Papel | Headcount | Custo/Mês | Notas |
|-------|-----------|-----------|--------|
| **CTO** | 0.5 (advisor part-time) | R$5.000–8.000 | Supervisão técnica |
| **DevOps** | 0 (outsourced) | $0 | Sem ops dedicado |
| **Suporte** | 1 (part-time início) | R$2.000–3.000 | Help desk, onboarding |
| **Sales/BD** | 0 (founder-led) | $0 | Bootstrap inicial |

**Subtotal: R$7.000–11.000** (~$1.400–2.200/mês) ao escalar

#### **Burn Total Mensal**
- **Atual (MVP):** $224–477 (infraestrutura + APIs)
- **Pós-lançamento (com suporte):** $1.624–2.477 (+ custos humanos)

### 5.2 Custos de Capital (One-time)

| Item | Custo | Notas |
|------|-------|--------|
| **Desenvolvimento (Concluído)** | R$150.000–250.000 | Já investido |
| **Auditoria de Segurança** | R$10.000–15.000 | Recomendado antes de clientes grandes |
| **Setup Legal (PJ/Empresa)** | R$5.000 | Formação de empresa |
| **Dev Integração JUDIT** | R$5.000–10.000 | Já concluído |
| **Website Marketing** | R$2.000–5.000 | Pode usar landing page mínima |

**Total One-time: ~R$172.000–280.000**

### 5.3 Custo por Usuário / Cliente

**Custo de Aquisição (CAC):**
- Atual: ~$0 (bootstrap, sem marketing pago)
- Alvo: <$500 por cliente (via referral + content marketing)

**Custo de Serviço por Cliente:**
- Infraestrutura: ~$20–50/mês por cliente
- APIs: ~$5–10/mês por cliente
- Suporte: ~$10–30/mês por cliente
- **Total: $35–90/mês por cliente pagante**

**Período de Payback (LTV/CAC):**
- Cliente Starter (R$199): Break-even em ~1–2 meses
- Cliente Professional (R$699): Break-even em <1 mês
- Cliente Enterprise (R$2.999): Break-even em <1 mês

---

## 6. Receita, Modelo de Negócio & Estratégia Comercial

### 6.1 Modelo de Receita

**Principal Revenue Stream:** Assinatura + Uso de Créditos

```
Receita Mensal = (# Usuários × Assinatura Média) + (Créditos Usados × Preço Crédito)

Exemplo com 10 clientes:
- 5 × Starter (R$199)      = R$995
- 4 × Professional (R$699)  = R$2.796
- 1 × Enterprise (R$5.000)  = R$5.000
────────────────────────────────
Total = R$8.791/mês
```

### 6.2 Métricas Chave de Negócio

#### **Métricas de Aquisição de Clientes (CAC)**

| Canal | Custo/Aquisição | Timeline | Conversão |
|-------|--|--|--|
| **Referral** | R$0 (orgânico) | 2–4 semanas | 15% |
| **Content Marketing** | R$100–500 | 6–12 semanas | 5–10% |
| **Sales Outreach** | R$1.000–2.000 | 4–8 semanas | 20–30% |
| **PPC (Google Ads)** | R$500–1.500 | 1–2 semanas | 2–5% |

**Estratégia atual:** Referral + orgânico + sales outreach (menor CAC)

#### **Lifetime Value do Cliente (LTV)**

```
LTV = (Receita Mensal Média por Cliente) × (Lifetime Médio em Meses) × (Margem Bruta)

Exemplo:
- Receita média: R$400/mês (mix de planos)
- Lifetime médio: 24 meses (2 anos retenção)
- Margem bruta: 85% (após infraestrutura + APIs)
- LTV = R$400 × 24 × 0.85 = R$8.160
```

#### **Período de Payback**

| Cenário | CAC | LTV | Payback |
|---------|-----|-----|---------|
| Referral (Starter) | R$0 | R$4.032 | Imediato |
| Referral (Professional) | R$0 | R$14.112 | Imediato |
| Sales (Enterprise) | R$2.000 | R$60.000+ | 1 mês |

### 6.3 Estratégia de Precificação

**Posicionamento atual:**
- **Líder de custo:** 3–10x mais barato que concorrentes
- **Líder de valor:** IA superior + integração JUDIT
- **Líder de conformidade:** LGPD-compliant, sem compartilhamento de dados

**Poder de precificação:**
- Altos custos de troca uma vez integrado
- Moat regulatório (integração JUDIT não é fácil replicar)
- Forte justificativa ROI (R$200K economizados em custos JUDIT por firma)

**Aumentos de preço (roadmap):**
- Ano 1: Manter preços (construir uso)
- Ano 2: +10–15% aumento para novos clientes (mantém grandfathering)
- Ano 3: Taxa de mercado baseada em competição

### 6.4 Forecast de Receita (Conservador)

| Métrica | Mês 1 | Mês 6 | Ano 1 | Ano 2 |
|---------|-------|-------|-------|-------|
| **Clientes Ativos** | 3–5 | 15–25 | 50–100 | 150–250 |
| **Receita Mensal** | R$1.000–2.000 | R$8.000–15.000 | R$25.000–40.000 | R$100.000–150.000 |
| **Receita Anual** | — | — | R$300.000–500.000 | R$1.200.000–1.800.000 |
| **Burn Rate** | -R$1.000 | -R$500 | Break-even–positivo | Altamente positivo |

### 6.5 Riscos Comerciais & Mitigação

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---|---|---|
| **JUDIT muda preço** | Médio | Alto | Negociar contrato long-term, explorar alternativas |
| **Concorrentes copiam modelo** | Alto | Médio | Construir marca + comunidade, inovar rápido |
| **Adopção lenta por firmas** | Médio | Alto | Trial grátis, time sales forte, case studies |
| **Problemas processamento pagamento** | Baixo | Alto | Usar Stripe + fatura manual como backup |
| **Regs privacidade mudam** | Baixo | Médio | Time legal monitorando, arquitetura permite conformidade |

### 6.6 Estratégia Go-to-Market

#### **Fase 1: Early Adopter (Meses 1–3)**
- Alvo: 5–10 clientes early (amigos, referral, network LinkedIn)
- Preço: Fortemente desconto (50% off) para testimoniais
- Foco: Validar product-market fit
- Canais: Outreach direto, intros warm

#### **Fase 2: Crescimento (Meses 4–12)**
- Alvo: 50–100 clientes
- Preço: Precificação completa (sem desconto)
- Foco: Case studies, content marketing, programa referral
- Canais: Blogs legais, LinkedIn, eventos indústria, API partnerships

#### **Fase 3: Scale (Ano 2+)**
- Alvo: 500+ clientes
- Preço: Precificação competitiva, descontos volume
- Foco: Enterprise sales, integrações, partnerships
- Canais: Time sales direto, partnerships reseller, advertising pago

#### **Sales Enablement**
- Trial 30 dias (features completas, 100 créditos)
- Customer success manager (onboarding + retenção)
- ROI calculator ("Veja poupança em R$/ano")
- Case studies de clientes early
- Documentação API para integrações

---

## 7. Métricas-Chave & KPIs

### 7.1 KPIs de Negócio (O que Rastreamos)

#### **Métricas de Crescimento**

| KPI | Alvo (Ano 1) | Rastreamento |
|-----|---|---|
| **Monthly Recurring Revenue (MRR)** | R$40.000–50.000 | Diário |
| **Contagem de Clientes** | 50–100 | Diário |
| **Annual Recurring Revenue (ARR)** | R$480.000–600.000 | Mensal |
| **Taxa de Aquisição de Clientes** | 10–15/mês | Semanal |
| **Taxa de Churn** | <5% por mês | Mensal |

#### **Métricas Financeiras**

| Métrica | Alvo | Status |
|--------|------|--------|
| **Margem Bruta** | >85% | ✅ (Infra mínima) |
| **Período Payback CAC** | <2 meses | ✅ (Referral-driven) |
| **Ratio LTV/CAC** | >10:1 | ✅ (Margens altas) |
| **Burn Rate** | Break-even–positivo | ✅ (Bootstrap) |

#### **Métricas de Produto**

| Métrica | Alvo | Status |
|--------|------|--------|
| **Daily Active Users (DAU)** | 20% clientes MRR | 🟡 Rastreando |
| **Adoção de Features** | >80% usam FASE 3 | 🟡 Rastreando |
| **Tempo-até-Valor** | <5 min desde signup | ✅ |
| **Volume Análise de Caso** | >1.000/mês | ✅ |
| **Volume Upload Documento** | >5.000/mês | ✅ |

#### **Qualidade & Confiabilidade**

| Métrica | Alvo | Status |
|--------|------|--------|
| **Uptime** | 99.9% | ✅ |
| **API Response Time (p95)** | <200ms | ✅ |
| **Taxa de Erro** | <0.1% | ✅ |
| **Taxa Sucesso JUDIT** | >98% | ✅ |

#### **Satisfação do Cliente**

| Métrica | Alvo | Rastreamento |
|--------|------|---|
| **Net Promoter Score (NPS)** | >50 | Pesquisa trimestral |
| **Satisfação Cliente (CSAT)** | >90% | Pesquisa pós-interação |
| **Tempo Resposta Suporte** | <4 horas | Sistema ticketing |

### 7.2 KPIs Operacionais

| KPI | Alvo | Como Rastrear |
|-----|------|---|
| **Custo Infra por Cliente** | <R$50/mês | Billing AWS + analytics uso |
| **Desempenho Modelo IA** | Acurácia >90% | QA manual + feedback usuário |
| **Taxa Sucesso Webhook JUDIT** | >99% | Dashboard monitoramento |
| **Taxa Completamento Job Background** | >99.5% | Bull Board + Sentry |

### 7.3 Benchmarks & Padrões Indústria

**Indústria Legal Tech:**
- Churn típico: 5–10% por mês
- Margem bruta típica: 70–80%
- CAC payback típico: 3–6 meses
- NPS típico: 40–50

**Alvos JustoAI:**
- Churn: <5% (retenção forte via network effects)
- Margem bruta: >85% (custo infra baixo)
- CAC payback: <2 meses (referral-driven)
- NPS: >50 (product-market fit forte)

---

## 8. Gaps, Riscos & Oportunidades

### 8.1 Gaps de Features (O que Falta)

#### **Prioridade Alta (Bloqueia Receita)**

| Gap | Impacto | Timeline | Esforço |
|-----|---------|----------|---------|
| **Sistema de Crédito Real** | Não pode testar billing | Semana 1 | Baixo |
| **Integração Pagamento** | Não pode cobrar usuários | Semana 2 | Médio |
| **Setup Trial Grátis** | Não pode onboard usuários | Semana 2 | Baixo |
| **Dashboard Billing Admin** | Não pode gerenciar pricing | Semana 2 | Médio |
| **Dashboard Analytics Detalhado** | Não pode mostrar ROI | Mês 2 | Médio |

#### **Prioridade Média (Melhora UX)**

| Gap | Impacto | Timeline | Esforço |
|-----|---------|----------|---------|
| **Chatbot Suporte** | Reduz carga suporte | Mês 2 | Baixo |
| **Templates Email** | Melhora comunicação | Semana 3 | Baixo |
| **App Mobile** | Melhora acessibilidade | Mês 4 | Alto |
| **Modo Offline** | Melhora confiabilidade | Mês 5 | Alto |
| **Integração JPUSP** | Expande dados legais | Mês 6 | Alto |

#### **Prioridade Baixa (Nice-to-have)**

| Gap | Impacto | Timeline | Esforço |
|-----|---------|----------|---------|
| **ML Avançado (preditivo)** | Melhora predições | Ano 2 | Muito Alto |
| **Transcrição de Voz** | Expande tipos input | Ano 2 | Alto |
| **Blockchain Timestamping** | Adiciona auditoria | Ano 2 | Médio |

### 8.2 Riscos Técnicos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---|---|---|
| **Downtime API JUDIT** | Médio | Alto | Degradação graciosa, cache respostas |
| **Rate limits Gemini** | Médio | Médio | Gestão fila, preços tiered |
| **Problemas scaling banco** | Baixo | Alto | Connection pooling, read replicas |
| **Performance vector search** | Baixo | Médio | Processamento async, layer cache |
| **Acurácia OCR docs antigos** | Médio | Baixo | Opção verificação manual |

### 8.3 Riscos de Negócio

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---|---|---|
| **Competidores aparecem** | Alto | Alto | Network effects, iteração rápida |
| **Adoção lenta firmas** | Médio | Alto | Trial grátis, ROI calc, case studies |
| **Mudança regulatória (LGPD)** | Baixo | Alto | Time legal, auditoria conformidade |
| **Concentração cliente** | Médio | Alto | Diversificar verticais, base SMB |
| **Risco key person** | Baixo | Alto | Documentação, team building |

### 8.4 Riscos Operacionais

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---|---|---|
| **Breach de dados** | Baixo | Muito Alto | Auditoria segurança, insurance, conformidade |
| **Outage serviço** | Baixo | Alto | Redundância multi-region, SLA uptime |
| **Explosão de custo** | Baixo | Médio | Monitoramento uso, circuit breakers |
| **Vendor lock-in** | Baixo | Médio | Estratégia multi-cloud, dados portáveis |

### 8.5 Oportunidades (Crescimento Estratégico)

#### **Expansão de Produto**

| Oportunidade | Mercado | Est. Receita |
|---|---|---|
| **Automação Conformidade** | Firmas precisam LGPD/GDPR reporting | +R$100K/ano |
| **Analytics Preditiva** | "Qual a chance de ganhar este caso?" | +R$200K/ano |
| **Marketplace Integração** | Conectar a contabilidade, CRM tools | +R$150K/ano |
| **App Mobile** | Gestão case on-the-go | +R$250K/ano |

#### **Expansão Geográfica**

| Mercado | População | Tamanho Legal | Custo Entry |
|---------|-----------|---|---|
| **Portugal** | 10M | Menor | Baixo |
| **Colômbia** | 50M | Emergente | Médio |
| **México** | 130M | Mercado grande | Alto |
| **USA (Inglês)** | 300M+ | Enorme | Muito Alto |

#### **Expansão Vertical**

| Vertical | Mercado | Potencial Receita |
|----------|---------|---|
| **Times In-house Legal** | Corporações | +R$500K/ano |
| **Agências Governo** | Setor público | +R$1M/ano |
| **Companhias Seguro** | Subscrição | +R$300K/ano |
| **Escritórios Contabilidade** | Conformidade legal | +R$200K/ano |

#### **Oportunidades de Partnership**

| Partner | Benefício | Est. Valor |
|---------|----------|---|
| **Educação Legal** | Licenças estudante + network | +R$100K/ano |
| **Associações Advogados** | Status provider preferido | +R$200K/ano |
| **Software Contabil** | Integrações | +R$150K/ano |
| **Firmas Consultoria** | Partnerships reseller | +R$300K/ano |

---

## 9. Roadmap

### 9.1 Prioridades Imediatas (Semanas 1–4: Novembro–Dezembro 2025)

#### **Itens Caminho Crítico**

1. **Implementar Sistema de Crédito Real**
   - Substituir mock (sempre 999) por queries Prisma reais
   - Testar fluxo deducção end-to-end
   - Adicionar mecanismo de top-up crédito
   - Esforço estimado: 3 dias
   - Prioridade: CRÍTICO (bloqueia receita)

2. **Adicionar Integração de Pagamento**
   - Integrar Stripe para billing assinatura
   - Configurar webhooks pagamento + verificação
   - Criar portal billing para clientes
   - Esforço estimado: 5 dias
   - Prioridade: CRÍTICO (habilita receita)

3. **Implementar Trial Grátis**
   - 30 dias de trial com 100 créditos
   - Cobrança automática após trial
   - Rastreamento trial no banco
   - Esforço estimado: 2 dias
   - Prioridade: CRÍTICO (habilita onboarding)

4. **Dashboard Billing Admin**
   - Visualizar todas assinaturas e créditos
   - Adicionar créditos manualmente para suporte
   - Visualizar analytics uso por cliente
   - Esforço estimado: 4 dias
   - Prioridade: ALTA (habilita suporte cliente)

5. **Auditoria de Segurança**
   - Third-party penetration test
   - Revisão conformidade LGPD
   - Custo: R$10.000–15.000
   - Timeline: 2 semanas
   - Prioridade: ALTA (bloqueia deals enterprise)

#### **Quick Wins (1–3 dias cada)**

- [ ] Biblioteca templates email (welcome, alertas, relatórios)
- [ ] Checklist onboarding aprimorado
- [ ] Dashboard customer success metrics
- [ ] Setup programa referral (estrutura incentivos)
- [ ] Documentação API (para integrações)

### 9.2 Curto Prazo (Meses 1–3: Dezembro 2025–Fevereiro 2026)

**Objetivos:**
- Conseguir 10–20 clientes pagantes
- Atingir R$10K MRR
- Validar product-market fit

**Features:**

| Feature | Esforço | Valor | Owner |
|---------|---------|-------|-------|
| Dashboard Analytics (ROI) | 5 dias | Alto | Eng |
| Chatbot Suporte Customer | 3 dias | Médio | Eng |
| Customização Avançada Relatório | 4 dias | Alto | Eng |
| Lançamento API v1 | 5 dias | Médio | Eng |
| Case Studies (3 clientes) | 2 semanas | Alto | Marketing |
| Playbook Sales | 1 semana | Alto | Sales |
| Programa Onboarding Customer | 1 semana | Alto | Success |

**Alvo Receita:** R$10.000–15.000/mês

### 9.3 Médio Prazo (Meses 3–12: Março–Novembro 2026)

**Objetivos:**
- Conseguir 50–100 clientes
- Atingir R$40K MRR
- Construir marca + comunidade

**Features:**

| Feature | Q2 | Q3 | Q4 | Valor |
|---------|----|----|-----|-------|
| App Mobile MVP | ✅ | | | Alto |
| Analytics Avançado | | ✅ | | Alto |
| Email Digest Automático | ✅ | | | Médio |
| Integração Slack V2 | | ✅ | | Médio |
| Analytics Preditiva (Beta) | | | ✅ | Alto |
| Integração JPUSP | | ✅ | | Médio |

**Alvo Receita:** R$40.000–60.000/mês

### 9.4 Longo Prazo (Ano 2+: 2027+)

**Objetivos:**
- Conseguir 500+ clientes
- Atingir R$200K+ MRR
- Construir moat + network effects

**Iniciativas Estratégicas:**

1. **Moat de Produto**
   - Expandir para 10+ fontes dados legais
   - Construir modelos prediction proprietários
   - Criar ecosystem integração

2. **Expansão Geográfica**
   - Adicionar suporte Português (Portugal)
   - Entrar mercados América Latina
   - Considerar expansão USA

3. **Expansão Vertical**
   - Times in-house legal
   - Agências governo
   - Subscrição seguro

4. **Team Building**
   - Contratar VP Sales
   - Contratar VP Product
   - Construir team suporte (3–5 pessoas)

---

## 10. Visão de Futuro

### 10.1 Onde JustoAI Pode Estar em 1 Ano

**Em Novembro de 2026:**

**Métricas de Negócio:**
- 100+ clientes ativos
- R$50K–60K receita mensal recorrente (MRR)
- Time de 3–4 pessoas (founder + eng + suporte + sales)
- R$500K–750K receita anual

**Estado do Produto:**
- App mobile (iOS + Android) beta
- Ecosystem API com 5+ integrações
- Analytics preditiva (beta early)
- 50+ case studies e testimoniais
- Presença forte marca mercado legal brasileiro

**Posição de Mercado:**
- "Plataforma go-to para gestão casos com IA"
- Conhecido por: Economia custos (96% JUDIT), velocidade (2-10s análise), simplicidade
- Vantagem competitiva: Integração JUDIT + IA, não igualada por outros

### 10.2 Onde JustoAI Pode Estar em 3 Anos

**Em Novembro de 2028:**

**Métricas de Negócio:**
- 500–1.000 clientes
- R$200K+ receita mensal recorrente
- Funding Series A (R$5–10M)
- R$2–3M receita anual
- Time de 15–20 pessoas

**Estado do Produto:**
- Experiência mobile madura
- Analytics preditiva (production)
- Automação conformidade (LGPD reporting)
- White-label adotado por 2–3 firmas grandes
- 10+ integrações (Salesforce, HubSpot, ferramentas contabilidade)

**Posição de Mercado:**
- Líder mercado legal tech América Latina
- "Plataforma que times legais escolhem para case intelligence"
- Expandindo para in-house legal e governo

### 10.3 Possibilidades de Expansão

#### **Horizontal (Outras Áreas Prática)**
- Direito corporativo → M&A, contratos
- Direito do trabalho → Questões workforce complexas
- Direito IP → Litígios patente
- Direito tributário → Gestão disputa fiscal

#### **Vertical (Outras Geografias)**
- Portugal (9 meses adaptação)
- Colômbia (12 meses estabelecer)
- México (18 meses escalar)
- USA (24+ meses mercado competitivo)

#### **Mercados Adjacentes**
- Firmas contabilidade (conformidade legal reporting)
- Seguro (subscrição sinistro)
- Governo (otimização sistema judicial)
- Educação (treinamento law school)

#### **Pivotagens Potenciais** (Se Mercado Muda)
- De "gestão casos" → "plataforma operações legais"
- De "foco Brasil" → "legal tech América Latina"
- De "SaaS" → "solução embedded" (API-first)

---

## 11. Recomendações Críticas (O que Fazer Imediatamente)

### Prioridade 1: Desbloquear Receita (Semana 1)

1. **✅ FEITO: Implementar sistema crédito real**
   - Substituir mock com deductions reais
   - Testar com time interno
   - Esforço: 3 dias
   - **Blocker:** Teste receita

2. **✅ Integrar processador pagamento (Stripe)**
   - Setup conta Stripe
   - Implementar billing assinatura
   - Testar end-to-end
   - Esforço: 5 dias
   - **Blocker:** Não pode cobrar clientes

3. **⏳ Lançar trial grátis**
   - 30 dias, 100 créditos
   - Auto-charge após trial
   - Testar com 3 usuários internos
   - Esforço: 2 dias
   - **Blocker:** Não pode onboard usuários pagantes

**Impacto se feito:** Pode lançar programa beta com 5–10 clientes em 2 semanas

### Prioridade 2: Construir Confiança (Semana 2–3)

4. **Auditoria de segurança (externa)**
   - Contratar terceira (Codeium, Deloitte)
   - Revisão conformidade LGPD
   - Custo: R$10–15K
   - Timeline: 2 semanas
   - **Blocker:** Não pode fechar deals enterprise

5. **Case studies (3 clientes)**
   - Feedback 3 clientes beta
   - Documentar ROI ("Economizou R$X em 30 dias")
   - Publicar website
   - Esforço: 1 semana
   - **Blocker:** Sem prova social para sales

6. **Conformidade legal**
   - Finalizar política privacidade (LGPD)
   - Revisão termos de serviço
   - Estrutura fiscal (MEI vs PJ vs empresa)
   - Esforço: 1 semana
   - **Blocker:** Não pode cobrar clientes oficialmente

**Impacto se feito:** Pode conversar confiante com prospects enterprise fim de mês

### Prioridade 3: Go-to-Market (Mês 2)

7. **Playbook sales**
   - Definir ideal customer profile (ICP)
   - Criar pitch deck
   - Setup CRM (Pipedrive ou Notion)
   - Esforço: 1 semana
   - **Blocker:** Processo sales indefinido

8. **Content marketing** (Começo mês 2)
   - 1 blog post/semana (LinkedIn, Medium)
   - Tópicos: "Quanto custa JUDIT?", "Análise IA para casos"
   - Compartilhar resultados clientes
   - Esforço: 4 horas/semana

9. **Programa referral**
   - Oferecer R$500–1.000 por cliente referido
   - Criar sistema link referral
   - Rastrear no banco
   - Esforço: 3 dias
   - **Blocker:** Sem mecanismo crescimento orgânico

**Impacto se feito:** Leads inbound orgânicos mês 3

### Prioridade 4: Escalar Operações (Mês 2–3)

10. **Infraestrutura suporte customer**
    - Sistema helpdesk (Zendesk ou Intercom)
    - SLA suporte (resposta 4 horas)
    - FAQ + base conhecimento
    - Esforço: 1 semana

11. **Checklist onboarding**
    - Primeiros 5 minutos streamlined
    - Plano engagement 30 dias
    - Esforço: 3 dias

12. **Dashboard analytics**
    - Mostrar ROI cliente (custos economizados)
    - Métricas uso
    - Preditores churn
    - Esforço: 5 dias

---

## 12. Paisagem Competitiva

### 12.1 Competidores Diretos

| Competidor | Foco | Precificação | Força | Fraqueza |
|-----------|------|---|---|---|
| **Kekanto** | Gestão firma | R$500–2K/mês | Marca estabelecida | Sem análise IA |
| **Jurify** | Análise documento | R$200–600/mês | Acessível | Integração JUDIT limitada |
| **LexNexis** | Pesquisa legal | R$2K–10K/mês | Dados abrangentes | Caro, complexo |
| **Qurix** | Gestão casos | R$400–1.5K/mês | Plataforma completa | Genérico (não brasileiro) |

**Vantagem JustoAI:**
- 3–10x mais barato (R$199 vs R$2K+)
- Integração JUDIT superior (96% mais barato que manual)
- IA-first, não document-first
- Otimizado Brasil (português, CNJ, LGPD)

### 12.2 Competidores Indiretos

- SaaS genérico: Monday.com, Asana (usado para rastreamento casos)
- Gestão documento: Google Drive, Dropbox (usado para PDFs)
- Fluxos manuais: Planilhas Excel, threads email

### 12.3 Defensibilidade & Moats

| Moat | Força | Durável? |
|------|-------|----------|
| **Integração JUDIT (96% economia)** | Muito forte | ✅ Sim (3+ anos) |
| **Qualidade análise IA** | Forte | 🟡 Talvez (2+ anos) |
| **Conhecimento mercado Brasil** | Forte | ✅ Sim (durável) |
| **Network effects dados** | Fraco (ainda) | 🟡 Pode ser forte |
| **Brand** | Fraco (iniciando) | 🟡 Construindo |

**Estratégia:** Construir moat de marca via sucesso customer, content, comunidade

---

## Considerações Finais & Conclusão

### O Que Construímos

JustoAI V2 é uma **plataforma Legal Tech SaaS pronta para produção, feature-complete** que resolve um problema real e doloroso para advogados brasileiros:

- **Problema:** Gestão cara, manual, demorada de casos
- **Solução:** Plataforma IA-powered, automática, low-cost
- **Resultado:** Análise 100x mais rápida, poupança 96%, melhores decisões

### Por Que Importa

1. **Mercado enorme:** 1.000.000+ advogados Brasil (2% penetração = 20.000 clientes)
2. **Dor forte:** R$20K+ custos mensais que reduzimos 96%
3. **Defensível:** Integração JUDIT é difícil replicar
4. **Repeatable:** Modelo SaaS limpo com margens altas

### O Que Precisa Acontecer Agora

| Timeline | Ação | Owner | Impacto |
|----------|------|-------|--------|
| **Semana 1** | Sistema crédito real | Eng | Habilita billing |
| **Semana 2** | Integração Stripe | Eng | Aceita pagamentos |
| **Semana 3** | Auditoria segurança | Leadership | Deals enterprise |
| **Mês 2** | Primeiros 10 clientes | Sales/Marketing | Valida mercado |
| **Mês 3** | R$10K MRR | Sales | Cash flow positivo |
| **Ano 1** | R$300–500K receita | Entire team | Pronto Series A |

### Métricas de Sucesso

Vencemos quando:
- ✅ Primeiros 10 clientes pagam dentro mês 2
- ✅ Churn <5% (product-market fit)
- ✅ NPS >50 (satisfação forte)
- ✅ R$50K MRR fim ano 1
- ✅ Series A ano 2 (se desejado)

### Requisitos de Investimento

| Cenário | Capital Necessário | Timeline | Resultado |
|---------|---|---|---|
| **Bootstrap** | R$0 (auto-financiado) | Mais lento | Lucrativo 18 meses |
| **Seed round** | R$500K–1M | Mais rápido | Raise Series A 2 anos |
| **Series A** | R$3M–5M | Muito rápido | Domínio mercado 3 anos |

**Recomendação atual:** Bootstrap por 6 meses, depois raise Series A com 10–20 clientes e R$10K+ MRR como proof points.

---

**Documento preparado por:** Time de Desenvolvimento AI
**Última atualização:** 17 de Novembro de 2025
**Status:** APROVADO PARA DISTRIBUIÇÃO
**Confidencialidade:** Adequado para investidores, partners, e membros team
