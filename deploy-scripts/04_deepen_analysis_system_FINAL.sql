-- ================================================================
-- MIGRATION: Sistema de Aprofundar Análise (FINAL)
-- ================================================================

-- Tabela de jobs de análise (queue + lock)
CREATE TABLE IF NOT EXISTS analysis_jobs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    process_id TEXT NOT NULL,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

    -- Identificação única para cache/lock
    analysis_key VARCHAR(64) NOT NULL,

    -- Status do job
    status "JobStatus" NOT NULL DEFAULT 'QUEUED',

    -- Lock Redis
    lock_token VARCHAR(128) NULL,
    lock_acquired_at TIMESTAMP NULL,
    lock_expires_at TIMESTAMP NULL,

    -- Configuração
    analysis_type "AnalysisType" NOT NULL,
    model_hint TEXT DEFAULT 'gemini-1.5-flash',

    -- Arquivos para processar
    files_metadata JSONB DEFAULT '[]',

    -- Progresso e resultado
    progress INTEGER DEFAULT 0, -- 0-100
    result_version_id TEXT NULL,

    -- Timing
    created_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP NULL,
    finished_at TIMESTAMP NULL,

    -- Worker info
    worker_id TEXT NULL,
    retry_count INTEGER DEFAULT 0,

    -- Metadata adicional
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_analysis_jobs_analysis_key
    ON analysis_jobs(analysis_key);

CREATE INDEX IF NOT EXISTS idx_analysis_jobs_status
    ON analysis_jobs(status, created_at);

CREATE INDEX IF NOT EXISTS idx_analysis_jobs_workspace
    ON analysis_jobs(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analysis_jobs_lock_expiry
    ON analysis_jobs(lock_expires_at) WHERE lock_expires_at IS NOT NULL;

-- Tabela de cache de análise
CREATE TABLE IF NOT EXISTS analysis_cache (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,

    -- Chave única do cache
    analysis_key VARCHAR(64) NOT NULL UNIQUE,

    -- Dados cacheados
    result_data JSONB NOT NULL,
    model_used TEXT NOT NULL,
    analysis_type TEXT NOT NULL,

    -- Invalidação
    process_id TEXT NOT NULL,
    last_movement_date TIMESTAMP NULL, -- Para validação de cache

    -- TTL e metadata
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NULL,
    access_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMP DEFAULT NOW(),

    -- Compressão e tamanho
    compressed BOOLEAN DEFAULT FALSE,
    data_size_bytes INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_analysis_cache_key
    ON analysis_cache(analysis_key);

CREATE INDEX IF NOT EXISTS idx_analysis_cache_process
    ON analysis_cache(process_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analysis_cache_expiry
    ON analysis_cache(expires_at) WHERE expires_at IS NOT NULL;

-- Tabela de histórico de movimentações do processo (para invalidação de cache)
CREATE TABLE IF NOT EXISTS process_movements_tracking (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    process_id TEXT NOT NULL,

    -- Data da última movimentação conhecida
    last_movement_date TIMESTAMP NOT NULL,

    -- Controle de mudanças
    movements_hash VARCHAR(64) NULL, -- Hash das movimentações para detectar mudanças
    movements_count INTEGER DEFAULT 0,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(process_id)
);

CREATE INDEX IF NOT EXISTS idx_process_movements_tracking_process
    ON process_movements_tracking(process_id);

CREATE INDEX IF NOT EXISTS idx_process_movements_tracking_last_movement
    ON process_movements_tracking(last_movement_date DESC);

-- Trigger para updated_at
CREATE TRIGGER update_process_movements_tracking_updated_at
    BEFORE UPDATE ON process_movements_tracking
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Função para gerar próximo número de versão
CREATE OR REPLACE FUNCTION get_next_analysis_version(p_process_id TEXT)
RETURNS INTEGER AS $$
DECLARE
    next_version INTEGER;
BEGIN
    SELECT COALESCE(MAX(version), 0) + 1
    INTO next_version
    FROM case_analysis_versions
    WHERE "caseId" = p_process_id;

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
CREATE OR REPLACE FUNCTION invalidate_process_analysis_cache(p_process_id TEXT)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM analysis_cache
    WHERE process_id = p_process_id;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    -- Registrar evento de invalidação (opcional - pode falhar se workspace não existir)
    BEGIN
        INSERT INTO usage_events (workspace_id, event_type, resource_type, resource_id, metadata)
        SELECT
            w.id,
            'cache_invalidated',
            'analysis_cache',
            p_process_id,
            jsonb_build_object(
                'cache_entries_removed', deleted_count,
                'reason', 'process_movement_detected'
            )
        FROM workspaces w
        LIMIT 1;
    EXCEPTION
        WHEN OTHERS THEN NULL; -- Ignora erros ao registrar evento
    END;

    RETURN deleted_count;
END;
$$ language 'plpgsql';

-- View para cache hit rate (usando apenas analysis_cache, não case_analysis_versions)
CREATE OR REPLACE VIEW cache_performance AS
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

-- View para estatísticas de jobs de análise (usando analysis_jobs em vez de case_analysis_versions)
CREATE OR REPLACE VIEW analysis_jobs_stats AS
SELECT
    aj.workspace_id,
    aj.analysis_type::text as analysis_type,
    aj.model_hint as model_used,
    aj.status::text as status,
    COUNT(*) as total_jobs,
    AVG(EXTRACT(EPOCH FROM (aj.finished_at - aj.started_at)) * 1000) as avg_processing_time_ms,
    DATE(aj.created_at) as job_date
FROM analysis_jobs aj
WHERE aj.finished_at IS NOT NULL
GROUP BY aj.workspace_id, aj.analysis_type::text, aj.model_hint, aj.status::text, DATE(aj.created_at)
ORDER BY job_date DESC;

-- Comentários de documentação
COMMENT ON TABLE analysis_jobs IS 'Queue de jobs de análise com controle de lock Redis';
COMMENT ON TABLE analysis_cache IS 'Cache de resultados de análise com TTL e invalidação';
COMMENT ON TABLE process_movements_tracking IS 'Rastreamento de movimentações para invalidação de cache';
COMMENT ON VIEW cache_performance IS 'Performance do cache de análises';
COMMENT ON VIEW analysis_jobs_stats IS 'Estatísticas de jobs de análise';
