# 🔍 ANÁLISE COMPLETA DO SISTEMA ATUAL - JUSTOAI v2

## 📋 OBJETIVO
Este documento detalha a arquitetura atual para subsidiar a migração JUDIT -> ESCAVADOR, cobrindo Onboarding, Upload, Integrações, Monitoramento, Billing e Permissões.

---

## 🎯 PARTE 1: ONBOARDING DE PROCESSOS

### 1.1 Fluxo via Número CNJ

#### Perguntas Respondidas:

1.  **Localização no código:**
    *   **API Route:** `src/app/api/judit/onboarding/route.ts`
    *   **Service Layer:** `src/lib/services/juditOnboardingService.ts`
    *   **Client:** `src/lib/judit-api-client.ts`

2.  **Fluxo EXATO Atual:**
    1.  **Request:** POST com `{ cnj, workspaceId }`.
    2.  **Validação:** Regex CNJ (`^\d{7}-\d{2}\.\d{4}\.\d{1}\.\d{2}\.\d{4}$`).
    3.  **Fila:** Adiciona job à fila `juditQueue` (BullMQ) para processamento assíncrono. Retorna `202 Accepted` imediato.
    4.  **Worker:**
        *   Verifica se `Processo` já existe no DB (pelo CNJ).
        *   Se não, cria registro inicial.
    5.  **Integração JUDIT:** Chama `POST /requests/` (Search API).
        *   Payload: `search_type: "lawsuit_cnj"`, `with_attachments: true`, `callback_url: "..."`.
    6.  **Persistência:** Cria registro em `JuditRequest` com status `PENDING`.
    7.  **Callback:** O sistema aguarda o webhook da JUDIT para popular os dados (ver seção 3.2).

3.  **Dados Salvos:**
    *   Schema `Processo`: `numeroCnj`, `dadosCompletos` (JSON cru da JUDIT).
    *   Schema `Case`: Entidade do workspace, vinculada ao `Processo`.

4.  **Integrações Pós-Busca:**
    *   O webhook dispara `timelineEnricher` que chama o **Gemini** para gerar resumo e classificar o processo.
    *   Anexos são baixados e re-upados para o Supabase Storage.

5.  **Bulk Upload:**
    *   Não há endpoint específico para lista de CNJs (array). O “bulk” é feito via planilha Excel (ver 1.3).

#### Código Relevante:
```typescript
// src/app/api/judit/onboarding/route.ts
const job = await juditQueue.add({
  type: 'ONBOARDING',
  cnj: cleanCnj,
  workspaceId: body.workspaceId,
  userId: session.user.id
});
```

#### Problemas Identificados:
❌ **Dependência de Callback:** O fluxo depende 100% de a JUDIT chamar nosso webhook de volta. Falhas na entrega do webhook paralisam o onboarding.
❌ **Payload JUDIT Específico:** Os campos mapeados no webhook (`judit-type-mapper.ts`) quebrarão na migração.

---

### 1.2 Fluxo via Upload de Documentos

#### Perguntas Respondidas:

1.  **Localização no código:**
    *   **Orquestrador:** `src/lib/services/upload/UploadOrchestrator.ts`
    *   **Processamento de PDF:** `src/lib/pdf-processor.ts`

2.  **Fluxo COMPLETO do Upload:**
    1.  **Upload:** POST via `FormData`.
    2.  **Roteamento Inteligente:** Arquivos >4.5MB são redirecionados para Railway Proxy (evitar timeout Vercel Serverless).
    3.  **Deduplicação:** Calcula SHA-256 do arquivo. Se já existe no workspace, avisa o usuário.
    4.  **Extração de Texto (Cascata):**
        *   Tenta extração de texto simples (PDF parses).
        *   Se texto < 100 caracteres, chama **Railway OCR** (`RailwayClient`).
    5.  **Identificação:** Regex busca padrões de CNJ no texto extraído.
        *   Se achar CNJ: Verifica se processo existe. Se não, sugere criar.
    6.  **Análise Rápida (IA):** Envia os primeiros 50k caracteres para Gemini (`analyzePhase1`) para gerar um "Preview Snapshot" (Tipo de ação, valor, resumo) *antes* mesmo de consultar a API jurídica.
    7.  **Persistência:** Salva no Supabase Storage e cria `CaseDocument`.
    8.  **Enriquecimento (Background):** Dispara `performFullProcessRequest` (Fluxo 1.1) silenciosamente para buscar dados oficiais na API jurídica.

3.  **Extração de CNJ:**
    *   **OCR:** Sim, via serviço externo hospedado na Railway.
    *   **Lógica:** Extração híbrida (Texto nativo -> Fallback OCR).

4.  **Lógica Pós-CNJ:**
    *   Sim, dispara busca automática na JUDIT (`triggerJuditEnrichment`) em background.

