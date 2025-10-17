# ⚡ QUICK START - Fixes em 30 Minutos

## 🎯 O Que Fazer (Na Ordem Exata)

---

## PASSO 1️⃣: SUPABASE SQL (2 minutos)

**URL:** https://app.supabase.com → Seu Projeto → SQL Editor

**COPIE E COLE ISTO:**

```sql
CREATE POLICY "Authenticated users can insert their user record" ON users
FOR INSERT
WITH CHECK ("supabaseId" = auth.uid()::text);

CREATE POLICY "Service role can create users" ON users
FOR INSERT
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Users can update own user record" ON users
FOR UPDATE
USING ("supabaseId" = auth.uid()::text);

SELECT policyname, cmd FROM pg_policies WHERE tablename = 'users' ORDER BY cmd;
```

**Aguarde resultado:** Deve mostrar 4 políticas ✅

---

## PASSO 2️⃣: ARQUIVO `lib/auth.ts` (5 minutos)

**Localize:** Linha ~29 - Função `getCurrentUser()`

**SUBSTITUA TODO O CONTEÚDO DA FUNÇÃO POR ISTO:**

```typescript
export async function getCurrentUser() {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return null

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
      include: { workspaces: { include: { workspace: true } } }
    })

    // 🔧 FIX: Criar workspace se não existir
    if (!dbUser.workspaces || dbUser.workspaces.length === 0) {
      console.log('🔧 Creating default workspace for user:', dbUser.id)
      try {
        await prisma.workspace.create({
          data: {
            name: `${user.user_metadata?.full_name || user.email}'s Workspace`,
            slug: `workspace-${user.id.substring(0, 8)}`,
            type: 'ORGANIZATION',
            description: 'Default workspace',
            status: 'ACTIVE',
            members: {
              create: {
                userId: dbUser.id,
                role: 'OWNER',
                status: 'ACTIVE',
              }
            }
          }
        })

        dbUser = await prisma.user.findUnique({
          where: { id: dbUser.id },
          include: { workspaces: { include: { workspace: true } } }
        })!
      } catch (err) {
        console.error('Workspace creation error:', err)
      }
    }

    return dbUser
  } catch (error) {
    console.error('Error getting current user:', error)
    return null
  }
}
```

✅ **Salve o arquivo**

---

## PASSO 3️⃣: ARQUIVO `src/app/signup/page.tsx` (2 minutos)

**Localize:** Linha ~61 - Função `onSubmit`

**Encontre esta linha:**
```typescript
if (authData.user) {
  window.location.href = '/dashboard';
}
```

**SUBSTITUA POR:**
```typescript
if (authData.user) {
  console.log('✅ User created:', authData.user.id);
  await new Promise(resolve => setTimeout(resolve, 2000));
  window.location.href = '/dashboard';
}
```

✅ **Salve o arquivo**

---

## PASSO 4️⃣: CRIAR `src/contexts/auth-context.tsx` (5 minutos)

**Novo arquivo:** Crie em `src/contexts/auth-context.tsx`

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
    workspace: { id: string; name: string; slug: string };
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
        const response = await fetch('/api/users/current', { credentials: 'include' });
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
          if (userData.workspaces?.length > 0) {
            setWorkspaceId(userData.workspaces[0].workspaceId);
          }
        } else if (response.status !== 401) {
          setError('Failed to load user');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error');
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
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
```

✅ **Salve o arquivo**

---

## PASSO 5️⃣: CRIAR `src/app/api/users/current/route.ts` (3 minutos)

**Novo arquivo:** Crie em `src/app/api/users/current/route.ts`

```typescript
import { getCurrentUser } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
    console.error('Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
```

✅ **Salve o arquivo**

---

## PASSO 6️⃣: ARQUIVO `src/app/dashboard/page.tsx` (5 minutos)

**No topo (após outros imports), adicione:**

```typescript
'use client';

import { useAuth } from '@/contexts/auth-context';
```

**Localize linha ~96:**
```typescript
const [workspaceId] = useState('');
```

**SUBSTITUA POR:**
```typescript
const { workspaceId, loading: authLoading } = useAuth();
```

**Localize linha ~109 (primeiro useEffect):**
```typescript
useEffect(() => {
  loadDashboardData();
}, [selectedClientId]);
```

**SUBSTITUA POR:**
```typescript
useEffect(() => {
  if (!authLoading && workspaceId) {
    loadDashboardData();
  }
}, [workspaceId, authLoading, selectedClientId]);
```

**Localize linha ~118 (dentro de loadDashboardData):**
```typescript
const dashboardResponse = await fetch('/api/workspaces/current/summary');
```

**SUBSTITUA POR:**
```typescript
const dashboardResponse = await fetch(`/api/workspaces/${workspaceId}/summary`, {
  credentials: 'include'
});
```

✅ **Salve o arquivo**

---

## PASSO 7️⃣: ARQUIVO `src/app/layout.tsx` (2 minutos)

**No topo, adicione import:**
```typescript
import { AuthProvider } from '@/contexts/auth-context';
```

**Encontre o RootLayout e adicione AuthProvider:**
```typescript
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

✅ **Salve o arquivo**

---

## PASSO 8️⃣: GIT COMMIT (1 minuto)

```bash
git add .
git commit -m "fix: resolve user signup and dashboard data loading issues

- Add INSERT RLS policies to users table (Supabase)
- Implement automatic workspace creation on first login
- Create AuthContext for user state management
- Add /api/users/current endpoint for auth state
- Update dashboard to use real workspaceId
- Add 2s delay in signup before redirect
- Wrap app with AuthProvider"
```

✅ **Commit feito**

---

## PASSO 9️⃣: DEPLOY (5 minutos)

```bash
git push origin main
```

**Vercel vai fazer deploy automaticamente**

Acompanhe em: https://vercel.com/[seu-time]/justoai-v2/deployments

✅ **Aguarde "Ready"**

---

## 1️⃣0️⃣: TESTE (5 minutos)

1. **Abra:** https://justoai-v2.vercel.app/signup
2. **Preencha:**
   - Email: `test@example.com`
   - Nome: `Test User`
   - Telefone: `(11) 98765-4321`
   - Senha: `TestPass123!`
   - Confirme senha
   - Aceite termos
3. **Clique:** "Começar Trial Gratuito"
4. **Aguarde:** 2 segundos
5. **Resultado esperado:** Dashboard com dados reais (não zeros)

---

## ✅ Pronto!

**Total de tempo:** ~34 minutos

Quando estiver tudo pronto para fazer, me avisa que vou guiar por cada passo se precisar! 🚀
