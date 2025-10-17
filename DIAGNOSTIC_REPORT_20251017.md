# 🔍 DIAGNÓSTICO CRÍTICO - JustoAI V2

**Data:** 2025-10-17
**Status:** Aguardando Chave JUDIT
**Ambiente:** Vercel (Frontend) + Railway (Backend) + Supabase (DB)
**Prioridade:** CRÍTICA

---

## 🚨 PROBLEMA 1: Falha na Criação de Usuário (Timeout/Falha Silenciosa)

### Sintomas
- Requisição não chega ao backend
- Sem erro de CORS ou 404
- Timeout ou falha silenciosa
- Usuário não é criado

### Diagnóstico Root Cause

#### 1. **Fluxo Atual de Signup (IDENTIFICADO)**
```
Frontend (Vercel/Signup Page)
  ↓
  Chamada: supabase.auth.signUp() [CLIENT-SIDE]
  ↓
  Redirect: window.location.href = '/dashboard'
  ↓
  Backend NUNCA É CHAMADO PARA CRIAR USUÁRIO
  ↓
  getCurrentUser() é chamado quando acessa o dashboard
  ↓
  Procura user na DB mas NÃO ACHOU PORQUE:
  - Redirecionou antes do user ser criado no Supabase
  - RLS pode estar BLOQUEANDO a criação
```

#### 2. **Problema de Timing**
- **Linha 86-87** em `src/app/signup/page.tsx`:
```typescript
if (authData.user) {
  window.location.href = '/dashboard'; // REDIRECIONA IMEDIATAMENTE
}
```
- ❌ Supabase continua processando em background
- ❌ Pode perder dados antes de serem salvos
- ❌ RLS policies podem bloquear a criação

#### 3. **RLS Policies Bloqueando Criação**
No arquivo `03-configure-supabase.sql`, faltam políticas para:
- Permitir usuários CRIAR seu próprio registro na tabela `users`
- Permitir `auth.uid()` criar com `supabaseId = auth.uid()`

**Problema:** Só tem políticas de **READ** e **UPDATE**, faltam **INSERT** policies!

#### 4. **Falta de Workspace Padrão**
- Quando user é criado, **NÃO** há workspace padrão
- `getCurrentUser()` tenta retornar `user.workspaces[0]` mas array está vazio
- Dashboard quebra ou não carrega dados

### SQL: Verifique o que Já Existe

Copie este SQL e execute no **Supabase SQL Editor** para diagnosticar:

```sql
-- 1. Ver todas as políticas RLS na tabela 'users'
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'users'
ORDER BY policyname;

-- 2. Ver se há políticas de INSERT
SELECT policyname
FROM pg_policies
WHERE tablename = 'users' AND cmd = 'INSERT';

-- 3. Ver qual é a coluna de ID da tabela users
\d users

-- 4. Ver quantas policies há para INSERT em users
SELECT COUNT(*) as total_insert_policies
FROM pg_policies
WHERE tablename = 'users' AND cmd = 'INSERT';

-- 5. Ver a definição exata de cada política
SELECT * FROM pg_policies WHERE tablename = 'users';
```

### Solução: O Que Precisa Ser Feito

#### **Parte 1: Adicionar Políticas de INSERT (SQL)**

```sql
-- ====================================================================
-- FIX: Adicionar RLS Policy de INSERT para tabela users
-- ====================================================================
-- Usuários autenticados podem criar seu próprio registro
CREATE POLICY "Authenticated users can create their own user record" ON users
FOR INSERT
WITH CHECK (
  "supabaseId" = auth.uid()::text
);

-- Service role (backend) pode criar usuários (para onboarding)
CREATE POLICY "Service role can create users" ON users
FOR INSERT
WITH CHECK (
  auth.role() = 'service_role'
);
```

#### **Parte 2: Criar Workspace Padrão (Backend Fix)**

Modifique `lib/auth.ts` - função `getCurrentUser()`:

