-- ================================================================
-- MIGRATION - Sistema de Relatórios Agendados Avançado
-- ================================================================
-- Enhances existing report system with quotas, distribution, and cache

-- Extend ReportType enum with new values
ALTER TYPE "ReportType" ADD VALUE IF NOT EXISTS 'COMPLETO';
ALTER TYPE "ReportType" ADD VALUE IF NOT EXISTS 'NOVIDADES';

-- Add ExecutionStatus enum if not exists
DO $$ BEGIN
    CREATE TYPE "ExecutionStatus" AS ENUM (
        'AGENDADO',
        'EM_PROCESSAMENTO',
        'CONCLUIDO',
        'FALHOU',
        'CANCELADO'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add AudienceType enum for target audience
DO $$ BEGIN
    CREATE TYPE "AudienceType" AS ENUM (
        'CLIENTE',
        'DIRETORIA',
        'USO_INTERNO'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add OutputFormat enum for report formats
DO $$ BEGIN
    CREATE TYPE "OutputFormat" AS ENUM (
        'PDF',
        'DOCX'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Extend ReportSchedule table with new fields
ALTER TABLE "report_schedules"
ADD COLUMN IF NOT EXISTS "audience_type" "AudienceType" DEFAULT 'CLIENTE',
ADD COLUMN IF NOT EXISTS "output_formats" "OutputFormat"[] DEFAULT ARRAY['PDF']::"OutputFormat"[],
ADD COLUMN IF NOT EXISTS "processes_limit" INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS "process_ids" TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS "distribution_hash" INTEGER,
ADD COLUMN IF NOT EXISTS "execution_window_start" TIME DEFAULT '23:00:00',
ADD COLUMN IF NOT EXISTS "execution_window_end" TIME DEFAULT '04:00:00',
ADD COLUMN IF NOT EXISTS "monthly_quota_used" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "last_quota_reset" TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Extend ReportExecution table with new fields
ALTER TABLE "report_executions"
ADD COLUMN IF NOT EXISTS "audience_type" "AudienceType" DEFAULT 'CLIENTE',
ADD COLUMN IF NOT EXISTS "output_formats" "OutputFormat"[] DEFAULT ARRAY['PDF']::"OutputFormat"[],
ADD COLUMN IF NOT EXISTS "process_count" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "cache_key" TEXT,
ADD COLUMN IF NOT EXISTS "cache_hit" BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS "quota_consumed" INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS "scheduled_for" TIMESTAMP,
ADD COLUMN IF NOT EXISTS "file_urls" JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS "last_movement_timestamp" TIMESTAMP,
ADD COLUMN IF NOT EXISTS "delta_data_only" BOOLEAN DEFAULT FALSE;

-- Create WorkspaceQuotas table for plan limits
CREATE TABLE IF NOT EXISTS "workspace_quotas" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "workspace_id" TEXT NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "reports_monthly_limit" INTEGER NOT NULL DEFAULT 20,
    "report_processes_limit" INTEGER NOT NULL DEFAULT 100,
    "reports_used_this_month" INTEGER DEFAULT 0,
    "quota_reset_date" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "override_limits" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE("workspace_id")
);

-- Create ReportCache table for intelligent caching
CREATE TABLE IF NOT EXISTS "report_cache" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "cache_key" TEXT NOT NULL UNIQUE,
    "workspace_id" TEXT NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
    "report_type" "ReportType" NOT NULL,
    "process_ids" TEXT[] NOT NULL,
    "audience_type" "AudienceType" NOT NULL,
    "last_movement_timestamp" TIMESTAMP NOT NULL,
    "cached_data" JSONB NOT NULL,
    "file_urls" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP NOT NULL,

    INDEX("workspace_id"),
    INDEX("cache_key"),
    INDEX("expires_at"),
    INDEX("last_movement_timestamp")
);

-- Create ReportTemplates table for custom templates
CREATE TABLE IF NOT EXISTS "report_templates" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "workspace_id" TEXT NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "template_type" TEXT DEFAULT 'DEFAULT', -- 'DEFAULT', 'CUSTOM_HEADER_FOOTER', 'FULL_TEMPLATE'
    "header_content" TEXT,
    "footer_content" TEXT,
    "template_file_url" TEXT, -- For uploaded .docx templates
    "styles" JSONB DEFAULT '{}',
    "is_default" BOOLEAN DEFAULT FALSE,
    "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE("workspace_id", "name")
);

