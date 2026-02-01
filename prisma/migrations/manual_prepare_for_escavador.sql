-- Migration: prepare_for_escavador
-- Description: Rename JUDIT tables to Provider, add monitoring fields, soft limits, and new tables
-- Date: 2026-01-31
-- 
-- IMPORTANTE: Execute este script diretamente no Supabase SQL Editor
-- Após executar, rode: npx prisma db pull && npx prisma generate

-- ============================================
-- PARTE 1: RENOMEAR TABELAS JUDIT → PROVIDER
-- ============================================

-- 1. Renomear tabela judit_requests → provider_requests
ALTER TABLE IF EXISTS "judit_requests" RENAME TO "provider_requests";

-- 2. Renomear tabela judit_monitoring → provider_monitoring
ALTER TABLE IF EXISTS "judit_monitoring" RENAME TO "provider_monitoring";

-- 3. Renomear tabela judit_telemetry → provider_telemetry
ALTER TABLE IF EXISTS "judit_telemetry" RENAME TO "provider_telemetry";

-- 4. Renomear tabela judit_alerts → provider_alerts
ALTER TABLE IF EXISTS "judit_alerts" RENAME TO "provider_alerts";

-- ============================================
-- PARTE 2: ADICIONAR COLUNA PROVIDER ÀS TABELAS RENOMEADAS
-- ============================================

-- Criar tipo enum LegalProvider se não existir
DO $$ BEGIN
    CREATE TYPE "LegalProvider" AS ENUM ('JUDIT', 'ESCAVADOR');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Adicionar coluna provider às tabelas (default JUDIT para dados existentes)
ALTER TABLE "provider_requests" ADD COLUMN IF NOT EXISTS "provider" "LegalProvider" NOT NULL DEFAULT 'JUDIT';
ALTER TABLE "provider_monitoring" ADD COLUMN IF NOT EXISTS "provider" "LegalProvider" NOT NULL DEFAULT 'JUDIT';
ALTER TABLE "provider_telemetry" ADD COLUMN IF NOT EXISTS "provider" "LegalProvider" NOT NULL DEFAULT 'JUDIT';
ALTER TABLE "provider_alerts" ADD COLUMN IF NOT EXISTS "provider" "LegalProvider" NOT NULL DEFAULT 'JUDIT';

-- Criar índices para provider
CREATE INDEX IF NOT EXISTS "idx_provider_request_provider" ON "provider_requests"("provider");
CREATE INDEX IF NOT EXISTS "idx_provider_monitoring_provider" ON "provider_monitoring"("provider");
CREATE INDEX IF NOT EXISTS "idx_provider_telemetry_provider" ON "provider_telemetry"("provider");
CREATE INDEX IF NOT EXISTS "idx_provider_alert_provider" ON "provider_alerts"("provider");

-- ============================================
-- PARTE 3: ADICIONAR CAMPOS DE MONITORAMENTO INTELIGENTE EM CASES
-- ============================================

-- Criar tipo enum MonitoringFrequency se não existir
DO $$ BEGIN
    CREATE TYPE "MonitoringFrequency" AS ENUM ('DIARIA', 'SEMANAL', 'MENSAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Adicionar novos campos à tabela cases
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "monitoring_frequency" "MonitoringFrequency" NOT NULL DEFAULT 'DIARIA';
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "frequency_suggested_by" TEXT DEFAULT 'AI';
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "frequency_reason" TEXT;
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "frequency_changed_at" TIMESTAMP(6);
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "frequency_changed_by" TEXT;
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "last_monitored_at" TIMESTAMP(6);
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "next_monitor_at" TIMESTAMP(6);
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "monitoring_paused" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "ai_risk_score" INTEGER;

-- Criar índices para monitoramento
CREATE INDEX IF NOT EXISTS "idx_cases_monitoring_frequency" ON "cases"("monitoring_frequency");
CREATE INDEX IF NOT EXISTS "idx_cases_last_monitored_at" ON "cases"("last_monitored_at");

-- ============================================
-- PARTE 4: ADICIONAR CAMPOS DE SOFT LIMITS EM WORKSPACES
-- ============================================

ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "process_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "process_limit" INTEGER;
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "is_in_grace_period" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "grace_period_started_at" TIMESTAMP(6);
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "grace_period_ends_at" TIMESTAMP(6);
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "grace_period_reason" TEXT;

-- ============================================
-- PARTE 5: CRIAR TABELA MonitoringFrequencyLog
-- ============================================

CREATE TABLE IF NOT EXISTS "monitoring_frequency_log" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "case_id" TEXT NOT NULL,
    "previous_frequency" TEXT,
    "new_frequency" TEXT NOT NULL,
    "changed_by" TEXT NOT NULL,
    "user_id" TEXT,
    "reason" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "MonitoringFrequencyLog_caseId_fkey" 
        FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_monitoring_frequency_log_case_created" 
    ON "monitoring_frequency_log"("case_id", "created_at");

-- ============================================
-- PARTE 6: CRIAR TABELA WorkspaceLimitAlert
-- ============================================

CREATE TABLE IF NOT EXISTS "workspace_limit_alerts" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "workspace_id" TEXT NOT NULL,
    "alert_type" TEXT NOT NULL,
    "limit_type" TEXT NOT NULL,
    "current_value" INTEGER NOT NULL,
    "limit_value" INTEGER NOT NULL,
    "was_resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "WorkspaceLimitAlert_workspaceId_fkey" 
        FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_workspace_limit_alert_resolved" 
    ON "workspace_limit_alerts"("workspace_id", "was_resolved");

-- ============================================
-- PARTE 7: POPULAR processCount INICIAL
-- ============================================

-- Atualiza o contador de processos de cada workspace
UPDATE "workspaces" w
SET "process_count" = (
    SELECT COUNT(*)
    FROM "cases" c
    WHERE c."workspaceId" = w."id"
);

-- ============================================
-- VERIFICAÇÃO
-- ============================================

-- Verificar se as alterações foram aplicadas
SELECT 
    'provider_requests' as table_name, 
    COUNT(*) as rows 
FROM "provider_requests"
UNION ALL
SELECT 
    'provider_monitoring', 
    COUNT(*) 
FROM "provider_monitoring"
UNION ALL
SELECT 
    'monitoring_frequency_log', 
    COUNT(*) 
FROM "monitoring_frequency_log"
UNION ALL
SELECT 
    'workspace_limit_alerts', 
    COUNT(*) 
FROM "workspace_limit_alerts";

-- Mostrar workspaces com processCount
SELECT 
    "id", 
    "name", 
    "process_count" 
FROM "workspaces" 
ORDER BY "process_count" DESC 
LIMIT 10;
