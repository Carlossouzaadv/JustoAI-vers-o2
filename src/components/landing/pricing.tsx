'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ICONS } from '../../../lib/icons';

const plans = [
  {
    name: 'Starter',
    description: 'Perfeito para advogados autônomos',
    price: 'R$ 147',
    period: '/mês',
    originalPrice: 'R$ 297',
    discount: '50% OFF',
    features: [
      'Até 2 usuários',
      'Até 100 processos monitorados',
      'Análise Completa: 25 (1º mês), depois 5/mês',
      'Análise Essencial e Estratégica ilimitadas',
      'Dashboard básico',
      'Suporte por Email e Assistente IA',
      'Importação de dados (CSV/Excel)'
    ],
    cta: 'Começar Grátis',
    popular: false,
    color: 'primary'
  },
  {
    name: 'Professional',
    description: 'Ideal para escritórios pequenos e médios',
    price: 'R$ 297',
    period: '/mês',
    originalPrice: 'R$ 597',
    discount: '50% OFF',
    features: [
      'Até 5 usuários',
      'Até 300 processos monitorados',
      'Análise Completa: 75 (1º mês), depois 15/mês',
      'Todas as análises de IA',
      'Dashboard completo com timeline',
      'Suporte Email, IA e WhatsApp',
      'Integração APIs (Judit/Codilo)',
      'Relatórios personalizados',
      'Alertas inteligentes 24/7'
    ],
    cta: 'Começar Grátis',
    popular: true,
    color: 'accent'
  },
  {
    name: 'Enterprise',
    description: 'Para grandes escritórios e departamentos jurídicos',
    price: 'Sob consulta',
    period: '',
    originalPrice: '',
    discount: '',
    features: [
      'Usuários ilimitados',
      'Processos ilimitados',
      'Análises ilimitadas',
      'Todas as análises de IA',
      'Dashboard white-label',
      'Suporte dedicado',
      'Integrações customizadas',
      'API própria',
      'Treinamento da equipe',
      'SLA garantido'
    ],
    cta: 'Falar com Vendas',
    popular: false,
    color: 'primary'
  }
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { y: 30, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.6,
      
    },
  },
};

