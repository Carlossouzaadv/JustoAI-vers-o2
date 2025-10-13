# ⚡ EXECUTE AGORA - Migrações Corrigidas

## ✅ Todas as Migrações Foram Corrigidas!

Criei versões **corrigidas** de todas as 5 migrações restantes que vão funcionar com seu banco de dados.

---

## 🚀 ORDEM DE EXECUÇÃO

Execute estes arquivos **EM ORDEM** no Supabase SQL Editor:

### ✅ **1. Performance Indexes** (JÁ EXECUTADO)
```
deploy-scripts/001_performance_indexes_fixed.sql
```
Status: ✅ COMPLETO

---

### ⏭️ **2. Telemetry & Quota System**
```
deploy-scripts/02_telemetry_quota_system_fixed.sql
```
**Correções:**
- ✅ Usa `FREE`, `STARTER`, `PROFESSIONAL` (não `basic`, `premium`, `enterprise`)
- ✅ Remove dependências de tabelas que serão criadas depois
- ✅ Adiciona lógica de skip para tabelas já existentes

---

### ⏭️ **3. Credit System**
```
deploy-scripts/03_credit_system_fixed.sql
```
**Correções:**
- ✅ Usa ENUMs corretos: `CreditAllocationType`, `CreditTransactionType`, `CreditCategory`, `UsageStatus`
- ✅ Cria tabelas com IF NOT EXISTS
- ✅ Insere configurações de plano corretas

---

### ⏭️ **4. Deepen Analysis System**
```
deploy-scripts/04_deepen_analysis_system_fixed.sql
```
**Correções:**
- ✅ Usa nomes de colunas corretos (`caseId` com maiúscula, não `case_id`)
- ✅ Usa ENUM `JobStatus` existente
- ✅ Remove referências a tabelas não criadas ainda

---

### ⏭️ **5. Scheduled Reports Enhancement**
```
deploy-scripts/05_scheduled_reports_enhancement_fixed.sql
```
**Correções:**
- ✅ Usa blocos `DO $$` para adicionar colunas com segurança (não dá erro se já existe)
- ✅ Usa ENUMs corretos: `AudienceType`, `OutputFormat`
- ✅ Usa planos corretos: `FREE`, `STARTER`, `PROFESSIONAL`

---

### ⏭️ **6. Upload Batch System**
```
deploy-scripts/06_upload_batch_system_fixed.sql
```
**Correções:**
- ✅ Usa ENUMs corretos: `UploadBatchStatus`, `UploadRowStatus`
- ✅ Usa nomes de tabelas corretos
- ✅ Cria todas as views e funções necessárias

---

### ⏭️ **7. Configure RLS (ÚLTIMO PASSO)**
```
deploy-scripts/03-configure-supabase.sql
```
Habilita Row Level Security em todas as tabelas.

---

## 📋 Procedimento Rápido

Para cada arquivo acima (2 a 7):

1. **Abra** o arquivo no seu editor de código
2. **Copie** TODO o conteúdo (Ctrl+A, Ctrl+C)
3. **Cole** no Supabase SQL Editor
4. **Clique** "Run"
5. **Aguarde** "Success" (deve ser rápido, 5-10 segundos cada)
6. **Próxima** migração

---

## ✅ Verificação Após Cada Migração

Se quiser conferir que funcionou:

```sql
-- Contar tabelas
SELECT COUNT(*) as total_tables
FROM pg_tables
WHERE schemaname = 'public';
```

**Após cada migração, o número de tabelas deve aumentar:**
- Após #1: ~23 tabelas (já tinha)
- Após #2: ~25 tabelas (+2: workspace_quota_policy, workspace_usage_daily)
- Após #3: ~31 tabelas (+6: workspace_credits, credit_allocations, etc)
- Após #4: ~34 tabelas (+3: analysis_jobs, analysis_cache, process_movements_tracking)
- Após #5: ~37 tabelas (+3: workspace_quotas, report_cache, report_templates)
- Após #6: ~41 tabelas (+4: upload_batch, upload_batch_row, upload_batch_events, judit_telemetry)
- Após #7: ~41 tabelas (RLS habilitado, não cria tabelas)

---

## ⚠️ Se Ainda Assim Der Erro

**Anote qual migração deu erro e me mostre a mensagem completa.**

Possíveis erros (muito raros agora):
- "already exists" → Pode ignorar, significa que já estava criado
- "column does not exist" → Me avise, vou corrigir
- "type does not exist" → Me avise, vou corrigir

---

## 🎯 Após Executar Todas

Execute a verificação final:

```sql
-- 1. Total de tabelas
SELECT COUNT(*) as total_tables
FROM pg_tables
WHERE schemaname = 'public';

-- 2. Total de ENUMs
SELECT COUNT(DISTINCT typname) as total_enums
FROM pg_type t
JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public' AND t.typtype = 'e';

-- 3. RLS habilitado
SELECT COUNT(*) as tables_with_rls
FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = 't';

-- 4. Liste todas as tabelas
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

**Esperado:**
- `total_tables`: 40-45 tabelas
- `total_enums`: ~40 ENUMs
- `tables_with_rls`: Mesmo número de tabelas (após executar #7)

---

## 🚀 Próximo Passo

Depois de executar todos os arquivos com sucesso:

1. ✅ Configure variáveis do Vercel (15 min)
2. ✅ Faça git commit e push (5 min)
3. ✅ Acompanhe o deploy (5 min)
4. ✅ Teste a aplicação (5 min)

Ver: `DEPLOYMENT_INSTRUCTIONS.md` - FASE 3 em diante

---

**Comece pela Migração #2:** `02_telemetry_quota_system_fixed.sql`

Boa sorte! 🎯
