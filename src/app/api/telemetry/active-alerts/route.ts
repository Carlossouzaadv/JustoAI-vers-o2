// ================================================================
// API ROUTE: /api/telemetry/active-alerts
// Get unresolved JUDIT alerts
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth-helper';
import { captureApiError, setSentryUserContext } from '@/lib/sentry-error-handler';
import { ICONS } from '@/lib/icons';
// ================================================================
// TYPES
// ================================================================

type JuditAlert = NonNullable<Awaited<ReturnType<typeof prisma.providerAlert.findFirst>>>;

// ================================================================
// GET HANDLER: Get active (unresolved) alerts
// ================================================================

export async function GET(request: NextRequest) {
  let user: Awaited<ReturnType<typeof getAuthenticatedUser>> | null = null;

  try {
    user = await getAuthenticatedUser(request);
    if (!user) {
      return unauthorizedResponse('Não autenticado');
    }

    setSentryUserContext(user.id);

    console.log(`${ICONS.INFO} [Telemetry Alerts] Fetching active alerts for user ${user.id}`);

    // Get user's workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: { userId: user.id },
      include: { workspace: true },
    });

    if (!userWorkspace) {
      return NextResponse.json(
        { success: false, error: 'Usuário não possui workspace' },
        { status: 403 }
      );
    }

    const workspaceId = userWorkspace.workspaceId;

    // Get unresolved alerts
    const alerts = await prisma.providerAlert.findMany({
      where: {
        workspaceId,
        resolved: false,
      },
      orderBy: [
        { severity: 'desc' }, // CRITICAL first
        { createdAt: 'desc' }, // Most recent
      ],
    });

    console.log(`${ICONS.SUCCESS} [Telemetry Alerts] Found ${alerts.length} active alerts`);

    // Count by severity
    const summary = {
      total: alerts.length,
      critical: alerts.filter((a: JuditAlert) => a.severity === 'CRITICAL').length,
      high: alerts.filter((a: JuditAlert) => a.severity === 'HIGH').length,
      medium: alerts.filter((a: JuditAlert) => a.severity === 'MEDIUM').length,
      low: alerts.filter((a: JuditAlert) => a.severity === 'LOW').length,
    };

    const response = {
      success: true,
      alerts: alerts.map((alert: JuditAlert) => ({
        id: alert.id,
        workspaceId: alert.workspaceId,
        severity: alert.severity,
        type: alert.alertType,
        title: alert.title,
        message: alert.message,
        errorCode: alert.errorCode,
        numeroCnj: alert.numeroCnj,
        requestId: alert.requestId,
        detectedAt: alert.createdAt,
        metadata: alert.metadata,
      })),
      summary,
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error(`${ICONS.ERROR} [Telemetry Alerts] Error:`, error);

    captureApiError(error, {
      endpoint: '/api/telemetry/active-alerts',
      method: 'GET',
      userId: user?.id,
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao obter alertas',
      },
      { status: 500 }
    );
  }
}
