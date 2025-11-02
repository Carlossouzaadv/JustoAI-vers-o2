-- ================================================================
-- WEBHOOK AND JOB MONITORING - Migration for observability
-- ================================================================

-- Enum: WebhookDeliveryStatus
CREATE TYPE public."WebhookDeliveryStatus" AS ENUM (
  'PENDING',      -- Waiting to be delivered
  'PROCESSING',   -- Currently being delivered
  'SUCCESS',      -- Successfully delivered
  'FAILED',       -- Delivery failed (not retrying)
  'RETRYING',     -- Failed but will retry
  'SKIPPED'       -- Skipped (e.g., duplicate)
);

-- Enum: JobExecutionStatus
CREATE TYPE public."JobExecutionStatus" AS ENUM (
  'PENDING',      -- Waiting to start
  'RUNNING',      -- Currently executing
  'SUCCESS',      -- Completed successfully
  'FAILED',       -- Execution failed
  'RETRYING',     -- Failed but will retry
  'CANCELLED',    -- Cancelled by user
  'TIMEOUT'       -- Timed out
);

-- Enum: HealthStatus
CREATE TYPE public."HealthStatus" AS ENUM (
  'HEALTHY',      -- Component working normally
  'DEGRADED',     -- Component working but with issues
  'UNHEALTHY',    -- Component not working
  'UNKNOWN'       -- Status unknown
);

-- ================================================================
-- WebhookDelivery Table
-- ================================================================

CREATE TABLE IF NOT EXISTS public."webhook_deliveries" (
  id                      VARCHAR(255) PRIMARY KEY,
  "workspaceId"           VARCHAR(255) NOT NULL,
  "webhookType"           VARCHAR(255) NOT NULL,  -- 'judit.tracking', 'judit.callback', etc
  "eventType"             VARCHAR(255) NOT NULL,  -- 'movement', 'attachment', 'status_change'
  "processNumber"         VARCHAR(255) NOT NULL,
  payload                 JSONB NOT NULL,         -- Full webhook payload
  status                  "WebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "statusCode"            INTEGER,                -- HTTP status code from delivery
  error                   TEXT,                   -- Error message if failed
  "retryCount"            INTEGER NOT NULL DEFAULT 0,
  "maxRetries"            INTEGER NOT NULL DEFAULT 5,
  "nextRetryAt"           TIMESTAMP WITH TIME ZONE,  -- When to retry next
  "lastAttemptAt"         TIMESTAMP WITH TIME ZONE,  -- Last delivery attempt
  "deliveredAt"           TIMESTAMP WITH TIME ZONE,  -- Successful delivery time
  signature               TEXT,                   -- HMAC signature for security
  "createdAt"             TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_webhook_deliveries_workspace
    FOREIGN KEY ("workspaceId")
    REFERENCES public.workspaces(id) ON DELETE CASCADE
);

CREATE INDEX idx_webhook_deliveries_workspace ON public."webhook_deliveries"("workspaceId");
CREATE INDEX idx_webhook_deliveries_status ON public."webhook_deliveries"(status);
CREATE INDEX idx_webhook_deliveries_nextRetryAt ON public."webhook_deliveries"("nextRetryAt");
CREATE INDEX idx_webhook_deliveries_processNumber ON public."webhook_deliveries"("processNumber");

-- ================================================================
-- JobExecution Table
-- ================================================================

CREATE TABLE IF NOT EXISTS public."job_executions" (
  id                      VARCHAR(255) PRIMARY KEY,
  "workspaceId"           VARCHAR(255) NOT NULL,
  "jobType"               VARCHAR(255) NOT NULL,  -- 'report_scheduler', 'judit_check', etc
  "jobId"                 VARCHAR(255) NOT NULL,  -- Link to specific job
  status                  "JobExecutionStatus" NOT NULL DEFAULT 'PENDING',
  "startedAt"             TIMESTAMP WITH TIME ZONE,
  "completedAt"           TIMESTAMP WITH TIME ZONE,
  duration                INTEGER,                -- milliseconds
  input                   JSONB,                  -- Job input parameters
  output                  JSONB,                  -- Job result/output
  error                   TEXT,                   -- Error message if failed
  "errorStack"            TEXT,                   -- Full error stack trace
  "retryCount"            INTEGER NOT NULL DEFAULT 0,
  "maxRetries"            INTEGER NOT NULL DEFAULT 3,
  "nextRetryAt"           TIMESTAMP WITH TIME ZONE,
  tags                    TEXT[] DEFAULT ARRAY[]::TEXT[],  -- for filtering/searching
  metrics                 JSONB,                  -- performance metrics
  "createdAt"             TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_job_executions_workspace
    FOREIGN KEY ("workspaceId")
    REFERENCES public.workspaces(id) ON DELETE CASCADE
);

CREATE INDEX idx_job_executions_workspace ON public."job_executions"("workspaceId");
CREATE INDEX idx_job_executions_jobType ON public."job_executions"("jobType");
CREATE INDEX idx_job_executions_status ON public."job_executions"(status);
CREATE INDEX idx_job_executions_startedAt ON public."job_executions"("startedAt");

-- ================================================================
-- SystemHealthMetric Table
-- ================================================================

CREATE TABLE IF NOT EXISTS public."system_health_metrics" (
  id                      VARCHAR(255) PRIMARY KEY,
  "timestamp"             TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  component               VARCHAR(255) NOT NULL,  -- 'database', 'supabase', 'resend', etc
  status                  "HealthStatus" NOT NULL DEFAULT 'UNKNOWN',
  "responseTimeMs"        INTEGER,
  "errorCount"            INTEGER NOT NULL DEFAULT 0,
  "lastError"             TEXT,
  metadata                JSONB,                  -- component-specific data
  "createdAt"             TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_system_health_metrics_component ON public."system_health_metrics"(component);
CREATE INDEX idx_system_health_metrics_timestamp ON public."system_health_metrics"("timestamp");

-- ================================================================
-- Update timestamp on changes (trigger)
-- ================================================================

CREATE OR REPLACE FUNCTION public.update_webhook_deliveries_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER webhook_deliveries_updated
  BEFORE UPDATE ON public."webhook_deliveries"
  FOR EACH ROW
  EXECUTE FUNCTION public.update_webhook_deliveries_timestamp();

CREATE OR REPLACE FUNCTION public.update_job_executions_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER job_executions_updated
  BEFORE UPDATE ON public."job_executions"
  FOR EACH ROW
  EXECUTE FUNCTION public.update_job_executions_timestamp();
