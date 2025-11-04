/**
 * Admin Logs API
 * Returns system logs for monitoring and debugging
 * Accessible to: Internal admins (@justoai.com.br)
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateAuthAndGetUser } from '@/lib/auth';
import { isInternalDivinityAdmin } from '@/lib/permission-validator';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  service: string;
  message: string;
  metadata?: Record<string, any>;
  stackTrace?: string;
}

/**
 * Get system logs with filtering options
 * Query params:
 * - level: DEBUG, INFO, WARN, ERROR (default: all)
 * - service: filter by service name
 * - limit: max number of logs (default: 100, max: 1000)
 * - offset: pagination offset (default: 0)
 * - search: search in message content
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
    const service = searchParams.get('service') || 'all';
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 1000);
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search') || '';

    // 4. TODO: Fetch logs from actual logging service
    // For now, return mock data that demonstrates the structure
    const mockLogs: LogEntry[] = [
      {
        id: '1',
        timestamp: new Date(Date.now() - 5000).toISOString(),
        level: 'INFO',
        service: 'api/documents',
        message: 'Document analysis started',
        metadata: { documentId: 'doc-123', userId: 'user-456' }
      },
      {
        id: '2',
        timestamp: new Date(Date.now() - 15000).toISOString(),
        level: 'WARN',
        service: 'api/process',
        message: 'High latency detected',
        metadata: { duration: 2500, threshold: 2000 }
      },
      {
        id: '3',
        timestamp: new Date(Date.now() - 25000).toISOString(),
        level: 'ERROR',
        service: 'api/judit',
        message: 'JUDIT API timeout',
        metadata: { endpoint: '/search', timeout: 5000 },
        stackTrace: 'Error: Request timeout at JUDIT.search()'
      },
      {
        id: '4',
        timestamp: new Date(Date.now() - 35000).toISOString(),
        level: 'INFO',
        service: 'cron/aggregation',
        message: 'Daily aggregation completed',
        metadata: { workspacesProcessed: 15, alertsCreated: 3 }
      },
      {
        id: '5',
        timestamp: new Date(Date.now() - 45000).toISOString(),
        level: 'DEBUG',
        service: 'auth',
        message: 'User authenticated',
        metadata: { userId: 'user-789', provider: 'supabase' }
      }
    ];

    // 5. Filter logs
    let filteredLogs = mockLogs;

    if (level !== 'all') {
      filteredLogs = filteredLogs.filter((log) => log.level === level);
    }

    if (service !== 'all') {
      filteredLogs = filteredLogs.filter((log) => log.service === service);
    }

    if (search) {
      filteredLogs = filteredLogs.filter((log) =>
        log.message.toLowerCase().includes(search.toLowerCase())
      );
    }

    // 6. Paginate results
    const total = filteredLogs.length;
    const paginatedLogs = filteredLogs
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(offset, offset + limit);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      logs: paginatedLogs,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      filters: {
        level: level !== 'all' ? level : null,
        service: service !== 'all' ? service : null,
        search: search || null,
      },
    });
  } catch (error) {
    console.error('Error fetching logs:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch logs',
      },
      { status: 500 }
    );
  }
}
