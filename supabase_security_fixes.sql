-- ============================================================
-- SUPABASE SECURITY FIXES - JustoAI (v3 - Simplificado)
-- Execute este script no Supabase SQL Editor
-- Data: 05/01/2026
-- ============================================================

-- ============================================================
-- PARTE 1: CORRIGIR VIEWS COM SECURITY DEFINER (7 views)
-- ============================================================

ALTER VIEW public.analysis_jobs_stats SET (security_invoker = on);
ALTER VIEW public.cache_performance SET (security_invoker = on);
ALTER VIEW public.workspace_current_usage SET (security_invoker = on);
ALTER VIEW public.judit_usage_stats SET (security_invoker = on);
ALTER VIEW public.workspace_available_credits SET (security_invoker = on);
ALTER VIEW public.upload_batch_stats SET (security_invoker = on);
ALTER VIEW public.workspace_credit_breakdown SET (security_invoker = on);

-- ============================================================
-- PARTE 2: HABILITAR RLS NAS TABELAS (19 tabelas)
-- ============================================================

ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.judit_cost_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.judit_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.judit_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.judit_monitoring ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_timeline_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_health_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._prisma_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_resets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_TimelineLinkedDocuments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces_backup_ssot_migration ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PARTE 3: POLÍTICAS SIMPLES (service_role tem acesso total)
-- ============================================================
-- A API do JustoAI usa service_role key, então essas políticas
-- permitem acesso via service_role e bloqueiam acesso direto anon

-- Política genérica: permite service_role, bloqueia outros
CREATE POLICY "service_role_only" ON public.webhook_deliveries
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_only" ON public.job_executions
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_only" ON public.judit_cost_tracking
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_only" ON public.judit_alerts
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_only" ON public.chat_messages
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_only" ON public.chat_sessions
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_only" ON public.webhook_errors
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_only" ON public.webhook_queues
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_only" ON public.judit_requests
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_only" ON public.processos
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_only" ON public.judit_monitoring
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_only" ON public.documents
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_only" ON public.client_share_links
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_only" ON public.process_timeline_entries
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_only" ON public.system_health_metrics
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_only" ON public._prisma_migrations
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_only" ON public.password_resets
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "allow_all" ON public."_TimelineLinkedDocuments"
  FOR ALL USING (true);

CREATE POLICY "service_role_only" ON public.workspaces_backup_ssot_migration
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- VERIFICAÇÃO
-- ============================================================
-- SELECT schemaname, tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public' AND rowsecurity = false;
