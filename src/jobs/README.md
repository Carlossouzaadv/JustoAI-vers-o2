# JUDIT Jobs System

Sistema de jobs agendados para verificação automática de processos na API JUDIT.

---

## 📁 Estrutura

```
src/jobs/
├── dailyJuditCheck.ts    # Cron job de verificação diária
├── scheduler.ts          # Agendador de jobs
└── README.md            # Esta documentação
```

---

## 🚀 Como Usar

### 1. Configurar Ambiente

Adicione ao seu `.env.local`:

```bash
JUDIT_API_KEY=sua-chave-aqui
JUDIT_REQUESTS_URL=https://requests.prod.judit.io
JUDIT_TRACKING_URL=https://tracking.prod.judit.io
```

### 2. Adicionar Scripts ao package.json

```json
{
  "scripts": {
    "jobs:start": "ts-node src/jobs/scheduler.ts",
    "jobs:daily-check": "ts-node src/jobs/dailyJuditCheck.ts",
    "jobs:manual": "ts-node -e \"require('./src/jobs/scheduler').runJobManually('Daily JUDIT Check').then(console.log).catch(console.error)\""
  }
}
```

### 3. Executar

#### Iniciar Scheduler (modo contínuo)
```bash
npm run jobs:start
```

Isso iniciará o scheduler que executará os jobs nos horários configurados:
- **Daily JUDIT Check**: 2:00 AM todos os dias

#### Executar Manualmente (teste)
```bash
npm run jobs:daily-check
```

Executa a verificação diária imediatamente, sem esperar o horário agendado.

---

## ⚙️ Configurações

### Daily JUDIT Check

Configurações em `dailyJuditCheck.ts`:

```typescript
const CRON_CONFIG = {
  BATCH_SIZE: 50,              // Processos por lote
  CONCURRENT_CHECKS: 5,        // Verificações paralelas
  BATCH_DELAY_MS: 2000,        // Delay entre lotes
  LOOKBACK_HOURS: 24,          // Buscar mudanças nas últimas 24h
  MAX_RETRIES_PER_PROCESS: 2,  // Retries por processo
  RETRY_DELAY_MS: 3000,        // Delay entre retries
};
```

### Scheduler

Horário do cron em `scheduler.ts`:

```typescript
{
  name: 'Daily JUDIT Check',
  schedule: '0 2 * * *',  // 2:00 AM todos os dias
  enabled: true,
}
```

**Formato do schedule (cron):**
```
* * * * *
│ │ │ │ │
│ │ │ │ └─ Dia da semana (0-7, 0 e 7 = Domingo)
│ │ │ └─── Mês (1-12)
│ │ └───── Dia do mês (1-31)
│ └─────── Hora (0-23)
└───────── Minuto (0-59)
```

**Exemplos:**
- `0 2 * * *` - 2:00 AM todos os dias
- `0 */6 * * *` - A cada 6 horas
- `0 9 * * 1` - Segunda-feira às 9:00 AM
- `*/30 * * * *` - A cada 30 minutos

---

## 🔄 Fluxo do Daily Check

```
1. Buscar monitoramentos ativos
   ↓
2. Dividir em lotes (50 processos/lote)
   ↓
3. Para cada lote:
   a. Processar com concorrência (5 paralelos)
   b. Verificar tracking na JUDIT (GET /tracking/{id}/responses)
   c. Filtrar por timestamp (últimas 24h)
   ↓
4. Se houver novos andamentos:
   a. Extrair textos das movimentações
   b. [TODO] Analisar se precisa buscar anexos (IA)
   c. Atualizar Processo no banco
   ↓
5. Log de estatísticas finais
```

---

## 📊 Logs

Todos os logs incluem timestamp ISO 8601:

