'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { ICONS } from '../../lib/icons';

const faqItems = [
  // Categoria: Como Começar
  {
    question: 'Como funciona o período gratuito de 7 dias?',
    answer: 'Durante os 7 dias você tem acesso completo a todas as funcionalidades, incluindo 3 análises gratuitas. Não é necessário cartão de crédito para começar. Você pode cancelar a qualquer momento sem custo.',
    category: 'Como Começar'
  },
  {
    question: 'Sou advogado solo com 50 processos. O JustoAI funciona para mim?',
    answer: (
      <>
        Sim! O plano Gestão foi feito para advogados solo e micro escritórios. Você monitora até 200 processos, recebe 10 créditos/mês para análises mais profundas + 50 créditos de bônus no primeiro mês. <strong>Economiza ~20h/semana.</strong><br /><br />
        <a href="#pricing" className="text-accent-600 font-medium hover:underline">Ver plano Gestão →</a>
      </>
    ),
    category: 'Como Começar'
  },
  {
    question: 'Já uso Projuris/Astrea. É complicado migrar?',
    answer: (
      <>
        Não! Migramos seus dados em <strong>menos de 5 minutos</strong>. Você exporta um Excel do seu sistema atual, e o JustoAI detecta automaticamente os campos. Sem trabalho manual. Nossa equipe pode ajudar por WhatsApp se precisar.<br /><br />
        <a href="/onboarding-demo" className="text-accent-600 font-medium hover:underline">Agendar setup guiado →</a>
      </>
    ),
    category: 'Como Começar'
  },

  // Categoria: Planos & Preços
  {
    question: 'Posso cancelar a qualquer momento?',
    answer: (
      <>
        Sim, você pode cancelar seu plano a qualquer momento sem multas ou taxas de cancelamento. Seus dados permanecem seguros por 30 dias após o cancelamento.<br /><br />
        <a href="/terms" className="text-accent-600 font-medium hover:underline">Ler termos de uso →</a>
      </>
    ),
    category: 'Planos & Preços'
  },
  {
    question: 'Posso personalizar os relatórios com logo do meu escritório?',
    answer: (
      <>
        Sim! A partir do plano <strong>Performance</strong>, você personaliza: Logo do seu escritório, Cores da sua marca, Assinatura customizada e Rodapé com seus contatos.<br /><br />
        <a href="#pricing" className="text-accent-600 font-medium hover:underline">Ver planos com personalização →</a>
      </>
    ),
    category: 'Planos & Preços'
  },
  {
    question: 'Os valores incluem impostos?',
    answer: 'Os valores apresentados na assinatura não incluem impostos (ISS/PIS/COFINS) conforme legislação vigente. O imposto aplicável será calculado no checkout de acordo com sua localização e regime tributário.',
    category: 'Planos & Preços'
  },
  {
    question: 'Como funcionam os créditos?',
    answer: 'Créditos são consumidos por ordem de expiração (FIFO). Créditos mensais vencem ao final do ciclo se não utilizados, enquanto créditos de pacotes extras nunca vencem.',
    category: 'Planos & Preços'
  },

  // Categoria: Segurança & Privacidade
  {
    question: 'Meus dados de processos ficam seguros? São confidenciais.',
    answer: (
      <>
        <strong>Sim, 100% seguros.</strong> Usamos Criptografia SSL bancária, Servidores no Brasil (LGPD compliant), Backup automático diário e não compartilhamos dados com terceiros.<br /><br />
        <a href="/security" className="text-accent-600 font-medium hover:underline">Ver política de segurança →</a>
      </>
    ),
    category: 'Segurança & Privacidade'
  },

  // Categoria: Suporte & Ajuda
  {
    question: 'Preciso treinar minha equipe?',
    answer: 'Não! O sistema é intuitivo e pode ser usado imediatamente. Oferecemos suporte completo, tutoriais em vídeo e nossa equipe está sempre disponível para ajudar.',
    category: 'Suporte & Ajuda'
  },
  {
    question: 'Como funciona o suporte técnico?',
    answer: 'Oferecemos suporte dedicado via e-mail e WhatsApp para todos os nossos clientes. Nosso tempo de resposta é de até 24 horas úteis (muitas vezes menos de 1 hora).',
    category: 'Suporte & Ajuda'
  }
];

const categories = ['Todos', 'Como Começar', 'Planos & Preços', 'Segurança & Privacidade', 'Suporte & Ajuda'];

