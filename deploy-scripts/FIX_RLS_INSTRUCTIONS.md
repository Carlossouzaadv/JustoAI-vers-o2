# 🚨 INSTRUÇÕES PARA CORRIGIR RLS

## Problema Atual

As tabelas no banco usam **DUAS convenções diferentes** de nomenclatura:

1. **Tabelas antigas (Prisma)**: Não sabemos ainda se usam camelCase ou snake_case
2. **Tabelas novas (Migrations)**:
   - Migration 3, 4, 6: `workspace_id` (snake_case)
   - Migration 5: `"workspaceId"` (camelCase com aspas)

## 🔍 PASSO 1: Identificar nomenclatura real

Execute **PRIMEIRO** este script para ver os nomes reais das colunas:

```sql
SELECT
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'user_workspaces',
    'workspace_credits',
    'workspace_quotas'
  )
  AND (column_name LIKE '%Id%' OR column_name LIKE '%_id')
ORDER BY table_name, column_name;
```

### Resultado esperado:

Se mostrar:
- `userId`, `workspaceId` → Usa **camelCase** (sem aspas no SQL, mas precisa aspas duplas)
- `user_id`, `workspace_id` → Usa **snake_case** (sem aspas)

## 🔧 PASSO 2: Escolher a versão correta do script RLS

### **Opção A:** Se `user_workspaces` tem colunas `userId` e `workspaceId` (camelCase):

Use o script atual `03-configure-supabase.sql` **mas adicione aspas duplas** em TODAS as colunas camelCase:
- `"userId"` em vez de userId
- `"workspaceId"` em vez de workspaceId
- `"supabaseId"` em vez de supabaseId
- `"monitoredProcessId"` em vez de monitoredProcessId

### **Opção B:** Se `user_workspaces` tem colunas `user_id` e `workspace_id` (snake_case):

Reverta todas as colunas no script RLS de volta para snake_case:
- `user_id` em vez de `"userId"`
- `workspace_id` em vez de `"workspaceId"`
- `supabase_id` em vez de `"supabaseId"`
- `monitored_process_id` em vez de `"monitoredProcessId"`

## 📝 Me informe o resultado

Execute a query acima e me diga o que apareceu para:
- **user_workspaces**: userId/workspaceId OU user_id/workspace_id?
- **workspace_credits**: workspace_id OU workspaceId?
- **workspace_quotas**: workspaceId OU workspace_id?

Com essa informação eu crio o script RLS correto DEFINITIVO! 🎯
