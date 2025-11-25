/**
 * Admin Logs API
 * Returns system logs for monitoring and debugging
 * Accessible to: Internal admins (@justoai.com.br)
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateAuthAndGetUser } from '@/lib/auth';
import { isInternalDivinityAdmin } from '@/lib/permission-validator';
import { prisma } from '@/lib/prisma';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  service: string;
  message: string;
  metadata?: Record<string, unknown>;
  stackTrace?: string;
}

/**
 * Type guard to safely narrow unknown to Record<string, unknown>
 */
function isMetadataRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

    // 4. Fetch logs from database (GlobalLog table)
    const where: Record<string, unknown> = {};

    if (level !== 'all') {
      where.level = level;
    }

    if (service !== 'all') {
      where.category = service;
    }

    if (search) {
      where.message = {
        contains: search,
        mode: 'insensitive',
      };
    }

    // Fetch total count
    const total = await prisma.globalLog.count({ where });

    // Fetch paginated logs
    const dbLogs = await prisma.globalLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    });

    // Transform database logs to LogEntry format
    const paginatedLogs: LogEntry[] = dbLogs.map((log) => ({
      id: log.id,
      timestamp: log.createdAt.toISOString(),
      level: log.level as 'DEBUG' | 'INFO' | 'WARN' | 'ERROR',
      service: log.category,
      message: log.message,
      metadata: isMetadataRecord(log.data) ? log.data : undefined,
    }));

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
  } catch (_error) {
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
