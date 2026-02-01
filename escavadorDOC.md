# 📋 IMPLEMENTAÇÃO ATUAL - Cliente Escavador

**Data:** 2026-01-31  
**Arquivos analisados:**
- src/lib/escavador-client.ts
- src/lib/services/onboardingService.ts

---

## 1. CLIENTE ESCAVADOR

### 1.1 Configuração

**Base URL:**
Configurada via `ESCAVADOR_BASE_URL` ou padrão: `https://api.escavador.com/api/v2`

**Headers enviados em TODAS as requisições:**
- Authorization: `Bearer ${this.config.apiKey}`
- Content-Type: `application/json`
- Accept: `application/json`

**Rate Limiting:**
- Implementado com: `bottleneck`
- Configuração: 500 requisições por minuto, 1 req a cada 120ms
- Código:
```typescript
    // Rate limiter: 500 req/min = 1 req a cada 120ms
    this.limiter = new Bottleneck({
      reservoir: 500,
      reservoirRefreshAmount: 500,
      reservoirRefreshInterval: 60 * 1000,
      minTime: 120
    });
```

**Timeout:**
60000 ms

### 1.2 Métodos Implementados

### Método: solicitarAtualizacao

**Assinatura:**
```typescript
  async solicitarAtualizacao(cnj: string, options?: {
    buscarAutos?: boolean;
    usarCertificado?: boolean;
  }): Promise<AtualizacaoResponse>
```

**Endpoint chamado:**
- Método HTTP: POST
- URL completa: `/processos/${cnj}/solicitar-atualizacao`

**Headers adicionais (além dos globais):**
Nenhum

**Parâmetros aceitos:**
```typescript
cnj: string;
options?: {
    buscarAutos?: boolean;
    usarCertificado?: boolean;
}
```

**Body da requisição:**
```json
{
  "autos": 1, // ou 0, dependendo de options.buscarAutos
  "utilizar_certificado": 1, // ou 0, dependendo de options.usarCertificado
  "certificado_id": "valor_de_process_env_ESCAVADOR_CERTIFICADO_ID"
}
```

**Retorno:**
`Promise<AtualizacaoResponse>`

**Código completo:**
```typescript
  async solicitarAtualizacao(cnj: string, options?: {
    buscarAutos?: boolean;
    usarCertificado?: boolean;
  }): Promise<AtualizacaoResponse> {
    const response = await this.limiter.schedule(() =>
      this.client.post(`/processos/${cnj}/solicitar-atualizacao`, {
        autos: options?.buscarAutos ? 1 : 0,
        utilizar_certificado: options?.usarCertificado ? 1 : 0,
        certificado_id: this.config.certificadoId
      })
    );

    return {
      id: response.data.id,
      status: response.data.status
    };
  }
```

---

### Método: consultarStatusAtualizacao

**Assinatura:**
```typescript
  async consultarStatusAtualizacao(atualizacaoId: string): Promise<StatusAtualizacao>
```

**Endpoint chamado:**
- Método HTTP: GET
- URL completa: `/processos/atualizacao/${atualizacaoId}/status`

**Headers adicionais:**
Nenhum

**Parâmetros aceitos:**
```typescript
atualizacaoId: string
```

**Query params:**
Nenhum

**Retorno:**
`Promise<StatusAtualizacao>`

**Código completo:**
```typescript
  async consultarStatusAtualizacao(atualizacaoId: string): Promise<StatusAtualizacao> {
    const response = await this.limiter.schedule(() =>
      this.client.get(`/processos/atualizacao/${atualizacaoId}/status`)
    );

    return response.data;
  }
```

---

### Método: buscarProcesso

**Assinatura:**
```typescript
  async buscarProcesso(cnj: string): Promise<unknown>
```

**Endpoint chamado:**
- Método HTTP: GET
- URL completa: `/processos/${cnj}`

**Headers adicionais:**
Nenhum

**Parâmetros aceitos:**
```typescript
cnj: string
```

**Query params:**
Nenhum

