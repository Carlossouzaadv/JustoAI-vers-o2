import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { addCorsHeaders, createPreflightResponse, validateCorsOrigin } from './lib/cors'
import { addSecurityHeaders } from './lib/security-headers'

export async function middleware(request: NextRequest) {
  // Create response
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Create Supabase client
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: any) {
          response.cookies.set({
            name,
            value: '',
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
    ]

    const isPublicEndpoint = publicEndpoints.some(endpoint =>
      request.nextUrl.pathname.startsWith(endpoint)
    )

    if (!isPublicEndpoint) {
      // Check authentication for protected API routes
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        return NextResponse.json(
          {
            success: false,
            error: 'Authentication required',
          },
          { status: 401 }
        )
      }
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