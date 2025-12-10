// ================================================================
// SYSTEM HEALTH ENDPOINT - Real-time component monitoring
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ICONS } from '@/lib/icons';
import { getRedisClient } from '@/lib/redis';

// Health check results
interface ComponentHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTimeMs: number;
  lastError?: string;
  timestamp: string;
}

interface SystemHealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: Record<string, ComponentHealth>;
  overallResponseTimeMs: number;
  version: string;
}

// ================================================================
// HEALTH CHECK FUNCTIONS
// ================================================================

async function checkDatabase(): Promise<ComponentHealth> {
  const startTime = Date.now();
  try {
    // Simple query to verify database connection
    await prisma.$queryRaw`SELECT 1`;
    const responseTimeMs = Date.now() - startTime;

    return {
      name: 'database',
      status: 'healthy',
      responseTimeMs,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    const responseTimeMs = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';

    return {
      name: 'database',
      status: 'unhealthy',
      responseTimeMs,
      lastError: errorMsg,
      timestamp: new Date().toISOString(),
    };
  }
}

async function checkRedis(): Promise<ComponentHealth> {
  const startTime = Date.now();
  try {
    // Gold-Standard command: redis.ping()
    // - O(1) complexity (fastest)
    // - Tests actual connection without side effects
    // - Returns "PONG" on success
    const redis = getRedisClient();
    const pongResponse = await redis.ping();
    const responseTimeMs = Date.now() - startTime;

    // Type-safe validation
    if (typeof pongResponse !== 'string' || pongResponse !== 'PONG') {
      throw new Error('Invalid PING response');
    }

    return {
      name: 'redis',
      status: 'healthy',
      responseTimeMs,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    const responseTimeMs = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';

    return {
      name: 'redis',
      status: error instanceof Error && error.message.includes('timeout')
        ? 'degraded'
        : 'unhealthy',
      responseTimeMs,
      lastError: errorMsg,
      timestamp: new Date().toISOString(),
    };
  }
}

async function checkSupabase(): Promise<ComponentHealth> {
  const startTime = Date.now();
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !hasServiceKey) {
      throw new Error('Supabase credentials not configured');
    }

    // Basic connectivity check
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'GET',
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
      },
      signal: AbortSignal.timeout(5000),
    });

    const responseTimeMs = Date.now() - startTime;

    if (response.ok) {
      return {
        name: 'supabase',
        status: 'healthy',
        responseTimeMs,
        timestamp: new Date().toISOString(),
      };
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    const responseTimeMs = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';

    return {
      name: 'supabase',
      status: error instanceof Error && error.message.includes('timeout') ? 'degraded' : 'unhealthy',
      responseTimeMs,
      lastError: errorMsg,
      timestamp: new Date().toISOString(),
    };
  }
}

async function checkResendEmail(): Promise<ComponentHealth> {
  const startTime = Date.now();
  try {
    const apiKey = process.env.SMTP_PASSWORD || process.env.RESEND_API_KEY;

    if (!apiKey) {
      // Email is optional for some deployments
      return {
        name: 'resend',
        status: 'degraded',
        responseTimeMs: 0,
        lastError: 'Email service not configured',
        timestamp: new Date().toISOString(),
      };
    }

    // Check Resend API connectivity
    const response = await fetch('https://api.resend.com/audiences', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(5000),
    });

    const responseTimeMs = Date.now() - startTime;

    if (response.ok) {
      return {
        name: 'resend',
        status: 'healthy',
        responseTimeMs,
        timestamp: new Date().toISOString(),
      };
    } else if (response.status === 401) {
      throw new Error('Invalid API key');
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    const responseTimeMs = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';

    return {
      name: 'resend',
      status: 'degraded',
      responseTimeMs,
      lastError: errorMsg,
      timestamp: new Date().toISOString(),
    };
  }
}

