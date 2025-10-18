-- Add workerId column to case_documents table for tracking which worker processed the document
ALTER TABLE "case_documents" ADD COLUMN IF NOT EXISTS "workerId" TEXT;

-- Create index on workerId for efficient worker queries
CREATE INDEX IF NOT EXISTS "case_documents_workerId_idx" ON "case_documents"("workerId");
