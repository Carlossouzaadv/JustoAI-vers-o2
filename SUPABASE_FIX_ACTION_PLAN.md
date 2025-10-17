# ⚡ PLANO DE AÇÃO - Correções Supabase + Backend

**Data:** 2025-10-17
**Status:** DIAGNÓSTICO CONFIRMADO - PRONTO PARA CORRIGIR
**Prioridade:** 🔴 CRÍTICA

---

## 📊 Diagnóstico Confirmado

### Resultados dos SQLs:

```
✅ Tabelas existem: users, workspaces, user_workspaces, cases
❌ INSERT policies para users: 0 (FALTANDO!)
⚠️ Total de users: 0 (nenhum usuário criado)
✅ Total de workspaces: 1 (um workspace vazio)
```

### Conclusão:
- **RLS está BLOQUEANDO** a criação de usuários (faltam políticas de INSERT)
- **Sem usuários no banco** (porque signup está falhando)
- **Um workspace órfão** sem usuário dono
- **Dashboard vazio** porque não há dados para mostrar

---

## 🛠️ CORREÇÕES NECESSÁRIAS

### PASSO 1: Adicionar Políticas de INSERT ao Supabase

**Arquivo:** Abra Supabase SQL Editor

**Execute isto (COPIAR E COLAR):**

```sql
-- ====================================================================
-- CORRIGIR: Adicionar políticas de INSERT para tabela users
-- ====================================================================

-- Policy 1: Usuários autenticados podem criar seu próprio registro
CREATE POLICY "Authenticated users can insert their user record" ON users
FOR INSERT
WITH CHECK (
  "supabaseId" = auth.uid()::text
);

-- Policy 2: Service role (backend) pode criar usuários
CREATE POLICY "Service role can create users" ON users
FOR INSERT
WITH CHECK (
  auth.role() = 'service_role'
);

-- Policy 3: Usuários podem UPDATE seu próprio registro (já deveria existir, mas garante)
CREATE POLICY "Users can update own user record" ON users
FOR UPDATE
USING ("supabaseId" = auth.uid()::text);

-- ====================================================================
-- VERIFICAR: Confirmar que as políticas foram criadas
-- ====================================================================

SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'users'
ORDER BY cmd, policyname;

-- Resultado esperado:
-- Authenticated users can insert their user record | INSERT
-- Service role can create users | INSERT
-- Users can read own data | SELECT
-- Users can update own user record | UPDATE
```

**✅ Após executar, você deve ver 4 políticas para a tabela users**

---

### PASSO 2: Atualizar `lib/auth.ts` (Backend Fix)

**Arquivo:** `src/lib/auth.ts`

**Substitua a função `getCurrentUser()` por isto:**

```typescript
// Get current user from Supabase and sync with our database
export async function getCurrentUser() {
  try {
    const supabase = await createSupabaseServerClient()

    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return null
    }

    // Sync user with our database
    let dbUser = await prisma.user.upsert({
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
      console.log('🔧 Creating default workspace for user:', dbUser.id)

      try {
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

        console.log('✅ Default workspace created:', defaultWorkspace.id)

        // Recarregar usuário com workspace
        dbUser = await prisma.user.findUnique({
          where: { id: dbUser.id },
          include: {
            workspaces: {
              include: {
                workspace: true
              }
            }
          }
        })!
      } catch (workspaceError) {
        console.error('Error creating default workspace:', workspaceError)
        // Continue mesmo se falhar - não quebra o login
      }
    }

    return dbUser
  } catch (error) {
    console.error('Error getting current user:', error)
    return null
  }
}
```

**Mudanças:**
- ✅ Cria workspace padrão se não existir
- ✅ Adiciona logs para debug
- ✅ Trata erro gracefully

---

### PASSO 3: Adicionar Delay na Página de Signup

**Arquivo:** `src/app/signup/page.tsx`

**Encontre esta linha (por volta da linha 61):**

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
      // 🔧 FIX: Aguardar 2 segundos antes de redirecionar
      console.log('✅ Usuário criado no Supabase:', authData.user.id);
      await new Promise(resolve => setTimeout(resolve, 2000));
      window.location.href = '/dashboard';
    }
  } catch (error) {
    setAuthError('Erro inesperado. Tente novamente.');
  } finally {
    setIsLoading(false);
  }
};
```

**Mudanças:**
- ✅ Adicionado `await new Promise(resolve => setTimeout(resolve, 2000));`
- ✅ Aguarda 2 segundos para Supabase processar

---

### PASSO 4: Criar Context de Autenticação

**Arquivo:** `src/contexts/auth-context.tsx` (CRIAR NOVO)

**Copie e Cole isto:**

```typescript
'use client';

import { createContext, useContext, useEffect, useState } from 'react';

interface UserWithWorkspaces {
  id: string;
  email: string;
  name: string;
  supabaseId: string;
  workspaces: Array<{
    workspaceId: string;
    workspace: {
      id: string;
      name: string;
      slug: string;
    };
  }>;
  createdAt: string;
}

