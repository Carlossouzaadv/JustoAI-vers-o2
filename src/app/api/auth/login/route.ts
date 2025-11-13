import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/auth/login
 *
 * Authenticate user with email and password
 * Sets Supabase session cookies for subsequent authenticated requests
 * Also ensures user exists in database with a default workspace
 */
export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: Record<string, unknown> | undefined) {
            try {
              if (options && typeof options === 'object') {
                cookieStore.set({ name, value, ...options })
              } else {
                cookieStore.set(name, value)
              }
            } catch (error) {
              console.error('Error setting cookie:', name, error)
            }
          },
          remove(name: string, options: Record<string, unknown> | undefined) {
            try {
              cookieStore.delete(name)
            } catch (error) {
              console.error('Error removing cookie:', name, error)
            }
          },
        },
      }
    )

    console.log('🔑 Attempting login for:', email)

    // Sign in with email and password
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      console.error('❌ Login error:', authError.message)
      return NextResponse.json(
        { error: authError.message },
        { status: 401 }
      )
    }

    if (!authData.user || !authData.session) {
      console.error('❌ Login failed: No user or session returned')
      return NextResponse.json(
        { error: 'Login failed: No session' },
        { status: 401 }
      )
    }

    console.log('✅ User logged in:', authData.user.id, 'email:', email)

    // Ensure user exists in database
    const dbUser = await prisma.user.upsert({
      where: { supabaseId: authData.user.id },
      create: {
        supabaseId: authData.user.id,
        email: authData.user.email || email,
        name: authData.user.user_metadata?.name || authData.user.email || 'User',
      },
      update: {
        name: authData.user.user_metadata?.name || authData.user.email || 'User',
      },
      include: {
        workspaces: {
          include: {
            workspace: true,
          },
        },
      },
    })

    // If user has no workspaces, create a default one
    if (dbUser.workspaces.length === 0) {
      console.log('📦 Creating default workspace for user:', dbUser.id)
      const workspace = await prisma.workspace.create({
        data: {
          name: `${dbUser.name}'s Workspace`,
          slug: `workspace-${Date.now()}`,
          users: {
            create: {
              userId: dbUser.id,
              role: 'OWNER',
            },
          },
        },
      })
      console.log('✅ Default workspace created:', workspace.id)
    }

    // The session cookies are automatically set by the Supabase client
    // when we called signInWithPassword above via the cookies handler

    return NextResponse.json(
      {
        success: true,
        user: {
          id: authData.user.id,
          email: authData.user.email,
          name: authData.user.user_metadata?.name || authData.user.email,
        },
        message: 'Login successful',
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('❌ Login endpoint error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