**Retorno:**
`Promise<unknown>`

**Código completo:**
```typescript
  async buscarProcesso(cnj: string): Promise<unknown> {
    const response = await this.limiter.schedule(() =>
      this.client.get(`/processos/${cnj}`)
    );

    return response.data;
  }
```

---

### Método: buscarMovimentacoes

**Assinatura:**
```typescript
  async buscarMovimentacoes(cnj: string, cursor?: string): Promise<MovimentacoesResponse>
```

**Endpoint chamado:**
- Método HTTP: GET
- URL completa: `/processos/${cnj}/movimentacoes` (se não houver cursor) ou a URL do cursor

**Headers adicionais:**
Nenhum

**Parâmetros aceitos:**
```typescript
cnj: string;
cursor?: string;
```

**Query params:**
Se o `cursor` for fornecido, ele já contém a URL completa com query params, caso contrário `?limit` e outros podem ser padrão do server.

**Retorno:**
`Promise<MovimentacoesResponse>`

**Código completo:**
```typescript
  async buscarMovimentacoes(cnj: string, cursor?: string): Promise<MovimentacoesResponse> {
    const url = cursor || `/processos/${cnj}/movimentacoes`;
    
    const response = await this.limiter.schedule(() =>
      this.client.get(url)
    );

    return {
      movimentacoes: response.data.data || [],
      nextCursor: response.data.links?.next
    };
  }
```

---

### Método: buscarAutos

**Assinatura:**
```typescript
  async buscarAutos(cnj: string, options?: {
    usarCertificado?: boolean;
    tipoDocumentos?: 'TODOS' | 'PUBLICOS' | 'INICIAIS';
  }): Promise<unknown[]>
```

**Endpoint chamado:**
- Método HTTP: GET
- URL completa: `/processos/${cnj}/autos`

**Headers adicionais:**
Nenhum

**Parâmetros aceitos:**
```typescript
cnj: string;
options?: {
    usarCertificado?: boolean;
    tipoDocumentos?: 'TODOS' | 'PUBLICOS' | 'INICIAIS';
}
```

**Query params:**
```typescript
?utilizar_certificado={0|1}&certificado_id={id}&tipo_documentos={TODOS|PUBLICOS|INICIAIS}
```

**Retorno:**
`Promise<unknown[]>`

**Código completo:**
```typescript
  async buscarAutos(cnj: string, options?: {
    usarCertificado?: boolean;
    tipoDocumentos?: 'TODOS' | 'PUBLICOS' | 'INICIAIS';
  }): Promise<unknown[]> {
    const response = await this.limiter.schedule(() =>
      this.client.get(`/processos/${cnj}/autos`, {
        params: {
          utilizar_certificado: options?.usarCertificado ? 1 : 0,
          certificado_id: this.config.certificadoId,
          tipo_documentos: options?.tipoDocumentos || 'INICIAIS'
        }
      })
    );

    return response.data.data || [];
  }
```

---

### Método: solicitarResumoIA

**Assinatura:**
```typescript
  async solicitarResumoIA(cnj: string): Promise<{ id: string }>
```

**Endpoint chamado:**
- Método HTTP: POST
- URL completa: `/processos/${cnj}/resumo-inteligente`

**Headers adicionais:**
Nenhum

**Body da requisição:**
Vazio (ou padrão axios)

**Retorno:**
`Promise<{ id: string }>`

**Código completo:**
```typescript
  async solicitarResumoIA(cnj: string): Promise<{ id: string }> {
    const response = await this.limiter.schedule(() =>
      this.client.post(`/processos/${cnj}/resumo-inteligente`)
    );

    return { id: response.data.id };
  }
```

---

### Método: buscarResumoIA

**Assinatura:**
```typescript
  async buscarResumoIA(cnj: string): Promise<ResumoIAResponse>
```

**Endpoint chamado:**
- Método HTTP: GET
- URL completa: `/processos/${cnj}/resumo-inteligente`

**Retorno:**
`Promise<ResumoIAResponse>`

