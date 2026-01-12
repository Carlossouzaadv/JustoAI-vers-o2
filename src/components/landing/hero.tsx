'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { InlineSvgIcon } from '../ui/custom-icon';
import { CreditCard, X } from 'lucide-react';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
      delayChildren: 0.1,
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

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-accent-50 pt-20 pb-16 overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-5"></div>

      {/* Floating Elements */}
      <motion.div
        animate={{
          y: [0, -20, 0],
          rotate: [0, 5, 0],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
        }}
        className="absolute top-1/4 left-10 w-16 h-16 bg-accent-500/10 rounded-full blur-xl"
      />
      <motion.div
        animate={{
          y: [0, 20, 0],
          rotate: [0, -5, 0],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
        }}
        className="absolute bottom-1/4 right-10 w-24 h-24 bg-primary-500/10 rounded-full blur-xl"
      />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="max-w-6xl mx-auto"
        >
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            {/* Content */}
            <div className="text-center lg:text-left">
              <motion.div variants={itemVariants}>
                <Badge variant="secondary" className="inline-flex items-center gap-2 mb-6 bg-gradient-to-r from-accent-400 to-accent-600 text-white border-0 shadow-md px-3 py-1">
                  <InlineSvgIcon name="ia" size={16} />
                  <span>Novo: Análise com nossa IA em 30 segundos</span>
                </Badge>
              </motion.div>

              <motion.h1
                variants={itemVariants}
                className="font-display font-bold text-3xl sm:text-4xl md:text-5xl lg:text-6xl leading-tight text-primary-800 mb-6"
              >
                Economize{' '}
                <span className="relative whitespace-nowrap">
                  <span className="relative z-10 bg-gradient-to-r from-accent-500 to-accent-700 bg-clip-text text-transparent">
                    20 horas
                  </span>
                  <svg className="absolute -bottom-2 left-0 w-full h-3 text-accent-300 transform -rotate-1" viewBox="0 0 100 10" preserveAspectRatio="none">
                    <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="3" fill="none" />
                  </svg>
                </span>
                <br />
                <span className="text-primary-800">por semana em relatórios executivos</span>
              </motion.h1>

              <motion.p
                variants={itemVariants}
                className="text-lg sm:text-xl text-neutral-700 mb-8 leading-relaxed max-w-2xl mx-auto lg:mx-0"
              >
                Pare de perder tempo com trabalho repetitivo. Nossa IA transforma andamentos processuais em relatórios executivos que seus clientes <em>realmente</em> entendem.
                <span className="block mt-2 text-accent-600 font-semibold">
                  Configure uma vez. Receba relatórios toda semana. Automaticamente.
                </span>
              </motion.p>

              {/* CTA Section */}
              <motion.div
                variants={itemVariants}
                className="mb-8 text-center lg:text-left"
              >
                <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-6">
                  <Link href="/pricing">

                    <Button
                      size="lg"
                      className="w-full sm:w-auto bg-gradient-to-r from-accent-500 to-primary-800 hover:from-accent-600 hover:to-primary-900 text-white px-8 py-4 text-base lg:text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200 border-0 min-h-[48px] touch-manipulation"
                    >
                      Testar 7 Dias Grátis (sem cartão)
                      <span className="ml-2">→</span>
                    </Button>
                  </Link>

                  <Link href="#demo">
                    <Button
                      variant="outline"
                      size="lg"
                      className="w-full sm:w-auto border-2 border-primary-300 text-primary-800 hover:bg-primary-50 px-8 py-4 text-base lg:text-lg font-semibold transition-all duration-200 min-h-[48px] touch-manipulation"
                    >
                      Ver Como Funciona (3 min)
                      <span className="ml-2">▶</span>
                    </Button>
                  </Link>
                </div>

                {/* Trust Badges */}
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 sm:gap-6 text-sm text-neutral-600">
                  <div className="flex items-center gap-1.5">
                    <InlineSvgIcon name="success" size={16} className="text-accent-500" />
                    <span>Teste grátis por 7 dias</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-accent-500" />
                    <span>Sem cartão de crédito</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <X className="w-4 h-4 text-accent-500" />
                    <span>Cancele quando quiser</span>
                  </div>
                </div>
              </motion.div>


            </div>

            {/* Hero Image/Dashboard Preview */}
            <motion.div
              variants={itemVariants}
              className="relative w-full max-w-2xl mx-auto"
            >
              <div className="relative bg-white rounded-xl shadow-2xl border border-neutral-200 overflow-hidden transform rotate-1 hover:rotate-0 transition-transform duration-500">
                <div className="bg-gradient-to-r from-primary-800 to-primary-700 p-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                    <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                    <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                    <div className="flex-1 text-center">
                      <span className="text-white text-sm font-medium">JustoAI Dashboard</span>
                    </div>
                  </div>
                </div>
                <div className="p-6 bg-gradient-to-br from-neutral-50 to-neutral-100">
                  <div className="space-y-4">
                    {/* Header do Relatório */}
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-bold text-primary-800">RELATÓRIO EXECUTIVO</div>
                      <div className="text-sm text-accent-600 font-medium">Processo #1234567</div>
                    </div>

                    {/* Status Cards */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-white rounded-lg shadow p-3">
                        <div className="text-xs text-neutral-600">Status</div>
                        <div className="text-sm font-bold text-accent-600">Em Análise</div>
                      </div>
                      <div className="bg-white rounded-lg shadow p-3">
                        <div className="text-xs text-neutral-600">Prazo</div>
                        <div className="text-sm font-bold text-primary-800">15 dias</div>
                      </div>
                      <div className="bg-white rounded-lg shadow p-3">
                        <div className="text-xs text-neutral-600">Risco</div>
                        <div className="text-sm font-bold text-orange-600">Médio</div>
                      </div>
                    </div>

                    {/* Conteúdo do Relatório */}
                    <div className="bg-white rounded-lg shadow p-4 space-y-3">
                      <div>
                        <div className="text-sm font-semibold text-primary-800 mb-2">RESUMO EXECUTIVO</div>
                        <div className="h-2 bg-neutral-200 rounded w-full mb-1"></div>
                        <div className="h-2 bg-neutral-200 rounded w-4/5 mb-1"></div>
                        <div className="h-2 bg-neutral-200 rounded w-3/4"></div>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-accent-600 mb-2">PRÓXIMOS PASSOS</div>
                        <div className="h-2 bg-accent-100 rounded w-5/6 mb-1"></div>
                        <div className="h-2 bg-accent-100 rounded w-3/4"></div>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
                        <div className="text-sm text-neutral-500">Atualizado agora</div>
                        <div className="text-sm text-accent-600 font-medium">📧 Enviado ao cliente</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating Tooltips */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1, duration: 0.5 }}
                className="absolute -top-6 -left-6 bg-white rounded-xl shadow-lg border border-neutral-200 p-3 flex items-center gap-2 animate-bounce-slow"
              >
                <div className="bg-accent-100 p-1.5 rounded-full">
                  <InlineSvgIcon name="ia" size={16} className="text-accent-600" />
                </div>
                <span className="text-sm font-semibold text-gray-800">20h economizadas</span>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.5, duration: 0.5 }}
                className="absolute top-1/2 -right-12 bg-white rounded-xl shadow-lg border border-neutral-200 p-3 flex items-center gap-2"
              >
                <div className="bg-green-100 p-1.5 rounded-full">
                  <InlineSvgIcon name="success" size={16} className="text-green-600" />
                </div>
                <span className="text-sm font-semibold text-gray-800">Status em tempo real</span>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 2, duration: 0.5 }}
                className="absolute -bottom-6 right-10 bg-white rounded-xl shadow-lg border border-neutral-200 p-3 flex items-center gap-2"
              >
                <div className="bg-blue-100 p-1.5 rounded-full">
                  <InlineSvgIcon name="documentos" size={16} className="text-blue-600" />
                </div>
                <span className="text-sm font-semibold text-gray-800">Enviado automaticamente</span>
              </motion.div>

            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2.5, duration: 0.5 }}
        className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 10] }}
          transition={{ duration: 1, repeat: Infinity, repeatType: 'reverse', type: 'spring' }}
          className="text-neutral-400 cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </motion.div>
      </motion.div>
    </section>
  );
}