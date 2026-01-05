-- ============================================================
-- SUPABASE PERFORMANCE FIX
-- Execute este script no Supabase SQL Editor
-- Data: 05/01/2026
-- ============================================================

-- ============================================================
-- PARTE 1: REMOVER ÍNDICES DUPLICADOS
-- ============================================================
-- O Prisma Schema tem definições duplicadas para estes índices.
-- Vamos remover os redundantes (formato idx_tabela_coluna) 
-- e manter o padrão tabela_coluna_idx.

DROP INDEX IF EXISTS public.idx_cases_workspace_id;
DROP INDEX IF EXISTS public.idx_clients_workspace_id;
DROP INDEX IF EXISTS public.idx_monitored_processes_workspace_id;
DROP INDEX IF EXISTS public.idx_process_movements_monitored_process;
DROP INDEX IF EXISTS public.idx_report_schedules_workspace_id;

-- Para estas tabelas, assumindo o mesmo padrão (não visíveis no trecho verificado mas listadas no CSV)
DROP INDEX IF EXISTS public.idx_credit_allocations_workspace_expiry;
DROP INDEX IF EXISTS public.idx_credit_transactions_allocation;
DROP INDEX IF EXISTS public.idx_credit_transactions_workspace;
DROP INDEX IF EXISTS public.idx_scheduled_credit_holds_expiry;
DROP INDEX IF EXISTS public.idx_scheduled_credit_holds_workspace;


-- ============================================================
-- PARTE 2: OTIMIZAR RLS POLICIES (Auth RLS Init Plan)
-- ============================================================
-- O bloco abaixo usa string replacement simples para otimizar as chamadas.
-- Não requer funções auxiliares.

DO $$
DECLARE
    pol record;
    new_using text;
    original_using text;
BEGIN
    FOR pol IN 
        SELECT policyname, tablename, cmd, roles, qual::text as current_using
        FROM pg_policies 
        WHERE schemaname = 'public' 
    LOOP
        original_using := pol.current_using;
        new_using := original_using;
        
        -- Substituições comuns sugeridas pelo Supabase Linter
        new_using := replace(new_using, 'auth.uid()', '(select auth.uid())');
        new_using := replace(new_using, 'auth.role()', '(select auth.role())');
        new_using := replace(new_using, 'auth.email()', '(select auth.email())');
        
        -- Se mudou algo, aplica
        IF new_using <> original_using THEN
            -- Garante que não duplique selects (caso rode mais de uma vez)
            new_using := replace(new_using, '(select (select auth.uid()))', '(select auth.uid())');
            new_using := replace(new_using, '(select (select auth.role()))', '(select auth.role())');
            new_using := replace(new_using, '(select (select auth.email()))', '(select auth.email())');
            
            EXECUTE format('ALTER POLICY %I ON public.%I USING (%s)', pol.policyname, pol.tablename, new_using);
            RAISE NOTICE 'Fixed: % on %', pol.policyname, pol.tablename;
        END IF;
    END LOOP;
END $$;
