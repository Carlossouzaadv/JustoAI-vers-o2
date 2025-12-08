'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ICONS } from '../../lib/icons';

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
                <Badge variant="secondary" className="inline-flex items-center gap-2 mb-6 bg-accent-50 text-accent-700 border-accent-200">
                  <span className="w-2 h-2 bg-accent-500 rounded-full animate-pulse"></span>
                  Novo: Sistema de Relatórios Automáticos
                </Badge>
              </motion.div>

              <motion.h1
                variants={itemVariants}
                className="font-display font-bold text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl leading-tight text-primary-800 mb-6"
              >
                <span className="bg-gradient-to-r from-accent-500 to-accent-600 bg-clip-text text-transparent">
                  Economize 20 horas por semana
                </span>
                <br />
                <span className="text-primary-800">em relatórios executivos</span>
              </motion.h1>

              <motion.p
                variants={itemVariants}
                className="text-base sm:text-lg md:text-xl lg:text-2xl text-neutral-700 mb-8 leading-relaxed max-w-2xl mx-auto lg:mx-0"
              >
                IA Gemini analisa seus processos (CNJ + Judit) e gera relatórios profissionais automaticamente. Seus clientes ficam sempre informados, <strong className="text-primary-800">você foca no estratégico.</strong>
              </motion.p>

              {/* CTA Section */}
              <motion.div
                variants={itemVariants}
                className="mb-8 text-center lg:text-left"
              >
                <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-8">
                  <Link href="/signup">
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

                <p className="text-sm sm:text-base text-primary-700 font-medium mb-3">
                  ⭐ Experimente gratuitamente por 7 dias
                </p>
                <p className="text-sm sm:text-base text-neutral-600 max-w-lg mx-auto lg:mx-0">
                  Configure sua conta em 5 minutos e comece a gerar relatórios automáticos hoje mesmo.
                </p>
              </motion.div>

              <motion.div
                variants={itemVariants}
                className="flex flex-col sm:flex-row items-center justify-center lg:justify-start space-y-2 sm:space-y-0 sm:space-x-6 text-sm text-neutral-600"
              >
                <div className="flex items-center">
                  <span className="text-accent-500 mr-2 text-base">✓</span>
                  <span className="text-sm sm:text-base">10.000+ horas economizadas para advogados</span>
                </div>
                <div className="flex items-center">
                  <span className="text-accent-500 mr-2 text-base">✓</span>
                  <span className="text-sm sm:text-base">Setup em 5 min</span>
                </div>
                <div className="flex items-center">
                  <span className="text-accent-500 mr-2 text-base">✓</span>
                  <span className="text-sm sm:text-base">500+ relatórios enviados hoje</span>
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

              {/* Floating Stats */}
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 1, duration: 0.5 }}
                className="absolute -top-6 -left-6 bg-white rounded-xl shadow-lg border border-neutral-200 p-4"
              >
                <div className="text-center">
                  <div className="text-2xl font-bold text-accent-600">20h</div>
                  <div className="text-sm text-neutral-600">economizadas/semana</div>
                </div>
              </motion.div>

            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2, duration: 0.5 }}
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