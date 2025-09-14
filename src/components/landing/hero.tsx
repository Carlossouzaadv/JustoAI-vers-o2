'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ICONS } from '../../../lib/icons';

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
      ease: 'easeOut',
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
          ease: 'easeInOut',
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
          ease: 'easeInOut',
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
                className="font-display font-bold text-4xl sm:text-5xl lg:text-6xl xl:text-7xl leading-tight text-primary-800 mb-6"
              >
                Transforme sua
                <span className="bg-gradient-to-r from-accent-500 to-accent-600 bg-clip-text text-transparent block">
                  Advocacia
                </span>
                com Inteligência Artificial
              </motion.h1>

              <motion.p
                variants={itemVariants}
                className="text-lg sm:text-xl lg:text-2xl text-neutral-700 mb-8 leading-relaxed max-w-2xl mx-auto lg:mx-0"
              >
                Elimine <strong className="text-primary-800">20 horas semanais</strong> de trabalho manual
                e crie relatórios que <strong className="text-accent-600">impressionam e fidelizam</strong> seus clientes.
              </motion.p>

              <motion.div
                variants={itemVariants}
                className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-12"
              >
                <Link href="/dashboard">
                  <Button
                    size="lg"
                    className="bg-primary-800 hover:bg-primary-700 text-white px-8 py-4 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 w-full sm:w-auto"
                  >
                    Começar Gratuitamente
                    <span className="ml-2">{ICONS.ARROW_RIGHT}</span>
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  size="lg"
                  className="border-primary-200 text-primary-800 hover:bg-primary-50 px-8 py-4 text-lg font-semibold w-full sm:w-auto"
                >
                  {ICONS.PLAY} Ver Demo (2 min)
                </Button>
              </motion.div>

              <motion.div
                variants={itemVariants}
                className="flex items-center justify-center lg:justify-start space-x-6 text-sm text-neutral-600"
              >
                <div className="flex items-center">
                  <span className="text-accent-500 mr-2">{ICONS.CHECK}</span>
                  Sem cartão de crédito
                </div>
                <div className="flex items-center">
                  <span className="text-accent-500 mr-2">{ICONS.CHECK}</span>
                  Setup em 5 minutos
                </div>
                <div className="flex items-center">
                  <span className="text-accent-500 mr-2">{ICONS.CHECK}</span>
                  Suporte em português
                </div>
              </motion.div>
            </div>

            {/* Hero Image/Dashboard Preview */}
            <motion.div
              variants={itemVariants}
              className="relative"
            >
              <div className="relative bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden transform rotate-2 hover:rotate-0 transition-transform duration-500">
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
                    <div className="flex items-center justify-between">
                      <div className="h-4 bg-primary-200 rounded w-1/3"></div>
                      <div className="h-4 bg-accent-200 rounded w-1/4"></div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="h-16 bg-white rounded-lg shadow border border-neutral-200 flex items-center justify-center">
                        <div className="text-2xl">{ICONS.DOCUMENT}</div>
                      </div>
                      <div className="h-16 bg-white rounded-lg shadow border border-neutral-200 flex items-center justify-center">
                        <div className="text-2xl">{ICONS.CHART}</div>
                      </div>
                      <div className="h-16 bg-white rounded-lg shadow border border-neutral-200 flex items-center justify-center">
                        <div className="text-2xl">{ICONS.CLOCK}</div>
                      </div>
                    </div>
                    <div className="h-32 bg-white rounded-lg shadow border border-neutral-200 p-4">
                      <div className="space-y-2">
                        <div className="h-3 bg-neutral-200 rounded w-full"></div>
                        <div className="h-3 bg-neutral-200 rounded w-3/4"></div>
                        <div className="h-3 bg-neutral-200 rounded w-1/2"></div>
                        <div className="h-3 bg-accent-200 rounded w-2/3"></div>
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
                  <div className="text-xs text-neutral-600">economizadas/semana</div>
                </div>
              </motion.div>

              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 1.2, duration: 0.5 }}
                className="absolute -bottom-6 -right-6 bg-white rounded-xl shadow-lg border border-neutral-200 p-4"
              >
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary-800">98%</div>
                  <div className="text-xs text-neutral-600">satisfação</div>
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
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="text-neutral-400 cursor-pointer"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </motion.div>
      </motion.div>
    </section>
  );
}