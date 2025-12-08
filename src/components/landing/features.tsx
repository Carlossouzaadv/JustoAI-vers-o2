'use client';

import { motion } from 'framer-motion';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { ICONS } from '../../lib/icons';

const features = [
  {
    icon: ICONS.BRAIN,
    title: 'Análise Essencial',
    description: 'Lê e analisa automaticamente seus processos, extraindo pontos-chave e resumos executivos em segundos.',
    benefits: ['Análise instantânea', 'Economiza horas', 'Pontos estratégicos'],
    color: 'primary',
  },
  {
    icon: ICONS.SHIELD,
    title: 'Análise Estratégica',
    description: 'Avaliação profunda com observações jurídicas e análise de riscos detalhada.',
    benefits: ['Análise avançada', 'Pense estrategicamente', 'Gestão de riscos'],
    color: 'accent',
  },
  {
    icon: ICONS.CALENDAR,
    title: 'Relatórios Automáticos',
    description: 'Configure uma vez e receba relatórios executivos automaticamente no seu email.',
    benefits: ['Em linguagem simples', 'Email automático', 'PDF profissional'],
    color: 'primary',
  },
  {
    icon: ICONS.MONITOR,
    title: 'Monitoramento 24/7',
    description: 'Acompanhe automaticamente movimentações processuais com alertas inteligentes.',
    benefits: ['Integração jurídica', 'Alertas em tempo real', 'Sem trabalho manual'],
    color: 'accent',
  },
  {
    icon: ICONS.UPLOAD,
    title: 'Integração Simplificada',
    description: 'Migre seus dados em minutos, com trabalho mínimo. Totalmente compatível com Projuris, Legal One, Astrea e os principais sistemas do mercado.',
    benefits: ['Migração em minutos', 'Trabalho mínimo', 'Compatível com Excel/CSV'],
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
            <span className="bg-gradient-to-r from-accent-500 to-accent-600 bg-clip-text text-transparent">
              Economize 20 horas por semana
            </span>
            <br />e impressione seus clientes
          </h2>
          <p className="text-lg text-neutral-700 max-w-3xl mx-auto">
            Nossa plataforma combina automação inteligente com a experiência jurídica
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
                    className={`w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl mr-4 ${feature.color === 'primary'
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
            { value: '7 dias', label: 'Trial gratuito' },
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