5.  **Armazenamento:**
    *   Supabase Storage bucket `documents`.
    *   Metadata salvo em `CaseDocument` (incluindo `cleanText` e `textSha`).

6.  **Tipagem de Documento:**
    *   Atualmente rudimentar (`CONTRACT`, `PETITION`, `OTHER`). IA tenta inferir, mas padrão é genérico.

#### Código Relevante (Cascata OCR):
```typescript
// src/lib/pdf-processor.ts
async extractText(buffer, fileName) {
  const primaryText = await this.extractWithPrimary(buffer); // Texto nativo
  if (primaryText.length >= 100) return primaryText;
  
  // Fallback para OCR se texto insuficiente
  return await this.railwayClient.processOcr(buffer); 
}
```

---

### 1.3 Fluxo via Excel

#### Perguntas Respondidas:

1.  **Template:**
    *   Gerado em `GET /api/upload/excel`. Colunas típicas: `CNJ` (Obrigatório), `Cliente`, `Pasta`, `Observações`.

2.  **Processamento:**
    *   Rota `POST /api/upload/excel`.
    *   Usa `exceljs` para parse. Valida CNJs linha a linha.
    *   Cria um `UploadBatch` no banco.
    *   Dispara jobs individuais de onboarding (Fluxo 1.1) para cada linha válida.

3.  **Feedback:**
    *   Assíncrono. O usuário vê o status do "Lote" (`UploadBatch`) e contagem de processados/falhas.

---

## 🔄 PARTE 2: INTEGRAÇÃO JUDIT

### 2.1 Configuração Atual

1.  **Acesso:**
    *   Variáveis: `JUDIT_API_KEY`, `JUDIT_API_BASE_URL`.
    *   Client Wrapper: `src/lib/judit-api-client.ts`.

2.  **Endpoints Usados:**
    *   `POST /requests`: Busca de processos (Onboarding e Polling).
    *   `POST /tracking`: Criação de monitoramento (Push).
    *   `GET /requests/{id}`: Consulta status.
    *   `GET /response/{id}`: Download de JSON de resposta.

3.  **Estrutura de Dados:**
    *   Resposta MUITO aninhada: `response.data.content.hits[0]. ...`.
    *   Mapeamento complexo em `src/lib/utils/judit-type-mapper.ts` para converter o JSON da Judit no nosso schema Prisma. **Ponto Crítico de Migração**.

### 2.2 Custos e Tracking

1.  **Rastreio:**
    *   Tabela `JuditCostTracking` registra cada chamada.
    *   Campos: `operationType` (SEARCH/TRACKING), `searchCost`, `attachmentsCost`.
2.  **Limites:**
    *   Implementado `TokenBucket` rate limiter no client (180 req/min).
    *   Implementado `CircuitBreaker` para evitar chamadas quando API está fora (Status 500+).

---

## 📊 PARTE 3: SISTEMA DE MONITORAMENTO

### 3.1 Monitoramento de Processos

1.  **Mecanismo:**
    *   **Híbrido Inteligente (`workers/process-monitor-worker.ts`)**:
        *   **Preferencial (Push):** Tenta registrar webhook na JUDIT (`POST /tracking`). Se funcionar, a Judit nos avisa das mudanças. Custo mensal fixo.
        *   **Fallback (Pull):** Para processos onde tracking falha, o worker roda periodicamente (`daily-monitor` queue) e faz polling (`POST /requests`).

2.  **Detecção de Mudança:**
    *   Compara `lastMovements` hash. Se diferente, considera "Nova Movimentação".
    *   Dispara alertas na tabela `JuditAlert` e `JuditTelemetry`.

### 3.2 Webhooks

1.  **Recebimento:**
    *   Rota: `src/app/api/webhook/judit/callback/route.ts`.
    *   Autenticação: Verifica assinatura HMAC (`x-judit-signature`) usando `JUDIT_WEBHOOK_SECRET`.

2.  **Envio:**
    *   O sistema dispara webhooks internos para enriquecimento, mas não tem sistema configurável para enviar webhooks para **clientes finais** do JustoAI (ex: avisar o advogado via API dele).

---

## 💳 PARTE 4: SISTEMA DE CRÉDITOS E BILLING

### 4.1 Créditos

1.  **Estrutura:**
    *   Tabelas: `WorkspaceCredits`, `CreditAllocation`, `CreditTransaction`.
    *   Tipos: `REPORT_CREDITS` (Relatórios PDF) e `FULL_CREDITS` (Análises Profundas IA).

2.  **Consumo:**
    *   Validado em `PlanService.ts`. Verifica saldo antes de permitir ação.
    *   Transacional: Decrementa saldo e cria registro em `CreditTransaction` com motivo.

