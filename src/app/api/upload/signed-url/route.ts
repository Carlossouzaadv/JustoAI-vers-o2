import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-utils';
import { getSignedUploadUrl, STORAGE_BUCKETS } from '@/lib/services/supabaseStorageService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/upload/signed-url
 * Gera URL assinada para upload direto ao Supabase Storage
 */
export async function POST(request: NextRequest) {
    try {
        const { user, error: authError } = await requireAuth(request);
        if (!user) return authError!;

        const body = await request.json();
        const { fileName, fileSize, mimeType, caseId } = body;
        let { workspaceId } = body;

        // Resolve Workspace if missing or 'current'
        if (!workspaceId || workspaceId === 'current') {
            const { prisma } = await import('@/lib/prisma');
            const uw = await prisma.userWorkspace.findFirst({
                where: { userId: user.id },
                include: { workspace: true }
            });
            if (uw) {
                workspaceId = uw.workspaceId;
            } else {
                return NextResponse.json({ error: 'No workspace found' }, { status: 403 });
            }
        }

        // Validações
        if (!fileName || !fileSize || !mimeType) {
            return NextResponse.json(
                { error: 'Missing required fields: fileName, fileSize, mimeType' },
                { status: 400 }
            );
        }

        // Validar tamanho (100MB max)
        const MAX_SIZE = 100 * 1024 * 1024;
        if (fileSize > MAX_SIZE) {
            return NextResponse.json(
                { error: `File too large. Maximum size is 100MB` },
                { status: 400 }
            );
        }

        // Gerar nome único do arquivo
        const timestamp = Date.now();
        const cleanFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
        const uniqueFileName = `${timestamp}-${cleanFileName}`;

        // Use proper path structure: workspace/caseId/... OR workspace/...
        // If caseId is provided, use it.
        const filePath = caseId
            ? `${workspaceId}/${caseId}/${uniqueFileName}`
            : `${workspaceId}/${uniqueFileName}`;

        // Gerar signed URL (válida por 1 hora)
        const signedUrl = await getSignedUploadUrl(
            STORAGE_BUCKETS.CASE_DOCUMENTS,
            filePath,
            3600 // 1 hora
        );

        return NextResponse.json({
            success: true,
            data: {
                signedUrl,
                filePath,
                bucket: STORAGE_BUCKETS.CASE_DOCUMENTS,
                expiresIn: 3600,
            }
        });

    } catch (error) {
        console.error('Error generating signed URL:', error);
        return NextResponse.json(
            { error: 'Failed to generate upload URL' },
            { status: 500 }
        );
    }
}
