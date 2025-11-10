'use client';

// ================================================================
// PLAN MODAL - Modal de Detalhes do Plano
// ================================================================

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Check, Star, ArrowRight, Users, BarChart3, FileText, Zap } from 'lucide-react';

// Type Guard: Validar Feature
interface Feature {
  limit?: number;
  unlimited?: boolean;
  custom?: boolean;
  included?: boolean;
  channels?: string[];
  description: string;
}

function isFeature(data: unknown): data is Feature {
  // PASSO 1: Validar objeto
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  // PASSO 2: Cast SEGURO para indexação
  const feature = data as Record<string, unknown>;

  // PASSO 3: Validar CADA propriedade com 'in' e 'typeof'
  return (
    'description' in feature &&
    typeof feature.description === 'string' &&
    ('limit' in feature ? typeof feature.limit === 'number' : true) &&
    ('unlimited' in feature ? typeof feature.unlimited === 'boolean' : true) &&
    ('custom' in feature ? typeof feature.custom === 'boolean' : true) &&
    ('included' in feature ? typeof feature.included === 'boolean' : true) &&
    ('channels' in feature ? Array.isArray(feature.channels) : true)
  );
}

export interface PlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: {
    id: string;
    name: string;
    subtitle: string;
    price_monthly: number | null;
    price_annual: number | null;
    custom_pricing?: boolean;
    popular?: boolean;
    trial_days: number;
    features: {
      users: { limit?: number; unlimited?: boolean; description: string };
      processes: { limit?: number; unlimited?: boolean; description: string };
      reports_monthly: { limit?: number; unlimited?: boolean; description: string };
      full_credits_first_month: { limit?: number; custom?: boolean; description: string };
      full_credits_monthly: { limit?: number; custom?: boolean; description: string };
      customization: { included: boolean; description: string };
      support: { channels: string[]; description: string };
      integrations: { included: boolean; custom?: boolean; description: string };
      sla: { included: boolean; custom?: boolean; description: string };
    };
    contact_sales?: boolean;
  } | null;
  billingCycle: 'monthly' | 'annual';
  onStartTrial: (planId: string) => void;
  onContactSales?: () => void;
}

