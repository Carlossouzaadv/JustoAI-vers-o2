'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { ICONS } from '../../lib/icons';
import BillingToggle from '../pricing/billing-toggle';
import EnterpriseModal from '../modals/enterprise-modal';

// Import pricing data
import pricingData from '../../config/pricing.json';

// Type definition for pricing plan
interface PricingPlan {
  id: string;
  name: string;
  subtitle: string;
  price_monthly: number | null;
  price_annual: number | null;
  trial_days: number;
  popular?: boolean;
  custom_pricing?: boolean;
  highlighted_features: string[];
  visual?: {
    borderColor: string;
    borderWidth: string;
    badge: string;
  };
  contact_sales?: boolean;
}

// Type guard to validate plan data
function isPricingPlan(plan: unknown): plan is PricingPlan {
  return (
    typeof plan === 'object' &&
    plan !== null &&
    typeof (plan as Record<string, unknown>).id === 'string' &&
    typeof (plan as Record<string, unknown>).name === 'string' &&
    typeof (plan as Record<string, unknown>).subtitle === 'string' &&
    (typeof (plan as Record<string, unknown>).price_monthly === 'number' ||
      (plan as Record<string, unknown>).price_monthly === null) &&
    (typeof (plan as Record<string, unknown>).price_annual === 'number' ||
      (plan as Record<string, unknown>).price_annual === null) &&
    typeof (plan as Record<string, unknown>).trial_days === 'number' &&
    Array.isArray((plan as Record<string, unknown>).highlighted_features)
  );
}

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

