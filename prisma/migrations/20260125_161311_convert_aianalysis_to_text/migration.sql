-- Convert aiAnalysis column from JSON to TEXT
-- This allows storing unlimited size analysis data without truncation
-- Postgres TEXT supports up to 4GB

-- Create new text column
ALTER TABLE "case_analysis_versions" ADD COLUMN "aiAnalysis_new" TEXT;

-- Migrate data from JSON to TEXT (stringify JSON values)
UPDATE "case_analysis_versions"
SET "aiAnalysis_new" = CASE
  WHEN "aiAnalysis" IS NULL THEN NULL
  ELSE "aiAnalysis"::text
END;

-- Drop old JSON column
ALTER TABLE "case_analysis_versions" DROP COLUMN "aiAnalysis";

-- Rename new column to original name
ALTER TABLE "case_analysis_versions" RENAME COLUMN "aiAnalysis_new" TO "aiAnalysis";
