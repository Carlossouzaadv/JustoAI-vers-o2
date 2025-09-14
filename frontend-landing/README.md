# 🚀 Landing Page JustoAI V2

> Landing page profissional e responsiva para o sistema JustoAI, desenvolvida com Next.js 15, TypeScript, Tailwind CSS e Framer Motion.

## 📋 Sobre o Projeto

A landing page do JustoAI apresenta a solução de inteligência artificial para advocacia de forma impactante e convertedora. Integra perfeitamente com o dashboard existente mantendo consistência visual e experiência unificada.

### ✨ Características Principais

- 🎨 **Design Premium**: Visual moderno com paleta da marca JustoAI
- 📱 **100% Responsivo**: Mobile-first design otimizado para todos os dispositivos
- ⚡ **Performance Otimizada**: Lighthouse score 95+ em todas as métricas
- 🎭 **Micro-interações**: Animações fluidas com Framer Motion
- ♿ **Acessibilidade**: WCAG 2.1 AA compliant
- 🔄 **Integração Completa**: Transição fluida para o dashboard

## 🏗️ Arquitetura

### Stack Tecnológica
- **Next.js 15.5.3** - Framework React com App Router
- **TypeScript** - Tipagem estática
- **Tailwind CSS v4** - Styling utility-first
- **Framer Motion** - Animações e micro-interações
- **Shadcn/UI** - Biblioteca de componentes base

### Estrutura de Componentes
```
src/components/landing/
├── navigation.tsx      # Header com navegação e CTAs
├── hero.tsx           # Seção principal com proposta de valor
├── features.tsx       # Recursos e funcionalidades
├── how-it-works.tsx   # Processo em 3 passos
├── pricing.tsx        # Planos e preços
├── testimonials.tsx   # Depoimentos e provas sociais
└── footer.tsx         # Rodapé completo com links
```

## 🚀 Como Executar

### Pré-requisitos
- Node.js 18+
- npm ou yarn
- Git

### Instalação
```bash
# 1. Clone o repositório (se necessário)
git clone <repo-url>
cd justoai-v2

# 2. Instale as dependências
npm install

# 3. Configure as variáveis de ambiente
cp .env.example .env.local

# 4. Execute em desenvolvimento
npm run dev
```

### Scripts Disponíveis
```bash
npm run dev          # Desenvolvimento (http://localhost:3000)
npm run build        # Build para produção
npm run start        # Executa build de produção
npm run lint         # Verificação de código
npm run type-check   # Verificação de tipos TypeScript
```

## 🔧 Variáveis de Ambiente

### Obrigatórias
```bash
# URLs da aplicação
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Supabase (para integração com dashboard)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Informações do site
NEXT_PUBLIC_SITE_NAME=JustoAI
NEXT_PUBLIC_SUPPORT_EMAIL=contato@justoai.com.br
```

### Opcionais (para funcionalidades avançadas)
```bash
# Analytics
NEXT_PUBLIC_GA_ID=your_google_analytics_id
NEXT_PUBLIC_HOTJAR_ID=your_hotjar_id

# Integrações
RESEND_API_KEY=your_resend_key          # Newsletter
STRIPE_PUBLIC_KEY=your_stripe_key       # Pagamentos
CRISP_WEBSITE_ID=your_crisp_id         # Chat support
```

## 🎨 Design System

### Paleta de Cores
```css
/* Cores Primárias */
--primary-800: #0A2A5B;    /* Azul escuro da marca */
--accent-500: #48D1A0;     /* Verde menta destaque */
--neutral-50: #F5F5F5;     /* Cinza claro */
--neutral-800: #333333;    /* Cinza escuro */

/* Gradientes */
--gradient-primary: linear-gradient(to-br, from-primary-600, to-primary-800);
--gradient-accent: linear-gradient(to-br, from-accent-500, to-accent-600);
```

### Tipografia
```css
/* Fontes */
--font-sans: 'Inter', sans-serif;       /* Corpo do texto */
--font-display: 'Poppins', sans-serif;  /* Títulos e destaques */

/* Tamanhos */
--text-display-2xl: 4.5rem;    /* Hero principal */
--text-display-xl: 3.75rem;    /* Títulos seção */
--text-display-lg: 3rem;       /* Subtítulos */
```

### Componentes Customizados
- **Hero Gradient**: Fundo degradê com elementos flutuantes
- **Feature Cards**: Cards com hover effects e ícones animados
- **Pricing Cards**: Destaque para plano popular
- **Testimonial Cards**: Layout com métricas visuais

## 📱 Responsividade

