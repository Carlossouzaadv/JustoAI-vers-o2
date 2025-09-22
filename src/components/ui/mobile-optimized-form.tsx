// ================================================================
// FORMULÁRIO OTIMIZADO PARA MOBILE - JUSTOAI V2
// ================================================================
// Componente de formulário com otimizações específicas para dispositivos móveis

'use client';

import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';

// Input otimizado para mobile
interface MobileInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
}

export const MobileInput = forwardRef<HTMLInputElement, MobileInputProps>(
  ({ className, label, error, helperText, fullWidth, type = 'text', ...props }, ref) => {
    // Definir inputMode baseado no type para melhor teclado mobile
    const getInputMode = (inputType: string) => {
      switch (inputType) {
        case 'email':
          return 'email';
        case 'tel':
          return 'tel';
        case 'url':
          return 'url';
        case 'number':
          return 'numeric';
        case 'search':
          return 'search';
        default:
          return 'text';
      }
    };

    const inputId = props.id || `input-${Math.random().toString(36).substr(2, 9)}`;

    return (
      <div className={cn('space-y-2', fullWidth && 'w-full')}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}

        <input
          ref={ref}
          id={inputId}
          type={type}
          inputMode={getInputMode(type)}
          autoComplete={props.autoComplete || getAutoComplete(type)}
          className={cn(
            // Base styles - otimizado para touch
            'w-full px-4 py-3 rounded-lg border border-gray-300',
            'text-base leading-6', // Previne zoom no iOS
            'placeholder-gray-400',
            'transition-colors duration-200',

            // Focus states
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',

            // Touch-friendly sizing
            'min-h-[48px]', // Touch target de 48px
            'touch-manipulation',

            // Error states
            error && 'border-red-300 focus:ring-red-500 focus:border-red-500',

            // Dark mode support
            'dark:bg-gray-800 dark:border-gray-600 dark:text-white dark:placeholder-gray-400',

            className
          )}
          {...props}
        />

        {error && (
          <p className="text-sm text-red-600 flex items-center mt-1">
            <span className="mr-1">⚠️</span>
            {error}
          </p>
        )}

        {helperText && !error && (
          <p className="text-sm text-gray-500 mt-1">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

MobileInput.displayName = 'MobileInput';

// Textarea otimizada para mobile
interface MobileTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
  autoResize?: boolean;
}

export const MobileTextarea = forwardRef<HTMLTextAreaElement, MobileTextareaProps>(
  ({ className, label, error, helperText, fullWidth, autoResize, ...props }, ref) => {
    const textareaId = props.id || `textarea-${Math.random().toString(36).substr(2, 9)}`;

    return (
      <div className={cn('space-y-2', fullWidth && 'w-full')}>
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}

        <textarea
          ref={ref}
          id={textareaId}
          className={cn(
            // Base styles
            'w-full px-4 py-3 rounded-lg border border-gray-300',
            'text-base leading-6', // Previne zoom no iOS
            'placeholder-gray-400',
            'transition-colors duration-200',

            // Focus states
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',

            // Touch-friendly sizing
            'min-h-[120px]', // Altura mínima adequada
            'touch-manipulation',
            'resize-y', // Permite apenas redimensionamento vertical

            // Error states
            error && 'border-red-300 focus:ring-red-500 focus:border-red-500',

            // Auto-resize
            autoResize && 'resize-none overflow-hidden',

            // Dark mode support
            'dark:bg-gray-800 dark:border-gray-600 dark:text-white dark:placeholder-gray-400',

            className
          )}
          {...props}
        />

        {error && (
          <p className="text-sm text-red-600 flex items-center mt-1">
            <span className="mr-1">⚠️</span>
            {error}
          </p>
        )}

        {helperText && !error && (
          <p className="text-sm text-gray-500 mt-1">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

MobileTextarea.displayName = 'MobileTextarea';

// Select otimizado para mobile
interface MobileSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const MobileSelect = forwardRef<HTMLSelectElement, MobileSelectProps>(
  ({ className, label, error, helperText, fullWidth, options, placeholder, ...props }, ref) => {
    const selectId = props.id || `select-${Math.random().toString(36).substr(2, 9)}`;

    return (
      <div className={cn('space-y-2', fullWidth && 'w-full')}>
        {label && (
          <label
            htmlFor={selectId}
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}

        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={cn(
              // Base styles
              'w-full px-4 py-3 rounded-lg border border-gray-300',
              'text-base leading-6', // Previne zoom no iOS
              'bg-white',
              'transition-colors duration-200',
              'appearance-none', // Remove estilo padrão
              'cursor-pointer',

              // Focus states
              'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',

              // Touch-friendly sizing
              'min-h-[48px]',
              'touch-manipulation',

              // Error states
              error && 'border-red-300 focus:ring-red-500 focus:border-red-500',

              // Dark mode support
              'dark:bg-gray-800 dark:border-gray-600 dark:text-white',

              // Espaço para ícone
              'pr-10',

              className
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {/* Ícone de dropdown */}
          <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none">
            <svg
              className="w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 flex items-center mt-1">
            <span className="mr-1">⚠️</span>
            {error}
          </p>
        )}

        {helperText && !error && (
          <p className="text-sm text-gray-500 mt-1">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

MobileSelect.displayName = 'MobileSelect';

// Button otimizado para mobile
interface MobileButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  fullWidth?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

export const MobileButton = forwardRef<HTMLButtonElement, MobileButtonProps>(
  ({
    className,
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    loading = false,
    icon,
    iconPosition = 'left',
    children,
    disabled,
    ...props
  }, ref) => {

    const baseClasses = cn(
      // Base styles
      'inline-flex items-center justify-center font-medium rounded-lg',
      'transition-all duration-200',
      'touch-manipulation',
      'focus:outline-none focus:ring-2 focus:ring-offset-2',
      'disabled:opacity-50 disabled:cursor-not-allowed',

      // Tamanhos com touch targets adequados
      {
        'px-3 py-2 text-sm min-h-[40px]': size === 'sm',
        'px-4 py-3 text-base min-h-[48px]': size === 'md',
        'px-6 py-4 text-lg min-h-[52px]': size === 'lg',
        'px-8 py-5 text-xl min-h-[56px]': size === 'xl',
      },

      // Variantes
      {
        'bg-primary-600 hover:bg-primary-700 text-white focus:ring-primary-500': variant === 'primary',
        'bg-gray-600 hover:bg-gray-700 text-white focus:ring-gray-500': variant === 'secondary',
        'border-2 border-primary-600 text-primary-600 hover:bg-primary-50 focus:ring-primary-500': variant === 'outline',
        'text-primary-600 hover:bg-primary-50 focus:ring-primary-500': variant === 'ghost',
      },

      // Full width
      fullWidth && 'w-full',

      className
    );

    return (
      <button
        ref={ref}
        className={baseClasses}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}

        {icon && iconPosition === 'left' && !loading && (
          <span className={cn('mr-2', children && 'mr-2')}>{icon}</span>
        )}

        {children}

        {icon && iconPosition === 'right' && !loading && (
          <span className={cn('ml-2', children && 'ml-2')}>{icon}</span>
        )}
      </button>
    );
  }
);

MobileButton.displayName = 'MobileButton';

// Utilitário para definir autoComplete
function getAutoComplete(type: string): string {
  switch (type) {
    case 'email':
      return 'email';
    case 'password':
      return 'current-password';
    case 'tel':
      return 'tel';
    case 'url':
      return 'url';
    case 'text':
      return 'name';
    default:
      return 'off';
  }
}

// Form container otimizado
interface MobileFormProps extends React.FormHTMLAttributes<HTMLFormElement> {
  title?: string;
  description?: string;
  children: React.ReactNode;
}

export const MobileForm = forwardRef<HTMLFormElement, MobileFormProps>(
  ({ className, title, description, children, ...props }, ref) => {
    return (
      <form
        ref={ref}
        className={cn(
          'space-y-6 p-4 sm:p-6 lg:p-8',
          'bg-white rounded-lg shadow-sm border border-gray-200',
          'max-w-md mx-auto sm:max-w-lg lg:max-w-xl',
          className
        )}
        {...props}
      >
        {(title || description) && (
          <div className="text-center space-y-2">
            {title && (
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                {title}
              </h2>
            )}
            {description && (
              <p className="text-sm sm:text-base text-gray-600">
                {description}
              </p>
            )}
          </div>
        )}

        {children}
      </form>
    );
  }
);

MobileForm.displayName = 'MobileForm';