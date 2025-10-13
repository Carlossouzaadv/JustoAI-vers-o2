'use client';

import React, { forwardRef } from 'react';

interface PhoneInputProps {
  id: string;
  name: string;
  value?: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
  error?: string;
}

const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ id, name, value = '', onChange, onBlur, placeholder, className, error, ...props }, ref) => {
    const formatPhoneNumber = (value: string) => {
      // Remove todos os caracteres que não sejam dígitos
      const phoneNumber = value.replace(/\D/g, '');

      // Aplica a formatação (xx) xxxxx-xxxx
      if (phoneNumber.length <= 2) {
        return phoneNumber;
      } else if (phoneNumber.length <= 7) {
        return `(${phoneNumber.slice(0, 2)}) ${phoneNumber.slice(2)}`;
      } else if (phoneNumber.length <= 11) {
        return `(${phoneNumber.slice(0, 2)}) ${phoneNumber.slice(2, 7)}-${phoneNumber.slice(7)}`;
      } else {
        // Limita a 11 dígitos
        return `(${phoneNumber.slice(0, 2)}) ${phoneNumber.slice(2, 7)}-${phoneNumber.slice(7, 11)}`;
      }
    };

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = event.target.value;
      const formattedValue = formatPhoneNumber(rawValue);

      // Chama o onChange original com o valor formatado
      onChange({
        ...event,
        target: {
          ...event.target,
          value: formattedValue,
          name: name
        }
      } as React.ChangeEvent<HTMLInputElement>);
    };

    return (
      <div>
        <input
          ref={ref}
          id={id}
          name={name}
          type="tel"
          value={value}
          onChange={handleChange}
          onBlur={onBlur}
          placeholder={placeholder}
          autoComplete="tel"
          className={`appearance-none relative block w-full px-3 py-3 border border-neutral-300 placeholder-neutral-500 text-neutral-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 focus:z-10 sm:text-sm ${
            error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''
          } ${className || ''}`}
          {...props}
        />
        {error && (
          <p className="mt-1 text-sm text-red-600">{error}</p>
        )}
      </div>
    );
  }
);

PhoneInput.displayName = 'PhoneInput';

export { PhoneInput };