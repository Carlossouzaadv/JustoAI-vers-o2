-- ================================================================
-- MIGRATION: Sistema de Preview de Onboarding (3 Fases)
-- ================================================================
-- Autor: JustoAI Team
-- Data: 2025-10-20
-- Descrição: Adiciona campos para sistema de preview inteligente
-- ================================================================

-- ============================================================
-- ENUM: Status do Processo de Onboarding
-- ============================================================
DO $$ BEGIN
  CREATE TYPE "ProcessOnboardingStatus" AS ENUM (
    'created',           -- Case criado, PDF salvo, sem preview ainda
    'previewed',         -- Preview gerado com Gemini Flash (FASE 1 completa)
    'enriching',         -- JUDIT rodando em background (FASE 2 em progresso)
    'enriched',          -- JUDIT completou, dados oficiais disponíveis
    'analysis_pending',  -- Aguardando usuário solicitar análise completa
    'analyzed'           -- Análise completa (Gemini Pro) disponível
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- ALTERAÇÕES NA TABELA CASES
-- ============================================================

-- Campo: preview_snapshot
-- Armazena resultado da análise rápida (Gemini Flash)
-- Estrutura JSON esperada:
-- {
--   "summary": "Resumo breve do processo",
--   "parties": ["Autor: Nome", "Réu: Nome"],
--   "subject": "Assunto principal",
--   "claimValue": 1000000.00,
--   "lastMovements": [
--     { "date": "2025-10-15", "type": "Sentença", "description": "..." }
--   ],
--   "confidence": 0.85,
--   "generatedAt": "2025-10-19T10:30:00Z",
--   "model": "gemini-1.5-flash-8b"
-- }
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "preview_snapshot" JSONB DEFAULT NULL;

-- Campo: detected_cnj
-- CNJ detectado automaticamente via regex no PDF
-- Formato: NNNNNNN-DD.AAAA.J.TR.OOOO
-- Exemplo: 5065698-19.2025.4.02.5101
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "detected_cnj" VARCHAR(255) DEFAULT NULL;

-- Campo: first_page_text
-- Texto da primeira página do PDF principal
-- Usado para identificação rápida e busca
-- Limite: primeiros 5000 caracteres
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "first_page_text" TEXT DEFAULT NULL;

-- Campo: onboarding_status
-- Status atual do processo de onboarding
-- Controla qual fase está ativa
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "onboarding_status" "ProcessOnboardingStatus" DEFAULT 'created';

-- Campo: enrichment_started_at
-- Timestamp de quando JUDIT começou a processar
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "enrichment_started_at" TIMESTAMP DEFAULT NULL;

-- Campo: enrichment_completed_at
-- Timestamp de quando JUDIT completou
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "enrichment_completed_at" TIMESTAMP DEFAULT NULL;

-- Campo: preview_generated_at
-- Timestamp de quando preview foi gerado
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "preview_generated_at" TIMESTAMP DEFAULT NULL;

-- ============================================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================================

-- Índice para buscar por status de onboarding
CREATE INDEX IF NOT EXISTS "idx_cases_onboarding_status"
  ON "cases"("onboarding_status", "updated_at" DESC);

-- Índice para buscar por CNJ detectado
CREATE INDEX IF NOT EXISTS "idx_cases_detected_cnj"
  ON "cases"("detected_cnj")
  WHERE "detected_cnj" IS NOT NULL;

-- Índice GIN para busca full-text no preview_snapshot
CREATE INDEX IF NOT EXISTS "idx_cases_preview_snapshot_gin"
  ON "cases" USING GIN("preview_snapshot" jsonb_path_ops);

-- Índice para buscar cases aguardando enrichment
CREATE INDEX IF NOT EXISTS "idx_cases_enriching"
  ON "cases"("onboarding_status", "enrichment_started_at")
  WHERE "onboarding_status" = 'enriching';

-- ============================================================
-- COMENTÁRIOS DE DOCUMENTAÇÃO
-- ============================================================

COMMENT ON COLUMN "cases"."preview_snapshot" IS
  'Preview rápido da análise (Gemini Flash) - JSON com resumo, partes, assunto, valor da causa e últimos movimentos';

COMMENT ON COLUMN "cases"."detected_cnj" IS
  'CNJ detectado automaticamente via regex no PDF (formato: NNNNNNN-DD.AAAA.J.TR.OOOO)';

COMMENT ON COLUMN "cases"."first_page_text" IS
  'Texto da primeira página do PDF principal (máx 5000 chars) para identificação rápida';

COMMENT ON COLUMN "cases"."onboarding_status" IS
  'Status do processo de onboarding em 3 fases: created → previewed → enriching → enriched → analyzed';

COMMENT ON COLUMN "cases"."enrichment_started_at" IS
  'Timestamp de quando o processo de enriquecimento JUDIT foi iniciado';

COMMENT ON COLUMN "cases"."enrichment_completed_at" IS
  'Timestamp de quando o processo de enriquecimento JUDIT foi concluído';

COMMENT ON COLUMN "cases"."preview_generated_at" IS
  'Timestamp de quando o preview foi gerado com sucesso';

-- ============================================================
-- VIEW: Estatísticas de Onboarding
-- ============================================================

CREATE OR REPLACE VIEW "onboarding_stats" AS
SELECT
  "onboarding_status",
  COUNT(*) as total_cases,
  COUNT(CASE WHEN "preview_snapshot" IS NOT NULL THEN 1 END) as with_preview,
  COUNT(CASE WHEN "detected_cnj" IS NOT NULL THEN 1 END) as with_cnj,
  AVG(EXTRACT(EPOCH FROM ("preview_generated_at" - "created_at"))) as avg_preview_time_seconds,
  AVG(EXTRACT(EPOCH FROM ("enrichment_completed_at" - "enrichment_started_at"))) as avg_enrichment_time_seconds
FROM "cases"
WHERE "created_at" > NOW() - INTERVAL '30 days'
GROUP BY "onboarding_status"
ORDER BY "onboarding_status";

COMMENT ON VIEW "onboarding_stats" IS
  'Estatísticas de performance do sistema de onboarding (últimos 30 dias)';

-- ============================================================
-- FUNÇÃO: Limpar Previews Antigos
-- ============================================================

CREATE OR REPLACE FUNCTION cleanup_old_previews(days_old INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Remove preview_snapshot de cases com mais de X dias
  -- que já foram enriquecidos (para economizar espaço)
  UPDATE "cases"
  SET "preview_snapshot" = NULL
  WHERE "onboarding_status" IN ('enriched', 'analyzed')
    AND "created_at" < NOW() - (days_old || ' days')::INTERVAL
    AND "preview_snapshot" IS NOT NULL;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_previews IS
  'Remove preview_snapshot de cases antigos já enriquecidos (economiza espaço)';

-- ============================================================
-- GRANTS (Ajustar conforme seu usuário de aplicação)
-- ============================================================

-- GRANT SELECT, INSERT, UPDATE ON "cases" TO app_user;
-- GRANT SELECT ON "onboarding_stats" TO app_user;
-- GRANT EXECUTE ON FUNCTION cleanup_old_previews TO app_user;

-- ============================================================
-- FIM DA MIGRATION
-- ============================================================
