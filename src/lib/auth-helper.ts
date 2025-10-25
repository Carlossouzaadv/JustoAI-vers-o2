/**
 * Supabase Authentication Helper for API Routes and Server Components
 * Provides unified authentication across the application
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

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
          setAll(cookiesToSet) {
            // No-op for API routes
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    return user;
  } catch (error) {
    console.error('Auth error in getAuthenticatedUser:', error);
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
          set(name: string, value: string, options: any) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: any) {
            cookieStore.delete(name);
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    return user;
  } catch (error) {
    console.error('Auth error in getServerUser:', error);
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
