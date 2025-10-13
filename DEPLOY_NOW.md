# 🚀 DEPLOY AGORA - Passo a Passo Completo

## ✅ O QUE JÁ FOI CONFIGURADO

Criei o arquivo `.env.production` com TODAS as suas credenciais reais:
- ✅ Supabase (Database)
- ✅ Upstash Redis
- ✅ Resend Email
- ✅ Google Gemini AI
- ✅ Sentry
- ✅ NextAuth secrets gerados
- ✅ URLs de produção

---

## 🎯 SEQUÊNCIA CORRETA DE DEPLOY

### **PASSO 1: Aplicar Migrações do Database** ⚠️ FAZER PRIMEIRO

**Problema Atual:** As tabelas não existem ainda no Supabase.
**Solução:** Aplicar migrações do Prisma.

```bash
# 1. Abra o terminal na pasta do projeto
cd "C:\Users\carlo\Documents\PROJETO JUSTOAI\NOVA FASE\justoai-v2"

# 2. Configure variável temporária (Windows PowerShell)
$env:DATABASE_URL="postgresql://postgres:Nuwjjr$3@db.xxxxx.supabase.co:5432/postgres"

# 3. Gere o Prisma Client
npx prisma generate

# 4. Aplique TODAS as migrações
npx prisma migrate deploy

# 5. Verifique se funcionou
npx prisma migrate status
```

**Resultado Esperado:**
```
✅ Database schema is up to date!
```

---

### **PASSO 2: Configurar Row Level Security (RLS)**

**Agora que as tabelas existem, podemos aplicar o RLS.**

1. Vá para Supabase SQL Editor:
   https://supabase.com/dashboard/project/xxxxx/sql/new

2. Abra o arquivo localmente:
   `deploy-scripts/03-configure-supabase.sql`

3. Copie **TODO** o conteúdo

4. Cole no SQL Editor do Supabase

5. Clique em **"Run"**

**Verificar se funcionou:**
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = false;
```

Se retornar **0 linhas**, RLS está ativado em todas as tabelas ✅

---

### **PASSO 3: Testar Conexões**

```bash
# Teste todas as conexões
node deploy-scripts/04-test-connections.js
```

**Resultado Esperado:**
```
✅ Database (Prisma): PASSED
✅ Redis: PASSED
✅ Supabase: PASSED
✅ Email Service (SMTP): PASSED
✅ API Keys: PASSED
⚠️  JUDIT API: SKIPPED (API key not configured - expected)

🎉 ALL TESTS PASSED! (6/7 - JUDIT pending)
```

---

### **PASSO 4: Validação Pré-Deploy**

```bash
# Valide configuração e código
node deploy-scripts/01-pre-deploy-check.js
```

**Resultado Esperado:**
```
✅ Environment Variables: PASSED
✅ Database Migrations: PASSED
✅ Critical Files: PASSED
✅ No Mock Data: PASSED
✅ Dependencies: PASSED
✅ Build Configuration: PASSED

🎉 ALL CHECKS PASSED!
```

---

### **PASSO 5: Configurar Vercel Environment Variables**

**Você tem duas opções:**

#### **Opção A: Via Script (Recomendado)**

```bash
# Windows PowerShell - faça o script executável primeiro
# Se der erro, use Opção B

# No Git Bash ou WSL
./deploy-scripts/02-configure-vercel.sh production
```

#### **Opção B: Manual (via Vercel Dashboard)**

1. Vá para: https://vercel.com/justoais-projects/justoaiv2/settings/environment-variables

2. Adicione TODAS as variáveis de `.env.production` (uma por uma):
   - Copie o nome da variável
   - Copie o valor
   - Selecione Environment: **Production**
   - Clique "Save"

**Variáveis CRÍTICAS (não pule nenhuma):**
```
NODE_ENV
NEXT_PUBLIC_APP_URL
DATABASE_URL
DIRECT_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
REDIS_HOST
REDIS_PORT
REDIS_PASSWORD
REDIS_URL
NEXTAUTH_URL
NEXTAUTH_SECRET
GOOGLE_API_KEY
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASSWORD
FROM_EMAIL
ALLOWED_ORIGINS
SENTRY_DSN
BULL_BOARD_ACCESS_TOKEN
... (todas as outras do arquivo)
```

---

### **PASSO 6: Build Local (Opcional mas Recomendado)**

```bash
# Teste o build localmente antes de fazer deploy
npm run build
```

Se der erro, resolva antes de fazer deploy.

---

### **PASSO 7: Commit e Push para Git**

```bash
# 1. Verifique o que vai ser commitado
git status

