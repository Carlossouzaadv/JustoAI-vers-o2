-- ================================================================
-- MIGRATION - Sistema de Relatórios Agendados Avançado (FINAL - CORRECT ENUM)
-- ================================================================

-- Extend report_schedules table with new fields
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'report_schedules' AND column_name = 'audienceType') THEN
        ALTER TABLE "report_schedules" ADD COLUMN "audienceType" "AudienceType" DEFAULT 'CLIENTE';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'report_schedules' AND column_name = 'outputFormats') THEN
        ALTER TABLE "report_schedules" ADD COLUMN "outputFormats" "OutputFormat"[] DEFAULT ARRAY['PDF']::"OutputFormat"[];
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'report_schedules' AND column_name = 'processesLimit') THEN
        ALTER TABLE "report_schedules" ADD COLUMN "processesLimit" INTEGER DEFAULT 100;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'report_schedules' AND column_name = 'processIds') THEN
        ALTER TABLE "report_schedules" ADD COLUMN "processIds" TEXT[] DEFAULT '{}';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'report_schedules' AND column_name = 'distributionHash') THEN
        ALTER TABLE "report_schedules" ADD COLUMN "distributionHash" INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'report_schedules' AND column_name = 'executionWindowStart') THEN
        ALTER TABLE "report_schedules" ADD COLUMN "executionWindowStart" TEXT DEFAULT '23:00';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'report_schedules' AND column_name = 'executionWindowEnd') THEN
        ALTER TABLE "report_schedules" ADD COLUMN "executionWindowEnd" TEXT DEFAULT '04:00';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'report_schedules' AND column_name = 'monthlyQuotaUsed') THEN
        ALTER TABLE "report_schedules" ADD COLUMN "monthlyQuotaUsed" INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'report_schedules' AND column_name = 'lastQuotaReset') THEN
        ALTER TABLE "report_schedules" ADD COLUMN "lastQuotaReset" TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- Extend report_executions table with new fields
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'report_executions' AND column_name = 'audienceType') THEN
        ALTER TABLE "report_executions" ADD COLUMN "audienceType" "AudienceType" DEFAULT 'CLIENTE';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'report_executions' AND column_name = 'outputFormats') THEN
        ALTER TABLE "report_executions" ADD COLUMN "outputFormats" "OutputFormat"[] DEFAULT ARRAY['PDF']::"OutputFormat"[];
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'report_executions' AND column_name = 'processCount') THEN
        ALTER TABLE "report_executions" ADD COLUMN "processCount" INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'report_executions' AND column_name = 'cacheKey') THEN
        ALTER TABLE "report_executions" ADD COLUMN "cacheKey" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'report_executions' AND column_name = 'cacheHit') THEN
        ALTER TABLE "report_executions" ADD COLUMN "cacheHit" BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'report_executions' AND column_name = 'quotaConsumed') THEN
        ALTER TABLE "report_executions" ADD COLUMN "quotaConsumed" INTEGER DEFAULT 1;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'report_executions' AND column_name = 'scheduledFor') THEN
        ALTER TABLE "report_executions" ADD COLUMN "scheduledFor" TIMESTAMP;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'report_executions' AND column_name = 'fileUrls') THEN
        ALTER TABLE "report_executions" ADD COLUMN "fileUrls" JSONB DEFAULT '{}';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'report_executions' AND column_name = 'lastMovementTimestamp') THEN
        ALTER TABLE "report_executions" ADD COLUMN "lastMovementTimestamp" TIMESTAMP;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'report_executions' AND column_name = 'deltaDataOnly') THEN
        ALTER TABLE "report_executions" ADD COLUMN "deltaDataOnly" BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Create WorkspaceQuotas table
CREATE TABLE IF NOT EXISTS "workspace_quotas" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "workspaceId" TEXT NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "reportsMonthlyLimit" INTEGER NOT NULL DEFAULT 20,
    "reportProcessesLimit" INTEGER NOT NULL DEFAULT 100,
    "reportsUsedThisMonth" INTEGER DEFAULT 0,
    "quotaResetDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "overrideLimits" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE("workspaceId")
);

-- Create ReportCache table
CREATE TABLE IF NOT EXISTS "report_cache" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "cacheKey" TEXT NOT NULL UNIQUE,
    "workspaceId" TEXT NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
    "reportType" "ReportType" NOT NULL,
    "processIds" TEXT[] NOT NULL,
    "audienceType" "AudienceType" NOT NULL,
    "lastMovementTimestamp" TIMESTAMP NOT NULL,
    "cachedData" JSONB NOT NULL,
    "fileUrls" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_report_cache_workspace ON "report_cache"("workspaceId");
