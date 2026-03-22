# Relatório Técnico: Integração JustoAI + Escavador API V2

**Data:** 04/02/2026  
**Contato:** Carlos Souza - JustoAI

---

## 1. Objetivo da Integração

Nosso sistema, **JustoAI**, é uma plataforma jurídica que utiliza a API do Escavador para:

1. **Onboarding de processos**: Usuário insere um CNJ → Sistema busca dados → Exibe resumo IA, timeline e documentos
2. **Monitoramento contínuo**: Alertas automáticos de novas movimentações
3. **Download de documentos**: Acesso aos autos do processo

**Requisito crítico de UX:** O onboarding deve ser o mais rápido possível. Idealmente, o usuário insere o CNJ e em poucos segundos já vê as informações do processo.

---

## 2. Todas as Rotas que Utilizamos

### Onboarding (busca inicial de processo)

| Método | Endpoint | Parâmetros | Custo | Uso |
|--------|----------|------------|-------|-----|
| `POST` | `/processos/numero_cnj/{cnj}/solicitar-atualizacao` | `autos=1, utilizar_certificado=1, certificado_id=113, enviar_callback=1` | Grátis | Solicita atualização |
| `GET` | `/processos/numero_cnj/{cnj}/status-atualizacao` | - | Grátis | Polling do status |
| `GET` | `/processos/numero_cnj/{cnj}` | - | R$ 0,10 | Dados da capa |
| `GET` | `/processos/numero_cnj/{cnj}/movimentacoes` | - | Incluído | Timeline (paginado) |
| `GET` | `/processos/numero_cnj/{cnj}/autos` | `utilizar_certificado=1, certificado_id=113, tipo_documentos=INICIAIS` | R$ 1,40 | Documentos |
| `POST` | `/processos/numero_cnj/{cnj}/ia/resumo/solicitar-atualizacao` | - | R$ 0,05 | Solicita resumo IA |
| `GET` | `/processos/numero_cnj/{cnj}/ia/resumo` | - | Grátis | Busca resumo IA |
| `GET` | `/processos/numero_cnj/{cnj}/ia/resumo/status` | - | Grátis | Status do resumo IA |

### Monitoramento

| Método | Endpoint | Parâmetros | Custo | Uso |
|--------|----------|------------|-------|-----|
| `POST` | `/processos/numero_cnj/{cnj}/monitoramento` | `frequencia=DIARIA, callback_url=...` | R$ 1,42/mês | Ativar monitoramento |
| `PUT` | `/processos/numero_cnj/{cnj}/monitoramento` | `frequencia=SEMANAL` | - | Alterar frequência |
| `DELETE` | `/processos/numero_cnj/{cnj}/monitoramento` | - | - | Remover monitoramento |
| `GET` | `/monitoramentos` | - | Grátis | Listar todos |

### Download

| Método | Endpoint | Parâmetros | Uso |
|--------|----------|------------|-----|
| `GET` | `/processos/numero_cnj/{cnj}/documentos/{key}` | - | Baixar PDF com a chave expirável |

---

## 3. Fluxo Atual de Onboarding

```
1. Usuário insere CNJ no dashboard
   ↓
2. POST /processos/numero_cnj/{cnj}/solicitar-atualizacao
   Body: { autos: 1, utilizar_certificado: 1, enviar_callback: 1, certificado_id: 113 }
   ↓
3. Sistema aguarda callback (configurado no painel)
   URL: https://v2.justoai.com.br/api/webhooks/escavador
   ↓
4. Ao receber callback com status=SUCESSO:
   - GET /processos/numero_cnj/{cnj} (dados do processo)
   - GET /processos/numero_cnj/{cnj}/movimentacoes (timeline)
   - GET /processos/numero_cnj/{cnj}/autos (documentos)
   - POST + GET /processos/numero_cnj/{cnj}/resumo-inteligente (EscavAI)
   ↓
5. Exibir dados ao usuário
```

---

## 4. Problemas Identificados

### 3.1 Tempo de Processamento

O `solicitar-atualizacao` está demorando **30-60 minutos** para concluir.

