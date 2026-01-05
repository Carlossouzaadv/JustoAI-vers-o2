-- ============================================================
-- SUPABASE SUGGESTIONS FIX (INFO level)
-- Execute este script no Supabase SQL Editor
-- Data: 05/01/2026
-- ============================================================

-- Adiciona políticas explícitas "service_role_only" para tabelas
-- que já têm RLS habilitado mas nenhuma policy (default deny).
-- Isso silencia os avisos "RLS Enabled No Policy".

CREATE POLICY "service_role_only" ON public.ai_cache
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_only" ON public.analysis_cache
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_only" ON public.analysis_jobs
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_only" ON public.case_analysis_versions
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_only" ON public.case_documents
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_only" ON public.case_events
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_only" ON public.global_logs
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_only" ON public.judit_telemetry
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_only" ON public.plan_configurations
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_only" ON public.process_alerts
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_only" ON public.process_batch_uploads
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_only" ON public.process_movements
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_only" ON public.process_movements_tracking
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_only" ON public.process_sync_logs
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_only" ON public.report_cache
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_only" ON public.report_customizations
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_only" ON public.report_templates
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_only" ON public.scheduled_credit_holds
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_only" ON public.upload_batch
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_only" ON public.upload_batch_events
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_only" ON public.upload_batch_row
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_only" ON public.workspace_quota_policy
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_only" ON public.workspace_quotas
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_only" ON public.workspace_usage_daily
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- VERIFICAÇÃO
-- ============================================================
-- SELECT schemaname, tablename 
-- FROM pg_tables 
-- WHERE schemaname = 'public' 
-- AND rowsecurity = true
-- AND NOT EXISTS (
--    SELECT 1 FROM pg_policies 
--    WHERE schemaname = 'public' AND tablename = pg_tables.tablename
-- );
