-- ================================================================
-- STEP 2: Atualizar dados existentes para usar novos valores
-- ================================================================
-- Execute esta query DEPOIS da 00a (em uma query separada)

-- Atualizar workspaces
UPDATE workspaces
SET plan = CASE
    WHEN plan = 'BASIC' THEN 'STARTER'
    WHEN plan = 'PRO' THEN 'PROFESSIONAL'
    ELSE plan
END
WHERE plan IN ('BASIC', 'PRO');

-- Verificar resultado
SELECT
    plan::text,
    COUNT(*) as total
FROM workspaces
GROUP BY plan::text
ORDER BY plan::text;

-- Mensagem de confirmação
DO $$
BEGIN
    RAISE NOTICE 'Plan ENUM atualizado com sucesso!';
    RAISE NOTICE 'Valores antigos (BASIC, PRO) foram migrados para (STARTER, PROFESSIONAL)';
END $$;
