-- MASTER FIX FOR CREDIT SYSTEM TABLES
-- Ensures all tables and columns exist with correct snake_case names

-- 1. Create Enums if not exist
DO $$ BEGIN
    CREATE TYPE "CreditAllocationType" AS ENUM ('MONTHLY', 'BONUS', 'PACK');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "CreditTransactionType" AS ENUM ('DEBIT', 'CREDIT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "CreditCategory" AS ENUM ('REPORT', 'FULL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "UsageStatus" AS ENUM ('COMPLETED', 'FAILED', 'INSUFFICIENT_CREDITS');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create Tables (IF NOT EXISTS)
-- workspace_credits
CREATE TABLE IF NOT EXISTS "workspace_credits" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "report_credits_balance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "full_credits_balance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "report_credits_rollover_cap" DECIMAL(10,2) NOT NULL DEFAULT 36,
    "full_credits_rollover_cap" DECIMAL(10,2) NOT NULL DEFAULT 50,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_credits_pkey" PRIMARY KEY ("id")
);

-- credit_allocations
CREATE TABLE IF NOT EXISTS "credit_allocations" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "type" "CreditAllocationType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "remaining_amount" DECIMAL(10,2) NOT NULL,
    "expires_at" TIMESTAMP(3),
    "source_description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_allocations_pkey" PRIMARY KEY ("id")
);

-- credit_transactions
CREATE TABLE IF NOT EXISTS "credit_transactions" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "allocation_id" TEXT,
    "type" "CreditTransactionType" NOT NULL,
    "credit_category" "CreditCategory" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("id")
);

-- scheduled_credit_holds
CREATE TABLE IF NOT EXISTS "scheduled_credit_holds" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "report_credits_reserved" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "full_credits_reserved" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheduled_credit_holds_pkey" PRIMARY KEY ("id")
);

-- usage_events
CREATE TABLE IF NOT EXISTS "usage_events" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT,
    "report_credits_cost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "full_credits_cost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" "UsageStatus" NOT NULL DEFAULT 'COMPLETED',
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_events_pkey" PRIMARY KEY ("id")
);

-- plan_configurations
CREATE TABLE IF NOT EXISTS "plan_configurations" (
    "id" TEXT NOT NULL,
    "plan_name" TEXT NOT NULL,
    "monitor_limit" INTEGER NOT NULL,
    "report_credits_month" DECIMAL(10,2) NOT NULL,
    "full_credits_month" DECIMAL(10,2) NOT NULL,
    "first_month_full_bonus" DECIMAL(10,2) NOT NULL,
    "first_month_bonus_expiry_days" INTEGER NOT NULL DEFAULT 90,
    "full_rollover_cap" DECIMAL(10,2) NOT NULL,
    "report_rollover_cap" DECIMAL(10,2) NOT NULL,
    "tier_1_processes" INTEGER NOT NULL DEFAULT 5,
    "tier_1_credit_cost" DECIMAL(10,2) NOT NULL DEFAULT 0.25,
    "tier_2_processes" INTEGER NOT NULL DEFAULT 12,
    "tier_2_credit_cost" DECIMAL(10,2) NOT NULL DEFAULT 0.5,
    "tier_3_processes" INTEGER NOT NULL DEFAULT 25,
    "tier_3_credit_cost" DECIMAL(10,2) NOT NULL DEFAULT 1.0,
    "full_credit_per_batch" INTEGER NOT NULL DEFAULT 10,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_configurations_pkey" PRIMARY KEY ("id")
);

-- 3. Add Indexes (safely)
CREATE UNIQUE INDEX IF NOT EXISTS "workspace_credits_workspace_id_key" ON "workspace_credits"("workspace_id");

CREATE INDEX IF NOT EXISTS "credit_allocations_workspace_id_expires_at_created_at_idx" ON "credit_allocations"("workspace_id", "expires_at", "created_at");
CREATE INDEX IF NOT EXISTS "credit_allocations_expires_at_idx" ON "credit_allocations"("expires_at");

CREATE INDEX IF NOT EXISTS "credit_transactions_workspace_id_created_at_idx" ON "credit_transactions"("workspace_id", "created_at");
CREATE INDEX IF NOT EXISTS "credit_transactions_allocation_id_idx" ON "credit_transactions"("allocation_id");

CREATE INDEX IF NOT EXISTS "scheduled_credit_holds_workspace_id_idx" ON "scheduled_credit_holds"("workspace_id");
CREATE INDEX IF NOT EXISTS "scheduled_credit_holds_expires_at_idx" ON "scheduled_credit_holds"("expires_at");

CREATE INDEX IF NOT EXISTS "usage_events_workspace_id_created_at_idx" ON "usage_events"("workspace_id", "created_at");
CREATE INDEX IF NOT EXISTS "usage_events_event_type_created_at_idx" ON "usage_events"("event_type", "created_at");

CREATE UNIQUE INDEX IF NOT EXISTS "plan_configurations_plan_name_key" ON "plan_configurations"("plan_name");

-- 4. Add Constraints (safely)
DO $$ BEGIN
    ALTER TABLE "workspace_credits" ADD CONSTRAINT "workspace_credits_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "credit_allocations" ADD CONSTRAINT "credit_allocations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_allocation_id_fkey" FOREIGN KEY ("allocation_id") REFERENCES "credit_allocations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "scheduled_credit_holds" ADD CONSTRAINT "scheduled_credit_holds_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
