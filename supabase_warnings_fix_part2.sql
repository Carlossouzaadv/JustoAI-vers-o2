-- ============================================================
-- SUPABASE WARNINGS FIX - Comandos Finais
-- Execute este script no Supabase SQL Editor
-- ============================================================

ALTER FUNCTION public.calculate_distribution_hash(workspace_id text) SET search_path = public;
ALTER FUNCTION public.cleanup_expired_allocations() SET search_path = public;
ALTER FUNCTION public.cleanup_expired_analysis_cache() SET search_path = public;
ALTER FUNCTION public.cleanup_expired_holds() SET search_path = public;
ALTER FUNCTION public.cleanup_old_reports() SET search_path = public;
ALTER FUNCTION public.cleanup_old_upload_batches(retention_days integer) SET search_path = public;
ALTER FUNCTION public.get_judit_rate_stats(workspace_id_param text, time_window_minutes integer) SET search_path = public;
ALTER FUNCTION public.get_next_analysis_version(p_process_id text) SET search_path = public;
ALTER FUNCTION public.get_user_workspace_role(user_uuid uuid, workspace_uuid text) SET search_path = public;
ALTER FUNCTION public.has_workspace_access(user_uuid uuid, workspace_uuid text) SET search_path = public;
ALTER FUNCTION public.invalidate_process_analysis_cache(p_process_id text) SET search_path = public;
ALTER FUNCTION public.invalidate_report_cache_on_movement() SET search_path = public;
ALTER FUNCTION public.reset_monthly_quotas() SET search_path = public;
ALTER FUNCTION public.update_job_executions_timestamp() SET search_path = public;
ALTER FUNCTION public.update_process_timeline_entries_updated_at() SET search_path = public;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public.update_webhook_deliveries_timestamp() SET search_path = public;

-- Função criada anteriormente (se existir)
-- ALTER FUNCTION public.get_user_workspace_ids() SET search_path = public;
