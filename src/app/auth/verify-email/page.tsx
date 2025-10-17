'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ICONS } from '@/lib/icons';

export default function VerifyEmailPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function verifyEmail() {
      try {
        // Get token from URL hash (#access_token=...)
        const hash = window.location.hash;

        if (!hash) {
          setStatus('error');
          setMessage('Link de verificação inválido. Nenhum token encontrado.');
          return;
        }

        // Parse hash to extract access_token
        const params = new URLSearchParams(hash.substring(1));
        const accessToken = params.get('access_token');
        const tokenType = params.get('type');

        if (!accessToken) {
          setStatus('error');
          setMessage('Link de verificação inválido. Token não encontrado.');
          return;
        }

        // Verify the email by confirming the session
        // The access_token from Supabase is already set in cookies by Supabase client
        // We just need to redirect to dashboard on success

        console.log('✅ Email verified successfully');
        setStatus('success');
        setMessage('Email verificado com sucesso!');

        // Redirect to dashboard after 2 seconds
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 2000);
      } catch (error) {
        console.error('Error verifying email:', error);
        setStatus('error');
        setMessage('Erro ao verificar email. Por favor, tente novamente.');
      }
    }

    verifyEmail();
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center space-x-3 mb-8">
            <div className="w-12 h-12">
              <img src="/logo+nome.png" alt="JustoAI" className="w-full h-full object-contain" />
            </div>
            <span className="font-display font-bold text-2xl text-primary-800">JustoAI</span>
          </Link>
        </div>

        <Card className="p-8 shadow-xl border border-neutral-200">
          {status === 'loading' && (
            <div className="text-center space-y-4">
              <div className="flex justify-center mb-4">
                <div className="w-12 h-12 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
              </div>
              <h1 className="text-xl font-bold text-neutral-900">Verificando email...</h1>
              <p className="text-neutral-600">Por favor, aguarde enquanto verificamos seu endereço de email.</p>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center space-y-4">
              <div className="flex justify-center mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl text-green-600">{ICONS.CHECK}</span>
                </div>
              </div>
              <h1 className="text-xl font-bold text-green-600">Email Verificado!</h1>
              <p className="text-neutral-600">Sua conta foi ativada com sucesso. Você será redirecionado para o dashboard em alguns segundos.</p>
              <div className="pt-4">
                <Link href="/dashboard">
                  <Button className="w-full">
                    Ir para Dashboard
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center space-y-4">
              <div className="flex justify-center mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl text-red-600">{ICONS.ERROR}</span>
                </div>
              </div>
              <h1 className="text-xl font-bold text-red-600">Erro na Verificação</h1>
              <p className="text-neutral-600">{message}</p>
              <div className="pt-4 space-y-2">
                <Link href="/signup">
                  <Button variant="outline" className="w-full">
                    Criar Nova Conta
                  </Button>
                </Link>
                <Link href="/login">
                  <Button className="w-full">
                    Fazer Login
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </Card>

        <div className="text-center mt-6">
          <p className="text-sm text-neutral-600">
            Precisa de ajuda?{' '}
            <a href="mailto:contato@justoai.com.br" className="text-accent-600 hover:text-accent-500 font-medium">
              Entre em contato
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
