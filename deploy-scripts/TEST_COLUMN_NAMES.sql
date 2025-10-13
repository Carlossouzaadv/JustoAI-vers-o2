-- Teste rápido para verificar nomenclatura das colunas
-- Execute este script PRIMEIRO para identificar o problema

SELECT
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'workspaces',
    'users',
    'user_workspaces',
    'clients',
    'cases',
    'monitored_processes',
    'report_schedules',
    'report_executions',
    'workspace_credits',
    'credit_allocations',
    'credit_transactions',
    'usage_events',
    'workspace_quotas',
    'report_cache',
    'report_templates'
  )
  AND column_name LIKE '%Id%' OR column_name LIKE '%_id'
ORDER BY table_name, column_name;
