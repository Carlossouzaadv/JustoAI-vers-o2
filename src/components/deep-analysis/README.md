# Deep Analysis Modal Component

Sistema completo de análise profunda para processos jurídicos com opções FAST e FULL.

## Funcionalidades Implementadas

✅ **Modal responsivo** com opções FAST/FULL
✅ **Upload de PDFs** com drag & drop
✅ **Seleção de documentos existentes**
✅ **Estimativa de créditos** em tempo real
✅ **Progress indicators** durante processamento
✅ **Error handling** com mensagens específicas
✅ **Cache detection** e opções de reprocessamento
✅ **Integração completa** com API endpoints

## Uso Básico

### Opção 1: Botão Pré-configurado (Recomendado)

```tsx
import { DeepAnalysisButton } from '@/components/deep-analysis';

function ProcessPage({ processId, workspaceId }) {
  const existingDocs = [
    {
      id: 'doc1',
      name: 'contrato.pdf',
      size: 123456,
      uploadedAt: '2024-01-15T10:00:00Z'
    }
  ];

  const handleAnalysisComplete = (result) => {
    console.log('Análise concluída:', result);
    // Atualizar estado, redirecionar, etc.
  };

  return (
    <div>
      <DeepAnalysisButton
        processId={processId}
        workspaceId={workspaceId}
        existingDocuments={existingDocs}
        onAnalysisComplete={handleAnalysisComplete}
      />
    </div>
  );
}
```

### Opção 2: Controle Manual com Hook

```tsx
import { DeepAnalysisModal, useDeepAnalysis } from '@/components/deep-analysis';

function ProcessPage({ processId, workspaceId }) {
  const { modalProps, openAnalysisModal } = useDeepAnalysis({
    processId,
    workspaceId,
    onAnalysisComplete: (result) => {
      console.log('Análise concluída:', result);
    }
  });

  return (
    <div>
      <button onClick={openAnalysisModal}>
        Abrir Análise Personalizada
      </button>

      <DeepAnalysisModal {...modalProps} />
    </div>
  );
}
```

### Opção 3: Controle Completo do Estado

```tsx
import { useState } from 'react';
import { DeepAnalysisModal } from '@/components/deep-analysis';

function ProcessPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div>
      <button onClick={() => setIsModalOpen(true)}>
        Análise Avançada
      </button>

      <DeepAnalysisModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        processId="process-123"
        workspaceId="workspace-456"
        onAnalysisComplete={(result) => {
          console.log(result);
          setIsModalOpen(false);
        }}
      />
    </div>
  );
}
```

## Props da Interface

### DeepAnalysisModalProps

```tsx
interface DeepAnalysisModalProps {
  isOpen: boolean;                    // Estado de abertura do modal
  onClose: () => void;                // Callback para fechar modal
  processId: string;                  // ID do processo
  workspaceId: string;               // ID do workspace
  existingDocuments?: Array<{        // Documentos já anexados (opcional)
    id: string;
    name: string;
    size: number;
    uploadedAt: string;
  }>;
  onAnalysisComplete?: (result: any) => void; // Callback após análise
}
```

### DeepAnalysisButtonProps

```tsx
interface DeepAnalysisButtonProps {
  processId: string;
  workspaceId: string;
  existingDocuments?: Array<Document>;
  onAnalysisComplete?: (result: any) => void;
  variant?: 'default' | 'outline' | 'secondary';  // Estilo do botão
  size?: 'default' | 'sm' | 'lg';                 // Tamanho do botão
  className?: string;                             // Classes CSS adicionais
}
```

## Fluxos de Análise

### Análise FAST
1. ✅ Usa documentos já anexados ao processo
2. ✅ Sem consumo de créditos FULL
3. ✅ Cache automático baseado em analysis_key
4. ✅ Resultado em segundos
5. ✅ Modelo: Gemini Flash

### Análise FULL
1. ✅ Upload de novos PDFs ou seleção de existentes
2. ✅ Consome créditos FULL (FIFO)
3. ✅ Validação de saldo antes do processamento
4. ✅ Cache inteligente com opção de reprocessamento
5. ✅ Modelo: Gemini Pro
6. ✅ Error 402 se créditos insuficientes

## Estados do Componente

### Loading States
- `Verificando cache...`
- `Preparando arquivos...`
- `Enviando para análise...`
- `Processando com Gemini Pro...`
- `Análise concluída!`

### Error States
- Créditos insuficientes (com sugestão de compra)
- Falha na API
- Erro de upload
- Timeout de processamento

### Success States
- Cache hit (análise instantânea)
- Nova análise processada
- Upload concluído

## Integração com APIs

O componente se integra automaticamente com os endpoints:

```bash
POST /api/process/{id}/analysis/fast    # Análise FAST
POST /api/process/{id}/analysis/full    # Análise FULL
GET  /api/process/{id}/analysis/history # Histórico (opcional)
```

## Customização

### Estilos
O componente usa Tailwind CSS e pode ser customizado via:
- Classes CSS customizadas
- Variáveis CSS
- Temas dark/light (suporte automático)

### Comportamento
- Upload automático vs manual
- Validação personalizada de arquivos
- Callbacks customizados para cada etapa
- Integração com sistemas de notificação

## Dependências

- `@radix-ui/react-dialog` - Modal base
- `@radix-ui/react-checkbox` - Seleção de arquivos
- `@radix-ui/react-progress` - Barra de progresso
- `react-dropzone` - Upload drag & drop
- Componentes UI internos (Button, Card, etc.)

## Exemplo Completo

```tsx
// pages/process/[id]/index.tsx
import { DeepAnalysisButton } from '@/components/deep-analysis';
import { useState, useEffect } from 'react';

export default function ProcessDetailPage({ params }) {
  const [processData, setProcessData] = useState(null);
  const [documents, setDocuments] = useState([]);

  useEffect(() => {
    // Carregar dados do processo e documentos
    loadProcessData(params.id);
  }, [params.id]);

  const handleAnalysisComplete = (result) => {
    // Adicionar nova análise ao estado
    setProcessData(prev => ({
      ...prev,
      latestAnalysis: result
    }));

    // Mostrar notificação de sucesso
    toast.success('Análise concluída com sucesso!');

    // Opcional: redirecionar para página de resultado
    router.push(`/process/${params.id}/analysis/${result.versionNumber}`);
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1>Processo #{processData?.number}</h1>

        <DeepAnalysisButton
          processId={params.id}
          workspaceId={processData?.workspaceId}
          existingDocuments={documents}
          onAnalysisComplete={handleAnalysisComplete}
          variant="default"
          size="lg"
        />
      </div>

      {/* Resto da página */}
    </div>
  );
}
```

## Testes

Para testar o componente:

```bash
# Executar testes do componente
npm test deep-analysis

# Testar endpoints relacionados
npm test deep-analysis.test.ts
```

## Próximos Passos

- [ ] Adicionar suporte a arrastar múltiplos arquivos
- [ ] Integração com sistema de notificações push
- [ ] Preview de PDFs antes do upload
- [ ] Histórico de análises no próprio modal
- [ ] Exportação de resultados
- [ ] Integração com webhooks

## Suporte

Para dúvidas sobre implementação ou bugs, consulte:
- Documentação da API: `/docs/deep-analysis-implementation.md`
- Testes unitários: `/tests/deep-analysis.test.ts`
- Endpoints: `/src/app/api/process/[id]/analysis/*/route.ts`