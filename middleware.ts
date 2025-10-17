import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { addCorsHeaders, createPreflightResponse, validateCorsOrigin } from './lib/cors'
import { addSecurityHeaders } from './lib/security-headers'

export async function middleware(request: NextRequest) {
  // Create response - must be updated as middleware runs
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Verify environment variables are set
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('❌ CRITICAL: Missing Supabase environment variables', {
      urlSet: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      keySet: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      path: request.nextUrl.pathname,
      timestamp: new Date().toISOString(),
    })
  }

  // Create Supabase client with proper cookie handling
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    {
      cookies: {
        get(name: string) {
          const value = request.cookies.get(name)?.value
          return value
        },
        set(name: string, value: string, options: any) {
          // Set cookies on the response so they're sent back to client
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: any) {
          // Remove cookies from response
          response.cookies.set({
            name,
            value: '',
            maxAge: 0,
            ...options,
          })
        },
      },
    }
  )

  // Protected API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const origin = request.headers.get('origin')

    // Handle preflight requests first
    if (request.method === 'OPTIONS') {
      return createPreflightResponse(origin)
    }

    // Validar origem CORS
    const corsError = validateCorsOrigin(request)
    if (corsError) {
      return corsError
    }

    // Skip auth for public endpoints
    const publicEndpoints = [
      '/api/health',
      '/api/auth/',
      '/api/debug/',  // Debug endpoints for troubleshooting
    ]

    const isPublicEndpoint = publicEndpoints.some(endpoint =>
      request.nextUrl.pathname.startsWith(endpoint)
    )

    if (!isPublicEndpoint) {
      // Check authentication for protected API routes
      const { data: { user }, error } = await supabase.auth.getUser()

      // Debug logging for authentication issues
      if (!user) {
        const cookiesList = Array.from(request.cookies.entries())
          .map(([k, v]) => `${k}=${v.substring(0, 20)}...`)
          .join(', ')

        console.warn('🔴 Authentication failed:', {
          path: request.nextUrl.pathname,
          method: request.method,
          userFound: !!user,
          error: error?.message,
          supabaseUrlSet: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
          supabaseKeySet: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          cookiesCount: request.cookies.size,
          cookies: cookiesList || 'none',
          timestamp: new Date().toISOString(),
        })

        return NextResponse.json(
          {
            success: false,
            error: 'Authentication required',
          },
          { status: 401 }
        )
      }

      // Log successful auth
      console.log('✅ Authentication successful:', {
        path: request.nextUrl.pathname,
        userId: user.id?.substring(0, 8),
      })
    }

    // Add secure CORS headers
    addCorsHeaders(response, origin)

    // Add security headers if enabled
    if (process.env.SECURITY_HEADERS_ENABLED !== 'false') {
      response = addSecurityHeaders(response)
    }

    return response
  }

  // Protected app routes
  const protectedRoutes = ['/classic', '/pro', '/dashboard']
  const isProtectedRoute = protectedRoutes.some(route =>
    request.nextUrl.pathname.startsWith(route)
  )

  if (isProtectedRoute) {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      // Redirect to login
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/login'
      redirectUrl.searchParams.set('redirectedFrom', request.nextUrl.pathname)
      return NextResponse.redirect(redirectUrl)
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}