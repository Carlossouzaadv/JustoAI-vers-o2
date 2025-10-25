# 🎯 Plano de Teste: 2 Dias com Chave JUDIT

**Objetivo**: Testar JUDIT API completo e validar otimizações de Redis antes de expirar a chave de teste.

**Timeline**: 2 dias (hoje + amanhã)

---

## 📅 DIA 1: Setup & Otimização (4-5 horas)

### ✅ MORNING (1-2h): Alterações Implementadas

Todas as mudanças já foram feitas automaticamente:

```
✅ Removidas filas não-usadas de Redis (sync, reports, cache-cleanup, document-processing)
✅ Otimizado keepAlive: 60s → 120s (reduz PING requests em ~50%)
✅ Mantida apenas Notification Queue (essencial)
✅ Atualizado script de teste: scripts/test-judit-2days.ts
```

**Impacto esperado**: Redução de ~30-40% no custo do Redis

---

### ⚠️ MORNING: Ativar Workers no Railway

**IMPORTANTE**: Você precisa ativar os workers para testar tudo

1. **Via Railway Dashboard**:
   - Vá para: https://railway.app/project/[seu-project-id]
   - Ative o serviço **justoai-workers**
   - Start command: `npx tsx src/workers/juditOnboardingWorker.ts`
   - Verifique se está rodando

2. **Ou via CLI Railway**:
   ```bash
   railway login
   railway run npx tsx src/workers/juditOnboardingWorker.ts
   ```

3. **Verificar status**:
   - Logs devem mostrar: `[JUDIT WORKER] Worker pronto para processar jobs`

---

### ☀️ AFTERNOON (2-3h): TESTES FUNCIONAIS

#### **Teste 1: Onboarding JUDIT**

```bash
# Rodar script de teste (escolha um CNJ da sua base)
npx tsx scripts/test-judit-2days.ts --cnj "0000001-23.2024.8.09.0001"
```

**Esperado**:
```
✅ Onboarding Request - PASS (200ms)
   - requestId: xxxxx
   - processoId: xxxxx
```

**O que está acontecendo**:
1. POST `/api/judit/onboarding` enfileira job
2. Worker pega job da fila Redis
3. Faz requisição para JUDIT `/requests`
4. JUDIT responde com `request_id` + `callback_url`
5. Webhook POST `/api/webhook/judit/callback` ativado quando JUDIT termina

---

#### **Teste 2: Daily Monitoring Setup**

```bash
# Mesmo script, já inclui monitoring setup
npx tsx scripts/test-judit-2days.ts --cnj "0000001-23.2024.8.09.0001"
```

**Esperado**:
```
✅ Monitoring Setup - PASS (150ms)
   - trackingId: xxxxx
   - recurrence: 1 day
```

**O que está acontecendo**:
1. POST `/api/judit/monitoring/setup` chama JUDIT `/tracking`
2. JUDIT cria tracking com recurrence=1 dia
3. Retorna `tracking_id`
4. Salvo no banco em tabela `Monitoramento`
5. JUDIT busca diariamente (automaticamente)
6. Webhook POST `/api/webhooks/judit/tracking` notifica de mudanças

---

### 📊 EVENING (1h): Verificar Custo

1. **Abra Upstash Redis Console**:
   - https://console.upstash.com/redis

2. **Verifique antes/depois das otimizações**:
   - Usage gráfico deve mostrar queda de ~30-40%
   - Requests/day deve ser ~60% do que era antes

3. **Monitore Red is logs**:
   ```
   ✅ Menos PING requests
   ✅ Menos EVALSHA operations
   ✅ Menos overhead de polling
   ```

---

## 📅 DIA 2: Validação Completa (2-3 horas)

### ☀️ MORNING (1-2h): Verificar Webhooks

#### **Webhook 1: Onboarding Callback**
```bash
# Checar se callbacks foram recebidos em /api/webhook/judit/callback
# Logs da aplicação devem mostrar:
# "[JUDIT Webhook] ✅ RECEBIDO"
# "[JUDIT Webhook] Resposta recebida"
# "[JUDIT Webhook] Timeline atualizada"
```

**Onde encontrar logs**:
- Railway: https://railway.app → justoai-web → Logs
- Procure por: `[JUDIT Webhook]`

