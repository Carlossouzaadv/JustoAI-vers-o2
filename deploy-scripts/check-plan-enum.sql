-- Verificar valores do ENUM Plan
SELECT
    e.enumlabel as plan_value,
    e.enumsortorder as sort_order
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname = 'Plan'
ORDER BY e.enumsortorder;
