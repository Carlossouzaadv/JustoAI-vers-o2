'use client';

// Force dynamic rendering - não fazer SSG desta página
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useForm, useController } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PasswordInput } from '@/components/ui/password-input';
import { PhoneInput } from '@/components/ui/phone-input';
import { ConsentCheckbox, MarketingConsent } from '@/components/ui/consent-checkbox';
import { ICONS } from '@/lib/icons';
import { signupSchema, type SignupFormData } from '@/lib/validations/auth';
import { createClient } from '@supabase/supabase-js';

export default function SignupPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // For OAuth signup - lazy initialize only when needed
  const getSupabaseClient = () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      throw new Error('supabaseUrl and supabaseKey are required.');
    }

    return createClient(url, key);
  };

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  });

  const { field: passwordField } = useController({
    name: 'password',
    control,
    defaultValue: ''
  });

  const { field: confirmPasswordField } = useController({
    name: 'confirmPassword',
    control,
    defaultValue: ''
  });

  const { field: termsField } = useController({
    name: 'acceptedTerms',
    control,
    defaultValue: false
  });

  const { field: marketingField } = useController({
    name: 'marketingConsent',
    control,
    defaultValue: false
  });

  const onSubmit = async (data: SignupFormData) => {
    setIsLoading(true);
    setAuthError('');

    try {
      // Call our backend API to handle signup
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          name: data.name,
          phone: data.phone,
          marketingConsent: data.marketingConsent || false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setAuthError(errorData.error || 'Falha ao criar conta. Tente novamente.');
        return;
      }

      const result = await response.json();

      if (result.success) {
        console.log('✅ Conta criada com sucesso:', result.user.id);
        // Aguardar 2 segundos para sincronizar sessão
        await new Promise(resolve => setTimeout(resolve, 2000));
        window.location.href = '/dashboard';
      }
    } catch (error) {
      console.error('❌ Signup error:', error);
      setAuthError('Erro inesperado. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  // OAuth Google signup
  const handleGoogleSignup = async () => {
    setIsLoading(true);
    setAuthError('');

    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) {
        setAuthError(error.message);
      }
    } catch (error) {
      setAuthError('Erro ao conectar com Google. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <Link href="/" className="inline-flex items-center space-x-3 mb-8">
            <div className="w-12 h-12">
              <img src="/logo+nome.png" alt="JustoAI" className="w-full h-full object-contain" />
            </div>
            <span className="font-display font-bold text-2xl text-primary-800">JustoAI</span>
          </Link>
          <h2 className="font-display font-bold text-3xl text-primary-800">
            Comece seu trial gratuito
          </h2>
          <p className="mt-2 text-sm text-neutral-600">
            Já tem uma conta?{' '}
            <Link href="/login" className="font-medium text-accent-600 hover:text-accent-500">
              Entre aqui
            </Link>
          </p>
          <Badge className="mt-4 bg-accent-50 text-accent-700 border-accent-200">
            <span className="w-2 h-2 bg-accent-500 rounded-full animate-pulse mr-2"></span>
            7 dias grátis • Sem cartão de crédito
          </Badge>
        </div>

        {/* OAuth Google Button */}
        <Card className="p-6 shadow-xl border border-neutral-200">
          <Button
            type="button"
            onClick={handleGoogleSignup}
            disabled={isLoading}
            className="w-full flex items-center justify-center px-4 py-3 border border-neutral-300 rounded-lg shadow-sm bg-white text-neutral-700 hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-500 mb-4"
          >
            <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continuar com Google
          </Button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-neutral-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-neutral-500">ou continue com email</span>
            </div>
          </div>

          {authError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{authError}</p>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-neutral-700">
                Nome completo
              </label>
              <div className="mt-1">
                <input
                  {...register('name')}
                  id="name"
                  type="text"
                  autoComplete="name"
                  className={`appearance-none relative block w-full px-3 py-3 border border-neutral-300 placeholder-neutral-500 text-neutral-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 focus:z-10 sm:text-sm ${
                    errors.name ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''
                  }`}
                  placeholder="Seu nome completo"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-neutral-700">
                Email profissional
              </label>
              <div className="mt-1">
                <input
                  {...register('email')}
                  id="email"
                  type="email"
                  autoComplete="email"
                  className={`appearance-none relative block w-full px-3 py-3 border border-neutral-300 placeholder-neutral-500 text-neutral-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 focus:z-10 sm:text-sm ${
                    errors.email ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''
                  }`}
                  placeholder="seu@escritorio.com.br"
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-neutral-700">
                Telefone
              </label>
              <div className="mt-1">
                <input
                  {...register('phone')}
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  className={`appearance-none relative block w-full px-3 py-3 border border-neutral-300 placeholder-neutral-500 text-neutral-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 focus:z-10 sm:text-sm ${
                    errors.phone ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''
                  }`}
                  placeholder="(11) 99999-9999"
                />
                {errors.phone && (
                  <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-neutral-700">
                Senha
              </label>
              <div className="mt-1">
                <PasswordInput
                  id="password"
                  name="password"
                  value={passwordField.value}
                  onChange={passwordField.onChange}
                  showStrength={true}
                  error={errors.password?.message}
                  placeholder="Crie uma senha forte"
                />
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-neutral-700">
                Confirmar senha
              </label>
              <div className="mt-1">
                <PasswordInput
                  id="confirmPassword"
                  name="confirmPassword"
                  value={confirmPasswordField.value}
                  onChange={confirmPasswordField.onChange}
                  error={errors.confirmPassword?.message}
                  placeholder="Digite a senha novamente"
                />
              </div>
            </div>

            {/* Consentimento obrigatório LGPD */}
            <div className="space-y-4">
              <ConsentCheckbox
                id="acceptedTerms"
                checked={termsField.value}
                onChange={termsField.onChange}
                error={errors.acceptedTerms?.message}
                variant="both"
                required={true}
              />

              {/* Consentimento opcional para marketing */}
              <MarketingConsent
                id="marketingConsent"
                checked={marketingField.value ?? false}
                onChange={marketingField.onChange}
              />
            </div>

            <div>
              <Button
                type="submit"
                disabled={isLoading}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-accent-500 to-primary-800 hover:from-accent-600 hover:to-primary-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Criando conta...
                  </div>
                ) : (
                  <div className="flex items-center">
                    {ICONS.ARROW_RIGHT}
                    <span className="ml-2">Começar Trial Gratuito</span>
                  </div>
                )}
              </Button>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center space-x-4 text-xs text-neutral-600">
                <div className="flex items-center">
                  <span className="text-accent-500 mr-1">{ICONS.CHECK}</span>
                  LGPD Compliant
                </div>
                <div className="flex items-center">
                  <span className="text-accent-500 mr-1">{ICONS.SHIELD}</span>
                  SSL Encryption
                </div>
                <div className="flex items-center">
                  <span className="text-accent-500 mr-1">{ICONS.HEART}</span>
                  Dados no Brasil
                </div>
              </div>
            </div>
          </form>
        </Card>

        {/* Footer */}
        <div className="text-center">
          <p className="text-sm text-neutral-500">
            Precisa de ajuda?{' '}
            <a href="mailto:contato@justoai.com.br" className="text-accent-600 hover:text-accent-500">
              Entre em contato
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}