**Código completo:**
```typescript
  async buscarResumoIA(cnj: string): Promise<ResumoIAResponse> {
    const response = await this.limiter.schedule(() =>
      this.client.get(`/processos/${cnj}/resumo-inteligente`)
    );

    return response.data;
  }
```

---

### Método: configurarMonitoramento

**Assinatura:**
```typescript
  async configurarMonitoramento(cnj: string, frequencia: 'DIARIA' | 'SEMANAL'): Promise<MonitoramentoResponse>
```

**Endpoint chamado:**
- Método HTTP: POST
- URL completa: `/processos/${cnj}/monitoramento`

**Body da requisição:**
```json
{
  "frequencia": "DIARIA", // ou SEMANAL
  "callback_url": "http://seu-app/api/webhook/escavador" // usando process.env.NEXT_PUBLIC_APP_URL
}
```

**Retorno:**
`Promise<MonitoramentoResponse>`

**Código completo:**
```typescript
  async configurarMonitoramento(cnj: string, frequencia: 'DIARIA' | 'SEMANAL'): Promise<MonitoramentoResponse> {
    const response = await this.limiter.schedule(() =>
      this.client.post(`/processos/${cnj}/monitoramento`, {
        frequencia,
        callback_url: process.env.NEXT_PUBLIC_APP_URL + '/api/webhook/escavador'
      })
    );

    return {
      success: response.status === 200,
      monitoringId: response.data.id
    };
  }
```

---

### Método: atualizarFrequenciaMonitoramento

**Assinatura:**
```typescript
  async atualizarFrequenciaMonitoramento(
    cnj: string,
    novaFrequencia: 'DIARIA' | 'SEMANAL'
  ): Promise<void>
```

**Endpoint chamado:**
- Método HTTP: PUT
- URL completa: `/processos/${cnj}/monitoramento`

**Body da requisição:**
```json
{
  "frequencia": "DIARIA" // ou SEMANAL
}
```

**Retorno:**
`Promise<void>`

**Código completo:**
```typescript
  async atualizarFrequenciaMonitoramento(
    cnj: string,
    novaFrequencia: 'DIARIA' | 'SEMANAL'
  ): Promise<void> {
    await this.limiter.schedule(() =>
      this.client.put(`/processos/${cnj}/monitoramento`, {
        frequencia: novaFrequencia
      })
    );
  }
```

---

### Método: removerMonitoramento

**Assinatura:**
```typescript
  async removerMonitoramento(cnj: string): Promise<void>
```

**Endpoint chamado:**
- Método HTTP: DELETE
- URL completa: `/processos/${cnj}/monitoramento`

**Retorno:**
`Promise<void>`

**Código completo:**
```typescript
  async removerMonitoramento(cnj: string): Promise<void> {
    await this.limiter.schedule(() =>
      this.client.delete(`/processos/${cnj}/monitoramento`)
    );
  }
```

---

### Método: downloadDocumento

**Assinatura:**
```typescript
  async downloadDocumento(documentoId: string): Promise<Buffer>
```

**Endpoint chamado:**
- Método HTTP: GET
- URL completa: `/documentos/${documentoId}/download`

**Options:**
`responseType: 'arraybuffer'`

**Retorno:**
`Promise<Buffer>`

**Código completo:**
```typescript
  async downloadDocumento(documentoId: string): Promise<Buffer> {
    const response = await this.limiter.schedule(() =>
      this.client.get(`/documentos/${documentoId}/download`, {
        responseType: 'arraybuffer'
      })
    );

    return Buffer.from(response.data);
  }
```

---

## 2. ONBOARDING SERVICE

### Método: onboardProcesso

**Fluxo completo:**

1. **Início**: Valida configuração da API Escavador e verifica se o processo já existe no banco.
2. **Atualização (se necessário)**:
   - Se processo não existe ou `forceUpdate` é true, chama `escavadorClient.solicitarAtualizacao`.
