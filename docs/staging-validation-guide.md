# Guia de Validação em Staging - Relatórios Individuais On-demand

## 📋 Visão Geral

Este documento fornece instruções detalhadas para validar o sistema de Relatórios Individuais On-demand em ambiente de staging, incluindo cache, agendamento e sistema de créditos.

## 🎯 Funcionalidades a Validar

### 1. **Geração Imediata de Relatórios**
### 2. **Sistema de Cache Inteligente**
### 3. **Agendamento para Janela Noturna**
### 4. **Sistema de Créditos com Rollback**
### 5. **Geração de PDF e DOCX**
### 6. **Interface de Usuário e Histórico**

---

## 🚀 Configuração Inicial

### Pré-requisitos
- [ ] Ambiente de staging funcional
- [ ] Banco de dados configurado com schema atualizado
- [ ] Redis funcionando para cache e filas
- [ ] Workers de relatórios rodando
- [ ] Puppeteer configurado para geração de PDF

### Verificação do Ambiente

```bash
# 1. Verificar se todos os serviços estão rodando
npm run workers:status

# 2. Verificar conexão com banco
npx prisma db push

# 3. Verificar Redis
redis-cli ping

# 4. Verificar filas
curl http://localhost:3000/api/queues/status
```

---

## 📝 Casos de Teste

### 1. Geração Imediata - Fluxo Básico

#### Cenário 1.1: Geração com Sucesso
**Objetivo:** Validar geração imediata de relatório executivo

**Passos:**
1. Acesse a interface de relatórios individuais
2. Selecione 3-5 processos ativos
3. Escolha "Relatório Executivo"
4. Marque formato "PDF"
5. Selecione "Entrega Imediata"
6. Clique em "Gerar Agora"

**Resultados Esperados:**
- [ ] Modal mostra custo estimado: 0.25 créditos
- [ ] Geração completa em menos de 30 segundos
- [ ] PDF é gerado e disponibilizado para download
- [ ] Histórico registra o relatório como "Concluído"
- [ ] Crédito é debitado corretamente do saldo

**Validação Técnica:**
```bash
# Verificar registro no banco
psql -c "SELECT * FROM report_executions WHERE status = 'CONCLUIDO' ORDER BY created_at DESC LIMIT 1;"

# Verificar transação de crédito
psql -c "SELECT * FROM credit_transactions WHERE reason LIKE '%Relatório individual%' ORDER BY created_at DESC LIMIT 1;"
```

#### Cenário 1.2: Créditos Insuficientes
**Objetivo:** Validar comportamento com saldo insuficiente

**Passos:**
1. Configure workspace com apenas 0.1 créditos disponíveis
2. Tente gerar relatório que custa 0.25 créditos
3. Verifique mensagem de erro

**Resultados Esperados:**
- [ ] Sistema bloqueia geração antes do processamento
- [ ] Mensagem clara sobre créditos insuficientes
- [ ] Nenhum débito é feito
- [ ] Sugestão para adquirir mais créditos

---

### 2. Sistema de Cache

#### Cenário 2.1: Cache Hit
**Objetivo:** Validar uso de cache quando relatório está atualizado

**Passos:**
1. Gere um relatório para 3 processos
2. Aguarde conclusão
3. Imediatamente gere o mesmo relatório novamente
4. Use mesmos parâmetros (processos, tipo, formato)

**Resultados Esperados:**
- [ ] Modal mostra "Relatório Atualizado Disponível"
- [ ] Informa que não será descontado crédito
- [ ] Relatório é entregue instantaneamente (< 5 segundos)
- [ ] Histórico mostra "gerado a partir de cache (sem custo)"

**Validação Técnica:**
```bash
# Verificar cache no banco
psql -c "SELECT cache_key, created_at, expires_at FROM report_cache ORDER BY created_at DESC LIMIT 1;"

# Verificar hit de cache
psql -c "SELECT cache_hit FROM report_executions ORDER BY created_at DESC LIMIT 1;"
```

#### Cenário 2.2: Invalidação de Cache
**Objetivo:** Validar invalidação quando há movimentação recente

**Passos:**
1. Gere um relatório para processo X
2. Simule nova movimentação no processo X
3. Tente gerar o mesmo relatório

**Resultados Esperados:**
- [ ] Sistema detecta movimentação recente
- [ ] Cache é invalidado automaticamente
- [ ] Novo relatório é gerado (consumindo crédito)
- [ ] Nova entrada de cache é criada

#### Cenário 2.3: Forçar Nova Análise
**Objetivo:** Validar opção de bypass do cache

**Passos:**
1. Com cache válido disponível
2. Marque opção "Forçar Nova Análise"
3. Gere relatório

