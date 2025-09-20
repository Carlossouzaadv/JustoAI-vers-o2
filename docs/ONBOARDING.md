# 🚀 Sistema de Onboarding Customizado

Sistema completo de onboarding construído com componentes nativos do projeto, sem dependências externas.

## 📁 Arquivos Criados

```
src/
├── components/
│   ├── ui/
│   │   └── onboarding.tsx         # Componente principal
│   └── dashboard/
│       ├── onboarding-tour.tsx    # Tour específico do dashboard
│       └── dashboard-example.tsx  # Exemplo de integração
├── hooks/
│   └── use-onboarding-integration.ts # Hooks avançados
├── app/
│   └── onboarding-demo/
│       └── page.tsx              # Página de demonstração
└── docs/
    └── ONBOARDING.md            # Esta documentação
```

## 🎯 Funcionalidades

### ✅ Componente Principal
- **Tooltip posicionável**: Top, bottom, left, right
- **Highlight de elementos**: Destaque visual com animação
- **Navegação completa**: Anterior, próximo, pular, finalizar
- **Ações customizadas**: Botões de ação por step
- **Indicadores de progresso**: Pontos visuais e contador
- **Responsivo**: Funciona em desktop e mobile
- **Acessibilidade**: Navegação por teclado e ARIA

### ✅ Persistência e Estado
- **LocalStorage**: Lembra se o tour foi completado
- **Hook personalizado**: `useOnboarding` para gerenciar estado
- **Múltiplos tours**: Diferentes storage keys para contextos diferentes

### ✅ Integração Avançada
- **Validação de elementos**: Verifica se targets existem
- **Analytics**: Tracking de eventos do onboarding
- **Role-based**: Tours diferentes por tipo de usuário
- **Contextual**: Tours específicos por página

## 🚀 Como Usar

### 1. Implementação Básica

```tsx
import { Onboarding, useOnboarding } from '@/components/ui/onboarding';

const steps = [
  {
    id: 'welcome',
    title: 'Bem-vindo!',
    content: 'Este é o início do tour.',
    target: '[data-onboarding="header"]',
    placement: 'bottom'
  }
];

function MyComponent() {
  const { isActive, completeOnboarding, skipOnboarding } = useOnboarding();

  return (
    <>
      <div data-onboarding="header">
        <h1>Meu Dashboard</h1>
      </div>

      <Onboarding
        steps={steps}
        isActive={isActive}
        onComplete={completeOnboarding}
        onSkip={skipOnboarding}
      />
    </>
  );
}
```

### 2. Implementação com Hook Avançado

```tsx
import { useOnboardingIntegration } from '@/hooks/use-onboarding-integration';

function Dashboard() {
  const {
    isActive,
    completeOnboarding,
    skipOnboarding,
    trackOnboardingEvent
  } = useOnboardingIntegration({
    storageKey: 'dashboard-tour',
    autoStart: true,
    startDelay: 2000
  });

  return (
    // Seu componente
  );
}
```

### 3. Tour Baseado em Role

```tsx
import { useRoleBasedOnboarding } from '@/hooks/use-onboarding-integration';

function DashboardPage({ userRole }) {
  const onboarding = useRoleBasedOnboarding(userRole);

  // Cada role terá seu próprio tour personalizado
}
```

## 📝 Configuração de Steps

### Estrutura do Step

```typescript
interface OnboardingStep {
  id: string;                    // Identificador único
  title: string;                 // Título do tooltip
  content: string;               // Conteúdo explicativo
  target: string;                // Seletor CSS do elemento
  placement?: 'top' | 'bottom' | 'left' | 'right';
  showSkip?: boolean;            // Mostrar botão "Pular"
  action?: {                     // Ação customizada
    label: string;
    onClick: () => void;
  };
}
```

### Exemplo Completo

```typescript
const dashboardSteps: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Bem-vindo ao Dashboard! 🎉',
    content: 'Vamos fazer um tour pelas principais funcionalidades.',
    target: '[data-onboarding="header"]',
    placement: 'bottom'
  },
  {
    id: 'add-button',
    title: 'Adicionar Novo Item',
    content: 'Clique aqui para adicionar um novo item.',
    target: '[data-onboarding="add-button"]',
    placement: 'bottom',
    action: {
      label: 'Tentar Agora',
      onClick: () => openAddModal()
    }
  }
];
```

## 🎨 Personalização Visual

