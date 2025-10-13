# ⚡ EXECUTE AGORA - Passo a Passo Simples

## 🎯 Ordem de Execução (Simples e Direto)

### **PASSO 0A: Adicionar Valores ao ENUM** (2 min)

**Execute no Supabase SQL Editor:**
```
deploy-scripts/00a_add_enum_values.sql
```

**O que faz:**
- Adiciona `STARTER` ao ENUM Plan
- Adiciona `PROFESSIONAL` ao ENUM Plan

**Resultado esperado:** Lista com 6 valores (FREE, BASIC, PRO, ENTERPRISE, STARTER, PROFESSIONAL)

---

### **PASSO 0B: Atualizar Dados** (1 min)

**⚠️ IMPORTANTE: Execute em uma NOVA query (separada da anterior)**

**Execute no Supabase SQL Editor:**
```
deploy-scripts/00b_update_plan_data.sql
```

**O que faz:**
- Atualiza `BASIC` → `STARTER` nos workspaces
- Atualiza `PRO` → `PROFESSIONAL` nos workspaces

**Resultado esperado:** Mensagem "Plan ENUM atualizado com sucesso!"

---

### **PASSO 1: Performance Indexes** ✅ JÁ FEITO

Status: COMPLETO

---

### **PASSO 2: Telemetry & Quota** (2 min)

**Execute:**
```
deploy-scripts/02_telemetry_quota_system_FINAL.sql
```

**Resultado esperado:** Cria 2 novas tabelas (workspace_quota_policy, workspace_usage_daily)

---

### **PASSO 3: Credit System** (2 min)

**Execute:**
```
deploy-scripts/03_credit_system_FINAL.sql
```

**Resultado esperado:** Cria 6 novas tabelas (workspace_credits, credit_allocations, credit_transactions, scheduled_credit_holds, usage_events, plan_configurations)

---

### **PASSO 4: Analysis System** (2 min)

**Execute:**
```
deploy-scripts/04_deepen_analysis_system_fixed.sql
```

**Resultado esperado:** Cria 3 novas tabelas (analysis_jobs, analysis_cache, process_movements_tracking)

---

### **PASSO 5: Reports Enhancement** (2 min)

**Execute:**
```
deploy-scripts/05_scheduled_reports_enhancement_FINAL.sql
```

**Resultado esperado:** Adiciona colunas e cria 3 novas tabelas (workspace_quotas, report_cache, report_templates)

---

### **PASSO 6: Upload Batch System** (2 min)

**Execute:**
```
deploy-scripts/06_upload_batch_system_fixed.sql
```

**Resultado esperado:** Cria 4 novas tabelas (upload_batch, upload_batch_row, upload_batch_events, judit_telemetry)

---

### **PASSO 7: Configure RLS** (3 min)

**Execute:**
```
deploy-scripts/03-configure-supabase.sql
```

**Resultado esperado:** Habilita Row Level Security em todas as ~41 tabelas

---

## ✅ Verificação Rápida Após Cada Passo

Execute para confirmar:

```sql
-- Total de tabelas
SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public';
```

**Progresso esperado:**
- Após Passo 2: ~25 tabelas
- Após Passo 3: ~31 tabelas
- Após Passo 4: ~34 tabelas
- Após Passo 5: ~37 tabelas
- Após Passo 6: ~41 tabelas
- Após Passo 7: ~41 tabelas (RLS habilitado)

---

## 🎉 Após Completar TODOS os Passos

Execute a verificação final completa:

```sql
-- 1. Total de tabelas
SELECT COUNT(*) as total_tables
FROM pg_tables
WHERE schemaname = 'public';

-- 2. Total com RLS habilitado
SELECT COUNT(*) as tables_with_rls
FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = 't';

-- 3. Planos no sistema
SELECT plan::text, COUNT(*) as total
FROM workspaces
GROUP BY plan::text
ORDER BY plan::text;

-- 4. Configurações de planos
SELECT plan_name, monitor_limit, report_credits_month, full_credits_month
FROM plan_configurations
ORDER BY plan_name;
```

**Esperado:**
- `total_tables`: ~41
- `tables_with_rls`: ~41 (mesmo número)
- Planos: ENTERPRISE, FREE, PROFESSIONAL, STARTER
- 4 configurações de plano

---

## 🚀 Próximos Passos (Depois das Migrações)

1. ✅ Configure variáveis do Vercel (15 min)
2. ✅ Faça git commit e push (5 min)
3. ✅ Vercel faz deploy automaticamente (5 min)
4. ✅ Teste: https://justoaiv2.vercel.app (5 min)

**Total:** ~30 minutos após as migrações

---

## ⏱️ Tempo Total

- **Migrações (Passos 0-7):** ~15 minutos
- **Vercel + Deploy:** ~30 minutos
- **Total:** ~45 minutos

---

## 💡 Dica Importante

**Execute cada arquivo EM ORDEM**, um de cada vez.

**Não pule nenhum passo!**

Se der erro em algum, me avise imediatamente com a mensagem de erro completa.

---

**Comece agora:** `00a_add_enum_values.sql` 🚀
