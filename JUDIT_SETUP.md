# 🚀 JUDIT Integration - Setup Guide

Guia rápido para configurar e iniciar a integração JUDIT no JustoAI V2.

---

## 📋 Pré-requisitos

- ✅ Node.js 20+
- ✅ PostgreSQL 15+ (via Supabase)
- ✅ Redis 7+ (para filas)
- ✅ JUDIT API Key

---

## ⚙️ Configuração

### **1. Instalar Dependências**

```bash
npm install bullmq ioredis
```

### **2. Variáveis de Ambiente**

Adicione ao `.env.local`:

```bash
# JUDIT API
JUDIT_API_KEY=sua-chave-aqui
JUDIT_REQUESTS_URL=https://requests.prod.judit.io
JUDIT_TRACKING_URL=https://tracking.prod.judit.io

# Redis (para fila de background)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Database (já configurado)
DATABASE_URL=postgresql://...
```

### **3. Aplicar Migração do Banco**

```bash
# Gerar Prisma Client
npm run db:generate

# Aplicar migração
npx prisma migrate dev --name add_judit_integration_models

# Verificar no Prisma Studio (opcional)
npm run db:studio
```

### **4. Adicionar Scripts ao package.json**

```json
{
  "scripts": {
    "worker:judit": "ts-node src/workers/juditOnboardingWorker.ts",
    "jobs:start": "ts-node src/jobs/scheduler.ts",
    "jobs:daily-check": "ts-node src/jobs/dailyJuditCheck.ts"
  }
}
```

---

## 🏃 Inicialização

### **Desenvolvimento (3 terminais)**

```bash
# Terminal 1: Redis
redis-server

# Terminal 2: Next.js
npm run dev

# Terminal 3: Worker de Background
npm run worker:judit
```

### **Produção (PM2)**

```bash
# Instalar PM2
npm install -g pm2

# Iniciar aplicação
pm2 start ecosystem.config.js
```

**ecosystem.config.js:**
```javascript
module.exports = {
  apps: [
    {
      name: 'justoai-app',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'judit-worker',
      script: 'npm',
      args: 'run worker:judit:prod',
      instances: 3, // 3 workers paralelos
      exec_mode: 'cluster',
    },
    {
      name: 'judit-scheduler',
      script: 'npm',
      args: 'run jobs:start',
    },
  ],
};
```

---

## 🧪 Testar a Integração

### **1. Teste de Onboarding via API**

```bash
curl -X POST http://localhost:3000/api/judit/onboarding \
  -H "Content-Type: application/json" \
  -d '{"cnj":"1234567-12.2023.8.09.0001"}'
```

**Resposta esperada:**
```json
{
  "success": true,
  "message": "Onboarding iniciado...",
  "data": {
    "jobId": "onboard-1234567-12.2023.8.09.0001-1704902400000",
    "cnj": "1234567-12.2023.8.09.0001",
    "status": "queued",
    "statusUrl": "/api/judit/onboarding/status/..."
  }
}
```

### **2. Verificar Status**

```bash
curl http://localhost:3000/api/judit/onboarding/status/{jobId}
```

### **3. Configurar Monitoramento**

```bash
curl -X POST http://localhost:3000/api/judit/monitoring/setup \
  -H "Content-Type: application/json" \
  -d '{"cnj":"1234567-12.2023.8.09.0001"}'
```

### **4. Verificar Estatísticas da Fila**

```bash
curl http://localhost:3000/api/judit/queue/stats
```

---

## 📊 Monitoramento

### **Logs do Worker**

```bash
# Logs em tempo real
npm run worker:judit

# Com PM2
pm2 logs judit-worker
```

### **Verificar Saúde da Fila**

```bash
curl http://localhost:3000/api/judit/queue/stats | jq '.data.stats'
```

**Output:**
```json
{
  "waiting": 5,
  "active": 2,
  "completed": 150,
  "failed": 1,
  "health": "healthy"
}
```

---

## 🔧 Troubleshooting

### **Erro: "Connection refused" (Redis)**

```bash
# Verificar se Redis está rodando
redis-cli ping
# Deve retornar: PONG

# Se não estiver rodando:
redis-server
```

### **Erro: "JUDIT_API_KEY não configurada"**

```bash
# Verificar se .env.local tem a key
cat .env.local | grep JUDIT_API_KEY

# Se não tiver, adicionar:
echo "JUDIT_API_KEY=sua-chave-aqui" >> .env.local
```

### **Worker não está processando jobs**

```bash
# Verificar se worker está rodando
ps aux | grep "juditOnboardingWorker"

# Reiniciar worker
pm2 restart judit-worker

# Verificar logs
pm2 logs judit-worker --lines 50
```

### **Jobs ficando presos em "waiting"**

```bash
# Verificar jobs na fila
curl http://localhost:3000/api/judit/queue/stats

# Limpar jobs antigos (se necessário)
redis-cli FLUSHDB  # ⚠️ CUIDADO: Apaga tudo do Redis
```

---

## 📚 Documentação Completa

Ver `docs/JUDIT_INTEGRATION.md` para:
- Arquitetura detalhada
- Exemplos de uso via API
- Componentes React
- Otimização de custos
- Troubleshooting avançado

---

## ✅ Checklist de Produção

Antes de ir para produção, verificar:

- [ ] JUDIT_API_KEY configurada
- [ ] Redis rodando e acessível
- [ ] Migração do banco aplicada
- [ ] Worker rodando (PM2 ou similar)
- [ ] Scheduler de daily check ativo
- [ ] Logs sendo salvos (PM2/CloudWatch)
- [ ] Alertas configurados (Sentry/email)
- [ ] Backup do Redis configurado

---

## 🎯 Próximos Passos

1. **Testar com processos reais**
2. **Configurar alertas de falhas**
3. **Implementar dashboard de monitoramento**
4. **Adicionar métricas (Prometheus/Grafana)**
5. **Otimizar concorrência do worker**

---

**Status:** ✅ Pronto para Produção
**Última atualização:** 2025-01-10
