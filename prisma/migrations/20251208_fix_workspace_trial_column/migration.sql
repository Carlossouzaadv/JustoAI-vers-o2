-- Fix missing trialEndsAt column in workspaces table
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(3);

-- Add TRIAL value to Plan enum if not exists
-- Only running this if it doesn't cause error (postgres doesn't have IF NOT EXISTS for enum values easily but usually safe to skip or handle manually if needed, but the error is specifically about the column)
-- ALTER TYPE "Plan" ADD VALUE IF NOT EXISTS 'TRIAL';
