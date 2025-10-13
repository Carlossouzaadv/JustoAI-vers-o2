# 🔧 Guia de Deploy - Banco de Dados Parcialmente Criado

## ✅ Situação Detectada

Você já tem alguns objetos criados no banco de dados (pelo menos o tipo ENUM `Plan` existe).

Isso é comum quando:
- Você rodou `prisma db push` antes
- Já fez testes de conexão
- Tinha um ambiente dev configurado

## 📋 Novo Plano de Ação

### **PASSO 1: Verificar o Estado Atual (2 minutos)**

1. Abra Supabase SQL Editor:
   https://supabase.com/dashboard/project/overbsbivbuevmyltyet/sql/new

2. Execute o arquivo: `deploy-scripts/01-verify-database-state.sql`

   Copie e cole TODO o conteúdo, clique **"Run"**

3. **Anote os resultados:**
   - Quantas tabelas existem? ____
   - Quais ENUMs existem? ____
   - RLS está habilitado? ____

---

### **PASSO 2: Aplicar Schema Seguro (5 minutos)**

Execute o arquivo: `deploy-scripts/00-base-schema-safe.sql`

Este arquivo:
- ✅ Só cria ENUMs que NÃO existem
- ✅ Usa lógica `IF NOT EXISTS`
- ✅ Não vai dar erro se já existir

**Como:**
1. Abra o arquivo `deploy-scripts/00-base-schema-safe.sql`
2. Copie TODO o conteúdo
3. Cole no Supabase SQL Editor
4. Clique **"Run"**

**Resultado esperado:** "Success" (sem erros)

---

### **PASSO 3: Verificar Tabelas Faltantes (1 minuto)**

Execute este SQL para ver quais tabelas você JÁ tem:

```sql
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

**Se você tem MENOS de 40 tabelas**, precisamos criar as faltantes.

---

### **PASSO 4A: Se Tem POUCAS Tabelas (< 10 tabelas)**

Você precisa do schema completo. Use Prisma:

**Opção 1: Tentar de outro local (sem firewall)**

Se você tem acesso a outra rede (hotspot de celular, VPN diferente, outra internet):

```bash
# De outro local/rede
export DATABASE_URL="postgresql://postgres:Nuwjjr\$3@db.overbsbivbuevmyltyet.supabase.co:5432/postgres"
npx prisma db push --accept-data-loss
```

**Opção 2: Script Prisma via Supabase Studio**

1. Instale a extensão "Database" do Supabase
2. Use o schema inspector
3. Importe o schema Prisma

**Opção 3: Aplicar manualmente** (tedioso mas funciona)

Edite o arquivo `deploy-scripts/00-base-schema.sql`:
- Remova todas as linhas `CREATE TYPE` que já existem
- Mantenha apenas `CREATE TABLE` e `CREATE INDEX`
- Execute o arquivo editado

---

### **PASSO 4B: Se Tem MUITAS Tabelas (≥ 40 tabelas)**

Ótimo! Seu schema base já está criado. Pule para o **PASSO 5**.

---

### **PASSO 5: Aplicar Migrações Adicionais (15 minutos)**

Agora aplique as 6 migrações extras, **EM ORDEM**:

1. `prisma/migrations/001_performance_indexes.sql`
2. `prisma/migrations/20231201_telemetry_quota_system.sql`
3. `prisma/migrations/20250115_credit_system.sql`
4. `prisma/migrations/20250119_deepen_analysis_system.sql`
5. `prisma/migrations/20250119_scheduled_reports_enhancement.sql`
6. `prisma/migrations/20250119_upload_batch_system.sql`

**Para cada uma:**
- Abra o arquivo
- Copie TODO o conteúdo
- Cole no Supabase SQL Editor
- Clique **"Run"**
- Aguarde "Success"

**IMPORTANTE:** Se alguma der erro "already exists", está OK! Continue com a próxima.

---

### **PASSO 6: Configurar RLS (5 minutos)**

Execute o arquivo: `deploy-scripts/03-configure-supabase.sql`

1. Abra o arquivo
2. Copie TODO o conteúdo
3. Cole no Supabase SQL Editor
4. Clique **"Run"**

---

### **PASSO 7: Verificar Tudo Está OK (2 minutos)**

Execute esta query de verificação final:

```sql
-- 1. Total de tabelas (deve ser ~50+)
SELECT COUNT(*) as total_tables
FROM pg_tables
WHERE schemaname = 'public';

-- 2. RLS habilitado (todos devem ter 't')
SELECT COUNT(*) as tables_with_rls
FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = 't';

-- 3. ENUMs criados (deve ter ~40+)
SELECT COUNT(DISTINCT typname) as total_enums
FROM pg_type t
JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public' AND t.typtype = 'e';
```

**Esperado:**
- `total_tables`: 50+
- `tables_with_rls`: 50+ (mesmo número de tabelas)
- `total_enums`: 40+

---

### **PASSO 8: Configurar Vercel (15 minutos)**

Siga o passo original:

1. Vá para: https://vercel.com/justoais-projects/justoaiv2/settings/environment-variables
2. Adicione todas as variáveis de `.env.production`
3. Selecione Environment: **Production**

---

### **PASSO 9: Deploy (10 minutos)**

```bash
cd "C:\Users\carlo\Documents\PROJETO JUSTOAI\NOVA FASE\justoai-v2"
git add .
git reset .env.production
git commit -m "feat: production ready"
git push origin main
```

Acompanhe em: https://vercel.com/justoais-projects/justoaiv2/deployments

---

### **PASSO 10: Verificar (5 minutos)**

1. Aguarde deploy terminar (3-5 min)
2. Acesse: https://justoaiv2.vercel.app/api/health
3. Deve retornar: `{"success": true, "status": "ok"}`

---

## 🎯 Resumo Executivo

1. ✅ Verificar estado atual → `01-verify-database-state.sql`
2. ✅ Aplicar ENUMs seguros → `00-base-schema-safe.sql`
3. ✅ Verificar quantas tabelas tem
4. ✅ Se < 40, criar schema completo (Opção 1, 2 ou 3)
5. ✅ Se ≥ 40, continuar
6. ✅ Aplicar 6 migrações extras
7. ✅ Configurar RLS → `03-configure-supabase.sql`
8. ✅ Verificar tudo está OK
9. ✅ Configurar Vercel variables
10. ✅ Git push → Deploy automático

---

## 🆘 Se Ainda Assim Tiver Problemas

**Opção Nuclear (Reset Completo):**

⚠️ **CUIDADO: Isso APAGA TUDO no banco!**

```sql
-- Drop all tables
DO $$ DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
END $$;

-- Drop all types
DO $$ DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT typname FROM pg_type t
              JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
              WHERE n.nspname = 'public' AND t.typtype = 'e') LOOP
        EXECUTE 'DROP TYPE IF EXISTS ' || quote_ident(r.typname) || ' CASCADE';
    END LOOP;
END $$;
```

Depois comece do zero com `00-base-schema.sql` original.

---

**Criado:** 2025-10-12 22:20
**Status:** Corrigido para lidar com banco parcialmente criado
**Próximo passo:** Execute `01-verify-database-state.sql` primeiro
