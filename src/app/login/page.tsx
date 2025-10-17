'use client';

// Force dynamic rendering - não fazer SSG desta página
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ICONS } from '../../../lib/icons';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setAuthError('');

    try {
      // Verify credentials with Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('❌ Login error:', error.message);
        setAuthError(error.message || 'Falha ao entrar. Verifique suas credenciais.');
        setPassword(''); // Clear password on error
        return;
      }

      if (data.user) {
        console.log('✅ Login successful:', data.user.id);
        // Redirect to dashboard
        window.location.href = '/dashboard';
      }
    } catch (error) {
      console.error('❌ Unexpected login error:', error);
      setAuthError('Erro inesperado. Tente novamente.');
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
            Entre na sua conta
          </h2>
          <p className="mt-2 text-sm text-neutral-600">
            Ou{' '}
            <Link href="/signup" className="font-medium text-accent-600 hover:text-accent-500">
              crie uma nova conta
            </Link>
          </p>
        </div>

        {/* Form */}
        <Card className="p-8 shadow-xl border border-neutral-200">
          {authError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{authError}</p>
            </div>
          )}
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-neutral-700">
                Email
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none relative block w-full px-3 py-3 border border-neutral-300 placeholder-neutral-500 text-neutral-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 focus:z-10 sm:text-sm"
                  placeholder="seu@email.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-neutral-700">
                Senha
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none relative block w-full px-3 py-3 border border-neutral-300 placeholder-neutral-500 text-neutral-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 focus:z-10 sm:text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-accent-600 focus:ring-accent-500 border-neutral-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-neutral-900">
                  Lembrar de mim
                </label>
              </div>

              <div className="text-sm">
                <a href="#" className="font-medium text-accent-600 hover:text-accent-500">
                  Esqueceu a senha?
                </a>
              </div>
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
                    Entrando...
                  </div>
                ) : (
                  <div className="flex items-center">
                    {ICONS.ARROW_RIGHT}
                    <span className="ml-2">Entrar</span>
                  </div>
                )}
              </Button>
            </div>

            <div className="text-center">
              <p className="text-xs text-neutral-600">
                Ao continuar, você concorda com nossos{' '}
                <Link href="/terms" className="text-accent-600 hover:text-accent-500">
                  Termos de Uso
                </Link>{' '}
                e{' '}
                <Link href="/privacy" className="text-accent-600 hover:text-accent-500">
                  Política de Privacidade
                </Link>
              </p>
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