### CSS Classes Disponíveis

O componente usa as classes do Tailwind já configuradas no projeto:

- **Background**: `bg-black/50` para o backdrop
- **Highlight**: `border-accent-500` para destaque
- **Tooltip**: `bg-white border-accent-500` para o card
- **Botões**: `bg-accent-500` para ações primárias

### Modificando Estilos

Edite diretamente no componente `onboarding.tsx`:

```tsx
// Exemplo: Mudar cor do highlight
<div className="border-4 border-primary-500 rounded-lg" />

// Exemplo: Mudar cor dos botões
<Button className="bg-primary-500 hover:bg-primary-600" />
```

## 🔧 Integração no Dashboard Existente

### 1. Adicionar Atributos nos Elementos

```tsx
// Antes
<Button>Adicionar Cliente</Button>

// Depois
<Button data-onboarding="add-client-button">
  Adicionar Cliente
</Button>
```

### 2. Importar o Componente

```tsx
import { DashboardOnboarding } from '@/components/dashboard/onboarding-tour';

function Dashboard() {
  return (
    <div>
      <DashboardOnboarding />
      {/* Resto do dashboard */}
    </div>
  );
}
```

### 3. Customizar Steps

Edite o arquivo `onboarding-tour.tsx` para ajustar:
- Textos dos steps
- Targets dos elementos
- Ações customizadas
- Ordem do tour

## 📱 Responsividade

### Mobile
- Tooltips se ajustam automaticamente
- Opção de pular tour em telas pequenas
- Touch gestures suportados

### Desktop
- Posicionamento preciso
- Hover effects
- Navegação por teclado

## 🧪 Testando o Onboarding

### 1. Página de Demonstração

Acesse: `http://localhost:3000/onboarding-demo`

Esta página contém um dashboard exemplo com o onboarding funcionando.

### 2. Reset do Tour

Em modo desenvolvimento, aparece um botão "Reiniciar Tour" para testar novamente.

### 3. LocalStorage

Para resetar manualmente:
```javascript
localStorage.removeItem('dashboard-onboarding');
```

## 📊 Analytics e Tracking

### Eventos Automáticos

O sistema já tracka automaticamente:
- `onboarding_started`
- `onboarding_completed`
- `onboarding_skipped`
- `onboarding_reset`

### Integração com Google Analytics

```tsx
// No hook use-onboarding-integration.ts
const trackOnboardingEvent = useCallback((event: string, data?: Record<string, any>) => {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', 'onboarding', {
      event_category: 'user_engagement',
      event_label: event,
      custom_parameters: data
    });
  }
}, []);
```

## 🔄 Múltiplos Tours

Você pode ter diferentes tours para diferentes contextos:

```tsx
// Tour do dashboard principal
const dashboardOnboarding = useOnboarding('dashboard-tour');

// Tour da página de relatórios
const reportsOnboarding = useOnboarding('reports-tour');

// Tour para primeiros usuários
const firstTimeOnboarding = useOnboarding('first-time-tour');
```

## 🚨 Troubleshooting

### Tooltip não aparece
1. Verifique se o elemento target existe no DOM
2. Confirme se o atributo `data-onboarding` está correto
3. Certifique-se que não há CSS sobrepondo com z-index maior

### Tour não inicia automaticamente
1. Verifique se `localStorage` não tem a chave já marcada como completed
2. Confirme se `autoStart` está true
3. Verifique se não há erros no console

### Elementos não são destacados
1. Confirme se o seletor CSS está correto
2. Verifique se o elemento é visível (não hidden)
3. Teste com elementos que têm dimensões definidas

## 🎉 Próximos Passos

1. **Integre no seu dashboard real**: Adicione os atributos `data-onboarding`
2. **Customize os steps**: Ajuste textos e ações para seu contexto
3. **Teste em diferentes devices**: Verifique responsividade
4. **Configure analytics**: Integre com sua solução de tracking
5. **Crie tours específicos**: Para diferentes tipos de usuário

---

## 💡 Dicas Importantes

- ✅ Use IDs únicos para cada step
- ✅ Teste o tour em diferentes resoluções
- ✅ Mantenha textos concisos e claros
- ✅ Use ações customizadas para engajar o usuário
- ✅ Configure delays apropriados para carregamento
- ✅ Implemente analytics para métricas de sucesso

**Sistema totalmente funcional e pronto para produção!** 🚀