export function FAQ() {
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [openItems, setOpenItems] = useState<number[]>([]);

  const filteredFAQ = faqItems.filter(item => {
    const matchesCategory = activeCategory === 'Todos' || item.category === activeCategory;
    const matchesSearch = item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (typeof item.answer === 'string' && item.answer.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesCategory && matchesSearch;
  });

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
          className="text-center mb-12"
        >
          <Badge variant="secondary" className="mb-4 bg-accent-50 text-accent-700 border-accent-200">
            Dúvidas Frequentes
          </Badge>
          <h2 className="font-display font-bold text-3xl sm:text-4xl lg:text-5xl text-primary-800 mb-6">
            Tudo que você precisa saber
          </h2>
          <p className="text-lg text-neutral-700 max-w-3xl mx-auto mb-8">
            Respostas para as principais dúvidas sobre nossa plataforma, funcionalidades e planos.
          </p>

          {/* Search Bar */}
          <div className="max-w-xl mx-auto relative mb-8">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-400 text-lg">{ICONS.SEARCH}</span>
            </div>
            <input
              type="text"
              placeholder="Buscar dúvida... (ex: 'como funciona o trial')"
              className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:border-accent-500 focus:ring-1 focus:ring-accent-500 sm:text-sm shadow-sm transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </motion.div>

        {/* Category Filter */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-12"
        >
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${activeCategory === category
                ? 'bg-accent-600 text-white shadow-md'
                : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200'
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
          className="max-w-3xl mx-auto space-y-4"
        >
          <AnimatePresence>
            {filteredFAQ.length > 0 ? (
              filteredFAQ.map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card className="overflow-hidden hover:shadow-md transition-shadow duration-300 border-neutral-200">
                    <button
                      onClick={() => toggleItem(index)}
                      className="w-full p-6 text-left flex items-start justify-between bg-white hover:bg-neutral-50/50 transition-colors duration-200"
                    >
                      <div className="flex-1 pr-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-[10px] uppercase tracking-wider text-neutral-500 border-neutral-200">
                            {item.category}
                          </Badge>
                        </div>
                        <h3 className="font-semibold text-lg text-primary-900 leading-snug">
                          {item.question}
                        </h3>
                      </div>
                      <div className={`text-accent-500 mt-1 transform transition-transform duration-200 flex-shrink-0 ${openItems.includes(index) ? 'rotate-180' : ''}`}>
                        {ICONS.ARROW_DOWN}
                      </div>
                    </button>

                    <motion.div
                      initial={false}
                      animate={{
                        height: openItems.includes(index) ? 'auto' : 0,
                        opacity: openItems.includes(index) ? 1 : 0,
                      }}
                      transition={{ duration: 0.3, type: 'spring' }}
                      className="overflow-hidden bg-neutral-50/30"
                    >
                      <div className="px-6 pb-6 pt-2 text-neutral-700 leading-relaxed border-t border-neutral-100">
                        {item.answer}
                      </div>
                    </motion.div>
                  </Card>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-12 text-neutral-500">
                <p>Nenhuma dúvida encontrada para &quot;{searchQuery}&quot;.</p>
                <button
                  onClick={() => setSearchQuery('')}
                  className="mt-2 text-accent-600 hover:underline font-medium"
                >
                  Limpar busca
                </button>
              </div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Footer CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="max-w-3xl mx-auto mt-16 p-8 sm:p-12 bg-neutral-50 rounded-2xl border border-neutral-200 text-center"
        >
          <div className="text-4xl text-accent-500 mb-4 mx-auto flex justify-center">
            💬
          </div>
          <h3 className="font-display font-bold text-2xl text-primary-800 mb-2">
            Não encontrou sua dúvida?
          </h3>
          <p className="text-neutral-600 mb-8 max-w-lg mx-auto">
            Nossa equipe responde em menos de 1 hora durante horário comercial.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="https://wa.me/5500000000000" target="_blank" rel="noopener noreferrer">
              <Button className="bg-[#25D366] hover:bg-[#128C7E] text-white w-full sm:w-auto shadow-sm">
                <span className="mr-2 text-lg">{ICONS.WHATSAPP}</span>
                Falar no WhatsApp
              </Button>
            </a>
            <a href="mailto:contato@justoai.com.br">
              <Button variant="outline" className="w-full sm:w-auto border-neutral-300 hover:bg-white text-neutral-700">
                <span className="mr-2">{ICONS.MAIL}</span>
                Enviar Email
              </Button>
            </a>
          </div>

          <p className="text-sm text-neutral-500 mt-6">
            Ou <Link href="/signup" className="text-accent-600 hover:underline font-medium">comece o trial grátis</Link> e tire dúvidas na prática.
          </p>
        </motion.div>
      </div>
    </section>
  );
}