interface AuthContextType {
  user: UserWithWorkspaces | null;
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
  const [user, setUser] = useState<UserWithWorkspaces | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadUser() {
      try {
        setLoading(true);
        const response = await fetch('/api/users/current', {
          credentials: 'include',
        });

        if (response.ok) {
          const userData = await response.json();
          setUser(userData);

          // Set first workspace as default
          if (userData.workspaces && userData.workspaces.length > 0) {
            setWorkspaceId(userData.workspaces[0].workspaceId);
            console.log('✅ AuthContext loaded:', {
              user: userData.email,
              workspace: userData.workspaces[0].workspace.name
            });
          } else {
            console.warn('⚠️ User has no workspaces');
          }
        } else if (response.status === 401) {
          // Not authenticated
          setUser(null);
          setWorkspaceId(null);
        } else {
          setError('Failed to load user data');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Authentication error');
        console.error('Error loading user:', err);
      } finally {
        setLoading(false);
      }
    }

    loadUser();
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

---

### PASSO 5: Criar Endpoint `/api/users/current`

**Arquivo:** `src/app/api/users/current/route.ts` (CRIAR NOVO)

**Copie e Cole isto:**

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

    // Return user with workspaces
    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      supabaseId: user.supabaseId,
      workspaces: user.workspaces.map(uw => ({
        workspaceId: uw.workspaceId,
        workspace: {
          id: uw.workspace.id,
          name: uw.workspace.name,
          slug: uw.workspace.slug,
        }
      })),
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

### PASSO 6: Atualizar Dashboard para Usar Context

**Arquivo:** `src/app/dashboard/page.tsx`

**No topo do arquivo, adicione (depois de outros imports):**

```typescript
'use client';

import { useAuth } from '@/contexts/auth-context';
```

**Encontre esta linha (por volta da linha 96):**

```typescript
// TODO: Get workspace ID from context/auth
const [workspaceId] = useState('');
```

**Substitua por:**

```typescript
const { workspaceId, user, loading: authLoading } = useAuth();
```

**Encontre o `useEffect` (por volta da linha 109):**

```typescript
useEffect(() => {
  loadDashboardData();
}, [selectedClientId]);
```

**Substitua por:**

```typescript
useEffect(() => {
  if (!authLoading && workspaceId) {
    loadDashboardData();
  }
}, [workspaceId, authLoading, selectedClientId]);
```

**Encontre esta linha na função `loadDashboardData()` (por volta da linha 118):**

```typescript
const dashboardResponse = await fetch('/api/workspaces/current/summary');
```

**Substitua por:**

```typescript
const dashboardResponse = await fetch(
  `/api/workspaces/${workspaceId}/summary`,
  {
    credentials: 'include'
  }
);
```

---

### PASSO 7: Wrappear App com AuthProvider

**Arquivo:** `src/app/layout.tsx` ou `src/app/dashboard/layout.tsx`

**Encontre onde está renderizando children** e adicione AuthProvider:

```typescript
import { AuthProvider } from '@/contexts/auth-context';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
```

---

## ✅ CHECKLIST DE EXECUÇÃO

**Na ordem exata:**

- [ ] **1. Supabase SQL Editor**: Cole e execute o SQL de correção RLS
- [ ] **2. Backend**: Atualizar `lib/auth.ts` (criar workspace padrão)
- [ ] **3. Frontend**: Atualizar `src/app/signup/page.tsx` (delay)
- [ ] **4. Frontend**: Criar `src/contexts/auth-context.tsx`
- [ ] **5. Backend**: Criar `src/app/api/users/current/route.ts`
- [ ] **6. Frontend**: Atualizar `src/app/dashboard/page.tsx`
- [ ] **7. Frontend**: Wrappear com `<AuthProvider>`
- [ ] **8. Git**: Commit com mensagem descritiva
- [ ] **9. Deploy**: Push para Vercel
- [ ] **10. Teste**: Novo signup com novo usuário

---

## 🧪 COMO TESTAR

### Teste 1: Verificar Políticas RLS
```sql
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'users'
ORDER BY cmd;
```
Deve retornar 4 linhas (2 INSERT, 1 SELECT, 1 UPDATE)

### Teste 2: Novo Signup
1. Abra https://justoai-v2.vercel.app/signup
2. Preencha: Email, Nome, Telefone, Senha
3. Clique em "Começar Trial"
4. Verifique em Railway logs: `✅ Default workspace created`
5. Dashboard deve carregar com dados reais (não zeros)

### Teste 3: Verificar Dados no Banco
```sql
-- Deve ter 1+ usuários
SELECT COUNT(*) FROM users;

-- Deve ter 2+ workspaces (1 antigo + 1 novo)
SELECT COUNT(*) FROM workspaces;

-- Deve ter relacionamento
SELECT u.email, w.name, uw.role
FROM users u
JOIN user_workspaces uw ON u.id = uw."userId"
JOIN workspaces w ON uw."workspaceId" = w.id;
```

---

## 🚀 Timeline

| Etapa | Tempo | Status |
|-------|-------|--------|
| Supabase RLS Fix | 2 min | ⏳ Aguardando |
| Code Updates | 15 min | ⏳ Aguardando |
| Git Commit | 2 min | ⏳ Aguardando |
| Vercel Deploy | 5 min | ⏳ Aguardando |
| Testing | 10 min | ⏳ Aguardando |
| **TOTAL** | **~34 min** | ⏳ Aguardando |

---

## ⚠️ Notas Importantes

1. **Ordem importa**: SQL ANTES dos code changes
2. **Deploy automático**: Vercel vai redeployar quando push
3. **Railway logs**: Verifique logs para debug
4. **Cookies**: Importante usar `credentials: 'include'`
5. **CORS**: Já deve estar OK, mas verifique se houver erro

---

**Próximo Passo:** Você confirma que vai executar? Ou prefere que eu detalhe alguma parte?
