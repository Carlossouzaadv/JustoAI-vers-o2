'use client';

/**
 * Admin Layout - Protege todas as rotas /admin/*
 * Dashboard interno para desenvolvedores JustoAI
 * Redireciona para login se não autenticado
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import React from 'react';
import { AlertBadge } from '@/components/ui/alert-badge';

interface NavItem {
  label: string;
  href: string;
  icon: string;
  description: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Home', href: '/admin', icon: '🏠', description: 'Overview rápido' },
  { label: 'Billing', href: '/admin/billing', icon: '💳', description: 'Manage workspaces & credits' },
  { label: 'Atividade', href: '/admin/activity', icon: '📊', description: 'Feed de atividade' },
  { label: 'JUDIT', href: '/admin/dashboard/judit', icon: '🔌', description: 'Monitoramento JUDIT' },
  { label: 'Observabilidade', href: '/admin/observability', icon: '🔍', description: 'Sentry + Performance' },
  { label: 'Filas', href: '/admin/queues', icon: '⚙️', description: 'Bull Queue Dashboard' },
  { label: 'Erros', href: '/admin/errors', icon: '⚠️', description: 'Erro tracking' },
  { label: 'Logs', href: '/admin/logs', icon: '📝', description: 'Real-time logs' },
  { label: 'Alertas', href: '/admin/alerts', icon: '🚨', description: 'System alerts' },
  { label: 'Status', href: '/admin/status', icon: '💚', description: 'Health checks' },
];

export default function AdminLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const checkAuth = useCallback(async () => {
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
        router.push('/login?redirect=/admin');
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
  }, [router]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-300">Verificando acesso...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Router.push will handle redirect
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Top Navigation Bar */}
      <nav className="bg-slate-800 shadow-lg border-b border-slate-700">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 hover:bg-slate-700 rounded-lg transition"
                title="Toggle sidebar"
              >
                ☰
              </button>
              <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                  🔧 JustoAI Admin
                </h1>
                <p className="text-xs text-slate-400">Development Dashboard</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition text-sm font-medium"
                title="Back to main app"
              >
                ← Voltar ao App
              </Link>
              <div className="text-xs text-slate-400 px-4 py-2 bg-slate-700 rounded-lg">
                ⚠️ Restrito
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Navigation */}
        <aside
          className={`${
            sidebarOpen ? 'w-64' : 'w-20'
          } bg-slate-800 border-r border-slate-700 transition-all duration-300 overflow-y-auto`}
        >
          <div className="p-4 space-y-2">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              const isAlertsItem = item.href === '/admin/alerts';

              return (
                <div key={item.href} className="relative">
                  <a
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'text-slate-300 hover:bg-slate-700'
                    }`}
                    title={item.description}
                  >
                    <span className="text-xl flex-shrink-0">{item.icon}</span>
                    {sidebarOpen && (
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{item.label}</p>
                        <p className="text-xs text-slate-400 truncate">{item.description}</p>
                      </div>
                    )}
                  </a>

                  {/* ⭐ Integração Padrão-Ouro: AlertBadge para item de Alertas */}
                  {isAlertsItem && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <AlertBadge />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Sidebar Footer */}
          {sidebarOpen && (
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-slate-900 to-transparent border-t border-slate-700">
              <div className="text-xs text-slate-400 space-y-1">
                <p>💡 Tip: Use sidebar to navigate</p>
                <p>🔗 Click links para detalhesBadges clickáveis</p>
              </div>
            </div>
          )}
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto bg-slate-50">
          <div className="p-6 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
