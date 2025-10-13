# 📊 JUDIT Monitoring Dashboard

Dashboard interativo em tempo real para monitoramento completo da integração JUDIT.

![Dashboard Status](https://img.shields.io/badge/status-production%20ready-green)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)
![React](https://img.shields.io/badge/React-18.x-blue)
![Next.js](https://img.shields.io/badge/Next.js-14.x-black)

---

## 🚀 Quick Start

### 1. Acessar Dashboard

```
http://localhost:3000/dashboard/judit
```

### 2. Funcionalidades Principais

✅ **Health Status** - Status em tempo real de todos os componentes
✅ **Key Metrics** - API calls, latência, custos, alertas
✅ **Gráficos Interativos** - Custos, breakdown, latências
✅ **Alertas** - Tabela interativa com resolução em lote
✅ **Filtros** - Por período (7/30/90 dias ou customizado)
✅ **Exportação** - Relatórios em CSV/JSON
✅ **Auto-refresh** - Dados atualizados automaticamente

---

## 📸 Screenshots

### Health Status Dashboard
```
┌─────────────────────────────────────────────────────────┐
│ System Status: Healthy ✓                                │
│ All systems operational                                  │
│                                                          │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐      │
│ │   API   │ │  Queue  │ │  Costs  │ │ Alerts  │      │
│ │ healthy │ │ healthy │ │ healthy │ │ warning │      │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘      │
└─────────────────────────────────────────────────────────┘
```

### Key Metrics
```
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Total Calls │ │ Avg Latency │ │ Total Cost  │ │   Alerts    │
│    1,250    │ │   1,450ms   │ │  R$ 834.50  │ │      2      │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
```

---

## 🎯 Principais Visualizações

### 1. Costs Over Time
Gráfico de linha mostrando:
- Custo diário (eixo esquerdo)
- Número de operações (eixo direito)
- Tooltip com detalhes ao passar o mouse
- **Uso**: Identificar picos de custo

### 2. Cost Breakdown
Gráfico de pizza mostrando:
- Distribuição por tipo de operação
- Percentuais visuais
- Custo total e médio por tipo
- **Uso**: Entender onde o dinheiro está sendo gasto

### 3. API Latency Distribution
Gráfico de barras mostrando:
- Min, P50, Média, P95, P99, Max
- Identificação de outliers
- **Uso**: Detectar problemas de performance

### 4. Alerts Table
Tabela interativa com:
- Seleção múltipla (checkboxes)
- Filtros por severidade
- Ações em lote (resolver múltiplos)
- Auto-refresh (15s)
- **Uso**: Gerenciar alertas ativos

---

## 🔄 Auto-Refresh

| Componente | Intervalo | Pausável |
|-----------|-----------|----------|
| Health Status | 30s | ✓ |
| Metrics | 30s | ✓ |
| Costs | 60s | ✓ |
| Alerts | 15s | ✓ |

**Dica**: O React Query gerencia automaticamente o cache e refetch inteligente.

---

## 📂 Filtros

### Período
- **Últimos 7 dias** - Visão recente
- **Últimos 30 dias** ⭐ (Padrão) - Visão mensal
- **Últimos 90 dias** - Visão trimestral
- **Customizado** - Escolha data inicial e final

### Tipo de Operação
- Todos (padrão)
- Onboarding
- Monitoramento
- Busca de Anexos
- Busca Manual

**Exemplo de uso**:
```
Filtro: Últimos 30 dias + Onboarding
Resultado: Vê custos apenas de operações de onboarding do último mês
```

---

## 📥 Exportação

### Formato CSV
```csv
RESUMO
totalCost,834.50
searchCost,690.00
attachmentsCost,144.50

BREAKDOWN POR TIPO
Tipo,Quantidade,Custo Total,Custo Médio
ONBOARDING,50,500.00,10.00
MONITORING_CHECK,950,334.50,0.35

CUSTOS DIÁRIOS
Data,Custo,Operações
2025-01-01,25.50,30
2025-01-02,28.75,35
```

### Formato JSON
```json
{
  "summary": {
    "totalCost": 834.50,
    "projectedMonthlyCost": 834.50,
    "costTrend": "stable"
  },
  "breakdown": [...],
  "dailyCosts": [...]
}
```

**Nome do arquivo**: `judit-costs-report-2025-01-10.csv`

---

## 🎨 Cores e Indicadores

### Status de Saúde
- 🟢 **Healthy** (verde) - Tudo funcionando
- 🟡 **Degraded** (amarelo) - Atenção necessária
- 🔴 **Unhealthy** (vermelho) - Ação imediata

### Severidade de Alertas
- 🔴 **CRITICAL** - Crítico
- 🟠 **HIGH** - Alto
- 🟡 **MEDIUM** - Médio
- 🔵 **LOW** - Baixo

---

## 💡 Casos de Uso

### 1. Monitoramento Diário (5 minutos)
1. Abra o dashboard
2. Verifique health status (deve estar verde)
3. Confira alertas ativos (resolva os críticos)
4. Olhe custo do dia
5. **Ação**: Resolver alertas se houver

### 2. Análise Semanal de Custos (15 minutos)
1. Filtre "Últimos 7 dias"
2. Veja gráfico de custos
3. Analise breakdown por tipo
4. Compare com semana anterior
5. **Ação**: Exportar relatório CSV

### 3. Troubleshooting de Performance (20 minutos)
1. Veja métricas de latência
2. Identifique se P95/P99 estão altos
3. Verifique error rate da API
4. Confira alertas relacionados
5. **Ação**: Investigar endpoints lentos

### 4. Relatório Mensal para Gestão (30 minutos)
1. Filtre "Últimos 30 dias"
2. Capture screenshot do dashboard
3. Exporte dados em CSV
4. Analise tendência de custos
5. **Ação**: Criar apresentação

---

## 🔧 Troubleshooting

### Dashboard não carrega

**Problema**: Página em branco ou erro

**Soluções**:
```bash
# 1. Verifique se APIs estão respondendo
curl http://localhost:3000/api/judit/observability/health

# 2. Verifique console do navegador (F12)
# Procure por erros em vermelho

# 3. Limpe cache do Next.js
rm -rf .next
npm run dev
```

### Dados não aparecem

**Problema**: Gráficos vazios

**Soluções**:
- Verifique se há operações no período filtrado
- Mude filtro para "Últimos 30 dias"
- Rode algumas operações JUDIT primeiro
- Verifique se database tem dados

### Gráficos não renderizam

**Problema**: Área vazia onde deveria ter gráfico

**Soluções**:
- Limpe cache do navegador (Ctrl+Shift+R)
- Tente outro navegador
- Verifique console por erros
- Reinstale dependências: `npm install`

### Exportação não funciona

**Problema**: Clique em exportar não faz nada

**Soluções**:
- Verifique permissões de download do navegador
- Tente exportar em outro formato (JSON → CSV)
- Verifique se há dados para exportar
- Desabilite bloqueadores de popup

---

## 📚 Componentes Técnicos

### Dependências
```json
{
  "recharts": "^2.x",
  "date-fns": "^3.x",
  "lucide-react": "^0.x",
  "@tanstack/react-query": "^5.x"
}
```

### Estrutura de Arquivos
```
src/
├── hooks/
│   └── useJuditObservability.ts      # React hooks para APIs
├── components/dashboard/
│   ├── DashboardCard.tsx             # Card container
│   ├── StatCard.tsx                  # Metric card
│   ├── HealthStatus.tsx              # Health display
│   ├── CostsChart.tsx                # Line chart
│   ├── CostBreakdownChart.tsx        # Pie chart
│   ├── LatencyChart.tsx              # Bar chart
│   ├── AlertsTable.tsx               # Interactive table
│   ├── DashboardFilters.tsx          # Filters
│   ├── ExportButton.tsx              # Export functionality
│   └── index.ts                      # Barrel export
└── app/dashboard/judit/
    └── page.tsx                       # Main dashboard page
```

---

## 🚢 Deploy em Produção

### Checklist

- [ ] Environment variables configuradas
- [ ] Database migrations aplicadas
- [ ] APIs de observabilidade acessíveis
- [ ] Redis rodando (para queue metrics)
- [ ] Build executado sem erros
- [ ] Dashboard acessível em produção
- [ ] Auto-refresh funcionando
- [ ] Exportação testada

### Build

```bash
# Build para produção
npm run build

# Iniciar
npm start

# Dashboard disponível em
# https://seu-dominio.com/dashboard/judit
```

---

## 📞 Suporte

### Documentação Completa
- `docs/JUDIT_DASHBOARD.md` - Documentação técnica completa
- `docs/JUDIT_MONITORING.md` - Sistema de observabilidade
- `OBSERVABILITY_SETUP.md` - Setup de monitoramento

### Issues
Se encontrar bugs ou tiver sugestões:
1. Verifique documentação primeiro
2. Verifique troubleshooting acima
3. Crie issue com detalhes e screenshots

---

## 🎯 Métricas de Sucesso

Dashboard deve ajudar a:
- ✅ Reduzir tempo de detecção de problemas em **80%**
- ✅ Diminuir custos da JUDIT em **96%** (via monitoramento inteligente)
- ✅ Resolver alertas **3x mais rápido** (ações em lote)
- ✅ Aumentar visibilidade para stakeholders

---

## 🔮 Futuras Melhorias

Planejado para próximas versões:
- [ ] Exportação em PDF
- [ ] Alertas via email/Slack do dashboard
- [ ] Comparação entre períodos
- [ ] Drilldown de métricas
- [ ] Anotações em gráficos
- [ ] Dashboards customizáveis
- [ ] Temas (claro/escuro)

---

**Status:** ✅ Production Ready
**Versão:** 1.0.0
**Última Atualização:** 2025-01-10
**Mantenedor:** JustoAI Team

---

*Desenvolvido com ❤️ para otimizar custos e melhorar observabilidade da integração JUDIT*
