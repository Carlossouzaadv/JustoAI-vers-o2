-- Fix missing columns that are causing production errors
-- Added processoId to cases table
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "processoId" TEXT;

-- Added textSha to case_documents table (for deduplication)
ALTER TABLE "case_documents" ADD COLUMN IF NOT EXISTS "textSha" TEXT;

-- Add index for textSha for faster deduplication lookups
CREATE INDEX IF NOT EXISTS "case_documents_textSha_idx" ON "case_documents"("textSha");

-- Verify the columns exist
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'cases' AND column_name = 'processoId';
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'case_documents' AND column_name = 'textSha';
