-- ================================================================
-- MIGRATION: Sistema Unificado de Créditos
-- ================================================================
-- Implementa Report Credits + FULL Credits com expiration, rollover e FIFO

-- Tabela principal de saldo de créditos por workspace
CREATE TABLE workspace_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id VARCHAR NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

    -- Saldos atuais
    report_credits_balance DECIMAL(10,2) NOT NULL DEFAULT 0,
    full_credits_balance DECIMAL(10,2) NOT NULL DEFAULT 0,

    -- Caps de rollover
    report_credits_rollover_cap DECIMAL(10,2) NOT NULL DEFAULT 36,
    full_credits_rollover_cap DECIMAL(10,2) NOT NULL DEFAULT 50,

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(workspace_id)
);

-- Alocações de créditos (monthly, bonus, pack)
CREATE TABLE credit_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id VARCHAR NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

    -- Tipo de alocação
    type VARCHAR NOT NULL CHECK (type IN ('monthly', 'bonus', 'pack')),

    -- Quantidade
    amount DECIMAL(10,2) NOT NULL,
    remaining_amount DECIMAL(10,2) NOT NULL,

    -- Expiração (null = nunca expira)
    expires_at TIMESTAMP NULL,

    -- Metadados
    source_description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),

    INDEX idx_workspace_expiry (workspace_id, expires_at, created_at),
    INDEX idx_expiry_cleanup (expires_at) WHERE expires_at IS NOT NULL
);

-- Transações de crédito (histórico de débitos/créditos)
CREATE TABLE credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id VARCHAR NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    allocation_id UUID NULL REFERENCES credit_allocations(id) ON DELETE SET NULL,

    -- Tipo de transação
    type VARCHAR NOT NULL CHECK (type IN ('debit', 'credit')),

    -- Categoria de crédito
    credit_category VARCHAR NOT NULL CHECK (credit_category IN ('report', 'full')),

    -- Quantidade
    amount DECIMAL(10,2) NOT NULL,

    -- Razão/contexto
    reason VARCHAR NOT NULL,
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMP DEFAULT NOW(),

    INDEX idx_workspace_transactions (workspace_id, created_at DESC),
    INDEX idx_allocation_transactions (allocation_id)
);

-- Reservas temporárias de crédito para scheduler
CREATE TABLE scheduled_credit_holds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id VARCHAR NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

    -- Identificador do relatório agendado
    report_id VARCHAR NOT NULL,

    -- Créditos reservados
    report_credits_reserved DECIMAL(10,2) NOT NULL DEFAULT 0,
    full_credits_reserved DECIMAL(10,2) NOT NULL DEFAULT 0,

    -- Expiração da reserva
    expires_at TIMESTAMP NOT NULL,

    created_at TIMESTAMP DEFAULT NOW(),

    INDEX idx_workspace_holds (workspace_id),
    INDEX idx_expiry_holds (expires_at)
);

-- Eventos de uso para auditoria e quotas
CREATE TABLE usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id VARCHAR NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

    -- Tipo de evento
    event_type VARCHAR NOT NULL,

    -- Detalhes do uso
    resource_type VARCHAR NOT NULL, -- 'report', 'analysis', 'credits'
    resource_id VARCHAR NULL,

    -- Custos
    report_credits_cost DECIMAL(10,2) DEFAULT 0,
    full_credits_cost DECIMAL(10,2) DEFAULT 0,

    -- Status
    status VARCHAR NOT NULL DEFAULT 'completed', -- completed, failed, insufficient_credits

    -- Metadados
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMP DEFAULT NOW(),

    INDEX idx_workspace_events (workspace_id, created_at DESC),
    INDEX idx_event_type (event_type, created_at DESC)
);

