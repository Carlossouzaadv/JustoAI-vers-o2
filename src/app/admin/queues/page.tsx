/**
 * Bull Board Queue Dashboard Page
 * Accessible to: Internal admins (@justoai.com.br) OR workspace admins
 */

'use client';

import React, { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export default function QueueDashboard() {
  const [accessGranted, setAccessGranted] = useState<boolean | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [isInternal, setIsInternal] = useState(false);

  useEffect(() => {
    checkAccess();
  }, []);

  async function checkAccess() {
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
      );

      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session?.user?.email) {
        setAccessGranted(false);
        return;
      }

      setUserEmail(session.user.email);

      // Check if internal admin
      const email = session.user.email.toLowerCase();
      const isAdmin = email.endsWith('@justoai.com.br');
      setIsInternal(isAdmin);

      // Fetch Bull Board to verify access is granted
      const response = await fetch('/admin/queues', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        setAccessGranted(true);
      } else if (response.status === 403) {
        setAccessGranted(false);
      } else {
        setAccessGranted(false);
      }
    } catch (error) {
      console.error('Access check failed:', error);
      setAccessGranted(false);
    }
  }

  if (accessGranted === null) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando dashboard de filas...</p>
        </div>
      </div>
    );
  }

  if (!accessGranted) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Acesso Negado</h1>
          <p className="text-gray-600 mb-4">
            Você não tem permissão para acessar o dashboard de filas.
          </p>
          <p className="text-sm text-gray-500 mb-4">
            Email: {userEmail}
          </p>
          <a
            href="/dashboard"
            className="text-blue-600 hover:text-blue-800 underline"
          >
            ← Voltar ao dashboard principal
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">⚙️ Dashboard de Filas</h1>
            <p className="text-slate-600 mt-2">Monitoramento de processamento de jobs em background</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-600">Email</p>
            <p className="font-medium text-slate-900">{userEmail}</p>
            <p className="text-xs text-blue-600 mt-1">
              {isInternal ? '🔐 Admin Interno' : '👤 Admin de Workspace'}
            </p>
          </div>
        </div>
      </div>

      {/* Bull Board Placeholder */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <h2 className="text-xl font-bold text-blue-900 mb-2">Bull Board Queue Monitor</h2>
          <p className="text-blue-700 mb-4">
            Dashboard de monitoramento de filas em tempo real
          </p>
          <p className="text-sm text-blue-600">
            O Bull Board Express Adapter está configurado em <code className="bg-white px-2 py-1 rounded font-mono text-xs">/admin/queues</code>
          </p>
          <div className="mt-4 pt-4 border-t border-blue-200">
            <p className="text-sm text-slate-600 mb-3">
              Você tem acesso total ao Bull Board. As filas ativas incluem:
            </p>
            <ul className="text-left inline-block text-sm text-slate-700">
              <li className="mb-2">✓ Notification Queue - Notificações por email e SMS</li>
              <li>✓ Sistema de monitoramento ativo e saudável</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="text-slate-600 text-sm font-medium">Acesso</div>
          <div className="text-2xl font-bold text-green-600 mt-2">✓ Autorizado</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="text-slate-600 text-sm font-medium">Nível de Admin</div>
          <div className="text-lg font-bold text-slate-900 mt-2">
            {isInternal ? 'Interno' : 'Workspace'}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="text-slate-600 text-sm font-medium">Status</div>
          <div className="text-2xl font-bold text-blue-600 mt-2">🟢 Ativo</div>
        </div>
      </div>

      {/* Help Text */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
        <p className="font-semibold mb-2">ℹ️ Informação</p>
        <p>
          O Bull Board Express Adapter está protegido por autenticação de dois níveis:
          {isInternal ? (
            <>
              <br />• Você é um <strong>Admin Interno</strong> (@justoai.com.br) - tem acesso a TODAS as filas globais
            </>
          ) : (
            <>
              <br />• Você é um <strong>Admin de Workspace</strong> - tem acesso às filas do seu workspace
            </>
          )}
        </p>
      </div>
    </div>
  );
}
