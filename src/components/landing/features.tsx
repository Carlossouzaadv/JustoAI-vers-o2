'use client';

import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ICONS } from '../../../lib/icons';

const features = [
  {
    icon: ICONS.BRAIN,
    title: 'Análise Essencial',
    description: 'IA analisa automaticamente seus processos e documenta pontos-chave em segundos.',
    benefits: ['Gemini Flash 8B', 'Análise em 30s', 'Pontos estratégicos'],
    color: 'primary',
  },
  {
    icon: ICONS.SHIELD,
    title: 'Análise Estratégica',
    description: 'Avaliação profunda com recomendações jurídicas e análise de riscos detalhada.',
    benefits: ['Gemini Flash Pro', 'Recomendações', 'Análise de riscos'],
    color: 'accent',
  },
  {
    icon: ICONS.CALENDAR,
    title: 'Relatórios Automáticos',
    description: 'Configure uma vez e receba relatórios executivos automaticamente no seu email.',
    benefits: ['Agendamento', 'Email automático', 'PDF profissional'],
    color: 'primary',
  },
  {
    icon: ICONS.MONITOR,
    title: 'Monitoramento 24/7',
    description: 'Acompanhe automaticamente movimentações processuais com alertas inteligentes.',
    benefits: ['APIs Judit/Codilo', 'Alertas em tempo real', 'Sem trabalho manual'],
    color: 'accent',
  },
  {
    icon: ICONS.UPLOAD,
    title: 'Integração Completa',
    description: 'Importe dados de qualquer sistema jurídico. Projuris, Legal One, Astrea e mais.',
    benefits: ['CSV/Excel', 'Detecção automática', 'Mapeamento inteligente'],
    color: 'primary',
  },
  {
    icon: ICONS.CHART,
    title: 'Dashboard Inteligente',
    description: 'Visualize todos os seus processos organizados por cliente com status em tempo real.',
    benefits: ['Visão hierárquica', 'Status visual', 'Timeline unificada'],
    color: 'accent',
  },
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
      ease: 'easeOut',
    },
  },
};

export function Features() {
  return (
    <section id="features" className="py-24 bg-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <Badge variant="secondary" className="mb-4 bg-primary-50 text-primary-700 border-primary-200">
            Recursos Revolucionários
          </Badge>
          <h2 className="font-display font-bold text-3xl sm:text-4xl lg:text-5xl text-primary-800 mb-6">
            Tudo que você precisa para
            <span className="bg-gradient-to-r from-accent-500 to-accent-600 bg-clip-text text-transparent block">
              revolucionar sua advocacia
            </span>
          </h2>
          <p className="text-lg text-neutral-700 max-w-3xl mx-auto">
            Nossa plataforma combina o melhor da inteligência artificial com a experiência jurídica
            para entregar resultados que impressionam seus clientes.
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {features.map((feature, index) => (
            <motion.div key={index} variants={itemVariants}>
              <Card className="p-8 h-full bg-gradient-to-br from-white to-neutral-50 border-neutral-200 hover:shadow-lg transition-all duration-300 group hover:border-primary-200">
                <div className="flex items-center mb-6">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl mr-4 ${
                      feature.color === 'primary'
                        ? 'bg-gradient-to-br from-primary-600 to-primary-800'
                        : 'bg-gradient-to-br from-accent-500 to-accent-600'
                    }`}
                  >
                    {feature.icon}
                  </div>
                  <h3 className="font-display font-semibold text-xl text-primary-800 group-hover:text-primary-700 transition-colors">
                    {feature.title}
                  </h3>
                </div>

                <p className="text-neutral-700 mb-6 leading-relaxed">
                  {feature.description}
                </p>

                <div className="space-y-2">
                  {feature.benefits.map((benefit, benefitIndex) => (
                    <div key={benefitIndex} className="flex items-center text-sm text-neutral-600">
                      <span className="text-accent-500 mr-2">{ICONS.CHECK}</span>
                      {benefit}
                    </div>
                  ))}
                </div>

                <div className="mt-6 pt-6 border-t border-neutral-200">
                  <motion.div
                    whileHover={{ x: 5 }}
                    className="flex items-center text-primary-700 font-medium cursor-pointer"
                  >
                    Saiba mais
                    <span className="ml-2 transition-transform group-hover:translate-x-1">
                      {ICONS.ARROW_RIGHT}
                    </span>
                  </motion.div>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Stats Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-20 grid grid-cols-2 lg:grid-cols-4 gap-8"
        >
          {[
            { value: '20h', label: 'Economizadas por semana' },
            { value: '98%', label: 'Satisfação dos clientes' },
            { value: '5min', label: 'Para configurar' },
            { value: '24/7', label: 'Monitoramento automático' },
          ].map((stat, index) => (
            <div key={index} className="text-center">
              <div className="text-3xl lg:text-4xl font-bold text-primary-800 mb-2">
                {stat.value}
              </div>
              <div className="text-neutral-600 text-sm lg:text-base">
                {stat.label}
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}