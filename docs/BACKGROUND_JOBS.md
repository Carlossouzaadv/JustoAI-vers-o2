# 🔄 BACKGROUND JOBS - Bull Queue System

## 📋 Overview

Sistema completo de processamento assíncrono usando Bull Queue para automatizar tarefas críticas do JustoAI V2.

### **Componentes Implementados**

✅ **Redis Client** (`lib/redis.ts`)
✅ **Bull Queue Configuration** (`lib/queues.ts`)
✅ **3 Workers Especializados**
✅ **Bull Board Dashboard** (`lib/bull-board.ts`)
✅ **APIs de Controle** (`/api/admin/workers`)
✅ **Scripts de Gerenciamento** (`scripts/start-workers.js`)

---

## 🏗️ Arquitetura

### **Filas Implementadas**

```typescript
// 1. API Sync Queue (a cada 6h)
syncQueue: Sincronização com APIs Judit/Codilo

// 2. Reports Queue (domingo 23h)
reportsQueue: Geração automática de relatórios

// 3. Cache Cleanup Queue (diário)
cacheCleanupQueue: Limpeza de cache Redis/DB

// 4. Document Processing Queue (on-demand)
documentProcessingQueue: Processamento PDF com IA

// 5. Notification Queue (high priority)
notificationQueue: Envio de emails/WhatsApp
```

### **Workers Especializados**

**1. Sync Worker** (`workers/sync-worker.ts`)
- Sincroniza processos com APIs externas a cada 6 horas
- Processamento em lotes de 50 processos
- Sistema de retry e fallback automático
- Cache inteligente com TTL de 6 horas
- Detecção de mudanças incremental

**2. Reports Worker** (`workers/reports-worker.ts`)
- Gera relatórios executivos domingos às 23h
- Processamento de agendamentos recorrentes
- Entrega automática por email/WhatsApp
- Cálculo dinâmico de próxima execução
- Sistema de templates personalizáveis

**3. Cache Cleanup Worker** (`workers/cache-cleanup-worker.ts`)
- Limpeza diária de cache Redis (2h da manhã)
- Limpeza cache IA (3h da manhã)
- Remoção de logs antigos do banco (30 dias)
- Limpeza de análises temporárias (48h)
- Estatísticas de memória liberada

---

## 🚀 Como Usar

### **1. Instalar Redis (Local)**

```bash
# Windows (via Chocolatey)
choco install redis-64

# Windows (via WSL2)
sudo apt install redis-server

# macOS
brew install redis

# Docker
docker run -d --name redis -p 6379:6379 redis:latest
```

### **2. Configurar Variáveis de Ambiente**

```bash
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Bull Queue Configuration
BULL_BOARD_ACCESS_TOKEN=your-admin-token-here
SAVE_SYNC_STATS=true

# Workers Configuration
DEBUG=false
```

### **3. Iniciar Workers**

```bash
# Iniciar todos os workers
npm run workers:start

# Parar todos os workers
npm run workers:stop

# Reiniciar workers
npm run workers:restart

# Ver status dos workers
npm run workers:status

# Ver logs em tempo real
npm run workers:logs sync-worker
npm run workers:logs reports-worker
npm run workers:logs cache-cleanup-worker
```

### **4. Monitoramento**

```bash
# Dashboard Bull Board (desenvolvimento)
http://localhost:3000/api/admin/queues

# APIs de controle
GET    /api/admin/workers?action=stats
GET    /api/admin/workers?action=health-check
POST   /api/admin/workers  # Controle (pause/resume/clean)
DELETE /api/admin/workers  # Limpar filas
```

---

## 📊 Configuração dos Jobs

### **Jobs Recorrentes (Cron)**

```typescript
// Sync APIs - a cada 6 horas
cron: '0 */6 * * *'  // 00:00, 06:00, 12:00, 18:00

// Relatórios - domingos às 23h
cron: '0 23 * * 0'   // Domingo 23:00

// Limpeza cache - todo dia às 2h
cron: '0 2 * * *'    // 02:00 diário

// Limpeza IA - todo dia às 3h
cron: '0 3 * * *'    // 03:00 diário
```

### **Jobs On-Demand**

```typescript
// Sincronização manual
await addSyncJob(workspaceId, { forceUpdate: true });

// Geração de relatório
await addReportJob(scheduleId, { priority: 'high' });

// Processamento documento
await addDocumentProcessingJob(documentId, { analysisType: 'complete' });

// Envio notificação
await addNotificationJob('email-alert', { to: 'user@email.com' });
```

---

## 🔧 APIs de Controle

### **Estatísticas (GET)**

```bash
# Stats básicas
curl http://localhost:3000/api/admin/workers?action=stats

# Health check completo
curl http://localhost:3000/api/admin/workers?action=health-check

# Stats detalhadas
curl http://localhost:3000/api/admin/workers?action=detailed-stats
```

### **Controle dos Workers (POST)**

```bash
# Pausar todas as filas
curl -X POST http://localhost:3000/api/admin/workers \\
  -H "Content-Type: application/json" \\
  -d '{"action": "pause"}'

# Resumir todas as filas
curl -X POST http://localhost:3000/api/admin/workers \\
  -H "Content-Type: application/json" \\
  -d '{"action": "resume"}'

# Retry jobs falhados
curl -X POST http://localhost:3000/api/admin/workers \\
  -H "Content-Type: application/json" \\
  -d '{"action": "retry-failed", "queueName": "sync"}'

# Setup jobs recorrentes
curl -X POST http://localhost:3000/api/admin/workers \\
  -H "Content-Type: application/json" \\
  -d '{"action": "setup-recurring"}'
```

