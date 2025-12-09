'use client';

// ================================================================
// PRICING PAGE - Página de Planos e Preços
// ================================================================

import React, { useState, useEffect } from 'react';
// import { Metadata } from 'next'; // Not needed for client components
import BillingToggle from '../../components/pricing/billing-toggle';
import PlanCard from '../../components/pricing/plan-card';
import FeatureMatrix from '../../components/pricing/feature-matrix';
import CreditsPacks from '../../components/pricing/credits-packs';
import FaqPricing from '../../components/pricing/faq-pricing';
import PlanModal from '../../components/pricing/plan-modal';
import EnterpriseModal from '../../components/modals/enterprise-modal';
import { Button } from '../../components/ui/button';
import { ArrowLeft, Star, Shield } from 'lucide-react';

// Import pricing data
import pricingData from '../../config/pricing.json';

// Type for the plan data from JSON
type PlanData = typeof pricingData.plans[number];

// Type guard to validate plan matches PlanModal expectations
function isPlanData(data: unknown): data is PlanData {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const plan = data as Record<string, unknown>;
  return (
    typeof plan.id === 'string' &&
    typeof plan.name === 'string' &&
    typeof plan.subtitle === 'string' &&
    'price_monthly' in plan &&
    'price_annual' in plan &&
    typeof plan.trial_days === 'number'
  );
}

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showEnterpriseModal, setShowEnterpriseModal] = useState(false);

  // Set page metadata
  useEffect(() => {
    document.title = pricingData.meta.title;

    // Update meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', pricingData.meta.description);
    }
  }, []);

  const handlePlanSelection = (planId: string) => {
    setSelectedPlan(planId);
    setShowPlanModal(true);

    // Analytics tracking
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'select_plan', {
        plan_id: planId,
        billing_cycle: billingCycle
      });
    }
  };

  const handleStartTrial = (planId: string) => {
    // Analytics tracking
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'begin_checkout', {
        currency: 'BRL',
        value: getSelectedPlanPrice(planId),
        items: [{
          item_id: planId,
          item_name: pricingData.plans.find(p => p.id === planId)?.name,
          category: 'subscription',
          quantity: 1
        }]
      });
    }

    // Redirect to checkout/signup
    window.location.href = `/signup?plan=${planId}&billing=${billingCycle}`;
  };

  const handleContactSales = () => {
    // Analytics tracking
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'contact_sales', {
        plan_id: 'enterprise'
      });
    }

    // Redirect to contact form or open modal
    setShowEnterpriseModal(true);
  };

  const handleBuyCredits = (packId: string) => {
    // Analytics tracking
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'click_buy_credits', {
        pack_id: packId
      });
    }

    // Redirect to credits purchase
    window.location.href = `/checkout/credits?pack=${packId}`;
  };

  const getSelectedPlanPrice = (planId: string) => {
    const plan = pricingData.plans.find(p => p.id === planId);
    if (!plan) return 0;

    return billingCycle === 'monthly' ? plan.price_monthly : plan.price_annual;
  };

  const selectedPlanData: PlanData | null = selectedPlan
    ? (pricingData.plans.find(p => p.id === selectedPlan) ?? null)
    : null;

  // Safety check for data
  if (!pricingData || !pricingData.plans || !pricingData.copy) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Erro ao carregar dados de preços
          </h1>
          <p className="text-gray-600">
            Por favor, tente novamente mais tarde.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation breadcrumb */}
      <div className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Button
            variant="ghost"
            onClick={() => window.history.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Button>
        </div>
      </div>

      {/* Hero Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            {pricingData.copy.hero.headline}
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            {pricingData.copy.hero.subheadline}
          </p>

          {/* Trust indicators */}
          <div className="flex flex-wrap justify-center items-center gap-6 mb-8">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Shield className="w-4 h-4 text-green-500" />
              <span>Teste grátis por 7 dias</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Shield className="w-4 h-4 text-green-500" />
              <span>Sem compromisso</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Shield className="w-4 h-4 text-green-500" />
              <span>Cancele quando quiser</span>
            </div>
          </div>

          {/* Billing Toggle */}
          <BillingToggle
            billingCycle={billingCycle}
            onToggle={setBillingCycle}
            annualDiscountPct={pricingData.meta.annual_discount_pct}
            className="mb-12"
          />
        </div>
      </section>

      {/* Plans Section */}
      <section className="pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {pricingData.plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                billingCycle={billingCycle}
                onSelectPlan={handlePlanSelection}
                onContactSales={handleContactSales}
              />
            ))}
          </div>

          {/* Disclaimers */}
          <div className="mt-12 space-y-2 text-center text-sm text-gray-500">
            <p>{pricingData.copy.disclaimers.reports}</p>
            <p>{pricingData.copy.disclaimers.taxes}</p>
            <p>{pricingData.copy.disclaimers.fifo}</p>
          </div>
        </div>
      </section>

      {/* Feature Matrix Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <FeatureMatrix featuresMatrix={pricingData.features_matrix} />
        </div>
      </section>

      {/* Credits Packs Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <CreditsPacks
            creditPacks={pricingData.credit_packs as Array<{
              id: string;
              name: string;
              description: string;
              credits: number;
              price: number;
              type: 'reports' | 'analysis';
              popular?: boolean;
              savings?: string;
            }>}
            onBuyPack={handleBuyCredits}
          />
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <FaqPricing faqItems={pricingData.faq} />
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-blue-900 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">
            Pronto para começar?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Escolha seu plano e comece a transformar a gestão do seu escritório hoje mesmo.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={() => handlePlanSelection('professional')}
              size="lg"
              className="bg-white text-blue-900 hover:bg-gray-100"
            >
              <Star className="w-4 h-4 mr-2" />
              Começar com Professional
            </Button>
            <Button
              onClick={() => handleContactSales()}
              variant="outline"
              size="lg"
              className="border-white text-white hover:bg-white hover:text-blue-900"
            >
              Falar com Vendas
            </Button>
          </div>
        </div>
      </section>

      {/* Plan Modal */}
      {isPlanData(selectedPlanData) && (
        <PlanModal
          isOpen={showPlanModal}
          onClose={() => setShowPlanModal(false)}
          plan={selectedPlanData}
          billingCycle={billingCycle}
          onStartTrial={handleStartTrial}
          onContactSales={handleContactSales}
        />
      )}
      {!selectedPlanData && (
        <PlanModal
          isOpen={showPlanModal}
          onClose={() => setShowPlanModal(false)}
          plan={null}
          billingCycle={billingCycle}
          onStartTrial={handleStartTrial}
          onContactSales={handleContactSales}
        />
      )}

      {/* Enterprise Modal */}
      <EnterpriseModal
        isOpen={showEnterpriseModal}
        onClose={() => setShowEnterpriseModal(false)}
      />
    </div>
  );
}

// Note: Metadata is handled via useEffect in the component since this is a client component