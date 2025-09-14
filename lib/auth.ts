import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { prisma } from './prisma'

// Supabase client for server-side auth
export function createSupabaseServerClient() {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: '', ...options })
        },
      },
    }
  )
}

// Get current user from Supabase and sync with our database
export async function getCurrentUser() {
  try {
    const supabase = createSupabaseServerClient()

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