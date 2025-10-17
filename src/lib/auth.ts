import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set(name, value, options)
          } catch (error) {
            // Cookie setting can fail in middleware, ignore
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.delete(name)
          } catch (error) {
            // Cookie deletion can fail in middleware, ignore
          }
        },
      },
    }
  )
}

export async function getCurrentUser() {
  try {
    const supabase = await createServerSupabaseClient()

    // Get authenticated user from Supabase
    const { data: { user: supabaseUser }, error } = await supabase.auth.getUser()

    if (error || !supabaseUser) {
      console.log('❌ No authenticated user:', error?.message)
      return null
    }

    // Get user from database with workspaces
    const user = await prisma.user.findUnique({
      where: { supabaseId: supabaseUser.id },
      include: {
        workspaces: {
          include: {
            workspace: true,
          },
        },
      },
    })

    if (!user) {
      console.log('❌ User not found in database for supabaseId:', supabaseUser.id)
      // Auto-create user if missing
      const newUser = await prisma.user.create({
        data: {
          supabaseId: supabaseUser.id,
          email: supabaseUser.email || '',
          name: supabaseUser.user_metadata?.name || supabaseUser.email || 'User',
        },
        include: {
          workspaces: {
            include: {
              workspace: true,
            },
          },
        },
      })

      console.log('✅ Auto-created user:', newUser.id)
      return newUser
    }

    return user
  } catch (error) {
    console.error('❌ Error in getCurrentUser:', error)
    throw error
  }
}

export async function validateAuth() {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    throw new Error('Authentication required')
  }

  return user
}

export async function validateAuthAndGetUser() {
  const supabaseUser = await validateAuth()
  const user = await getCurrentUser()

  if (!user) {
    throw new Error('User not found in database')
  }

  return user
}
