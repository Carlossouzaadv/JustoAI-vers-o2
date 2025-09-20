export interface Article {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  author: {
    name: string;
    bio: string;
    avatar?: string;
  };
  publishedAt: string;
  updatedAt?: string;
  category: string;
  tags: string[];
  readTime: number;
  featured: boolean;
  tableOfContents?: TableOfContentsItem[];
}

export interface TableOfContentsItem {
  id: string;
  title: string;
  level: number;
}

export const articles: Article[] = [
  {
    id: 'economizar-20-horas-automacao-juridica',
    title: 'Como Economizar 20 Horas por Semana com Automação Jurídica',
    excerpt: 'Descubra as estratégias que escritórios de sucesso usam para otimizar tempo e impressionar clientes.',
    content: `
# Como Economizar 20 Horas por Semana com Automação Jurídica

A automação jurídica não é mais uma tendência futura - é uma necessidade presente para escritórios que querem se manter competitivos.

## Por que a Automação é Essencial?

No mundo jurídico atual, onde o tempo é literalmente dinheiro, a capacidade de automatizar tarefas repetitivas pode significar a diferença entre o sucesso e o fracasso de um escritório.

### Benefícios Imediatos

- **Redução de tempo em tarefas manuais**: Até 70% menos tempo gasto em atividades administrativas
- **Maior precisão**: Eliminação de erros humanos em processos padronizados
- **Melhor experiência do cliente**: Relatórios automáticos e comunicação mais eficiente

## Implementação Prática

[Veja na prática como a JustoAI automatiza a criação de relatórios. Inicie seu teste de 7 dias.](/signup)

A implementação de automação deve ser gradual e estratégica. Comece identificando os processos que consomem mais tempo da sua equipe.

### Passos para Começar

1. **Mapeamento de processos**: Identifique tarefas repetitivas
2. **Priorização**: Foque nas atividades que mais consomem tempo
3. **Implementação gradual**: Comece com um processo por vez
4. **Treinamento da equipe**: Garanta que todos saibam usar as ferramentas

## Ferramentas Essenciais

A escolha das ferramentas certas é fundamental para o sucesso da automação:

- **Sistemas de gestão integrados**
- **Automação de relatórios**
- **Notificações inteligentes de prazos**
- **Análise automática de documentos**

## Conclusão

A automação jurídica já é uma realidade e escritórios que não se adaptarem ficarão para trás. O investimento inicial se paga rapidamente com a economia de tempo e o aumento da qualidade dos serviços.

*Quer ver como funciona na prática? [Experimente a JustoAI gratuitamente por 7 dias](/signup) e descubra como economizar 20 horas por semana.*
    `,
    author: {
      name: 'Carlos - Fundador JustoAI',
      bio: 'Advogado há mais de 15 anos, especialista em direito tributário e societário. Fundador da JustoAI e apaixonado por tecnologia aplicada ao direito.'
    },
    publishedAt: '2025-09-18',
    category: 'Produtividade',
    tags: ['automação', 'produtividade', 'tecnologia jurídica'],
    readTime: 5,
    featured: true,
    tableOfContents: [
      { id: 'por-que-automacao', title: 'Por que a Automação é Essencial?', level: 2 },
      { id: 'implementacao-pratica', title: 'Implementação Prática', level: 2 },
      { id: 'ferramentas-essenciais', title: 'Ferramentas Essenciais', level: 2 },
      { id: 'conclusao', title: 'Conclusão', level: 2 }
    ]
  },
  {
    id: 'relatorios-executivos-diferencial-advogado',
    title: 'Relatórios Executivos: O Diferencial do Advogado Moderno',
    excerpt: 'Aprenda como relatórios automáticos transformam a comunicação com clientes e aumentam a satisfação.',
    content: `
# Relatórios Executivos: O Diferencial do Advogado Moderno

A comunicação clara e profissional com clientes é o que diferencia advogados excepcionais dos demais.

## O Poder dos Relatórios Executivos

Relatórios bem estruturados não apenas informam - eles impressionam, tranquilizam e demonstram profissionalismo.

### Impacto na Satisfação do Cliente

- **Transparência total**: Cliente sempre informado sobre o andamento
- **Profissionalismo**: Apresentação clara e organizada das informações
- **Confiança**: Demonstração de controle e competência

## Estrutura Ideal de um Relatório

[Descubra como a JustoAI cria relatórios profissionais automaticamente. Teste grátis por 7 dias.](/signup)

### Elementos Essenciais

1. **Resumo executivo**: Visão geral em linguagem clara
2. **Status atual**: Situação detalhada de cada processo
3. **Próximos passos**: Ações planejadas e prazos
4. **Recomendações**: Orientações estratégicas

## Automatização de Relatórios

A tecnologia permite criar relatórios consistentes e profissionais sem esforço manual:

- **Templates padronizados**
- **Atualização automática de dados**
- **Personalização por cliente**
- **Entrega programada**

## ROI dos Relatórios Automatizados

O retorno sobre investimento em automação de relatórios é impressionante:

- **Redução de 90% no tempo** de preparação
- **Aumento de 40% na satisfação** do cliente
- **Maior retenção** de clientes
- **Diferenciação competitiva** significativa

## Conclusão

Relatórios executivos automatizados são mais que uma conveniência - são uma estratégia de crescimento para escritórios modernos.
    `,
    author: {
      name: 'Carlos - Fundador JustoAI',
      bio: 'Advogado há mais de 15 anos, especialista em direito tributário e societário. Fundador da JustoAI e apaixonado por tecnologia aplicada ao direito.'
    },
    publishedAt: '2025-09-10',
    category: 'Comunicação',
    tags: ['relatórios', 'comunicação', 'clientes'],
    readTime: 7,
    featured: false,
    tableOfContents: [
      { id: 'poder-relatorios', title: 'O Poder dos Relatórios Executivos', level: 2 },
      { id: 'estrutura-ideal', title: 'Estrutura Ideal de um Relatório', level: 2 },
      { id: 'automatizacao', title: 'Automatização de Relatórios', level: 2 },
      { id: 'roi', title: 'ROI dos Relatórios Automatizados', level: 2 }
    ]
  },
  {
    id: 'lgpd-advocacia-protecao-dados-2024',
    title: 'LGPD na Advocacia: Proteção de Dados em 2024',
    excerpt: 'Entenda as principais mudanças na proteção de dados e como manter seu escritório em compliance.',
    content: `
# LGPD na Advocacia: Proteção de Dados em 2024

A Lei Geral de Proteção de Dados não é apenas uma regulamentação - é uma oportunidade para escritórios demonstrarem confiabilidade.

## Cenário Atual da LGPD

Em 2024, a fiscalização da ANPD se intensificou, tornando o compliance uma necessidade urgente para todos os escritórios.

### Principais Mudanças em 2024

- **Multas mais rigorosas**: Aplicação efetiva das penalidades
- **Fiscalização ativa**: Inspeções regulares em escritórios
- **Responsabilização solidária**: Operadores também respondem por violações

## Dados Sensíveis na Advocacia

[Proteja os dados dos seus clientes com as ferramentas certas. Conheça as soluções da JustoAI.](/signup)

Escritórios de advocacia lidam diariamente com dados extremamente sensíveis:

- **Informações pessoais** dos clientes
- **Dados financeiros** e patrimoniais
- **Informações processuais** confidenciais
- **Correspondências** privilegiadas

## Implementação Prática do Compliance

### Medidas Essenciais

1. **Mapeamento de dados**: Identifique todos os dados coletados
2. **Base legal**: Defina a base legal para cada tratamento
3. **Consentimento**: Obtenha consentimento claro quando necessário
4. **Segurança**: Implemente medidas técnicas adequadas

## Tecnologia a Favor do Compliance

Ferramentas modernas facilitam a adequação à LGPD:

- **Criptografia automática** de dados
- **Controle de acesso** granular
- **Logs de auditoria** detalhados
- **Backup seguro** e recuperação

## Riscos de Não Conformidade

- **Multas**: Até 2% do faturamento anual
- **Danos à reputação**: Perda de confiança dos clientes
- **Responsabilização pessoal**: Sócios podem responder individualmente
- **Perda de clientes**: Migração para concorrentes compliance

## Conclusão

A LGPD não deve ser vista como obstáculo, mas como diferencial competitivo. Escritórios compliance atraem mais clientes e inspiram maior confiança.
    `,
    author: {
      name: 'Carlos - Fundador JustoAI',
      bio: 'Advogado há mais de 15 anos, especialista em direito tributário e societário. Fundador da JustoAI e apaixonado por tecnologia aplicada ao direito.'
    },
    publishedAt: '2025-09-02',
    category: 'Compliance',
    tags: ['LGPD', 'proteção de dados', 'compliance'],
    readTime: 10,
    featured: false,
    tableOfContents: [
      { id: 'cenario-atual', title: 'Cenário Atual da LGPD', level: 2 },
      { id: 'dados-sensiveis', title: 'Dados Sensíveis na Advocacia', level: 2 },
      { id: 'implementacao-pratica', title: 'Implementação Prática do Compliance', level: 2 },
      { id: 'tecnologia-compliance', title: 'Tecnologia a Favor do Compliance', level: 2 },
      { id: 'riscos', title: 'Riscos de Não Conformidade', level: 2 }
    ]
  }
];

export function getArticleById(id: string): Article | undefined {
  return articles.find(article => article.id === id);
}

export function getFeaturedArticles(): Article[] {
  return articles.filter(article => article.featured);
}

export function getArticlesByCategory(category: string): Article[] {
  return articles.filter(article => article.category === category);
}

export function getAllCategories(): string[] {
  return Array.from(new Set(articles.map(article => article.category)));
}