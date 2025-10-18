# JUDIT API Test Scripts

Scripts Node.js para testar a API da JUDIT de forma isolada e local, sem mocks no código principal.

## Arquivos Criados

### 1. **test-judit-onboarding.js** ⭐ (Principal)
Script completo que executa o fluxo completo de onboarding:
- **POST /requests** - Inicia busca por CNJ
- **GET /requests/{requestId}** - Polling de status até conclusão
- **GET /responses** - Busca resultados paginados

**Uso:**
```bash
node scripts/test-judit-onboarding.js "5059111-78.2025.4.02.5101"
```

**Saída:**
```
[HH:MM:SS] 🔍 Iniciando busca por CNJ: 5059111-78.2025.4.02.5101
[HH:MM:SS] 📤 Enviando requisição POST /requests...
[HH:MM:SS] ✅ Busca iniciada com sucesso!
[HH:MM:SS] 📌 Request ID: 46fecf6c-b5c1-46a3-8b6b-d4b0114b6325
[HH:MM:SS] 📊 Status inicial: pending

⏳ Iniciando polling de status (máximo 15 tentativas)...
[HH:MM:SS] 📊 Tentativa 1/15: Status = pending
[HH:MM:SS] 📊 Tentativa 2/15: Status = pending
[HH:MM:SS] 📊 Tentativa 3/15: Status = completed
[HH:MM:SS] ✅ Busca concluída com sucesso!

📥 Buscando resultados paginados...
[HH:MM:SS] 📄 Total de páginas: 1
[HH:MM:SS] ✅ Página 1/1: 0 resultados recebidos
[HH:MM:SS] ✅ Total de resultados coletados: 0

╔════════════════════════════════════════════════════════════╗
║                  ✅ TESTE BEM-SUCEDIDO                     ║
╚════════════════════════════════════════════════════════════╝

📊 Resumo:
  • CNJ buscado: 5059111-78.2025.4.02.5101
  • Request ID: 46fecf6c-b5c1-46a3-8b6b-d4b0114b6325
  • Status final: COMPLETED
  • Total de resultados: 0
  • Tempo total: 42.61s
```

---

### 2. **test-judit-debug.js**
Script de debug para visualizar a estrutura exata das respostas da API.

**Uso:**
```bash
node scripts/test-judit-debug.js "5059111-78.2025.4.02.5101"
```

**Saída:** JSON formatado mostrando todos os campos da resposta:
```json
{
  "request_id": "9793e321-6a4e-4c77-b9d2-5089148e278d",
  "search": { ... },
  "status": "pending",
  "created_at": "2025-10-18T03:56:55.281Z",
  ...
}
```

---

### 3. **test-judit-advanced.js**
Suite avançada de testes com 4 testes diferentes:

**Test 1: Input Validation**
- Valida CNJs vazios, inválidos, todos zeros

**Test 2: Status Codes**
- Testa API Key inválida (HTTP 401/403)
- Testa endpoints inválidos

**Test 3: Pagination**
- Testa diferentes tamanhos de página (10, 50, 100)
- Valida contagem de resultados

**Test 4: Stress Test** (opcional)
- Requisições paralelas para testar concorrência

**Uso:**
```bash
# Apenas testes 1-3
node scripts/test-judit-advanced.js

# Com stress test (5 requisições paralelas)
node scripts/test-judit-advanced.js --stress 5

# Com CNJ customizado
node scripts/test-judit-advanced.js --cnj "0000001-00.2025.1.00.0001"
```

---

### 4. **test-judit-bulk.js**
Teste de múltiplos CNJs em paralelo para validar:
- Desempenho da API com requisições concorrentes
- Confiabilidade do fluxo completo
- Comparação entre diferentes CNJs

**Uso:**
```bash
node scripts/test-judit-bulk.js
```

**Saída:**
```
📤 Enviando 3 requisições em paralelo...
✅ Requisições enviadas (0.45s)

⏳ Fazendo polling de status para 3 requisições...

📌 5059111-78.2025.4.02.5101: request_id=..., status=pending
  └─ Tentativa 1: pending
  └─ Tentativa 2: completed
  ✅ Resultados: 0 itens (1 página)

📊 RESUMO FINAL
Tempo total: 125.34s
Taxa de sucesso: 100%
```

---

## Configuração

### 1. Dependências (já instaladas)
```bash
# Já presentes em package.json
npm install axios
npm install dotenv
```

### 2. Arquivo .env.local
O script procura automaticamente por `.env.local` no diretório raiz do projeto.

**Criar .env.local:**
```bash
cd D:\JustoAI-vers-o2
echo JUDIT_API_KEY=4b851ddf-83f1-4f68-8f82-54af336b3d52 > .env.local
```

**Conteúdo de .env.local:**
```
JUDIT_API_KEY=4b851ddf-83f1-4f68-8f82-54af336b3d52
```

