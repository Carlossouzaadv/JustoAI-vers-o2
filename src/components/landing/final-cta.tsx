'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ICONS } from '@/lib/icons';

export function FinalCTA() {
  return (
    <section className="py-24 bg-gradient-to-br from-primary-800 via-primary-900 to-primary-950">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl mx-auto text-center"
        >
          <Badge variant="secondary" className="mb-6 bg-accent-500/20 text-accent-300 border-accent-500/30">
            <span className="w-2 h-2 bg-accent-400 rounded-full animate-pulse mr-2"></span>
            Últimos dias com desconto especial
          </Badge>

          <h2 className="font-display font-bold text-3xl sm:text-4xl lg:text-5xl text-white mb-6">
            Transforme seu escritório em
            <span className="bg-gradient-to-r from-accent-400 to-accent-500 bg-clip-text text-transparent block">
              referência de mercado hoje mesmo
            </span>
          </h2>

          <p className="text-lg sm:text-xl text-primary-200 mb-8 leading-relaxed max-w-3xl mx-auto">
            Junte-se aos advogados que já economizam <strong className="text-white">20+ horas por semana</strong> e impressionam clientes com relatórios executivos automáticos.
          </p>

          {/* Security Guarantees */}
          <div className="grid md:grid-cols-3 gap-6 mb-8 p-6 bg-primary-800/50 rounded-2xl border border-primary-700/50">
            <div className="flex items-center justify-center text-primary-200">
              <span className="text-accent-400 mr-3 text-xl">{ICONS.SHIELD}</span>
              <span className="text-sm font-medium">
                <strong className="text-white">LGPD Compliant</strong><br />
                Seus dados 100% seguros
              </span>
            </div>
            <div className="flex items-center justify-center text-primary-200">
              <span className="text-accent-400 mr-3 text-xl">{ICONS.SHIELD}</span>
              <span className="text-sm font-medium">
                <strong className="text-white">Criptografia SSL</strong><br />
                Proteção bancária
              </span>
            </div>
            <div className="flex items-center justify-center text-primary-200">
              <span className="text-accent-400 mr-3 text-xl">{ICONS.SHIELD}</span>
              <span className="text-sm font-medium">
                <strong className="text-white">Servidores no Brasil</strong><br />
                Máxima velocidade
              </span>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Link href="/signup">
              <Button
                size="lg"
                className="bg-gradient-to-r from-accent-500 to-accent-600 hover:from-accent-600 hover:to-accent-700 text-white px-10 py-4 text-lg font-bold shadow-2xl hover:shadow-accent-500/25 transition-all duration-200 transform hover:scale-105 w-full sm:w-auto"
              >
                Começar Trial Gratuito — 7 dias
                <span className="ml-2">{ICONS.ARROW_RIGHT}</span>
              </Button>
            </Link>
            <Link href="/onboarding-demo">
              <button
                className="border-2 border-white/30 bg-transparent text-white hover:bg-white/10 hover:border-white/50 px-8 py-4 text-lg font-semibold rounded-lg transition-all duration-200 w-full sm:w-auto inline-flex items-center justify-center"
              >
                <span className="text-white flex items-center">
                  <span className="mr-2">{ICONS.PLAY}</span>
                  Ver Demo (2 min)
                </span>
              </button>
            </Link>
          </div>

          {/* Trust Indicators */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-primary-300">
            <div className="flex items-center">
              <span className="text-accent-400 mr-2">{ICONS.CHECK}</span>
              7 dias grátis • Sem cartão de crédito
            </div>
            <div className="flex items-center">
              <span className="text-accent-400 mr-2">{ICONS.CHECK}</span>
              Cancele quando quiser
            </div>
            <div className="flex items-center">
              <span className="text-accent-400 mr-2">{ICONS.CHECK}</span>
              Setup em apenas 5 minutos
            </div>
          </div>

          {/* Urgency Message */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-12 p-4 bg-gradient-to-r from-orange-500/20 to-red-500/20 rounded-xl border border-orange-400/30"
          >
            <div className="flex items-center justify-center text-orange-300 mb-2">
              <span className="mr-2">{ICONS.CLOCK}</span>
              <span className="font-semibold">Enquanto você lê isso, seus concorrentes já estão automatizando</span>
            </div>
            <p className="text-orange-200 text-sm">
              Não deixe para amanhã a transformação que pode começar hoje. Seus clientes merecem o melhor atendimento.
            </p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}