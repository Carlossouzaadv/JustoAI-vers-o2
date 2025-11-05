'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ICONS } from '@/lib/icons';
import BillingToggle from '@/components/pricing/billing-toggle';

// Import pricing data
import pricingData from '@/config/pricing.json';

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

  const getCurrentPrice = (plan: unknown) => {
    if (plan.custom_pricing) return null;
    return billingCycle === 'monthly' ? plan.price_monthly : plan.price_annual;
  };

  const getPriceDisplay = (plan: unknown) => {
    const currentPrice = getCurrentPrice(plan);
    if (!currentPrice) return null;

    const monthlyEquivalent = billingCycle === 'annual' ? currentPrice / 12 : currentPrice;
    return formatPrice(monthlyEquivalent);
  };

  return (
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
          {pricingData.plans.map((plan, index) => {
            const priceDisplay = getPriceDisplay(plan);

            return (
              <motion.div key={index} variants={itemVariants}>
                <Card className={`p-8 h-full relative overflow-hidden transition-all duration-300 ${
                  plan.popular
                    ? 'border-2 border-accent-500 shadow-xl scale-105 bg-gradient-to-br from-white to-accent-50'
                    : 'border-neutral-200 hover:border-primary-200 hover:shadow-lg'
                }`}>
                  {plan.popular && (
                    <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 z-20">
                      <Badge className="bg-gradient-to-r from-accent-500 to-accent-600 text-white px-4 py-2 shadow-lg border-0 text-sm font-semibold">
                        ⭐ Mais Popular
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

                    <Link href="/pricing" className="block">
                      <Button
                        className={`w-full py-3 text-lg font-semibold transition-all duration-200 ${
                          plan.popular
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
          <div className="mt-12 p-6 bg-gradient-to-r from-primary-50 to-accent-50 rounded-2xl border border-primary-200">
            <div className="flex items-center justify-center mb-4">
              <span className="text-2xl mr-3">{ICONS.INFO}</span>
              <h4 className="font-display font-bold text-xl text-primary-800">
                Quer ver todos os detalhes?
              </h4>
            </div>
            <p className="text-neutral-700 mb-4">
              Compare funcionalidades, veja o que está incluído em cada plano e encontre a opção perfeita para seu escritório.
            </p>
            <Link href="/pricing">
              <Button className="bg-accent-500 hover:bg-accent-600 text-white">
                Ver Comparativo Completo
                <span className="ml-2">{ICONS.ARROW_RIGHT}</span>
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Disclaimers */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-12 space-y-2 text-center text-sm text-neutral-500"
        >
          <p>{pricingData.copy.disclaimers.reports}</p>
          <p>{pricingData.copy.disclaimers.taxes}</p>
        </motion.div>
      </div>
    </section>
  );
}