/* eslint-disable react/no-unescaped-entities */
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ICONS } from '@/lib/icons';

const useCases = [
  {
    title: 'Para o Advogado Autônomo',
    subtitle: 'Impressione clientes e otimize sua prática',
    icon: ICONS.USER,
    description: 'Transforme sua advocacia individual em uma operação profissional e eficiente que transmite confiança e competência.',
    benefits: [
      'Relatórios profissionais que impressionam clientes',
      'Economia de 20+ horas semanais em análises manuais',
      'Parecer mais estabelecido e organizado',
      'Maior retenção de clientes através de comunicação clara',
      'Preços mais altos justificados pela qualidade dos relatórios'
    ],
    scenarios: [
      {
        title: 'Atendimento a Novos Clientes',
        description: 'Apresente análises detalhadas dos processos do cliente em minutos, não horas.'
      },
      {
        title: 'Relatórios de Acompanhamento',
        description: 'Envie atualizações automáticas e profissionais que mantêm o cliente informado.'
      },
      {
        title: 'Justificativa de Honorários',
        description: 'Demonstre o valor do seu trabalho com dados concretos e análises aprofundadas.'
      }
    ],
    testimonial: {
      quote: 'Com a JustoAI, consigo atender mais clientes mantendo a qualidade. Meus relatórios impressionam tanto que aumentei meus honorários em 40%.',
      author: 'Advogado Autônomo'
    }
  },
  {
    title: 'Para Pequenos e Médios Escritórios',
    subtitle: 'Padronize e escale sua operação',
    icon: ICONS.BUILDING,
    description: 'Unifique a qualidade do atendimento, economize tempo da equipe e gerencie múltiplos clientes com consistência profissional.',
    benefits: [
      'Padronização total de relatórios entre advogados',
      'Redução drástica do tempo gasto em análises manuais',
      'Gestão eficiente de múltiplos clientes simultaneamente',
      'Qualidade consistente independente do advogado responsável',
      'Maior produtividade da equipe focada em estratégia'
    ],
    scenarios: [
      {
        title: 'Gestão de Equipe',
        description: 'Todos os advogados produzem relatórios com o mesmo padrão de excelência.'
      },
      {
        title: 'Atendimento Escalável',
        description: 'Aceite mais clientes sem comprometer a qualidade do atendimento.'
      },
      {
        title: 'Controle de Qualidade',
        description: 'Supervisione facilmente o trabalho da equipe através de relatórios padronizados.'
      }
    ],
    testimonial: {
      quote: 'Conseguimos triplicar nossa carteira de clientes sem contratar mais advogados. A JustoAI padronizou nossa operação.',
      author: 'Sócio de Escritório (15 advogados)'
    }
  },
  {
    title: 'Para Departamentos Jurídicos',
    subtitle: 'Relatórios executivos e controle corporativo',
    icon: ICONS.CHART,
    description: 'Forneça à diretoria relatórios executivos precisos, mantenha controle sobre riscos e gerencie grandes volumes de processos.',
    benefits: [
      'Relatórios executivos para a diretoria',
      'Métricas de risco precisas e atualizadas',
      'Controle total sobre grandes volumes de processos',
      'Identificação proativa de tendências e problemas',
      'Tomada de decisão baseada em dados concretos'
    ],
    scenarios: [
      {
        title: 'Reuniões de Diretoria',
        description: 'Apresente o panorama jurídico da empresa com dados precisos e visualizações claras.'
      },
      {
        title: 'Gestão de Riscos',
        description: 'Identifique processos críticos e tendências que podem impactar o negócio.'
      },
      {
        title: 'Controle Orçamentário',
        description: 'Monitore custos jurídicos e preveja despesas futuras com base em dados históricos.'
      }
    ],
    testimonial: {
      quote: 'A diretoria agora recebe relatórios que realmente entendem. Conseguimos antecipar riscos e tomar decisões mais estratégicas.',
      author: 'Gerente Jurídico'
    }
  }
];

