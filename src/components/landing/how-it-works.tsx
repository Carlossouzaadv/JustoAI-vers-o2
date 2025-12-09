'use client';

import { motion } from 'framer-motion';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { ICONS } from '../../lib/icons';
import { VideoSection } from './video-section';
import Link from 'next/link';

const steps = [
  {
    number: '01',
    title: 'Conecte seus Dados',
    description: 'Importe processos do seu sistema atual ou adicione manualmente. A plataforma detecta automaticamente o formato e organiza tudo.',
    icon: ICONS.UPLOAD,
    time: '2 minutos',
    details: [
      'Upload de Excel/CSV',
      'Detecção automática de sistemas',
      'Mapeamento inteligente de campos',
      'Pronto para sistemas jurídicos'
    ],
    color: 'primary'
  },
  {
    number: '02',
    title: 'Plataforma Analisa Automaticamente',
    description: 'Nossa plataforma lê, analisa e extrai insights estratégicos de cada processo, criando resumos executivos profissionais.',
    icon: ICONS.BRAIN,
    time: '30 segundos',
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
    time: 'Instantâneo',
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
    },
  },
};

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 bg-gradient-to-br from-neutral-50 to-primary-50 relative overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <Badge variant="secondary" className="mb-4 bg-accent-50 text-accent-700 border-accent-200">
            Processo Simples
          </Badge>
          <h2 className="font-display font-bold text-3xl sm:text-4xl lg:text-5xl text-primary-800 mb-6">
            De Excel caótico para relatórios profissionais em{' '}
            <span className="text-accent-600">
              menos de 5 minutos
            </span>
          </h2>
          <p className="text-lg text-neutral-700 max-w-3xl mx-auto">
            Configure uma vez, receba relatórios automaticamente toda semana
          </p>
        </motion.div>

        {/* Video Placeholder Section */}
        <div className="mb-20">
          <div className="text-center mb-6">
            <h3 className="text-2xl font-bold text-primary-900 mb-2">Prefere ver em ação? Assista nosso tour de 3 minutos</h3>
          </div>
          <VideoSection embedded className="!py-0" />
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="space-y-16 relative"
        >
          {/* Connecting Line (Desktop) */}
          <div className="hidden lg:block absolute left-1/2 top-10 bottom-10 w-0.5 bg-gradient-to-b from-primary-200 to-accent-200 -translate-x-1/2 -z-10 opacity-30"></div>

          {steps.map((step, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className={`flex flex-col ${index % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'
                } items-center gap-12 lg:gap-20 relative scroll-reveal`}
            >
              {/* Animated Arrow between steps */}
              {index < steps.length - 1 && (
                <div className={`hidden lg:block absolute top-[100%] ${index % 2 === 0 ? 'right-1/4 translate-x-1/2' : 'left-1/4 -translate-x-1/2'} z-0`}>
                  <svg width="40" height="80" viewBox="0 0 40 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-40">
                    <path d="M20 0V60" stroke="#CBD5E1" strokeWidth="2" strokeDasharray="4 4" />
                    <path d="M10 60L20 70L30 60" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}

              {/* Content */}
              <div className="flex-1 text-center lg:text-left z-10">
                <div className="flex items-center justify-center lg:justify-start mb-6">

                  <Badge className="bg-accent-100 text-accent-700 hover:bg-accent-100 border-0 text-sm px-3 py-1 flex items-center gap-1.5">
                    {ICONS.CLOCK} {step.time}
                  </Badge>
                </div>

                <div className="flex items-center justify-center lg:justify-start mb-4">
                  <div className="text-sm font-bold text-primary-500 tracking-wider mr-2">PASSO {step.number}</div>
                </div>

                <h3 className="font-display font-bold text-2xl lg:text-3xl text-primary-800 mb-4">
                  {step.title}
                </h3>

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
              <div className="flex-1 max-w-lg z-10">
                <Card className="p-8 bg-white border-neutral-200 shadow-xl relative overflow-hidden">
                  <div className="relative">
                    <div
                      className={`absolute -top-4 -left-4 w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg ${step.color === 'primary'
                        ? 'bg-gradient-to-br from-primary-600 to-primary-800'
                        : 'bg-gradient-to-br from-accent-500 to-accent-600'
                        }`}
                    >
                      {step.number}
                    </div>

                    {/* Step-specific visuals - Reuse existing complex SVGs/Logic from previous version but simplify for brevity in this output if needed, but I will keep them to ensure high quality */}
                    {index === 0 && (
                      <div className="space-y-4 pt-4">
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
                        <div className="flex items-center justify-between px-2">
                          <span className="text-xs text-neutral-500">Mapeamento</span>
                          <span className="text-xs font-semibold text-green-600">Automático</span>
                        </div>
                        <motion.div
                          animate={{ width: ['0%', '100%'] }}
                          transition={{ duration: 2, repeat: Infinity, type: 'spring' }}
                          className="h-2 bg-accent-500 rounded"
                        />
                        <div className="text-center text-sm text-neutral-600">
                          Detectando sistema: Projuris ✓
                        </div>
                      </div>
                    )}

                    {index === 1 && (
                      <div className="space-y-4 pt-4">
                        <div className="flex items-center justify-center p-6 bg-gradient-to-br from-primary-50 to-accent-50 rounded-lg">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                            className="text-4xl text-accent-600"
                          >
                            {ICONS.BRAIN}
                          </motion.div>
                        </div>
                        {/* Simplified insights for this view */}
                        <div className="space-y-2">
                          <div className="flex items-center p-2 bg-red-50 rounded border border-red-100">
                            <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
                            <span className="text-xs font-medium text-red-800">Risco Alto detectado</span>
                          </div>
                          <div className="flex items-center p-2 bg-green-50 rounded border border-green-100">
                            <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                            <span className="text-xs font-medium text-green-800">Prazo seguro (+15 dias)</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {index === 2 && (
                      <div className="space-y-4 pt-4">
                        {/* Email Preview */}
                        <div className="bg-white border rounded-lg shadow-sm overflow-hidden filter blur-[0.5px] hover:blur-0 transition-all duration-300">
                          <div className="bg-gray-100 p-2 border-b flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-400"></div>
                            <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                            <div className="text-xs text-gray-500 ml-2">Relatório Semanal.pdf</div>
                          </div>
                          <div className="p-4 space-y-2">
                            <div className="h-2 bg-gray-200 rounded w-3/4"></div>
                            <div className="h-2 bg-gray-200 rounded w-1/2"></div>
                            <div className="h-20 bg-gray-50 rounded border border-gray-100 mt-2"></div>
                          </div>
                        </div>
                        <div className="text-center">
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-200 border-0">
                            {ICONS.CHECK} Enviado
                          </Badge>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA After Steps */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="mt-24"
        >
          <div className="bg-gradient-to-br from-accent-600 to-primary-800 rounded-3xl p-8 sm:p-16 text-center text-white shadow-2xl relative overflow-hidden">
            <div className="relative z-10 max-w-3xl mx-auto">
              <h2 className="text-3xl sm:text-4xl font-bold mb-6">
                Viu como é simples?
              </h2>
              <p className="text-xl text-accent-100 mb-10 leading-relaxed">
                Configure em 5 minutos e comece a receber relatórios automaticamente. <br className="hidden sm:block" />
                <strong className="text-white">Sem compromisso, sem cartão.</strong>
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
                <Link href="/signup">
                  <Button size="lg" className="w-full sm:w-auto bg-white text-accent-700 hover:bg-gray-50 hover:text-accent-800 font-bold px-8 py-6 text-lg shadow-lg">
                    Começar Agora (Grátis) <span className="ml-2">→</span>
                  </Button>
                </Link>
                <Link href="/demo">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto border-2 border-white/30 text-white hover:bg-white/10 hover:text-white px-8 py-6 text-lg bg-transparent">
                    Agendar Demonstração
                  </Button>
                </Link>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-sm text-accent-100 opacity-90">
                <span className="flex items-center gap-1.5">✓ 7 dias grátis</span>
                <span className="flex items-center gap-1.5">✓ Setup em 5 min</span>
                <span className="flex items-center gap-1.5">✓ Suporte via WhatsApp</span>
              </div>
            </div>

            {/* Background Pattern */}
            <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('/grid-pattern.svg')]"></div>
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-accent-400 rounded-full blur-3xl opacity-20"></div>
            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-primary-400 rounded-full blur-3xl opacity-20"></div>
          </div>
        </motion.div>

      </div>
    </section>
  );
}