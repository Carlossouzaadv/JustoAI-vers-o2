-- ================================================================
-- MIGRATION: Sistema de Aprofundar Análise
-- ================================================================
-- Implementa análise FAST/FULL com cache, versioning e créditos

-- Tabela de versões de análise de caso
CREATE TABLE case_analysis_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    process_id UUID NOT NULL, -- Referência ao processo
    workspace_id VARCHAR NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

    -- Versioning
    version_number INTEGER NOT NULL,

    -- Configuração da análise
    analysis_type VARCHAR NOT NULL CHECK (analysis_type IN ('FAST', 'FULL')),
    model_used VARCHAR NOT NULL, -- 'gemini-1.5-flash', 'gemini-1.5-pro', etc.

    -- Créditos e custos
    full_credits_used DECIMAL(10,2) DEFAULT 0,
    fast_credits_used DECIMAL(10,2) DEFAULT 0,

    -- Conteúdo da análise
    summary_json JSONB NOT NULL DEFAULT '{}',
    insights_json JSONB DEFAULT '{}',
    confidence_score DECIMAL(3,2) DEFAULT 0,

    -- Arquivos relacionados
    report_url VARCHAR NULL, -- URL do PDF gerado
    source_files_metadata JSONB DEFAULT '[]', -- Lista dos arquivos usados

    -- Cache e processamento
    analysis_key VARCHAR(64) NULL, -- SHA256 para cache
    processing_time_ms INTEGER NULL,

    -- Auditoria
    created_by VARCHAR NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- Status
    status VARCHAR NOT NULL CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')) DEFAULT 'PENDING',
    error_message TEXT NULL,

    INDEX idx_process_versions (process_id, version_number DESC),
    INDEX idx_workspace_analysis (workspace_id, created_at DESC),
    INDEX idx_analysis_key (analysis_key),
    INDEX idx_status (status, created_at),
    UNIQUE(process_id, version_number)
);

-- Tabela de jobs de análise (queue + lock)
CREATE TABLE analysis_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    process_id UUID NOT NULL,
    workspace_id VARCHAR NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

    -- Identificação única para cache/lock
    analysis_key VARCHAR(64) NOT NULL,

    -- Status do job
    status VARCHAR NOT NULL CHECK (status IN ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED')) DEFAULT 'QUEUED',

    -- Lock Redis
    lock_token VARCHAR(128) NULL,
    lock_acquired_at TIMESTAMP NULL,
    lock_expires_at TIMESTAMP NULL,

    -- Configuração
    analysis_type VARCHAR NOT NULL CHECK (analysis_type IN ('FAST', 'FULL')),
    model_hint VARCHAR DEFAULT 'gemini-1.5-flash',

    -- Arquivos para processar
    files_metadata JSONB DEFAULT '[]',

    -- Progresso e resultado
    progress INTEGER DEFAULT 0, -- 0-100
    result_version_id UUID NULL,

    -- Timing
    created_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP NULL,
    finished_at TIMESTAMP NULL,

    -- Worker info
    worker_id VARCHAR NULL,
    retry_count INTEGER DEFAULT 0,

    -- Metadata adicional
    metadata JSONB DEFAULT '{}',

    INDEX idx_analysis_key (analysis_key),
    INDEX idx_status_jobs (status, created_at),
    INDEX idx_workspace_jobs (workspace_id, created_at DESC),
    INDEX idx_lock_expiry (lock_expires_at) WHERE lock_expires_at IS NOT NULL
);

-- Tabela de cache de análise
CREATE TABLE analysis_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Chave única do cache
    analysis_key VARCHAR(64) NOT NULL UNIQUE,

    -- Dados cacheados
    result_data JSONB NOT NULL,
    model_used VARCHAR NOT NULL,
    analysis_type VARCHAR NOT NULL,

    -- Invalidação
    process_id UUID NOT NULL,
    last_movement_date TIMESTAMP NULL, -- Para validação de cache

    -- TTL e metadata
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NULL,
    access_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMP DEFAULT NOW(),

    -- Compressão e tamanho
    compressed BOOLEAN DEFAULT FALSE,
    data_size_bytes INTEGER DEFAULT 0,

    INDEX idx_analysis_key_cache (analysis_key),
    INDEX idx_process_cache (process_id, created_at DESC),
    INDEX idx_expiry_cache (expires_at) WHERE expires_at IS NOT NULL
);

