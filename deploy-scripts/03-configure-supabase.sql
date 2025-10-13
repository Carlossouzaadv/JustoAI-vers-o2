-- ====================================================================
-- SUPABASE PRODUCTION CONFIGURATION
-- ====================================================================
-- Este script configura Row Level Security (RLS) policies e outras
-- configurações de segurança do Supabase para produção
--
-- Execute via Supabase SQL Editor ou via CLI:
-- supabase db push --db-url "postgresql://..."
-- ====================================================================

-- ====================================================================
-- 1. ENABLE ROW LEVEL SECURITY (RLS) ON ALL TABLES
-- ====================================================================

-- Core tables
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_analysis_versions ENABLE ROW LEVEL SECURITY;

-- Process monitoring
ALTER TABLE monitored_processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_batch_uploads ENABLE ROW LEVEL SECURITY;

-- JUDIT Integration (only judit_telemetry exists, others not created yet)
ALTER TABLE judit_telemetry ENABLE ROW LEVEL SECURITY;

-- Reports
ALTER TABLE report_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_customizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;

-- Credits system
ALTER TABLE workspace_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;

-- Upload system
ALTER TABLE upload_batch ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_batch_row ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_batch_events ENABLE ROW LEVEL SECURITY;

-- Other
ALTER TABLE ai_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_quotas ENABLE ROW LEVEL SECURITY;

-- Additional tables from migrations
ALTER TABLE analysis_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_movements_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_credit_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_usage_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_quota_policy ENABLE ROW LEVEL SECURITY;

-- ====================================================================
-- 2. CREATE RLS POLICIES - WORKSPACES
-- ====================================================================

-- Users can read workspaces they belong to
CREATE POLICY "Users can read their workspaces" ON workspaces
FOR SELECT
USING (
  id IN (
    SELECT "workspaceId" FROM user_workspaces
    WHERE "userId" = auth.uid()::text AND status = 'ACTIVE'
  )
);

-- Workspace owners can update their workspace
CREATE POLICY "Owners can update workspace" ON workspaces
FOR UPDATE
USING (
  id IN (
    SELECT "workspaceId" FROM user_workspaces
    WHERE "userId" = auth.uid()::text AND role = 'OWNER' AND status = 'ACTIVE'
  )
);

-- ====================================================================
-- 3. CREATE RLS POLICIES - USERS
-- ====================================================================

-- Users can read their own data
CREATE POLICY "Users can read own data" ON users
FOR SELECT
USING ("supabaseId" = auth.uid()::text);

-- Users can update their own data
CREATE POLICY "Users can update own data" ON users
FOR UPDATE
USING ("supabaseId" = auth.uid()::text);

-- ====================================================================
-- 4. CREATE RLS POLICIES - USER_WORKSPACES
-- ====================================================================

-- Users can read their workspace memberships
CREATE POLICY "Users can read own workspace memberships" ON user_workspaces
FOR SELECT
USING ("userId" = auth.uid()::text);

-- ====================================================================
-- 5. CREATE RLS POLICIES - CLIENTS
-- ====================================================================

-- Users can read clients in their workspaces
CREATE POLICY "Users can read workspace clients" ON clients
FOR SELECT
USING (
  "workspaceId" IN (
    SELECT "workspaceId" FROM user_workspaces
    WHERE "userId" = auth.uid()::text AND status = 'ACTIVE'
  )
);

-- Users can create clients in their workspaces
CREATE POLICY "Users can create workspace clients" ON clients
FOR INSERT
WITH CHECK (
  "workspaceId" IN (
    SELECT "workspaceId" FROM user_workspaces
    WHERE "userId" = auth.uid()::text
      AND status = 'ACTIVE'
      AND role IN ('OWNER', 'ADMIN', 'MEMBER')
  )
);

-- Users can update clients in their workspaces
CREATE POLICY "Users can update workspace clients" ON clients
FOR UPDATE
USING (
  "workspaceId" IN (
    SELECT "workspaceId" FROM user_workspaces
    WHERE "userId" = auth.uid()::text
      AND status = 'ACTIVE'
      AND role IN ('OWNER', 'ADMIN', 'MEMBER')
  )
);