3. **Polling**:
   - Chama `this.aguardarAtualizacao(atualizacao.id)` para esperar o Escavador terminar de processar.
4. **Busca de Dados**:
   - Chama `escavadorClient.buscarProcesso(cnj)` para pegar a capa.
   - Chama `this.buscarTodasMovimentacoes(cnj)` para pegar movimentações paginadas.
   - Chama `escavadorClient.buscarAutos(cnj)` (se `incluirDocumentos` for true).
5. **Resumo IA**:
   - Tenta solicitar e buscar resumo IA (`escavadorClient.solicitarResumoIA` e `buscarResumoIA`), com um delay de 5s.
6. **Persistência**:
   - Cria ou atualiza o registro na tabela `Processo` com os dados JSON.
7. **Gestão de Case**:
   - Verifica se já existe um `Case` associado (ou `targetCaseId`).
   - Se `targetCaseId` fornecido, atualiza o Case existente.
   - Se não, cria um novo `Case` associado ao processo e ao cliente.
8. **Configuração de Monitoramento**:
   - Chama `escavadorClient.configurarMonitoramento(cnj, 'DIARIA')` para habilitar webhook.
9. **Finalização**:
   - Incrementa contador de processos do workspace.
   - Retorna o resultado.

**Código completo:**
```typescript
  async onboardProcesso(options: OnboardingOptions): Promise<OnboardingResult> {
    const { 
      cnj, 
      workspaceId, 
      clientId,
      createdById,
      incluirDocumentos = true, 
      usarCertificado = true,
      forceUpdate = false,
      targetCaseId
    } = options;

    console.log(`[Onboarding] Iniciando para CNJ: ${cnj}`);

    // Verificar se cliente Escavador está configurado
    if (!escavadorClient.isConfigured()) {
      throw new Error('Escavador API não está configurada. Verifique ESCAVADOR_API_KEY em .env');
    }

    // 1. Verificar se processo já existe
    let processo = await prisma.processo.findUnique({
      where: { numeroCnj: cnj }
    });

    let dadosProcesso: unknown = null;
    let movimentacoes: unknown[] = [];
    let autos: unknown[] = [];
    let resumoIA: string | undefined;

    if (!processo || forceUpdate) {
      // 2. Solicitar atualização no Escavador
      console.log(`[Onboarding] Solicitar atualização no Escavador...`);
      const atualizacao = await escavadorClient.solicitarAtualizacao(cnj, {
        buscarAutos: incluirDocumentos,
        usarCertificado
      });

      // 3. Aguardar conclusão (polling)
      console.log(`[Onboarding] Aguardando conclusão da atualização...`);
      const concluido = await this.aguardarAtualizacao(atualizacao.id);
      if (!concluido) {
        throw new Error('Timeout ao aguardar atualização do processo');
      }

      // 4. Buscar dados completos
      console.log(`[Onboarding] Buscando dados completos...`);
      dadosProcesso = await escavadorClient.buscarProcesso(cnj);
      
      // 5. Buscar todas as movimentações (paginadas)
      console.log(`[Onboarding] Buscando movimentações...`);
      movimentacoes = await this.buscarTodasMovimentacoes(cnj);
      console.log(`[Onboarding] ${movimentacoes.length} movimentações encontradas`);
      
      // 6. Buscar autos se solicitado
      if (incluirDocumentos) {
        console.log(`[Onboarding] Buscando autos/documentos...`);
        autos = await escavadorClient.buscarAutos(cnj, { usarCertificado });
        console.log(`[Onboarding] ${autos.length} autos encontrados`);
      }

      // 7. Solicitar resumo IA (opcional, pode falhar)
      try {
        console.log(`[Onboarding] Solicitando resumo IA...`);
        await escavadorClient.solicitarResumoIA(cnj);
        // Aguardar um pouco para processamento
        await new Promise(resolve => setTimeout(resolve, 5000));
        const resumoData = await escavadorClient.buscarResumoIA(cnj);
        resumoIA = resumoData.resumo;
        console.log(`[Onboarding] Resumo IA obtido`);
      } catch (error) {
        console.warn(`[Onboarding] Resumo IA não disponível: ${error}`);
      }

      // 8. Criar ou Atualizar registro do Processo
      if (processo) {
        processo = await prisma.processo.update({
          where: { id: processo.id },
          data: {
            dadosCompletos: {
              provider: 'ESCAVADOR',
              dados: dadosProcesso,
              movimentacoes,
              autos,
              resumoIA,
              fetchedAt: new Date().toISOString()
            } as Prisma.JsonObject,
            // updatedAt handled automatically or different name
            // updatedAt: new Date()
          }
        });
        console.log(`[Onboarding] Processo atualizado: ${processo.id}`);
      } else {
        processo = await prisma.processo.create({
        data: {
          numeroCnj: cnj,
          dadosCompletos: {
            provider: 'ESCAVADOR',
            dados: dadosProcesso,
            movimentacoes,
            autos,
            resumoIA,
            fetchedAt: new Date().toISOString()
          } as Prisma.JsonObject,
          dataOnboarding: new Date()
        }
      });
      console.log(`[Onboarding] Processo criado: ${processo.id}`);
      }

      console.log(`[Onboarding] Processo criado: ${processo.id}`);
    } else {
      console.log(`[Onboarding] Processo já existe: ${processo.id}`);
      // Extrair dados existentes
      const dados = processo.dadosCompletos as { movimentacoes?: unknown[], autos?: unknown[], resumoIA?: string } | null;
      movimentacoes = dados?.movimentacoes || [];
      autos = dados?.autos || [];
      resumoIA = dados?.resumoIA;
    }

    // 9. Verificar se já existe um case para este processo neste workspace
    let existingCase = null;
    
    if (targetCaseId) {
      existingCase = await prisma.case.findUnique({ where: { id: targetCaseId } });
      
      if (existingCase) {
        await prisma.case.update({
          where: { id: targetCaseId },
          data: { 
            processoId: processo.id,
            status: 'ACTIVE',
            number: cnj,
          }
        });
        console.log(`[Onboarding] Target case atualizado: ${targetCaseId}`);
      }
    } else {
      existingCase = await prisma.case.findFirst({
        where: {
          workspaceId,
          processoId: processo.id
        }
      });
    }

    if (existingCase) {
      console.log(`[Onboarding] Case já existe/atualizado: ${existingCase.id}`);
      return {
        processo: {
          id: processo.id,
          numeroCnj: processo.numeroCnj
        },
        case: {
          id: existingCase.id,
          number: existingCase.number,
          status: existingCase.status
        },
        resumoIA,
        movimentacoesCount: movimentacoes.length,
        autosCount: autos.length
      };
    }

    // 10. Obter ou criar cliente padrão se não fornecido
    let finalClientId = clientId;
    if (!finalClientId) {
      const defaultClient = await this.getOrCreateDefaultClient(workspaceId, createdById);
      finalClientId = defaultClient.id;
    }

    // 11. Criar Case no workspace
    const caseData = await prisma.case.create({
      data: {
        workspaceId,
        processoId: processo.id,
        clientId: finalClientId,
        createdById,
        number: cnj,
        title: `Processo ${cnj}`,
        status: 'ACTIVE',
        type: 'CIVIL',
        priority: 'MEDIUM',
        monitoringFrequency: 'DIARIA',
        frequencySuggestedBy: 'AI',
        frequencyReason: 'Processo recém-adicionado - monitoramento diário inicial'
      }
    });

    console.log(`[Onboarding] Case criado: ${caseData.id}`);

    // 12. Configurar monitoramento no Escavador
    try {
      await escavadorClient.configurarMonitoramento(cnj, 'DIARIA');
      console.log(`[Onboarding] Monitoramento configurado`);
    } catch (error) {
      console.warn(`[Onboarding] Erro ao configurar monitoramento: ${error}`);
    }

    // 13. Atualizar contador de processos do workspace
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { processCount: { increment: 1 } }
    });

    return {
      processo: {
        id: processo.id,
        numeroCnj: processo.numeroCnj
      },
      case: {
        id: caseData.id,
        number: caseData.number,
        status: caseData.status
      },
      resumoIA,
      movimentacoesCount: movimentacoes.length,
      autosCount: autos.length
    };
  }
```

