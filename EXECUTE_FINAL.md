# ⚡ EXECUTE AGORA - Versão Final Corrigida

## ✅ Situação Atual

Seu ENUM `Plan` tem valores: `FREE`, `BASIC`, `PRO`, `ENTERPRISE`

Mas o correto deveria ser: `FREE`, `STARTER`, `PROFESSIONAL`, `ENTERPRISE`

## 🔧 Plano de Ação

Vamos:
1. ✅ Adicionar os valores corretos ao ENUM
2. ✅ Atualizar os dados existentes
3. ✅ Executar as migrações corrigidas

---

## 📋 ORDEM DE EXECUÇÃO

### **0. Corrigir ENUM Plan (PRIMEIRO!)**
```
deploy-scripts/00_fix_plan_enum.sql
```

Este script:
- ✅ Adiciona `STARTER` e `PROFESSIONAL` ao ENUM
- ✅ Atualiza `BASIC` → `STARTER` nos dados existentes
- ✅ Atualiza `PRO` → `PROFESSIONAL` nos dados existentes

---

### **1. Performance Indexes** ✅ COMPLETO
```
deploy-scripts/001_performance_indexes_fixed.sql
```
Status: JÁ EXECUTADO

---

### **2. Telemetry & Quota System**
```
deploy-scripts/02_telemetry_quota_system_FINAL.sql
```
✅ Corrigido para usar: FREE, STARTER, PROFESSIONAL, ENTERPRISE

---

### **3. Credit System**
```
deploy-scripts/03_credit_system_FINAL.sql
```
✅ Corrigido para usar os valores corretos do ENUM

---

### **4. Deepen Analysis System**
```
deploy-scripts/04_deepen_analysis_system_fixed.sql
```
✅ Não usa ENUM Plan, pode usar o arquivo anterior

---

### **5. Scheduled Reports Enhancement**
```
deploy-scripts/05_scheduled_reports_enhancement_FINAL.sql
```
✅ Corrigido para usar os valores corretos do ENUM

---

### **6. Upload Batch System**
```
deploy-scripts/06_upload_batch_system_fixed.sql
```
✅ Não usa ENUM Plan, pode usar o arquivo anterior

---

### **7. Configure RLS**
```
deploy-scripts/03-configure-supabase.sql
```
✅ Habilita Row Level Security

---

## 🚀 Execução Passo a Passo

### **PASSO 0: Corrigir ENUM**

Execute no Supabase SQL Editor:
```
deploy-scripts/00_fix_plan_enum.sql
```

Verifique que funcionou:
```sql
SELECT enumlabel FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname = 'Plan'
ORDER BY e.enumsortorder;
```

Deve mostrar: FREE, BASIC, PRO, ENTERPRISE, STARTER, PROFESSIONAL

---

### **PASSO 1: Migração 2 (Telemetry)**

Execute:
```
deploy-scripts/02_telemetry_quota_system_FINAL.sql
```

---

### **PASSO 2: Migração 3 (Credits)**

Execute:
```
deploy-scripts/03_credit_system_FINAL.sql
```

---

### **PASSO 3: Migração 4 (Analysis)**

Execute:
```
deploy-scripts/04_deepen_analysis_system_fixed.sql
```

---

### **PASSO 4: Migração 5 (Reports)**

Execute:
```
deploy-scripts/05_scheduled_reports_enhancement_FINAL.sql
```

---

### **PASSO 5: Migração 6 (Upload)**

Execute:
```
deploy-scripts/06_upload_batch_system_fixed.sql
```

---

### **PASSO 6: Configure RLS**

Execute:
```
deploy-scripts/03-configure-supabase.sql
```

---

## ✅ Verificação Final

Execute estas queries para confirmar:

```sql
-- 1. Total de tabelas (deve ser ~41)
SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public';

-- 2. Planos corretos
SELECT DISTINCT plan::text FROM workspaces;

-- 3. RLS habilitado
SELECT COUNT(*) FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = 't';

-- 4. Configurações de planos criadas
SELECT plan_name FROM plan_configurations ORDER BY plan_name;
```

**Esperado:**
- ~41 tabelas
- Planos: FREE, STARTER, PROFESSIONAL, ENTERPRISE (ou BASIC/PRO se ainda não executou script 0)
- RLS em todas as tabelas
- 4 configurações de plano: FREE, STARTER, PROFESSIONAL, ENTERPRISE

---

## 🎯 Depois das Migrações

1. ✅ Configure Vercel environment variables
2. ✅ Git commit e push
3. ✅ Deploy automático
4. ✅ Teste a aplicação

---

## ⏱️ Tempo Total

- Corrigir ENUM: 2 min
- 5 Migrações: 10 min (2 min cada)
- RLS: 3 min
- **Total:** ~15 minutos

---

**Comece agora:** Execute `00_fix_plan_enum.sql` no Supabase SQL Editor! 🚀