export default function CasosDeUsoPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50">
      {/* Hero Section */}
      <section className="py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            <div className="mb-8">
              <Link href="/">
                <Button variant="outline" size="sm">
                  <span className="mr-2">{ICONS.ARROW_LEFT}</span>
                  Voltar ao início
                </Button>
              </Link>
            </div>
            <h1 className="font-display font-bold text-4xl sm:text-6xl text-primary-800 mb-6">
              Como Diferentes Advogados
              <span className="block text-accent-600">Usam a JustoAI</span>
            </h1>
            <p className="text-xl text-neutral-700 mb-8 max-w-3xl mx-auto">
              Descubra como profissionais como você estão transformando sua prática jurídica,
              economizando tempo e impressionando clientes com relatórios automatizados.
            </p>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="pb-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-20">
            {useCases.map((useCase, index) => (
              <div key={index} className="max-w-7xl mx-auto">
                <Card className="p-8 lg:p-12 shadow-xl">
                  {/* Header */}
                  <div className="text-center mb-12">
                    <div className="w-20 h-20 bg-accent-100 rounded-2xl flex items-center justify-center text-accent-600 text-4xl mx-auto mb-6">
                      {useCase.icon}
                    </div>
                    <h2 className="font-display font-bold text-3xl sm:text-4xl text-primary-800 mb-4">
                      {useCase.title}
                    </h2>
                    <p className="text-xl text-accent-600 font-semibold mb-4">
                      {useCase.subtitle}
                    </p>
                    <p className="text-lg text-neutral-700 max-w-3xl mx-auto">
                      {useCase.description}
                    </p>
                  </div>

                  <div className="grid lg:grid-cols-2 gap-12">
                    {/* Benefits */}
                    <div>
                      <h3 className="font-display font-bold text-2xl text-primary-800 mb-6">
                        Principais Benefícios
                      </h3>
                      <ul className="space-y-4">
                        {useCase.benefits.map((benefit, benefitIndex) => (
                          <li key={benefitIndex} className="flex items-start">
                            <span className="text-accent-500 mr-3 mt-1">{ICONS.CHECK}</span>
                            <span className="text-neutral-700">{benefit}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Scenarios */}
                    <div>
                      <h3 className="font-display font-bold text-2xl text-primary-800 mb-6">
                        Cenários de Uso
                      </h3>
                      <div className="space-y-6">
                        {useCase.scenarios.map((scenario, scenarioIndex) => (
                          <div key={scenarioIndex} className="p-4 bg-neutral-50 rounded-lg">
                            <h4 className="font-semibold text-primary-800 mb-2">
                              {scenario.title}
                            </h4>
                            <p className="text-neutral-700 text-sm">
                              {scenario.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Testimonial */}
                  <div className="mt-12 pt-8 border-t border-neutral-200">
                    <div className="bg-gradient-to-r from-accent-50 to-primary-50 rounded-xl p-6 text-center">
                      <div className="text-accent-500 text-3xl mb-4">💬</div>
                      <blockquote className="text-lg text-neutral-700 italic mb-4">
                        "{useCase.testimonial.quote}"
                      </blockquote>
                      <cite className="text-accent-600 font-semibold">
                        — {useCase.testimonial.author}
                      </cite>
                    </div>
                  </div>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary-900">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-display font-bold text-3xl sm:text-4xl text-white mb-6">
            Pronto para Transformar Sua Prática Jurídica?
          </h2>
          <p className="text-xl text-primary-200 mb-8 max-w-2xl mx-auto">
            Independente do seu perfil profissional, a JustoAI tem as ferramentas certas para levar sua advocacia ao próximo nível.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup">
              <Button size="lg" className="bg-accent-500 hover:bg-accent-600 text-white">
                Começar Período Gratuito
                <span className="ml-2">{ICONS.ROCKET}</span>
              </Button>
            </Link>
            <Link href="/contact">
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-primary-900">
                Falar com Especialista
                <span className="ml-2">{ICONS.MAIL}</span>
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}