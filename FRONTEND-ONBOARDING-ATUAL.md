# 📋 FRONTEND - Estado Atual do Onboarding

**Data:** 2026-02-01

---

## 1. COMPONENTES ENCONTRADOS

### Páginas Principais
- `src/app/dashboard/process/page.tsx`: Lista de processos. Contém botão "Subir Arquivo" que leva para `/dashboard/documents-upload`.
- `src/app/dashboard/documents-upload/page.tsx`: Página Wrapper para o fluxo de upload (Next.js Server Component).
- `src/app/dashboard/documents-upload/documents-upload-client.tsx`: Componente Client que gerencia o estado do Dialog.
- `src/app/dashboard/upload/page.tsx`: Página de upload legada(?) com drag-and-drop e feature flags para "future case selection".

### Componentes de UI/Lógica
- `src/components/onboarding/upload-dialog.tsx`: Modal principal de upload de PDF.
- `src/components/onboarding/onboarding-progress.tsx`: Visualização do progresso das fases (Preview, Enrichment, Analysis).
- `src/lib/services/upload-router.ts`: Serviço client-side para gerenciar upload direto para o Supabase.

---

## 2. FLUXO ATUAL

### 2.1 Componente Principal: UploadDialog
**Arquivo:** `src/components/onboarding/upload-dialog.tsx`

**É uma página ou componente?**
- [ ] Página
- [x] Componente

**Onde é usado?**
- `src/app/dashboard/documents-upload/documents-upload-client.tsx`

**Interface atual:**
- NÃO tem campo para digitar CNJ.
- Tem upload de arquivo PDF ("Upload de Documento PDF").
- Drag and drop zone.
- Mostra progresso detalhado após upload.

**Botões:**
- "Enviar PDF" (disabilita durante upload).
- "Ver Detalhes do Processo" (após conclusão).

### 2.2 Chamada à API (Upload de Arquivo)

**Como chama a API atualmente?**
Usa `src/lib/services/upload-router.ts`:

```typescript
// 1. Obtém URL assinada
const { signedUrl, filePath, caseId } = await getSignedUploadUrl(...)
// Chama POST /api/storage/signed-url

// 2. Upload direto para Supabase (PUT)
await uploadFileToSupabase(file, signedUrl, ...)

// 3. Callback para processamento
await fetch('/api/process/upload-callback', ...)
```

### 2.3 Tratamento de Resposta

**Mensagens:**
- Sucesso: Redireciona para o processo criado.
- Erro: Mostra Alert com mensagem de erro.

**Redirecionamento:**
```typescript
window.location.href = `/dashboard/process/${uploadResult.caseId}?tab=analysis`;
```

### 2.4 Estado/Loading

**Gerenciamento:**
- `uploading`: boolean para estado de upload.
- `uploadProgress`: number (0-100).
- `uploadResult`: objeto com dados do caso criado.

**Indicador visual:**
- Spinner (Loader2) no botão.
- Barra de progresso customizada (no console log por enquanto, mas variável `uploadProgress` existe).
- Componente `OnboardingProgress` assume após upload inicial.

---

## 3. VALIDAÇÕES

**Valida CNJ antes de enviar?**
- [ ] Sim
- [x] Não (Não existe input de CNJ no frontend)

**Outras validações:**
- Tipo de arquivo: Apenas `.pdf` (via `react-dropzone`).
- Máximo 1 arquivo por vez.

---

## 4. INTEGRAÇÃO COM WORKSPACE

**Como obtém workspaceId?**
Em `documents-upload-client.tsx`, faz um fetch para a API de workspaces:

```typescript
useEffect(() => {
  const loadWorkspace = async () => {
    // ...
    const response = await fetch('/api/workspaces', ...);
    const result = await response.json();
    if (result.data && result.data.length > 0) {
      setWorkspaceId(result.data[0].id);
    }
    // ...
  };
  loadWorkspace();
}, []);
```

---

## 5. FEEDBACK VISUAL

**Ao adicionar processo com sucesso:**
- Exibe componente `OnboardingProgress` dentro do Dialog.
- Mostra fases: Preview (Concluído), Enriquecimento (Em progresso).
- Redireciona para a página do processo.

