-- Add costEstimate column to case_documents table for cost tracking
ALTER TABLE "case_documents" ADD COLUMN IF NOT EXISTS "costEstimate" DOUBLE PRECISION;

-- Create index on costEstimate for efficient cost queries
CREATE INDEX IF NOT EXISTS "case_documents_costEstimate_idx" ON "case_documents"("costEstimate");