**Exemplo atual:**
| CNJ | Solicitado | Status | Tempo |
|-----|------------|--------|-------|
| 6006257-18.2024.4.06.3807 (TRF6) | 22:42 | PENDENTE | +8 min |
| 5003068-34.2019.4.02.5101 (TRF2) | 20:55 | PENDENTE | +55 min |

Isso é inviável para nosso modelo de negócio onde o usuário espera ver os dados imediatamente.

### 3.2 Dados Retornam Vazios (TJRJ)

Para o CNJ `0266813-90.2018.8.19.0001` (TJRJ 8.19), mesmo após status=SUCESSO:
- Movimentações: 0
- Autos: 0
- Resumo IA: 404

O certificado ID 113 está configurado para TRF6 e TRF2. **O TJRJ está coberto?**

### 3.3 Resumo IA Não Disponível

`GET /processos/numero_cnj/{cnj}/resumo-inteligente` retorna 404 para processos que ainda estão PENDENTE.

**Pergunta:** O resumo IA precisa aguardar a atualização concluir? Existe forma de solicitar antes?

---

## 5. Perguntas para o Suporte Escavador

### Sobre Tempo de Processamento

1. **Qual o tempo médio esperado para `solicitar-atualizacao` concluir?**
   - Com certificado
   - Sem certificado
   - Por tribunal (TRF2, TRF6, TJRJ, etc.)

2. **Existe alguma rota síncrona que retorna dados imediatamente?**
   - Por exemplo, buscar apenas a "capa" do processo sem autos?

3. **É possível buscar movimentações SEM precisar solicitar atualização primeiro?**
   - Se o processo já foi atualizado recentemente por outro usuário.

### Sobre Resumo IA (EscavAI)

4. **O resumo IA fica disponível imediatamente após `solicitar-atualizacao` concluir?**

5. **É possível solicitar resumo IA para um processo que nunca foi atualizado?**

6. **Qual o tempo de processamento do resumo IA após solicitado?**

### Sobre Certificados

7. **O certificado ID 113 cobre quais tribunais?**
   - Onde posso ver essa lista no painel?

8. **Por que TJRJ retorna 0 movimentações mesmo com status=SUCESSO?**

### Sobre Callbacks

9. **O callback é enviado apenas uma vez quando atualização conclui?**

10. **Se nosso webhook falhar (5xx), o Escavador tenta reenviar? Quantas vezes?**

---

## 6. Informações de Debug

### Solicitações Pendentes (para investigação)

| ID Solicitação | CNJ | Tribunal | Solicitado em | Status atual | Tempo |
|----------------|-----|----------|---------------|--------------|-------|
| `39916898` | 6006257-18.2024.4.06.3807 | TRF6 (4.06) | 2026-02-05T01:42:28+00:00 | PENDENTE | +15min |
| `39885929` | 5003068-34.2019.4.02.5101 | TRF2 (4.02) | 2026-02-04T23:55:15+00:00 | PENDENTE | +2h |
| `39826387` | 0266813-90.2018.8.19.0001 | TJRJ (8.19) | 2026-02-04T01:33:36+00:00 | SUCESSO (mas 0 dados) | - |

### Headers que Enviamos

```http
Authorization: Bearer {ESCAVADOR_API_KEY}
X-Requested-With: XMLHttpRequest
Content-Type: application/json
Accept: application/json
```

### Exemplo de Request (solicitar-atualizacao)

```json
POST /api/v2/processos/numero_cnj/6006257-18.2024.4.06.3807/solicitar-atualizacao

Body:
{
  "autos": 1,
  "utilizar_certificado": 1,
  "certificado_id": 113,
  "enviar_callback": 1
}

Response (200):
{
  "id": 39916898,
  "status": "PENDENTE"
}
```

### Rate Limiting

Implementamos rate limiting local de **500 req/min** conforme documentação, usando Bottleneck.js com:
- Reservoir: 500 requests
- Refresh: a cada 60 segundos
- Min time: 120ms entre requests

### Callback Webhook

- **URL:** `https://v2.justoai.com.br/api/webhooks/escavador`
- **Token:** Validamos o header `Authorization` com o token configurado no painel
- **Processamento:** Ao receber callback com `status=SUCESSO`, buscamos dados e salvamos

---

## 7. Nossa Configuração Atual