### Método: aguardarAtualizacao

**Estratégia de polling:**
- Intervalo: 10000ms (10 segundos)
- Máximo de tentativas: 30
- Total timeout: Aprox. 5 minutos
- Condição de parada: Status 'SUCESSO' ou 'ERRO'

**Código completo:**
```typescript
  private async aguardarAtualizacao(atualizacaoId: string, maxTentativas = 30): Promise<boolean> {
    for (let i = 0; i < maxTentativas; i++) {
      const status = await escavadorClient.consultarStatusAtualizacao(atualizacaoId);
      
      if (status.status === 'SUCESSO') return true;
      if (status.status === 'ERRO') throw new Error('Erro ao processar atualização no Escavador');
      
      console.log(`[Onboarding] Aguardando... tentativa ${i + 1}/${maxTentativas}`);
      // Aguardar 10 segundos antes de tentar novamente
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
    
    return false; // Timeout
  }
```

### Método: buscarTodasMovimentacoes

**Estratégia de paginação:**
- Utiliza um loop `do...while`.
- Chama `buscarMovimentacoes` e verifica o campo `nextCursor`.
- Continua chamando enquanto houver `nextCursor`.

**Código completo:**
```typescript
  private async buscarTodasMovimentacoes(cnj: string): Promise<unknown[]> {
    const todas: unknown[] = [];
    let cursor: string | undefined;

    do {
      const pagina = await escavadorClient.buscarMovimentacoes(cnj, cursor);
      todas.push(...pagina.movimentacoes);
      cursor = pagina.nextCursor;
    } while (cursor);

    return todas;
  }
```

