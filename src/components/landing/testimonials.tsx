/* eslint-disable react/no-unescaped-entities */
'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ICONS } from '../../../lib/icons';

const testimonials = [
  {
    name: 'Dr. Ana Silva',
    role: 'Sócia-fundadora',
    company: 'Silva & Associados',
    location: 'São Paulo, SP',
    image: '/testimonials/ana-silva.jpg',
    content: 'O JustoAI revolucionou nossa prática. Economizamos mais de 20 horas por semana e nossos clientes ficam impressionados com a qualidade dos relatórios automáticos. É como ter um estagiário que nunca dorme.',
    rating: 5,
    metrics: {
      timeSaved: '22h/semana',
      satisfaction: '98%',
      processes: '150+'
    }
  },
  {
    name: 'Dr. Carlos Mendes',
    role: 'Advogado Autônomo',
    company: 'Especialista em Direito Empresarial',
    location: 'Rio de Janeiro, RJ',
    image: '/testimonials/carlos-mendes.jpg',
    content: 'Como advogado solo, preciso ser eficiente. O JustoAI me permite focar no que realmente importa: estratégia e relacionamento com clientes. Os relatórios automáticos mantêm meus clientes sempre informados.',
    rating: 5,
    metrics: {
      timeSaved: '15h/semana',
      satisfaction: '95%',
      processes: '80+'
    }
  },
  {
    name: 'Dra. Mariana Costa',
    role: 'Diretora Jurídica',
    company: 'Departamento Jurídico - TechCorp',
    location: 'Belo Horizonte, MG',
    image: '/testimonials/mariana-costa.jpg',
    content: 'Implementamos o JustoAI em nosso departamento e os resultados são impressionantes. A análise automática nos ajuda a priorizar casos e a tomar decisões mais assertivas. Nosso CEO fica impressionado com os reports.',
    rating: 5,
    metrics: {
      timeSaved: '35h/semana',
      satisfaction: '99%',
      processes: '300+'
    }
  }
];

const companies = [
  { name: 'Silva & Associados', logo: '/companies/silva-associados.png' },
  { name: 'TechCorp Legal', logo: '/companies/techcorp.png' },
  { name: 'Advocacia Digital', logo: '/companies/advocacia-digital.png' },
  { name: 'Jurídico Inovador', logo: '/companies/juridico-inovador.png' },
  { name: 'Law Tech Solutions', logo: '/companies/law-tech.png' },
  { name: 'Smart Legal', logo: '/companies/smart-legal.png' }
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

export function Testimonials() {
  return (
    <section id="testimonials" className="py-24 bg-gradient-to-br from-primary-50 via-white to-accent-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <Badge variant="secondary" className="mb-4 bg-accent-50 text-accent-700 border-accent-200">
            Depoimentos Reais
          </Badge>
          <h2 className="font-display font-bold text-3xl sm:text-4xl lg:text-5xl text-primary-800 mb-6">
            <span className="bg-gradient-to-r from-accent-500 to-accent-600 bg-clip-text text-transparent">
              Resultados Reais,
            </span>
            <span className="block">
              Advogados Satisfeitos
            </span>
          </h2>
          <p className="text-lg text-neutral-700 max-w-3xl mx-auto">
            Descubra como escritórios de todos os tamanhos estão economizando tempo
            e impressionando clientes com o JustoAI.
          </p>
        </motion.div>

        {/* Testimonials Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid lg:grid-cols-3 gap-8 mb-16"
        >
          {testimonials.map((testimonial, index) => (
            <motion.div key={index} variants={itemVariants}>
              <Card className="p-8 h-full bg-white border-neutral-200 hover:shadow-xl transition-all duration-300 group">
                {/* Stars */}
                <div className="flex items-center mb-6">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <motion.span
                      key={i}
                      initial={{ opacity: 0, scale: 0 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.1 * i }}
                      className="text-yellow-400 text-lg"
                    >
                      ★
                    </motion.span>
                  ))}
                </div>

                {/* Content */}
                <blockquote className="text-neutral-700 text-lg leading-relaxed mb-8 italic">
                  "{testimonial.content}"
                </blockquote>

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-gradient-to-r from-primary-50 to-accent-50 rounded-lg">
                  <div className="text-center">
                    <div className="font-bold text-lg text-primary-800">
                      {testimonial.metrics.timeSaved}
                    </div>
                    <div className="text-xs text-neutral-600">economizadas</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-lg text-accent-600">
                      {testimonial.metrics.satisfaction}
                    </div>
                    <div className="text-xs text-neutral-600">satisfação</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-lg text-primary-800">
                      {testimonial.metrics.processes}
                    </div>
                    <div className="text-xs text-neutral-600">processos</div>
                  </div>
                </div>

                {/* Author */}
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-gradient-to-br from-primary-100 to-accent-100 rounded-full flex items-center justify-center mr-4">
                    <span className="text-lg font-bold text-primary-800">
                      {testimonial.name.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                  <div>
                    <div className="font-semibold text-primary-800">
                      {testimonial.name}
                    </div>
                    <div className="text-sm text-neutral-600">
                      {testimonial.role}
                    </div>
                    <div className="text-sm text-neutral-500">
                      {testimonial.company} • {testimonial.location}
                    </div>
                  </div>
                </div>

                {/* Verified Badge */}
                <div className="mt-4 flex items-center text-sm text-accent-600">
                  <span className="mr-2">{ICONS.CHECK}</span>
                  Cliente verificado
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Trusted By Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-center"
        >
          <h3 className="font-display font-semibold text-xl text-neutral-600 mb-8">
            Confiado por escritórios em todo o Brasil
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 items-center opacity-60">
            {companies.map((company, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.05 }}
                transition={{ delay: index * 0.1 }}
                className="grayscale hover:grayscale-0 transition-all duration-300"
              >
                <div className="h-12 bg-neutral-200 rounded-lg flex items-center justify-center">
                  <span className="text-sm font-medium text-neutral-600">
                    {company.name}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Stats Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-16 grid grid-cols-2 lg:grid-cols-4 gap-8 text-center"
        >
          {[
            { value: '100%', label: 'Automação completa' },
            { value: '20h+', label: 'Economia semanal' },
            { value: '7 dias', label: 'Trial gratuito' },
            { value: '24/7', label: 'Suporte ativo' },
          ].map((stat, index) => (
            <motion.div
              key={index}
              initial={{ scale: 0 }}
              whileInView={{ scale: 1 }}
              transition={{ delay: index * 0.1, type: 'spring', stiffness: 200 }}
              className="group"
            >
              <div className="text-3xl lg:text-4xl font-bold text-primary-800 mb-2 group-hover:text-accent-600 transition-colors">
                {stat.value}
              </div>
              <div className="text-neutral-600">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="mt-16 text-center p-8 bg-gradient-to-r from-primary-800 to-primary-700 rounded-2xl text-white"
        >
          <h3 className="font-display font-bold text-2xl lg:text-3xl mb-4">
            Junte-se a esses advogados de sucesso
          </h3>
          <p className="text-lg mb-6 opacity-90">
            Comece sua transformação digital hoje mesmo. Teste grátis por 7 dias.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-white text-primary-800 px-8 py-3 rounded-lg font-semibold hover:bg-neutral-100 transition-colors"
              >
                Começar Gratuitamente
                <span className="ml-2">{ICONS.ARROW_RIGHT}</span>
              </motion.button>
            </Link>
            <Link href="/onboarding-demo">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-primary-800 transition-colors"
              >
                {ICONS.PLAY} Ver Demo
              </motion.button>
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}