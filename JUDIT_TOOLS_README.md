# JustoAI JUDIT Analysis Tools

**Ferramentas de análise de consumo JUDIT, pricing e unit economics**

---

## 📦 O Que Você Tem

Criei 3 scripts + 2 relatórios para ajudar na análise de negócio:

### Scripts (em `scripts/`)

1. **`judit-consumption-report.js`** - Relatório de consumo JUDIT
2. **`pricing-analysis.js`** - Análise de pricing e custos
3. **`dynamic-pricing-calculator.js`** - Calculadora interativa

### Relatórios (na raiz do projeto)

1. **`JUDIT_ANALYSIS_REPORT.md`** - Relatório executivo completo
2. **`pricing-analysis.json`** - Dados estruturados para importar

---

## 🚀 Como Usar Cada Ferramenta

### 1️⃣ Consumo JUDIT (Semanal/Mensal)

```bash
node scripts/judit-consumption-report.js
```

**O que faz:**
- Busca dados reais de consumo da API JUDIT
- Gera relatório técnico com métricas
- Exporta JSON com todos os detalhes
- Identifica padrões de uso

**Saída:**
- Relatório visual no console
- `judit-report-YYYY-MM-DD.json` (importável)

**Quando usar:**
- ✅ Toda semana para monitorar consumo
- ✅ Antes de reunião com CFO
- ✅ Para validar que sistema está estável

---

### 2️⃣ Análise de Pricing (Uma vez, quando definir planos)

```bash
node scripts/pricing-analysis.js
```

**O que faz:**
- Mapeia Planos A/B → Custos JUDIT
- Calcula preços para diferentes margens (50%-80%)
- Gera projeções e LTV
- Valida unit economics

**Saída:**
- 3 relatórios no console:
  - 🔬 Técnico (para Product)
  - 💰 Financeiro (para CFO)
  - 📈 Executivo (para CMO/Pitch)
- `pricing-analysis.json` (para referência)

**Quando usar:**
- ✅ Ao definir preços iniciais
- ✅ Quando mudar custo JUDIT
- ✅ Para validar números com CFO

---

### 3️⃣ Calculadora Dinâmica (Interactive - Sempre que tiver dúvida)

```bash
node scripts/dynamic-pricing-calculator.js
```

**O que faz:**
- Menu interativo com 6 calculadoras
- Responde: "E se cobrar R$ X?"
- Calcula LTV, CAC, margem
- Projeta receita com múltiplos cenários

**Menu:**
```
1. Calcular preço por margem desejada
2. Calcular margem de um preço específico
3. Projetar receita (X clientes, Y meses)
4. Calcular LTV e CAC
5. Comparar cenários (Plano A vs B)
6. Ver dados base
```

**Exemplos de uso:**
```bash
# Você quer 70% margem no Plano A?
# Responde: 70, A
# Resultado: Preço sugerido é R$ 496.37/mês

# Você quer cobrar R$ 1.000/mês no Plano B?
# Resposta: 1000, B
# Resultado: Margem é 32.8%, lucro é R$ 553.27

# Você quer 10 clientes (6 Plano A + 4 Plano B) em 12 meses?
# Responde dados e vê projeção de receita total
```

**Quando usar:**
- ✅ Toda vez que tiver uma pergunta de pricing
- ✅ Durante presales (cliente quer negociar)
- ✅ Para responder rápido ao CFO

---

## 📊 Fluxo Recomendado

### Semana 1 (Agora)
```
1. Rodar pricing-analysis.js
   → Define preços base (70% margem)
   → Valida com CFO

2. Ler JUDIT_ANALYSIS_REPORT.md
   → Entender números
   → Preparar pitch
```

### Toda Semana (Going Forward)
```
1. Rodar judit-consumption-report.js
   → Monitorar consumo
   → Identificar padrões
   → Atualizar projeções
```

### Quando Precisar Responder Rápido
```
1. Abrir dynamic-pricing-calculator.js
   → Simular cenários
   → Responder "E se?"
   → Validar números na hora
```

---

## 💰 Quick Reference: Pricing Base

**Com 70% de Margem (RECOMENDADO):**

