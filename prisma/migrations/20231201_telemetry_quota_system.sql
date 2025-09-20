-- ================================================================
-- MIGRATION: Telemetria e Sistema de Quotas
-- Data: 2023-12-01
-- Branch: feature/claude-telemetry-quota-final
-- ================================================================

-- Política de quotas por workspace
CREATE TABLE IF NOT EXISTS workspace_quota_policy (
    id SERIAL PRIMARY KEY,
    workspace_id VARCHAR(255) NOT NULL UNIQUE,
    plan_id VARCHAR(100) NOT NULL DEFAULT 'basic',
    reports_monthly_limit INTEGER NOT NULL DEFAULT 10,
    processes_limit INTEGER NOT NULL DEFAULT 100,
    full_credits_included INTEGER NOT NULL DEFAULT 5,
    soft_threshold_pct DECIMAL(3,2) NOT NULL DEFAULT 0.80,
    hard_threshold_pct DECIMAL(3,2) NOT NULL DEFAULT 1.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_workspace_quota_policy
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    CONSTRAINT valid_soft_threshold
        CHECK (soft_threshold_pct >= 0.0 AND soft_threshold_pct <= 1.0),
    CONSTRAINT valid_hard_threshold
        CHECK (hard_threshold_pct >= 0.0 AND hard_threshold_pct <= 1.0),
    CONSTRAINT threshold_order
        CHECK (soft_threshold_pct <= hard_threshold_pct)
);

-- Uso diário por workspace (snapshot agregado)
CREATE TABLE IF NOT EXISTS workspace_usage_daily (
    id SERIAL PRIMARY KEY,
    workspace_id VARCHAR(255) NOT NULL,
    date DATE NOT NULL,

    -- Judit API
    judit_calls_total INTEGER DEFAULT 0,
    judit_docs_retrieved INTEGER DEFAULT 0,

    -- IA Calls
    ia_calls_fast INTEGER DEFAULT 0,
    ia_calls_mid INTEGER DEFAULT 0,
    ia_calls_full INTEGER DEFAULT 0,

    -- Relatórios
    reports_scheduled_generated INTEGER DEFAULT 0,
    reports_on_demand_generated INTEGER DEFAULT 0,
    reports_total_month_snapshot INTEGER DEFAULT 0,

    -- Créditos
    full_credits_consumed_month INTEGER DEFAULT 0,

    -- Billing
    billing_estimated_cost NUMERIC(10,2) DEFAULT 0.00,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_workspace_usage_daily
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    CONSTRAINT unique_workspace_date
        UNIQUE (workspace_id, date)
);

-- Eventos de uso (raw events para agregação)
CREATE TABLE IF NOT EXISTS usage_events (
    id SERIAL PRIMARY KEY,
    workspace_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_usage_events
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- Transações de créditos
CREATE TABLE IF NOT EXISTS credit_transactions (
    id SERIAL PRIMARY KEY,
    workspace_id VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('debit', 'credit')),
    amount NUMERIC(10,2) NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_credit_transactions
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    CONSTRAINT positive_amount
        CHECK (amount > 0)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_workspace_usage_daily_workspace_date
    ON workspace_usage_daily(workspace_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_usage_events_workspace_type_created
    ON usage_events(workspace_id, event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_workspace_created
    ON credit_transactions(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_usage_events_created_at
    ON usage_events(created_at DESC);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_workspace_quota_policy_updated_at
    BEFORE UPDATE ON workspace_quota_policy
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workspace_usage_daily_updated_at
    BEFORE UPDATE ON workspace_usage_daily
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Dados iniciais para workspaces existentes
INSERT INTO workspace_quota_policy (workspace_id, plan_id, reports_monthly_limit, processes_limit, full_credits_included)
SELECT
    id as workspace_id,
    COALESCE(plan, 'basic') as plan_id,
    CASE
        WHEN COALESCE(plan, 'basic') = 'premium' THEN 100
        WHEN COALESCE(plan, 'basic') = 'enterprise' THEN 500
        ELSE 10
    END as reports_monthly_limit,
    CASE
        WHEN COALESCE(plan, 'basic') = 'premium' THEN 1000
        WHEN COALESCE(plan, 'basic') = 'enterprise' THEN 5000
        ELSE 100
    END as processes_limit,
    CASE
        WHEN COALESCE(plan, 'basic') = 'premium' THEN 50
        WHEN COALESCE(plan, 'basic') = 'enterprise' THEN 200
        ELSE 5
    END as full_credits_included
FROM workspaces
WHERE id NOT IN (SELECT workspace_id FROM workspace_quota_policy)
ON CONFLICT (workspace_id) DO NOTHING;

-- Comentários para documentação
COMMENT ON TABLE workspace_quota_policy IS 'Políticas de quota e limites por workspace baseadas no plano';
COMMENT ON TABLE workspace_usage_daily IS 'Uso diário agregado por workspace para telemetria e billing';
COMMENT ON TABLE usage_events IS 'Eventos de uso raw para agregação e auditoria';
COMMENT ON TABLE credit_transactions IS 'Transações de créditos (compras, consumo, reembolsos)';

COMMENT ON COLUMN workspace_quota_policy.soft_threshold_pct IS 'Threshold para avisos suaves (ex: 0.8 = 80%)';
COMMENT ON COLUMN workspace_quota_policy.hard_threshold_pct IS 'Threshold para bloqueio (ex: 1.0 = 100%)';
COMMENT ON COLUMN workspace_usage_daily.reports_total_month_snapshot IS 'Snapshot do total de relatórios no mês para comparação com quota';
COMMENT ON COLUMN workspace_usage_daily.billing_estimated_cost IS 'Custo estimado baseado no uso (para alertas de billing)';

-- Views úteis para consultas
CREATE OR REPLACE VIEW workspace_current_usage AS
SELECT
    w.id as workspace_id,
    w.name as workspace_name,
    qp.plan_id,
    qp.reports_monthly_limit,
    qp.full_credits_included,
    COALESCE(SUM(ud.reports_scheduled_generated + ud.reports_on_demand_generated), 0) as reports_used_month,
    COALESCE(SUM(ud.full_credits_consumed_month), 0) as credits_used_month,
    COALESCE(SUM(ud.billing_estimated_cost), 0.00) as estimated_cost_month,
    qp.soft_threshold_pct,
    qp.hard_threshold_pct
FROM workspaces w
LEFT JOIN workspace_quota_policy qp ON w.id = qp.workspace_id
LEFT JOIN workspace_usage_daily ud ON w.id = ud.workspace_id
    AND DATE_TRUNC('month', ud.date) = DATE_TRUNC('month', CURRENT_DATE)
GROUP BY w.id, w.name, qp.plan_id, qp.reports_monthly_limit, qp.full_credits_included,
         qp.soft_threshold_pct, qp.hard_threshold_pct;

COMMENT ON VIEW workspace_current_usage IS 'View consolidada do uso atual por workspace no mês corrente';