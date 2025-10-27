'use client';

/**
 * Admin Layout - Protege todas as rotas /admin/*
 * Redireciona para login se não autenticado
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import React from 'react';

export default function AdminLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
      );

      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session) {
        setIsAuthenticated(false);
        router.push('/login?redirect=/admin/dashboard/judit');
        return;
      }

      setIsAuthenticated(true);
    } catch (error) {
      console.error('Auth check failed:', error);
      setIsAuthenticated(false);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Verificando acesso...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Router.push will handle redirect
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Admin Navigation */}
      <nav className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <h1 className="text-xl font-bold text-slate-900">JustoAI Admin</h1>
              <div className="flex gap-4">
                <a
                  href="/admin/dashboard/judit"
                  className="text-slate-600 hover:text-slate-900 font-medium"
                >
                  📊 JUDIT Dashboard
                </a>
                <a
                  href="/"
                  className="text-slate-600 hover:text-slate-900 font-medium"
                >
                  ← Voltar ao app
                </a>
              </div>
            </div>
            <div className="text-sm text-slate-500">
              ⚠️ Área Restrita - Apenas Administradores
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main>{children}</main>
    </div>
  );
}