| Plano | Custo/mês | Preço/mês | Lucro/mês | LTV 3-anos |
|-------|-----------|-----------|-----------|-----------|
| A | R$ 148.91 | **R$ 496.37** | R$ 347.46 | R$ 12.508 |
| B | R$ 446.73 | **R$ 1.489.10** | R$ 1.042.37 | R$ 37.525 |

**Com 50% de Margem (Market Penetration):**

| Plano | Preço/mês | Lucro/mês |
|-------|-----------|-----------|
| A | R$ 297.82 | R$ 148.91 |
| B | R$ 893.46 | R$ 446.73 |

---

## 🔧 Customizar para Seus Dados

Se seus custos JUDIT mudarem, edite:

**`scripts/pricing-analysis.js`** - Linha 10-15:
```javascript
const REAL_CONSUMPTION = {
  totalCost: 352.80,  // ← Seu custo total
  totalRequests: 616,  // ← Total de requisições
  ...
};
```

**`scripts/dynamic-pricing-calculator.js`** - Linha 30-40:
```javascript
const PLANS = {
  A: {
    costPerMonth: 148.91,  // ← Seu custo mensal
    requisicoesPerMonth: 260,
  },
  ...
};
```

---

## 📈 Integração com Backend (Next Step)

Para análise ainda melhor, você precisa:

1. **Adicionar tracking no backend** quando faz requisição JUDIT:
   ```javascript
   // Quando você chama JUDIT API:
   log({
     userId: req.user.id,
     projectId: req.project.id,
     requestType: 'lawsuit_cnj',
     hasAttachments: true,
     cost: 3.80,
     timestamp: new Date()
   });
   ```

2. **Criar dashboard que mostra:**
   - Consumo por usuário
   - Consumo por projeto
   - Trending (crescimento 7d, 30d)
   - Alertas se exceder limite do plano

3. **Implementar sistema de créditos:**
   - Cada plano tem limite (Plano A = 260 req/mês)
   - Se exceder, cobrança extra (R$ 0.60/req?)
   - Alertas quando próximo do limite

---

## 🎯 Próximos Passos

### Imediato (Hoje)
- [ ] Revisar `JUDIT_ANALYSIS_REPORT.md`
- [ ] Testar `dynamic-pricing-calculator.js`
- [ ] Validar números com CFO

### Curto Prazo (1 semana)
- [ ] Apresentar ao CMO (use números do relatório)
- [ ] Validar pricing com cliente-piloto
- [ ] Ajustar preço baseado em feedback

### Médio Prazo (1 mês)
- [ ] Implementar tracking de consumo por usuário
- [ ] Criar dashboard de analytics
- [ ] Sistema de alertas de limite

### Longo Prazo (2+ meses)
- [ ] Sistema de billing integrado
- [ ] Cobrar overflow (cliente excede plano)
- [ ] Criar Plano C (Enterprise, custom)

---

## 📞 Perguntas Frequentes

**P: Posso mudar os preços depois?**
R: Sim! Use a calculadora para simular. Clientes existentes podem ter preço grandfather (grandfathered).

**P: E se JUDIT aumentar o custo?**
R: Rode o `pricing-analysis.js` novamente com novo custo. Seus preços podem subir, mas com aviço prévio aos clientes.

**P: Como projeta crescimento?**
R: Use `dynamic-pricing-calculator.js` → Opção 3 (Projetar Receita). Digite quantos clientes, meses, preços.

**P: Qual margem usar?**
R: 70% é balanceado. Mas:
- 50% = crescimento rápido, margem baixa
- 70% = sustentável, recomendado
- 80% = premium, só com muito value add

**P: E se quisermos cobrar por uso (variable)?**
R: Adicione: R$ 0.80 por requisição extra fora do plano. Calcule: `(requisições_extras × 0.80) + plano_mensal`.

---

## 📞 Suporte

Se tiver dúvidas, rotas essas ferramentas primeiro. Se ainda tiver dúvida, chame o Claude Code:
```bash
# "Como calcular ROI se eu gastar R$ 5.000 em CAC?"
# → Usa calculadora, opção 4
```

---

**Última atualização:** 27 de Outubro de 2025
