# Sistema de Telemetria e Quotas - Notas de Implementação

## 📋 Visão Geral

Este documento fornece informações detalhadas sobre o sistema de telemetria, quotas e fair-use implementado no JustoAI.

**Branch**: `feature/claude-telemetry-quota-final`
**Data**: Dezembro 2023
**Versão**: 1.0

---

## 🗄️ Estrutura do Banco de Dados

### Tabelas Principais

#### `workspace_quota_policy`
Políticas de quota por workspace baseadas no plano.

```sql
CREATE TABLE workspace_quota_policy (
    id SERIAL PRIMARY KEY,
    workspace_id VARCHAR(255) NOT NULL UNIQUE,
    plan_id VARCHAR(100) NOT NULL DEFAULT 'basic',
    reports_monthly_limit INTEGER NOT NULL DEFAULT 10,
    processes_limit INTEGER NOT NULL DEFAULT 100,
    full_credits_included INTEGER NOT NULL DEFAULT 5,
    soft_threshold_pct DECIMAL(3,2) NOT NULL DEFAULT 0.80,
    hard_threshold_pct DECIMAL(3,2) NOT NULL DEFAULT 1.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Configurações por Plano**:
- **Basic**: 10 relatórios/mês, 100 processos, 5 créditos
- **Premium**: 100 relatórios/mês, 1000 processos, 50 créditos
- **Enterprise**: 500 relatórios/mês, 5000 processos, 200 créditos

#### `workspace_usage_daily`
Agregação diária do uso por workspace.

```sql
CREATE TABLE workspace_usage_daily (
    id SERIAL PRIMARY KEY,
    workspace_id VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    judit_calls_total INTEGER DEFAULT 0,
    judit_docs_retrieved INTEGER DEFAULT 0,
    ia_calls_fast INTEGER DEFAULT 0,
    ia_calls_mid INTEGER DEFAULT 0,
    ia_calls_full INTEGER DEFAULT 0,
    reports_scheduled_generated INTEGER DEFAULT 0,
    reports_on_demand_generated INTEGER DEFAULT 0,
    reports_total_month_snapshot INTEGER DEFAULT 0,
    full_credits_consumed_month INTEGER DEFAULT 0,
    billing_estimated_cost NUMERIC(10,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(workspace_id, date)
);
```

#### `usage_events`
Eventos raw de uso para agregação.

#### `credit_transactions`
Transações de créditos (compras, consumo, reembolsos).

---

## ⚖️ Lógica de Quotas

### Thresholds

#### Soft Threshold (80% padrão)
- Emite aviso mas permite operação
- Cooldown de 24h para evitar spam
- Mostra opções de upgrade/compra

#### Hard Threshold (100% padrão)
- Bloqueia operação completamente
- Oferece ações para desbloqueio
- Registra evento para alertas ops

### Fluxo de Verificação

```typescript
// Verificação de quota para relatórios
const quotaCheck = await quotaCheckReport(workspaceId, 'on_demand', {
  processCount: 5,
  reportFormat: 'executive',
  adminBypass: false
});

if (!quotaCheck.allowed) {
  return createQuotaErrorResponse(quotaCheck);
}
```

### Ações Disponíveis

1. **upgrade_plan**: Fazer upgrade do plano
2. **buy_credits**: Comprar relatórios extras
3. **schedule_night**: Agendar para próximo mês
4. **executive_fallback**: Versão simplificada (se habilitado)

---

## 🔧 Como Alterar Thresholds

### Via Código (Padrão para Novos Workspaces)
```sql
-- Alterar padrões na migration
UPDATE workspace_quota_policy
SET soft_threshold_pct = 0.85, hard_threshold_pct = 0.95
WHERE plan_id = 'premium';
```

### Via API Admin
```typescript
await quotaEnforcement.updateQuotaPolicy(workspaceId, {
  softThresholdPct: 0.85,
  hardThresholdPct: 0.95,
  reportsMonthlyLimit: 150
});
```

### Bulk Update para Plano
```sql
-- Alterar todos os workspaces de um plano
UPDATE workspace_quota_policy
SET reports_monthly_limit = 150
WHERE plan_id = 'premium';
```

---

## 🤖 Como Rodar Usage Aggregator

### Manual (Desenvolvimento)
```bash
# Agregar workspace específico para hoje
npm run worker:aggregator -- --workspace ws-123 --date 2023-12-01

# Agregar todos os workspaces
npm run worker:aggregator -- --date 2023-12-01

# Forçar re-agregação
npm run worker:aggregator -- --workspace ws-123 --force
```

### Via API
```typescript
// Rodar agregação via código
import { runDailyAggregation } from '@/workers/usage-aggregator-worker';

// Workspace específico
await runDailyAggregation('ws-123');

// Todos os workspaces
await runDailyAggregation();
```

### Cron Jobs (Produção)
O aggregator roda automaticamente:
- **02:00**: Agregação diária (após monitoramento às 01:00)
- **A cada 6h**: Recálculo de billing

---

## 💰 Configuração de Custos

### Variáveis de Ambiente
```bash
# Custos da Judit
JUDIT_UNIT_COST=3.50
JUDIT_DOC_RETRIEVE_COST=0.25

# Custos de IA
IA_COST_FAST=0.05
IA_COST_MID=0.25
IA_COST_FULL=1.50

# Estimativa de CPU para relatórios
REPORT_CPU_COST_ESTIMATE=0.10
```

### Fórmula de Billing
```typescript
const billingEstimate =
  (judit_calls_total * JUDIT_UNIT_COST) +
  (judit_docs_retrieved * JUDIT_DOC_RETRIEVE_COST) +
  (ia_calls_fast * IA_COST_FAST) +
  (ia_calls_mid * IA_COST_MID) +
  (ia_calls_full * IA_COST_FULL) +
  (reports_total * REPORT_CPU_COST_ESTIMATE);
```

---

## 🚨 Alertas Operacionais

### Regras de Alertas

#### Alto Custo de Billing (70% do plano)
- **Canal**: #ops-cost-alerts
- **Cooldown**: 6 horas
- **Ação**: Revisar uso, considerar upgrade

#### Custo Crítico (100% do plano)
- **Canal**: #ops-cost-alerts + Email + Sentry
- **Cooldown**: 3 horas
- **Ação**: Intervenção imediata

#### Bloqueios Repetidos (>2 em 7 dias)
- **Canal**: #ops-quota-issues
- **Cooldown**: 24 horas
- **Ação**: Suporte ao cliente

### Configuração do Slack
```bash
# Webhook URL para alertas
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
SLACK_CHANNEL=#ops-cost-alerts

# Emails de alerta
ALERT_EMAIL_TO=ops@justoai.com,admin@justoai.com
```

### Testando Alertas
```typescript
// Enviar alerta manual
await opsAlerts.sendManualAlert(
  'Teste de Alerta',
  'Este é um teste do sistema de alertas',
  'medium',
  ['slack'],
  'ws-test-123'
);
```

---

## 🔧 Troubleshooting

### Quota Não Atualiza
```sql
-- Verificar se agregação está rodando
SELECT * FROM workspace_usage_daily
WHERE workspace_id = 'ws-123'
ORDER BY date DESC LIMIT 5;

-- Forçar re-agregação
SELECT * FROM usage_events
WHERE workspace_id = 'ws-123'
  AND event_type = 'report_generation'
  AND created_at >= CURRENT_DATE;
```

### Billing Incorreto
```sql
-- Verificar cálculo de billing
SELECT workspace_id, date, billing_estimated_cost,
       judit_calls_total, ia_calls_full, reports_on_demand_generated
FROM workspace_usage_daily
WHERE workspace_id = 'ws-123'
ORDER BY date DESC;

-- Recalcular billing
npm run worker:aggregator -- --workspace ws-123 --force
```

### Alertas Não Chegam
```bash
# Verificar configuração
echo $SLACK_WEBHOOK_URL

# Testar webhook manualmente
curl -X POST $SLACK_WEBHOOK_URL \
  -H 'Content-Type: application/json' \
  -d '{"text": "Teste de webhook"}'

# Verificar logs
tail -f logs/alerts.log | grep "ops_alert"
```

### Workers Não Rodam
```bash
# Verificar status dos workers
npm run workers:status

# Verificar filas Redis
redis-cli LLEN bull:usage-aggregator:waiting
redis-cli LLEN bull:usage-aggregator:active

# Reiniciar workers
npm run workers:restart
```

---

## 📊 Queries Úteis

### Uso por Workspace (Mês Atual)
```sql
SELECT w.name, w.plan,
       SUM(ud.reports_on_demand_generated + ud.reports_scheduled_generated) as reports_used,
       qp.reports_monthly_limit,
       ROUND((SUM(ud.reports_on_demand_generated + ud.reports_scheduled_generated)::float / qp.reports_monthly_limit * 100), 1) as usage_pct,
       SUM(ud.billing_estimated_cost) as estimated_cost
FROM workspaces w
JOIN workspace_quota_policy qp ON w.id = qp.workspace_id
LEFT JOIN workspace_usage_daily ud ON w.id = ud.workspace_id
  AND DATE_TRUNC('month', ud.date) = DATE_TRUNC('month', CURRENT_DATE)
GROUP BY w.id, w.name, w.plan, qp.reports_monthly_limit
ORDER BY usage_pct DESC;
```

### Top Consumidores por Custo
```sql
SELECT w.name, w.plan,
       SUM(ud.billing_estimated_cost) as total_cost,
       SUM(ud.judit_calls_total) as judit_calls,
       SUM(ud.ia_calls_full) as ia_full_calls,
       SUM(ud.reports_on_demand_generated + ud.reports_scheduled_generated) as total_reports
FROM workspaces w
JOIN workspace_usage_daily ud ON w.id = ud.workspace_id
WHERE ud.date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY w.id, w.name, w.plan
ORDER BY total_cost DESC
LIMIT 10;
```

### Alertas Enviados (Últimos 7 dias)
```sql
SELECT ue.workspace_id, w.name,
       ue.payload->>'ruleId' as rule_id,
       ue.payload->>'severity' as severity,
       ue.payload->>'title' as title,
       ue.created_at
FROM usage_events ue
JOIN workspaces w ON ue.workspace_id = w.id
WHERE ue.event_type = 'ops_alert_sent'
  AND ue.created_at >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY ue.created_at DESC;
```

---

## 🗃️ Notas de Migração DBA

### Aplicar Migrations
```bash
# Aplicar migration principal
npx prisma db push

# Ou via SQL direto
psql -d justoai_prod -f prisma/migrations/20231201_telemetry_quota_system.sql
```

### Backup Antes da Migration
```bash
# Backup completo
pg_dump -h localhost -U postgres justoai_prod > backup_before_telemetry.sql

# Backup apenas das tabelas que serão alteradas
pg_dump -h localhost -U postgres -t workspaces -t usage_events justoai_prod > backup_tables.sql
```

### Rollback (Se Necessário)
```sql
-- Remover tabelas criadas (CUIDADO!)
DROP TABLE IF EXISTS workspace_usage_daily CASCADE;
DROP TABLE IF EXISTS usage_events CASCADE;
DROP TABLE IF EXISTS credit_transactions CASCADE;
DROP TABLE IF EXISTS workspace_quota_policy CASCADE;

-- Remover view
DROP VIEW IF EXISTS workspace_current_usage;
```

### Monitorar Performance Pós-Deploy
```sql
-- Verificar tamanho das tabelas
SELECT schemaname,tablename,attname,n_distinct,correlation
FROM pg_stats
WHERE tablename IN ('usage_events', 'workspace_usage_daily');

-- Verificar índices sendo usados
SELECT schemaname,tablename,indexname,idx_scan,idx_tup_read,idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename LIKE '%usage%';
```

---

## 🚦 Feature Flags

### Variáveis de Ambiente
```bash
# Habilitar enforcement de quota
ENABLE_QUOTA_ENFORCEMENT=true

# Permitir fallback para relatório executivo quando bloqueado
ALLOW_EXECUTIVE_FALLBACK_ON_BLOCK=true

# Cooldown para soft warnings (horas)
SOFT_WARNING_COOLDOWN_HOURS=24

# Header para bypass de admin
ADMIN_BYPASS_HEADER=x-admin-bypass
```

### Como Usar
```typescript
// Verificar se quota está habilitada
if (process.env.ENABLE_QUOTA_ENFORCEMENT === 'true') {
  const quotaCheck = await quotaCheckReport(workspaceId, reportType);
  // ...
}

// Bypass de admin
const adminBypass = request.headers.get('x-admin-bypass');
```

---

## 📞 Contato e Suporte

- **Equipe de Desenvolvimento**: #dev-team
- **Logs e Monitoramento**: #ops-team
- **Alertas Críticos**: #ops-cost-alerts

### Escalação
1. **Soft Issues**: #dev-team
2. **Quota Blocks**: #ops-team
3. **Billing Critical**: @ops-lead + @cto

---

**Última Atualização**: Dezembro 2023
**Autor**: Claude AI Assistant
**Revisão**: Pendente