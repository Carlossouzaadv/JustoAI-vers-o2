/**
 * Admin Errors API
 * Aggregates errors from Sentry and database
 * Accessible to: Internal admins (@justoai.com.br)
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateAuthAndGetUser } from '@/lib/auth';
import { isInternalDivinityAdmin } from '@/lib/permission-validator';
import { getSentryProjectStats } from '@/lib/sentry-api-client';
import { getErrorMessage } from '@/lib/error-handling';

interface ErrorItem {
  id: string;
  title: string;
  culprit: string;
  level: string;
  count: number;
  userCount: number;
  lastSeen: string;
  firstSeen: string;
  status: string;
  shortId: string;
  errorDetails?: {
    stackTrace?: string;
    tags?: Record<string, string>;
  };
}

// === TYPE GUARDS (Mandato Inegociável - Safe Narrowing) ===

interface RawSentryError {
  id?: string;
  shortId?: string;
  title?: unknown;
  culprit?: unknown;
  level?: unknown;
  count?: unknown;
  userCount?: unknown;
  lastSeen?: unknown;
  firstSeen?: unknown;
  status?: unknown;
  stackTrace?: unknown;
  tags?: unknown;
}

function isRawSentryError(data: unknown): data is RawSentryError {
  return (
    typeof data === 'object' &&
    data !== null &&
    ('id' in data || 'shortId' in data)
  );
}

function isStringRecord(data: unknown): data is Record<string, string> {
  // === PASSO 1: Validação básica de tipo ===
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  // === PASSO 2: Cast seguro para Record (após validação) ===
  const obj = data as Record<string, unknown>;

  // === PASSO 3: Validação rigorosa - todos os valores devem ser strings ===
  return Object.values(obj).every((value) => typeof value === 'string');
}

function rawErrorToErrorItem(err: RawSentryError): ErrorItem {
  return {
    id: String(err.id || err.shortId || ''),
    title: String(err.title || 'Unknown Error'),
    culprit: String(err.culprit || 'Unknown'),
    level: String(err.level || 'error'),
    count: typeof err.count === 'number' ? err.count : 0,
    userCount: typeof err.userCount === 'number' ? err.userCount : 0,
    lastSeen: String(err.lastSeen || new Date().toISOString()),
    firstSeen: String(err.firstSeen || new Date().toISOString()),
    status: String(err.status || 'unresolved'),
    shortId: String(err.shortId || err.id || ''),
    errorDetails: {
      stackTrace: typeof err.stackTrace === 'string' ? err.stackTrace : undefined,
      tags: isStringRecord(err.tags) ? err.tags : undefined,
    },
  };
}

/**
 * Get system errors with filtering options
 * Query params:
 * - level: error, warning, fatal, info
 * - limit: max number of errors (default: 50, max: 500)
 * - offset: pagination offset (default: 0)
 * - search: search in title or culprit
 * - sort: count, recent (default: count)
 */
export async function GET(req: NextRequest) {
  try {
    // 1. Authenticate and check admin permissions
    const { user } = await validateAuthAndGetUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Check if user is internal admin
    if (!isInternalDivinityAdmin(user.email)) {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient permissions' },
        { status: 403 }
      );
    }

    // 3. Parse query parameters
    const searchParams = req.nextUrl.searchParams;
    const level = searchParams.get('level') || 'all';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 500);
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search') || '';
    const sort = searchParams.get('sort') || 'count';

    // 4. Fetch Sentry errors
    let errors: ErrorItem[] = [];
    try {
      const sentryStats = await getSentryProjectStats();
      // Safe narrowing: filter and transform with type guard
      const recentErrors = sentryStats.recentErrors as unknown[];
      errors = recentErrors
        .filter(isRawSentryError)
        .map(rawErrorToErrorItem);
    } catch (err) {
      console.warn('Failed to fetch Sentry errors:', getErrorMessage(err));
      // Continue with empty list if Sentry fails
    }

    // 5. Filter errors
    let filteredErrors = errors;

    if (level !== 'all') {
      filteredErrors = filteredErrors.filter((err) => err.level === level);
    }

    if (search) {
      filteredErrors = filteredErrors.filter((err) =>
        err.title.toLowerCase().includes(search.toLowerCase()) ||
        err.culprit.toLowerCase().includes(search.toLowerCase())
      );
    }

    // 6. Sort errors
    if (sort === 'recent') {
      filteredErrors.sort(
        (a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime()
      );
    } else {
      filteredErrors.sort((a, b) => b.count - a.count);
    }

    // 7. Paginate results
    const total = filteredErrors.length;
    const paginatedErrors = filteredErrors.slice(offset, offset + limit);

    // 8. Get health status
    const healthStatus =
      filteredErrors.filter((e) => e.level === 'error').length > 10 ? 'critical' :
      filteredErrors.filter((e) => e.level === 'error').length > 5 ? 'degraded' :
      'healthy';

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      health: {
        status: healthStatus,
        message:
          healthStatus === 'critical'
            ? 'High number of errors detected'
            : healthStatus === 'degraded'
            ? 'Some errors detected'
            : 'System operating normally',
      },
      errors: paginatedErrors,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      filters: {
        level: level !== 'all' ? level : null,
        search: search || null,
        sort,
      },
    });
  } catch (_error) {
    const errorMessage = getErrorMessage(error);
    console.error('Error fetching errors:', errorMessage);
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