### **Criação de Jobs (POST)**

```bash
# Job de sincronização manual
curl -X POST http://localhost:3000/api/admin/workers \\
  -H "Content-Type: application/json" \\
  -d '{
    "type": "sync-manual",
    "data": {"workspaceId": "workspace-id"},
    "options": {"priority": 5}
  }'

# Job de geração de relatório
curl -X POST http://localhost:3000/api/admin/workers \\
  -H "Content-Type: application/json" \\
  -d '{
    "type": "generate-report",
    "data": {"scheduleId": "schedule-id"}
  }'
```

### **Limpeza de Filas (DELETE)**

```bash
# Limpar todas as filas (desenvolvimento)
curl -X DELETE http://localhost:3000/api/admin/workers

# Limpar com force (produção)
curl -X DELETE http://localhost:3000/api/admin/workers?force=true
```

---

## 📈 Performance e Otimização

### **Configurações de Performance**

```typescript
// Sync Worker
BATCH_SIZE: 50                    // Processos por lote
MAX_CONCURRENT: 5                 // Requests simultâneos
RETRY_DELAY: 30000               // 30s entre tentativas
CACHE_TTL: 6 * 60 * 60           // 6h de cache

// Reports Worker
MAX_CONCURRENT: 3                 // Relatórios simultâneos
BATCH_SIZE: 10                   // Agendamentos por lote
REPORT_TIMEOUT: 300000           // 5min timeout

// Cache Cleanup Worker
BATCH_SIZE: 100                  // Keys por lote
BATCH_DELAY: 100                 // ms entre lotes
MAX_SCAN_COUNT: 10000            // Máx keys para scan
```

### **Métricas Coletadas**

- **Throughput**: Jobs/hora por fila
- **Failure Rate**: % de jobs falhados
- **Memory Usage**: Uso de memória Redis
- **Execution Time**: Tempo médio de execução
- **Queue Health**: Status de saúde das filas

---

## 🚨 Monitoramento e Alertas

### **Bull Board Dashboard**

- **URL**: `http://localhost:3000/api/admin/queues`
- **Recursos**:
  - Visualização em tempo real das filas
  - Controle manual de jobs (retry, delete)
  - Estatísticas de performance
  - Logs detalhados de execução
  - Controle de pausar/resumir filas

### **Health Checks**

```typescript
// Health check individual por worker
await syncWorkerHealthCheck()
await reportsWorkerHealthCheck()
await cacheCleanupWorkerHealthCheck()

// Health check sistema completo
await systemHealthCheck()
```

### **Logs**

```bash
# Logs por worker
logs/workers/sync-worker.log
logs/workers/reports-worker.log
logs/workers/cache-cleanup-worker.log

# PIDs dos processos
pids/sync-worker.pid
pids/reports-worker.pid
pids/cache-cleanup-worker.pid
```

---

## 🛠️ Desenvolvimento e Debug

### **Modo Debug**

```bash
# Habilitar logs detalhados
DEBUG=true npm run workers:start

# Ver logs em tempo real
npm run workers:logs sync-worker
```

### **Testes Locais**

```bash
# Testar conexão Redis
npm run workers:status

# Executar job manualmente via API
curl -X POST http://localhost:3000/api/admin/workers \\
  -d '{"type": "sync-manual", "data": {"workspaceId": "test"}}'

# Limpar filas para teste
curl -X DELETE http://localhost:3000/api/admin/workers
```

### **Troubleshooting**

**Redis não conecta:**
```bash
# Verificar se Redis está rodando
redis-cli ping

# Iniciar Redis manualmente
redis-server
```

**Workers não iniciam:**
```bash
# Verificar PIDs antigos
npm run workers:status

# Parar todos os processos
npm run workers:stop

# Reiniciar
npm run workers:start
```

**Performance lenta:**
```bash
# Ver stats detalhadas
curl http://localhost:3000/api/admin/workers?action=detailed-stats

# Verificar uso de memória Redis
redis-cli info memory
```

---

## 📋 Próximos Passos

### **Melhorias Planejadas**

- [ ] Integração com serviços de email (SendGrid/Resend)
- [ ] Integração com WhatsApp Business API
- [ ] Dashboard React para monitoramento
- [ ] Sistema de alertas por Slack/Discord
- [ ] Métricas avançadas com Prometheus
- [ ] Clustering Redis para alta disponibilidade
- [ ] Auto-scaling baseado em carga
- [ ] Backup automático de jobs críticos

### **Integrações**

- [ ] Sistema de notificações push
- [ ] Webhook notifications para jobs
- [ ] Integração com Datadog/New Relic
- [ ] Export de métricas para dashboards externos
- [ ] Sistema de rollback para jobs críticos

---

## 🔐 Segurança

### **Autenticação**

- Bull Board protegido por token de acesso
- APIs de controle requerem autenticação
- Logs não expõem dados sensíveis
- Isolamento por workspace

### **Boas Práticas**

- Jobs idempotentes (podem ser executados múltiplas vezes)
- Timeout configuráveis para evitar jobs infinitos
- Rate limiting nas APIs externas
- Cleanup automático de dados sensíveis
- Backup de jobs críticos antes da execução

---

*Documentação atualizada em: 14/09/2025*
*Versão: 1.0 - Sistema completo implementado*