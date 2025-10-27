# Admin Dashboard - JUDIT API Consumption

**Dashboard interno para análise de consumo JUDIT, pricing e unit economics**

---

## 🎯 Objetivo

Este dashboard foi criado para **3 públicos principais:**

### Para Você (Product/Tech)
- 📊 Monitorar consumo real da API JUDIT
- 🔍 Identificar padrões de uso (qual tipo de busca é mais usado?)
- 💡 Validar estabilidade da integração (100% sucesso?)
- 📈 Base para decisões técnicas (caching, otimizações)

### Para CFO
- 💰 Visualizar custos reais da operação
- 📉 Projetar escalabilidade (custo com 10, 50, 100 clientes?)
- 🎯 Validar pricing (margem de 70% é viável?)
- 📋 Dados para decisões financeiras

### Para CMO
- 📊 Números para pitch (616 requisições, 100% sucesso)
- 🚀 Validar que feature funciona (92% usam autos processuais)
- 💡 Argumentos de venda ("economiza 2-3h por analista")
- 📈 KPIs para marketing (cost per analysis, ROI)

---

## 🚀 Acesso

**URL:** `https://seu-dominio.com/admin/dashboard/judit`

**Proteção:**
- ✅ Autenticação Supabase obrigatória
- ✅ Redireciona para login se não autenticado
- ✅ Apenas usuários logados podem acessar

---

## 📊 O Que Você Vê

### 1. **Métricas Principais**
```
┌──────────────────────┬─────────────┬────────────┬──────────────┐
│ Total Requisições    │ Taxa Sucesso│ Custo Total│ Custo Médio  │
├──────────────────────┼─────────────┼────────────┼──────────────┤
│ 616                  │ 100%        │ R$ 352.80  │ R$ 0.57      │
└──────────────────────┴─────────────┴────────────┴──────────────┘
```

### 2. **Gráficos**
- **Por Origem:** Pie chart mostrando API vs Tracking
- **Por Tipo de Busca:** Bar chart com lawsuit_cnj vs lawsuit_attachment
- **Detalhamento de Custos:** API + Tracking + Attachments

### 3. **Calculadora Interativa**
- Selecione: Plano A ou B
- Mude a margem: Slider de 10% a 90%
- Veja instantaneamente:
  - Preço mensal
  - Lucro por mês/ano
  - Viabilidade

---

## 🔧 Como Funciona

### Backend (`src/app/api/admin/judit-consumption/route.ts`)

```
GET /api/admin/judit-consumption
├─ Verifica autenticação Supabase
├─ Busca dados de JUDIT (últimos 10 dias)
├─ Analisa e calcula custos
└─ Retorna JSON com relatório
```

**Cache:** 1x por dia (pode ser atualizado com botão "Refresh")

### Frontend (`src/app/admin/dashboard/judit/page.tsx`)

- ✅ Componente React com Recharts
- ✅ Fetch automático de dados
- ✅ Gráficos interativos
- ✅ Calculadora de pricing em tempo real
- ✅ Responsivo (mobile + desktop)

### Proteção (`src/app/admin/layout.tsx`)

- Verifica sessão Supabase antes de renderizar
- Redireciona para `/login` se não autenticado
- Layout consistent para todas as rotas `/admin/*`

---

## 📈 Como Usar

### 1. Acessar o Dashboard
```
1. Faça login em seu app
2. Acesse: /admin/dashboard/judit
3. Veja dados em tempo real
```

### 2. Atualizar Dados
```
Clique no botão "Atualizar" para forçar refresh
(Busca dados mais recentes da API JUDIT)
```

### 3. Calcular Preços
```
1. Clique "Calculadora de Preço"
2. Escolha: Plano A ou B
3. Mude slider de margem (50%-80%)
4. Veja preço sugerido instantaneamente
```

---

## 🔐 Segurança

### Autenticação
- ✅ Verifica session Supabase
- ✅ Redireciona não-autenticados
- ✅ Valida token em cada requisição

### API Key
- ✅ JUDIT_API_KEY armazenada em `.env` (server-side only)
- ✅ Nunca exposto ao cliente
- ✅ Chamadas apenas do servidor

### Acesso
- ✅ Qualquer usuário autenticado pode ver (por enquanto)
- **TODO:** Adicionar role-based access (admin only)

---

## 🛠️ Customização

### Mudar Período de Análise

**Arquivo:** `src/app/api/admin/judit-consumption/route.ts`

```typescript
// Linha ~200, função GET:
const endDate = new Date();
const startDate = new Date(endDate.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 dias

// Mude para 30 dias:
const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
```

### Adicionar Mais Métricas

**Arquivo:** `src/app/admin/dashboard/judit/page.tsx`

Adicione mais `MetricCard` ou gráficos:

```tsx
<MetricCard
  title="Sua Métrica"
  value={report.seuCampo}
  icon="🚀"
/>
```

### Mudar Cores dos Gráficos

**Arquivo:** `src/app/admin/dashboard/judit/page.tsx`

```typescript
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
// Altere para cores que preferir
```

---

## 📊 Dados Retornados pela API

```json
{
  "success": true,
  "data": {
    "period": {
      "start": "2025-10-17",
      "end": "2025-10-27",
      "days": 10
    },
    "totalRequests": 616,
    "completedRequests": 616,
    "failedRequests": 0,
    "successRate": 100,
    "totalCost": 352.80,
    "avgCostPerRequest": 0.57,
    "byOrigin": {
      "api": 616,
      "tracking": 0
    },
    "bySearchType": {
      "lawsuit_attachment": 568,
      "lawsuit_cnj": 48
    },
    "costBreakdown": {
      "apiRequests": 184.80,
      "trackingRequests": 0.00,
      "attachments": 168.00,
      "total": 352.80
    },
    "cachedAt": "2025-10-27T10:40:05.123Z"
  },
  "fromCache": false
}
```

