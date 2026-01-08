'use client';

import { motion } from 'framer-motion';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { InlineSvgIcon } from '../ui/custom-icon';
import Link from 'next/link';

interface Feature {
  icon: React.ReactNode;
  title: string;
  description: string;
  benefit: string;
  highlightBenefit?: string;
  color: 'primary' | 'accent' | 'blue';
  featured?: boolean;
  badge?: string;
}

const features: Feature[] = [
  {
    icon: <InlineSvgIcon name="ia" size={32} />,
    title: 'Economize 20 horas por semana',
    description: 'Nossa IA lê e analisa automaticamente cada andamento processual, extraindo pontos-chave e criando resumos executivos. Você nunca mais perde tempo com trabalho manual.',
    benefit: '→ De 2 horas de leitura para 30 segundos',
    highlightBenefit: 'Análise em 30s',
    color: 'accent',
    featured: true,
    badge: 'Mais Popular',
  },
  {
    icon: <InlineSvgIcon name="cliente" size={32} />,
    title: 'Clientes informados automaticamente',
    description: 'Configure uma vez e nossa IA envia relatórios executivos para seus clientes via WhatsApp ou Email sempre que houver novidade. Mantenha eles informados sem mover um dedo.',
    benefit: '→ Zero chamadas de cobrança de status',
    highlightBenefit: 'Envio 100% automático',
    color: 'blue',
    featured: true,
    badge: 'Diferencial',
  },
  {
    icon: <InlineSvgIcon name="calendario" size={32} />,
    title: 'Identifique riscos antes que eles aconteçam',
    description: 'Avaliação profunda com observações jurídicas e análise de riscos detalhada para cada movimentação.',
    benefit: '→ Antecipe estratégias em dias',
    color: 'primary',
  },
  {
    icon: <InlineSvgIcon name="search" size={32} />,
    title: 'Monitoramento 24/7',
    description: 'Acompanhe automaticamente movimentações processuais com alertas inteligentes em tempo real.',
    benefit: '→ Você dorme, a IA monitora',
    color: 'accent',
  },
  {
    icon: <InlineSvgIcon name="upload" size={32} />,
    title: 'Configure em 5 minutos',
    description: 'Migre seus dados em minutos, com trabalho mínimo. Totalmente compatível com Projuris, Legal One, Astrea e outros.',
    benefit: '→ Sem fidelidade, sem implantação cara',
    color: 'primary',
  },
  {
    icon: <InlineSvgIcon name="home" size={32} />,
    title: 'Veja toda sua carteira em um só lugar',
    description: 'Dashboard inteligente que organiza todos os seus processos por cliente com status visual em tempo real.',
    benefit: '→ Visão gerencial completa',
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
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className={`${feature.featured ? 'md:col-span-2 lg:col-span-1 row-span-2' : ''}`}
            >
              <Card className={`p-8 h-full transition-all duration-300 group hover:shadow-xl relative overflow-hidden border-2 
                ${feature.featured && feature.color === 'accent' ? 'bg-gradient-to-br from-accent-50 to-white border-accent-200' : ''}
                ${feature.featured && feature.color === 'blue' ? 'bg-gradient-to-br from-blue-50 to-white border-blue-200' : ''}
                ${!feature.featured ? 'bg-white border-transparent hover:border-primary-100 shadow-sm' : ''}
              `}>

                {feature.badge && (
                  <Badge className={`absolute top-4 right-4 ${feature.color === 'accent' ? 'bg-accent-500 hover:bg-accent-600' : 'bg-blue-600 hover:bg-blue-700'
                    } text-white border-0`}>
                    {feature.badge}
                  </Badge>
                )}

                <div className="flex flex-col h-full">
                  <div className={`mb-6 rounded-2xl flex items-center justify-center
                    ${feature.featured ? 'w-16 h-16 text-3xl' : 'w-12 h-12 text-xl'}
                    ${feature.color === 'primary' ? 'bg-primary-100 text-primary-600' : ''}
                    ${feature.color === 'accent' ? 'bg-accent-100 text-accent-600' : ''}
                    ${feature.color === 'blue' ? 'bg-blue-100 text-blue-600' : ''}
                  `}>
                    {feature.icon}
                  </div>

                  <h3 className={`font-display font-bold text-primary-900 mb-3 group-hover:text-primary-700 transition-colors
                    ${feature.featured ? 'text-2xl' : 'text-xl'}
                  `}>
                    {feature.title}
                  </h3>

                  <p className="text-neutral-600 mb-6 leading-relaxed flex-grow">
                    {feature.description}
                  </p>

                  <div className={`text-sm font-semibold mt-auto pt-4 border-t
                    ${feature.color === 'primary' ? 'text-primary-600 border-primary-100' : ''}
                    ${feature.color === 'accent' ? 'text-accent-600 border-accent-100' : ''}
                    ${feature.color === 'blue' ? 'text-blue-600 border-blue-100' : ''}
                  `}>
                    {feature.benefit}
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA After Features */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-16 sm:mt-24"
        >
          <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-accent-50 to-blue-50 border border-accent-100 p-8 sm:p-12 lg:p-16 text-center">
            <div className="relative z-10 max-w-3xl mx-auto">
              <h2 className="text-3xl sm:text-4xl font-bold text-primary-900 mb-4">
                Pronto para economizar 20 horas por semana?
              </h2>
              <p className="text-lg text-neutral-600 mb-8 leading-relaxed">
                Junte-se aos advogados que já automatizaram seus relatórios.
                Configure em 5 minutos, teste grátis por 7 dias.
              </p>

              <div className="flex flex-col items-center gap-4">
                <Link href="/signup">
                  <Button size="lg" className="bg-gradient-to-r from-accent-500 to-accent-600 hover:from-accent-600 hover:to-accent-700 text-white px-8 py-6 text-lg shadow-lg hover:shadow-xl transition-all">
                    Testar Grátis Agora <span className="ml-2">→</span>
                  </Button>
                </Link>
                <div className="flex items-center gap-4 text-sm text-neutral-500 font-medium">
                  <span className="flex items-center">
                    <span className="text-accent-500 mr-1">✓</span> Sem cartão de crédito
                  </span>
                  <span className="flex items-center">
                    <span className="text-accent-500 mr-1">✓</span> Cancele quando quiser
                  </span>
                </div>
              </div>
            </div>

            {/* Background Decorations */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-40 pointer-events-none">
              <div className="absolute top-0 right-0 w-64 h-64 bg-accent-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
              <div className="absolute top-0 left-0 w-64 h-64 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
              <div className="absolute -bottom-32 left-20 w-64 h-64 bg-primary-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}