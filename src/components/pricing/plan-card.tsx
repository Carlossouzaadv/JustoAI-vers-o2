'use client';

// ================================================================
// PLAN CARD - Card de Plano Individual
// ================================================================

import React from 'react';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Check, Star, ArrowRight } from 'lucide-react';

export interface PlanCardProps {
  plan: {
    id: string;
    name: string;
    subtitle: string;
    price_monthly: number | null;
    price_annual: number | null;
    custom_pricing?: boolean;
    popular?: boolean;
    trial_days: number;
    highlighted_features: string[];

    contact_sales?: boolean;
    visual?: {
      borderColor: string;
      borderWidth: string;
      badge: string;
    };
  };
  billingCycle: 'monthly' | 'annual';
  onSelectPlan: (_planId: string) => void;
  onContactSales?: () => void;
  className?: string;
}

export function PlanCard({
  plan,
  billingCycle,
  onSelectPlan,
  onContactSales,
  className = ''
}: PlanCardProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const getCurrentPrice = () => {
    if (plan.custom_pricing) return null;
    return billingCycle === 'monthly' ? plan.price_monthly : plan.price_annual;
  };

  const getPriceDisplay = () => {
    const currentPrice = getCurrentPrice();
    if (!currentPrice) return null;

    const monthlyEquivalent = billingCycle === 'annual' ? currentPrice / 12 : currentPrice;

    return {
      main: formatPrice(monthlyEquivalent),
      period: billingCycle === 'annual' ? '/mês (cobrado anualmente)' : '/mês',
      annual: billingCycle === 'annual' ? formatPrice(currentPrice) : null
    };
  };

  const priceDisplay = getPriceDisplay();

  const handlePlanSelection = () => {
    if (plan.contact_sales && onContactSales) {
      onContactSales();
    } else {
      onSelectPlan(plan.id);
    }
  };

  return (
    <Card
      className={`relative transition-all duration-300 hover:shadow-lg ${plan.visual
        ? `${plan.visual.borderWidth} ${plan.visual.borderColor} shadow-lg scale-105`
        : plan.popular
          ? 'ring-2 ring-blue-500 shadow-lg scale-105'
          : 'hover:scale-105'
        } ${className}`}
    >
      {/* Popular badge */}
      {plan.popular && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
          <Badge className="bg-blue-500 text-white px-4 py-1 flex items-center gap-1">
            <Star className="w-3 h-3" />
            Mais Popular
          </Badge>
        </div>
      )}

      {/* Enterprise / Custom badge */}
      {plan.visual && plan.visual.badge && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
          <Badge className={`${plan.visual.badge} text-white px-4 py-1 flex items-center gap-1 border-0`}>
            <Star className="w-3 h-3" />
            Customizado
          </Badge>
        </div>
      )}

      <CardHeader className="text-center pb-4">
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
          <p className="text-gray-600 text-sm">{plan.subtitle}</p>
        </div>

        {/* Price display */}
        <div className="py-4">
          {plan.custom_pricing ? (
            <div>
              <div className="text-3xl font-bold text-gray-900 mb-1">
                Preço personalizado
              </div>
              <p className="text-sm text-gray-600">
                Sob medida para suas necessidades
              </p>
            </div>
          ) : priceDisplay ? (
            <div>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-3xl font-bold text-gray-900">
                  {priceDisplay.main}
                </span>
                <span className="text-gray-600 text-sm">
                  {priceDisplay.period}
                </span>
              </div>
              {priceDisplay.annual && (
                <p className="text-sm text-gray-600 mt-1">
                  Total anual: {priceDisplay.annual}
                </p>
              )}
              {billingCycle === 'annual' && (
                <Badge variant="secondary" className="mt-2 bg-green-100 text-green-700">
                  Economize 15% pagando anualmente
                </Badge>
              )}
            </div>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Trial info */}
        {plan.trial_days > 0 && (
          <div className="text-center">
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              ✨ Teste grátis por {plan.trial_days} dias
            </Badge>
          </div>
        )}

        {/* Features list */}
        <div className="space-y-3">
          {plan.highlighted_features.map((feature, index) => (
            <div key={index} className="flex items-start gap-2">
              <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-gray-700">{feature}</span>
            </div>
          ))}
        </div>

        {/* CTA Button */}
        <div className="pt-4">
          <Button
            onClick={handlePlanSelection}
            className={`w-full ${plan.contact_sales
              ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white border-0'
              : plan.popular
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-gray-900 hover:bg-gray-800'
              }`}
            size="lg"
          >
            {plan.contact_sales ? (
              <>
                Falar com Vendas
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            ) : (
              <>
                {plan.trial_days > 0 ? (
                  <>
                    Testar Grátis por {plan.trial_days} Dias
                  </>
                ) : (
                  <>
                    Assinar — {plan.name} {priceDisplay ? `(${priceDisplay.main})` : ''}
                  </>
                )}
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>

          {!plan.contact_sales && (
            <p className="text-xs text-center text-gray-500 mt-2">
              Sem compromisso • Cancele quando quiser
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default PlanCard;