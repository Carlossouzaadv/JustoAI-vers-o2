// ================================================================
// USER DATA EXPORT ENDPOINT - LGPD Art. 18, II/V
// ================================================================
// GET /api/users/me/export - Export all user data
// Implements Right to Access and Data Portability
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, errorResponse } from '@/lib/api-utils';
import { LgpdService } from '@/lib/lgpd-service';
import { exportRateLimiter, getClientIdentifier, createRateLimitResponse, addRateLimitHeaders } from '@/lib/distributed-rate-limiter';
import { log, logError } from '@/lib/services/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/users/me/export
 * 
 * Exports all user data in JSON format.
 * Implements LGPD Art. 18, II (Right to Access) and V (Data Portability).
 * 
 * Rate limited to 5 requests per hour to prevent abuse.
 * 
 * @requires Authentication
 */
export async function GET(request: NextRequest) {
    const startTime = Date.now();

    try {
        // Authenticate user
        const { user, error: authError } = await requireAuth(request);

        if (authError) {
            return authError;
        }

        // Apply rate limiting (5 exports per hour)
        const clientId = `user:${user.id}`;
        const rateLimitResult = await exportRateLimiter.checkLimit(clientId);

        if (!rateLimitResult.allowed) {
            log.warn({
                msg: 'LGPD export rate limit exceeded',
                component: 'api',
                endpoint: '/api/users/me/export',
                userId: user.id,
                clientId: getClientIdentifier(request),
            });
            return createRateLimitResponse(rateLimitResult);
        }

        log.info({
            msg: 'LGPD data export request received',
            component: 'api',
            endpoint: '/api/users/me/export',
            userId: user.id,
        });

        // Execute LGPD data export
        const exportData = await LgpdService.exportUserData(user.id);

        // Create response with proper headers
        const response = NextResponse.json({
            success: true,
            data: exportData,
        }, {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Content-Disposition': `attachment; filename="lgpd-export-${user.id}-${Date.now()}.json"`,
            },
        });

        // Add rate limit headers
        addRateLimitHeaders(response, rateLimitResult);

        log.info({
            msg: 'LGPD data export completed',
            component: 'api',
            endpoint: '/api/users/me/export',
            userId: user.id,
            duration_ms: Date.now() - startTime,
            dataSize: JSON.stringify(exportData).length,
        });

        return response;

    } catch (error) {
        logError(error, 'LGPD export endpoint error', {
            component: 'api',
            endpoint: '/api/users/me/export',
        });

        return errorResponse('Erro interno do servidor', 500);
    }
}

/**
 * POST /api/users/me/export
 * 
 * Alternative export with format selection.
 * Supports JSON and CSV formats.
 */
export async function POST(request: NextRequest) {
    const startTime = Date.now();

    try {
        // Authenticate user
        const { user, error: authError } = await requireAuth(request);

        if (authError) {
            return authError;
        }

        // Apply rate limiting
        const clientId = `user:${user.id}`;
        const rateLimitResult = await exportRateLimiter.checkLimit(clientId);

        if (!rateLimitResult.allowed) {
            return createRateLimitResponse(rateLimitResult);
        }

        // Parse format from body
        const body = await request.json().catch(() => ({}));
        const format = body.format || 'json';

        log.info({
            msg: 'LGPD data export request received',
            component: 'api',
            endpoint: '/api/users/me/export',
            userId: user.id,
            format,
        });

        // Execute LGPD data export
        const exportData = await LgpdService.exportUserData(user.id);

        // Format response based on requested format
        if (format === 'csv') {
            // Convert to CSV (simplified for key personal data)
            const csvRows = [
                'Campo,Valor',
                `ID,${exportData.personalData.id}`,
                `Email,${exportData.personalData.email}`,
                `Nome,${exportData.personalData.name || ''}`,
                `Telefone,${exportData.personalData.phone || ''}`,
                `Papel,${exportData.personalData.role}`,
                `Status,${exportData.personalData.status}`,
                `Criado em,${exportData.personalData.createdAt}`,
                `Workspaces,${exportData.workspaces.length}`,
                `Casos,${exportData.cases.length}`,
                `Documentos,${exportData.documents.length}`,
                `Sessões de Chat,${exportData.chatSessions.length}`,
            ];

            const csvContent = csvRows.join('\n');

            const response = new NextResponse(csvContent, {
                status: 200,
                headers: {
                    'Content-Type': 'text/csv; charset=utf-8',
                    'Content-Disposition': `attachment; filename="lgpd-export-${user.id}-${Date.now()}.csv"`,
                },
            });

            addRateLimitHeaders(response, rateLimitResult);
            return response;
        }

        // Default: JSON format
        const response = NextResponse.json({
            success: true,
            data: exportData,
        }, {
            status: 200,
            headers: {
                'Content-Disposition': `attachment; filename="lgpd-export-${user.id}-${Date.now()}.json"`,
            },
        });

        addRateLimitHeaders(response, rateLimitResult);

        log.info({
            msg: 'LGPD data export completed',
            component: 'api',
            endpoint: '/api/users/me/export',
            userId: user.id,
            duration_ms: Date.now() - startTime,
            format,
        });

        return response;

    } catch (error) {
        logError(error, 'LGPD export endpoint error', {
            component: 'api',
            endpoint: '/api/users/me/export',
        });

        return errorResponse('Erro interno do servidor', 500);
    }
}

/**
 * OPTIONS - CORS preflight
 */
export async function OPTIONS() {
    return new NextResponse(null, { status: 200 });
}