**Resultados Esperados:**
- [ ] Cache é ignorado
- [ ] Novo relatório é gerado
- [ ] Crédito é consumido
- [ ] Cache antigo é substituído

---

### 3. Agendamento para Janela Noturna

#### Cenário 3.1: Agendamento Válido
**Objetivo:** Validar agendamento para horário noturno

**Passos:**
1. Selecione "Agendar"
2. Escolha data para amanhã
3. Selecione horário 23:30
4. Configure relatório jurídico com 8 processos

**Resultados Esperados:**
- [ ] Sistema aceita agendamento
- [ ] Créditos são reservados (0.5)
- [ ] Job é criado na fila com delay correto
- [ ] Status aparece como "Agendado" no histórico

**Validação Técnica:**
```bash
# Verificar job na fila
redis-cli LLEN bull:individual-reports:waiting

# Verificar hold de créditos
psql -c "SELECT * FROM scheduled_credit_holds WHERE expires_at > NOW();"

# Verificar execução agendada
psql -c "SELECT * FROM report_executions WHERE status = 'AGENDADO';"
```

#### Cenário 3.2: Horário Inválido
**Objetivo:** Validar bloqueio de horários fora da janela

**Passos:**
1. Tente agendar para 14:00 (meio-dia)
2. Tente agendar para 08:00 (manhã)

**Resultados Esperados:**
- [ ] Sistema rejeita agendamento
- [ ] Mensagem: "Relatórios agendados só podem ser executados entre 23h e 04h"
- [ ] Nenhum crédito é reservado

#### Cenário 3.3: Execução Noturna
**Objetivo:** Validar execução automática na janela noturna

> **Nota:** Este teste requer aguardar a janela noturna ou simular horário

**Passos:**
1. Agende relatório para hoje às 23:00
2. Aguarde execução ou simule worker
3. Verifique resultado

**Resultados Esperados:**
- [ ] Worker processa job automaticamente
- [ ] Hold de créditos é liberado
- [ ] Créditos são debitados
- [ ] Relatório é gerado
- [ ] Status muda para "Concluído"

---

### 4. Sistema de Créditos e Rollback

#### Cenário 4.1: Cálculo de Custos por Tier
**Objetivo:** Validar cálculo correto de custos

**Testes:**
- [ ] 1-5 processos = 0.25 créditos
- [ ] 6-12 processos = 0.5 créditos
- [ ] 13-25 processos = 1.0 crédito
- [ ] 26-50 processos = 2.0 créditos

#### Cenário 4.2: Rollback em Erro
**Objetivo:** Validar rollback automático quando geração falha

**Simulação de Erro:**
```bash
# Simular erro no Gemini ou PDF
# Temporariamente quebrar serviço de geração
```

**Passos:**
1. Configure erro simulado
2. Gere relatório que consumiria 1 crédito
3. Aguarde falha
4. Verifique rollback

**Resultados Esperados:**
- [ ] Erro é capturado pelo sistema
- [ ] Crédito debitado é estornado automaticamente
- [ ] Transação de rollback é registrada
- [ ] Status do relatório fica como "Falhou"

**Validação Técnica:**
```bash
# Verificar transações de rollback
psql -c "SELECT * FROM credit_transactions WHERE reason LIKE '%Rollback%';"

# Verificar saldo final
psql -c "SELECT * FROM workspace_credits WHERE workspace_id = 'test-workspace';"
```

---

### 5. Geração de PDF e DOCX

#### Cenário 5.1: Qualidade do PDF
**Objetivo:** Validar qualidade e formatação do PDF gerado

**Passos:**
1. Gere relatório executivo em PDF
2. Baixe e abra arquivo
3. Verifique formatação

**Validações Visuais:**
- [ ] Logo da empresa aparece corretamente
- [ ] Cores do tema são aplicadas
- [ ] Texto está legível e bem formatado
- [ ] Quebras de página estão corretas
- [ ] Rodapé com numeração funciona
- [ ] Gráficos/tabelas estão bem posicionados

#### Cenário 5.2: Múltiplos Formatos
**Objetivo:** Validar geração simultânea de PDF e DOCX

**Passos:**
1. Marque ambos formatos: PDF e DOCX
2. Gere relatório
3. Verifique ambos arquivos

**Resultados Esperados:**
- [ ] Ambos arquivos são gerados
- [ ] Conteúdo é consistente entre formatos
- [ ] Tamanhos de arquivo são razoáveis
- [ ] Links de download funcionam

#### Cenário 5.3: Templates Personalizados
**Objetivo:** Validar aplicação de customizações

**Passos:**
1. Configure customização no workspace:
   - Logo personalizado
   - Cores da marca
   - Cabeçalho/rodapé personalizado
