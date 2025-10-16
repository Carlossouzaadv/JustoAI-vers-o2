import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { prisma } from './prisma'

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

    return dbUser
  } catch (error) {
    console.error('Error getting current user:', error)
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
export async function validateAuth(_request?: Request) {
  // Development mode - allow bypass
  if (process.env.NODE_ENV === 'development') {
    console.log('⚠️ Development mode: Bypassing auth validation')
    return {
      user: {
        id: 'dev-user',
        email: 'dev@justoai.com',
        name: 'Development User',
        workspaces: [{
          workspace: {
            id: 'dev-workspace',
            name: 'Development Workspace',
            slug: 'dev'
          }
        }]
      },
      workspace: {
        id: 'dev-workspace',
        name: 'Development Workspace',
        slug: 'dev'
      }
    }
  }

  const user = await getCurrentUser()
  if (!user) {
    throw new Error('Unauthorized')
  }
  return {
    user,
    workspace: user.workspaces[0]?.workspace
  }
}

export async function validateAuthAndGetUser(_request?: Request) {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('Unauthorized')
  }
  return {
    user,
    workspace: user.workspaces[0]?.workspace
  }
}