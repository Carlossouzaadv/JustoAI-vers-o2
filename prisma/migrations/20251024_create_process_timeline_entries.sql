-- ================================================================
-- MIGRATION: Criar tabela process_timeline_entries
-- ================================================================
-- Tabela para armazenar eventos de timeline de processos
-- Esta tabela foi definida no schema.prisma mas não havia sido migrada

CREATE TABLE IF NOT EXISTS process_timeline_entries (
    id VARCHAR(255) PRIMARY KEY,
    case_id VARCHAR(255) NOT NULL,
    content_hash VARCHAR(255) NOT NULL,
    event_date TIMESTAMP NOT NULL,
    event_type VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    normalized_content TEXT NOT NULL,
    source VARCHAR(50) NOT NULL,
    source_id VARCHAR(255) NULL,
    metadata JSONB NULL,
    confidence FLOAT NOT NULL DEFAULT 1.0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_process_timeline_entries_case
        FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
    CONSTRAINT unique_process_timeline_entries_dedup
        UNIQUE (case_id, content_hash)
);

-- Criar índices para otimizar queries
CREATE INDEX IF NOT EXISTS idx_process_timeline_entries_case_id ON process_timeline_entries(case_id);
CREATE INDEX IF NOT EXISTS idx_process_timeline_entries_event_date ON process_timeline_entries(event_date);
CREATE INDEX IF NOT EXISTS idx_process_timeline_entries_source ON process_timeline_entries(source);
CREATE INDEX IF NOT EXISTS idx_process_timeline_entries_created_at ON process_timeline_entries(created_at);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_process_timeline_entries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_process_timeline_entries_updated_at
    BEFORE UPDATE ON process_timeline_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_process_timeline_entries_updated_at();

-- Documentação
COMMENT ON TABLE process_timeline_entries IS 'Armazena eventos de timeline unificados de processos, de múltiplas fontes (PDF, API JUDIT, entrada manual)';
COMMENT ON COLUMN process_timeline_entries.content_hash IS 'Hash SHA256 do conteúdo normalizado para deduplicação';
COMMENT ON COLUMN process_timeline_entries.event_date IS 'Data original do andamento/evento';
COMMENT ON COLUMN process_timeline_entries.event_type IS 'Tipo do evento (ex: Juntada, Despacho, Sentença)';
COMMENT ON COLUMN process_timeline_entries.source IS 'Origem do andamento (DOCUMENT_UPLOAD, API_JUDIT, MANUAL_ENTRY, SYSTEM_IMPORT, AI_EXTRACTION)';
COMMENT ON COLUMN process_timeline_entries.confidence IS 'Nível de confiança na extração (0.0 a 1.0)';
