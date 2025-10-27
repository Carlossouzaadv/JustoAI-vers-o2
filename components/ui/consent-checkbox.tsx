'use client';

import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ExternalLink, ShieldCheck } from 'lucide-react';

interface ConsentCheckboxProps {
  id: string;
  checked: boolean;
  onChange: (_checked: boolean) => void;
  error?: string;
  required?: boolean;
  variant?: 'terms' | 'privacy' | 'both';
  className?: string;
}

export const ConsentCheckbox: React.FC<ConsentCheckboxProps> = ({
  id,
  checked,
  onChange,
  error,
  required = true,
  variant = 'both',
  className
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.checked);
  };

  const renderConsentText = () => {
    switch (variant) {
      case 'terms':
        return (
          <>
            Li e aceito os{' '}
            <Link
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 hover:text-primary-700 font-medium underline inline-flex items-center gap-1"
            >
              Termos de Uso
              <ExternalLink className="w-3 h-3" />
            </Link>
          </>
        );

      case 'privacy':
        return (
          <>
            Li e aceito a{' '}
            <Link
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 hover:text-primary-700 font-medium underline inline-flex items-center gap-1"
            >
              Política de Privacidade
              <ExternalLink className="w-3 h-3" />
            </Link>
          </>
        );

      case 'both':
      default:
        return (
          <>
            Li e aceito os{' '}
            <Link
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 hover:text-primary-700 font-medium underline inline-flex items-center gap-1"
            >
              Termos de Uso
              <ExternalLink className="w-3 h-3" />
            </Link>
            {' '}e a{' '}
            <Link
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 hover:text-primary-700 font-medium underline inline-flex items-center gap-1"
            >
              Política de Privacidade
              <ExternalLink className="w-3 h-3" />
            </Link>
          </>
        );
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-start gap-3">
        {/* Checkbox customizado */}
        <div className="flex-shrink-0 mt-0.5">
          <div className="relative">
            <input
              id={id}
              type="checkbox"
              checked={checked}
              onChange={handleChange}
              className={cn(
                'peer h-5 w-5 rounded border-2 text-primary-600 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
                'transition-all duration-200 cursor-pointer',
                'border-gray-300 focus:border-primary-500',
                // Touch-friendly sizing
                'min-h-[20px] min-w-[20px] touch-manipulation',
                // Error states
                error && 'border-red-400 focus:border-red-500 focus:ring-red-500',
                // Checked states
                'checked:bg-primary-600 checked:border-primary-600'
              )}
              required={required}
            />

            {/* Custom checkmark */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <svg
                className={cn(
                  'w-3 h-3 text-white transition-opacity duration-200',
                  checked ? 'opacity-100' : 'opacity-0'
                )}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Label com texto de consentimento */}
        <label
          htmlFor={id}
          className="flex-1 text-sm text-gray-700 cursor-pointer leading-relaxed select-none"
        >
          <span className="block">
            {renderConsentText()}
            {required && <span className="text-red-500 ml-1">*</span>}
          </span>
        </label>
      </div>

      {/* Badge LGPD */}
      <div className="flex items-center gap-2 text-xs text-gray-600 ml-8">
        <ShieldCheck className="w-4 h-4 text-green-600" />
        <span>Conforme LGPD (Lei 13.709/2018)</span>
      </div>

      {/* Error message */}
      {error && (
        <div className="ml-8">
          <p className="text-sm text-red-600 flex items-center gap-1">
            <span className="w-4 h-4 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-xs font-bold">!</span>
            {error}
          </p>
        </div>
      )}
    </div>
  );
};

// Componente separado para consentimento de marketing (opcional)
interface MarketingConsentProps {
  id: string;
  checked: boolean;
  onChange: (_checked: boolean) => void;
  className?: string;
}

export const MarketingConsent: React.FC<MarketingConsentProps> = ({
  id,
  checked,
  onChange,
  className
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.checked);
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <input
            id={id}
            type="checkbox"
            checked={checked}
            onChange={handleChange}
            className={cn(
              'h-5 w-5 rounded border-2 text-primary-600 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
              'transition-all duration-200 cursor-pointer',
              'border-gray-300 focus:border-primary-500',
              'min-h-[20px] min-w-[20px] touch-manipulation'
            )}
          />
        </div>

        <label
          htmlFor={id}
          className="flex-1 text-sm text-gray-600 cursor-pointer leading-relaxed select-none"
        >
          <span className="block">
            <strong className="text-gray-700">Opcional:</strong> Aceito receber comunicações de marketing,
            como newsletters, promoções e atualizações sobre produtos via email e WhatsApp.
          </span>
          <span className="text-xs text-gray-500 block mt-1">
            Você pode cancelar a qualquer momento através dos links nos emails ou entrando em contato conosco.
          </span>
        </label>
      </div>
    </div>
  );
};

// Hook para usar com react-hook-form
export const useConsentField = (
  name: string,
  control: import('react-hook-form').Control<Record<string, unknown>>,
  required: boolean = true
) => {
  const { field, fieldState } = useController({
    name,
    control,
    defaultValue: false,
    rules: {
      required: required ? 'Este consentimento é obrigatório' : false,
      validate: required ? (value: boolean) =>
        value === true || 'Você deve aceitar os termos para continuar' : undefined
    }
  });

  return {
    id: name,
    checked: field.value,
    onChange: field.onChange,
    error: fieldState.error?.message,
    required
  };
};

// Para compatibilidade com useController
import { useController } from 'react-hook-form';