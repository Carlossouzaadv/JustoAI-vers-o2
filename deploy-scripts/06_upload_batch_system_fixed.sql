-- ================================================================
-- MIGRATION: Sistema de Upload de Excel em Lotes (FIXED)
-- ================================================================

-- Tabela principal de lotes de upload
CREATE TABLE IF NOT EXISTS upload_batch (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

    -- Informações do arquivo
    file_name TEXT NOT NULL,
    file_path TEXT NULL,
    file_size BIGINT NOT NULL,

    -- Status e progresso
    status "UploadBatchStatus" NOT NULL DEFAULT 'PROCESSING',
    total_rows INTEGER NOT NULL DEFAULT 0,
    processed INTEGER NOT NULL DEFAULT 0,
    successful INTEGER NOT NULL DEFAULT 0,
    failed INTEGER NOT NULL DEFAULT 0,

    -- Metadados
    errors JSONB DEFAULT '[]',
    summary JSONB DEFAULT '{}',
    config JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_upload_batch_workspace
    ON upload_batch(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_upload_batch_status
    ON upload_batch(status, created_at DESC);

-- Tabela de linhas individuais do lote
CREATE TABLE IF NOT EXISTS upload_batch_row (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    batch_id TEXT NOT NULL REFERENCES upload_batch(id) ON DELETE CASCADE,

    -- Posição e dados da linha
    row_index INTEGER NOT NULL,
    row_data JSONB NOT NULL,

    -- Status do processamento
    status "UploadRowStatus" NOT NULL DEFAULT 'PENDING',

    -- Resultado
    process_id TEXT NULL,
    error_message JSONB NULL,
    retry_count INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(batch_id, row_index)
);

CREATE INDEX IF NOT EXISTS idx_upload_batch_row_batch
    ON upload_batch_row(batch_id, row_index);

CREATE INDEX IF NOT EXISTS idx_upload_batch_row_status
    ON upload_batch_row(batch_id, status);

-- Tabela de eventos do lote (para SSE e auditoria)
CREATE TABLE IF NOT EXISTS upload_batch_events (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    batch_id TEXT NOT NULL REFERENCES upload_batch(id) ON DELETE CASCADE,

    -- Tipo e dados do evento
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_upload_batch_events_batch
    ON upload_batch_events(batch_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_upload_batch_events_type
    ON upload_batch_events(event_type, created_at DESC);

-- Tabela de telemetria Judit (para controle de usage)
CREATE TABLE IF NOT EXISTS judit_telemetry (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

    -- Contexto da chamada
    batch_id TEXT NULL REFERENCES upload_batch(id) ON DELETE SET NULL,
    process_number TEXT NOT NULL,
    tribunal TEXT NOT NULL,

    -- Resultado da chamada
    success BOOLEAN NOT NULL,
    response_time_ms INTEGER NULL,

    -- Dados retornados (se sucesso)
    docs_retrieved INTEGER DEFAULT 0,
    movements_count INTEGER DEFAULT 0,
    parties_count INTEGER DEFAULT 0,

    -- Erro (se falha)
    error_code TEXT NULL,
    error_message TEXT NULL,
    retry_count INTEGER DEFAULT 0,

    -- Rate limiting
    rate_limit_hit BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_judit_telemetry_workspace
    ON judit_telemetry(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_judit_telemetry_batch
    ON judit_telemetry(batch_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_judit_telemetry_success
    ON judit_telemetry(success, created_at DESC);

-- Triggers para updated_at
CREATE TRIGGER update_upload_batch_updated_at
    BEFORE UPDATE ON upload_batch
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_upload_batch_row_updated_at
    BEFORE UPDATE ON upload_batch_row
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- View para estatísticas de lotes
CREATE OR REPLACE VIEW upload_batch_stats AS
SELECT
    ub.id as batch_id,
    ub.workspace_id,
    ub.file_name,
    ub.status,
    ub.total_rows,
    ub.processed,
    ub.successful,
    ub.failed,
    CASE
        WHEN ub.total_rows > 0 THEN ROUND((ub.processed::DECIMAL / ub.total_rows) * 100, 2)
        ELSE 0
    END as progress_percentage,
    CASE
        WHEN ub.processed > 0 THEN ROUND((ub.successful::DECIMAL / ub.processed) * 100, 2)
        ELSE 0
    END as success_rate,
    EXTRACT(EPOCH FROM (COALESCE(ub.updated_at, NOW()) - ub.created_at))/60 as duration_minutes,
    ub.created_at,
    ub.updated_at
FROM upload_batch ub;

-- View para telemetria Judit agregada
CREATE OR REPLACE VIEW judit_usage_stats AS
SELECT
    workspace_id,
    COUNT(*) as total_calls,
    SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_calls,
    SUM(CASE WHEN success THEN 0 ELSE 1 END) as failed_calls,
    ROUND(AVG(CASE WHEN success THEN response_time_ms END), 2) as avg_response_time_ms,
    SUM(docs_retrieved) as total_docs_retrieved,
    SUM(movements_count) as total_movements,
    SUM(parties_count) as total_parties,
    DATE(created_at) as call_date
FROM judit_telemetry
GROUP BY workspace_id, DATE(created_at)
ORDER BY call_date DESC;

-- Função para cleanup de batches antigos
CREATE OR REPLACE FUNCTION cleanup_old_upload_batches(retention_days INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM upload_batch
    WHERE created_at < NOW() - INTERVAL '1 day' * retention_days
    AND status IN ('COMPLETED', 'FAILED', 'CANCELLED');

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RETURN deleted_count;
END;
$$ language 'plpgsql';

-- Função para estatísticas de rate limiting
CREATE OR REPLACE FUNCTION get_judit_rate_stats(workspace_id_param TEXT, time_window_minutes INTEGER DEFAULT 60)
RETURNS TABLE(
    total_calls BIGINT,
    successful_calls BIGINT,
    rate_limit_hits BIGINT,
    avg_response_time NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) as total_calls,
        SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_calls,
        SUM(CASE WHEN rate_limit_hit THEN 1 ELSE 0 END) as rate_limit_hits,
        ROUND(AVG(CASE WHEN success THEN response_time_ms END), 2) as avg_response_time
    FROM judit_telemetry
    WHERE workspace_id = workspace_id_param
    AND created_at >= NOW() - INTERVAL '1 minute' * time_window_minutes;
END;
$$ language 'plpgsql';

-- Comentários de documentação
COMMENT ON TABLE upload_batch IS 'Lotes de upload de Excel com controle de progresso';
COMMENT ON TABLE upload_batch_row IS 'Linhas individuais do lote com status de processamento';
COMMENT ON TABLE upload_batch_events IS 'Eventos do lote para SSE e auditoria';
COMMENT ON TABLE judit_telemetry IS 'Telemetria de chamadas à API Judit';
