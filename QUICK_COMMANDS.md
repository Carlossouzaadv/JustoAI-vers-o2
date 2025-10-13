# ⚡ Quick Commands - Deploy Rápido

## 🚀 COMANDOS PRINCIPAIS (Copie e Cole)

### **1. Aplicar Migrações Database (PRIMEIRO COMANDO)**

```powershell
# PowerShell (recomendado)
cd "C:\Users\carlo\Documents\PROJETO JUSTOAI\NOVA FASE\justoai-v2"
$env:DATABASE_URL="postgresql://postgres:Nuwjjr`$3@db.overbsbivbuevmyltyet.supabase.co:5432/postgres"
npx prisma generate
npx prisma migrate deploy
npx prisma migrate status
```

```cmd
# CMD (alternativa)
cd C:\Users\carlo\Documents\PROJETO JUSTOAI\NOVA FASE\justoai-v2
set DATABASE_URL=postgresql://postgres:Nuwjjr$3@db.overbsbivbuevmyltyet.supabase.co:5432/postgres
npx prisma generate
npx prisma migrate deploy
npx prisma migrate status
```

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
DATABASE_URL=postgresql://postgres.overbsbivbuevmyltyet:Nuwjjr$3@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres:Nuwjjr$3@db.overbsbivbuevmyltyet.supabase.co:5432/postgres
NEXT_PUBLIC_SUPABASE_URL=https://overbsbivbuevmyltyet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92ZXJic2JpdmJ1ZXZteWx0eWV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzczNzY1NTQsImV4cCI6MjA1Mjk1MjU1NH0.RMqYVPWEhH5xMTuUxdBVGPxK_AuZYRDmBiKuCWIL3zw
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92ZXJic2JpdmJ1ZXZteWx0eWV0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzM3NjU1NCwiZXhwIjoyMDUyOTUyNTU0fQ.T-LkBqgJNqXXVpGQG1ycQZ9h_sT0JW5wvBkPKvLHNLk
REDIS_HOST=accepted-cobra-23421.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=AVt9AAIncDI5Y2Q5YjE2NmZlOWE0N2MzYTM3ZWMyYzgyMGJiNDczNXAyMjM0MjE
REDIS_URL=rediss://default:AVt9AAIncDI5Y2Q5YjE2NmZlOWE0N2MzYTM3ZWMyYzgyMGJiNDczNXAyMjM0MjE@accepted-cobra-23421.upstash.io:6379
NEXTAUTH_URL=https://justoaiv2.vercel.app
NEXTAUTH_SECRET=Jk3m9Wp2Lq7Xz5Rt8Yn4Cv6Bx1Mf3Gh9Kp2Wd7Qs5Vt8Hn4Jx6Lc1Rf3Zp9Mn
GOOGLE_API_KEY=AIzaSyBepx-oedsAOION2hvIbR5fYzUaU1Zs3kM
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASSWORD=re_9xwwqQ9R_EcjRQuA6eD9Aj1xHmgAo8Tvz
FROM_EMAIL=noreply@justoai.com.br
ALLOWED_ORIGINS=https://justoaiv2.vercel.app,https://www.justoai.com.br,https://app.justoai.com.br
SENTRY_DSN=https://8a6efddb7bab038e0d0601edd41ea152@o4510178719039488.ingest.us.sentry.io/4510179104456704
BULL_BOARD_ACCESS_TOKEN=7d8f3e9c2a1b4f6e8d3c7a9b2e1f4d6c8a3b7e2f9d1c4a6e8b3d7f2a9c1e4b6d
```

Continue com as outras variáveis de `.env.production`...

---

## 🎯 FLUXO COMPLETO (Resumo)

```powershell
# 1. Migrações
$env:DATABASE_URL="postgresql://postgres:Nuwjjr`$3@db.overbsbivbuevmyltyet.supabase.co:5432/postgres"
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
$env:DATABASE_URL="postgresql://postgres:Nuwjjr`$3@db..."
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
