// ================================================================
// USER DELETE ENDPOINT - LGPD Art. 18, VI (Right to Deletion)
// ================================================================
// DELETE /api/users/me - Delete current user account
// Implements soft-delete with 30-day retention period
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, successResponse, errorResponse } from '@/lib/api-utils';
import { LgpdService } from '@/lib/lgpd-service';
import { createSupabaseServerClient } from '@/lib/auth';
import { log, logError } from '@/lib/services/logger';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/users/me/delete
 * 
 * Deletes the current user's account and all associated data.
 * Implements LGPD Art. 18, VI (Right to Deletion).
 * 
 * Process:
 * 1. Soft-delete user data (anonymize)
 * 2. Schedule hard purge after 30 days
 * 3. Sign out user from Supabase
 * 
 * @requires Authentication
 */
export async function DELETE(request: NextRequest) {
    const startTime = Date.now();

    try {
        // Authenticate user
        const { user, error: authError } = await requireAuth(request);

        if (authError) {
            return authError;
        }

        log.info({
            msg: 'LGPD delete request received',
            component: 'api',
            endpoint: '/api/users/me/delete',
            userId: user.id,
        });

        // Verify request body for confirmation
        const body = await request.json().catch(() => ({}));

        if (body.confirmation !== 'DELETE') {
            return errorResponse(
                'Confirmação inválida. Envie { "confirmation": "DELETE" } para confirmar.',
                400
            );
        }

        // Execute LGPD deletion
        const result = await LgpdService.deleteUserAccount(user.id);

        if (!result.success) {
            return errorResponse(
                result.error || 'Falha ao deletar conta',
                500
            );
        }

        // Sign out user from Supabase
        try {
            const supabase = await createSupabaseServerClient();
            await supabase.auth.signOut();
        } catch (signOutError) {
            // Non-blocking - user account is already deleted
            logError(signOutError, 'Failed to sign out user after deletion', {
                component: 'api',
                userId: user.id,
            });
        }

        log.info({
            msg: 'LGPD delete completed',
            component: 'api',
            endpoint: '/api/users/me/delete',
            userId: user.id,
            duration_ms: Date.now() - startTime,
            deletedEntities: result.deletedEntities,
        });

        return successResponse({
            message: 'Conta deletada com sucesso',
            deletedAt: result.deletedAt,
            scheduledPurgeAt: result.scheduledPurgeAt,
            deletedEntities: result.deletedEntities,
            note: 'Seus dados serão permanentemente removidos em 30 dias conforme LGPD.',
        });

    } catch (error) {
        logError(error, 'LGPD delete endpoint error', {
            component: 'api',
            endpoint: '/api/users/me/delete',
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
