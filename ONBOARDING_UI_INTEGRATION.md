# Integração da Interface de Onboarding 3-Fases

## 📋 Visão Geral

A novo interface de onboarding foi construída para mostrar as 3 fases do processamento de documentos:

1. **FASE 1 - Preview Inteligente** (Instantâneo, Gratuito)
2. **FASE 2 - Enriquecimento Oficial** (Background, Automático, Gratuito)
3. **FASE 3 - Análise Estratégica** (Sob Demanda, Pago)

## 🎯 Componentes Criados

### 1. `OnboardingProgress` (onboarding-progress.tsx)
Componente central que mostra o progresso em tempo real.

**Props:**
```typescript
interface OnboardingProgressProps {
  caseId: string;
  juditJobId?: string;
  extractedProcessNumber?: string;
  previewData?: any;
  onPhaseComplete?: (phase: 'PREVIEW' | 'ENRICHMENT') => void;
  onAnalyzeClick?: () => void;
}
```

**Recursos:**
- Polling automático para status do job JUDIT (1s de intervalo)
- Indicadores visuais para cada fase
- Barras de progresso para FASE 2
- Detalhes expandíveis
- CTA para FASE 3 quando pronto

### 2. `UploadDialog` (upload-dialog.tsx)
Modal completo com fluxo de upload e progresso.

**Props:**
```typescript
interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  onUploadSuccess?: (data: any) => void;
}
```

**Recursos:**
- Drag & drop para PDF
- Upload com progresso
- Exibição de fases em tempo real
- Resumo dos dados extraídos

### 3. `PreviewResults` (preview-results.tsx)
Exibe dados extraídos da FASE 1.

**Variantes:**
- `PreviewResults`: Versão completa com todos os detalhes
- `PreviewResultsCompact`: Versão reduzida para cards

### 4. `ProcessOnboardingStatus` (process-onboarding-status.tsx)
Painel de status completo para página de processo.

**Variantes:**
- `ProcessOnboardingStatus`: Versão completa (expansível)
- `ProcessOnboardingStatusCompact`: Versão resumida para sidebars

## 📍 Páginas Criadas/Atualizadas

### Nova Página: `/dashboard/documents-upload`
Página dedicada para upload de documentos com explicação clara das 3 fases.

**Features:**
- Grid visual das 3 fases
- CTA principal para upload
- FAQ rápido
- Informações sobre formatos e limitações

## 🔄 Integração com Páginas Existentes

### Para `/dashboard/cases` ou listagem de casos:
```typescript
import { UploadDialog } from '@/components/onboarding/upload-dialog';

export function CasesPage() {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [workspaceId, setWorkspaceId] = useState('');

  return (
    <>
      <Button onClick={() => setUploadOpen(true)}>
        Upload PDF
      </Button>

      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        workspaceId={workspaceId}
      />
    </>
  );
}
```

### Para `/dashboard/processes/[id]` (página de detalhes do processo):
```typescript
import { ProcessOnboardingStatus } from '@/components/process/process-onboarding-status';

export function ProcessDetailsPage({ caseId, caseData }: any) {
  return (
    <div>
      {/* Outras seções... */}

      {/* Mostrar status do onboarding */}
      <ProcessOnboardingStatus
        caseId={caseId}
        processNumber={caseData.number}
        juditJobId={caseData.juditJobId}
        previewData={caseData.previewSnapshot}
        onAnalyzeClick={() => handleAnalyze(caseId)}
      />
    </div>
  );
}
```

### Para sidebars ou cards compactos:
```typescript
import { ProcessOnboardingStatusCompact } from '@/components/process/process-onboarding-status';

// Em um card de processo
<ProcessOnboardingStatusCompact
  processNumber={process.number}
  juditJobId={process.juditJobId}
  previewData={process.previewSnapshot}
/>
```

## 🚀 API Integration