---

## 🚀 Radar: Próximas Melhorias

### ✅ Fase 1: Foundation (Semana 1)
**Status:** Pronto (versão básica deployed)

- [x] Endpoint `/api/admin/judit-consumption`
- [x] Dashboard visual com gráficos
- [x] Calculadora interativa de pricing
- [x] Autenticação Supabase
- [x] Documentação

**Próximo:** Testar em produção

---

### 🔄 Fase 2: Segurança & Performance (Semana 1-2)

#### Role-Based Access Control
- [ ] Restringir acesso apenas para `admin` role
- [ ] Implementar verificação de role no layout.tsx
- [ ] Retornar 403 Forbidden se não admin
- [ ] Log de quem acessou quando

#### Caching em Banco de Dados
- [ ] Criar tabela `admin_cache` em Prisma
- [ ] Salvar resposta JUDIT com timestamp
- [ ] Retornar cache se < 24h
- [ ] Endpoint para forçar invalidação de cache

#### Performance
- [ ] Medir tempo de resposta da API
- [ ] Adicionar timeout (5s) na requisição JUDIT
- [ ] Rate limiting (max 1 req/min por usuário)

---

### 📊 Fase 3: Analytics Avançada (Semana 2-3)

#### Histórico & Trending
- [ ] Tabela `judit_consumption_history` para armazenar snapshots diários
- [ ] Gráfico de 30 dias (tendência de consumo)
- [ ] Comparação período-a-período (MoM)
- [ ] Detecção de anomalias (picos de consumo)

#### Análise por Usuário/Projeto
- [ ] Rastrear `userId` e `projectId` em cada requisição JUDIT
- [ ] Tabela `judit_requests` com granularidade
- [ ] Endpoint `/api/admin/judit/by-user`
- [ ] Endpoint `/api/admin/judit/by-project`
- [ ] Dashboard segmentado (filtros)

#### Projeções
- [ ] Calcular trending (consumo cresce 5%/semana?)
- [ ] Projetar custo de 3/6/12 meses
- [ ] Alertar se projeção ultrapassa orçamento
- [ ] Recomendações de otimização

---

### 🎯 Fase 4: Business Intelligence (Semana 3-4)

#### Alertas & Notifications
- [ ] Alerta se consumo > limite do plano
- [ ] Notificação se taxa de erro sobe
- [ ] Email para CFO se custo ultrapassa threshold
- [ ] Webhook para Slack/Discord

#### Exportação & Relatórios
- [ ] Botão "Exportar PDF" (relatório executivo)
- [ ] Botão "Exportar CSV" (dados brutos)
- [ ] Email com relatório automático (1x/semana)
- [ ] Dashboard de relatórios agendados

#### Integração com Billing
- [ ] Sincronizar consumo com sistema de créditos
- [ ] Calcular overflow (cliente excede limite)
- [ ] Sugerir upgrade (cliente atingiu 80% do plano)
- [ ] Auto-provisioning de recursos

---

### 🔮 Fase 5: Future (1+ mês)

#### ML & Recomendações
- [ ] ML: Prever consumo futuro
- [ ] Recomendar tamanho ideal de plano
- [ ] Identificar clientes em risco de churn
- [ ] Optimizações automáticas

#### Integração com Produto
- [ ] Mostrar consumo real no app do usuário
- [ ] Avisos quando próximo do limite
- [ ] Upsell automático para plano superior
- [ ] Dashboard de consumo para cliente (white-labeled)

#### Multi-Tenant
- [ ] Admin dashboard por workspace
- [ ] Comparação entre clientes
- [ ] Benchmarking (seu consumo vs media)
- [ ] Insights por vertical/indústria

---

## 📋 Checklist de Validação

Antes de marcar como "completo", valide:

- [ ] Dashboard abre sem erros
- [ ] Gráficos mostram dados corretos
- [ ] Calculadora funciona (teste múltiplas margens)
- [ ] Botão "Atualizar" força novo fetch
- [ ] Autenticação funciona (teste sem login)
- [ ] URLs funcionam em produção
- [ ] Performance aceitável (< 2s carregamento)
- [ ] Mobile responsivo (teste em celular)
- [ ] Números batem com relatórios anteriores

---

## 🔧 Troubleshooting

### "Não autorizado" (401)
**Solução:** Faça login primeiro e tente novamente

### "Erro ao buscar dados"
**Solução:** Verifique se JUDIT_API_KEY está configurado em `.env`

### Dados desatualizados
**Solução:** Clique "Atualizar" para forçar refresh (ignora cache)

### Gráficos não aparecem
**Solução:** Certifique-se que Recharts está instalado:
```bash
npm install recharts
```

---

## 📞 Contato / Suporte

Se tiver dúvidas:
1. Verifique os logs em `console.log`
2. Abra as DevTools (F12) → Console
3. Verifique erros de rede (Network tab)

---

## 📝 Notas

- Dashboard é **read-only** (não modifica dados)
- Dados de JUDIT são **ler apenas** (não deleta nada)
- Ideal para monitoramento de consumo
- Não substitui analytics detalhados (adicione depois)

---

**Última atualização:** 27 de Outubro de 2025
**Versão:** 1.0
