-- ================================================================
-- MIGRATION: Sistema de Upload de Excel em Lotes
-- ================================================================
-- Implementa tabelas para upload, controle e telemetria de processamento Excel

-- Tabela principal de lotes de upload
CREATE TABLE upload_batch (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id VARCHAR NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

    -- Informações do arquivo
    file_name VARCHAR NOT NULL,
    file_path VARCHAR NULL, -- Caminho do arquivo salvo temporariamente
    file_size BIGINT NOT NULL,

    -- Status e progresso
    status VARCHAR NOT NULL CHECK (status IN ('PROCESSING', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED')) DEFAULT 'PROCESSING',
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
    updated_at TIMESTAMP DEFAULT NOW(),

    INDEX idx_workspace_batch (workspace_id, created_at DESC),
    INDEX idx_status_batch (status, created_at DESC)
);

-- Tabela de linhas individuais do lote
CREATE TABLE upload_batch_row (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES upload_batch(id) ON DELETE CASCADE,

    -- Posição e dados da linha
    row_index INTEGER NOT NULL,
    row_data JSONB NOT NULL, -- Dados originais da linha Excel

    -- Status do processamento
    status VARCHAR NOT NULL CHECK (status IN ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'SKIPPED', 'CANCELLED')) DEFAULT 'PENDING',

    -- Resultado
    process_id UUID NULL, -- ID do processo criado (se sucesso)
    error_message JSONB NULL, -- Detalhes do erro (se falha)
    retry_count INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    INDEX idx_batch_rows (batch_id, row_index),
    INDEX idx_batch_status (batch_id, status),
    UNIQUE(batch_id, row_index)
);

-- Tabela de eventos do lote (para SSE e auditoria)
CREATE TABLE upload_batch_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES upload_batch(id) ON DELETE CASCADE,

    -- Tipo e dados do evento
    event_type VARCHAR NOT NULL, -- 'PROGRESS', 'ERROR', 'CONTROL_ACTION', 'STATUS_CHANGE'
    payload JSONB NOT NULL,

    created_at TIMESTAMP DEFAULT NOW(),

    INDEX idx_batch_events (batch_id, created_at DESC),
    INDEX idx_event_type (event_type, created_at DESC)
);

-- Tabela de telemetria Judit (para controle de usage)
CREATE TABLE judit_telemetry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id VARCHAR NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

    -- Contexto da chamada
    batch_id UUID NULL REFERENCES upload_batch(id) ON DELETE SET NULL,
    process_number VARCHAR NOT NULL,
    tribunal VARCHAR NOT NULL,

    -- Resultado da chamada
    success BOOLEAN NOT NULL,
    response_time_ms INTEGER NULL,

    -- Dados retornados (se sucesso)
    docs_retrieved INTEGER DEFAULT 0,
    movements_count INTEGER DEFAULT 0,
    parties_count INTEGER DEFAULT 0,

    -- Erro (se falha)
    error_code VARCHAR NULL,
    error_message TEXT NULL,
    retry_count INTEGER DEFAULT 0,

    -- Rate limiting
    rate_limit_hit BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT NOW(),

    INDEX idx_workspace_telemetry (workspace_id, created_at DESC),
    INDEX idx_batch_telemetry (batch_id, created_at DESC),
    INDEX idx_success_telemetry (success, created_at DESC)
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
CREATE TRIGGER update_upload_batch_updated_at
    BEFORE UPDATE ON upload_batch
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_upload_batch_row_updated_at
    BEFORE UPDATE ON upload_batch_row
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- View para estatísticas de lotes
CREATE VIEW upload_batch_stats AS
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
CREATE VIEW judit_usage_stats AS
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
    -- Deletar batches antigos (com CASCADE para rows e events)
    DELETE FROM upload_batch
    WHERE created_at < NOW() - INTERVAL '1 day' * retention_days
    AND status IN ('COMPLETED', 'FAILED', 'CANCELLED');

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RETURN deleted_count;
END;
$$ language 'plpgsql';

-- Função para estatísticas de rate limiting
CREATE OR REPLACE FUNCTION get_judit_rate_stats(workspace_id_param VARCHAR, time_window_minutes INTEGER DEFAULT 60)
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

-- Permissions (ajustar conforme necessário)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
-- GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_user;