**⚠️ SEGURANÇA:**
- `.env.local` está no `.gitignore` - nunca fazer commit
- Usar `.env.judit.example` como template para outras pessoas

---

## Estrutura da API JUDIT

### Endpoints

**1. Iniciar Busca**
```
POST /requests
Content-Type: application/json
api-key: {JUDIT_API_KEY}

Body:
{
  "search": {
    "search_type": "lawsuit_cnj",
    "search_key": "5059111-78.2025.4.02.5101"
  },
  "with_attachments": true
}

Response:
{
  "request_id": "46fecf6c-b5c1-46a3-8b6b-d4b0114b6325",
  "status": "pending",
  "created_at": "2025-10-18T03:56:55.281Z",
  ...
}
```

**2. Verificar Status**
```
GET /requests/{requestId}
api-key: {JUDIT_API_KEY}

Response:
{
  "request_id": "46fecf6c-b5c1-46a3-8b6b-d4b0114b6325",
  "status": "completed",  // pending, processing, completed, failed
  ...
}
```

**3. Obter Resultados**
```
GET /responses?request_id={requestId}&page_size=100
api-key: {JUDIT_API_KEY}

Response:
{
  "request_id": "46fecf6c-b5c1-46a3-8b6b-d4b0114b6325",
  "page": 1,
  "all_pages_count": 3,
  "data": [
    {
      "lawsuit_number": "5059111-78.2025.4.02.5101",
      ...
    }
  ]
}
```

---

## Status de Busca

| Status | Significado |
|--------|------------|
| `pending` | Busca aguardando processamento |
| `processing` | Busca em andamento |
| `completed` | Busca concluída com sucesso |
| `failed` | Busca falhou (erro no servidor) |

---

## Resultados Esperados

### Cenário 1: CNJ com Resultados
```
✅ Busca concluída
Total de resultados: 42
Páginas: 1 (page_size=100)
```

### Cenário 2: CNJ Sem Resultados (Comum)
```
✅ Busca concluída
Total de resultados: 0
Páginas: 1
```
**Causa Comum:** CNJ não indexado na JUDIT, processo muito recente, ou acesso restrito.

### Cenário 3: CNJ Inválido
```
❌ Falha ao iniciar busca
Erro: HTTP 400 - Invalid search_key format
```

---

## Troubleshooting

### Erro: "JUDIT_API_KEY não está configurada"
**Solução:**
1. Verificar se `.env.local` existe no diretório raiz
2. Confirmar que contém `JUDIT_API_KEY=...`
3. Executar: `echo $JUDIT_API_KEY` (Windows: `echo %JUDIT_API_KEY%`)

### Erro: "Timeout (30000ms)"
**Solução:**
1. Verificar conexão de internet
2. A API pode estar lenta - aguardar e tentar novamente
3. Aumentar timeout em scripts se necessário

### Erro: "HTTP 401 ou 403"
**Solução:**
1. API Key expirou ou foi revogada
2. Obter nova chave em https://judit.io/settings/api-keys
3. Atualizar `.env.local`

### Resultado com 0 itens
**Esperado!** Significa que a busca completou, mas o CNJ:
- Não foi ainda indexado na JUDIT
- Não tem processos associados
- Tem acesso restrito

Para testar com resultados, usar CNJs de processos mais antigos.

---

## Fluxo de Integração Recomendado

1. **Testes Locais** (Este repositório)
   ```bash
   node scripts/test-judit-onboarding.js "CNJ_AQUI"
   ```

2. **Validar Resposta** (se diferente do esperado)
   ```bash
   node scripts/test-judit-debug.js "CNJ_AQUI"
   ```

3. **Testar Múltiplos CNJs**
   ```bash
   node scripts/test-judit-bulk.js
   ```

4. **Integrar no Código Principal** (src/lib/services/juditService.ts)
   - Usar mesma lógica de requests
   - Mesmo polling com status checks
   - Mesma paginação

5. **Deploy em Workers**
   - Usar BullMQ para jobs de background
   - Referência: src/workers/juditOnboardingWorker.ts

---

## Performance Observada

Teste com CNJ `5059111-78.2025.4.02.5101`:

| Operação | Tempo |
|----------|-------|
| POST /requests | ~1.5s |
| Polling (2 tentativas até complete) | ~40s |
| GET /responses | ~0.5s |
| **Total** | **~42s** |

---

## Próximos Passos

1. ✅ Validar fluxo de onboarding (scripts criados)
2. ⏳ Integrar no worker (src/workers/juditOnboardingWorker.ts)
3. ⏳ Testar em produção via Railway
4. ⏳ Monitorar erros via observability

---

## Referências

- **Documentação JUDIT**: https://docs.judit.io
- **Resumo Executivo**: Ver arquivo de resumo fornecido
- **Código Principal**: src/lib/services/juditService.ts
- **Worker**: src/workers/juditOnboardingWorker.ts

---

**Criado:** 2025-10-18
**Última atualização:** 2025-10-18
**Status:** ✅ Testado e Validado