-- Tabela de histórico de movimentações do processo (para invalidação de cache)
CREATE TABLE process_movements_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    process_id UUID NOT NULL,

    -- Data da última movimentação conhecida
    last_movement_date TIMESTAMP NOT NULL,

    -- Controle de mudanças
    movements_hash VARCHAR(64) NULL, -- Hash das movimentações para detectar mudanças
    movements_count INTEGER DEFAULT 0,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(process_id),
    INDEX idx_process_tracking (process_id),
    INDEX idx_last_movement (last_movement_date DESC)
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
CREATE TRIGGER update_case_analysis_versions_updated_at
    BEFORE UPDATE ON case_analysis_versions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_process_movements_tracking_updated_at
    BEFORE UPDATE ON process_movements_tracking
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Função para gerar próximo número de versão
CREATE OR REPLACE FUNCTION get_next_analysis_version(p_process_id UUID)
RETURNS INTEGER AS $$
DECLARE
    next_version INTEGER;
BEGIN
    SELECT COALESCE(MAX(version_number), 0) + 1
    INTO next_version
    FROM case_analysis_versions
    WHERE process_id = p_process_id;

    RETURN next_version;
END;
$$ language 'plpgsql';

-- Função para limpar cache expirado
CREATE OR REPLACE FUNCTION cleanup_expired_analysis_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM analysis_cache
    WHERE expires_at < NOW();

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RETURN deleted_count;
END;
$$ language 'plpgsql';

-- Função para invalidar cache por processo
CREATE OR REPLACE FUNCTION invalidate_process_analysis_cache(p_process_id UUID)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM analysis_cache
    WHERE process_id = p_process_id;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    -- Registrar evento de invalidação
    INSERT INTO usage_events (workspace_id, event_type, resource_type, resource_id, metadata)
    SELECT
        w.id,
        'cache_invalidated',
        'analysis_cache',
        p_process_id::VARCHAR,
        jsonb_build_object(
            'cache_entries_removed', deleted_count,
            'reason', 'process_movement_detected'
        )
    FROM workspaces w
    LIMIT 1; -- Placeholder - precisa da workspace_id real

    RETURN deleted_count;
END;
$$ language 'plpgsql';

-- View para estatísticas de análise
CREATE VIEW analysis_stats AS
SELECT
    cav.workspace_id,
    cav.analysis_type,
    cav.model_used,
    COUNT(*) as total_analyses,
    AVG(cav.processing_time_ms) as avg_processing_time_ms,
    SUM(cav.full_credits_used) as total_full_credits,
    SUM(cav.fast_credits_used) as total_fast_credits,
    AVG(cav.confidence_score) as avg_confidence,
    DATE(cav.created_at) as analysis_date
FROM case_analysis_versions cav
WHERE cav.status = 'COMPLETED'
GROUP BY cav.workspace_id, cav.analysis_type, cav.model_used, DATE(cav.created_at)
ORDER BY analysis_date DESC;

-- View para cache hit rate
CREATE VIEW cache_performance AS
SELECT
    DATE(ac.created_at) as cache_date,
    COUNT(*) as cache_entries,
    SUM(ac.access_count) as total_accesses,
    AVG(ac.access_count) as avg_accesses_per_entry,
    COUNT(CASE WHEN ac.expires_at > NOW() THEN 1 END) as active_entries,
    COUNT(CASE WHEN ac.expires_at <= NOW() THEN 1 END) as expired_entries
FROM analysis_cache ac
GROUP BY DATE(ac.created_at)
ORDER BY cache_date DESC;

-- Comentários de documentação
COMMENT ON TABLE case_analysis_versions IS 'Versões de análise de casos com metadata completa';
COMMENT ON TABLE analysis_jobs IS 'Queue de jobs de análise com controle de lock Redis';
COMMENT ON TABLE analysis_cache IS 'Cache de resultados de análise com TTL e invalidação';
COMMENT ON TABLE process_movements_tracking IS 'Rastreamento de movimentações para invalidação de cache';

-- Configurações default
INSERT INTO plan_configurations (plan_name, full_credit_per_batch)
VALUES ('ANALYSIS_CONFIG', 10)
ON CONFLICT (plan_name) DO UPDATE SET
    full_credit_per_batch = EXCLUDED.full_credit_per_batch;

-- Permissions (ajustar conforme necessário)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
-- GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_user;