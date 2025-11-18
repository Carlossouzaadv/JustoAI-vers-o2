-- Migration: Add TRIAL plan and trialEndsAt field
-- Date: 2025-11-18
-- Purpose: Implement 7-day free trial without credit card

-- Add TRIAL value to Plan enum
ALTER TYPE "Plan" ADD VALUE 'TRIAL';

-- Add trialEndsAt column to workspaces table
ALTER TABLE "workspaces" ADD COLUMN "trialEndsAt" TIMESTAMP;

-- Create comment explaining the field
COMMENT ON COLUMN "workspaces"."trialEndsAt" IS 'Trial expiration date for TRIAL plan - 7 days from workspace creation';