```
ESCAVADOR_BASE_URL=https://api.escavador.com/api/v2
ESCAVADOR_CERTIFICADO_ID=113
ESCAVADOR_WEBHOOK_SECRET=2nFLNc6GQljhBpASIeft3sREAujBn5

URL Callback: https://v2.justoai.com.br/api/webhooks/escavador
```

---

## 8. Sugestão de Fluxo Ideal

O que precisamos para uma experiência de usuário satisfatória:

```
1. Usuário insere CNJ
   ↓
2. Em <5 segundos: Mostrar dados básicos (capa, classe, partes)
   ↓
3. Em <30 segundos: Mostrar resumo IA
   ↓
4. Em background: Buscar autos/documentos (pode demorar mais)
```

**Existe esse tipo de resposta rápida na API V2?**

---

## 9. Contato

Para mais informações ou esclarecimentos:
- **Email:** [seu email]
- **WhatsApp:** [seu telefone]

Agradecemos a atenção!

---

## 10. Resposta do Escavador (recebida em 24/02/2026)

### 10.1 Sobre Tempo de Processamento
- O `solicitar-atualizacao` é **assíncrono** e envia robôs ao tribunal. Tempo varia de minutos a 1+ hora dependendo de CAPTCHAs, estabilidade do tribunal, fila de capturas, etc.
- Certificados digitais são mais estáveis mas não garantem instantaneidade.

### 10.2 Rota Síncrona para Dados Imediatos — **EXISTE!**
- `GET /processos/numero_cnj/{cnj}` retorna **imediatamente** a capa (classe, partes, assunto, fontes) se o processo já existir na base do Escavador.
- Se retornar 404 → processo não existe na base → aí sim usar `solicitar-atualizacao`.

### 10.3 Rota Síncrona para Movimentações — **EXISTE!**
- `GET /processos/numero_cnj/{cnj}/movimentacoes` retorna o histórico existente na base.
- Verificar `data_ultima_verificacao` para saber se os dados são recentes.

### 10.4 Resumo IA (EscavAI)
- **É independente** do `solicitar-atualizacao` — não precisa esperar a atualização.
- Fluxo correto:
  1. `GET /processos/numero_cnj/{cnj}/ia/resumo` → buscar resumo existente
  2. Se 404 ou desatualizado → `POST /processos/numero_cnj/{cnj}/ia/resumo/solicitar-atualizacao`
  3. Polling via `GET /processos/numero_cnj/{cnj}/ia/resumo/status`
- Tempo de geração: **poucos segundos a minutos** (muito menor que raspagem de tribunal).
- O campo `qualidade_resumo` e `atualizado_em` indicam a qualidade e antidade do resumo.

### 10.5 Problema TJRJ — Bug no NOSSO lado
- O Escavador provou com screenshots que os dados de movimentações e autos **ESTAVAM sendo retornados** normalmente para `0266813-90.2018.8.19.0001`.
- Movimentações: 5 páginas com 20+ itens cada, todas com status 200.
- Autos: 2 requisições com status 200 e 20 itens acessados.
- **Conclusão: o problema é no nosso parsing, não na API.**

### 10.6 Callbacks
- Pode enviar **mais de um callback** por tarefa (redundância).
- Política de reenvio: 11 tentativas (1ª + 10 reenvios), intervalos de 2^n minutos.
- Podemos consultar `GET /callbacks` e reenviar via `POST /callbacks/{id}/reenviar`.

### 10.7 Fluxo Otimizado Sugerido pelo Escavador

```
1. GET /processos/numero_cnj/{cnj}
   → Sucesso: mostra capa + timeline imediata
   → 404: inicia solicitar-atualizacao e aguarda

2. Em paralelo: POST .../ia/resumo/solicitar-atualizacao
   → Polling via GET .../ia/resumo/status (geralmente finaliza rápido)

3. Em paralelo (se necessário): POST solicitar-atualizacao com autos=1
   → Polling ou aguardar callback
```

---

## 11. Análise dos Bugs Encontrados (nossa implementação)

### 🔴 BUG 1: Endpoints de Resumo IA ERRADOS

| Nosso código (ERRADO) | Endpoint correto |
|---|---|
| `POST .../resumo-inteligente` | `POST .../ia/resumo/solicitar-atualizacao` |
| `GET .../resumo-inteligente` | `GET .../ia/resumo` |
| _(não existia)_ | `GET .../ia/resumo/status` |

