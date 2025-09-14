import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

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

    // Add CORS headers for API routes
    response.headers.set('Access-Control-Allow-Origin', '*')
    response.headers.set(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, OPTIONS'
    )
    response.headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization'
    )

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: response.headers })
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
      redirectUrl.pathname = '/auth/login'
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