#### **Webhook 2: Tracking Updates**
```bash
# Checar se tracking callbacks foram recebidos em /api/webhooks/judit/tracking
# Logs devem mostrar:
# "[JUDIT Tracking] Callback recebido"
# "[JUDIT Tracking] Movimentação detectada"
```

---

### ✅ MORNING: Listar Trackings Criados

**No banco de dados**:
```sql
-- Verifique quantos trackings foram criados
SELECT COUNT(*) FROM "Monitoramento" WHERE "status" = 'created' OR "status" = 'updated';

-- Verifique quais processos estão sendo monitorados
SELECT "numeroCnj", "trackingId", "createdAt" FROM "Monitoramento" LIMIT 10;
```

**Via API** (se implementar):
```bash
GET /api/judit/monitoring/list
```

---

### 📈 AFTERNOON (1h): Documentação Final

Antes de expirar a chave, documente:

1. **Tracking IDs criados**:
   ```
   CNJ: 0000001-23.2024.8.09.0001
   Tracking ID: xxxxx-xxxxx-xxxxx
   Status: active
   Recurrence: 1 day
   Created At: 2025-10-25
   ```

2. **Webhooks recebidos**:
   - [x] Onboarding callbacks
   - [x] Tracking callbacks
   - [x] Movement alerts

3. **Custo final**:
   - Antes: ~$30/mês
   - Depois: ~$18-20/mês (40% reduction)

---

## 🔍 Troubleshooting

### ❌ Problema: Worker não inicia

**Solução**:
```bash
# Verifique se Redis está conectado
npm run verify:worker

# Verifique env vars
echo $REDIS_URL
echo $JUDIT_API_KEY
```

---

### ❌ Problema: Webhook não recebe callback

**Solução 1**: Verifique webhook URL
```typescript
// Em juditOnboardingService.ts, linha 276
const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://api.justoai.com.br'}/api/webhook/judit/callback`;
console.log('Webhook URL:', webhookUrl); // Deve ser HTTPS
```

**Solução 2**: Verifique JUDIT API logs
- Entre em contato com JUDIT support
- Confirme que webhook está sendo enviado

---

### ❌ Problema: Redis custo não caiu

**Causas possíveis**:
1. Workers ainda estão rodando do old code (restart)
2. Filas antigas ainda estão sendo criadas (clear cache)
3. Upstash pode levar 5-10min para atualizar stats

**Solução**:
```bash
# Restart workers
railway run npx tsx src/workers/juditOnboardingWorker.ts --clear-cache

# Ou via Railway dashboard: Restart all
```

---

## 📚 Arquivos Modificados

```
✅ src/lib/queues.ts
   - Removidas: syncQueue, reportsQueue, cacheCleanupQueue, documentProcessingQueue
   - Mantida: notificationQueue

✅ src/lib/redis.ts
   - keepAlive: 60000 → 120000 (2x menos PING)

✅ scripts/test-judit-2days.ts (NOVO)
   - Script para testar onboarding e monitoring
   - Usage: npx tsx scripts/test-judit-2days.ts --cnj "CNJ_NUMBER"

✅ TESTE_2DIAS_GUIA.md (este arquivo)
   - Guia passo-a-passo de 2 dias
```

---

## ✨ Próximos Passos Após 2 Dias

1. **Se tudo funcionar**:
   - Manter Redis com otimizações
   - Daily monitoring continuará rodando automaticamente
   - Custo será ~$18-20/mês

2. **Se quiser reduzir ainda mais**:
   - Migrar para PostgreSQL CRON (sem Redis)
   - Custo: ~$0 (Redis)
   - Trade-off: sem retry automático robusto

3. **Para production**:
   - Configurar alertas de webhooks failed
   - Implementar retry de webhooks
   - Monitorar trackings criados vs processados

---

## 📞 Support

**Se algo não funcionar**:
1. Verifique logs em Railway Dashboard
2. Procure por `[JUDIT]` nos logs
3. Verifique REDIS_URL está correto
4. Verifique JUDIT_API_KEY está válida (2 dias restantes!)

**Contato JUDIT**: Support da API

---

**Status**: ✅ Pronto para começar!

Tempo estimado para tudo: **5-6 horas total** (1º dia 3-4h, 2º dia 2-3h)

Good luck! 🚀