```typescript
export async function getCurrentUser() {
  try {
    const supabase = await createSupabaseServerClient()

    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return null
    }

    // Sync user with our database
    const dbUser = await prisma.user.upsert({
      where: { supabaseId: user.id },
      update: {
        email: user.email!,
        name: user.user_metadata?.full_name || user.email!,
        emailVerified: !!user.email_confirmed_at,
        lastLoginAt: new Date(),
      },
      create: {
        supabaseId: user.id,
        email: user.email!,
        name: user.user_metadata?.full_name || user.email!,
        emailVerified: !!user.email_confirmed_at,
        lastLoginAt: new Date(),
      },
      include: {
        workspaces: {
          include: {
            workspace: true
          }
        }
      }
    })

    // 🔧 FIX: Se não há workspaces, criar um padrão
    if (!dbUser.workspaces || dbUser.workspaces.length === 0) {
      const defaultWorkspace = await prisma.workspace.create({
        data: {
          name: `${user.user_metadata?.full_name || user.email}'s Workspace`,
          slug: `workspace-${user.id.substring(0, 8)}`,
          type: 'ORGANIZATION',
          description: 'Default workspace created on signup',
          status: 'ACTIVE',
          members: {
            create: {
              userId: dbUser.id,
              role: 'OWNER',
              status: 'ACTIVE',
            }
          }
        },
        include: {
          members: {
            include: {
              user: true
            }
          }
        }
      })

      // Recarregar usuário com workspace
      return await prisma.user.findUnique({
        where: { id: dbUser.id },
        include: {
          workspaces: {
            include: {
              workspace: true
            }
          }
        }
      })
    }

    return dbUser
  } catch (error) {
    console.error('Error getting current user:', error)
    return null
  }
}
```

#### **Parte 3: Delay na Página de Signup (Frontend Fix)**

Modifique `src/app/signup/page.tsx`:

```typescript
const onSubmit = async (data: SignupFormData) => {
  setIsLoading(true);
  setAuthError('');

  try {
    // Sign up with Supabase
    const { data: authData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          name: data.name,
          phone: data.phone,
          marketingConsent: data.marketingConsent || false,
          consentDate: new Date().toISOString(),
        },
      },
    });

    if (error) {
      setAuthError(error.message);
      return;
    }

    if (authData.user) {
      // 🔧 FIX: Aguardar um pouco antes de redirecionar
      // Isso permite que o Supabase processe o usuário no backend
      console.log('✅ Usuário criado no Supabase:', authData.user.id);

      // Aguardar 2 segundos para garantir que getCurrentUser()
      // possa sincronizar o usuário com o banco de dados
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Agora redirecionar
      window.location.href = '/dashboard';
    }
  } catch (error) {
    setAuthError('Erro inesperado. Tente novamente.');
  } finally {
    setIsLoading(false);
  }
};
```

---

## 🚨 PROBLEMA 2: Dashboard com Dados Mockados (Fallback)

### Sintomas
- Dashboard mostra 0 em todos os cards
- Deveria carregar dados do banco
- Dados mockados aparecem apenas quando API falha

### Diagnóstico Root Cause

#### 1. **Locais Onde os Dados São Buscados**

**Linha 118** em `src/app/dashboard/page.tsx`:
```typescript
const dashboardResponse = await fetch('/api/workspaces/current/summary');
```

#### 2. **Possíveis Falhas**

1. **Endpoint `/api/workspaces/current/summary` não existe ou retorna erro**
   - ❌ A API chama `getCurrentUser()` que pode retornar `null`
   - ❌ Se não há workspace, retorna erro 400
   - ❌ Se RLS está bloqueando, retorna erro 403

2. **Credenciais de Autenticação não estão sendo enviadas**
   - ❌ Fetch precisa de header `Authorization: Bearer {token}`
   - ❌ Cookies podem não estar sendo enviados
   - ❌ CORS pode estar bloqueando

3. **Variável `workspaceId` está vazia**
   - **Linha 96**: `const [workspaceId] = useState('');`
   - ❌ Está hardcoded como string vazia!
   - ❌ Deveria vir de `currentUser.workspaces[0].workspaceId`

### SQL: Verifique Dados no Banco

```sql
-- 1. Ver se há usuários criados
SELECT id, "supabaseId", email, name, "createdAt"
FROM users
ORDER BY "createdAt" DESC
LIMIT 10;

-- 2. Ver se há workspaces
SELECT id, name, slug, type, status, "createdAt"
FROM workspaces
ORDER BY "createdAt" DESC
LIMIT 10;

-- 3. Ver relacionamento entre users e workspaces
SELECT u.id as user_id, u.email, w.id as workspace_id, w.name, uw.role, uw.status
FROM users u
LEFT JOIN user_workspaces uw ON u.id = uw."userId"
LEFT JOIN workspaces w ON uw."workspaceId" = w.id
ORDER BY u."createdAt" DESC;

-- 4. Ver se há dados em 'cases' (processos)
SELECT COUNT(*) as total_cases FROM cases;

-- 5. Ver se RLS está bloqueando leitura
SELECT COUNT(*) as total_cases_with_rls
FROM cases
WHERE "workspaceId" IN (
  SELECT "workspaceId" FROM user_workspaces
  WHERE "userId" = auth.uid()::text AND status = 'ACTIVE'
);
```

### Solução: O Que Precisa Ser Feito

#### **Parte 1: Armazenar WorkspaceID no Context (Frontend Fix)**

Modifique ou crie um Context para armazenar workspace do usuário autenticado:

Arquivo: `src/contexts/auth-context.tsx` (CRIAR se não existir)

```typescript
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

