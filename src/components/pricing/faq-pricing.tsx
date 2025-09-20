'use client';

// ================================================================
// FAQ PRICING - Perguntas Frequentes sobre Preços
// ================================================================

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronDown } from 'lucide-react';

interface FaqItem {
  question: string;
  answer: string;
}

interface FaqPricingProps {
  faqItems: FaqItem[];
  className?: string;
}

export function FaqPricing({ faqItems, className = '' }: FaqPricingProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleItem = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <Card className={className}>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">
          Perguntas Frequentes
        </CardTitle>
        <p className="text-gray-600">
          Tire suas dúvidas sobre nossos planos e funcionalidades
        </p>
      </CardHeader>

      <CardContent>
        <div className="w-full space-y-2">
          {faqItems.map((item, index) => (
            <div key={index} className="border-b border-gray-200">
              <button
                onClick={() => toggleItem(index)}
                className="flex w-full items-center justify-between py-4 text-left hover:text-blue-600 transition-colors"
              >
                <span className="font-medium">{item.question}</span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
                    openIndex === index ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {openIndex === index && (
                <div className="pb-4 pt-0 text-gray-600 prose prose-sm max-w-none">
                  <div dangerouslySetInnerHTML={{ __html: item.answer }} />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Additional help section */}
        <div className="mt-8 bg-blue-50 rounded-lg p-6 text-center">
          <div className="space-y-3">
            <div className="text-2xl">💬</div>
            <h4 className="font-semibold text-blue-900">
              Ainda tem dúvidas?
            </h4>
            <p className="text-blue-800 text-sm">
              Nossa equipe está pronta para ajudar você a escolher o melhor plano
              para seu escritório.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href="mailto:vendas@justoai.com"
                className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                📧 vendas@justoai.com
              </a>
              <a
                href="https://wa.me/5511999999999"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
              >
                📱 WhatsApp
              </a>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default FaqPricing;