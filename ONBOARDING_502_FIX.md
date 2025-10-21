# 🔧 Diagnóstico e Solução: Erro 502 no Onboarding PDF

## 📋 Problema Identificado

Durante o teste do onboarding com upload de PDF, a extração de PDF está falhando com erro **502 (Bad Gateway)** do Railway, sem logs visíveis.

### Log do Erro (Vercel)
```
2025-10-21T12:16:13.977Z [error] ❌ PDF extraction failed: 502 - {"status":"error","code":502,"message":"Application failed to respond","request_id":"LYguZuA7Q_iCSwm
2025-10-21T12:16:13.977Z [error] ❌ Railway error: Railway error 502
```

---

## 🔍 Causas Raiz Encontradas

### 1. **Type Mismatch na Chamada de Extração de PDF**
**Arquivo**: `src/lib/services/juditAttachmentProcessor.ts:235`

```typescript
// ❌ ERRADO: Passando string (caminho) para função que espera Buffer
extractedText = await extractTextFromPDF(tempPath);
```

**Problema**: A função `extractTextFromPDF` em `pdf-processor.ts` esperava um `Buffer`, mas estava recebendo uma `string` (caminho do arquivo).

**Solução Aplicada**: Modificado para aceitar tanto `Buffer` quanto `string`.

---

### 2. **Loop Infinito Potencial no Processamento**
**Arquivo**: `src/app/api/pdf/process/route.ts`

**Problema**: A rota do Railway (`/api/pdf/process`) deveria processar PDFs **localmente** usando `pdftotext`, mas em algum ponto poderia estar tentando chamar a si mesma via HTTP.

**Solução**: Confirmado que a rota usa `execSync` para chamar `pdftotext` localmente. Adicionado logging detalhado para rastrear execução.

---

### 3. **URL do PDF_PROCESSOR Incorreta**
**Arquivo**: `.env.production.example:251`

```bash
# Configurado como:
PDF_PROCESSOR_URL=https://justoai-vers-o2-production.up.railway.app

# Mas a porta estava errada em alguns lugares
# Dockerfile usa porta 3000, não 3001
```

**Solução**: Corrigido em `pdf-processor.ts` para usar `http://localhost:3000` como fallback.

---

### 4. **Logging Insuficiente para Debugging**
**Problema**: Sem logs detalhados no Railway, é impossível diagnosticar 502.

**Solução Aplicada**:
- ✅ Adicionado logging detalhado em `callRailwayPdfProcessor()`
- ✅ Melhorado tratamento de erro em `/api/pdf/process`
- ✅ Adicionado logging na extração local de PDF
- ✅ Criado script de teste `scripts/test-railway-pdf.ts`

---

## ✅ Soluções Implementadas

### 1. Função `extractTextFromPDF` Melhorada
**Arquivo**: `src/lib/pdf-processor.ts`

```typescript
export async function extractTextFromPDF(
  bufferOrPath: Buffer | string,  // ← Agora aceita ambos!
  fileName: string = 'document.pdf'
): Promise<ExtractionResult> {
  // Detecta se é string ou Buffer
  let buffer: Buffer;
  if (typeof bufferOrPath === 'string') {
    const fs = await import('fs/promises');
    buffer = await fs.readFile(bufferOrPath);
  } else {
    buffer = bufferOrPath;
  }
  // ... resto da função
}
```

**Benefício**: Compatível com ambas as interfaces (arquivo path e Buffer).

---

### 2. Cliente Railway com Logging Robusto
**Arquivo**: `src/lib/pdf-processor.ts`

```typescript
async function callRailwayPdfProcessor(buffer: Buffer, fileName: string) {
  log(`🚂`, `Iniciando extração via Railway: ${fileName}`, {
    buffer_size: buffer.length,
    url: url,
  });

  try {
    // ... request com timeout adequado
  } catch (error) {
    // Logging detalhado do erro
    log(`❌`, `Erro ao chamar Railway`, {
      error: errorMsg,
      file_name: fileName,
      url: url,
      duration_ms: duration,
    });
  }
}
```

**Benefício**: Facilita diagnosticar exatamente onde e por que falha.

---

### 3. Extração Local de PDF Melhorada
**Arquivo**: `src/app/api/pdf/process/route.ts`

