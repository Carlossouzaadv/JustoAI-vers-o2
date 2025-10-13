# ✅ Passo 7 - Configure RLS (CORRIGIDO)

## O que foi corrigido:

✅ **Removidas referências a tabelas JUDIT que não existem:**
- processos
- judit_requests
- judit_monitoring
- judit_cost_tracking
- judit_alerts

✅ **Adicionadas tabelas criadas nas migrations anteriores:**
- analysis_cache
- process_movements_tracking
- scheduled_credit_holds
- plan_configurations
- workspace_usage_daily
- workspace_quota_policy

## 🚀 Execute Agora

Abra o **SQL Editor** no Supabase e execute:

**Arquivo:** `deploy-scripts/03-configure-supabase.sql`

## Resultado Esperado

O script vai:
1. ✅ Habilitar RLS em ~35 tabelas
2. ✅ Criar políticas RLS para workspaces, users, clients, cases, etc.
3. ✅ Criar índices de performance
4. ✅ Criar funções auxiliares
5. ✅ Configurar permissões

## Verificação

Após executar, rode para confirmar:

```sql
-- Verificar tabelas com RLS habilitado
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

Deve mostrar `rowsecurity = t` para todas as tabelas listadas.

---

**Tempo estimado:** 2-3 minutos

Se der qualquer erro, me avise imediatamente! 🚨
