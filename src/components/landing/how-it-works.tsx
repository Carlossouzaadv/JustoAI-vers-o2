'use client';

import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ICONS } from '../../../lib/icons';

const steps = [
  {
    number: '01',
    title: 'Conecte seus Dados',
    description: 'Importe processos do seu sistema atual ou adicione manualmente. A plataforma detecta automaticamente o formato e organiza tudo.',
    icon: ICONS.UPLOAD,
    details: [
      'Upload de Excel/CSV',
      'Pronto para sistemas jurídicos',
      'Detecção automática de sistemas',
      'Mapeamento inteligente de campos'
    ],
    color: 'primary'
  },
  {
    number: '02',
    title: 'Plataforma Analisa Automaticamente',
    description: 'Nossa plataforma lê, analisa e extrai insights estratégicos de cada processo, criando resumos executivos profissionais.',
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
                          transition={{ duration: 2, repeat: Infinity, type: "spring" }}
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

                        {/* Insights sendo extraídos em tempo real */}
                        <div className="space-y-3">
                          <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.5, duration: 0.6 }}
                            className="flex items-center p-3 bg-green-50 border border-green-200 rounded-lg"
                          >
                            <div className="w-2 h-2 bg-green-500 rounded-full mr-3 animate-pulse"></div>
                            <div className="text-sm font-medium text-green-800">
                              Risco processual identificado: <span className="text-red-600">Alto</span>
                            </div>
                          </motion.div>

                          <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 1.0, duration: 0.6 }}
                            className="flex items-center p-3 bg-yellow-50 border border-yellow-200 rounded-lg"
                          >
                            <div className="w-2 h-2 bg-yellow-500 rounded-full mr-3 animate-pulse"></div>
                            <div className="text-sm font-medium text-yellow-800">
                              Ponto-chave: <span className="text-amber-600">Cláusula 3.B ambígua</span>
                            </div>
                          </motion.div>

                          <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 1.5, duration: 0.6 }}
                            className="flex items-center p-3 bg-blue-50 border border-blue-200 rounded-lg"
                          >
                            <div className="w-2 h-2 bg-blue-500 rounded-full mr-3 animate-pulse"></div>
                            <div className="text-sm font-medium text-blue-800">
                              Estratégia: <span className="text-blue-600">Contestar prazo decadencial</span>
                            </div>
                          </motion.div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Extraindo insights estratégicos...</span>
                            <span className="text-accent-600">87%</span>
                          </div>
                          <div className="h-2 bg-neutral-200 rounded overflow-hidden">
                            <motion.div
                              animate={{ width: ['0%', '87%'] }}
                              transition={{ duration: 2, repeat: Infinity, type: "spring" }}
                              className="h-full bg-gradient-to-r from-primary-500 to-accent-500"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {index === 2 && (
                      <div className="space-y-4">
                        {/* Header do Email */}
                        <div className="p-3 bg-gradient-to-r from-primary-600 to-primary-800 rounded-t-lg text-white text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold">📧 Relatório Executivo Semanal</span>
                            <span>07:00</span>
                          </div>
                          <div className="opacity-90 mt-1">
                            Para: cliente@empresa.com.br
                          </div>
                        </div>

                        {/* Preview do Relatório Profissional */}
                        <div className="bg-white border-2 border-neutral-200 rounded-b-lg p-4 space-y-3">
                          {/* Logo/Header do Relatório */}
                          <div className="flex items-center justify-between pb-2 border-b border-neutral-200">
                            <div>
                              <div className="font-bold text-primary-800 text-sm">RELATÓRIO EXECUTIVO</div>
                              <div className="text-xs text-neutral-500">Período: 09-15 Set 2025</div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs text-neutral-500">Escritório Silva & Associados</div>
                              <div className="text-xs font-semibold text-primary-600">Powered by JustoAI</div>
                            </div>
                          </div>

                          {/* Resumo Executivo */}
                          <div className="space-y-2">
                            <div className="text-xs font-semibold text-primary-800">📊 RESUMO EXECUTIVO</div>
                            <div className="text-xs text-neutral-700 leading-relaxed">
                              • <strong>12 processos</strong> atualizados esta semana<br/>
                              • <strong>3 prazos críticos</strong> identificados<br/>
                              • <strong>2 oportunidades</strong> de contestação detectadas
                            </div>
                          </div>

                          {/* Gráfico Visual Simples */}
                          <div className="flex items-center gap-2">
                            <div className="text-xs text-neutral-600">Status:</div>
                            <div className="flex gap-1">
                              <div className="w-3 h-2 bg-green-400 rounded-sm"></div>
                              <div className="w-3 h-2 bg-green-400 rounded-sm"></div>
                              <div className="w-3 h-2 bg-yellow-400 rounded-sm"></div>
                              <div className="w-3 h-2 bg-red-400 rounded-sm"></div>
                            </div>
                            <div className="text-xs text-green-600 font-medium">75% Positivo</div>
                          </div>

                          {/* Ações Recomendadas */}
                          <div className="bg-blue-50 border border-blue-200 rounded p-2">
                            <div className="text-xs font-semibold text-blue-800 mb-1">🎯 AÇÕES PRIORITÁRIAS</div>
                            <div className="text-xs text-blue-700">
                              1. Contestar prazo - Processo 1234-56<br/>
                              2. Recurso urgente - até 20/09/2025
                            </div>
                          </div>
                        </div>

                        {/* Indicador de Envio */}
                        <motion.div
                          initial={{ scale: 0.8, opacity: 0.7 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ duration: 0.8, repeat: Infinity, repeatType: "reverse" }}
                          className="text-center"
                        >
                          <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 border border-green-300 rounded-full">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-xs font-medium text-green-800">Enviado automaticamente ✓</span>
                          </div>
                        </motion.div>
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
            Comece a impressionar seus clientes hoje
          </div>
        </motion.div>
      </div>
    </section>
  );
}