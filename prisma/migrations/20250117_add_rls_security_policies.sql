-- ================================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES FOR JUSTOAI
-- ================================================================
-- This migration adds RLS policies to tables that are exposed
-- to PostgREST and currently lack proper access controls.
--
-- Tables to protect:
-- 1. system_syncs - Data sync configurations
-- 2. system_sync_logs - Sync operation logs
-- 3. imported_data_items - Imported data from external systems
-- 4. system_mapping_templates - Data mapping configurations
-- 5. system_imports - System import configurations
--
-- Important: These policies ensure that users can only access
-- data within their own workspace.
-- ================================================================

-- ================================================================
-- 1. ENABLE RLS ON system_syncs
-- ================================================================
ALTER TABLE public.system_syncs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view syncs in their workspace
CREATE POLICY "Users can view syncs in their workspace"
ON public.system_syncs
FOR SELECT
USING (
  "workspaceId" IN (
    SELECT DISTINCT uw."workspaceId"
    FROM public.user_workspaces uw
    WHERE uw."userId" = auth.uid()::text
    AND uw.status = 'ACTIVE'
  )
);

-- Policy: Only workspace admins can create syncs
CREATE POLICY "Workspace admins can create syncs"
ON public.system_syncs
FOR INSERT
WITH CHECK (
  "workspaceId" IN (
    SELECT DISTINCT uw."workspaceId"
    FROM public.user_workspaces uw
    WHERE uw."userId" = auth.uid()::text
    AND uw.status = 'ACTIVE'
    AND uw.role IN ('OWNER', 'ADMIN')
  )
);

-- Policy: Only workspace admins can update syncs
CREATE POLICY "Workspace admins can update syncs"
ON public.system_syncs
FOR UPDATE
USING (
  "workspaceId" IN (
    SELECT DISTINCT uw."workspaceId"
    FROM public.user_workspaces uw
    WHERE uw."userId" = auth.uid()::text
    AND uw.status = 'ACTIVE'
    AND uw.role IN ('OWNER', 'ADMIN')
  )
);

-- Policy: Only workspace owners can delete syncs
CREATE POLICY "Workspace owners can delete syncs"
ON public.system_syncs
FOR DELETE
USING (
  "workspaceId" IN (
    SELECT DISTINCT uw."workspaceId"
    FROM public.user_workspaces uw
    WHERE uw."userId" = auth.uid()::text
    AND uw.status = 'ACTIVE'
    AND uw.role = 'OWNER'
  )
);

-- ================================================================
-- 2. ENABLE RLS ON system_sync_logs
-- ================================================================
ALTER TABLE public.system_sync_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view sync logs for syncs in their workspace
CREATE POLICY "Users can view sync logs in their workspace"
ON public.system_sync_logs
FOR SELECT
USING (
  "systemSyncId" IN (
    SELECT id FROM public.system_syncs
    WHERE "workspaceId" IN (
      SELECT DISTINCT uw."workspaceId"
      FROM public.user_workspaces uw
      WHERE uw."userId" = auth.uid()::text
      AND uw.status = 'ACTIVE'
    )
  )
);

-- ================================================================
-- 3. ENABLE RLS ON imported_data_items
-- ================================================================
ALTER TABLE public.imported_data_items ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view imported data items from imports in their workspace
CREATE POLICY "Users can view imported items in their workspace"
ON public.imported_data_items
FOR SELECT
USING (
  "systemImportId" IN (
    SELECT id FROM public.system_imports
    WHERE "workspaceId" IN (
      SELECT DISTINCT uw."workspaceId"
      FROM public.user_workspaces uw
      WHERE uw."userId" = auth.uid()::text
      AND uw.status = 'ACTIVE'
    )
  )
);

-- ================================================================
-- 4. ENABLE RLS ON system_mapping_templates
-- ================================================================
ALTER TABLE public.system_mapping_templates ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view mapping templates for their workspace
CREATE POLICY "Users can view mapping templates in their workspace"
ON public.system_mapping_templates
FOR SELECT
USING (
  "workspaceId" IN (
    SELECT DISTINCT uw."workspaceId"
    FROM public.user_workspaces uw
    WHERE uw."userId" = auth.uid()::text
    AND uw.status = 'ACTIVE'
  )
);

-- Policy: Workspace admins can create mapping templates
CREATE POLICY "Workspace admins can create mapping templates"
ON public.system_mapping_templates
FOR INSERT
WITH CHECK (
  "workspaceId" IN (
    SELECT DISTINCT uw."workspaceId"
    FROM public.user_workspaces uw
    WHERE uw."userId" = auth.uid()::text
    AND uw.status = 'ACTIVE'
    AND uw.role IN ('OWNER', 'ADMIN')
  )
);

-- Policy: Workspace admins can update mapping templates
CREATE POLICY "Workspace admins can update mapping templates"
ON public.system_mapping_templates
FOR UPDATE
USING (
  "workspaceId" IN (
    SELECT DISTINCT uw."workspaceId"
    FROM public.user_workspaces uw
    WHERE uw."userId" = auth.uid()::text
    AND uw.status = 'ACTIVE'
    AND uw.role IN ('OWNER', 'ADMIN')
  )
);

-- ================================================================
-- 5. ENABLE RLS ON system_imports
-- ================================================================
ALTER TABLE public.system_imports ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view imports in their workspace
CREATE POLICY "Users can view imports in their workspace"
ON public.system_imports
FOR SELECT
USING (
  "workspaceId" IN (
    SELECT DISTINCT uw."workspaceId"
    FROM public.user_workspaces uw
    WHERE uw."userId" = auth.uid()::text
    AND uw.status = 'ACTIVE'
  )
);

-- Policy: Workspace admins can create imports
CREATE POLICY "Workspace admins can create imports"
ON public.system_imports
FOR INSERT
WITH CHECK (
  "workspaceId" IN (
    SELECT DISTINCT uw."workspaceId"
    FROM public.user_workspaces uw
    WHERE uw."userId" = auth.uid()::text
    AND uw.status = 'ACTIVE'
    AND uw.role IN ('OWNER', 'ADMIN')
  )
);

-- Policy: Workspace admins can update imports
CREATE POLICY "Workspace admins can update imports"
ON public.system_imports
FOR UPDATE
USING (
  "workspaceId" IN (
    SELECT DISTINCT uw."workspaceId"
    FROM public.user_workspaces uw
    WHERE uw."userId" = auth.uid()::text
    AND uw.status = 'ACTIVE'
    AND uw.role IN ('OWNER', 'ADMIN')
  )
);

-- ================================================================
-- FINAL VERIFICATION
-- ================================================================
-- These queries can be used to verify RLS is enabled:
--
-- SELECT table_name, rowsecurity
-- FROM information_schema.tables
-- WHERE table_schema = 'public'
-- AND table_name IN (
--   'system_syncs',
--   'system_sync_logs',
--   'imported_data_items',
--   'system_mapping_templates',
--   'system_imports'
-- );
--
-- Output should show rowsecurity = true for all tables
