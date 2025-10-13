# ✅ Passo 7 - Configure RLS (VERSÃO FINAL CORRIGIDA)

## O que foi corrigido:

### ✅ **1. Removidas tabelas JUDIT inexistentes**
- processos
- judit_requests
- judit_monitoring
- judit_cost_tracking
- judit_alerts

### ✅ **2. Adicionadas tabelas novas das migrations**
- analysis_cache
- process_movements_tracking
- scheduled_credit_holds
- plan_configurations
- workspace_usage_daily
- workspace_quota_policy

### ✅ **3. Corrigida nomenclatura de colunas**
**PROBLEMA:** Prisma usa camelCase, script estava usando snake_case

**Correções aplicadas:**
- `user_id` → `"userId"`
- `workspace_id` → `"workspaceId"`
- `supabase_id` → `"supabaseId"`
- `monitored_process_id` → `"monitoredProcessId"`

Todas as policies, índices e funções foram atualizadas!

---

## 🚀 Execute Agora

Abra o **SQL Editor** no Supabase e execute:

**Arquivo:** `deploy-scripts/03-configure-supabase.sql`

---

## Resultado Esperado

O script vai:
1. ✅ Habilitar RLS em ~35 tabelas
2. ✅ Criar 15+ políticas RLS de acesso
3. ✅ Criar 8 índices de performance
4. ✅ Criar 2 funções auxiliares (has_workspace_access, get_user_workspace_role)
5. ✅ Configurar permissões para service_role e authenticated

---

## Verificação

Após executar, rode para confirmar:

```sql
-- 1. Ver tabelas com RLS habilitado
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- 2. Ver políticas criadas
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

---

**Este é o ÚLTIMO passo das migrations!** 🎉

Depois: Configure Vercel e deploy! 🚀