-- Users can delete clients in their workspaces (OWNER/ADMIN only)
CREATE POLICY "Admins can delete workspace clients" ON clients
FOR DELETE
USING (
  "workspaceId" IN (
    SELECT "workspaceId" FROM user_workspaces
    WHERE "userId" = auth.uid()::text
      AND status = 'ACTIVE'
      AND role IN ('OWNER', 'ADMIN')
  )
);

-- ====================================================================
-- 6. CREATE RLS POLICIES - CASES
-- ====================================================================

-- Users can read cases in their workspaces
CREATE POLICY "Users can read workspace cases" ON cases
FOR SELECT
USING (
  "workspaceId" IN (
    SELECT "workspaceId" FROM user_workspaces
    WHERE "userId" = auth.uid()::text AND status = 'ACTIVE'
  )
);

-- Users can create cases in their workspaces
CREATE POLICY "Users can create workspace cases" ON cases
FOR INSERT
WITH CHECK (
  "workspaceId" IN (
    SELECT "workspaceId" FROM user_workspaces
    WHERE "userId" = auth.uid()::text
      AND status = 'ACTIVE'
      AND role IN ('OWNER', 'ADMIN', 'MEMBER')
  )
);

-- Users can update cases in their workspaces
CREATE POLICY "Users can update workspace cases" ON cases
FOR UPDATE
USING (
  "workspaceId" IN (
    SELECT "workspaceId" FROM user_workspaces
    WHERE "userId" = auth.uid()::text
      AND status = 'ACTIVE'
      AND role IN ('OWNER', 'ADMIN', 'MEMBER')
  )
);

-- ====================================================================
-- 7. CREATE RLS POLICIES - MONITORED PROCESSES
-- ====================================================================

-- Users can read monitored processes in their workspaces
CREATE POLICY "Users can read workspace monitored processes" ON monitored_processes
FOR SELECT
USING (
  "workspaceId" IN (
    SELECT "workspaceId" FROM user_workspaces
    WHERE "userId" = auth.uid()::text AND status = 'ACTIVE'
  )
);

-- Users can create monitored processes in their workspaces
CREATE POLICY "Users can create workspace monitored processes" ON monitored_processes
FOR INSERT
WITH CHECK (
  "workspaceId" IN (
    SELECT "workspaceId" FROM user_workspaces
    WHERE "userId" = auth.uid()::text
      AND status = 'ACTIVE'
      AND role IN ('OWNER', 'ADMIN', 'MEMBER')
  )
);

-- Users can update monitored processes in their workspaces
CREATE POLICY "Users can update workspace monitored processes" ON monitored_processes
FOR UPDATE
USING (
  "workspaceId" IN (
    SELECT "workspaceId" FROM user_workspaces
    WHERE "userId" = auth.uid()::text
      AND status = 'ACTIVE'
      AND role IN ('OWNER', 'ADMIN', 'MEMBER')
  )
);

-- ====================================================================
-- 8. CREATE RLS POLICIES - CREDITS
-- ====================================================================

-- Users can read credits for their workspaces
CREATE POLICY "Users can read workspace credits" ON workspace_credits
FOR SELECT
USING (
  workspace_id IN (
    SELECT "workspaceId" FROM user_workspaces
    WHERE "userId" = auth.uid()::text AND status = 'ACTIVE'
  )
);

-- Similar policies for credit_allocations, credit_transactions, usage_events
CREATE POLICY "Users can read workspace credit allocations" ON credit_allocations
FOR SELECT
USING (
  workspace_id IN (
    SELECT "workspaceId" FROM user_workspaces
    WHERE "userId" = auth.uid()::text AND status = 'ACTIVE'
  )
);

CREATE POLICY "Users can read workspace credit transactions" ON credit_transactions
FOR SELECT
USING (
  workspace_id IN (
    SELECT "workspaceId" FROM user_workspaces
    WHERE "userId" = auth.uid()::text AND status = 'ACTIVE'
  )
);