2. Gere relatório
3. Verifique personalização aplicada

---

### 6. Interface de Usuário

#### Cenário 6.1: Modal de Geração
**Objetivo:** Validar usabilidade do modal

**Validações UX:**
- [ ] Seleção de processos é clara
- [ ] Informações de cache são visíveis
- [ ] Cálculo de créditos é transparente
- [ ] Validações impedem submissão inválida
- [ ] Loading states são adequados
- [ ] Mensagens de erro são claras

#### Cenário 6.2: Histórico de Relatórios
**Objetivo:** Validar funcionalidade do histórico

**Validações:**
- [ ] Lista carrega corretamente
- [ ] Filtros funcionam (status, data)
- [ ] Paginação funciona
- [ ] Downloads funcionam
- [ ] Cancelamento de agendados funciona
- [ ] Informações de crédito são claras

---

## 🔍 Monitoramento e Logs

### Logs Importantes

```bash
# Logs de geração de relatórios
tail -f logs/reports.log | grep "individual-report"

# Logs de créditos
tail -f logs/credits.log | grep "debit\|credit\|rollback"

# Logs de cache
tail -f logs/cache.log | grep "report-cache"

# Logs de workers
tail -f logs/workers.log | grep "individual-reports-worker"
```

### Métricas para Monitorar

- **Taxa de sucesso:** > 95%
- **Tempo médio de geração:** < 30s para relatórios imediatos
- **Taxa de cache hit:** > 60% após período inicial
- **Tempo de rollback:** < 5s em caso de erro

---

## 🚨 Troubleshooting

### Problemas Comuns

#### PDF não é gerado
```bash
# Verificar Puppeteer
npm run test:puppeteer

# Verificar logs de PDF
grep "PDF generation" logs/app.log
```

#### Cache não funciona
```bash
# Verificar Redis
redis-cli ping
redis-cli keys "*report-cache*"

# Verificar TTL
redis-cli TTL "report-cache:abc123"
```

#### Worker não processa
```bash
# Verificar status do worker
npm run workers:status

# Verificar fila
npm run workers:logs individual-reports
```

#### Créditos não são debitados
```bash
# Verificar saldo
psql -c "SELECT * FROM workspace_credits;"

# Verificar transações
psql -c "SELECT * FROM credit_transactions ORDER BY created_at DESC LIMIT 10;"
```

---

## ✅ Checklist Final

### Funcionalidades Core
- [ ] Geração imediata funciona
- [ ] Cache funciona e economiza créditos
- [ ] Agendamento funciona
- [ ] Créditos são calculados corretamente
- [ ] Rollback funciona em caso de erro
- [ ] PDF e DOCX são gerados corretamente

### Interface e UX
- [ ] Modal é intuitivo
- [ ] Histórico é funcional
- [ ] Mensagens são claras
- [ ] Performance é adequada

### Integração
- [ ] Workers processam jobs
- [ ] Cache Redis funciona
- [ ] Banco persiste dados
- [ ] Filas gerenciam prioridades

### Segurança e Confiabilidade
- [ ] Não há vazamento de créditos
- [ ] Rollback automático funciona
- [ ] Validações impedem uso indevido
- [ ] Logs adequados para auditoria

---

## 📊 Relatório de Validação

### Template de Relatório

```markdown
## Validação Staging - Relatórios Individuais
**Data:** [DATA]
**Validador:** [NOME]
**Ambiente:** staging
**Branch:** feature/claude-on-demand-report-credits

### Resultados dos Testes
- ✅ Geração Imediata: [X/Y testes passaram]
- ✅ Sistema de Cache: [X/Y testes passaram]
- ✅ Agendamento: [X/Y testes passaram]
- ✅ Sistema de Créditos: [X/Y testes passaram]
- ✅ Geração PDF/DOCX: [X/Y testes passaram]
- ✅ Interface: [X/Y testes passaram]

### Problemas Encontrados
[Lista de issues com severity]

### Recomendações
[Ações recomendadas antes do deploy]

### Aprovação
[ ] Aprovado para produção
[ ] Necessita correções
```

---

## 🎯 Próximos Passos

Após validação bem-sucedida em staging:

1. **Deploy para Produção**
   - Executar migration do banco
   - Atualizar configurações de workers
   - Monitorar métricas por 48h

2. **Rollout Gradual**
   - Liberar para 10% dos usuários
   - Monitorar performance
   - Expandir gradualmente

3. **Documentação**
   - Atualizar documentação do usuário
   - Criar guias de uso
   - Treinar equipe de suporte

---

**📞 Contato para Dúvidas:**
- Equipe de Desenvolvimento: #dev-team
- Logs e Monitoramento: #ops-team