export function Pricing() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [showEnterpriseModal, setShowEnterpriseModal] = useState(false);

  // Safety check for data
  if (!pricingData || !pricingData.plans || !pricingData.copy) {
    return (
      <section id="pricing" className="py-24 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Erro ao carregar preços
            </h2>
            <p className="text-gray-600">
              Por favor, tente novamente mais tarde.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const formatPrice = (price: number | null) => {
    if (!price) return null;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const getCurrentPrice = (plan: unknown): number | null => {
    if (!isPricingPlan(plan)) return null;
    if (plan.custom_pricing) return null;
    return billingCycle === 'monthly' ? plan.price_monthly : plan.price_annual;
  };

  const getPriceDisplay = (plan: unknown): string | null => {
    const currentPrice = getCurrentPrice(plan);
    if (!currentPrice) return null;

    const monthlyEquivalent = billingCycle === 'annual' ? currentPrice / 12 : currentPrice;
    return formatPrice(monthlyEquivalent);
  };



  return (
    <>
      <EnterpriseModal
        isOpen={showEnterpriseModal}
        onClose={() => setShowEnterpriseModal(false)}
      />
      <section id="pricing" className="py-24 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <Badge variant="secondary" className="mb-4 bg-accent-50 text-accent-700 border-accent-200">
              Transparência Total
            </Badge>
            <h2 className="font-display font-bold text-3xl sm:text-4xl lg:text-5xl text-primary-800 mb-6">
              {pricingData.copy.hero.headline}
              <span className="bg-gradient-to-r from-accent-500 to-accent-600 bg-clip-text text-transparent block">
                que falam o seu idioma
              </span>
            </h2>
            <p className="text-lg text-neutral-700 max-w-3xl mx-auto mb-8">
              {pricingData.copy.hero.subheadline}
            </p>

            {/* Billing Toggle */}
            <BillingToggle
              billingCycle={billingCycle}
              onToggle={setBillingCycle}
              annualDiscountPct={pricingData.meta.annual_discount_pct}
              className="mb-8"
            />

            {/* Trust indicators */}
            <div className="inline-flex items-center gap-4 p-1 bg-neutral-100 rounded-lg">
              <Badge variant="destructive" className="bg-green-500 text-white">
                {ICONS.SHIELD} Teste gratuito
              </Badge>
              <span className="text-sm text-neutral-600">7 dias grátis • Sem cartão de crédito</span>
            </div>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid lg:grid-cols-3 gap-8 max-w-7xl mx-auto"
          >
            {pricingData.plans.map((plan: unknown, index: number) => {
              if (!isPricingPlan(plan)) {
                return null;
              }

              const priceDisplay = getPriceDisplay(plan);

              return (
                <motion.div key={index} variants={itemVariants}>
                  <Card className={`p-8 h-full relative overflow-hidden transition-all duration-300 
                  ${plan.visual
                      ? `${plan.visual.borderWidth} ${plan.visual.borderColor} scale-105 shadow-xl bg-gradient-to-br from-white to-purple-50`
                      : plan.popular
                        ? 'border-2 border-accent-500 shadow-xl scale-105 bg-gradient-to-br from-white to-accent-50'
                        : 'border-neutral-200 hover:border-primary-200 hover:shadow-lg'
                    }`}>
                    {plan.popular && (
                      <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 z-20">
                        <Badge className={`${plan.visual?.badge || 'bg-gradient-to-r from-accent-500 to-accent-600'} text-white px-4 py-2 shadow-lg border-0 text-sm font-semibold`}>
                          {plan.id === 'enterprise' ? '⭐ Customizado' : '⭐ Mais Popular'}
                        </Badge>
                      </div>
                    )}

                    {billingCycle === 'annual' && !plan.custom_pricing && (
                      <div className="absolute top-4 right-4">
                        <Badge variant="destructive" className="bg-green-500 text-white">
                          15% OFF
                        </Badge>
                      </div>
                    )}

                    <div className="text-center mb-8">
                      <h3 className="font-display font-bold text-2xl text-primary-800 mb-2">
                        {plan.name}
                      </h3>
                      <p className="text-neutral-600 mb-6">
                        {plan.subtitle}
                      </p>

                      <div className="space-y-2">
                        {plan.custom_pricing ? (
                          <div className="flex items-baseline justify-center">
                            <span className="text-3xl lg:text-4xl font-bold text-primary-800">
                              Preço personalizado
                            </span>
                          </div>
                        ) : priceDisplay ? (
                          <>
                            <div className="flex items-baseline justify-center">
                              <span className="text-4xl lg:text-5xl font-bold text-primary-800">
                                {priceDisplay}
                              </span>
                              <span className="text-neutral-600 ml-1">
                                /mês
                              </span>
                            </div>
                            {billingCycle === 'annual' && (
                              <div className="text-sm text-green-600 font-medium">
                                Economize {Math.round(pricingData.meta.annual_discount_pct * 100)}% pagando anualmente
                              </div>
                            )}
                          </>
                        ) : null}
                      </div>
                    </div>

                    <div className="space-y-4 mb-8">
                      {plan.highlighted_features.map((feature, featureIndex) => (
                        <div key={featureIndex} className="flex items-start">
                          <span className="text-accent-500 mr-3 mt-0.5 flex-shrink-0">
                            {ICONS.CHECK}
                          </span>
                          <span className="text-neutral-700">
                            {feature}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-auto space-y-4">
                      {plan.trial_days > 0 && (
                        <div className="text-center">
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                            ✨ Teste grátis por {plan.trial_days} dias
                          </Badge>
                        </div>
                      )}

                      {plan.contact_sales ? (
                        <Button
                          onClick={() => setShowEnterpriseModal(true)}
                          className="w-full py-3 text-lg font-semibold transition-all duration-200 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105"
                        >
                          Falar com Especialista
                          <span className="ml-2">
                            {ICONS.ARROW_RIGHT}
                          </span>
                        </Button>
                      ) : (
                        <Link href="/pricing" className="block">
                          <Button
                            className={`w-full py-3 text-lg font-semibold transition-all duration-200 ${plan.popular
                              ? 'bg-accent-500 hover:bg-accent-600 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
                              : 'bg-primary-800 hover:bg-primary-700 text-white'
                              }`}
                          >
                            Ver Planos Completos
                            <span className="ml-2">
                              {ICONS.ARROW_RIGHT}
                            </span>
                          </Button>
                        </Link>
                      )}

                      <div className="text-center">
                        <span className="text-sm text-neutral-500">
                          Sem compromisso • Cancele quando quiser
                        </span>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>

          {/* FAQ Pricing - Simplified for landing */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-20 text-center"
          >
            <h3 className="font-display font-bold text-2xl text-primary-800 mb-8">
              Perguntas Frequentes sobre Preços
            </h3>

            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto text-left">
              <div>
                <h4 className="font-semibold text-primary-800 mb-2">
                  O que é um crédito de Análise completa?
                </h4>
                <p className="text-neutral-700">
                  Créditos de Análises completas são usados para análises profundas que exigem processamento extra via nossa IA.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-primary-800 mb-2">
                  Relatórios são ilimitados?
                </h4>
                <p className="text-neutral-700">
                  Não. Para proteção da plataforma, aplicamos limites por plano (fair-use). Veja as cotas nos planos.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-primary-800 mb-2">
                  Como funciona o desconto anual?
                </h4>
                <p className="text-neutral-700">
                  Assinando anualmente, você economiza 15% em relação ao pagamento mensal.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-primary-800 mb-2">
                  Posso cancelar a qualquer momento?
                </h4>
                <p className="text-neutral-700">
                  Sim, você pode cancelar sua assinatura a qualquer momento. Sem multas ou compromissos.
                </p>
              </div>
            </div>

            {/* CTA to full pricing */}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mt-16 text-center py-12 bg-neutral-50 rounded-2xl border border-neutral-200"
          >
            <div className="text-4xl mb-4 text-accent-500">📊</div>
            <h3 className="font-display font-bold text-2xl text-primary-800 mb-3">
              Ainda não decidiu qual plano escolher?
            </h3>
            <p className="text-neutral-700 mb-8 max-w-2xl mx-auto text-lg leading-relaxed">
              Compare funcionalidades lado a lado e veja <strong>EXATAMENTE</strong> o que está incluído em cada plano.<br />
              Sem surpresas, sem letras miúdas.
            </p>

            <div className="flex flex-col items-center gap-4">
              <Link href="/pricing">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-2 border-accent-500 text-accent-600 hover:bg-accent-50 hover:text-accent-700 font-bold px-8 py-6 text-lg"
                >
                  Ver Comparativo Completo
                  <span className="ml-2">{ICONS.ARROW_RIGHT}</span>
                </Button>
              </Link>

              <p className="text-sm text-neutral-500 mt-2">
                Ou fale com nossa equipe: <a href="https://wa.me/5500000000000" className="text-accent-600 font-medium hover:underline">WhatsApp</a> ou <a href="mailto:contato@justoai.com.br" className="text-accent-600 font-medium hover:underline">contato@justoai.com.br</a>
              </p>
            </div>
          </motion.div>

        </div>
      </section >
    </>
  );
}