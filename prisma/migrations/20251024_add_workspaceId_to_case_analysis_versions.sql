-- AddColumn workspaceId to case_analysis_versions table
-- This column is required by the schema but was missing from the database

-- Step 1: Add the workspaceId column (nullable first)
ALTER TABLE "case_analysis_versions"
ADD COLUMN "workspaceId" TEXT;

-- Step 2: Populate workspaceId from the related case
-- Join with cases table to get the workspaceId
UPDATE "case_analysis_versions" cav
SET "workspaceId" = c."workspaceId"
FROM "cases" c
WHERE cav."caseId" = c."id"
AND cav."workspaceId" IS NULL;

-- Step 3: Make the column NOT NULL and add foreign key constraint
ALTER TABLE "case_analysis_versions"
ALTER COLUMN "workspaceId" SET NOT NULL;

-- Step 4: Add foreign key constraint
ALTER TABLE "case_analysis_versions"
ADD CONSTRAINT "case_analysis_versions_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE;

-- Step 5: Add index for performance (important for querying by workspaceId)
CREATE INDEX "case_analysis_versions_workspaceId_idx"
ON "case_analysis_versions"("workspaceId");
