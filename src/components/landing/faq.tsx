'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ICONS } from '../../../lib/icons';

const faqItems = [
  {
    question: 'Como funciona o período gratuito de 7 dias?',
    answer: 'Durante os 7 dias você tem acesso completo a todas as funcionalidades, incluindo 3 análises gratuitas. Não é necessário cartão de crédito para começar. Você pode cancelar a qualquer momento sem custo.',
    category: 'Trial'
  },
  {
    question: 'Posso importar dados do meu sistema atual?',
    answer: 'Sim. Nossa plataforma foi desenhada para facilitar seu início. Você pode importar seus dados de processos de forma simples e rápida através de planilhas (Excel/CSV). Estamos trabalhando para oferecer integrações diretas no futuro.',
    category: 'Integração'
  },
  {
    question: 'Meus dados ficam seguros?',
    answer: 'Absolutamente. Somos LGPD compliant, usamos criptografia de ponta e mantemos servidores no Brasil. Seus dados nunca são compartilhados e você tem controle total sobre eles.',
    category: 'Segurança'
  },
  {
    question: 'Como funciona o agendamento de relatórios?',
    answer: 'Você configura uma vez e recebe automaticamente por email. Pode escolher frequência semanal, quinzenal ou mensal, personalizar templates por cliente e agendar horários específicos.',
    category: 'Relatórios'
  },
  {
    question: 'Posso cancelar a qualquer momento?',
    answer: 'Sim, você pode cancelar seu plano a qualquer momento sem multas ou taxas de cancelamento. Seus dados permanecem seguros por 30 dias após o cancelamento.',
    category: 'Planos'
  },
  {
    question: 'Quanto tempo economizo realmente?',
    answer: 'Nossos clientes reportam economia média de 20 horas por semana. Isso inclui tempo de análise de processos, criação de relatórios, acompanhamento de prazos e comunicação com clientes.',
    category: 'Produtividade'
  },
  {
    question: 'O sistema funciona para todos os tipos de direito?',
    answer: 'Sim! Atendemos todas as áreas: civil, criminal, trabalhista, tributário, empresarial e mais. O sistema adapta-se ao tipo de processo e área jurídica automaticamente.',
    category: 'Áreas Jurídicas'
  },
  {
    question: 'Preciso treinar minha equipe?',
    answer: 'Não! O sistema é intuitivo e pode ser usado imediatamente. Oferecemos suporte completo, tutoriais em vídeo e nossa equipe está sempre disponível para ajudar.',
    category: 'Suporte'
  },
  {
    question: 'Como funciona o suporte técnico?',
    answer: 'Oferecemos suporte dedicado via e-mail para todos os nossos clientes. Nosso tempo de resposta é de até 24 horas úteis. Para clientes do plano Enterprise, oferecemos um canal de suporte prioritário e gerente de contas dedicado.',
    category: 'Suporte'
  },
  {
    question: 'Posso personalizar os relatórios com minha marca?',
    answer: 'Sim! Você pode personalizar logos, cores, templates e até mesmo criar modelos específicos para diferentes tipos de clientes. Seu escritório sempre em destaque.',
    category: 'Personalização'
  }
];

const categories = ['Todos', 'Trial', 'Integração', 'Segurança', 'Relatórios', 'Planos', 'Produtividade', 'Suporte'];

export function FAQ() {
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [openItems, setOpenItems] = useState<number[]>([]);

  const filteredFAQ = activeCategory === 'Todos'
    ? faqItems
    : faqItems.filter(item => item.category === activeCategory);

  const toggleItem = (index: number) => {
    setOpenItems(prev =>
      prev.includes(index)
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  return (
    <section className="py-24 bg-gradient-to-br from-primary-50 via-white to-accent-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <Badge variant="secondary" className="mb-4 bg-accent-50 text-accent-700 border-accent-200">
            Dúvidas Frequentes
          </Badge>
          <h2 className="font-display font-bold text-3xl sm:text-4xl lg:text-5xl text-primary-800 mb-6">
            Tudo que você precisa
            <span className="bg-gradient-to-r from-accent-500 to-accent-600 bg-clip-text text-transparent block">
              saber sobre a JustoAI
            </span>
          </h2>
          <p className="text-lg text-neutral-700 max-w-3xl mx-auto">
            Respostas para as principais dúvidas sobre nossa plataforma, funcionalidades e planos.
          </p>
        </motion.div>

        {/* Category Filter */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="flex flex-wrap justify-center gap-3 mb-12"
        >
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeCategory === category
                  ? 'bg-accent-500 text-white shadow-lg'
                  : 'bg-white text-neutral-700 hover:bg-accent-50 border border-neutral-200'
              }`}
            >
              {category}
            </button>
          ))}
        </motion.div>

        {/* FAQ Items */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-4xl mx-auto space-y-4"
        >
          {filteredFAQ.map((item, index) => (
            <Card
              key={index}
              className="overflow-hidden hover:shadow-lg transition-all duration-300"
            >
              <button
                onClick={() => toggleItem(index)}
                className="w-full p-6 text-left flex items-center justify-between hover:bg-neutral-50 transition-colors duration-200"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Badge variant="outline" className="text-xs">
                      {item.category}
                    </Badge>
                  </div>
                  <h3 className="font-bold text-lg text-primary-800 pr-4">
                    {item.question}
                  </h3>
                </div>
                <div className={`text-accent-500 transform transition-transform duration-200 ${
                  openItems.includes(index) ? 'rotate-180' : ''
                }`}>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              <motion.div
                initial={false}
                animate={{
                  height: openItems.includes(index) ? 'auto' : 0,
                  opacity: openItems.includes(index) ? 1 : 0,
                }}
                transition={{ duration: 0.3, type: "spring" }}
                className="overflow-hidden"
              >
                <div className="px-6 pb-6">
                  <p className="text-neutral-700 leading-relaxed">
                    {item.answer}
                  </p>
                </div>
              </motion.div>
            </Card>
          ))}
        </motion.div>

        {/* Still have questions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-center mt-16"
        >
          <Card className="max-w-2xl mx-auto p-8 bg-gradient-to-br from-accent-50 to-accent-100">
            <div className="text-4xl mb-4">{ICONS.HEART}</div>
            <h3 className="font-display font-bold text-2xl text-primary-800 mb-4">
              Ainda tem dúvidas?
            </h3>
            <p className="text-neutral-700 mb-6">
              Nossa equipe está aqui para ajudar! Entre em contato conosco para uma conversa sem compromisso.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <a
                href="mailto:contato@justoai.com.br"
                className="inline-flex items-center px-6 py-3 bg-accent-500 hover:bg-accent-600 text-white font-semibold rounded-lg transition-all duration-200 hover:scale-105 shadow-lg"
              >
                Falar Conosco
                <span className="ml-2">{ICONS.MAIL}</span>
              </a>
              <a
                href="/signup"
                className="inline-flex items-center px-6 py-3 bg-white hover:bg-neutral-50 text-accent-600 font-semibold rounded-lg border-2 border-accent-500 transition-all duration-200"
              >
                Testar Grátis
                <span className="ml-2">{ICONS.ARROW_RIGHT}</span>
              </a>
            </div>
          </Card>
        </motion.div>
      </div>
    </section>
  );
}