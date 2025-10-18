-- Add isDuplicate column to case_documents table for deduplication logic
-- This column tracks whether a document is a duplicate of another
ALTER TABLE "case_documents" ADD COLUMN IF NOT EXISTS "isDuplicate" BOOLEAN NOT NULL DEFAULT false;

-- Create index on isDuplicate for faster queries filtering out duplicates
CREATE INDEX IF NOT EXISTS "case_documents_isDuplicate_idx" ON "case_documents"("isDuplicate");

-- Create composite index for efficient deduplication checks
CREATE INDEX IF NOT EXISTS "case_documents_textSha_isDuplicate_idx" ON "case_documents"("textSha", "isDuplicate");