**Ao dar erro:**
- Mostra componente `Alert` (vermelho) dentro do Dialog.

---

## 6. BIBLIOTECAS

```json
{
  "react-dropzone": "Sim",
  "framer-motion": "Sim (em onboarding-progress)",
  "lucide-react": "Sim (ícones)"
}
```

**Componentes UI usados:**
- Dialog, Card, Button, Input, Alert, Badge (shadcn/ui provável).

---

## 7. ESTADO GLOBAL

**Gerenciamento:**
- Estado local (`useState`) nos componentes.
- Não parece usar Context/Redux para o fluxo de *criação*, apenas para Auth.

---

## 8. ROUTING

- Rota de upload: `/dashboard/documents-upload`
- Rota de lista: `/dashboard/process`

---

## 9. LACUNAS IDENTIFICADAS (MISSING FEATURES)

**❌ NÃO EXISTE interface para cadastro manual via CNJ.**
O endpoint `/api/process/onboarding` (backend) suporta `cnj`, mas nenhum componente frontend o chama. Todo o onboarding atual é dependente de upload de arquivo PDF.

---

## 10. CÓDIGO COMPLETO (Principais)

### Arquivo: `src/components/onboarding/upload-dialog.tsx`
```tsx
'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, Loader2, AlertTriangle } from 'lucide-react';
import { OnboardingProgress } from './onboarding-progress';
import { ICONS } from '@/lib/icons';
import { uploadFile, formatFileSize } from '@/lib/services/upload-router';

// ... (interfaces omitidas para brevidade, ver arquivo original)

export function UploadDialog({ open, onOpenChange, workspaceId, onUploadSuccess }: UploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  // ...
  
  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      // Upload via Service
      const uploadResult = await uploadFile(
        file,
        workspaceId,
        '', 
        'case-documents',
        (progress) => setUploadProgress(progress)
      );
      
      // ... Lógica de sucesso e redirecionamento
    } catch (err) {
      // ... Lógica de erro
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
       {/* ... JSX do Dialog com Dropzone ... */}
    </Dialog>
  );
}
```

### Arquivo: `src/app/dashboard/documents-upload/documents-upload-client.tsx`
```tsx
'use client';
// ... imports

export default function DocumentsUploadPageClient() {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  
  // Busca workspaceId via API
  useEffect(() => { /* ... fetch /api/workspaces ... */ }, []);

  return (
    <>
      <Card>
        {/* ... Banner e Botão ... */}
        <Button onClick={() => setUploadDialogOpen(true)}>
          Fazer Upload de PDF
        </Button>
      </Card>

      {workspaceId !== null && (
        <UploadDialog
          open={uploadDialogOpen}
          onOpenChange={setUploadDialogOpen}
          workspaceId={workspaceId}
          // ...
        />
      )}
    </>
  );
}
```

---

## 11. SCREENSHOTS (Descrição)

**Página de Upload (/dashboard/documents-upload):**
```
┌────────────────────────────────────────────────────────┐
│  Upload de Documentos                                  │
│  Inicie o fluxo completo...                            │
│                                                        │
│  [ FASE 1 ]  [ FASE 2 ]  [ FASE 3 ]                    │
│  Preview     Enriquec.   Análise                       │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │                                                  │  │
│  │            [ ÍCONE UPLOAD ]                      │  │
│  │             Comece Agora                         │  │
│  │                                                  │  │
│  │        [ BOTÃO: Fazer Upload de PDF ]            │  │
│  │                                                  │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
└────────────────────────────────────────────────────────┘
```

**Modal de Upload:**
```
┌─────────────────────────────────┐
│  Upload de Documento PDF        │
│                                 │
│  ┌───────────────────────────┐  │
│  │    Solte o arquivo aqui   │  │
│  └───────────────────────────┘  │
│                                 │
│       [ Enviar PDF ]            │
└─────────────────────────────────┘
```

**Interface de Cadastro Manual de CNJ:**
```
❌ NÃO EXISTE interface de onboarding manual via CNJ (apenas backend suporta).
```