export function PlanModal({
  isOpen,
  onClose,
  plan,
  billingCycle,
  onStartTrial,
  onContactSales
}: PlanModalProps) {
  if (!plan) return null;

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

  const getFeatureIcon = (featureKey: string) => {
    switch (featureKey) {
      case 'users':
        return <Users className="w-4 h-4 text-blue-500" />;
      case 'processes':
        return <BarChart3 className="w-4 h-4 text-green-500" />;
      case 'reports_monthly':
        return <FileText className="w-4 h-4 text-purple-500" />;
      case 'full_credits_first_month':
      case 'full_credits_monthly':
        return <Zap className="w-4 h-4 text-orange-500" />;
      default:
        return <Check className="w-4 h-4 text-gray-500" />;
    }
  };

  const renderFeatureValue = (feature: Feature) => {
    if (feature.unlimited) {
      return (
        <Badge variant="secondary" className="bg-green-100 text-green-700">
          Ilimitado
        </Badge>
      );
    }
    if (feature.custom) {
      return (
        <Badge variant="secondary" className="bg-purple-100 text-purple-700">
          Personalizado
        </Badge>
      );
    }
    if (feature.limit) {
      return <span className="font-medium">{feature.limit}</span>;
    }
    return <span className="text-gray-600">—</span>;
  };

  const handleAction = () => {
    if (plan.contact_sales && onContactSales) {
      onContactSales();
    } else {
      onStartTrial(plan.id);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle className="text-2xl font-bold">
              {plan.name}
            </DialogTitle>
            {plan.popular && (
              <Badge className="bg-blue-500 text-white">
                <Star className="w-3 h-3 mr-1" />
                Popular
              </Badge>
            )}
          </div>
          <DialogDescription className="text-lg">
            {plan.subtitle}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Price Section */}
          <div className="text-center bg-gray-50 rounded-lg p-6">
            {plan.custom_pricing ? (
              <div>
                <div className="text-3xl font-bold text-gray-900 mb-2">
                  Preço personalizado
                </div>
                <p className="text-gray-600">
                  Sob medida para suas necessidades
                </p>
              </div>
            ) : priceDisplay ? (
              <div>
                <div className="flex items-baseline justify-center gap-2 mb-2">
                  <span className="text-4xl font-bold text-gray-900">
                    {priceDisplay.main}
                  </span>
                  <span className="text-gray-600">
                    {priceDisplay.period}
                  </span>
                </div>
                {priceDisplay.annual && (
                  <p className="text-gray-600 mb-2">
                    Total anual: {priceDisplay.annual}
                  </p>
                )}
                {billingCycle === 'annual' && (
                  <Badge variant="secondary" className="bg-green-100 text-green-700">
                    Economize 15% pagando anualmente
                  </Badge>
                )}
              </div>
            ) : null}

            {plan.trial_days > 0 && (
              <div className="mt-4">
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  ✨ Teste grátis por {plan.trial_days} dias
                </Badge>
              </div>
            )}
          </div>

          {/* Features Section */}
          <div>
            <h4 className="font-semibold text-lg mb-4">O que está incluído:</h4>
            <div className="space-y-4">
              {Object.entries(plan.features).flatMap(([key, feature]) => {
                if (!isFeature(feature)) return [];
                return [
                  <div key={key} className="flex items-start gap-3">
                    {getFeatureIcon(key)}
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-gray-900">
                          {feature.description.split(':')[0]}
                        </span>
                        {renderFeatureValue(feature)}
                      </div>
                      {feature.description.includes(':') && (
                        <p className="text-sm text-gray-600">
                          {feature.description.split(':')[1]?.trim()}
                        </p>
                      )}
                    </div>
                  </div>
                ];
              })}
            </div>
          </div>

          <Separator />

          {/* Support Section */}
          <div>
            <h4 className="font-semibold text-lg mb-3">Suporte incluído:</h4>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                💬
              </div>
              <div>
                <p className="font-medium text-gray-900">
                  {plan.features.support.description}
                </p>
                <div className="flex gap-2 mt-2">
                  {plan.features.support.channels.map((channel) => (
                    <Badge key={channel} variant="outline" className="text-xs">
                      {channel === 'email' && '📧 Email'}
                      {channel === 'whatsapp' && '📱 WhatsApp'}
                      {channel === 'ia_assistant' && '🤖 Assistente IA'}
                      {channel === 'dedicated' && '👨‍💼 Dedicado'}
                      {channel === 'phone' && '☎️ Telefone'}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 pt-4">
            <Button
              onClick={handleAction}
              className="w-full"
              size="lg"
            >
              {plan.contact_sales ? (
                <>
                  Falar com Vendas
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              ) : (
                <>
                  Começar Teste Gratuito de {plan.trial_days} Dias
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>

            {!plan.contact_sales && (
              <div className="text-center space-y-2">
                <p className="text-sm text-gray-600">
                  Não é necessário cartão de crédito para começar
                </p>
                <p className="text-xs text-gray-500">
                  Cancele a qualquer momento durante o período de teste
                </p>
              </div>
            )}
          </div>

          {/* Enterprise specific */}
          {plan.id === 'enterprise' && (
            <div className="bg-purple-50 rounded-lg p-4">
              <h5 className="font-medium text-purple-900 mb-2">
                🏢 Plano Enterprise
              </h5>
              <div className="text-sm text-purple-800 space-y-1">
                <p>• Configuração personalizada para suas necessidades</p>
                <p>• Integração com seus sistemas existentes</p>
                <p>• Treinamento dedicado para sua equipe</p>
                <p>• SLA personalizado com garantias específicas</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default PlanModal;