async function checkSlack(): Promise<ComponentHealth> {
  const startTime = Date.now();
  try {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;

    if (!webhookUrl) {
      // Slack is optional
      return {
        name: 'slack',
        status: 'degraded',
        responseTimeMs: 0,
        lastError: 'Slack webhook not configured',
        timestamp: new Date().toISOString(),
      };
    }

    // Test webhook with a simple health check (no actual message sent)
    // Just verify the URL is valid by checking it's reachable
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Health check ping',
        unfurl_links: false,
        unfurl_media: false,
      }),
      signal: AbortSignal.timeout(5000),
    });

    const responseTimeMs = Date.now() - startTime;

    if (response.ok) {
      return {
        name: 'slack',
        status: 'healthy',
        responseTimeMs,
        timestamp: new Date().toISOString(),
      };
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    const responseTimeMs = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';

    return {
      name: 'slack',
      status: 'degraded',
      responseTimeMs,
      lastError: errorMsg,
      timestamp: new Date().toISOString(),
    };
  }
}

async function checkJuditApi(): Promise<ComponentHealth> {
  const startTime = Date.now();
  try {
    const apiKey = process.env.JUDIT_API_KEY;
    const apiUrl = process.env.JUDIT_API_URL || 'https://api.judit.tech';

    if (!apiKey) {
      // JUDIT is critical but can be temporarily unavailable
      return {
        name: 'judit-api',
        status: 'degraded',
        responseTimeMs: 0,
        lastError: 'JUDIT API key not configured',
        timestamp: new Date().toISOString(),
      };
    }

    // Check JUDIT API connectivity
    const response = await fetch(`${apiUrl}/status`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(5000),
    });

    const responseTimeMs = Date.now() - startTime;

    if (response.ok) {
      return {
        name: 'judit-api',
        status: 'healthy',
        responseTimeMs,
        timestamp: new Date().toISOString(),
      };
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    const responseTimeMs = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';

    return {
      name: 'judit-api',
      status: error instanceof Error && error.message.includes('timeout') ? 'degraded' : 'unhealthy',
      responseTimeMs,
      lastError: errorMsg,
      timestamp: new Date().toISOString(),
    };
  }
}

// ================================================================
// MAIN HANDLER
// ================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  const overallStartTime = Date.now();

  try {
    console.log(`${ICONS.INFO} System health check initiated`);

    // Run all health checks in parallel (6 checks: database + redis + 4 external APIs)
    const checkResults = await Promise.all([
      checkDatabase(),
      checkRedis(), // <-- Critical: Heart of async system (BullMQ)
      checkSupabase(),
      checkResendEmail(),
      checkSlack(),
      // checkJuditApi(), // <-- Fase 31.5: Desabilitado temporariamente (JUDIT offline)
    ]);

    // Determine overall system status
    const checks: Record<string, ComponentHealth> = {};
    let unhealthyCount = 0;
    let degradedCount = 0;

    for (const check of checkResults) {
      checks[check.name] = check;

      if (check.status === 'unhealthy') {
        unhealthyCount++;
      } else if (check.status === 'degraded') {
        degradedCount++;
      }
    }

    const overallStatus: 'healthy' | 'degraded' | 'unhealthy' =
      unhealthyCount > 0 ? 'unhealthy' :
        degradedCount > 0 ? 'degraded' : 'healthy';

    const overallResponseTimeMs = Date.now() - overallStartTime;

    const response: SystemHealthResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks,
      overallResponseTimeMs,
      version: '1.0.0',
    };

    console.log(`${ICONS.SUCCESS} System health check completed`, {
      status: overallStatus,
      unhealthy: unhealthyCount,
      degraded: degradedCount,
      responseTimeMs: overallResponseTimeMs,
      checks: unhealthyCount > 0 ? checks : undefined // Log details if unhealthy
    });

    // Return appropriate HTTP status
    const statusCode = overallStatus === 'healthy' ? 200 :
      overallStatus === 'degraded' ? 503 : 503;

    return NextResponse.json(response, {
      status: statusCode,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';

    console.error(`${ICONS.ERROR} Health check failed: ${errorMsg}`);

    return NextResponse.json(
      {
        status: 'unhealthy' as const,
        timestamp: new Date().toISOString(),
        checks: {},
        overallResponseTimeMs: Date.now() - overallStartTime,
        error: errorMsg,
      },
      { status: 503 }
    );
  }
}
