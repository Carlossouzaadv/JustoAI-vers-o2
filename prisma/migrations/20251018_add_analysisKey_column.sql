-- Add analysisKey column to case_documents table for analysis caching
-- Unique key to identify document for caching analysis results
ALTER TABLE "case_documents" ADD COLUMN IF NOT EXISTS "analysisKey" VARCHAR(64);

-- Create index on analysisKey for fast cache lookups
CREATE INDEX IF NOT EXISTS "case_documents_analysisKey_idx" ON "case_documents"("analysisKey");