```typescript
async function extractTextFromPDF(pdfPath: string): Promise<string> {
  // Verificar se arquivo existe
  await fs.stat(pdfPath);

  // Executar pdftotext com melhores configurações
  const text = execSync(command, {
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024,  // 10MB
    timeout: 30000,  // 30s timeout
  });

  // Verificar resultado
  if (!text || text.trim().length === 0) {
    throw new Error('pdftotext retornou texto vazio');
  }

  return text;
}
```

**Benefício**: Melhor tratamento de erros, timeouts apropriados, validação de resultado.

---

### 4. Script de Teste Diagnóstico
**Arquivo**: `scripts/test-railway-pdf.ts`

Testa:
1. ✅ Variáveis de ambiente
2. ✅ Se `pdftotext` está instalado
3. ✅ Conectividade com Railway (`/api/health`)
4. ✅ Extração local de PDF
5. ✅ Processamento de PDF via Railway HTTP

**Como usar**:
```bash
npx tsx scripts/test-railway-pdf.ts
```

---

## 🚀 Próximos Passos de Diagnóstico

### Se ainda receber 502:

**1. Verifique Railway Logs**
```bash
# No painel do Railway, acesse:
# Projeto → justoai-v2-api → Logs
# Procure por erros na rota /api/pdf/process
```

**2. Teste conectividade local**
```bash
# Se tiver SSH acesso ao Railway:
curl http://localhost:3000/api/health

# Teste PDF processing
curl -X POST http://localhost:3000/api/pdf/process \
  -F "file=@/path/to/test.pdf"
```

**3. Verifique se pdftotext está instalado**
```bash
# Executar no Railway:
which pdftotext
apt-get update && apt-get install -y poppler-utils
```

**4. Verifique Variáveis de Ambiente no Railway**
- Ir em: Railway Dashboard → Project → Service (justoai-v2-api) → Variables
- Confirmar que `PDF_PROCESSOR_URL` está definida corretamente

---

## 📝 Checklist de Verificação

- [ ] pdftotext instalado no Dockerfile.api
- [ ] Porta 3000 está exposta no Dockerfile.api
- [ ] Variável `PDF_PROCESSOR_URL` configurada em Railway
- [ ] Railway API service está rodando (health check passa)
- [ ] Arquivo PDF está sendo salvo corretamente em `/tmp`
- [ ] Permissões de arquivo são adequadas
- [ ] Memory usage do Railway não está no limite

---

## 🧪 Como Testar a Correção

### 1. Executar script de teste
```bash
npm run test:railway-pdf
```

### 2. Executar onboarding real
```bash
# Via Vercel UI ou API
curl -X POST https://app.justoai.com/api/judit/onboarding \
  -H "Content-Type: application/json" \
  -d '{
    "cnj": "1234567-89.2023.8.09.0001"
  }'
```

### 3. Monitorar logs
```bash
# Logs do Railway devem mostrar:
# ✅ [extractTextFromPDF] Iniciando extração com pdftotext
# ✅ [extractTextFromPDF] Sucesso! XXX caracteres em XXXms
```

### 4. Monitorar logs do Vercel
```bash
# Logs do Vercel devem mostrar:
# ✅ PDF extraction bem-sucedida
# ✅ Attachments processados
```

---

## 📚 Arquivos Modificados

| Arquivo | Mudanças |
|---------|----------|
| `src/lib/pdf-processor.ts` | Suporte a Buffer e string, logging melhorado |
| `src/app/api/pdf/process/route.ts` | Logging detalhado, melhor tratamento de erro |
| `scripts/test-railway-pdf.ts` | Script de diagnóstico |
| `.env.production.example` | Mantido como está |

---

## 🔗 Recursos Relacionados

- [Railway Dockerfile.api](./Dockerfile.api)
- [Railway Configuration](./railway.toml)
- [PDF Processor Logic](./src/lib/pdf-processor.ts)
- [Attachment Processing](./src/lib/services/juditAttachmentProcessor.ts)

---

## 📞 Suporte

Se o problema persistir após essas correções:

1. **Verifique Railway logs** em tempo real
2. **Execute script de teste** para diagnosticar etapa por etapa
3. **Confirme variáveis de ambiente** em Railway Dashboard
4. **Reinicie o serviço** se necessário
5. **Verifique limite de recursos** (CPU, RAM, disk space)

---

**Última atualização**: 2025-10-21
**Status**: Soluções aplicadas, aguardando teste
