# 🎯 COMECE AQUI - Deploy em 30 Minutos

## ✅ TUDO ESTÁ CONFIGURADO!

Criei **automaticamente** todos os arquivos com suas credenciais reais:
- ✅ `.env.production` - Todas as variáveis preenchidas
- ✅ Scripts de deploy prontos
- ✅ Documentação completa
- ✅ Comandos prontos para copiar/colar

---

## 🚀 DEPLOY AGORA (3 Passos Simples)

### **📋 PASSO 1: Aplicar Migrações (5 minutos)**

Abra **PowerShell** e execute:

```powershell
cd "C:\Users\carlo\Documents\PROJETO JUSTOAI\NOVA FASE\justoai-v2"
$env:DATABASE_URL="postgresql://postgres:Nuwjjr`$3@db.overbsbivbuevmyltyet.supabase.co:5432/postgres"
npx prisma generate
npx prisma migrate deploy
```

**✅ Sucesso quando ver:** `Database schema is up to date!`

---

### **🔒 PASSO 2: Configurar RLS (5 minutos)**

1. Abra: https://supabase.com/dashboard/project/overbsbivbuevmyltyet/sql/new

2. Abra o arquivo local: `deploy-scripts/03-configure-supabase.sql`

3. Copie **TODO** o conteúdo

4. Cole no SQL Editor e clique **"Run"**

**✅ Sucesso quando:** Comando executar sem erros

---

### **🚀 PASSO 3: Deploy (20 minutos)**

```powershell
# 1. Teste conexões
node deploy-scripts/04-test-connections.js

# 2. Valide configuração
node deploy-scripts/01-pre-deploy-check.js

# 3. Build local (teste)
npm run build

# 4. Commit e push
git add .
git reset .env.production
git commit -m "feat: production ready"
git push origin main
```

**Vercel vai fazer deploy automaticamente!**

Acompanhe em: https://vercel.com/justoais-projects/justoaiv2/deployments

---

## ⚠️ IMPORTANTE: Configurar Variáveis no Vercel

**O Vercel precisa das variáveis de ambiente!**

### **Opção A: Script Automático (Se funcionar)**

```bash
# Git Bash
./deploy-scripts/02-configure-vercel.sh production
```

### **Opção B: Manual (Mais Seguro)**

1. Vá para: https://vercel.com/justoais-projects/justoaiv2/settings/environment-variables

2. Para cada variável em `.env.production`:
   - Clique "Add New"
   - Copie nome e valor
   - Selecione "Production"
   - Save

**Variáveis CRÍTICAS (copie do `.env.production`):**
- `NODE_ENV`
- `DATABASE_URL`
- `DIRECT_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `REDIS_*` (todas as 5)
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `GOOGLE_API_KEY`
- `SMTP_*` (todas as 4)
- `ALLOWED_ORIGINS`
- `SENTRY_DSN`
- E todas as outras...

---

## 📚 DOCUMENTAÇÃO DISPONÍVEL

Se precisar de mais detalhes:

| Arquivo | Descrição |
|---------|-----------|
| `QUICK_COMMANDS.md` | Comandos prontos copiar/colar |
| `DEPLOY_NOW.md` | Guia detalhado passo a passo |
| `CHECKLIST.md` | 200+ items de verificação |
| `docs/PRODUCTION_SETUP.md` | Setup completo |
| `docs/RUNBOOK.md` | Operações e troubleshooting |
| `DEPLOYMENT_SUMMARY.md` | Resumo executivo |

---

## ✅ VERIFICAÇÃO RÁPIDA

Após o deploy, teste:

```powershell
# 1. Health check
Invoke-WebRequest -Uri https://justoaiv2.vercel.app/api/health

# 2. Abra no navegador
start https://justoaiv2.vercel.app
```

**Funcionalidades para testar:**
- [ ] Home page carrega
- [ ] Login funciona
- [ ] Dashboard acessível
- [ ] Upload de documento

---

## 🆘 SE ALGO DER ERRADO

### **Erro nas Migrações**

```powershell
# Tente com o CMD em vez de PowerShell
set DATABASE_URL=postgresql://postgres:Nuwjjr$3@db.overbsbivbuevmyltyet.supabase.co:5432/postgres
npx prisma migrate deploy
```

### **Build Falha**

```powershell
# Veja os erros
npm run build

# Corrija os erros TypeScript/ESLint e tente novamente
```

### **Deploy com Problema**

```bash
# Rollback para versão anterior
./deploy-scripts/05-rollback.sh

# Ou via Vercel Dashboard:
# Deployments → [anterior] → Promote to Production
```

---

## 🎉 PRONTO PARA SEXTA-FEIRA

Quando receber a **JUDIT_API_KEY** na sexta:

1. Edite `.env.production`:
   ```
   JUDIT_API_KEY=sua-chave-aqui
   ```

2. Adicione no Vercel Dashboard

3. Redeploy:
   ```bash
   git commit --allow-empty -m "Add JUDIT API key"
   git push origin main
   ```

---

## 📊 O QUE FOI CRIADO PARA VOCÊ

### **Arquivos Novos:**
```
✅ .env.production              (suas credenciais reais)
✅ .env.production.example      (template)
✅ DEPLOY_NOW.md               (guia detalhado)
✅ QUICK_COMMANDS.md           (comandos rápidos)
✅ START_HERE.md               (este arquivo)
✅ CHECKLIST.md                (200+ items)
✅ DEPLOYMENT_SUMMARY.md       (resumo executivo)
✅ deploy-scripts/             (5 scripts prontos)
   ├── 01-pre-deploy-check.js
   ├── 02-configure-vercel.sh
   ├── 03-configure-supabase.sql
   ├── 04-test-connections.js
   └── 05-rollback.sh
✅ docs/
   ├── PRODUCTION_SETUP.md     (setup completo)
   └── RUNBOOK.md              (operações)
```

### **Arquivos Modificados:**
```
✅ .gitignore                  (protege .env.production)
✅ package.json                (scripts de deploy)
✅ src/app/api/clients/route.ts    (mocks removidos)
✅ src/app/api/processes/route.ts  (mocks removidos)
```

---

## 💡 DICA FINAL

**Não precisa ler toda a documentação agora!**

Siga os 3 passos acima e você estará em produção em 30 minutos.

Consulte os outros arquivos apenas se precisar de detalhes ou tiver problemas.

---

## 🚀 AGORA É COM VOCÊ!

1. ✅ Execute PASSO 1 (migrações)
2. ✅ Execute PASSO 2 (RLS)
3. ✅ Execute PASSO 3 (deploy)
4. 🎉 **APLICAÇÃO EM PRODUÇÃO!**

**Boa sorte! Estou aqui se precisar de ajuda! 🚀**

---

**Criado:** 2025-01-22
**Status:** ✅ Tudo pronto para executar
**Tempo estimado:** 30 minutos
