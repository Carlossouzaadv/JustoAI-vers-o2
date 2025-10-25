-- ================================================================
-- MIGRATION: Corrigir coluna source em process_timeline_entries
-- Converter de VARCHAR para enum TimelineSource
-- ================================================================

-- 1. Criar o enum TimelineSource
CREATE TYPE "public"."TimelineSource" AS ENUM (
    'DOCUMENT_UPLOAD',
    'API_JUDIT',
    'MANUAL_ENTRY',
    'SYSTEM_IMPORT',
    'AI_EXTRACTION'
);

-- 2. Alterar coluna source de VARCHAR para enum
ALTER TABLE "public"."process_timeline_entries"
    ALTER COLUMN "source" TYPE "public"."TimelineSource"
    USING "source"::"public"."TimelineSource";

-- Documentação
COMMENT ON TYPE "public"."TimelineSource" IS 'Enumeração das fontes de timeline: DOCUMENT_UPLOAD, API_JUDIT, MANUAL_ENTRY, SYSTEM_IMPORT, AI_EXTRACTION';
