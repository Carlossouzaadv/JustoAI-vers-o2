/**
 * Supabase Authentication Helper for API Routes and Server Components
 * Provides unified authentication across the application
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { log, logError } from '@/lib/services/logger';

/**
 * Get authenticated user from Supabase (for API routes)
 * Usage in API routes:
 * ```
 * const user = await getAuthenticatedUser(request);
 * if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 * ```
 */
export async function getAuthenticatedUser(request: NextRequest) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      {
        cookies: {
          getAll() {
            return request.cookies.getAll().map(cookie => ({
              name: cookie.name,
              value: cookie.value,
            }));
          },
          setAll(_cookiesToSet) {
            // No-op for API routes
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    return user;
  } catch (_error) {
    logError(error, 'Auth error in getAuthenticatedUser:', { component: 'refactored' });
    return null;
  }
}

/**
 * Get authenticated user from server component (uses cookies() from next/headers)
 * Usage in server components:
 * ```
 * const user = await getServerUser();
 * if (!user) redirect('/login');
 * ```
 */
export async function getServerUser() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: Record<string, unknown> | undefined) {
            if (options && typeof options === 'object') {
              cookieStore.set({ name, value, ...options });
            } else {
              cookieStore.set(name, value);
            }
          },
          remove(name: string, _options: Record<string, unknown> | undefined) {
            cookieStore.delete(name);
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    return user;
  } catch (_error) {
    logError(error, 'Auth error in getServerUser:', { component: 'refactored' });
    return null;
  }
}

/**
 * Unauthorized response helper
 */
export function unauthorizedResponse(message = 'Unauthorized') {
  return NextResponse.json(
    { error: message },
    { status: 401 }
  );
}
