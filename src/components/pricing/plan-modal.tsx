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

// Type guard for detailed features (with description)
function isDetailedFeature(data: unknown): data is DetailedFeature {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const feature = data as Record<string, unknown>;
  return 'description' in feature && typeof feature.description === 'string';
}

// Detailed feature type (for fully structured data)
interface DetailedFeature {
  limit?: number;
  unlimited?: boolean;
  custom?: boolean;
  included?: boolean;
  channels?: string[];
  description: string;
}

// Simple feature type (for JSON data - just values)
type SimpleFeatureValue = number | string | boolean;

// Features can be either detailed or simple
type FeaturesStructure = Record<string, DetailedFeature | SimpleFeatureValue>;

// Plan type that matches JSON structure more flexibly
type PlanType = {
  readonly id: string;
  readonly name: string;
  readonly subtitle: string;
  readonly price_monthly: number | null;
  readonly price_annual: number | null;
  readonly custom_pricing?: boolean;
  readonly popular?: boolean;
  readonly trial_days: number;
  readonly features?: FeaturesStructure | Record<string, unknown>;
  readonly highlighted_features?: readonly string[];
  readonly contact_sales?: boolean;
};

export interface PlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: PlanType | null;
  billingCycle: 'monthly' | 'annual';
  onStartTrial: (_planId: string) => void;
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

            {/* Show highlighted features if available (simple JSON) */}
            {plan.highlighted_features && plan.highlighted_features.length > 0 && (
              <div className="space-y-3 mb-4">
                {plan.highlighted_features.map((feature, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-500 mt-0.5" />
                    <p className="text-sm text-gray-700">{feature}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Show detailed features if available */}
            {plan.features && (
              <div className="space-y-4">
                {Object.entries(plan.features).flatMap(([key, feature]) => {
                  if (!isDetailedFeature(feature)) return [];
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
            )}
          </div>

          <Separator />

          {/* Support Section - only show if detailed structure */}
          {plan.features &&
           (() => {
             const support = plan.features.support;
             // Type guard: check if support has the detailed structure
             if (
               typeof support === 'object' &&
               support !== null &&
               'description' in support &&
               'channels' in support
             ) {
               const supportDetail = support as {
                 description: string;
                 channels: string[];
               };
               return (
                 <div>
                   <h4 className="font-semibold text-lg mb-3">Suporte incluído:</h4>
                   <div className="flex items-start gap-3">
                     <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                       💬
                     </div>
                     <div>
                       <p className="font-medium text-gray-900">
                         {supportDetail.description}
                       </p>
                       <div className="flex gap-2 mt-2">
                         {supportDetail.channels.map((channel) => (
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
               );
             }
             return null;
           })()
          }

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