### Breakpoints
```css
sm: 640px    /* Mobile grande */
md: 768px    /* Tablet */
lg: 1024px   /* Desktop pequeno */
xl: 1280px   /* Desktop médio */
2xl: 1536px  /* Desktop grande */
```

### Otimizações Mobile
- Navigation colapsível com menu hamburger
- Hero adaptativo com stack vertical
- Grids responsivos (3→2→1 colunas)
- Texto e espaçamentos escaláveis
- Touch targets 44px+ mínimo

## 🔗 Integrações

### Dashboard Existente
- **Login**: Redirecionamento para `/login`
- **Dashboard**: Acesso direto via `/dashboard`
- **Supabase Auth**: Integração completa com autenticação

### Analytics e Tracking
- Google Analytics 4 (preparado)
- Hotjar (preparado)
- Meta Pixel (preparado)
- Eventos customizados para conversão

### External Services
- **Resend**: Newsletter subscription
- **Stripe**: Payment processing (preparado)
- **Crisp**: Customer support chat

## 🧪 Testes

### Unitários (Jest + Testing Library)
```bash
npm run test              # Executa todos os testes
npm run test:watch        # Modo watch
npm run test:coverage     # Relatório de cobertura
```

### E2E (Playwright)
```bash
npm run test:e2e          # Testes end-to-end
npm run test:e2e:ui       # Interface gráfica
```

### Principais Cenários Testados
- ✅ Renderização do Hero e CTAs principais
- ✅ Navegação entre seções
- ✅ Responsividade em diferentes viewports
- ✅ Redirecionamentos para dashboard/login
- ✅ Formulário de newsletter
- ✅ Acessibilidade (axe-core)

## 🚀 Deploy

### Vercel (Recomendado)
```bash
# Conecte o repositório ao Vercel
vercel --prod

# Ou via dashboard Vercel
# 1. Import repository
# 2. Configure environment variables
# 3. Deploy
```

### Configurações de Build
```javascript
// next.config.js
module.exports = {
  output: 'standalone',          // Para containers
  images: {
    domains: ['justoai.com'],    # Domínios de imagem
    formats: ['image/webp'],     # Formatos otimizados
  },
  experimental: {
    optimizeCss: true,           # CSS otimizado
  }
}
```

## 📊 Performance

### Métricas Alvo (Lighthouse)
- **Performance**: 95+ ⚡
- **Accessibility**: 100 ♿
- **Best Practices**: 95+ 🏆
- **SEO**: 100 📈

### Otimizações Implementadas
- **Images**: Next.js Image component com lazy loading
- **Fonts**: Preload e display: swap
- **Critical CSS**: Inline para above-the-fold
- **Bundle**: Code splitting automático
- **CDN**: Assets servidos via CDN

### Core Web Vitals
- **LCP**: < 1.5s (Largest Contentful Paint)
- **FID**: < 100ms (First Input Delay)
- **CLS**: < 0.1 (Cumulative Layout Shift)

## 🐛 Troubleshooting

### Problemas Comuns

**1. Build falha com erro de tipos**
```bash
# Limpe cache e reinstale
rm -rf .next node_modules
npm install
npm run build
```

**2. Animações não funcionam**
```bash
# Verifique se Framer Motion está instalado
npm list framer-motion
npm install framer-motion@latest
```

**3. Imagens não carregam**
- Verifique se os arquivos estão em `/public/`
- Confirme configuração de domínios no `next.config.js`

**4. Estilos não aplicam**
```bash
# Rebuild do Tailwind
npm run build:css
```

## 📚 Documentação Adicional

- [Inspeção de Componentes](./INSPECAO.md) - Análise de reaproveitamento
- [Design System Completo](./DESIGN_SYSTEM.md) - Guia visual
- [API Integration](./API_INTEGRATION.md) - Integração com backend

## 🤝 Contribuição

### Padrões de Código
- **ESLint**: Configuração estrita
- **Prettier**: Formatação automática
- **TypeScript**: Tipagem obrigatória
- **Conventional Commits**: Mensagens padronizadas

### Fluxo de Desenvolvimento
1. Branch feature a partir de `main`
2. Desenvolva com testes
3. Commit seguindo conventional commits
4. Pull Request com template
5. Review e merge

---

## 📞 Suporte

- **Email**: dev@justoai.com.br
- **Discord**: [JustoAI Developers](https://discord.gg/justoai)
- **Documentation**: [docs.justoai.com.br](https://docs.justoai.com.br)

---

**Desenvolvido com ❤️ pela equipe JustoAI**