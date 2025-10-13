# ⚡ Quick Commands - Deploy Rápido

## 🚀 COMANDOS PRINCIPAIS (Copie e Cole)

### **1. Aplicar Migrações Database (PRIMEIRO COMANDO)**

```powershell
# PowerShell (recomendado)
cd "C:\Users\carlo\Documents\PROJETO JUSTOAI\NOVA FASE\justoai-v2"
$env:DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres"
npx prisma generate
npx prisma migrate deploy
npx prisma migrate status
```

```cmd
# CMD (alternativa)
cd C:\Users\carlo\Documents\PROJETO JUSTOAI\NOVA FASE\justoai-v2
set DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres
npx prisma generate
npx prisma migrate deploy
npx prisma migrate status
```

⚠️ **Get the real DATABASE_URL from your `.env.production` file**

**Resultado esperado:** `Database schema is up to date!`

---

### **2. Testar Conexões**

```powershell
node deploy-scripts/04-test-connections.js
```

**Resultado esperado:** `ALL TESTS PASSED! (6/7)`

---

### **3. Validação Pré-Deploy**

```powershell
node deploy-scripts/01-pre-deploy-check.js
```

**Resultado esperado:** `ALL CHECKS PASSED!`

---

### **4. Build Local (Teste)**

```powershell
npm run build
```

**Se der erro, resolva antes de continuar!**

---

### **5. Git Commit e Push**

```powershell
# Verifica o que vai ser commitado
git status

# Adiciona arquivos (NÃO adiciona .env.production automaticamente)
git add .

# Verifica novamente
git status

# Se .env.production aparecer, remova:
git reset .env.production

# Commit
git commit -m "feat: Production ready - deploy configuration complete"

# Push (Vercel faz deploy automaticamente)
git push origin main
```

---

### **6. Monitorar Deploy**

```powershell
# Ver logs em tempo real
vercel logs --follow

# Ver logs do último deploy
vercel logs
```

**Ou acesse:** https://vercel.com/justoais-projects/justoaiv2/deployments

---

### **7. Testar Aplicação**

```powershell
# Windows PowerShell
Invoke-WebRequest -Uri https://justoaiv2.vercel.app/api/health

# Ou abra no navegador:
start https://justoaiv2.vercel.app
```

---

## 🔥 COMANDOS DE EMERGÊNCIA

### **Rollback (Se algo der errado)**

```powershell
# Git Bash (recomendado)
./deploy-scripts/05-rollback.sh

# Ou manualmente via Vercel Dashboard:
# https://vercel.com/justoais-projects/justoaiv2/deployments
# Clique nos 3 pontos do deployment anterior → "Promote to Production"
```

---

### **Ver Logs de Erro**

```powershell
# Últimos erros
vercel logs | Select-String "ERROR"

# Em tempo real
vercel logs --follow | Select-String "ERROR"
```

---

### **Redeployar (Forçar novo deploy)**

```powershell
# Commit vazio para forçar redeploy
git commit --allow-empty -m "redeploy: force new deployment"
git push origin main
```

---

## 📊 VERIFICAÇÃO RÁPIDA

### **Checklist Rápido**

```powershell
# 1. Database OK?
npx prisma migrate status

# 2. Conexões OK?
node deploy-scripts/04-test-connections.js

# 3. Build OK?
npm run build

# 4. Git limpo?
git status

# Se tudo OK, pode fazer push!
```

---

## 🔑 CONFIGURAR VARIÁVEIS VERCEL (Manual)

Se o script não funcionar, configure manualmente:

1. **Acesse:** https://vercel.com/justoais-projects/justoaiv2/settings/environment-variables

2. **Para cada variável em `.env.production`:**
   - Clique "Add New"
   - Name: [nome da variável]
   - Value: [valor]
   - Environment: **Production** ✅
   - Click "Save"

3. **Variáveis CRÍTICAS (copie exatamente):**

```
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://justoaiv2.vercel.app
DATABASE_URL=postgresql://postgres.xxxxx:YOUR_PASSWORD@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...YOUR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...YOUR_SERVICE_ROLE_KEY
REDIS_HOST=your-redis.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=YOUR_REDIS_PASSWORD
REDIS_URL=rediss://default:YOUR_REDIS_PASSWORD@your-redis.upstash.io:6379
NEXTAUTH_URL=https://justoaiv2.vercel.app
NEXTAUTH_SECRET=YOUR_NEXTAUTH_SECRET_HERE
GOOGLE_API_KEY=AIzaSy...YOUR_GOOGLE_API_KEY
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASSWORD=re_...YOUR_RESEND_API_KEY
FROM_EMAIL=noreply@justoai.com.br
ALLOWED_ORIGINS=https://justoaiv2.vercel.app,https://www.justoai.com.br,https://app.justoai.com.br
SENTRY_DSN=https://...YOUR_SENTRY_DSN
BULL_BOARD_ACCESS_TOKEN=YOUR_BULL_BOARD_TOKEN
```

⚠️ **SECURITY WARNING:** Never commit real API keys to Git!
📋 Get values from your `.env.production` file (NOT committed to Git)

Continue com as outras variáveis de `.env.production`...

---

## 🎯 FLUXO COMPLETO (Resumo)

```powershell
# 1. Migrações
$env:DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres"
npx prisma migrate deploy

# 2. RLS (Supabase SQL Editor)
# Copie deploy-scripts/03-configure-supabase.sql e execute

# 3. Testes
node deploy-scripts/04-test-connections.js
node deploy-scripts/01-pre-deploy-check.js

# 4. Build
npm run build

# 5. Deploy
git add .
git reset .env.production  # Importante!
git commit -m "feat: production ready"
git push origin main

# 6. Verificar
vercel logs --follow
# Abra: https://justoaiv2.vercel.app
```

---

## 📱 LINKS RÁPIDOS

- **Vercel Dashboard:** https://vercel.com/justoais-projects/justoaiv2
- **Supabase Dashboard:** https://supabase.com/dashboard/project/overbsbivbuevmyltyet
- **Upstash Redis:** https://console.upstash.com/redis/accepted-cobra-23421
- **Sentry:** https://justoai.sentry.io/
- **Resend:** https://resend.com/emails

---

## 💡 DICAS

### **Se o PowerShell der erro com $:**

```powershell
# Use crase (`) para escapar o $ no PowerShell
$env:DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres"
```

### **Se o Git Bash funcionar melhor:**

```bash
# Use Git Bash para rodar os scripts .sh
./deploy-scripts/02-configure-vercel.sh production
./deploy-scripts/05-rollback.sh
```

### **Verificar se .env.production está no .gitignore:**

```powershell
cat .gitignore | Select-String ".env.production"
```

Deve aparecer: `.env.production`

---

**Criado:** 2025-01-22
**Atualizado:** Última versão