-- Insert default quota limits based on plans
INSERT INTO "workspace_quotas" ("workspace_id", "plan", "reports_monthly_limit", "report_processes_limit")
SELECT
    w."id",
    w."plan",
    CASE w."plan"
        WHEN 'FREE' THEN 5
        WHEN 'BASIC' THEN 20
        WHEN 'PRO' THEN 50
        WHEN 'ENTERPRISE' THEN 200
        ELSE 5
    END as reports_monthly_limit,
    CASE w."plan"
        WHEN 'FREE' THEN 50
        WHEN 'BASIC' THEN 100
        WHEN 'PRO' THEN 300
        WHEN 'ENTERPRISE' THEN 1000
        ELSE 50
    END as report_processes_limit
FROM "workspaces" w
WHERE NOT EXISTS (
    SELECT 1 FROM "workspace_quotas" wq WHERE wq."workspace_id" = w."id"
);

-- Create function to calculate distribution hash
CREATE OR REPLACE FUNCTION calculate_distribution_hash(workspace_id TEXT)
RETURNS INTEGER AS $$
BEGIN
    -- Hash workspace_id and return value between 0-300 (5-hour window in minutes)
    RETURN (hashtext(workspace_id) % 300)::INTEGER;
END;
$$ LANGUAGE plpgsql;

-- Update existing schedules with distribution hash
UPDATE "report_schedules"
SET "distribution_hash" = calculate_distribution_hash("workspaceId")
WHERE "distribution_hash" IS NULL;

-- Create function to reset monthly quotas
CREATE OR REPLACE FUNCTION reset_monthly_quotas()
RETURNS void AS $$
BEGIN
    UPDATE "workspace_quotas"
    SET
        "reports_used_this_month" = 0,
        "quota_reset_date" = CURRENT_TIMESTAMP,
        "updated_at" = CURRENT_TIMESTAMP
    WHERE "quota_reset_date" < DATE_TRUNC('month', CURRENT_TIMESTAMP);

    UPDATE "report_schedules"
    SET
        "monthly_quota_used" = 0,
        "last_quota_reset" = CURRENT_TIMESTAMP
    WHERE "last_quota_reset" < DATE_TRUNC('month', CURRENT_TIMESTAMP);
END;
$$ LANGUAGE plpgsql;

-- Create function to invalidate cache on process movement
CREATE OR REPLACE FUNCTION invalidate_report_cache_on_movement()
RETURNS TRIGGER AS $$
BEGIN
    -- Invalidate cache for reports that include this process
    DELETE FROM "report_cache"
    WHERE NEW."processId" = ANY("process_ids")
    AND "last_movement_timestamp" < NEW."date";

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for cache invalidation (assumes process_movements table exists)
DROP TRIGGER IF EXISTS "invalidate_cache_on_movement" ON "process_movements";
CREATE TRIGGER "invalidate_cache_on_movement"
    AFTER INSERT ON "process_movements"
    FOR EACH ROW
    EXECUTE FUNCTION invalidate_report_cache_on_movement();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "idx_report_schedules_next_run" ON "report_schedules"("nextRun", "enabled");
CREATE INDEX IF NOT EXISTS "idx_report_schedules_workspace_type" ON "report_schedules"("workspaceId", "type");
CREATE INDEX IF NOT EXISTS "idx_report_executions_scheduled_for" ON "report_executions"("scheduled_for", "status");
CREATE INDEX IF NOT EXISTS "idx_report_executions_workspace_status" ON "report_executions"("workspaceId", "status", "startedAt");

-- Create cleanup function for old cache and executions
CREATE OR REPLACE FUNCTION cleanup_old_reports()
RETURNS void AS $$
BEGIN
    -- Delete expired cache entries
    DELETE FROM "report_cache" WHERE "expires_at" < CURRENT_TIMESTAMP;

    -- Delete old executions (keep last 3 months)
    DELETE FROM "report_executions"
    WHERE "startedAt" < CURRENT_TIMESTAMP - INTERVAL '3 months';

    -- Log cleanup
    INSERT INTO "global_logs" ("workspaceId", "level", "message", "metadata")
    VALUES (
        NULL,
        'INFO',
        'Report cleanup executed',
        jsonb_build_object(
            'type', 'report_cleanup',
            'timestamp', CURRENT_TIMESTAMP
        )
    );
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO PUBLIC;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO PUBLIC;