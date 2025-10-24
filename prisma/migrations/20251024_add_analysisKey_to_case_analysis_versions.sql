-- Add analysisKey column to case_analysis_versions table for analysis caching
-- This column is required by the Prisma schema but was missing from the database

-- Step 1: Add the analysisKey column (nullable, VARCHAR(64))
ALTER TABLE "case_analysis_versions"
ADD COLUMN IF NOT EXISTS "analysisKey" VARCHAR(64);

-- Step 2: Create index on analysisKey for fast cache lookups
CREATE INDEX IF NOT EXISTS "case_analysis_versions_analysisKey_idx"
ON "case_analysis_versions"("analysisKey");

-- Add comment for documentation
COMMENT ON COLUMN "case_analysis_versions"."analysisKey" IS
  'Unique key for caching analysis results - used to identify cached versions by hash of analysis parameters';
