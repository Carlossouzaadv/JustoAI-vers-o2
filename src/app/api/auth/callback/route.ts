import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

// Helper: Narrow unknown to object (ZERO casting)
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// Type Guard for CookieOptions (ZERO casting)
function isCookieOptions(value: unknown): value is CookieOptions {
  if (!isRecord(value)) {
    return false;
  }
  return (
    (value.maxAge === undefined || typeof value.maxAge === 'number') &&
    (value.expires === undefined || value.expires instanceof Date) &&
    (value.httpOnly === undefined || typeof value.httpOnly === 'boolean') &&
    (value.secure === undefined || typeof value.secure === 'boolean') &&
    (value.sameSite === undefined || typeof value.sameSite === 'string') &&
    (value.path === undefined || typeof value.path === 'string')
  );
}

// Type Guard for Email OTP type (for token_hash verification)
function isValidEmailOtpType(
  value: unknown
): value is 'signup' | 'invite' | 'magiclink' | 'recovery' | 'email_change' | 'email' {
  return (
    value === 'email' ||
    value === 'signup' ||
    value === 'invite' ||
    value === 'magiclink' ||
    value === 'recovery' ||
    value === 'email_change'
  );
}

/**
 * POST /api/auth/callback
 *
 * Handles Supabase email verification callback
 * Called after user clicks confirmation link in email
 */
export async function POST(request: NextRequest) {
  try {
    const { token_hash, type } = await request.json()

    if (!token_hash || !type) {
      return NextResponse.json(
        { error: 'Missing token_hash or type parameter' },
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
          set(name: string, value: string, options: unknown) {
            try {
              const cookieOpts = isCookieOptions(options) ? options : undefined;
              cookieStore.set(name, value, cookieOpts)
            } catch (_error) {
              // Cookie setting might fail
            }
          },
          remove(name: string, _options: unknown) {
            try {
              cookieStore.delete(name)
            } catch (_error) {
              // Cookie deletion might fail
            }
          },
        },
      }
    )

    // Verify the token - validate type first
    if (!isValidEmailOtpType(type)) {
      return NextResponse.json(
        { error: 'Invalid OTP type parameter' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
      email: request.headers.get('x-user-email') || ''
    })

    if (error) {
      console.error('❌ Email verification error:', error.message)
      return NextResponse.json(
        { error: 'Email verification failed', details: error.message },
        { status: 400 }
      )
    }

    console.log('✅ Email verified:', data.user?.email)

    // Redirect to dashboard on success
    return NextResponse.redirect(
      new URL('/dashboard', request.url),
      { status: 303 }
    )
  } catch (_error) {
    console.error('❌ Callback error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/auth/callback
 *
 * Handles Supabase redirect after OAuth (Google, GitHub, etc)
 * Uses the code parameter from Supabase redirect
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.json(
      { error: 'No code provided' },
      { status: 400 }
    )
  }

  try {
    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: unknown) {
            try {
              const cookieOpts = isCookieOptions(options) ? options : undefined;
              cookieStore.set(name, value, cookieOpts)
            } catch (_error) {
              // Cookie setting might fail
            }
          },
          remove(name: string, _options: unknown) {
            try {
              cookieStore.delete(name)
            } catch (_error) {
              // Cookie deletion might fail
            }
          },
        },
      }
    )

    // Exchange code for session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('❌ OAuth error:', error.message)
      return NextResponse.redirect(
        new URL('/login?error=oauth_failed', request.url)
      )
    }

    console.log('✅ OAuth session established:', data.user?.email)

    // Redirect to dashboard
    return NextResponse.redirect(
      new URL('/dashboard', request.url),
      { status: 303 }
    )
  } catch (_error) {
    console.error('❌ Callback error:', error)
    return NextResponse.redirect(
      new URL('/login?error=server_error', request.url)
    )
  }
}
