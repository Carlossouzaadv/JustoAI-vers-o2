import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/auth/login
 *
 * Authenticate user with email and password
 * Sets Supabase session cookies for subsequent authenticated requests
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
          set(name: string, value: string, options: any) {
            try {
              cookieStore.set(name, value, options)
            } catch (error) {
              console.error('Error setting cookie:', name, error)
            }
          },
          remove(name: string, options: any) {
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