-- Configurações de planos (para referência)
CREATE TABLE plan_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_name VARCHAR NOT NULL UNIQUE,

    -- Limites
    monitor_limit INTEGER NOT NULL,

    -- Créditos mensais
    report_credits_month DECIMAL(10,2) NOT NULL,
    full_credits_month DECIMAL(10,2) NOT NULL,

    -- Bônus primeiro mês
    first_month_full_bonus DECIMAL(10,2) NOT NULL,
    first_month_bonus_expiry_days INTEGER NOT NULL DEFAULT 90,

    -- Rollover caps
    full_rollover_cap DECIMAL(10,2) NOT NULL,
    report_rollover_cap DECIMAL(10,2) NOT NULL,

    -- Micro-tier pricing
    tier_1_processes INTEGER NOT NULL DEFAULT 5,   -- 1-5 processes
    tier_1_credit_cost DECIMAL(10,2) NOT NULL DEFAULT 0.25,

    tier_2_processes INTEGER NOT NULL DEFAULT 12,  -- 6-12 processes
    tier_2_credit_cost DECIMAL(10,2) NOT NULL DEFAULT 0.5,

    tier_3_processes INTEGER NOT NULL DEFAULT 25,  -- 13-25 processes
    tier_3_credit_cost DECIMAL(10,2) NOT NULL DEFAULT 1.0,

    -- FULL analysis
    full_credit_per_batch INTEGER NOT NULL DEFAULT 10, -- up to 10 processes per FULL credit

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Inserir configurações padrão dos planos
INSERT INTO plan_configurations (
    plan_name, monitor_limit, report_credits_month, full_credits_month,
    first_month_full_bonus, full_rollover_cap, report_rollover_cap,
    full_credit_per_batch
) VALUES
(
    'STARTER', 100, 12, 5, 25, 50, 36, 10
),
(
    'PROFESSIONAL', 300, 40, 15, 75, 150, 120, 10
),
(
    'ENTERPRISE', -1, -1, -1, 0, -1, -1, 10
);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
CREATE TRIGGER update_workspace_credits_updated_at
    BEFORE UPDATE ON workspace_credits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plan_configurations_updated_at
    BEFORE UPDATE ON plan_configurations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Função para cleanup de alocações expiradas
CREATE OR REPLACE FUNCTION cleanup_expired_allocations()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    -- Marcar allocations expiradas como 0
    UPDATE credit_allocations
    SET remaining_amount = 0
    WHERE expires_at < NOW()
    AND remaining_amount > 0;

    GET DIAGNOSTICS expired_count = ROW_COUNT;

    -- Criar eventos de expiração
    INSERT INTO usage_events (workspace_id, event_type, resource_type, metadata)
    SELECT
        workspace_id,
        'credit_expired',
        'credits',
        jsonb_build_object(
            'allocation_id', id,
            'expired_amount', remaining_amount,
            'allocation_type', type
        )
    FROM credit_allocations
    WHERE expires_at < NOW()
    AND remaining_amount > 0;

    RETURN expired_count;
END;
$$ language 'plpgsql';

-- Função para cleanup de holds expirados
CREATE OR REPLACE FUNCTION cleanup_expired_holds()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    DELETE FROM scheduled_credit_holds
    WHERE expires_at < NOW();

    GET DIAGNOSTICS expired_count = ROW_COUNT;
    RETURN expired_count;
END;
$$ language 'plpgsql';

-- Views para facilitar consultas

-- View de saldo disponível considerando holds
CREATE VIEW workspace_available_credits AS
SELECT
    wc.workspace_id,
    wc.report_credits_balance - COALESCE(holds.report_holds, 0) as available_report_credits,
    wc.full_credits_balance - COALESCE(holds.full_holds, 0) as available_full_credits,
    wc.report_credits_balance,
    wc.full_credits_balance,
    COALESCE(holds.report_holds, 0) as report_credits_held,
    COALESCE(holds.full_holds, 0) as full_credits_held
FROM workspace_credits wc
LEFT JOIN (
    SELECT
        workspace_id,
        SUM(report_credits_reserved) as report_holds,
        SUM(full_credits_reserved) as full_holds
    FROM scheduled_credit_holds
    WHERE expires_at > NOW()
    GROUP BY workspace_id
) holds ON wc.workspace_id = holds.workspace_id;

-- View de breakdown de allocations por workspace
CREATE VIEW workspace_credit_breakdown AS
SELECT
    ca.workspace_id,
    ca.type as allocation_type,
    COUNT(*) as allocation_count,
    SUM(ca.amount) as total_allocated,
    SUM(ca.remaining_amount) as total_remaining,
    SUM(ca.amount - ca.remaining_amount) as total_consumed,
    MIN(ca.expires_at) as earliest_expiry,
    MAX(ca.expires_at) as latest_expiry
FROM credit_allocations ca
WHERE ca.remaining_amount > 0
GROUP BY ca.workspace_id, ca.type;

-- Comentários de documentação
COMMENT ON TABLE workspace_credits IS 'Saldo atual de créditos por workspace com caps de rollover';
COMMENT ON TABLE credit_allocations IS 'Alocações de créditos com expiração e tipo (monthly/bonus/pack)';
COMMENT ON TABLE credit_transactions IS 'Histórico de débitos e créditos com auditoria completa';
COMMENT ON TABLE scheduled_credit_holds IS 'Reservas temporárias de crédito para relatórios agendados';
COMMENT ON TABLE usage_events IS 'Eventos de uso para auditoria e controle de quotas';
COMMENT ON TABLE plan_configurations IS 'Configurações de planos com pricing tiers';

-- Permissions (ajustar conforme necessário)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
-- GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_user;