# 2. Adicione os arquivos (NÃO adicione .env.production!)
git add .

# 3. Verifique se .env.production NÃO está na lista
git status
# Se .env.production aparecer, remova:
git reset .env.production

# 4. Commit
git commit -m "feat: Production ready - Remove mocks, add deploy scripts, complete documentation"

# 5. Push
git push origin main
```

**Vercel vai automaticamente:**
1. Detectar o push
2. Fazer build
3. Deploy para produção
4. URL: https://justoaiv2.vercel.app

---

### **PASSO 8: Verificar Deploy**

1. **Acompanhe o deploy:**
   https://vercel.com/justoais-projects/justoaiv2/deployments

2. **Quando completar, teste:**
   ```bash
   curl https://justoaiv2.vercel.app/api/health
   ```

   **Esperado:**
   ```json
   {
     "success": true,
     "status": "ok",
     "timestamp": "2025-01-22T..."
   }
   ```

3. **Abra no navegador:**
   https://justoaiv2.vercel.app

4. **Teste funcionalidades:**
   - [ ] Home page carrega
   - [ ] Login funciona
   - [ ] Dashboard acessível
   - [ ] Upload de documento funciona

---

### **PASSO 9: Monitorar (Primeiras 24h)**

1. **Vercel Logs:**
   ```bash
   vercel logs --follow
   ```

2. **Sentry Dashboard:**
   https://justoai.sentry.io/issues/

3. **Supabase Dashboard:**
   https://supabase.com/dashboard/project/xxxxx

---

## 🆘 SE ALGO DER ERRADO

### **Rollback Imediato**

```bash
# Voltar para versão anterior
./deploy-scripts/05-rollback.sh

# Ou via Vercel Dashboard
# Settings → Deployments → Promote [deployment anterior]
```

---

## ⚠️ COMANDOS WINDOWS (Se precisar)

Se você está no Windows CMD em vez de PowerShell:

```cmd
# Configurar DATABASE_URL
set DATABASE_URL=postgresql://postgres:Nuwjjr$3@db.xxxxx.supabase.co:5432/postgres

# Aplicar migrações
npx prisma migrate deploy
```

---

## 📝 CHECKLIST FINAL

Antes de fazer deploy, confirme:

- [ ] **PASSO 1:** Migrações aplicadas com sucesso
- [ ] **PASSO 2:** RLS configurado (0 linhas sem RLS)
- [ ] **PASSO 3:** Testes de conexão passaram (6/7)
- [ ] **PASSO 4:** Validação pré-deploy passou
- [ ] **PASSO 5:** Variáveis configuradas no Vercel
- [ ] **PASSO 6:** Build local funcionou
- [ ] **PASSO 7:** Git push feito
- [ ] **PASSO 8:** Deploy verificado
- [ ] **PASSO 9:** Monitoramento ativo

---

## 🎊 PRÓXIMOS PASSOS

### **Sexta-feira (quando receber JUDIT_API_KEY):**

1. Adicione a chave ao `.env.production`:
   ```bash
   JUDIT_API_KEY=sua-chave-aqui
   ```

2. Atualize no Vercel:
   - Dashboard → Settings → Environment Variables
   - Add: `JUDIT_API_KEY` = valor

3. Faça um novo deploy:
   ```bash
   git commit --allow-empty -m "Add JUDIT API key"
   git push origin main
   ```

---

## 📞 SUPORTE

Se tiver algum erro, me envie:
1. A mensagem de erro completa
2. O passo que estava executando
3. Screenshot (se aplicável)

**Estou aqui para ajudar! 🚀**

---

**Criado em:** 2025-01-22
**Status:** ✅ Pronto para executar
