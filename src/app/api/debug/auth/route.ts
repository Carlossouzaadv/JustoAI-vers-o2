import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * DEBUG ENDPOINT - Check authentication status
 * This endpoint helps diagnose why authentication is failing
 *
 * Usage: GET /api/debug/auth
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 DEBUG AUTH: Starting authentication check')

    // Check environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    console.log('📋 Environment Variables:', {
      supabaseUrlSet: !!supabaseUrl,
      supabaseKeySet: !!supabaseKey,
      supabaseUrl: supabaseUrl?.substring(0, 30) + '...' || 'NOT SET',
    })

    // Check cookies received
    const cookiesList: Array<{ name: string; value: string }> = []
    request.cookies.getAll().forEach((cookie) => {
      cookiesList.push({
        name: cookie.name,
        value: cookie.value.substring(0, 30) + '...',
      })
    })

    console.log('🍪 Cookies Received:', {
      count: request.cookies.size,
      cookies: cookiesList,
    })

    // Try to create Supabase client
    let supabase
    try {
      supabase = createServerClient(
        supabaseUrl || '',
        supabaseKey || '',
        {
          cookies: {
            get(name: string) {
              return request.cookies.get(name)?.value
            },
            set(name: string, value: string, options: unknown) {
              // We're not setting cookies here, just checking
            },
            remove(name: string, options: unknown) {
              // We're not removing cookies here, just checking
            },
          },
        }
      )
      console.log('✅ Supabase client created successfully')
    } catch (error) {
      console.error('❌ Failed to create Supabase client:', error)
      return NextResponse.json(
        {
          status: 'error',
          message: 'Failed to create Supabase client',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      )
    }

    // Try to get user
    let authResult
    try {
      authResult = await supabase.auth.getUser()
      console.log('📊 Auth Result:', {
        userFound: !!authResult.data.user,
        userId: authResult.data.user?.id?.substring(0, 8),
        error: authResult.error?.message,
      })
    } catch (error) {
      console.error('❌ Failed to get user:', error)
      return NextResponse.json(
        {
          status: 'error',
          message: 'Failed to get user from Supabase',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      )
    }

    // Return diagnostic info
    const response = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: {
        supabaseUrlSet: !!supabaseUrl,
        supabaseKeySet: !!supabaseKey,
      },
      cookies: {
        count: request.cookies.size,
        list: cookiesList,
      },
      authentication: {
        userFound: !!authResult.data.user,
        userId: authResult.data.user?.id,
        userEmail: authResult.data.user?.email,
        error: authResult.error?.message,
      },
      request: {
        method: request.method,
        path: request.nextUrl.pathname,
        origin: request.headers.get('origin'),
        referer: request.headers.get('referer'),
      },
    }

    console.log('📤 Debug Response:', response)

    return NextResponse.json(response, { status: 200 })
  } catch (error) {
    console.error('❌ DEBUG AUTH ERROR:', error)
    return NextResponse.json(
      {
        status: 'error',
        message: 'Debug endpoint error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