CREATE POLICY "Users can read workspace usage events" ON usage_events
FOR SELECT
USING (
  workspace_id IN (
    SELECT "workspaceId" FROM user_workspaces
    WHERE "userId" = auth.uid()::text AND status = 'ACTIVE'
  )
);

-- ====================================================================
-- 9. CREATE RLS POLICIES - REPORTS
-- ====================================================================

-- Users can read report schedules in their workspaces
CREATE POLICY "Users can read workspace report schedules" ON report_schedules
FOR SELECT
USING (
  "workspaceId" IN (
    SELECT "workspaceId" FROM user_workspaces
    WHERE "userId" = auth.uid()::text AND status = 'ACTIVE'
  )
);

-- Users can create report schedules
CREATE POLICY "Users can create workspace report schedules" ON report_schedules
FOR INSERT
WITH CHECK (
  "workspaceId" IN (
    SELECT "workspaceId" FROM user_workspaces
    WHERE "userId" = auth.uid()::text
      AND status = 'ACTIVE'
      AND role IN ('OWNER', 'ADMIN', 'MEMBER')
  )
);

-- Similar for report_executions
CREATE POLICY "Users can read workspace report executions" ON report_executions
FOR SELECT
USING (
  "workspaceId" IN (
    SELECT "workspaceId" FROM user_workspaces
    WHERE "userId" = auth.uid()::text AND status = 'ACTIVE'
  )
);

-- ====================================================================
-- 10. CREATE INDEXES FOR PERFORMANCE
-- ====================================================================

-- User workspace lookups (most common query)
CREATE INDEX IF NOT EXISTS idx_user_workspaces_user_id_status
ON user_workspaces("userId", status)
WHERE status = 'ACTIVE';

-- Workspace ID filters (Prisma tables use camelCase)
CREATE INDEX IF NOT EXISTS idx_clients_workspace_id ON clients("workspaceId");
CREATE INDEX IF NOT EXISTS idx_cases_workspace_id ON cases("workspaceId");
CREATE INDEX IF NOT EXISTS idx_monitored_processes_workspace_id ON monitored_processes("workspaceId");
CREATE INDEX IF NOT EXISTS idx_report_schedules_workspace_id ON report_schedules("workspaceId");

-- Auth lookups
CREATE INDEX IF NOT EXISTS idx_users_supabase_id ON users("supabaseId");

-- JUDIT tracking (removed indexes for tables that don't exist yet)

-- Cost tracking queries (removed - table doesn't exist yet)

-- Process monitoring (Prisma tables use camelCase)
CREATE INDEX IF NOT EXISTS idx_process_movements_monitored_process ON process_movements("monitoredProcessId", date DESC);
CREATE INDEX IF NOT EXISTS idx_process_alerts_monitored_process_read ON process_alerts("monitoredProcessId", read);

-- ====================================================================
-- 11. CREATE FUNCTIONS FOR COMMON OPERATIONS
-- ====================================================================

-- Function to check if user has access to workspace
CREATE OR REPLACE FUNCTION has_workspace_access(
  user_uuid UUID,
  workspace_uuid TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_workspaces
    WHERE "userId" = user_uuid::text
      AND "workspaceId" = workspace_uuid
      AND status = 'ACTIVE'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user role in workspace
CREATE OR REPLACE FUNCTION get_user_workspace_role(
  user_uuid UUID,
  workspace_uuid TEXT
) RETURNS TEXT AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM user_workspaces
  WHERE "userId" = user_uuid::text
    AND "workspaceId" = workspace_uuid
    AND status = 'ACTIVE';

  RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================================================================
-- 12. GRANT PERMISSIONS
-- ====================================================================

-- Grant service role full access (for backend operations)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Grant authenticated users access according to RLS policies
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ====================================================================
-- VALIDATION QUERIES
-- ====================================================================
-- Run these to verify RLS is enabled:
--
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public' AND rowsecurity = false;
--
-- If any tables show up, RLS is not enabled for them
-- ====================================================================
