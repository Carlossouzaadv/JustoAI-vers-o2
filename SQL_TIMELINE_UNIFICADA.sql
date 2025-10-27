-- ================================================================
-- TIMELINE UNIFICADA INTELIGENTE - SQL MIGRATION
-- Execute no Supabase SQL Editor
-- ================================================================

-- 1. Criar enum EventRelationType
CREATE TYPE "EventRelationType" AS ENUM ('DUPLICATE', 'ENRICHMENT', 'RELATED', 'CONFLICT');

-- 2. Adicionar novos campos à tabela process_timeline_entries
ALTER TABLE "process_timeline_entries"
ADD COLUMN IF NOT EXISTS "base_event_id" TEXT,
ADD COLUMN IF NOT EXISTS "enriched_by_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "relation_type" "EventRelationType",
ADD COLUMN IF NOT EXISTS "original_texts" JSONB,
ADD COLUMN IF NOT EXISTS "contributing_sources" "TimelineSource"[] DEFAULT ARRAY[]::text[],
ADD COLUMN IF NOT EXISTS "linked_document_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "is_enriched" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "enriched_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "enrichment_model" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "has_conflict" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "conflict_details" JSONB,
ADD COLUMN IF NOT EXISTS "reviewed_by" TEXT,
ADD COLUMN IF NOT EXISTS "reviewed_at" TIMESTAMP(3);

-- 3. Adicionar foreign key constraint para baseEventId
ALTER TABLE "process_timeline_entries"
ADD CONSTRAINT "process_timeline_entries_base_event_id_fkey"
FOREIGN KEY ("base_event_id") REFERENCES "process_timeline_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. Criar índices para performance
CREATE INDEX IF NOT EXISTS "process_timeline_entries_base_event_id_idx" ON "process_timeline_entries"("base_event_id");
CREATE INDEX IF NOT EXISTS "process_timeline_entries_is_enriched_idx" ON "process_timeline_entries"("is_enriched");
CREATE INDEX IF NOT EXISTS "process_timeline_entries_has_conflict_idx" ON "process_timeline_entries"("has_conflict");
CREATE INDEX IF NOT EXISTS "process_timeline_entries_enriched_at_idx" ON "process_timeline_entries"("enriched_at");

-- 5. Adicionar comentários (documentação)
COMMENT ON COLUMN "process_timeline_entries"."base_event_id" IS 'References the base JUDIT event this entry enriches (NULL if this is a base event)';
COMMENT ON COLUMN "process_timeline_entries"."enriched_by_ids" IS 'Array of timeline entry IDs that contributed enrichment to this event';
COMMENT ON COLUMN "process_timeline_entries"."relation_type" IS 'Type of relationship: DUPLICATE (same event from different sources), ENRICHMENT (adds context to base), RELATED (semantically similar), CONFLICT (contradictory info)';
COMMENT ON COLUMN "process_timeline_entries"."original_texts" IS 'JSON object mapping TimelineSource to original description text before enrichment';
COMMENT ON COLUMN "process_timeline_entries"."contributing_sources" IS 'Array of all sources that contributed to this event';
COMMENT ON COLUMN "process_timeline_entries"."linked_document_ids" IS 'Array of case_documents.id that are linked to this timeline event';
COMMENT ON COLUMN "process_timeline_entries"."is_enriched" IS 'True if description was enriched by AI (Gemini Flash)';
COMMENT ON COLUMN "process_timeline_entries"."enrichment_model" IS 'Model used for enrichment (e.g., gemini-1.5-flash)';
COMMENT ON COLUMN "process_timeline_entries"."has_conflict" IS 'True if conflicting information detected between sources';
COMMENT ON COLUMN "process_timeline_entries"."conflict_details" IS 'JSON object with conflict type, sources, and details for human review';
COMMENT ON COLUMN "process_timeline_entries"."reviewed_by" IS 'User ID of person who manually resolved a conflict';
COMMENT ON COLUMN "process_timeline_entries"."reviewed_at" IS 'Timestamp when conflict was manually reviewed and resolved';

-- ================================================================
-- ✅ MIGRATION CONCLUÍDA
-- Agora você pode:
-- 1. Gerar o cliente Prisma: npm run db:generate
-- 2. Continuar com a implementação
-- ================================================================
