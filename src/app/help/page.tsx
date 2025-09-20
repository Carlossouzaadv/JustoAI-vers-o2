import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ICONS } from '../../../lib/icons';
import { FloatingChat } from '@/components/ai-assistant/floating-chat';

const helpCategories = [
  {
    title: 'Começando',
    description: 'Configure sua conta e faça o primeiro upload',
    icon: ICONS.ROCKET,
    articles: [
      'Como criar sua conta',
      'Configuração inicial',
      'Primeiro upload',
      'Configurando relatórios',
      'Integrando com seu sistema atual',
    ],
  },
  {
    title: 'Uploads e Análises',
    description: 'Aprenda a importar e analisar seus processos',
    icon: ICONS.DOCUMENT,
    articles: [
      'Formatos suportados de upload',
      'Como funciona a análise inteligente',
      'Interpretando resultados da análise',
      'Solucionando erros de upload',
    ],
  },
  {
    title: 'Relatórios Automáticos',
    description: 'Configure e personalize seus relatórios',
    icon: ICONS.CHART,
    articles: [
      'Agendando relatórios semanais',
      'Personalizando templates',
      'Configurando entrega por email',
      'Interpretando métricas',
    ],
  },
  {
    title: 'Integrações',
    description: 'Conecte com outros sistemas jurídicos',
    icon: ICONS.UPLOAD,
    articles: [
      'Importação via Excel/CSV',
      'Formatos de planilha suportados',
      'Preparando dados para importação',
      'Integrações futuras',
    ],
  },
];

const faqItems = [
  {
    question: 'Como funciona o período gratuito de 7 dias?',
    answer: 'Durante os 7 dias você tem acesso completo a todas as funcionalidades, incluindo 3 análises gratuitas. Não é necessário cartão de crédito para começar.',
  },
  {
    question: 'Posso importar dados do meu sistema atual?',
    answer: 'Sim! Atualmente, suportamos a importação de processos e dados através de planilhas no formato Excel/CSV. Estamos trabalhando para oferecer integrações diretas no futuro.',
  },
  {
    question: 'Como funciona o agendamento de relatórios?',
    answer: 'Você configura uma vez e recebe automaticamente por email. Pode escolher frequência semanal, quinzenal ou mensal, com templates personalizados.',
  },
  {
    question: 'Os dados dos meus clientes ficam seguros?',
    answer: 'Absolutamente. Somos LGPD compliant, usamos criptografia de ponta e mantemos servidores no Brasil. Seus dados nunca são compartilhados.',
  },
];

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="mb-8">
              <Link href="/">
                <Button variant="outline" size="sm">
                  <span className="mr-2">{ICONS.ARROW_LEFT}</span>
                  Voltar ao início
                </Button>
              </Link>
            </div>
            <h1 className="font-display font-bold text-4xl sm:text-5xl text-primary-800 mb-6">
              Central de Ajuda
            </h1>
            <p className="text-xl text-neutral-700 max-w-2xl mx-auto mb-8">
              Encontre respostas para suas dúvidas e aprenda a usar a JustoAI ao máximo.
            </p>

            {/* Search Bar */}
            <div className="max-w-md mx-auto">
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400">
                  {ICONS.SEARCH}
                </span>
                <input
                  type="text"
                  placeholder="Busque por uma dúvida..."
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-neutral-300 focus:outline-none focus:border-accent-500"
                />
              </div>
            </div>
          </div>

          {/* Help Categories */}
          <div className="grid lg:grid-cols-2 gap-8 mb-16">
            {helpCategories.map((category, index) => (
              <Card key={index} className="p-6 hover:shadow-lg transition-all duration-300">
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 bg-accent-100 rounded-lg flex items-center justify-center text-accent-600 text-2xl mr-4">
                    {category.icon}
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-xl text-primary-800">
                      {category.title}
                    </h3>
                    <p className="text-neutral-600">{category.description}</p>
                  </div>
                </div>
                <ul className="space-y-2">
                  {category.articles.map((article, articleIndex) => (
                    <li key={articleIndex}>
                      <Link
                        href={`/help/${category.title.toLowerCase().replace(/\s+/g, '-').replace('ç', 'c').replace('ã', 'a').replace('ó', 'o').replace('é', 'e')}/${article.toLowerCase().replace(/\s+/g, '-').replace('ç', 'c').replace('ã', 'a').replace('ó', 'o').replace('é', 'e').replace('/', '-')}`}
                        className="text-neutral-700 hover:text-accent-600 flex items-center group"
                      >
                        <span className="mr-2 text-accent-500 group-hover:text-accent-600 transition-colors">
                          {ICONS.ARROW_RIGHT}
                        </span>
                        {article}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>

          {/* FAQ Section */}
          <div className="mb-16">
            <h2 className="font-display font-bold text-3xl text-primary-800 mb-8 text-center">
              Perguntas Frequentes
            </h2>
            <div className="grid lg:grid-cols-2 gap-6">
              {faqItems.map((faq, index) => (
                <Card key={index} className="p-6">
                  <h3 className="font-bold text-lg text-primary-800 mb-3">
                    {faq.question}
                  </h3>
                  <p className="text-neutral-700">{faq.answer}</p>
                </Card>
              ))}
            </div>
          </div>

          {/* Contact Section */}
          <div className="text-center bg-white rounded-2xl shadow-xl p-12">
            <div className="text-5xl mb-6">{ICONS.HEART}</div>
            <h2 className="font-display font-bold text-2xl text-primary-800 mb-4">
              Não encontrou o que procurava?
            </h2>
            <p className="text-neutral-700 mb-6 max-w-2xl mx-auto">
              Se sua dúvida não foi respondida em nossos artigos, nossa equipe de suporte está pronta para ajudar. Envie um e-mail e responderemos o mais rápido possível.
            </p>
            <div className="flex justify-center">
              <Link href="/contato-suporte">
                <Button size="lg" className="bg-accent-500 hover:bg-accent-600">
                  ENVIAR E-MAIL PARA O SUPORTE
                  <span className="ml-2">{ICONS.MAIL}</span>
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Floating AI Assistant */}
      <FloatingChat />
    </div>
  );
}