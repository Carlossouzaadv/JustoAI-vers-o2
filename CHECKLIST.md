# 🚀 JustoAI V2 - Production Deployment Checklist

Esta checklist garante que todos os passos críticos foram executados antes do deploy de produção.

---

## 📋 PRÉ-REQUISITOS

### ✅ Ferramentas Instaladas
- [ ] Node.js 20+ instalado
- [ ] Vercel CLI instalado (`npm install -g vercel`)
- [ ] Git configurado
- [ ] Acesso ao Supabase Dashboard
- [ ] Acesso ao Vercel Dashboard

### ✅ Acesso às Plataformas
- [ ] Conta Vercel com permissões de deploy
- [ ] Projeto Supabase criado e configurado
- [ ] Redis/Upstash configurado
- [ ] Conta Resend (email) com domínio verificado
- [ ] Conta Sentry (opcional, mas recomendado)

---

## 🔧 CONFIGURAÇÃO DE AMBIENTE

### ✅ Variáveis de Ambiente
- [ ] Arquivo `.env.production` criado (baseado em `.env.production.example`)
- [ ] `NODE_ENV=production` configurado
- [ ] `NEXT_PUBLIC_APP_URL` com URL de produção
- [ ] `DATABASE_URL` do Supabase configurado (com pooling)
- [ ] `DIRECT_URL` do Supabase configurado (sem pooling)
- [ ] `NEXT_PUBLIC_SUPABASE_URL` configurado
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` configurado
- [ ] `SUPABASE_SERVICE_ROLE_KEY` configurado ⚠️ NUNCA EXPOR
- [ ] `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` configurados
- [ ] `NEXTAUTH_SECRET` gerado (min 32 chars, diferente de dev)
- [ ] `GOOGLE_API_KEY` configurado (chave de produção)
- [ ] `JUDIT_API_KEY` configurado (será fornecido na sexta-feira)
- [ ] `SMTP_*` variáveis configuradas (Resend)
- [ ] `FROM_EMAIL` com email do domínio verificado
- [ ] `ALLOWED_ORIGINS` com apenas origens de produção
- [ ] `SENTRY_DSN` configurado (se usar Sentry)
- [ ] `ALERTS_EMAIL_TO` configurado
- [ ] Todas as outras variáveis revisadas

### ✅ Secrets Únicos
- [ ] `NEXTAUTH_SECRET` diferente de desenvolvimento
- [ ] `BULL_BOARD_ACCESS_TOKEN` gerado (`openssl rand -hex 32`)
- [ ] Senhas e tokens únicos (não reutilizados de dev)

---

## 🗄️ BANCO DE DADOS

### ✅ Supabase Setup
- [ ] Projeto Supabase criado no plano adequado
- [ ] Connection pooling habilitado
- [ ] Todas as migrações aplicadas:
  - [ ] `prisma migrate deploy`
  - [ ] Verificar: `prisma migrate status`
- [ ] Schema validado: `npx prisma validate`
- [ ] Client gerado: `npx prisma generate`

### ✅ Row Level Security (RLS)
- [ ] Script `03-configure-supabase.sql` executado
- [ ] RLS habilitado em todas as tabelas
- [ ] Policies criadas e testadas
- [ ] Verificar: Query no SQL Editor
  ```sql
  SELECT tablename, rowsecurity
  FROM pg_tables
  WHERE schemaname = 'public' AND rowsecurity = false;
  ```
  (Resultado deve ser vazio)

### ✅ Backups
- [ ] Backups automáticos configurados no Supabase
- [ ] Testar restore de um backup
- [ ] Política de retenção definida (recomendado: 30 dias)

---

## 🧪 TESTES

### ✅ Testes Locais
- [ ] Build local bem-sucedido: `npm run build`
- [ ] TypeScript sem erros: `npm run type-check`
- [ ] Linter sem erros: `npm run lint`
- [ ] Testes unitários passando (se houver): `npm test`

### ✅ Testes de Conexão
- [ ] Executar: `node deploy-scripts/04-test-connections.js`
- [ ] Todos os testes passaram:
  - [ ] Database (Prisma)
  - [ ] Redis
  - [ ] Supabase
  - [ ] Email (SMTP)
  - [ ] API Keys válidas

### ✅ Validação Pré-Deploy
- [ ] Executar: `node deploy-scripts/01-pre-deploy-check.js`
- [ ] Todos os checks passaram
- [ ] Warnings revisados e aceitos (se houver)

---

## 🔒 SEGURANÇA

### ✅ CORS & Security Headers
- [ ] `ALLOWED_ORIGINS` contém APENAS domínios de produção
- [ ] Nenhum `localhost` em `ALLOWED_ORIGINS`
- [ ] `SECURITY_HEADERS_ENABLED=true`
- [ ] CORS testado e funcionando

### ✅ Autenticação
- [ ] NextAuth configurado corretamente
- [ ] Supabase Auth configurado
- [ ] Fluxo de login testado
- [ ] Refresh tokens funcionando
- [ ] Logout funcionando

### ✅ Rate Limiting
- [ ] Rate limiting configurado nas APIs
- [ ] Limites adequados para produção
- [ ] Testado comportamento quando limite atingido

### ✅ Secrets & Keys
- [ ] `.env.production` NÃO está commitado
- [ ] `.env.production` adicionado ao `.gitignore`
- [ ] Secrets configurados no Vercel (não em código)
- [ ] API keys rotacionadas (se reutilizadas de dev)

---

## 📦 CÓDIGO & BUILD

### ✅ Code Quality
- [ ] Todos os mocks removidos
- [ ] Console.logs removidos/substituídos por logger
- [ ] Debug mode desabilitado: `NEXT_PUBLIC_ENABLE_DEBUG=false`
- [ ] Swagger desabilitado ou protegido em produção
- [ ] Código revisado (peer review)

### ✅ Otimizações
- [ ] Imagens otimizadas
- [ ] Bundle size aceitável
- [ ] Lazy loading implementado onde necessário
- [ ] Cache strategies configuradas

---

## 🚀 DEPLOY

### ✅ Configuração Vercel
- [ ] Projeto criado no Vercel
- [ ] Git repository conectado
- [ ] Branch de produção configurado (main/master)
- [ ] Build commands configurados corretamente
- [ ] Environment variables configuradas via script:
  ```bash
  ./deploy-scripts/02-configure-vercel.sh production
  ```
- [ ] Variáveis verificadas no Vercel Dashboard

### ✅ Domínio
- [ ] Domínio customizado configurado (se aplicável)
- [ ] DNS apontando corretamente
- [ ] SSL/TLS funcionando
- [ ] Redirects configurados (www → non-www ou vice-versa)

### ✅ Deploy Process
- [ ] Deploy preview testado primeiro
- [ ] Preview validado completamente
- [ ] Deploy para produção executado
- [ ] Build bem-sucedido
- [ ] Deploy verificado no Vercel Dashboard

---

## 📊 MONITORAMENTO & OBSERVABILIDADE

### ✅ Error Tracking
- [ ] Sentry (ou similar) configurado
- [ ] Errors sendo capturados e enviados
- [ ] Alertas configurados
- [ ] Source maps configuradas (para stack traces legíveis)

### ✅ Logging
- [ ] Logs estruturados em produção (pino/winston)
- [ ] Log level configurado: `LOG_LEVEL=info` ou `warn`
- [ ] Logs accessíveis via Vercel ou ferramenta externa

### ✅ Alertas
- [ ] Alertas de email configurados
- [ ] Slack webhook configurado (opcional)
- [ ] Alertas testados
- [ ] On-call rotation definida (se aplicável)

### ✅ Métricas
- [ ] Dashboard de métricas configurado
- [ ] JUDIT cost tracking funcionando
- [ ] Queue metrics sendo coletadas
- [ ] Performance metrics monitoradas

---

## 🔄 WORKERS & JOBS

### ✅ Background Workers
- [ ] Redis configurado e acessível
- [ ] BullMQ workers configurados
- [ ] Cron jobs configurados
- [ ] Workers iniciando automaticamente
- [ ] Bull Board acessível (com autenticação)
- [ ] Job retry strategies configuradas

### ✅ JUDIT Integration
- [ ] JUDIT API Key configurada
- [ ] Onboarding worker testado
- [ ] Daily check job configurado
- [ ] Cost tracking funcionando
- [ ] Alertas de JUDIT funcionando

---

## 📧 EMAIL & NOTIFICAÇÕES

### ✅ Email Service
- [ ] Resend (ou similar) configurado
- [ ] Domínio verificado no Resend
- [ ] Templates de email testados
- [ ] Email de teste enviado e recebido
- [ ] SPF/DKIM configurados

### ✅ Notificações
- [ ] Alerts por email funcionando
- [ ] Notificações de processos funcionando
- [ ] Relatórios agendados funcionando

---

## 🧩 INTEGRAÇÕES EXTERNAS

### ✅ JUDIT API
- [ ] API Key configurada (receberá na sexta-feira)
- [ ] Endpoints testados
- [ ] Rate limiting respeitado
- [ ] Circuit breaker configurado
- [ ] Fallbacks implementados

### ✅ Google Gemini
- [ ] API Key de produção configurada
- [ ] Quotas verificadas
- [ ] Error handling implementado
- [ ] Custo estimado validado

### ✅ Payments (se aplicável)
- [ ] Stripe/MercadoPago configurado
- [ ] Webhooks configurados
- [ ] Teste de pagamento realizado
- [ ] Refunds testados

---

## ✅ TESTES PÓS-DEPLOY

### ✅ Funcionalidade
- [ ] Home page carregando
- [ ] Login funcionando
- [ ] Dashboard acessível
- [ ] Upload de documentos funcionando
- [ ] Análise de IA funcionando
- [ ] Relatórios sendo gerados
- [ ] Processos sendo monitorados
- [ ] Emails sendo enviados
- [ ] Workers processando jobs

### ✅ Performance
- [ ] Tempo de resposta aceitável (<2s)
- [ ] First Contentful Paint <1.5s
- [ ] Time to Interactive <3.5s
- [ ] Lighthouse score >90

### ✅ Mobile
- [ ] Layout responsivo funcionando
- [ ] Touch targets adequados
- [ ] Formulários mobile-friendly
- [ ] Performance em 3G aceitável

---

## 📚 DOCUMENTAÇÃO

### ✅ Documentação Técnica
- [ ] `PRODUCTION_SETUP.md` criado e completo
- [ ] Runbook criado e acessível
- [ ] Diagramas de arquitetura atualizados
- [ ] API documentation atualizada

### ✅ Documentação Operacional
- [ ] Procedimentos de rollback documentados
- [ ] Troubleshooting guide criado
- [ ] Escalation procedures definidos
- [ ] Contacts list atualizada

---

## 🆘 CONTINGÊNCIA

### ✅ Rollback Preparado
- [ ] Script de rollback testado
- [ ] Deployment anterior identificado
- [ ] Tempo de rollback conhecido
- [ ] Procedimento de rollback documentado

### ✅ Emergency Procedures
- [ ] Contatos de emergência definidos
- [ ] Processo de escalation documentado
- [ ] Backup manual possível
- [ ] Disaster recovery plan criado

---

## ✅ FINAL CHECKS

### ✅ Before Going Live
- [ ] Todos os items desta checklist completados
- [ ] Stakeholders notificados sobre deploy
- [ ] Janela de manutenção comunicada (se aplicável)
- [ ] Equipe de suporte alertada
- [ ] Monitoring dashboards abertos

### ✅ Go-Live
- [ ] Deploy executado
- [ ] Health checks passando
- [ ] Smoke tests passando
- [ ] Primeiros usuários acessando sem problemas
- [ ] Logs sem erros críticos
- [ ] Métricas normais

### ✅ Post-Deploy (First 24h)
- [ ] Monitorar logs continuamente
- [ ] Verificar error rates
- [ ] Validar performance metrics
- [ ] Confirmar emails sendo enviados
- [ ] Verificar jobs sendo processados
- [ ] Responder a incidents rapidamente

---

## 📝 SIGN-OFF

Antes de fazer deploy para produção, confirme:

- [ ] **Responsável pelo Deploy:** _______________________________
- [ ] **Data Planejada:** _______________________________
- [ ] **Horário:** _______________________________ (Recomendado: horário de baixo tráfego)
- [ ] **Aprovação Técnica:** _______________________________ (Tech Lead)
- [ ] **Aprovação de Negócio:** _______________________________ (Product Owner)

---

## 🎉 SUCESSO!

Se todos os itens acima foram completados, você está pronto para deploy!

**Boa sorte! 🚀**

---

**Última atualização:** 2025-01-22
**Versão:** 1.0.0