```
[2025-01-10T02:00:00.000Z] [DAILY JUDIT CHECK] INICIANDO VERIFICAÇÃO DIÁRIA JUDIT
[2025-01-10T02:00:01.234Z] [DAILY JUDIT CHECK] Encontrados 150 monitoramentos ativos
[2025-01-10T02:00:01.567Z] [DAILY JUDIT CHECK] >>> Lote 1/3 (50 processos)
[2025-01-10T02:00:15.890Z] [DAILY JUDIT CHECK] Progresso: 50/150 (33.3%) - Novos andamentos: 12
...
[2025-01-10T02:02:30.456Z] [DAILY JUDIT CHECK ✓] VERIFICAÇÃO DIÁRIA CONCLUÍDA
[2025-01-10T02:02:30.457Z] [DAILY JUDIT CHECK] Estatísticas: {
  total: 150,
  successful: 148,
  failed: 2,
  withNewMovements: 35,
  successRate: "98.7%",
  duration: "2.50 min"
}
```

---

## 🛡️ Tratamento de Erros

### Retry Logic
- **Por processo**: até 2 retries com delay de 3s
- **Erros não-fatais**: processo marcado como falha, mas continua com os outros
- **Erros críticos**: scheduler captura e loga, mas não para outros jobs

### Rate Limiting
- **Batch delay**: 2s entre lotes
- **Concurrent checks**: máximo 5 verificações paralelas
- **Rate limiter**: integrado no JuditAPIClient

---

## 📈 Performance

### Alto Volume (1000+ processos)

Com as configurações padrão:
- **Batch size**: 50
- **Concurrent checks**: 5
- **Batch delay**: 2s

**Estimativa de tempo:**
- 1000 processos = 20 lotes
- ~2.5s por lote (5 processos paralelos × 0.5s cada)
- ~2s delay entre lotes
- **Total**: ~1.5 minutos

### Otimizações Possíveis

Para 5000+ processos:
```typescript
BATCH_SIZE: 100,
CONCURRENT_CHECKS: 10,
BATCH_DELAY_MS: 1000,
```

---

## 🧪 Testes

### Teste Manual (Single Process)

```typescript
import { setupProcessMonitoring, checkTrackingUpdates } from '@/lib/services/juditMonitoringService';

// Configurar monitoramento
const result = await setupProcessMonitoring('1234567-12.2023.8.09.0001');
console.log('Setup:', result);

// Verificar updates
const timestamp = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const updates = await checkTrackingUpdates(result.trackingId!, timestamp);
console.log('Updates:', updates);
```

### Teste de Carga

```bash
# Criar 100 monitoramentos de teste
npm run db:seed -- --monitoring-test 100

# Executar daily check
npm run jobs:daily-check
```

---

## 🔧 Manutenção

### Parar Job em Execução

```bash
# Se executando em modo standalone
Ctrl + C
```

### Desabilitar Job Temporariamente

Em `scheduler.ts`:
```typescript
{
  name: 'Daily JUDIT Check',
  schedule: '0 2 * * *',
  enabled: false,  // ← Mudar para false
}
```

### Monitorar Execução

Logs são escritos em `stdout/stderr`. Para salvar em arquivo:

```bash
npm run jobs:start > logs/scheduler.log 2>&1
```

---

## 📦 Dependências

- `node-cron` - Agendamento de jobs
- `@prisma/client` - Acesso ao banco
- `lib/judit-api-client` - Cliente JUDIT

---

## 🚀 Próximos Passos

1. **Análise de Anexos com IA** (próximo prompt)
   - Detectar quando buscar anexos baseado nos textos
   - Usar Gemini para análise inteligente

2. **Notificações**
   - Email quando houver falhas
   - Slack/Discord para resumo diário
   - Webhook para integrações

3. **Dashboard**
   - UI para visualizar jobs
   - Logs em tempo real
   - Estatísticas históricas

4. **Métricas**
   - Prometheus metrics
   - Grafana dashboards
   - Alerting

---

## 📞 Suporte

Para problemas ou dúvidas:
1. Verifique os logs
2. Teste manualmente com `npm run jobs:daily-check`
3. Verifique se `JUDIT_API_KEY` está configurada
4. Confirme que há monitoramentos ativos no banco
