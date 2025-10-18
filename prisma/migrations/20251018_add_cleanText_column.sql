-- Add cleanText column to case_documents table for storing normalized, AI-friendly text
-- This column stores cleaned and normalized text extracted from the PDF
ALTER TABLE "case_documents" ADD COLUMN IF NOT EXISTS "cleanText" TEXT;

-- Create index on cleanText for potential future text search queries
CREATE INDEX IF NOT EXISTS "case_documents_cleanText_idx" ON "case_documents" USING GIN(to_tsvector('portuguese', COALESCE("cleanText", '')));
