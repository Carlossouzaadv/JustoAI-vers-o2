/**
 * Admin Alerts API
 * Retorna alertas CRITICAL não resolvidos do sistema (Padrão-Ouro)
 * Dados reais do banco (JuditAlert model)
 *
 * Acessível apenas por: Internal admins (@justoai.com.br)
 * Rota: GET /api/admin/alerts
 */

import { NextResponse } from 'next/server';
import { validateAuthAndGetUser } from '@/lib/auth';
import { isInternalAdmin } from '@/lib/permission-validator';
import { prisma } from '@/lib/prisma';
import { getErrorMessage } from '@/lib/error-handling';
import { broadcastAlertCountUpdate } from '@/lib/alerts/alert-broadcast';

interface AdminAlert {
  id: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  alertType: string;
  title: string;
  message: string;
  workspaceId?: string | null;
  resolved: boolean;
  createdAt: string;
  resolvedAt?: string | null;
  metadata?: Record<string, unknown> | null;
  errorCode?: string | null;
}

// Type guard for alerts
function isAdminAlert(data: unknown): data is AdminAlert {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const obj = data as Record<string, unknown>;

  return (
    'id' in obj && typeof obj.id === 'string' &&
    'severity' in obj && typeof obj.severity === 'string' &&
    'alertType' in obj && typeof obj.alertType === 'string' &&
    'title' in obj && typeof obj.title === 'string' &&
    'message' in obj && typeof obj.message === 'string' &&
    'resolved' in obj && typeof obj.resolved === 'boolean' &&
    'createdAt' in obj && typeof obj.createdAt === 'string'
  );
}

// Helper to convert severity to standard levels if needed
function normalizeAlertSeverity(severity: unknown): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  const severityStr = String(severity).toUpperCase();
  if (['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(severityStr)) {
    return severityStr as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  }
  return 'MEDIUM'; // Default fallback
}

// Helper to normalize metadata from Prisma JSON to proper type
function normalizeMetadata(metadata: unknown): Record<string, unknown> | null {
  if (metadata === null || metadata === undefined) {
    return null;
  }

  // If it's already an object, return it as-is
  if (typeof metadata === 'object' && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }

  // If it's a primitive or array, wrap it in an object
  if (typeof metadata === 'string' || typeof metadata === 'number' || typeof metadata === 'boolean' || Array.isArray(metadata)) {
    return { value: metadata };
  }

  return null;
}

export async function GET(request: Request) {
  try {
    // 1. Authenticate
    const { user } = await validateAuthAndGetUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Check if user is internal admin
    if (!isInternalAdmin(user.email)) {
      return NextResponse.json(
        { error: 'Forbidden - This endpoint is restricted to internal admins only' },
        { status: 403 }
      );
    }

    // 3. Parse query params for filtering (optional)
    const { searchParams } = new URL(request.url);
    const severity = searchParams.get('severity') as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | null;
    const showResolved = searchParams.get('showResolved') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // 4. Build query filter
    const whereClause: Record<string, unknown> = {};

    if (severity && !showResolved) {
      // If severity is specified AND not showing resolved, filter by severity AND unresolved
      whereClause.severity = severity;
      whereClause.resolved = false;
    } else if (!showResolved) {
      // If not showing resolved, get all unresolved
      whereClause.resolved = false;
    } else if (severity) {
      // If showing resolved but filtering by severity
      whereClause.severity = severity;
    }
    // else: show all alerts

    // 5. Fetch alerts from database
    const alerts = await prisma.juditAlert.findMany({
      where: whereClause,
      select: {
        id: true,
        severity: true,
        alertType: true,
        title: true,
        message: true,
        workspaceId: true,
        resolved: true,
        resolvedAt: true,
        createdAt: true,
        metadata: true,
        errorCode: true
      },
      orderBy: [
        { resolved: 'asc' }, // Unresolved first
        { severity: 'asc' }, // Then by severity (CRITICAL first = lowest in enum)
        { createdAt: 'desc' } // Then by date (newest first)
      ],
      take: Math.min(limit, 100) // Max 100 alerts per request
    });

    // 6. Transform to AdminAlert type
    const transformedAlerts: AdminAlert[] = alerts.map(alert => ({
      id: alert.id,
      severity: normalizeAlertSeverity(alert.severity),
      alertType: alert.alertType,
      title: alert.title,
      message: alert.message,
      workspaceId: alert.workspaceId,
      resolved: alert.resolved,
      createdAt: alert.createdAt.toISOString(),
      resolvedAt: alert.resolvedAt?.toISOString() || null,
      metadata: normalizeMetadata(alert.metadata),
      errorCode: alert.errorCode || null
    }));

    // 7. Validate all alerts
    const validAlerts = transformedAlerts.filter((alert): alert is AdminAlert => {
      if (!isAdminAlert(alert)) {
        console.warn(`Invalid alert structure`);
        return false;
      }
      return true;
    });

    // 8. Calculate summary stats
    const unresolvedCount = validAlerts.filter(a => !a.resolved).length;
    const criticalCount = validAlerts.filter(a => a.severity === 'CRITICAL' && !a.resolved).length;
    const highCount = validAlerts.filter(a => a.severity === 'HIGH' && !a.resolved).length;

    // 9. Broadcast alert count update to all workspaces (Phase 33 integration)
    // This ensures the sidebar badge is updated in real-time
    // We broadcast to each workspace that has unresolved alerts
    const affectedWorkspaceIds = validAlerts
      .filter(a => !a.resolved && a.workspaceId)
      .map(a => a.workspaceId)
      .filter((id, index, arr) => id && arr.indexOf(id) === index); // Unique IDs

    // Broadcast updates in background (non-blocking)
     
    Promise.all(
      affectedWorkspaceIds.map(workspaceId =>
        broadcastAlertCountUpdate(workspaceId as string)
      )
    ).catch(error => {
      console.error('Error broadcasting alert counts:', error);
    });

    return NextResponse.json({
      success: true,
      alerts: validAlerts,
      summary: {
        total: validAlerts.length,
        unresolved: unresolvedCount,
        critical: criticalCount,
        high: highCount,
        resolved: validAlerts.filter(a => a.resolved).length
      },
      timestamp: new Date().toISOString(),
      message: 'Alerts fetched successfully'
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=30' // Cache for 30 seconds (real-time)
      }
    });
  } catch (error) {
    console.error('Error fetching admin alerts:', error);
    return NextResponse.json(
      {
        success: false,
        error: getErrorMessage(error),
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
