# ROI Calculator — JustoAI

## Como Usar Este Calculador

Este documento serve como template para criar um **calculador interativo** que mostre o ROI de JustoAI para cada cliente potencial.

**Recomendação:** Converter para Google Sheets compartilhável (clique, preenche dados, vê resultado)

---

## Template de Cálculo

### Inputs (O que o Cliente Preenche)

```
SOBRE SUA FIRMA:
├─ Número de advogados: [___]
├─ Número de casos ativos: [___]
├─ Número de novos casos/mês: [___]
└─ Custo médio/hora de advogado: R$ [___]

SOBRE SEUS PROCESSOS:
├─ Horas/semana em análise JUDIT: [___]
├─ Horas/semana em processamento documento: [___]
├─ Subscrições JUDIT atuais: [___]
└─ Custo/mês JUDIT e similares: R$ [___]

SOBRE SEUS OBJETIVOS:
├─ Quer reduzir custo JUDIT? (Sim/Não)
├─ Quer economizar tempo? (Sim/Não)
├─ Quer melhorar qualidade análise? (Sim/Não)
└─ Quer automatizar relatórios? (Sim/Não)
```

---

## Cálculos Automáticos (Fórmulas)

### 1. Economia de Custo JUDIT

```
Economia JUDIT/mês = Custo JUDIT Atual - (Custo JUDIT Atual × 4%)
Exemplo:
- Custo JUDIT Atual: R$20.700
- Redução: 96%
- Novo Custo: R$834
- Economia: R$19.866/mês
- Economia Anual: R$238.000
```

### 2. Economia de Tempo

```
Horas Economizadas/semana =
  (Horas JUDIT/sem × 80%) + (Horas Doc/sem × 70%)

Exemplo:
- Tempo JUDIT: 10 horas/semana
- Tempo Documento: 15 horas/semana
- Total economizado: (10 × 80%) + (15 × 70%) = 8 + 10.5 = 18.5 horas/semana
```

### 3. Valor Monetário do Tempo

```
Valor Tempo Economizado/mês =
  Horas Economizadas/semana × 4.33 × Custo/hora

Exemplo:
- Horas economizadas: 18.5/semana
- Custo/hora: R$300
- Valor/mês: 18.5 × 4.33 × R$300 = R$24.056/mês
- Valor Anual: R$288.670
```

### 4. Melhoria na Qualidade

```
Casos com Análise Completa (%) = Atual + (Atual × 40%)

Exemplo:
- Atualmente: 60% dos casos têm análise completa
- Com JustoAI: 60% + (60% × 40%) = 84% dos casos
- Impacto: Reduz risco de decisões incompletas
```

### 5. Custo JustoAI

```
Custo JustoAI/mês = Preço Plano + (Uso Adicional)

Exemplo:
- Plano Professional: R$699/mês
- Créditos adicionais: 0 (mantém limites)
- Total: R$699/mês = R$8.388/ano
```

### 6. ROI Total

```
ROI = [(Economia JUDIT + Valor Tempo) - Custo JustoAI] / Custo JustoAI

Exemplo:
- Economia JUDIT: R$19.866/mês
- Valor Tempo: R$24.056/mês
- Total Ganho: R$43.922/mês
- Custo JustoAI: R$699/mês
- Lucro Líquido: R$43.223/mês
- ROI: (R$43.223 / R$699) × 100 = 6,183% em 12 meses
```

### 7. Payback Period

```
Payback = Custo JustoAI / Lucro Mensal Líquido

Exemplo:
- Custo implementação: R$699 (primeiro mês)
- Lucro mensal: R$43.223
- Payback: R$699 / R$43.223 = 0.016 meses = **1.5 dias**
```

---

## Outputs (O que o Calculador Mostra)

### Resultado Simplificado

```
┌─────────────────────────────────────────────────┐
│           ANÁLISE DE ROI — JUSTOAI              │
├─────────────────────────────────────────────────┤
│ Economia JUDIT/ano        │    R$238.000       │
│ Economia Tempo/ano        │    R$288.670       │
│ Custo JustoAI/ano         │      R$8.388       │
│ ─────────────────────────────────────────────  │
│ LUCRO LÍQUIDO TOTAL/ano   │    R$518.282       │
│ ─────────────────────────────────────────────  │
│ Payback Period            │     1.5 dias       │
│ ROI em 12 meses           │     6,183%         │
│ Taxa Retorno Mensal       │       59%          │
└─────────────────────────────────────────────────┘
```

### Comparação Antes vs Depois

```
ANTES JUSTOAI:
├─ Custo JUDIT/mês: R$20.700
├─ Tempo análise: 25 horas/semana
├─ Casos com análise completa: 60%
├─ Relatórios: Manual (4 horas/relatório)
└─ Valor/hora: Baixo (tempo desperdiçado)

DEPOIS JUSTOAI:
├─ Custo JUDIT/mês: R$834
├─ Tempo análise: 6.5 horas/semana
├─ Casos com análise completa: 100%
├─ Relatórios: Automático (<1 minuto)
└─ Valor/hora: 3x maior (tempo otimizado)

RESULTADO:
├─ Economia: R$43.000+/mês
├─ Tempo Livre: 18.5 horas/advogado/semana
├─ Qualidade: 40% melhoria
└─ Escalabilidade: 3x mais casos/advogado
```