interface AuthContextType {
  user: any | null;
  workspaceId: string | null;
  loading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  workspaceId: null,
  loading: true,
  error: null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    async function initAuth() {
      try {
        // Get current user from Supabase
        const { data: { user: authUser } } = await supabase.auth.getUser();

        if (!authUser) {
          setUser(null);
          setWorkspaceId(null);
          setLoading(false);
          return;
        }

        // Fetch user from backend (with synced workspace data)
        const response = await fetch('/api/users/current', {
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${authUser.id}`,
          }
        });

        if (response.ok) {
          const userData = await response.json();
          setUser(userData);

          // Set first workspace as default
          if (userData.workspaces && userData.workspaces.length > 0) {
            setWorkspaceId(userData.workspaces[0].workspaceId);
          }
        } else {
          setError('Failed to load user data');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Authentication error');
      } finally {
        setLoading(false);
      }
    }

    initAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ user, workspaceId, loading, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

#### **Parte 2: Usar WorkspaceID no Dashboard**

Modifique `src/app/dashboard/page.tsx`:

```typescript
'use client';

import { useAuth } from '@/contexts/auth-context';

export default function DashboardPage() {
  const { workspaceId, user, loading: authLoading } = useAuth(); // 🔧 FIX
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  // ... resto do código

  useEffect(() => {
    if (!authLoading && workspaceId) {
      loadDashboardData();
    }
  }, [workspaceId, authLoading]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // 🔧 FIX: Usar workspaceId real
      const dashboardResponse = await fetch(
        `/api/workspaces/${workspaceId}/summary`,
        {
          credentials: 'include'
        }
      );

      if (dashboardResponse.ok) {
        const data = await dashboardResponse.json();
        // ... resto da lógica
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };
```

#### **Parte 3: Criar Endpoint `/api/users/current` (Backend Fix)**

Arquivo: `src/app/api/users/current/route.ts` (CRIAR)

```typescript
import { getCurrentUser } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      supabaseId: user.supabaseId,
      workspaces: user.workspaces,
      createdAt: user.createdAt,
    });
  } catch (error) {
    console.error('Error fetching current user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

---

## ✅ CHECKLIST DE VERIFICAÇÃO NO SUPABASE

Execute CADA um destes SQLs no **Supabase SQL Editor**:

### 1. Verificar Políticas RLS Existentes
```sql
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'users'
ORDER BY tablename, cmd;
```

**Resultado esperado:** Deve ter políticas para SELECT, UPDATE, e **INSERT**

### 2. Verificar Tabelas Existem
```sql
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('users', 'workspaces', 'user_workspaces', 'cases')
ORDER BY tablename;
```

**Resultado esperado:** 4 linhas (todas as tabelas devem existir)

### 3. Verificar Dados de Usuário
```sql
SELECT COUNT(*) as total_users FROM users;
SELECT COUNT(*) as total_workspaces FROM workspaces;
SELECT COUNT(*) as total_user_workspaces FROM user_workspaces;
```

### 4. Verificar RLS Status
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND rowsecurity = false
ORDER BY tablename;
```

**Resultado esperado:** Lista vazia (todas as tabelas devem ter RLS ativado)

---

## 🚀 PLANO DE AÇÃO IMEDIATO

### Passo 1: Diagnóstico (Agora)
- [ ] Execute os SQLs de verificação acima no Supabase
- [ ] Envie os resultados para análise

### Passo 2: Implementação das Correções
- [ ] Adicione políticas de INSERT no Supabase
- [ ] Atualize `lib/auth.ts` com criação de workspace padrão
- [ ] Crie Context de autenticação
- [ ] Atualize página de dashboard
- [ ] Crie endpoint `/api/users/current`

### Passo 3: Testes
- [ ] Teste signup com novo usuário
- [ ] Verifique se workspace é criado automaticamente
- [ ] Verifique se dashboard carrega dados reais
- [ ] Monitore erro em browser console e Railway logs

### Passo 4: Deploy
- [ ] Commit e push das mudanças
- [ ] Vercel deploy automático
- [ ] Validar em produção

---

## 📊 Resumo dos Problemas

| Problema | Causa Raiz | Solução | Prioridade |
|----------|-----------|---------|-----------|
| Signup falha | RLS faltando INSERT policy | Adicionar SQL policy | CRÍTICA |
| Workspace vazio | Sem workspace padrão na criação | Criar no `getCurrentUser()` | CRÍTICA |
| Dashboard vazio | `workspaceId` hardcoded como "" | Usar Context/Auth | CRÍTICA |
| Dados não carregam | Endpoint retorna erro 400 | Criar `/api/users/current` | CRÍTICA |
| Redirecionamento rápido | Timing issue no signup | Adicionar delay antes redir. | ALTA |

---

## 📝 Notas Importantes

1. **Chave JUDIT**: Quando chegar, adicione em Railway → Variables
2. **Redis**: Já está funcionando (Upstash ✅)
3. **Workers**: Já estão online ✅
4. **Frontend**: Já está no Vercel ✅
5. **Supabase**: RLS precisa de ajustes (BLOQUEADOR)

---

**Próximo Passo:** Envie os resultados dos SQLs de verificação acima!
