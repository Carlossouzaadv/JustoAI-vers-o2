'use client';

// ================================================================
// BILLING TOGGLE - Alternar Mensal/Anual
// ================================================================

import React from 'react';
import { Badge } from '@/components/ui/badge';

interface BillingToggleProps {
  billingCycle: 'monthly' | 'annual';
  onToggle: (cycle: 'monthly' | 'annual') => void;
  annualDiscountPct: number;
  className?: string;
}

export function BillingToggle({
  billingCycle,
  onToggle,
  annualDiscountPct,
  className = ''
}: BillingToggleProps) {
  const discountText = `${Math.round(annualDiscountPct * 100)}% OFF`;

  return (
    <div className={`flex items-center justify-center gap-4 ${className}`}>
      <div className="relative inline-flex items-center bg-gray-100 rounded-lg p-1">
        {/* Background slider */}
        <div
          className={`absolute top-1 bottom-1 bg-white rounded-md shadow-sm transition-all duration-300 ease-in-out ${
            billingCycle === 'monthly'
              ? 'left-1 right-[calc(50%+4px)]'
              : 'right-1 left-[calc(50%+4px)]'
          }`}
        />

        {/* Monthly button */}
        <button
          onClick={() => onToggle('monthly')}
          className={`relative z-10 px-6 py-3 text-sm font-medium transition-colors duration-200 ${
            billingCycle === 'monthly'
              ? 'text-gray-900'
              : 'text-gray-600 hover:text-gray-900'
          }`}
          aria-pressed={billingCycle === 'monthly'}
        >
          Mensal
        </button>

        {/* Annual button */}
        <button
          onClick={() => onToggle('annual')}
          className={`relative z-10 px-6 py-3 text-sm font-medium transition-colors duration-200 flex items-center gap-2 ${
            billingCycle === 'annual'
              ? 'text-gray-900'
              : 'text-gray-600 hover:text-gray-900'
          }`}
          aria-pressed={billingCycle === 'annual'}
        >
          Anual
          <Badge
            variant="secondary"
            className="bg-green-100 text-green-700 text-xs px-2 py-0.5"
          >
            {discountText}
          </Badge>
        </button>
      </div>
    </div>
  );
}

export default BillingToggle;