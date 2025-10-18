-- Add analysisVersion column to case_documents table
-- Records which version of analysis/model was used for processing
ALTER TABLE "case_documents" ADD COLUMN IF NOT EXISTS "analysisVersion" TEXT;

-- Create index on analysisVersion for filtering by version
CREATE INDEX IF NOT EXISTS "case_documents_analysisVersion_idx" ON "case_documents"("analysisVersion");