## 3. PERSISTÊNCIA DE DADOS

**Tabela:** `Processo` (Prisma Model)

**Campo `dadosCompletos` - estrutura JSON:**
```json
{
  "provider": "ESCAVADOR",
  "dados": { ... },  // Objeto completo retornado pelo endpoint de detalhes do processo
  "movimentacoes": [ ... ],  // Array com todas as movimentações paginadas
  "autos": [ ... ],  // Array com os autos/documentos retornados
  "resumoIA": "Texto do resumo...",  // String com o resumo da IA, se disponível
  "fetchedAt": "2026-01-31T..." // Data da atualização
}
```

**Outros campos preenchidos:**
- `numeroCnj`: CNJ do processo (chave única)
- `dataOnboarding`: Data de criação do registro

## 4. VARIÁVEIS DE AMBIENTE

```env
ESCAVADOR_API_KEY=Chave de API do Escavador
ESCAVADOR_BASE_URL=https://api.escavador.com/api/v2
ESCAVADOR_CERTIFICADO_ID=ID do certificado digital a ser usado (opcional)
NEXT_PUBLIC_APP_URL=URL base da aplicação (usada para webhook de monitoramento)
```

**Onde são usadas:**
- `ESCAVADOR_API_KEY`: `src/lib/escavador-client.ts` (linha 47) - Autenticação
- `ESCAVADOR_BASE_URL`: `src/lib/escavador-client.ts` (linha 48) - URL Base da API
- `ESCAVADOR_CERTIFICADO_ID`: `src/lib/escavador-client.ts` (linha 49) - Busca de autos e atualizações
- `NEXT_PUBLIC_APP_URL`: `src/lib/escavador-client.ts` (linha 187) - Callback URL do Webhook

## 5. DEPENDÊNCIAS

## Dependências NPM (Versões Instaladas)
```json
{
  "bottleneck": "^2.19.5",
  "axios": "^1.12.2"
}
```
Obs: `zod` e `prisma` também são utilizados indiretamente para tipos e validação no projeto, mas não são dependências diretas do cliente HTTP.
