'use client';

// ================================================================
// FEATURE MATRIX - Comparativo Detalhado de Planos
// ================================================================

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Check, X, Star } from 'lucide-react';

interface FeatureMatrixProps {
  featuresMatrix: {
    categories: Array<{
      name: string;
      features: Array<{
        name: string;
        gestao?: string | boolean;
        performance?: string | boolean;
        starter?: string | boolean;
        professional?: string | boolean;
        enterprise?: string | boolean;
      }>;
    }>;
  };
  className?: string;
}

export function FeatureMatrix({ featuresMatrix, className = '' }: FeatureMatrixProps) {
  const renderFeatureValue = (value: unknown, planId: string) => {
    // Handle boolean values
    if (value === true) {
      return <Check className="w-4 h-4 text-green-500 mx-auto" />;
    }
    if (value === false) {
      return <X className="w-4 h-4 text-gray-400 mx-auto" />;
    }

    // Handle null/undefined values
    if (value === null || value === undefined) {
      return <span className="text-gray-400">—</span>;
    }

    // Convert to string for further processing
    const stringValue = String(value);


    // Handle boolean-like string values
    if (stringValue === '✓' || stringValue.toLowerCase() === 'sim') {
      return <Check className="w-4 h-4 text-green-500 mx-auto" />;
    }
    if (stringValue === '✗' || stringValue.toLowerCase() === 'não') {
      return <X className="w-4 h-4 text-gray-400 mx-auto" />;
    }

    // Handle special values
    if (stringValue.toLowerCase().includes('ilimitado')) {
      return (
        <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
          {stringValue}
        </Badge>
      );
    }

    if (stringValue.toLowerCase().includes('personalizado')) {
      return (
        <Badge variant="secondary" className="bg-purple-100 text-purple-700 text-xs">
          {stringValue}
        </Badge>
      );
    }

    // Regular text values
    return (
      <span className={`text-sm ${planId === 'professional' ? 'font-medium' : ''}`}>
        {stringValue}
      </span>
    );
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-center">
          Comparativo Completo de Funcionalidades
        </CardTitle>
        <p className="text-center text-gray-600">
          Veja todas as funcionalidades incluídas em cada plano
        </p>
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            {/* Header */}
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-4 px-4 w-1/4">
                  <span className="text-sm font-medium text-gray-900">
                    Funcionalidade
                  </span>
                </th>
                <th className="text-center py-4 px-4 w-1/4">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-sm font-medium text-gray-900">Gestão</span>
                    <span className="text-xs text-gray-500">Para começar</span>
                  </div>
                </th>
                <th className="text-center py-4 px-4 w-1/4 relative">
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-medium text-gray-900">Performance</span>
                      <Star className="w-3 h-3 text-blue-500" />
                    </div>
                    <span className="text-xs text-gray-500">Mais popular</span>
                  </div>
                  <div className="absolute inset-0 bg-blue-50 rounded-lg -z-10"></div>
                </th>
                <th className="text-center py-4 px-4 w-1/4">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-sm font-medium text-gray-900">Enterprise</span>
                    <span className="text-xs text-gray-500">Sob medida</span>
                  </div>
                </th>
              </tr>
            </thead>

            {/* Features by category */}
            <tbody>
              {featuresMatrix.categories.map((category, categoryIndex) => (
                <React.Fragment key={categoryIndex}>
                  {/* Category header */}
                  <tr>
                    <td colSpan={4} className="py-6">
                      <div className="flex items-center gap-2">
                        <div className="h-px bg-gray-200 flex-1"></div>
                        <h4 className="text-sm font-semibold text-gray-900 bg-white px-4">
                          {category.name}
                        </h4>
                        <div className="h-px bg-gray-200 flex-1"></div>
                      </div>
                    </td>
                  </tr>

                  {/* Category features */}
                  {category.features.map((feature, featureIndex) => (
                    <tr
                      key={featureIndex}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-700 font-medium">
                          {feature.name}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {renderFeatureValue(feature.gestao || feature.starter, 'gestao')}
                      </td>
                      <td className="py-3 px-4 text-center bg-blue-25">
                        {renderFeatureValue(feature.performance || feature.professional, 'performance')}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {renderFeatureValue(feature.enterprise, 'enterprise')}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer notes */}
        <div className="mt-8 space-y-2 text-xs text-gray-500">
          <p>
            ✓ = Funcionalidade incluída • ✗ = Não incluído •{' '}
            <span className="text-green-700">Ilimitado</span> = Sem limites de uso •{' '}
            <span className="text-purple-700">Personalizado</span> = Configurado conforme necessidade
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export type { FeatureMatrixProps };
export default FeatureMatrix;