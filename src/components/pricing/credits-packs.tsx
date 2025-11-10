'use client';

// ================================================================
// CREDITS PACKS - Pacotes de Créditos Extras
// ================================================================

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Zap, Star, ShoppingCart } from 'lucide-react';

interface CreditsPack {
  id: string;
  name: string;
  description: string;
  credits: number;
  price: number;
  type: 'analysis' | 'reports';
  popular?: boolean;
  savings?: string;
}

interface CreditsPacksProps {
  creditPacks: CreditsPack[];
  onBuyPack: (packId: string) => void;
  className?: string;
}

export function CreditsPacks({
  creditPacks,
  onBuyPack,
  className = ''
}: CreditsPacksProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const getPackTypeIcon = (type: string) => {
    switch (type) {
      case 'analysis':
        return <Zap className="w-5 h-5 text-blue-500" />;
      case 'reports':
        return <ShoppingCart className="w-5 h-5 text-green-500" />;
      default:
        return <Zap className="w-5 h-5 text-gray-500" />;
    }
  };

  const getPackTypeLabel = (type: string) => {
    switch (type) {
      case 'analysis':
        return 'Análises IA';
      case 'reports':
        return 'Relatórios';
      default:
        return 'Créditos';
    }
  };

  return (
    <div className={className}>
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Pacotes de Créditos Extras
        </h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Precisa de mais análises ou relatórios? Compre pacotes extras de créditos
          que nunca vencem e são consumidos automaticamente quando necessário.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {creditPacks.map((pack) => (
          <Card
            key={pack.id}
            className={`relative transition-all duration-300 hover:shadow-lg ${
              pack.popular
                ? 'ring-2 ring-green-400 shadow-lg'
                : 'hover:scale-105'
            }`}
          >
            {/* Popular badge */}
            {pack.popular && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-green-500 text-white px-3 py-1 flex items-center gap-1">
                  <Star className="w-3 h-3" />
                  Mais Vantajoso
                </Badge>
              </div>
            )}

            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-2">
                {getPackTypeIcon(pack.type)}
              </div>

              <CardTitle className="text-lg font-bold text-gray-900">
                {pack.name}
              </CardTitle>

              <p className="text-gray-600 text-sm">{pack.description}</p>

              {/* Savings badge */}
              {pack.savings && (
                <Badge variant="secondary" className="bg-orange-100 text-orange-700 self-center">
                  {pack.savings}
                </Badge>
              )}
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Pack details */}
              <div className="text-center space-y-2">
                <div className="text-3xl font-bold text-gray-900">
                  {pack.credits}
                </div>
                <div className="text-sm text-gray-600">
                  {getPackTypeLabel(pack.type)}
                </div>
              </div>

              {/* Price */}
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {formatPrice(pack.price)}
                </div>
                <div className="text-sm text-gray-600">
                  Pagamento único
                </div>
              </div>

              {/* Value per credit */}
              <div className="text-center">
                <div className="text-xs text-gray-500">
                  {formatPrice(pack.price / pack.credits)} por crédito
                </div>
              </div>

              {/* CTA Button */}
              <Button
                onClick={() => onBuyPack(pack.id)}
                className={`w-full ${
                  pack.popular
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-gray-900 hover:bg-gray-800'
                }`}
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                Comprar Pacote
              </Button>

              {/* Pack benefits */}
              <div className="space-y-1 text-xs text-gray-600">
                <div className="flex items-center justify-center gap-1">
                  ✓ Créditos nunca vencem
                </div>
                <div className="flex items-center justify-center gap-1">
                  ✓ Uso automático quando necessário
                </div>
                <div className="flex items-center justify-center gap-1">
                  ✓ Válido para qualquer plano
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Additional info */}
      <div className="mt-8 bg-blue-50 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
            💡
          </div>
          <div className="space-y-2">
            <h4 className="font-medium text-blue-900">
              Como funcionam os pacotes de créditos?
            </h4>
            <div className="text-sm text-blue-800 space-y-1">
              <p>
                • Os créditos são adicionados à sua conta imediatamente após a compra
              </p>
              <p>
                • Eles são consumidos automaticamente quando você excede os limites do seu plano
              </p>
              <p>
                • Créditos são consumidos por ordem de expiração (FIFO) - os mais antigos primeiro
              </p>
              <p>
                • Pacotes de créditos nunca vencem e podem ser usados em qualquer momento
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export type { CreditsPacksProps, CreditsPack };
export default CreditsPacks;