CREATE INDEX IF NOT EXISTS idx_report_cache_key ON "report_cache"("cacheKey");
CREATE INDEX IF NOT EXISTS idx_report_cache_expires ON "report_cache"("expiresAt");
CREATE INDEX IF NOT EXISTS idx_report_cache_last_movement ON "report_cache"("lastMovementTimestamp");

-- Create ReportTemplates table
CREATE TABLE IF NOT EXISTS "report_templates" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "workspaceId" TEXT NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "templateType" TEXT DEFAULT 'DEFAULT',
    "headerContent" TEXT,
    "footerContent" TEXT,
    "templateFileUrl" TEXT,
    "styles" JSONB DEFAULT '{}',
    "isDefault" BOOLEAN DEFAULT FALSE,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE("workspaceId", "name")
);

-- Insert default quota limits (CORRIGIDO - USA ENUM CORRETO)
INSERT INTO "workspace_quotas" ("workspaceId", "plan", "reportsMonthlyLimit", "reportProcessesLimit")
SELECT
    w."id",
    w."plan",
    CASE
        WHEN w."plan"::text IN ('FREE') THEN 5
        WHEN w."plan"::text IN ('STARTER', 'BASIC') THEN 20
        WHEN w."plan"::text IN ('PROFESSIONAL', 'PRO') THEN 50
        WHEN w."plan"::text IN ('ENTERPRISE') THEN 200
        ELSE 5
    END as reports_monthly_limit,
    CASE
        WHEN w."plan"::text IN ('FREE') THEN 50
        WHEN w."plan"::text IN ('STARTER', 'BASIC') THEN 100
        WHEN w."plan"::text IN ('PROFESSIONAL', 'PRO') THEN 300
        WHEN w."plan"::text IN ('ENTERPRISE') THEN 1000
        ELSE 50
    END as report_processes_limit
FROM "workspaces" w
WHERE NOT EXISTS (
    SELECT 1 FROM "workspace_quotas" wq WHERE wq."workspaceId" = w."id"
)
ON CONFLICT ("workspaceId") DO NOTHING;

-- Create function to calculate distribution hash
CREATE OR REPLACE FUNCTION calculate_distribution_hash(workspace_id TEXT)
RETURNS INTEGER AS $$
BEGIN
    RETURN (hashtext(workspace_id) % 300)::INTEGER;
END;
$$ LANGUAGE plpgsql;

-- Update existing schedules with distribution hash
UPDATE "report_schedules"
SET "distributionHash" = calculate_distribution_hash("workspaceId")
WHERE "distributionHash" IS NULL;

-- Create function to reset monthly quotas
CREATE OR REPLACE FUNCTION reset_monthly_quotas()
RETURNS void AS $$
BEGIN
    UPDATE "workspace_quotas"
    SET
        "reportsUsedThisMonth" = 0,
        "quotaResetDate" = CURRENT_TIMESTAMP,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "quotaResetDate" < DATE_TRUNC('month', CURRENT_TIMESTAMP);

    UPDATE "report_schedules"
    SET
        "monthlyQuotaUsed" = 0,
        "lastQuotaReset" = CURRENT_TIMESTAMP
    WHERE "lastQuotaReset" < DATE_TRUNC('month', CURRENT_TIMESTAMP);
END;
$$ LANGUAGE plpgsql;

-- Create function to invalidate cache on process movement
CREATE OR REPLACE FUNCTION invalidate_report_cache_on_movement()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM "report_cache"
    WHERE NEW."monitoredProcessId" = ANY("processIds")
    AND "lastMovementTimestamp" < NEW."date";

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for cache invalidation
DROP TRIGGER IF EXISTS "invalidate_cache_on_movement" ON "process_movements";
CREATE TRIGGER "invalidate_cache_on_movement"
    AFTER INSERT ON "process_movements"
    FOR EACH ROW
    EXECUTE FUNCTION invalidate_report_cache_on_movement();

-- Create cleanup function
CREATE OR REPLACE FUNCTION cleanup_old_reports()
RETURNS void AS $$
BEGIN
    DELETE FROM "report_cache" WHERE "expiresAt" < CURRENT_TIMESTAMP;
    DELETE FROM "report_executions" WHERE "startedAt" < CURRENT_TIMESTAMP - INTERVAL '3 months';
END;
$$ LANGUAGE plpgsql;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_report_schedules_next_run
    ON "report_schedules"("nextRun", "enabled");

CREATE INDEX IF NOT EXISTS idx_report_schedules_workspace_type
    ON "report_schedules"("workspaceId", "type");

CREATE INDEX IF NOT EXISTS idx_report_executions_scheduled_for
    ON "report_executions"("scheduledFor", "status");
