-- Add originalDocumentId column to case_documents table for tracking duplicate documents
-- This column references the original document when a duplicate is detected
ALTER TABLE "case_documents" ADD COLUMN IF NOT EXISTS "originalDocumentId" TEXT;

-- Create foreign key constraint
ALTER TABLE "case_documents"
ADD CONSTRAINT "case_documents_originalDocumentId_fkey"
FOREIGN KEY ("originalDocumentId") REFERENCES "case_documents"("id") ON DELETE SET NULL;

-- Create index on originalDocumentId for faster duplicate lookups
CREATE INDEX IF NOT EXISTS "case_documents_originalDocumentId_idx" ON "case_documents"("originalDocumentId");
