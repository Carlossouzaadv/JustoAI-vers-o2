import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-utils';
import { UploadOrchestrator } from '@/lib/services/upload/UploadOrchestrator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutos

/**
 * POST /api/upload/complete
 * Processa arquivo após upload direto ao Supabase
 */
export async function POST(request: NextRequest) {
    try {
        const { user, error: authError } = await requireAuth(request);
        if (!user) return authError!;

        const body = await request.json();
        const { filePath, bucket, fileName, fileSize, caseId } = body;
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
        if (!filePath || !bucket || !workspaceId || !fileName || !fileSize) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        console.log('📥 Processing uploaded file:', { filePath, bucket, workspaceId, caseId });

        // Instanciar orquestrador
        const orchestrator = new UploadOrchestrator();

        // Processar arquivo (extração, análise IA, etc)
        const result = await orchestrator.processUploadedFile({
            filePath,
            bucket,
            workspaceId,
            userId: user.id,
            fileName,
            fileSize,
            caseId
        });

        return NextResponse.json({
            success: true,
            data: result,
        });

    } catch (error) {
        console.error('Error processing upload:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Upload processing failed' },
            { status: 500 }
        );
    }
}
