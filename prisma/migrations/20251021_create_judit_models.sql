-- ================================================================
-- MIGRATION: Criar modelos JUDIT (Processo, JuditRequest, JuditMonitoring)
-- ================================================================
-- Estas tabelas foram definidas no schema.prisma mas nunca migradas para o banco

-- Tabela de Processos (JUDIT API Integration)
CREATE TABLE IF NOT EXISTS processos (
    id VARCHAR PRIMARY KEY,
    numero_cnj VARCHAR NOT NULL UNIQUE,
    dados_completos JSONB NULL,
    data_onboarding TIMESTAMP DEFAULT NOW(),
    ultima_atualizacao TIMESTAMP DEFAULT NOW(),

    INDEX idx_numero_cnj (numero_cnj)
);

-- Tabela de Requisições JUDIT
CREATE TABLE IF NOT EXISTS judit_requests (
    id VARCHAR PRIMARY KEY,
    request_id VARCHAR NOT NULL UNIQUE,
    status VARCHAR NOT NULL,
    finalidade VARCHAR NOT NULL,
    processo_id VARCHAR NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    INDEX idx_request_id (request_id),
    INDEX idx_processo_status (processo_id, status)
);

-- Tabela de Monitoramento JUDIT
CREATE TABLE IF NOT EXISTS judit_monitoring (
    id VARCHAR PRIMARY KEY,
    tracking_id VARCHAR NOT NULL UNIQUE,
    tipo VARCHAR NOT NULL DEFAULT 'UNIVERSAL',
    ativo BOOLEAN NOT NULL DEFAULT true,
    processo_id VARCHAR NOT NULL UNIQUE REFERENCES processos(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    INDEX idx_tracking_id (tracking_id),
    INDEX idx_ativo (ativo)
);

-- Função para atualizar updated_at automaticamente (se não existir)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
CREATE TRIGGER update_judit_requests_updated_at
    BEFORE UPDATE ON judit_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_judit_monitoring_updated_at
    BEFORE UPDATE ON judit_monitoring
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_processos_ultima_atualizacao
    BEFORE UPDATE ON processos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comentários de documentação
COMMENT ON TABLE processos IS 'Armazena informações de processos do JUDIT API com dados completos';
COMMENT ON TABLE judit_requests IS 'Rastreia requisições feitas ao JUDIT API';
COMMENT ON TABLE judit_monitoring IS 'Configuração de monitoramento contínuo de processos';
