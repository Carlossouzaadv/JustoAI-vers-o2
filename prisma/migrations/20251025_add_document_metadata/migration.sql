-- ================================================================
-- MIGRATION: Adicionar campos de metadata e data ao documento
-- ================================================================

-- 1. Adicionar coluna documentDate se não existir
ALTER TABLE "case_documents" ADD COLUMN IF NOT EXISTS "document_date" TIMESTAMP;

-- 2. Adicionar coluna metadata se não existir
ALTER TABLE "case_documents" ADD COLUMN IF NOT EXISTS "metadata" JSONB;

-- 3. Criar índices para melhorar performance
CREATE INDEX IF NOT EXISTS "idx_case_documents_document_date" ON "case_documents"("document_date");
CREATE INDEX IF NOT EXISTS "idx_case_documents_source_origin" ON "case_documents"("source_origin");

-- ================================================================
-- COMENTÁRIOS PARA DOCUMENTAÇÃO
-- ================================================================

COMMENT ON COLUMN "case_documents"."document_date" IS 'Data extraída do documento (não data de upload) via análise local de PDF';
COMMENT ON COLUMN "case_documents"."metadata" IS 'Metadados estruturados do documento (tipo, partes, juiz, confiança, etc) extraídos via IA';
