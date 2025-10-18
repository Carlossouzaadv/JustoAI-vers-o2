-- Add textExtractedAt column to case_documents table
-- Timestamp recording when text was extracted from the PDF
ALTER TABLE "case_documents" ADD COLUMN IF NOT EXISTS "textExtractedAt" TIMESTAMP;

-- Create index on textExtractedAt for queries ordering by extraction time
CREATE INDEX IF NOT EXISTS "case_documents_textExtractedAt_idx" ON "case_documents"("textExtractedAt");
