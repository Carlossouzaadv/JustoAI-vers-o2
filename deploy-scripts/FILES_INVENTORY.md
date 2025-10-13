# 📁 Deploy Scripts - Inventário de Arquivos

## ✅ Arquivos Mantidos (Limpos e Atualizados)

### **Migrações SQL (Execute em Ordem):**

1. **`00a_add_enum_values.sql`**
   - Adiciona STARTER e PROFESSIONAL ao ENUM Plan
   - Execute PRIMEIRO

2. **`00b_update_plan_data.sql`**
   - Atualiza dados: BASIC→STARTER, PRO→PROFESSIONAL
   - Execute em NOVA query após 00a

3. **`001_performance_indexes_fixed.sql`**
   - Cria índices de performance em todas as tabelas
   - ✅ JÁ EXECUTADO

4. **`02_telemetry_quota_system_FINAL.sql`**
   - Sistema de telemetria e quotas
   - Cria: workspace_quota_policy, workspace_usage_daily

5. **`03_credit_system_FINAL.sql`**
   - Sistema unificado de créditos
   - Cria: workspace_credits, credit_allocations, credit_transactions, etc.

6. **`04_deepen_analysis_system_fixed.sql`**
   - Sistema de análise aprofundada
   - Cria: analysis_jobs, analysis_cache, process_movements_tracking

7. **`05_scheduled_reports_enhancement_FINAL.sql`**
   - Melhorias no sistema de relatórios
   - Cria: workspace_quotas, report_cache, report_templates

8. **`06_upload_batch_system_fixed.sql`**
   - Sistema de upload em lote (Excel)
   - Cria: upload_batch, upload_batch_row, upload_batch_events, judit_telemetry

9. **`03-configure-supabase.sql`**
   - Configura Row Level Security (RLS) em todas as tabelas
   - Execute POR ÚLTIMO

---

### **Scripts de Validação e Testes:**

- **`01-verify-database-state.sql`**
  - Verifica estado atual do banco (tabelas, ENUMs, RLS)
  - Use para debug

- **`check-plan-enum.sql`**
  - Mostra valores do ENUM Plan
  - Use para verificar se STARTER e PROFESSIONAL foram adicionados

- **`01-pre-deploy-check.js`**
  - Valida configurações antes do deploy
  - Verifica variáveis de ambiente, migrações, etc.

- **`04-test-connections.js`**
  - Testa conexões com Database, Redis, Supabase, Email, APIs
  - Execute após migrações para validar

---

### **Scripts de Automação:**

- **`02-configure-vercel.sh`**
  - Configura variáveis de ambiente no Vercel automaticamente
  - Alternativa ao método manual via dashboard

- **`05-rollback.sh`**
  - Script de emergência para rollback de deployment
  - Use se algo der errado em produção

---

### **Documentação:**

- **`README.md`**
  - Documentação geral dos scripts de deploy
  - Instruções de uso

---

## 🗑️ Arquivos Deletados (Obsoletos)

- ❌ `00_fix_plan_enum.sql` - Versão que deu erro (não commitava ENUM)
- ❌ `00-base-schema.sql` - Gerado automaticamente, não necessário
- ❌ `00-base-schema-safe.sql` - Não é mais necessário
- ❌ `02_telemetry_quota_system_fixed.sql` - Substituído por FINAL
- ❌ `03_credit_system_fixed.sql` - Substituído por FINAL
- ❌ `05_scheduled_reports_enhancement_fixed.sql` - Substituído por FINAL
- ❌ `MANUAL_MIGRATION_GUIDE.md` - Obsoleto

---

## 📋 Ordem de Execução Recomendada

```
1. 00a_add_enum_values.sql           (Adicionar novos valores ao ENUM)
2. 00b_update_plan_data.sql          (Atualizar dados existentes)
3. 001_performance_indexes_fixed.sql (✅ JÁ EXECUTADO)
4. 02_telemetry_quota_system_FINAL.sql
5. 03_credit_system_FINAL.sql
6. 04_deepen_analysis_system_fixed.sql
7. 05_scheduled_reports_enhancement_FINAL.sql
8. 06_upload_batch_system_fixed.sql
9. 03-configure-supabase.sql         (RLS - ÚLTIMO!)
```

---

## ✅ Status Atual

- Total de arquivos: 17
- Migrações SQL: 9
- Scripts de validação: 4
- Scripts de automação: 2
- Documentação: 2

**Todos os arquivos estão atualizados e corretos!** ✨

---

**Atualizado:** 2025-10-12 22:40
**Status:** Limpo e organizado
