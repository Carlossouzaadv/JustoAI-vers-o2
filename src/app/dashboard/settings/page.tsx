'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ICONS } from '@/lib/icons';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Type guard para verificar propriedades obrigatórias do usuário (Padrão-Ouro Genuíno)
function hasExtendedUserProperties(user: unknown): user is { id: string; email: string } {
  // PASSO 1: Validar objeto
  if (typeof user !== 'object' || user === null) {
    return false;
  }

  // PASSO 2: Cast SEGURO para indexação
  const obj = user as Record<string, unknown>;

  // PASSO 3: Validar propriedades obrigatórias
  return (
    'id' in obj &&
    typeof obj.id === 'string' &&
    'email' in obj &&
    typeof obj.email === 'string'
  );
}

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  avatar: string | null;
  createdAt: string;
}

interface Workspace {
  id: string;
  name: string;
  slug: string;
  plan: 'FREE' | 'STARTER' | 'PROFESSIONAL';
  createdAt: string;
}

export default function SettingsPage() {
  const { user, workspaceId } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Profile form state
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileForm, setProfileForm] = useState({
    name: '',
    phone: '',
  });

  // Workspace state
  const [workspace, setWorkspace] = useState<Workspace | null>(null);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load user profile
      if (user && hasExtendedUserProperties(user)) {
        // Padrão-Ouro: Narrowing SEGURO de propriedades opcionais (PASSO 4)
        // PASSO 4: Narrowing SEGURO para phone/avatar
        const phone = ('phone' in user && typeof user.phone === 'string') ? user.phone : null;
        const avatar = ('avatar' in user && typeof user.avatar === 'string') ? user.avatar : null;
        const createdAt = ('createdAt' in user && typeof user.createdAt === 'string') ? user.createdAt : '';

        // PASSO 5: Usar os valores seguros
        setProfile({
          id: user.id,
          email: user.email,
          name: user.name || null,
          phone,
          avatar,
          createdAt,
        });
        setProfileForm({
          name: user.name || '',
          phone: phone || '',
        });
      }

      // Load workspace data
      if (workspaceId) {
        const response = await fetch(`/api/workspaces/${workspaceId}`, {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setWorkspace(data);
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setMessage('');

      const response = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: profileForm.name,
          phone: profileForm.phone,
        }),
      });

      if (response.ok) {
        setMessage('✅ Perfil atualizado com sucesso!');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage('❌ Erro ao atualizar perfil');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage('❌ Erro ao atualizar perfil');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('Função de trocar senha em desenvolvimento...');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-neutral-600">Carregando configurações...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-neutral-900">Configurações</h1>
        <p className="text-neutral-600 mt-2">Gerencie seu perfil, workspace e preferências</p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            {ICONS.CLIENT}
            Perfil
          </TabsTrigger>
          <TabsTrigger value="workspace" className="flex items-center gap-2">
            {ICONS.PROCESS}
            Workspace
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            {ICONS.SHIELD}
            Segurança
          </TabsTrigger>
        </TabsList>

        {/* PROFILE TAB */}
        <TabsContent value="profile" className="space-y-6">
          {/* Profile Card */}
          <Card>
            <CardHeader>
              <CardTitle>Perfil do Usuário</CardTitle>
              <CardDescription>
                Atualize suas informações pessoais
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleProfileUpdate} className="space-y-6">
                {/* Email (read-only) */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Email
                  </label>
                  <Input
                    type="email"
                    value={profile?.email || ''}
                    disabled
                    className="bg-neutral-50 text-neutral-600"
                  />
                  <p className="text-xs text-neutral-500 mt-1">Email não pode ser alterado aqui</p>
                </div>

                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Nome Completo
                  </label>
                  <Input
                    type="text"
                    value={profileForm.name}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, name: e.target.value })
                    }
                    placeholder="Seu nome completo"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Telefone
                  </label>
                  <Input
                    type="tel"
                    value={profileForm.phone}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, phone: e.target.value })
                    }
                    placeholder="(11) 99999-9999"
                  />
                </div>

                {/* Account Info */}
                <div className="pt-4 border-t border-neutral-200">
                  <h3 className="font-medium text-neutral-900 mb-3">Informações da Conta</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-neutral-600">ID do Usuário</p>
                      <p className="font-mono text-xs text-neutral-900 break-all">{profile?.id}</p>
                    </div>
                    <div>
                      <p className="text-neutral-600">Data de Criação</p>
                      <p className="text-neutral-900">
                        {profile?.createdAt
                          ? new Date(profile.createdAt).toLocaleDateString('pt-BR')
                          : '-'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Message */}
                {message && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">{message}</p>
                  </div>
                )}

                {/* Save Button */}
                <Button type="submit" disabled={saving} className="w-full">
                  {saving ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* WORKSPACE TAB */}
        <TabsContent value="workspace" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informações do Workspace</CardTitle>
              <CardDescription>
                Detalhes do seu espaço de trabalho atual
              </CardDescription>
            </CardHeader>
            <CardContent>
              {workspace ? (
                <div className="space-y-6">
                  {/* Workspace Name */}
                  <div>
                    <label className="text-sm font-medium text-neutral-700">Nome</label>
                    <p className="text-lg font-semibold text-neutral-900 mt-1">
                      {workspace.name}
                    </p>
                  </div>

                  {/* Workspace Slug */}
                  <div>
                    <label className="text-sm font-medium text-neutral-700">URL Slug</label>
                    <p className="font-mono text-sm text-neutral-600 mt-1">{workspace.slug}</p>
                  </div>

                  {/* Workspace Plan */}
                  <div>
                    <label className="text-sm font-medium text-neutral-700">Plano Atual</label>
                    <div className="mt-1">
                      <Badge
                        className={
                          workspace.plan === 'PROFESSIONAL'
                            ? 'bg-purple-100 text-purple-800'
                            : workspace.plan === 'STARTER'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                        }
                      >
                        {workspace.plan === 'PROFESSIONAL'
                          ? 'Profissional'
                          : workspace.plan === 'STARTER'
                            ? 'Iniciante'
                            : 'Gratuito'}
                      </Badge>
                    </div>
                  </div>

                  {/* Workspace ID */}
                  <div>
                    <label className="text-sm font-medium text-neutral-700">ID do Workspace</label>
                    <p className="font-mono text-xs text-neutral-600 break-all mt-1">
                      {workspace.id}
                    </p>
                  </div>

                  {/* Created At */}
                  <div>
                    <label className="text-sm font-medium text-neutral-700">Data de Criação</label>
                    <p className="text-neutral-900 mt-1">
                      {new Date(workspace.createdAt).toLocaleDateString('pt-BR')}
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-4 border-t border-neutral-200 flex gap-2">
                    <Button variant="outline" disabled className="flex-1">
                      Editar Workspace (Em desenvolvimento)
                    </Button>
                    <Button variant="outline" className="text-red-600 hover:text-red-700 flex-1">
                      Deletar Workspace (Em desenvolvimento)
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-neutral-600">
                  <p>Nenhum workspace carregado</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Billing Card */}
          <Card>
            <CardHeader>
              <CardTitle>Faturamento</CardTitle>
              <CardDescription>
                Gerencie seu plano e faturamento
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-900">
                    💳 Funcionalidade de faturamento disponível em breve
                  </p>
                </div>
                <Button disabled className="w-full">
                  Gerenciar Plano
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SECURITY TAB */}
        <TabsContent value="security" className="space-y-6">
          {/* Change Password Card */}
          <Card>
            <CardHeader>
              <CardTitle>Alterar Senha</CardTitle>
              <CardDescription>
                Atualize sua senha de acesso
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Senha Atual
                  </label>
                  <Input
                    type="password"
                    placeholder="Digite sua senha atual"
                    disabled
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Nova Senha
                  </label>
                  <Input
                    type="password"
                    placeholder="Digite sua nova senha"
                    disabled
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Confirmar Senha
                  </label>
                  <Input
                    type="password"
                    placeholder="Confirme sua nova senha"
                    disabled
                  />
                </div>

                <Button type="submit" disabled className="w-full">
                  Atualizar Senha
                </Button>

                <p className="text-xs text-neutral-500 text-center">
                  Funcionalidade em desenvolvimento - será integrada com Supabase Auth
                </p>
              </form>
            </CardContent>
          </Card>

          {/* Two Factor Auth Card */}
          <Card>
            <CardHeader>
              <CardTitle>Autenticação de Dois Fatores</CardTitle>
              <CardDescription>
                Adicione uma camada extra de segurança
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-neutral-600">
                  A autenticação de dois fatores adiciona segurança extra à sua conta, exigindo um código adicional ao fazer login.
                </p>
                <Button disabled className="w-full">
                  Ativar 2FA
                </Button>
                <p className="text-xs text-neutral-500 text-center">
                  Funcionalidade em desenvolvimento
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Active Sessions Card */}
          <Card>
            <CardHeader>
              <CardTitle>Sessões Ativas</CardTitle>
              <CardDescription>
                Gerencie suas sessões de login
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-3 border border-neutral-200 rounded-lg bg-neutral-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-neutral-900">Sessão Atual</p>
                      <p className="text-xs text-neutral-600">Navegador: Chrome / Dispositivo: Windows</p>
                    </div>
                    <Badge className="bg-green-100 text-green-800">Ativo</Badge>
                  </div>
                </div>
                <Button variant="outline" disabled className="w-full">
                  Sair de Todas as Sessões
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
