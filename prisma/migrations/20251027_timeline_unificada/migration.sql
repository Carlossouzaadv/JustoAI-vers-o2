-- CreateEnum for EventRelationType
CREATE TYPE "EventRelationType" AS ENUM ('DUPLICATE', 'ENRICHMENT', 'RELATED', 'CONFLICT');

-- AlterTable ProcessTimelineEntry - Add new fields for unified timeline
ALTER TABLE "process_timeline_entries" ADD COLUMN "base_event_id" TEXT,
ADD COLUMN "enriched_by_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "relation_type" "EventRelationType",
ADD COLUMN "original_texts" JSONB,
ADD COLUMN "contributing_sources" "TimelineSource"[] DEFAULT ARRAY[]::text[],
ADD COLUMN "linked_document_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "is_enriched" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "enriched_at" TIMESTAMP(3),
ADD COLUMN "enrichment_model" VARCHAR(255),
ADD COLUMN "has_conflict" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "conflict_details" JSONB,
ADD COLUMN "reviewed_by" TEXT,
ADD COLUMN "reviewed_at" TIMESTAMP(3);

-- Add foreign key constraint for baseEventId
ALTER TABLE "process_timeline_entries" ADD CONSTRAINT "process_timeline_entries_base_event_id_fkey" FOREIGN KEY ("base_event_id") REFERENCES "process_timeline_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add indexes for performance
CREATE INDEX "process_timeline_entries_base_event_id_idx" ON "process_timeline_entries"("base_event_id");
CREATE INDEX "process_timeline_entries_is_enriched_idx" ON "process_timeline_entries"("is_enriched");
CREATE INDEX "process_timeline_entries_has_conflict_idx" ON "process_timeline_entries"("has_conflict");
CREATE INDEX "process_timeline_entries_enriched_at_idx" ON "process_timeline_entries"("enriched_at");

-- CreateTable for TimelineDocumentLink relation (many-to-many)
-- Note: Using implicit relation from linkedDocumentIds array for now
-- If needed later, can create explicit junction table

-- Add comment documenting new fields
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
