# Configuração de Preços - JustoAI

Este documento explica como atualizar preços, planos e configurações relacionadas no sistema JustoAI.

## 📁 Arquivo de Configuração

Todas as configurações de preços estão centralizadas no arquivo:
```
src/config/pricing.json
```

## 🔧 Como Alterar Preços

### 1. Preços dos Planos

Para alterar os preços dos planos, edite as propriedades `price_monthly` e `price_annual`:

```json
{
  "id": "starter",
  "name": "Starter",
  "price_monthly": 499,      // Preço mensal em centavos (R$ 4,99)
  "price_annual": 5089,      // Preço anual em centavos (R$ 50,89)
  // ...
}
```

**Importante**: Os valores são em centavos para evitar problemas de arredondamento.

### 2. Desconto Anual

Para alterar o percentual de desconto anual:

```json
{
  "meta": {
    "annual_discount_pct": 0.15  // 15% de desconto
  }
}
```

### 3. Limites de Quotas

Para alterar os limites de cada plano:

```json
{
  "features": {
    "users": {
      "limit": 5,
      "description": "Até 5 usuários"
    },
    "processes": {
      "limit": 300,
      "description": "Monitoramento de até 300 processos"
    },
    "reports_monthly": {
      "limit": 50,
      "description": "Até 50 relatórios por mês"
    }
  }
}
```

### 4. Pacotes de Créditos

Para alterar preços dos pacotes de créditos extras:

```json
{
  "credit_packs": [
    {
      "id": "small_analysis",
      "name": "Pacote Pequeno - Análises",
      "credits": 10,
      "price": 79,           // Preço em centavos
      "type": "analysis"
    }
  ]
}
```

## 🎯 Estrutura Completa dos Planos

### Propriedades Obrigatórias

```json
{
  "id": "string",              // Identificador único
  "name": "string",            // Nome do plano
  "subtitle": "string",        // Descrição curta
  "price_monthly": number,     // Preço mensal (centavos)
  "price_annual": number,      // Preço anual (centavos)
  "popular": boolean,          // Se é o plano mais popular
  "trial_days": number,        // Dias de teste grátis
  "highlighted_features": [],  // Features destacadas no card
  "features": {},             // Objeto com todas as features
  "limits": {}                // Configurações de limites
}
```

### Propriedades Especiais

Para planos Enterprise (preço personalizado):
```json
{
  "custom_pricing": true,
  "contact_sales": true,
  "price_monthly": null,
  "price_annual": null
}
```

Para features ilimitadas:
```json
{
  "users": {
    "unlimited": true,
    "description": "Usuários ilimitados"
  }
}
```

## 📝 Textos e Microcopy

### Headlines e Subheadlines

```json
{
  "copy": {
    "hero": {
      "headline": "Planos que crescem com seu escritório",
      "subheadline": "Gestão de processos, monitoramento e relatórios..."
    }
  }
}
```

### Disclaimers

```json
{
  "copy": {
    "disclaimers": {
      "reports": "*Relatórios mensais limitados por plano...",
      "taxes": "**Valores exibidos sem impostos aplicáveis.",
      "fifo": "***Créditos são consumidos por ordem de expiração (FIFO)."
    }
  }
}
```

## ❓ FAQ Personalizável

Para adicionar/editar perguntas frequentes:

```json
{
  "faq": [
    {
      "question": "O que é um crédito de Análise completa?",
      "answer": "Créditos de Análises completas são usados para..."
    }
  ]
}
```

## 🎨 Matriz de Comparação

Para editar a tabela comparativa de features:

```json
{
  "features_matrix": {
    "categories": [
      {
        "name": "Usuários e Acessos",
        "features": [
          {
            "name": "Usuários simultâneos",
            "starter": "2",
            "professional": "5",
            "enterprise": "Ilimitado"
          }
        ]
      }
    ]
  }
}
```

## 🧪 Testando Alterações

Após fazer alterações no arquivo `pricing.json`:

1. **Verificar sintaxe JSON**:
   ```bash
   npm run lint:json
   ```

2. **Executar testes**:
   ```bash
   npm test pricing
   ```

3. **Visualizar no desenvolvimento**:
   ```bash
   npm run dev
   # Acesse http://localhost:3000/pricing
   ```

## 🚀 Deploy de Alterações

### Processo Recomendado

1. **Fazer backup** do arquivo atual:
   ```bash
   cp src/config/pricing.json src/config/pricing.json.backup
   ```

2. **Criar branch** para alterações:
   ```bash
   git checkout -b update/pricing-changes
   ```

3. **Editar** o arquivo `pricing.json`

4. **Testar** localmente:
   ```bash
   npm run dev
   npm test
   ```

5. **Commit e push**:
   ```bash
   git add src/config/pricing.json
   git commit -m "Update pricing: [descrição das mudanças]"
   git push origin update/pricing-changes
   ```

6. **Criar Pull Request** para revisão

### Verificações de Segurança

- ✅ Preços não estão em valores negativos
- ✅ Desconto anual não excede 50%
- ✅ Limites de quotas são realistas
- ✅ Todos os textos estão em português
- ✅ Links funcionam corretamente

## 📊 Monitoramento

### Métricas Importantes

Após alterações de preço, monitore:

- Taxa de conversão por plano
- Abandono na página de pricing
- Tempo gasto na página
- Cliques nos CTAs

### Analytics Events

Os seguintes eventos são enviados automaticamente:

```javascript
// Visualização da página
gtag('event', 'view_pricing')

// Seleção de plano
gtag('event', 'select_plan', {
  plan_id: 'professional',
  billing_cycle: 'monthly'
})

// Início do checkout
gtag('event', 'begin_checkout', {
  currency: 'BRL',
  value: 1199,
  items: [...]
})
```

## 🛠️ Troubleshooting

### Problemas Comuns

**Erro: "Preço não está sendo exibido"**
- Verifique se o valor não é `null` ou `undefined`
- Confirme que a formatação de moeda está correta

**Erro: "Desconto anual não aparece"**
- Verifique se `annual_discount_pct` está entre 0 e 1
- Confirme que há diferença entre preço mensal e anual

**Erro: "Features não aparecem na comparação"**
- Verifique a estrutura da `features_matrix`
- Confirme que todos os planos têm valores correspondentes

### Logs de Debug

Para debug, adicione no console do navegador:
```javascript
console.log('Pricing data:', require('@/config/pricing.json'))
```

## 📧 Suporte

Para dúvidas sobre configuração de preços:

- **Slack**: #pricing-config
- **Email**: dev@justoai.com
- **Documentação**: [Confluence - Pricing Setup]

---

**Última atualização**: Janeiro 2025
**Versão**: 1.0
**Responsável**: Equipe de Desenvolvimento