export function Pricing() {
  return (
    <section id="pricing" className="py-24 bg-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <Badge variant="secondary" className="mb-4 bg-accent-50 text-accent-700 border-accent-200">
            Preços Especiais de Lançamento
          </Badge>
          <h2 className="font-display font-bold text-3xl sm:text-4xl lg:text-5xl text-primary-800 mb-6">
            Planos que se adaptam ao
            <span className="bg-gradient-to-r from-accent-500 to-accent-600 bg-clip-text text-transparent block">
              seu escritório
            </span>
          </h2>
          <p className="text-lg text-neutral-700 max-w-3xl mx-auto mb-8">
            Comece gratuitamente e escolha o plano ideal para o tamanho do seu escritório.
            Sem taxas ocultas, sem compromisso.
          </p>

          <div className="inline-flex items-center gap-4 p-1 bg-neutral-100 rounded-lg">
            <Badge variant="destructive" className="bg-red-500 text-white">
              {ICONS.CLOCK} Oferta por tempo limitado
            </Badge>
            <span className="text-sm text-neutral-600">50% de desconto nos primeiros 3 meses</span>
          </div>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid lg:grid-cols-3 gap-8 max-w-7xl mx-auto"
        >
          {plans.map((plan, index) => (
            <motion.div key={index} variants={itemVariants}>
              <Card className={`p-8 h-full relative overflow-hidden transition-all duration-300 ${
                plan.popular
                  ? 'border-2 border-accent-500 shadow-xl scale-105 bg-gradient-to-br from-white to-accent-50'
                  : 'border-neutral-200 hover:border-primary-200 hover:shadow-lg'
              }`}>
                {plan.popular && (
                  <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 z-20">
                    <Badge className="bg-gradient-to-r from-accent-500 to-accent-600 text-white px-4 py-2 shadow-lg border-0 text-sm font-semibold">
                      ⭐ Mais Popular
                    </Badge>
                  </div>
                )}

                {plan.discount && (
                  <div className="absolute top-4 right-4">
                    <Badge variant="destructive" className="bg-red-500 text-white">
                      {plan.discount}
                    </Badge>
                  </div>
                )}

                <div className="text-center mb-8">
                  <h3 className="font-display font-bold text-2xl text-primary-800 mb-2">
                    {plan.name}
                  </h3>
                  <p className="text-neutral-600 mb-6">
                    {plan.description}
                  </p>

                  <div className="space-y-2">
                    {plan.originalPrice && (
                      <div className="text-sm text-neutral-500 line-through">
                        {plan.originalPrice}
                      </div>
                    )}
                    <div className="flex items-baseline justify-center">
                      <span className="text-4xl lg:text-5xl font-bold text-primary-800">
                        {plan.price}
                      </span>
                      {plan.period && (
                        <span className="text-neutral-600 ml-1">
                          {plan.period}
                        </span>
                      )}
                    </div>
                    {plan.period && (
                      <div className="text-sm text-neutral-500">
                        por advogado
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4 mb-8">
                  {plan.features.map((feature, featureIndex) => (
                    <div key={featureIndex} className="flex items-start">
                      <span className="text-accent-500 mr-3 mt-0.5 flex-shrink-0">
                        {ICONS.CHECK}
                      </span>
                      <span className="text-neutral-700">
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-auto">
                  <Link href={plan.name === 'Enterprise' ? '/contact' : '/signup'}>
                    <Button
                      className={`w-full py-3 text-lg font-semibold transition-all duration-200 ${
                        plan.popular
                          ? 'bg-accent-500 hover:bg-accent-600 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
                          : 'bg-primary-800 hover:bg-primary-700 text-white'
                      }`}
                    >
                      {plan.cta}
                      <span className="ml-2">
                        {plan.name === 'Enterprise' ? ICONS.PHONE : ICONS.ARROW_RIGHT}
                      </span>
                    </Button>
                  </Link>

                  {plan.name !== 'Enterprise' && (
                    <div className="text-center mt-4">
                      <span className="text-sm text-neutral-500">
                        7 dias grátis • Sem cartão de crédito
                      </span>
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* FAQ Pricing */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-20 text-center"
        >
          <h3 className="font-display font-bold text-2xl text-primary-800 mb-8">
            Perguntas Frequentes sobre Preços
          </h3>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto text-left">
            <div>
              <h4 className="font-semibold text-primary-800 mb-2">
                Posso cancelar a qualquer momento?
              </h4>
              <p className="text-neutral-700">
                Sim, você pode cancelar seu plano a qualquer momento. Não há multas ou taxas de cancelamento.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-primary-800 mb-2">
                Como funciona o período gratuito?
              </h4>
              <p className="text-neutral-700">
                Todos os planos incluem 7 dias grátis. Você pode testar todas as funcionalidades sem compromisso.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-primary-800 mb-2">
                Posso mudar de plano depois?
              </h4>
              <p className="text-neutral-700">
                Claro! Você pode fazer upgrade ou downgrade do seu plano a qualquer momento pelo dashboard.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-primary-800 mb-2">
                Há desconto para anuidades?
              </h4>
              <p className="text-neutral-700">
                Sim, oferecemos 20% de desconto para pagamentos anuais. Entre em contato para saber mais.
              </p>
            </div>
          </div>

          <div className="mt-12 p-6 bg-gradient-to-r from-primary-50 to-accent-50 rounded-2xl border border-primary-200">
            <div className="flex items-center justify-center mb-4">
              <span className="text-2xl mr-3">{ICONS.SHIELD}</span>
              <h4 className="font-display font-bold text-xl text-primary-800">
                Teste sem Compromisso
              </h4>
            </div>
            <p className="text-neutral-700">
              7 dias grátis para testar todas as funcionalidades. Cancele quando quiser, sem taxas.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}