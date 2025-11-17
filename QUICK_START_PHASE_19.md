# QUICK START: Fase 19 - 5 Minutos para Usar

## 🚀 Em 5 Minutos

### PASSO 1: Verifique dependências
```bash
npm list exceljs zod react-dropzone
# Devem estar instaladas, senão:
npm install exceljs zod react-dropzone
```

### PASSO 2: Adicione botão na página
```typescript
// src/app/workspace/[id]/page.tsx

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ExcelUploadDialog } from '@/components/onboarding/excel-upload-dialog';

export default function WorkspacePage({ params }: { params: { id: string } }) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setDialogOpen(true)}>
        📊 Upload de Excel
      </Button>

      <ExcelUploadDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        workspaceId={params.id}
        onUploadSuccess={(batchId) => {
          console.log('Processamento iniciado:', batchId);
        }}
      />
    </>
  );
}
```

### PASSO 3: Teste
```bash
# Abrir aplicação em http://localhost:3000
# Clique em "📊 Upload de Excel"
# Clique em "Baixar Template"
# Template (.xlsx) deve fazer download
```

## 📊 O Template Excel Baixado

Contém 3 sheets:
1. **Dados**: Preencha aqui (com 1 exemplo)
2. **Instruções**: Leia as regras
3. **Exemplos**: Veja 3 exemplos reais

## ✅ Testar Upload

1. Preencha algumas linhas no template
2. Salve como "test.xlsx"
3. Arraste para a dialog ou clique para selecionar
4. **< 1 segundo**: validação instantânea
5. Se OK ✅: clique "Continuar & Processar"
6. Se ERRO ❌: veja lista de erros + baixe CSV

## 🧪 Executar Testes

```bash
# Todos os testes Excel
npm run test -- excel

# Específicos
npm run test -- useExcelValidator
npm run test -- validate/route.test
npm run test -- validators/excel
```

## 🔧 Troubleshooting Rápido

| Problema | Solução |
|----------|---------|
| Template não baixa | Verificar `/api/upload/excel/template` retorna 200 |
| Validação lenta | Normal < 1s para 10k linhas |
| Erros não mostram | Verificar estrutura de resposta (deve ter `errors` array) |
| Componente não aparece | Verificar imports: `from '@/components/onboarding/excel-upload-dialog'` |

## 📚 Documentação Completa

- `PHASE_19_COMPLETE_SUMMARY.md` ← Leia isto primeiro
- `PHASE_19_IMPLEMENTATION.md` ← Detalhes backend
- `PHASE_19B_FRONTEND_COMPLETE.md` ← Detalhes frontend

## 🎯 Próximo Passo

Integrar o dashboard de acompanhamento de batch em `/batch/[id]` para mostrar o progresso do processamento.

---

✅ **Pronto! Fase 19 está ativa em sua aplicação.**
