# 📊 Análise do Schema Prisma (Atual)

## 1. Models Relacionados a Processos

Estes modelos formam o núcleo da gestão jurídica, separando o dado "público" (`Processo`) do dado "privado" do workspace (`Case`).

### `Processo` (Entidade Global)
Representa o processo jurídico único (CNJ) compartilhado ou consultado no sistema.
- **Campos Principais:**
  - `id`: CUID.
  - `numeroCnj`: String (Unique). A chave primária natural do mundo jurídico.
  - `dadosCompletos`: JSON. Armazena o payload bruto retornado pela API (atualmente JUDIT).
  - `dataOnboarding`: Data de entrada no sistema.
- **Relacionamentos:**
  - `cases`: 1-N (Um CNJ pode estar em vários Workspaces).
  - `monitoramento`: 1-1 (Link com monitoramento ativo na API externa).
  - `requisicoes`: 1-N (Histórico de chamadas de API para este CNJ).

### `Case` (Entidade do Workspace)
A "pasta" do processo dentro de um escritório específico.
- **Campos Principais:**
  - `workspaceId`: FK para o Workspace.
  - `clientId`: FK para o Cliente.
  - `processoId`: FK opcional para a entidade global `Processo`.
  - `number`: Número do processo (pode ser diferente do CNJ interno se o usuário editar, mas geralmente é o mesmo).
  - `status`, `type` (Civil, Criminal, etc.), `claimValue` (Valor da Causa).
- **Relacionamentos:**
  - `documents`: Anexos.
  - `timelineEntries`: Linha do tempo unificada.
  - `monitoredProcesses`: Configuração de monitoramento específica deste case.

### `ProcessTimelineEntry`
Histórico unificado de eventos (movimentações, notas, etc.).
- **Campos Principais:**
  - `eventDate`, `description`, `normalizedContent`.
  - `source`: Enum (`API_JUDIT`, `AI_EXTRACTION`, etc.).
  - `contentHash`: Para deduplicação.

---

## 2. Models de Workspace e Planos

Gerenciam a tenancy, cobrança e limites do sistema.

### `Workspace`
O escritório ou tenant.
- **Campos Principais:**
  - `plan`: Enum (`FREE`, `PRO`, etc.).
  - `stripeCustomerId`: Integração com Stripe.
  - `status`: Ativo/Inativo.

### `WorkspaceCredits` & `CreditAllocation`
Sistema de créditos híbrido (Relatórios vs IA).
- **`WorkspaceCredits`:** Saldo atual.
  - `reportCreditsBalance`, `fullCreditsBalance`.
- **`CreditAllocation`:** Entradas de crédito (Recargas mensais ou pacotes avulsos).
- **`CreditTransaction`:** Log de auditoria de consumo e adição de créditos.

### `PlanConfiguration`
Tabela de configuração "Hardcoded" no banco com os limites de cada plano.
- **Campos:**
  - `planName`: Unique.
  - `monitorLimit`: Limite de processos monitorados.
  - `reportCreditsMonth`, `fullCreditsMonth`: Franquia mensal.
  - `tierXCreditCost`: Custo dinâmico por volume.

### `WorkspaceQuota`
Estado atual de uso dos limites (exceto créditos, focado em features).
- **Campos:**
  - `monitorLimit`: Cópia ou override do plano.
  - `reportsMonthlyLimit`: Cota de relatórios.

---

## 3. Models de Integração JUDIT

Tabelas especificamente criadas para gerenciar o estado e histórico da API Judit. **Candidatas a refatoração ou renomeação na migração.**

### `JuditRequest`
Log de cada requisição feita à API.
- **Campos:**
  - `requestId`: ID retornado pela Judit.
  - `finalidade`: Motivo da chamada (Onboarding, Atualização).
  - `status`: Status da requisição.
  - `processoId`: Link ao processo consultado.

### `JuditMonitoring`
Tabela de controle do Webhook de Monitoramento (Push).
- **Campos:**
  - `trackingId`: ID do monitoramento na JUDIT.
  - `ativo`: Se estamos escutando este processo.
  - `processoId`: Link ao processo.

### `JuditCostTracking`
Auditoria financeira de custos de API (Shadow Billing).
- **Campos:**
  - `searchCost`: Custo da busca (R$).
  - `attachmentsCost`: Custo de anexos.
  - `operationType`: Tipo de operação.

### `JuditTelemetry`
Métricas técnicas de performance da API.
- **Campos:**
  - `response_time_ms`, `success`, `error_code`.

---

## 4. Identificação de Campos JUDIT (Hardcoded)

Campos e Enums que referenciam explicitamente "Judit" e precisarão de atenção.

### Campos em Tabelas Genéricas
- **`CaseDocument`**:
  - `juditAttachmentUrl`: URL temporária ou ID do anexo na Judit.
- **`Processo`**:
  - `dadosCompletos`: Embora seja genérico (JSON), o conteúdo atual segue estritamente o schema da Judit.
- **`workspace_usage_daily`**:
  - `judit_calls_total`, `judit_docs_retrieved`: Métricas diárias com nome hardcoded.

### Enums Específicos
- **`ProcessSource`**:
  - Valor `JUDIT_API`.
- **`TimelineSource`**:
  - Valor `API_JUDIT`.
- **`JuditOperationType`**:
  - Todo o Enum é específico.
- **`JuditAlertType`**:
  - Todo o Enum é específico.

### Tabelas Inteiras
- `JuditRequest`
- `JuditMonitoring`
- `JuditCostTracking`
- `JuditTelemetry`
- `JuditAlert`

## 📝 Conclusão para Migração

Para migrar para Escavador (ou tornar agnóstico), recomenda-se:

1.  **Renomear Tabelas:** `JuditRequest` -> `ProviderRequest`, `JuditMonitoring` -> `ProviderMonitoring`.
2.  **Generalizar Enums:** `JUDIT_API` -> `EXTERNAL_API` ou adicionar `ESCAVADOR_API`.
3.  **Adapter de Dados:** O campo `Processo.dadosCompletos` precisará de um parser que normalize o dado do Escavador para um formato comum, ou o frontend terá que saber lidar com 2 formatos diferentes de JSON.
