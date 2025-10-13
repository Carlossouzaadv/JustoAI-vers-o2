# ✅ ORDEM CORRETA DE EXECUÇÃO

## 🎯 Execute Exatamente Nesta Ordem

### **PASSO 0A: Adicionar STARTER e PROFESSIONAL ao ENUM** ✅
```
deploy-scripts/00a_add_enum_values.sql
```

### **PASSO 0B: Atualizar Dados Existentes** ✅
```
deploy-scripts/00b_update_plan_data.sql
```
⚠️ Execute em NOVA query (separada da 0A)

---

### **PASSO 1: Performance Indexes** ✅
```
deploy-scripts/001_performance_indexes_fixed.sql
```
Status: JÁ EXECUTADO

---

### **PASSO 2: Telemetry & Quota System** ✅
```
deploy-scripts/02_telemetry_quota_system_FINAL.sql
```

---

### **PASSO 2A: Criar ENUMs de Créditos** ⏭️ NOVO!
```
deploy-scripts/02a_create_credit_enums.sql
```
⚠️ **IMPORTANTE:** Execute ANTES do Passo 3!

Este passo cria os ENUMs necessários:
- CreditAllocationType
- CreditTransactionType
- CreditCategory
- UsageStatus
- UploadBatchStatus
- UploadRowStatus
- JobStatus
- AudienceType
- OutputFormat

---

### **PASSO 3: Credit System**
```
deploy-scripts/03_credit_system_FINAL.sql
```
⚠️ Só execute DEPOIS do Passo 2A!

---

### **PASSO 4: Analysis System**
```
deploy-scripts/04_deepen_analysis_system_fixed.sql
```

---

### **PASSO 5: Reports Enhancement**
```
deploy-scripts/05_scheduled_reports_enhancement_FINAL.sql
```

---

### **PASSO 6: Upload Batch System**
```
deploy-scripts/06_upload_batch_system_fixed.sql
```

---

### **PASSO 7: Configure RLS (ÚLTIMO!)**
```
deploy-scripts/03-configure-supabase.sql
```

---

## 📋 Checklist Completo

```
✅ Passo 0A: Adicionar STARTER e PROFESSIONAL
✅ Passo 0B: Atualizar dados BASIC→STARTER, PRO→PROFESSIONAL
✅ Passo 1: Performance Indexes (JÁ FEITO)
✅ Passo 2: Telemetry & Quota System
⏭️ Passo 2A: Criar ENUMs de Créditos (NOVO - EXECUTE AGORA!)
⏭️ Passo 3: Credit System
⏭️ Passo 4: Analysis System
⏭️ Passo 5: Reports Enhancement
⏭️ Passo 6: Upload Batch System
⏭️ Passo 7: Configure RLS
```

---

## ✅ Verificação Rápida

Após Passo 2A, execute para verificar:

```sql
-- Ver ENUMs criados
SELECT typname as enum_name
FROM pg_type t
JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
AND t.typtype = 'e'
AND typname LIKE '%Credit%' OR typname LIKE '%Usage%' OR typname LIKE '%Upload%'
ORDER BY typname;
```

Deve mostrar:
- CreditAllocationType
- CreditCategory
- CreditTransactionType
- UsageStatus
- UploadBatchStatus
- UploadRowStatus

---

## ⏱️ Tempo Estimado

- Passo 2A: 1 minuto
- Passos 3-7: 10 minutos
- **Total restante:** ~11 minutos

---

**Próximo:** Execute `02a_create_credit_enums.sql` agora! 🚀
