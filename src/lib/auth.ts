import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { prisma } from './prisma'
import type { NextAuthOptions } from 'next-auth'
import { JWT } from 'next-auth/jwt'
import { log, logError } from '@/lib/services/logger';

// Supabase client for server-side auth
export async function createSupabaseServerClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: '', ...options })
        },
      },
    }
  )
}

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
          },
          orderBy: {
            createdAt: 'desc'
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
            description: 'Default workspace created on signup',
            status: 'ACTIVE',
            users: {
              create: {
                userId: dbUser.id,
                role: 'OWNER',
                status: 'ACTIVE',
              }
            }
          },
          include: {
            users: {
              include: {
                user: true
              }
            }
          }
        })

        console.log('✅ Default workspace created:', defaultWorkspace.id)

        // Recarregar usuário com workspace
        const reloadedUser = await prisma.user.findUnique({
          where: { id: dbUser.id },
          include: {
            workspaces: {
              include: {
                workspace: true
              }
            }
          }
        })

        if (reloadedUser !== null) {
          dbUser = reloadedUser
        }
      } catch (workspaceError) {
        logError(workspaceError, 'Error creating default workspace:', { component: 'refactored' })
        // Continue mesmo se falhar - não quebra o login
      }
    }

    return dbUser
  } catch (error) {
    logError(error, 'Error getting current user:', { component: 'refactored' })
    return null
  }
}

// Check if user has access to workspace
export async function hasWorkspaceAccess(userId: string, workspaceId: string) {
  const userWorkspace = await prisma.userWorkspace.findUnique({
    where: {
      userId_workspaceId: {
        userId,
        workspaceId
      }
    }
  })

  return !!userWorkspace && userWorkspace.status === 'ACTIVE'
}

// Get user role in workspace
export async function getUserWorkspaceRole(userId: string, workspaceId: string) {
  const userWorkspace = await prisma.userWorkspace.findUnique({
    where: {
      userId_workspaceId: {
        userId,
        workspaceId
      }
    }
  })

  return userWorkspace?.role || null
}

// Additional auth functions for compatibility
export async function validateAuth() {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('Unauthorized')
  }
  return {
    user,
    workspace: user.workspaces[0]?.workspace
  }
}

export async function validateAuthAndGetUser() {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('Unauthorized')
  }
  return {
    user,
    workspace: user.workspaces[0]?.workspace
  }
}

// ================================================================
// NextAuth Configuration - Supabase Integration
// ================================================================

// Type guard for user object in JWT callback
function isUserWithId(user: unknown): user is { id: string; email?: string } {
  if (typeof user !== 'object' || user === null) {
    return false
  }
  const obj = user as Record<string, unknown>
  return 'id' in obj && typeof obj.id === 'string'
}

// Type guard for JWT token
function isTokenWithId(token: unknown): token is JWT & { id?: string } {
  return typeof token === 'object' && token !== null
}

// Type guard for session user
function isSessionUserWithId(user: unknown): user is { email?: string | null; name?: string | null; image?: string | null; id?: string } {
  return typeof user === 'object' && user !== null
}

export const authOptions: NextAuthOptions = {
  // Configure this for your auth setup
  // Since we're using Supabase JWT in cookies, we use a credentials provider
  providers: [],
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (isUserWithId(user)) {
        const typedToken = token as JWT & Record<string, unknown>
        typedToken.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (isSessionUserWithId(session?.user) && isTokenWithId(token) && token.id) {
        const typedUser = session.user as Record<string, unknown>
        typedUser.id = token.id
      }
      return session
    },
  },
  session: {
    strategy: 'jwt',
  },
}