3.  **Expiração:**
    *   Schema possui campo `expiresAt` em `CreditAllocation`.
    *   Créditos de Onboarding (Trial) têm expiração.
    *   Não identifiquei um CRON específico de "limpeza", sugerindo que a validação é feita na hora do consumo (Lazy Expiration: `where expiresAt > now()`).

### 4.2 Planos e Limites

1.  **Hardcoded:**
    *   Configuração em `src/config/plans.ts` (SSOT).
    *   Planos: `FREE`, `STARTER`, `PRO`, `OFFICE`.
2.  **Enforcement:**
    *   Limites de "Processos Monitorados" e "Usuários" checados via `PlanService.isWithinLimit()`.

---

## 👥 PARTE 5: PERMISSÕES E WORKSPACES

### 5.1 Estrutura e Roles

1.  **Schema:**
    *   `User` <-> `UserWorkspace` <-> `Workspace`.
    *   Uma conta (User) pode pertencer a múltiplos Workspaces.

2.  **Roles (`src/lib/permission-validator.ts`):**
    *   **`OWNER`**: Dono do workspace. Full access + Billing.
    *   **`ADMIN`**: Gestão de usuários e processos.
    *   **`MEMBER`**: Operacional (Cria/Edita processos).
    *   **`VIEWER`**: Apenas visualização.

3.  **"God Mode" (Internal Admin):**
    *   Função `isInternalAdmin(email)` confere se email termina em `@justoai.com.br`. Dá acesso irrestrito a dashboards administrativos.

---

## 📁 PARTE 6: ESTRUTURA DE ARQUIVOS

### 1. Backend (API Routes)
*   `src/app/api/judit/onboarding`: Entrada de processos via CNJ.
*   `src/app/api/process/upload`: Upload de documentos inteligentes.
*   `src/app/api/webhook/judit`: Handler de callbacks da API Jurídica.
*   `src/app/api/cron`: Agendamentos (limpeza, relatórios diários).

### 2. Services (Core Logic)
*   `src/lib/services/upload/UploadOrchestrator.ts`: Cérebro do upload. Coordena OCR, IA e Banco.
*   `src/lib/services/juditOnboardingService.ts`: Regras de negócio da integração Judit.
*   `src/lib/pdf-processor.ts`: Wrapper para Railway OCR e extração de texto.
*   `src/lib/auth.ts`: Camada de autenticação Supabase + Sync DB local.

### 3. Models Relevantes
*   `Processo`: A entidade jurídica "pura" (CNJ único).
*   `Case`: A "pasta" do cliente (vários cases podem apontar para mesmo Processo, teoricamente, mas hoje é 1:1).
*   `JuditRequest`: Log de auditoria de chamadas API.

---

## 🎯 PARTE 7: PONTOS CRÍTICOS E ANÁLISE

### 7.1 Migração para Escavador

1.  **Breaking Change no Webhook:**
    *   **Problema:** O sistema JustoAI v2 ignora a resposta síncrona da JUDIT e confia 100% no Webhook assíncrono.
    *   **Escavador:** Se a API do Escavador retornar dados síncronos (ou usar formato diferente de webhook), **todo o fluxo de onboarding quebrará**. Teremos que reescrever `juditOnboardingService` para processar resposta imediata ou adaptar o handler de webhook.

2.  **Mapeamento de Dados:**
    *   **Problema:** O código espera JSONs com a "cara" da JUDIT (estrutura deep nested). Escavador tem estrutura flat ou diferente.
    *   **Ação:** Criar camada `LegalDataProvider` (Adapter Pattern) para isolar o formato da API externa do nosso DB.

3.  **Monitoramento Push vs Pull:**
    *   **Problema:** Dependemos do `/tracking` (Push) da JUDIT. Precisamos validar se o Escavador tem webhook de monitoramento equivalente e custos. Se for apenas Pull (Consulta periódica), teremos que escalar nossos workers de monitoramento e recalcular custos de cloud.

4.  **OCR e Extração:**
    *   **Observação:** A extração via PDF é robusta (Cascata Local -> OCR Railway). Isso é independente da API Judit/Escavador, o que é ótimo. **Não precisará ser migrado** (exceto se quisermos usar dados estruturados do Escavador para validar a extração).

### 7.2 Sugestões Imediatas

✅ **Criar Abstração de Provider:** Interface `ILegalProvider` com métodos `searchProcess(cnj)` e `monitorProcess(cnj)`.
✅ **Feature Flag:** Implementar `PROVIDER_STRATEGY = 'JUDIT' | 'ESCAVADOR'` para permitir migração gradual (canary release).
✅ **Billing Review:** Recalcular margens com tabela de preços do Escavador, pois o modelo de "Search Cost" vs "Monitoring Cost" pode variar drasticamente.