### Response esperado de `/api/documents/upload`:
```typescript
{
  success: true,
  message: "PDF processado com sucesso - FASE 1 concluída!...",
  data: {
    documentId: string;
    caseId: string;
    textSha: string;
    extractedProcessNumber: string;
    juditJobId: string; // ← Para rastrear FASE 2

    onboardingPhase: {
      current: 'PREVIEW';
      next: 'ENRICHMENT';
      nextAction: 'Aguardando histórico oficial do tribunal';
    };

    processing: {
      totalTime: number;
      textExtracted: boolean;
      aiAnalyzed: boolean;
      cacheHit: boolean;
      juditJobQueued: boolean; // ← Indica se FASE 2 foi ativada
    };

    analysis: {
      modelUsed: string;
      confidence: number;
      costEstimate: number;
    };

    file: {
      name: string;
      size: number;
      pages: number;
      textLength: number;
    };
  }
}
```

### Para monitorar status do job (FASE 2):
```
GET /api/judit/onboarding/status/[jobId]
```

Response:
```typescript
{
  success: true;
  data: {
    jobId: string;
    status: 'waiting' | 'active' | 'completed' | 'failed';
    statusDescription: string;
    progress: number; // 0-100
    result: any;
    error?: string;
    isComplete: boolean;
    isFailed: boolean;
  }
}
```

## 📊 Fluxo de Dados

```
1. Usuário faz upload
   ↓
2. Frontend chama /api/documents/upload
   ↓
3. Backend processa FASE 1 (Preview)
   ↓
4. Backend queue JUDIT job (FASE 2 iniciada)
   ↓
5. Response inclui juditJobId
   ↓
6. Frontend exibe OnboardingProgress
   ↓
7. Polling a cada 1s para /api/judit/onboarding/status/[jobId]
   ↓
8. Status atualiza em tempo real
   ↓
9. Quando completado: CTA para FASE 3
```

## 🎨 Componentes de UI Utilizados

- `Card` (CardHeader, CardContent, CardTitle, CardDescription)
- `Button`
- `Badge`
- `Progress`
- `Alert` (AlertDescription)
- `Tabs` (TabsList, TabsTrigger, TabsContent)
- `Dialog` (DialogContent, DialogHeader, DialogTitle, DialogDescription)

Todos os ícones usam o ICONS object do projeto.

## 🔧 Customização

### Mudar intervalo de polling:
Em `onboarding-progress.tsx`, linha 76:
```typescript
pollInterval = setInterval(pollStatus, 1000); // Mudar 1000ms para outro valor
```

### Mudar máximo de tentativas de polling:
Em `onboarding-progress.tsx`, linha 72:
```typescript
const maxAttempts = 600; // 10 minutos (600 * 1s)
```

### Cores das fases:
Editar as classes de cores nos badges de status (ex: `bg-green-100`, `bg-blue-100`)

## 📝 Próximos Passos

1. **Integrar componentes nas páginas existentes** (dashboard/cases, dashboard/processes)
2. **Testar polling com job real** do JUDIT
3. **Implementar notificações** quando FASE 2/3 completarem
4. **Analytics** para rastrear sucesso do onboarding
5. **Melhorias UX** baseadas no feedback de usuários

## 🐛 Troubleshooting

### Polling não está atualizando?
- Verificar se `juditJobId` está sendo passado
- Verificar console do browser para erros de fetch
- Verificar se `/api/judit/onboarding/status/[jobId]` está retornando dados

### FASE 2 não está sendo iniciada?
- Verificar se `addOnboardingJob` está sendo chamado em `/api/documents/upload`
- Verificar logs do servidor para erros de queue
- Confirmar que BullMQ está conectado

### Componentes não aparecem?
- Verificar imports
- Verificar se Dialog, Tabs e outros componentes de UI estão instalados
- Verificar se ICONS está disponível

## 📞 Suporte

Para dúvidas ou problemas, consulte:
- Logs do servidor (`/api/documents/upload`)
- Logs do job (`/api/judit/onboarding/status`)
- Console do browser (DevTools → Console)
