'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { getPasswordStrength } from '../../../lib/validations/auth';

interface PasswordInputProps {
  id: string;
  name: string;
  value: string;
  onChange: (_e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  showStrength?: boolean;
  error?: string;
  className?: string;
}

export function PasswordInput({
  id,
  name,
  value,
  onChange,
  placeholder = '••••••••',
  showStrength = false,
  error,
  className = '',
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const strength = showStrength ? getPasswordStrength(value) : null;

  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          id={id}
          name={name}
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`appearance-none relative block w-full px-3 py-3 pr-10 border border-neutral-300 placeholder-neutral-500 text-neutral-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 focus:z-10 sm:text-sm ${
            error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''
          } ${className}`}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-neutral-600"
        >
          {showPassword ? (
            <EyeOff className="h-5 w-5" />
          ) : (
            <Eye className="h-5 w-5" />
          )}
        </button>
      </div>

      {showStrength && value && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-600">Força da senha:</span>
            <span className={`font-medium ${
              (strength?.score || 0) >= 4 ? 'text-green-600' :
              (strength?.score || 0) >= 3 ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {strength?.label}
            </span>
          </div>
          <div className="flex space-x-1">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full ${
                  i < (strength?.score || 0) ? strength?.color : 'bg-neutral-200'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}