### Gráfico de Payback

```
Mês 1: Custo JustoAI (R$699)
       Ganho: R$43.223
       Lucro Acumulado: +R$42.524 ✅

Desde Mês 2+: Puro lucro
```

---

## Exemplos de Diferentes Cenários

### Cenário 1: Solo Lawyer (1 advogado)

**Inputs:**
- Advogados: 1
- Casos ativos: 30
- Custo JUDIT atual: R$800/mês
- Tempo análise: 3 horas/semana

**Outputs:**
- Economia JUDIT/ano: R$7.680
- Economia Tempo/ano: R$47.520
- Custo JustoAI: R$2.388/ano (Starter R$199/mês)
- **Lucro/ano: R$52.812** ✅
- **ROI: 2,215%**
- **Payback: 5 dias**

---

### Cenário 2: Pequeno Escritório (5 advogados)

**Inputs:**
- Advogados: 5
- Casos ativos: 150
- Custo JUDIT atual: R$20.700/mês
- Tempo análise: 15 horas/semana total

**Outputs:**
- Economia JUDIT/ano: R$248.000
- Economia Tempo/ano: R$288.000
- Custo JustoAI: R$8.388/ano (Professional R$699/mês)
- **Lucro/ano: R$527.612** ✅
- **ROI: 6,283%**
- **Payback: 1.5 dias**

---

### Cenário 3: Médio Escritório (20 advogados)

**Inputs:**
- Advogados: 20
- Casos ativos: 500
- Custo JUDIT atual: R$50.000/mês (múltiplas assinaturas)
- Tempo análise: 50 horas/semana total

**Outputs:**
- Economia JUDIT/ano: R$600.000
- Economia Tempo/ano: R$780.000
- Custo JustoAI: R$24.000/ano (Enterprise custom)
- **Lucro/ano: R$1.356.000** ✅
- **ROI: 5,650%**
- **Payback: 1 dia**

---

## Como Usar em Vendas

### Email Pitch

```
Subject: Sua Economia com JustoAI [Cliente Name]

Oi [Name],

Rodei sua firma pelo calculador de ROI do JustoAI:

✅ Economia JUDIT/ano: R$248.000
✅ Economia Tempo/ano: R$288.000
✅ Custo/ano: R$8.388
✅ Lucro Líquido/ano: R$527.612

Payback: 1.5 dias. ROI: 6,283%

Quer fazer uma demo rápida? Posso mostrar em 15 min.

[Agendador Calendly Link]

Abraço,
[Seu Nome]
```

### Demo Call

```
"Deixa eu rodar seu caso pelo calculador...

Você tem quantos advogados? [15]
Quantos casos por mês? [40]
Quanto você gasta em JUDIT agora? [R$25K]

Aguarda... Pronto!

Olha aqui: Você economizaria R$300K por ano
só em JUDIT, mais R$200K em tempo.

Isso é R$500K de pura vantagem.

A gente cobra R$699/mês. Payback é 1.5 dias.

Quer ver funcionando?
```

---

## Implementação Técnica (Google Sheets)

### Estrutura Recomendada

```
Sheet 1: "Calculadora"
├─ Inputs (A1:B10)
├─ Cálculos (C1:E15)
├─ Outputs (F1:G25)
└─ Gráficos (H1:M25)

Sheet 2: "Referência"
├─ Custos Médios
├─ Benchmarks Indústria
└─ FAQ
```

### Fórmulas Google Sheets

```
=ROW(...) para inputs
=SUM(...) para totais
=DIVIDE(...) para percentuais
=SPARKLINE(...) para mini-gráficos
=IMAGE(...) para logos
```

---

## Link do Calculador (Quando Pronto)

https://docs.google.com/spreadsheets/d/[SEU-ID]/edit#gid=0

**Status:** Criar em Google Sheets e shareable
**Timeline:** 1–2 horas
**Impacto:** 30–40% aumento taxa conversão

---

## Dicas para Máximo Impacto

1. **Personalização:** Sempre preencha com dados reais do cliente antes de enviar
2. **Verbal:** Explique os números em uma call, não apenas mande por email
3. **Credibilidade:** Use dados reais de clientes existentes (nomes + números)
4. **Urgência:** Mostre o payback rápido ("1.5 dias para recuperar investimento")
5. **Social Proof:** "Firmas similares economizam R$X com isso"
6. **CTA Clara:** "Quer começar com trial de 30 dias?"

---

**Este calculador é sua melhor ferramenta de vendas.**

*Números honestos convencem mais que argumentos bonitos.*
