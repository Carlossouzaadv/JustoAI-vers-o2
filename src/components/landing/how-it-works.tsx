'use client';

import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ICONS } from '../../../lib/icons';

const steps = [
  {
    number: '01',
    title: 'Conecte seus Dados',
    description: 'Importe processos do seu sistema atual ou adicione manualmente. Nossa IA detecta automaticamente o formato e organiza tudo.',
    icon: ICONS.UPLOAD,
    details: [
      'Upload de Excel/CSV',
      'Integração com APIs jurídicas',
      'Detecção automática de sistemas',
      'Mapeamento inteligente de campos'
    ],
    color: 'primary'
  },
  {
    number: '02',
    title: 'IA Analisa Automaticamente',
    description: 'Nossa inteligência artificial lê, analisa e extrai insights estratégicos de cada processo, criando resumos executivos profissionais.',
    icon: ICONS.BRAIN,
    details: [
      'Análise em tempo real',
      'Extração de pontos-chave',
      'Identificação de riscos',
      'Recomendações estratégicas'
    ],
    color: 'accent'
  },
  {
    number: '03',
    title: 'Receba Relatórios Automáticos',
    description: 'Configure uma vez e receba relatórios executivos no seu email. Seus clientes ficam sempre informados sem trabalho manual.',
    icon: ICONS.MAIL,
    details: [
      'Agendamento flexível',
      'Templates profissionais',
      'Envio automático por email',
      'Personalização por cliente'
    ],
    color: 'primary'
  }
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
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

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 bg-gradient-to-br from-neutral-50 to-primary-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <Badge variant="secondary" className="mb-4 bg-accent-50 text-accent-700 border-accent-200">
            Processo Simples
          </Badge>
          <h2 className="font-display font-bold text-3xl sm:text-4xl lg:text-5xl text-primary-800 mb-6">
            Como funciona em
            <span className="bg-gradient-to-r from-accent-500 to-accent-600 bg-clip-text text-transparent">
              {' '}3 passos simples
            </span>
          </h2>
          <p className="text-lg text-neutral-700 max-w-3xl mx-auto">
            Em menos de 5 minutos você terá um sistema completo de automação jurídica
            funcionando para o seu escritório.
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="space-y-16"
        >
          {steps.map((step, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className={`flex flex-col ${
                index % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'
              } items-center gap-12 lg:gap-20`}
            >
              {/* Content */}
              <div className="flex-1 text-center lg:text-left">
                <div className="flex items-center justify-center lg:justify-start mb-6">
                  <div
                    className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl mr-4 ${
                      step.color === 'primary'
                        ? 'bg-gradient-to-br from-primary-600 to-primary-800'
                        : 'bg-gradient-to-br from-accent-500 to-accent-600'
                    }`}
                  >
                    {step.icon}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-neutral-500 mb-1">
                      PASSO {step.number}
                    </div>
                    <h3 className="font-display font-bold text-2xl lg:text-3xl text-primary-800">
                      {step.title}
                    </h3>
                  </div>
                </div>

                <p className="text-lg text-neutral-700 mb-8 leading-relaxed max-w-2xl mx-auto lg:mx-0">
                  {step.description}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto lg:mx-0">
                  {step.details.map((detail, detailIndex) => (
                    <div key={detailIndex} className="flex items-center">
                      <span className="text-accent-500 mr-3">{ICONS.CHECK}</span>
                      <span className="text-neutral-700">{detail}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Visual */}
              <div className="flex-1 max-w-lg">
                <Card className="p-8 bg-white border-neutral-200 shadow-lg">
                  <div className="relative">
                    <div
                      className={`absolute -top-4 -left-4 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                        step.color === 'primary'
                          ? 'bg-gradient-to-br from-primary-600 to-primary-800'
                          : 'bg-gradient-to-br from-accent-500 to-accent-600'
                      }`}
                    >
                      {step.number}
                    </div>

                    {/* Step-specific visuals */}
                    {index === 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg border-2 border-dashed border-neutral-300">
                          <div className="flex items-center">
                            <span className="text-2xl mr-3">{ICONS.DOCUMENT}</span>
                            <div>
                              <div className="font-semibold text-sm">processos.xlsx</div>
                              <div className="text-xs text-neutral-500">1.2 MB</div>
                            </div>
                          </div>
                          <div className="text-accent-500">{ICONS.UPLOAD}</div>
                        </div>
                        <motion.div
                          animate={{ width: ['0%', '100%'] }}
                          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                          className="h-2 bg-accent-500 rounded"
                        />
                        <div className="text-center text-sm text-neutral-600">
                          Detectando sistema: Projuris ✓
                        </div>
                      </div>
                    )}

                    {index === 1 && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-center p-6 bg-gradient-to-br from-primary-50 to-accent-50 rounded-lg">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                            className="text-4xl"
                          >
                            {ICONS.BRAIN}
                          </motion.div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Analisando processos...</span>
                            <span className="text-accent-600">87%</span>
                          </div>
                          <div className="h-2 bg-neutral-200 rounded overflow-hidden">
                            <motion.div
                              animate={{ width: ['0%', '87%'] }}
                              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                              className="h-full bg-gradient-to-r from-primary-500 to-accent-500"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {index === 2 && (
                      <div className="space-y-4">
                        <div className="p-4 bg-gradient-to-r from-primary-600 to-primary-800 rounded-lg text-white">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold">Relatório Semanal</span>
                            <span className="text-xs">Segunda, 07:00</span>
                          </div>
                          <div className="text-xs opacity-90">
                            Para: cliente@empresa.com
                          </div>
                        </div>
                        <div className="flex items-center justify-center py-4">
                          <motion.div
                            animate={{ scale: [1, 1.1, 1] }}
                            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                            className="text-3xl text-accent-500"
                          >
                            {ICONS.MAIL}
                          </motion.div>
                        </div>
                        <div className="text-center text-sm text-neutral-600">
                          Enviado automaticamente ✓
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Call to Action */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-center mt-16"
        >
          <div className="inline-flex items-center gap-2 text-accent-700 font-medium mb-4">
            <span>{ICONS.CLOCK}</span>
            Setup completo em menos de 5 minutos
          </div>
          <div className="text-3xl font-bold text-primary-800">
            Pronto para economizar 20h por semana?
          </div>
        </motion.div>
      </div>
    </section>
  );
}