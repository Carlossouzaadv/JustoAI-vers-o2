/**
 * Admin Cache Management API
 * Allows internal admins to manually clear Redis caches
 * Accessible to: Internal admins (@justoai.com.br) only
 *
 * POST /api/admin/cache/clear
 * Body: { pattern?: string } - Cache key pattern to clear (e.g., "admin:cost:*", "admin:*")
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateAuthAndGetUser } from '@/lib/auth';
import { isInternalDivinityAdmin } from '@/lib/permission-validator';
import {
  clearAdminCachePattern,
  clearAllAdminCaches,
  getAdminCacheStats,
  invalidateHealthCache,
  invalidateCostCache,
  invalidateWebhookCache,
  invalidateSentryCache,
  invalidateBullCache,
  invalidateJuditCache,
  invalidateObservabilityCache,
} from '@/lib/cache/admin-redis';

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const { user } = await validateAuthAndGetUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Check if user is internal admin (required for cache management)
    if (!isInternalDivinityAdmin(user.email)) {
      return NextResponse.json(
        { error: 'Forbidden: Only internal admins can manage cache' },
        { status: 403 }
      );
    }

    // 3. Parse request body
    const body = await request.json();
    const action = typeof body.action === 'string' ? body.action : 'clear';
    const pattern = typeof body.pattern === 'string' ? body.pattern : undefined;

    // 4. Execute cache action
    switch (action) {
      case 'clear': {
        // Clear specific pattern or all
        if (pattern === 'all' || !pattern) {
          await clearAllAdminCaches();
          return NextResponse.json({
            success: true,
            message: 'All admin caches cleared',
            cleared: 'all'
          });
        } else if (pattern) {
          await clearAdminCachePattern(pattern);
          return NextResponse.json({
            success: true,
            message: `Admin cache cleared for pattern: ${pattern}`,
            pattern
          });
        }
        break;
      }

      case 'invalidate': {
        // Invalidate specific cache type
        const cacheType = typeof body.cacheType === 'string' ? body.cacheType : undefined;

        switch (cacheType) {
          case 'health':
            await invalidateHealthCache();
            return NextResponse.json({
              success: true,
              message: 'Health cache invalidated',
              cacheType: 'health'
            });

          case 'cost':
            const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : undefined;
            await invalidateCostCache(workspaceId);
            return NextResponse.json({
              success: true,
              message: `Cost cache invalidated${workspaceId ? ` for workspace: ${workspaceId}` : ' (global)'}`,
              cacheType: 'cost',
              workspaceId
            });

          case 'webhook':
            await invalidateWebhookCache();
            return NextResponse.json({
              success: true,
              message: 'Webhook cache invalidated',
              cacheType: 'webhook'
            });

          case 'sentry':
            await invalidateSentryCache();
            return NextResponse.json({
              success: true,
              message: 'Sentry cache invalidated',
              cacheType: 'sentry'
            });

          case 'bull':
            await invalidateBullCache();
            return NextResponse.json({
              success: true,
              message: 'Bull queue cache invalidated',
              cacheType: 'bull'
            });

          case 'judit':
            await invalidateJuditCache();
            return NextResponse.json({
              success: true,
              message: 'JUDIT consumption cache invalidated',
              cacheType: 'judit'
            });

          case 'observability':
            await invalidateObservabilityCache();
            return NextResponse.json({
              success: true,
              message: 'Observability cache invalidated',
              cacheType: 'observability'
            });

          default:
            return NextResponse.json(
              { error: `Unknown cache type: ${cacheType}` },
              { status: 400 }
            );
        }
      }

      case 'stats': {
        // Get cache statistics
        const stats = await getAdminCacheStats();
        return NextResponse.json({
          success: true,
          stats,
          message: 'Cache statistics retrieved'
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (_error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Cache management error:', errorMessage);

    return NextResponse.json(
      {
        success: false,
        error: errorMessage
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // 1. Authenticate user
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
        { error: 'Forbidden: Only internal admins can manage cache' },
        { status: 403 }
      );
    }

    // 3. Get cache statistics
    const stats = await getAdminCacheStats();

    return NextResponse.json({
      success: true,
      stats,
      documentation: {
        endpoint: 'POST /api/admin/cache/clear',
        actions: {
          clear: {
            description: 'Clear cache by pattern',
            body: { action: 'clear', pattern: 'admin:cost:*' }
          },
          invalidate: {
            description: 'Invalidate specific cache type',
            body: { action: 'invalidate', cacheType: 'health' },
            cacheTypes: [
              'health', 'cost', 'webhook', 'sentry', 'bull', 'judit', 'observability'
            ]
          },
          stats: {
            description: 'Get cache statistics',
            body: { action: 'stats' }
          }
        }
      }
    });
  } catch (_error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        error: errorMessage
      },
      { status: 500 }
    );
  }
}