**Arquivo:** `src/lib/escavador-client.ts` — métodos `solicitarResumoIA()` e `buscarResumoIA()`
**Impacto:** Resumo IA nunca funcionou (404 era por endpoint errado).

### 🔴 BUG 2: Parsing de Movimentações ERRADO (`items` vs `data`)

O screenshot do Escavador mostra que a resposta usa o campo `items`:
```json
{ "items": [ { "id": 31223408038, ... } ] }
```

Nosso parsing em `buscarMovimentacoes()` usa:
```typescript
movimentacoes: response.data.data || []  // ERRADO - deveria ser response.data.items
```

**Arquivo:** `src/lib/escavador-client.ts` — método `buscarMovimentacoes()` (linha 145)
**Impacto:** TJRJ (e possivelmente outros) apareciam com 0 movimentações.

### 🔴 BUG 3: Endpoint de Download de Documentos ERRADO

| Nosso código (ERRADO) | Endpoint correto |
|---|---|
| `GET /documentos/{id}/download` | `GET /processos/numero_cnj/{cnj}/documentos/{key}` |

**Arquivo:** `src/lib/escavador-client.ts` — método `downloadDocumento()`
**Impacto:** Download de documentos provavelmente falha.

### 🟡 BUG 4: Interceptor 404 Lança Erro Fatal

O interceptor em `setupInterceptors()` lança `throw new Error('Processo não encontrado')` para **qualquer** 404. Mas 404 é **esperado** para processos novos e resumos inexistentes — não deve ser erro fatal.

**Arquivo:** `src/lib/escavador-client.ts` — método `setupInterceptors()` (linha 274-277)

### 🟡 BUG 5: Fluxo de Onboarding 100% Bloqueante

O fluxo atual em `onboardingService.ts` bloqueia em `aguardarAtualizacao()` (polling a cada 10s, até 30 tentativas = 5 min máx) antes de mostrar **qualquer coisa** ao usuário.

**Arquivo:** `src/lib/services/onboardingService.ts` — método `onboardProcesso()`

---

## 12. Conclusão e Status de Implementação (Concluído em 24/02/2026)

Após o retorno técnico da equipe do Escavador, todas as refatorações foram implementadas no código:

1. **Cliente Escavador (`escavador-client.ts`)**
   - Endpoints de IA corrigidos para `/ia/resumo`, `/ia/resumo/solicitar-atualizacao` e `/ia/resumo/status`.
   - Parsing de movimentações ajustado para ler de `response.data.items` (corrigindo o "bug" do TJRJ que exibia 0 dados).
   - Rota de download alterada para requerer a `{key}` do documento no endpoint específico do processo.
   - O interceptor do Axios foi ajustado para permitir o tratamento gracioso de erros `404`, necessários para o fluxo síncrono.

2. **Fluxo de Onboarding (`onboardingService.ts` e API Route)**
   - Serviço totalmente reescrito para o fluxo progressivo.
   - **Fase 1 (Síncrona):** Tenta buscar o processo diretamente. Se sucesso, cadastra imediatamente como `ACTIVE`.
   - **Fase 2 (Opcional/Paralela):** Se existe, busca complementos (IA e Movimentações) rápido em parelelo.
   - **Fase 3 (Fallback Assíncrono):** Se retorna `404`, o caso é salvo como `ONBOARDING` e aguarda o Webhook após solicitar a raspagem com `autos=1`.

3. **Webhook (`api/webhooks/escavador/route.ts`)**
   - Lógica de atualização do processo desvinculada do Case. Agora o webhook atualizará o model `Processo` independentemente de haver um usuário esperando no Onboarding, essencial para auto-atualizações de longo prazo.
   - Implementado trava de **Idempotência de 5 minutos**. Se um callback duplicado for recebido (o que é normal por redundância da fila do Escavador) logo após uma atualização, o sistema ignora a requisição pesada para não gastar API, mas ainda garante que o Case fique `ACTIVE`.

A integração está otimizada e apta para homologação.


## 13. Contato Atualizado

Para mais informações ou esclarecimentos:
- **Email:** [seu email]
- **WhatsApp:** [seu telefone]

Agradecemos a atenção!
