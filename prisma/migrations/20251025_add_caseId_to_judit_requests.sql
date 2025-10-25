-- Add caseId field to judit_requests table for explicit case association
-- This fixes the issue where webhooks process wrong cases when multiple cases share the same CNJ

ALTER TABLE "judit_requests" ADD COLUMN "case_id" TEXT;

-- Add foreign key constraint
ALTER TABLE "judit_requests" ADD CONSTRAINT "judit_requests_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add indexes for fast lookups and idempotency checks
CREATE INDEX "judit_requests_case_id_idx" ON "judit_requests"("case_id");
CREATE INDEX "judit_requests_request_id_case_id_idx" ON "judit_requests"("request_id", "case_id");
