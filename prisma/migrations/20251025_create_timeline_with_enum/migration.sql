-- ================================================================
-- MIGRATION: Criar tabela process_timeline_entries com enum TimelineSource
-- Esta tabela foi definida no schema.prisma mas não havia sido criada
-- ================================================================

-- 1. Criar o enum TimelineSource (se não existir)
DO $$
BEGIN
    CREATE TYPE "public"."TimelineSource" AS ENUM (
        'DOCUMENT_UPLOAD',
        'API_JUDIT',
        'MANUAL_ENTRY',
        'SYSTEM_IMPORT',
        'AI_EXTRACTION'
    );
EXCEPTION WHEN duplicate_object THEN
    NULL;
END
$$;

-- 2. Dropar a tabela antiga se existir (com constraints ruins)
DROP TABLE IF EXISTS "public"."process_timeline_entries" CASCADE;

-- 3. Criar a tabela com o enum correto
CREATE TABLE "public"."process_timeline_entries" (
    "id" VARCHAR(255) PRIMARY KEY,
    "case_id" VARCHAR(255) NOT NULL,
    "content_hash" VARCHAR(255) NOT NULL,
    "event_date" TIMESTAMP NOT NULL,
    "event_type" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "normalized_content" TEXT NOT NULL,
    "source" "public"."TimelineSource" NOT NULL,
    "source_id" VARCHAR(255),
    "metadata" JSONB,
    "confidence" FLOAT NOT NULL DEFAULT 1.0,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fk_process_timeline_entries_case"
        FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE CASCADE,
    CONSTRAINT "unique_process_timeline_entries_dedup"
        UNIQUE ("case_id", "content_hash")
);

-- 4. Criar índices para otimizar queries
CREATE INDEX "idx_process_timeline_entries_case_id" ON "public"."process_timeline_entries"("case_id");
CREATE INDEX "idx_process_timeline_entries_event_date" ON "public"."process_timeline_entries"("event_date");
CREATE INDEX "idx_process_timeline_entries_source" ON "public"."process_timeline_entries"("source");
CREATE INDEX "idx_process_timeline_entries_created_at" ON "public"."process_timeline_entries"("created_at");

-- 5. Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION "public"."update_process_timeline_entries_updated_at"()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updated_at" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "trigger_process_timeline_entries_updated_at"
    BEFORE UPDATE ON "public"."process_timeline_entries"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."update_process_timeline_entries_updated_at"();

-- 6. Documentação
COMMENT ON TABLE "public"."process_timeline_entries" IS 'Armazena eventos de timeline unificados de processos, de múltiplas fontes (PDF, API JUDIT, entrada manual)';
COMMENT ON COLUMN "public"."process_timeline_entries"."content_hash" IS 'Hash SHA256 do conteúdo normalizado para deduplicação';
COMMENT ON COLUMN "public"."process_timeline_entries"."event_date" IS 'Data original do andamento/evento';
COMMENT ON COLUMN "public"."process_timeline_entries"."event_type" IS 'Tipo do evento (ex: Juntada, Despacho, Sentença)';
COMMENT ON COLUMN "public"."process_timeline_entries"."source" IS 'Origem do andamento (DOCUMENT_UPLOAD, API_JUDIT, MANUAL_ENTRY, SYSTEM_IMPORT, AI_EXTRACTION)';
COMMENT ON COLUMN "public"."process_timeline_entries"."confidence" IS 'Nível de confiança na extração (0.0 a 1.0)';
COMMENT ON TYPE "public"."TimelineSource" IS 'Enumeração das fontes de timeline: DOCUMENT_UPLOAD, API_JUDIT, MANUAL_ENTRY, SYSTEM_IMPORT, AI_EXTRACTION';
