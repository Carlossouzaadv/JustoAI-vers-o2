# JUDIT Test Scripts - Quick Start

Guia rápido para começar a testar a API JUDIT.

---

## ⚡ Início em 2 Minutos

### 1️⃣ Setup (primeira vez apenas)

```bash
# Ir para o diretório do projeto
cd D:\JustoAI-vers-o2

# Instalar axios (se ainda não tiver)
npm install axios

# Criar arquivo .env.local com a chave
echo JUDIT_API_KEY=4b851ddf-83f1-4f68-8f82-54af336b3d52 > .env.local
```

### 2️⃣ Rodar o Teste Principal

```bash
# Testar o fluxo completo de onboarding
node scripts/test-judit-onboarding.js "5059111-78.2025.4.02.5101"
```

**Esperado:** Sucesso em ~45 segundos com output como:
```
✅ Busca concluída com sucesso!
📊 Total de resultados coletados: 0
✅ TESTE BEM-SUCEDIDO
```

### 3️⃣ Testar com Outro CNJ

```bash
node scripts/test-judit-onboarding.js "SEU_CNJ_AQUI"
```

---

## 🔍 Diferentes Scripts

### Script Principal - Fluxo Completo
```bash
node scripts/test-judit-onboarding.js "5059111-78.2025.4.02.5101"
```
**O quê:** POST → Polling → GET resultados
**Tempo:** ~45 segundos
**Ideal para:** Validar fluxo end-to-end

---

### Debug - Ver Estrutura da Resposta
```bash
node scripts/test-judit-debug.js "5059111-78.2025.4.02.5101"
```
**O quê:** Mostra resposta bruta da API em JSON
**Tempo:** ~5 segundos
**Ideal para:** Verificar campos e estrutura

---

### Suite Completa - 4 Testes
```bash
node scripts/test-judit-advanced.js
```
**O quê:** Testa validação, status codes, paginação, stress
**Tempo:** ~2-3 minutos
**Ideal para:** Validação completa

---

### Bulk Test - Múltiplos CNJs
```bash
node scripts/test-judit-bulk.js
```
**O quê:** Testa 3 CNJs em paralelo
**Tempo:** ~2 minutos
**Ideal para:** Comparação entre CNJs

---

## ❓ FAQ

### P: Por que 0 resultados?
**R:** Normal! O CNJ pode não estar indexado na JUDIT ainda. Tente com um CNJ de processo mais antigo.

### P: Quanto tempo leva?
**R:**
- Onboarding: 40-50 segundos
- Debug: 5 segundos
- Advanced: 2-3 minutos
- Bulk: 2 minutos

### P: Erro "JUDIT_API_KEY não configurada"?
**R:**
```bash
# Verificar se .env.local existe
ls .env.local

# Se não existir, criar:
echo JUDIT_API_KEY=4b851ddf-83f1-4f68-8f82-54af336b3d52 > .env.local
```

### P: Erro "Cannot find module 'axios'"?
**R:**
```bash
npm install axios
```

### P: Script travou?
**R:** Limitar a 5 minutos de timeout (padrão). Se passar disso, pode cancelar com `Ctrl+C`.

---

## 📊 Entendendo a Saída

### Sucesso
```
✅ Busca iniciada com sucesso!
📌 Request ID: 46fecf6c-b5c1-46a3-8b6b-d4b0114b6325
📊 Tentativa 3/15: Status = completed
✅ Busca concluída com sucesso!
✅ TESTE BEM-SUCEDIDO
```

### Falha
```
❌ Falha ao iniciar busca: HTTP 401: Unauthorized
❌ Teste falhou: Busca não concluída
```

### Warning (Esperado)
```
⚠️ Status desconhecido: pending
ℹ️ Busca completada mas sem resultados
```

---

## 🚀 Próximos Passos

Após validar com sucesso:

1. **Integrar no código** → `src/lib/services/juditService.ts`
2. **Criar worker** → `src/workers/juditOnboardingWorker.ts`
3. **Deploy em Railway** → Configurar env vars
4. **Monitorar** → Adicionar logs e métricas

---

## 📚 Documentação Completa

Para mais detalhes:
- 📖 **JUDIT_TEST_SCRIPTS_README.md** - Documentação completa
- 📊 **JUDIT_TEST_RESULTS.md** - Resultados dos testes

---

## ✅ Checklist Rápido

- [ ] `.env.local` criado com JUDIT_API_KEY
- [ ] `node scripts/test-judit-onboarding.js` executa com sucesso
- [ ] Entender estrutura de resposta (via debug script)
- [ ] Testes múltiplos CNJs
- [ ] Pronto para integrar no código principal

---

## 🔐 Segurança

**IMPORTANTE:**
```bash
# Verificar que .env.local não será commitado
git status | grep .env.local  # Deve estar VAZIO

# Se acidentalmente adicionado:
git rm --cached .env.local
git commit -m "security: remove .env.local"
```

---

**Tempo de setup:** ~2 minutos
**Tempo de teste:** ~45 segundos (principal)
**Status:** ✅ Pronto para uso
