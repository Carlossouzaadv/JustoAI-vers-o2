'use client';

// Force dynamic rendering - não fazer SSG desta página
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ICONS } from '@/lib/icons';
import { X } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Modal states
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [helpEmail, setHelpEmail] = useState('');
  const [helpMode, setHelpMode] = useState<'forgot' | 'verify'>('forgot');
  const [helpLoading, setHelpLoading] = useState(false);
  const [helpMessage, setHelpMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setAuthError('');

    try {
      // Call the server-side login endpoint to set session cookies
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies in request/response
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('❌ Login error:', data.error);
        setAuthError(data.error || 'Falha ao entrar. Verifique suas credenciais.');
        setPassword(''); // Clear password on error
        return;
      }

      if (data.success && data.user) {
        console.log('✅ Login successful:', data.user.id);
        // Session cookies are now set by the server
        // Redirect to dashboard
        window.location.href = '/dashboard';
      }
    } catch (error) {
      console.error('❌ Unexpected login error:', error);
      setAuthError('Erro inesperado. Tente novamente.');
      setPassword('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleHelpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!helpEmail) return;

    setHelpLoading(true);
    setHelpMessage('');

    try {
      const endpoint = helpMode === 'forgot'
        ? '/api/auth/forgot-password'
        : '/api/auth/resend-verification';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: helpEmail }),
      });

      const data = await response.json();

      if (response.ok) {
        setHelpMessage(data.message || 'Email enviado com sucesso! Verifique sua caixa de entrada.');
        setHelpEmail('');
        // Fechar modal após 2 segundos
        setTimeout(() => {
          setShowHelpModal(false);
          setHelpMessage('');
        }, 2000);
      } else {
        setHelpMessage(data.error || 'Erro ao enviar email. Tente novamente.');
      }
    } catch (error) {
      console.error('❌ Error:', error);
      setHelpMessage('Erro ao processar. Tente novamente.');
    } finally {
      setHelpLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <Link href="/" className="inline-flex items-center space-x-3 mb-8">
            <div className="w-12 h-12">
              <Image src="/logo+nome.png" alt="JustoAI" width={144} height={48} className="w-full h-full object-contain" />
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
              {(authError.toLowerCase().includes('not confirmed') ||
                authError.toLowerCase().includes('não confirmado') ||
                authError.toLowerCase().includes('email not verified')) && (
                  <button
                    type="button"
                    onClick={() => {
                      setHelpEmail(email);
                      setHelpMode('verify');
                      setShowHelpModal(true);
                    }}
                    className="mt-2 text-sm font-medium text-red-800 underline hover:text-red-900 flex items-center"
                  >
                    Reenviar email de confirmação
                    <span className="ml-1 text-xs">→</span>
                  </button>
                )}
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
                <button
                  type="button"
                  onClick={() => {
                    setShowHelpModal(true);
                    setHelpMode('forgot');
                  }}
                  className="font-medium text-accent-600 hover:text-accent-500"
                >
                  Esqueceu a senha?
                </button>
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

      {/* Modal Help - Forgot Password / Resend Verification */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
          <Card className="w-full max-w-md p-8 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-primary-800">
                {helpMode === 'forgot' ? 'Recuperar Senha' : 'Reenviar Verificação'}
              </h3>
              <button
                onClick={() => {
                  setShowHelpModal(false);
                  setHelpMessage('');
                  setHelpEmail('');
                }}
                className="text-neutral-400 hover:text-neutral-600"
              >
                <X size={24} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex space-x-2 mb-6 bg-neutral-100 p-1 rounded-lg">
              <button
                onClick={() => {
                  setHelpMode('forgot');
                  setHelpMessage('');
                }}
                className={`flex-1 py-2 px-3 rounded font-medium text-sm transition-colors ${helpMode === 'forgot'
                    ? 'bg-accent-600 text-white'
                    : 'text-neutral-600 hover:text-neutral-900'
                  }`}
              >
                Esqueci Senha
              </button>
              <button
                onClick={() => {
                  setHelpMode('verify');
                  setHelpMessage('');
                }}
                className={`flex-1 py-2 px-3 rounded font-medium text-sm transition-colors ${helpMode === 'verify'
                    ? 'bg-accent-600 text-white'
                    : 'text-neutral-600 hover:text-neutral-900'
                  }`}
              >
                Reenviar Email
              </button>
            </div>

            {/* Description */}
            <p className="text-sm text-neutral-600 mb-6">
              {helpMode === 'forgot'
                ? 'Digite seu email para receber um link de reset de senha.'
                : 'Digite seu email para reenviar o email de verificação de conta.'}
            </p>

            {/* Form */}
            <form onSubmit={handleHelpSubmit} className="space-y-4">
              <div>
                <input
                  type="email"
                  value={helpEmail}
                  onChange={(e) => setHelpEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500"
                  required
                />
              </div>

              {helpMessage && (
                <div
                  className={`p-3 rounded-lg text-sm ${helpMessage.includes('sucesso')
                      ? 'bg-green-50 text-green-800 border border-green-200'
                      : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}
                >
                  {helpMessage}
                </div>
              )}

              <Button
                type="submit"
                disabled={helpLoading || !helpEmail}
                className="w-full bg-gradient-to-r from-accent-500 to-primary-800 hover:from-accent-600 hover:to-primary-900 text-white font-medium py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {helpLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Enviando...
                  </div>
                ) : (
                  'Enviar Email'
                )}
              </Button>
            </form>
          </Card>
        </div>
      )}
    </main>
  );
}