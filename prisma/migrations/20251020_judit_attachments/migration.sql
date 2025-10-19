-- ================================================================
-- MIGRATION: Anexos JUDIT
-- ================================================================
-- Adiciona campos para rastrear anexos baixados via JUDIT
-- ================================================================

-- Campo para URL original do anexo JUDIT
ALTER TABLE "case_documents"
  ADD COLUMN IF NOT EXISTS "judit_attachment_url" VARCHAR(500) DEFAULT NULL;

-- Campo para origem do documento
ALTER TABLE "case_documents"
  ADD COLUMN IF NOT EXISTS "source_origin" VARCHAR(50) DEFAULT 'USER_UPLOAD';

-- Enum para source_origin (opcional, pode usar apenas VARCHAR)
-- Valores: 'USER_UPLOAD', 'JUDIT_ATTACHMENT', 'MANUAL_ENTRY'

-- Índice para buscar documentos do JUDIT
CREATE INDEX IF NOT EXISTS "idx_case_documents_source_origin"
  ON "case_documents"("source_origin", "created_at" DESC);

-- Comentários
COMMENT ON COLUMN "case_documents"."judit_attachment_url" IS
  'URL original do anexo baixado via JUDIT API';

COMMENT ON COLUMN "case_documents"."source_origin" IS
  'Origem do documento: USER_UPLOAD (padrão), JUDIT_ATTACHMENT (JUDIT API), MANUAL_ENTRY (inserção manual)';
