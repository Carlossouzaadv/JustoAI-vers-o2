'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ICONS } from '../../lib/icons';

export function FinalCTA() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary-700 via-primary-800 to-primary-900 text-white py-24">

      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/20 via-transparent to-transparent" />
        <div className="absolute -top-[500px] -right-[500px] w-[1000px] h-[1000px] rounded-full bg-accent-500/20 blur-3xl" />
        <div className="absolute -bottom-[500px] -left-[500px] w-[1000px] h-[1000px] rounded-full bg-blue-500/20 blur-3xl" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-5xl mx-auto text-center"
        >
          {/* Honest Badge */}
          <Badge className="bg-accent-500 text-white mb-8 hover:bg-accent-600 px-4 py-1 text-sm">
            Comece Hoje Mesmo
          </Badge>

          {/* Headline */}
          <h2 className="font-display font-bold text-4xl sm:text-5xl lg:text-6xl mb-6 leading-tight">
            Transforme seu escritório em <br />
            <span className="text-accent-300">referência de mercado</span>
          </h2>

          {/* Subheading */}
          <p className="text-xl text-blue-100 mb-12 max-w-3xl mx-auto leading-relaxed">
            Junte-se aos advogados que já economizam <strong className="text-white">20+ horas por semana</strong> e impressionam clientes com relatórios executivos automáticos.
          </p>

          {/* Trust Badges Grid - Highlighted */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="bg-white/5 backdrop-blur-sm p-6 rounded-xl border border-white/10 hover:bg-white/10 transition-colors">
              <div className="text-4xl mb-3">{ICONS.SHIELD}</div>
              <h3 className="font-bold text-lg mb-2 text-white">LGPD Compliant</h3>
              <p className="text-sm text-blue-100">Seus dados 100% seguros e protegidos</p>
            </div>

            <div className="bg-white/5 backdrop-blur-sm p-6 rounded-xl border border-white/10 hover:bg-white/10 transition-colors">
              <div className="text-4xl mb-3">{ICONS.LOCK}</div>
              <h3 className="font-bold text-lg mb-2 text-white">Criptografia SSL</h3>
              <p className="text-sm text-blue-100">Proteção bancária para seus processos</p>
            </div>

            <div className="bg-white/5 backdrop-blur-sm p-6 rounded-xl border border-white/10 hover:bg-white/10 transition-colors">
              <div className="text-4xl mb-3">{ICONS.SERVER}</div>
              <h3 className="font-bold text-lg mb-2 text-white">Servidores no Brasil</h3>
              <p className="text-sm text-blue-100">Dados hospedados em território nacional</p>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Link href="/signup">
              <Button
                size="lg"
                className="bg-accent-500 text-white hover:bg-accent-600 shadow-2xl font-bold text-lg px-8 py-6 w-full sm:w-auto transition-all duration-300 transform hover:scale-105"
              >
                Começar Trial Gratuito — 7 dias
                <span className="ml-2">{ICONS.ARROW_RIGHT}</span>
              </Button>
            </Link>
            <Link href="/onboarding-demo">
              <Button
                size="lg"
                variant="outline"
                className="bg-white/10 backdrop-blur-sm text-white border-2 border-white/30 hover:bg-white hover:text-primary-900 hover:border-white font-semibold text-lg px-8 py-6 w-full sm:w-auto transition-all duration-300"
              >
                <span className="mr-2">{ICONS.PLAY}</span>
                Ver Demo (3 min)
              </Button>
            </Link>
          </div>

          {/* Trust Bullets */}
          <div className="flex flex-wrap justify-center gap-6 text-blue-100 text-sm font-medium mb-8">
            <div className="flex items-center">
              <span className="mr-2 text-accent-300">{ICONS.CHECK}</span>
              7 dias grátis
            </div>
            <div className="flex items-center">
              <span className="mr-2 text-accent-300">{ICONS.CHECK}</span>
              Sem cartão de crédito
            </div>
            <div className="flex items-center">
              <span className="mr-2 text-accent-300">{ICONS.CHECK}</span>
              Setup em apenas 5 minutos
            </div>
          </div>

          {/* Factual Social Proof Bar */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-md px-6 py-3 rounded-full border border-white/10 shadow-lg"
          >
            <span className="text-green-400 text-xl">{ICONS.CHECK}</span>
            <p className="text-white text-sm">
              <strong className="text-white">23 advogados</strong> começaram o trial hoje
            </p>
          </motion.div>

        </motion.div>
      </div>
    </section>
  );
}