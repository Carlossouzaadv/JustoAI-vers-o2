-- ================================================================
-- STEP 1: Adicionar novos valores ao ENUM Plan
-- ================================================================
-- Execute esta query PRIMEIRO, sozinha

-- Adicionar STARTER ao ENUM
ALTER TYPE "Plan" ADD VALUE IF NOT EXISTS 'STARTER';

-- Adicionar PROFESSIONAL ao ENUM
ALTER TYPE "Plan" ADD VALUE IF NOT EXISTS 'PROFESSIONAL';

-- Verificar que foram adicionados
SELECT
    e.enumlabel as plan_value,
    e.enumsortorder as sort_order
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname = 'Plan'
ORDER BY e.enumsortorder;
