# Guia de Encoding UTF-8 e Emojis no Windows

Este documento explica como o projeto JustoAI v2 foi configurado para resolver problemas de encoding de emojis e símbolos no Windows.

## ⚠️ Problema Comum

No Windows, emojis e símbolos especiais frequentemente causam erros como:
- Caracteres ilegíveis (`?` ou `�`)
- Erros de compilação
- Problemas no terminal/console
- Falhas no ESLint/Prettier

## ✅ Soluções Implementadas

### 1. Next.js Configuration (`next.config.ts`)

```typescript
// Força UTF-8 encoding em toda aplicação
webpack: (config, { isServer }) => {
  // Configurações específicas para UTF-8
}

// Headers para garantir UTF-8
async headers() {
  return [{
    source: '/(.*)',
    headers: [{ key: 'Content-Type', value: 'text/html; charset=utf-8' }]
  }]
}
```

### 2. Biblioteca de Ícones Seguros (`lib/icons.ts`)

```typescript
import { ICONS, EMOJIS, UI_TEXT } from '@/lib/icons';

// ✅ Use isso
const successMessage = `${ICONS.SUCCESS} Operação concluída!`;

// ❌ Evite isso
const successMessage = "✅ Operação concluída!";
```

**Benefícios:**
- Símbolos definidos com códigos Unicode explícitos
- Fallbacks para Windows antigo
- Detecção automática de suporte a emojis
- Biblioteca centralizada e reutilizável

### 3. ESLint Configuration

```javascript
rules: {
  'no-irregular-whitespace': 'off', // Permite espaços especiais
  'no-misleading-character-class': 'off', // Permite caracteres especiais
}
```

### 4. Prettier Configuration

```json
{
  "endOfLine": "auto", // Resolve problemas de quebra de linha
  "embeddedLanguageFormatting": "auto"
}
```

### 5. VSCode Settings

```json
{
  "files.encoding": "utf8",
  "files.autoGuessEncoding": true,
  "editor.unicodeHighlight.allowedCharacters": {
    "✓": true, "✗": true, // Lista de símbolos permitidos
  }
}
```

## 🔧 Como Usar

### Opção 1: Usar a Biblioteca (Recomendado)

```typescript
import { ICONS, UI_TEXT } from '@/lib/icons';

// Em componentes
function MyComponent() {
  return (
    <div>
      <p>{UI_TEXT.LOADING}</p>
      <button>{ICONS.SAVE} Salvar</button>
    </div>
  );
}

// Em mensagens
const toast = {
  success: `${ICONS.SUCCESS} Dados salvos com sucesso!`,
  error: `${ICONS.ERROR} Erro ao salvar dados`,
};
```

### Opção 2: Símbolos Diretos (Com Cuidado)

```typescript
// ✅ Seguros no Windows
const arrow = '\u2192'; // →
const check = '\u2713'; // ✓
const warning = '\u26A0'; // ⚠

// ❌ Podem causar problemas
const emoji = '😊'; // Use EMOJIS.SMILE instead
```

## 📋 Checklist de Desenvolvimento

Antes de fazer commit, verifique:

- [ ] Usou `ICONS.*` ao invés de emojis diretos?
- [ ] Testou no terminal do Windows?
- [ ] ESLint passou sem erros de encoding?
- [ ] Build funcionou corretamente?

## 🐛 Resolução de Problemas

### Erro: "Invalid character"
```bash
# Solução: Use a biblioteca de ícones
import { ICONS } from '@/lib/icons';
```

### Terminal exibe "?" no lugar do símbolo
```bash
# Configure o terminal para UTF-8
chcp 65001
```

### ESLint reclama de caracteres especiais
```bash
# Já configurado no eslint.config.mjs
# Use /* eslint-disable no-irregular-whitespace */ se necessário
```

## 🚀 Scripts Úteis

```bash
# Verificar encoding dos arquivos
npm run lint

# Build para testar compatibilidade
npm run build

# Verificar no terminal
npm run dev
```

## 📚 Referências

- [Unicode Character Codes](https://unicode.org/charts/)
- [Next.js Webpack Config](https://nextjs.org/docs/app/api-reference/config/webpack)
- [ESLint Unicode Rules](https://eslint.org/docs/latest/rules/)

---

**⚠️ Importante:** Sempre teste no Windows antes do deploy em produção!