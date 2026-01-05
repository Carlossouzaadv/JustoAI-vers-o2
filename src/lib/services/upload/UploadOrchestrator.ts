
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { join } from 'path';
import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';

import { requireAuth } from '@/lib/api-utils';
import { ICONS } from '@/lib/icons';
import { log, logError } from '@/lib/services/logger';

// Services
import { getDocumentHashManager } from '@/lib/document-hash';
import { getAnalysisCacheManager } from '@/lib/analysis-cache';
import { PDFProcessor } from '@/lib/pdf-processor';
import { ProcessIdentificationService } from './ProcessIdentificationService';
import { UploadAnalysisService } from './UploadAnalysisService';
import { uploadCaseDocument } from '@/lib/services/supabaseStorageService';
import { mergeTimelines } from '@/lib/services/timelineUnifier';
import { getTimelineMergeService } from '@/lib/timeline-merge'; // For legacy audit event
// import { addOnboardingJob } from '@/lib/queue/juditQueue'; // Keeping logic but might move to orchestration

const prisma = new PrismaClient(); // Shared Prisma instance
const CONFIG = {
    MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
    TEMP_DIR: '/tmp/pdfs'
};

export class UploadOrchestrator {
    private hashManager = getDocumentHashManager();
    private cacheManager = getAnalysisCacheManager();
    private processService = new ProcessIdentificationService(prisma);
    private analysisService = new UploadAnalysisService(this.cacheManager);

    /**
     * Main entry point for handling upload request
     */
    public async handleRequest(request: NextRequest): Promise<NextResponse> {
        // 1. Auth & FormData
        const { user, error: authError } = await requireAuth(request);
        if (authError) return authError;

        let formData: FormData;
        try {
            formData = await request.formData();
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Unknown error';
            return NextResponse.json({ error: `Erro processando arquivo: ${msg}` }, { status: 400 });
        }

        const file = formData.get('file') as File | null;
        const caseId = formData.get('caseId') as string | null;
        const requestedWorkspaceId = formData.get('workspaceId') as string | null;

        // 2. Validation
        if (!file || !(file instanceof File)) return NextResponse.json({ error: 'Arquivo PDF obrigatório' }, { status: 400 });
        if (!file.name.toLowerCase().endsWith('.pdf')) return NextResponse.json({ error: 'Apenas PDF' }, { status: 400 });
        if (file.size > CONFIG.MAX_FILE_SIZE) return NextResponse.json({ error: 'Arquivo muito grande' }, { status: 413 });

        // 3. Workspace Resolution
        const workspaceId = await this.resolveWorkspace(user.id, requestedWorkspaceId);
        if (!workspaceId) return NextResponse.json({ error: 'Workspace inválido ou sem acesso' }, { status: 403 });

        // 4. Hashing & Deduplication
        const buffer = Buffer.from(await file.arrayBuffer());
        const hashResult = this.hashManager.calculateSHA256(buffer);

        const dedup = await this.hashManager.checkDeduplication(hashResult.textSha, workspaceId, prisma);

        if (dedup.isDuplicate) {
            return await this.handleDuplicate(dedup, file, hashResult, user.id, workspaceId);
        }

        // 5. PDF Extraction & Processing
        const tempPath = await this.saveTempFile(buffer, file.name);
        // Using PDFProcessor directly (will be refactored in Phase 2)
        const pdfProcessor = new PDFProcessor();
        // Ignoring types here for legacy compatibility awaiting Phase 2 refactor
        const extractionResultRaw = await pdfProcessor.processComplete({
            pdf_path: tempPath,
            extract_fields: ['processo', 'data', 'partes', 'valor']
        }) as unknown as Record<string, unknown>;

        // Normalize Result logic from original route
        // ... (This logic is still a bit complex, might need Phase 2 refactor of PDFProcessor to clean this up)
        // For now, assume simple extraction or fallback

        // This cleaning logic is now partially in ProcessIdentificationService, but we need text first
        // Refactoring Step: manual normalization logic replicated here for safety until PDFProcessor update
        const extractionData = extractionResultRaw as Record<string, unknown>;
        const nestedData = (extractionData.data as Record<string, unknown>) || {};

        const normalizedExtraction = {
            success: extractionResultRaw.success as boolean,
            text: (nestedData?.text as string) || (extractionResultRaw.text as string) || '',
            texto_original: (nestedData?.texto_original as string) || (extractionResultRaw.texto_original as string),
            texto_limpo: (nestedData?.texto_limpo as string) || (extractionResultRaw.texto_limpo as string),
            pageCount: (nestedData?.pageCount as number) ?? (extractionResultRaw.pageCount as number),
            error: (nestedData?.error as string) || (extractionResultRaw.error as string)
        };

        const extractedText = normalizedExtraction.text || normalizedExtraction.texto_original || normalizedExtraction.texto_limpo || '';
        if (!extractedText || extractedText.trim().length === 0) {
            return NextResponse.json({ error: 'Nenhum texto extraído do PDF' }, { status: 400 });
        }

        // 6. Process Identification / Creation
        const extraction = this.processService.processText(extractedText);

        const identification = await this.processService.identifyOrCreateProcess(
            workspaceId,
            user.id,
            extraction,
            caseId || undefined
        );

        // 7. Prompt User Decision
        if (identification.requiresUserDecision && identification.existingProcess) {
            // Logic to save temp file for prompt and return JSON
            const tempPromptPath = await this.saveTempFile(buffer, file.name); // Re-saving or reusing?
            return NextResponse.json({
                success: true,
                requiresUserDecision: true,
                message: 'Processo existente identificado',
                data: {
                    caseId: identification.existingProcess.id,
                    extractedProcessNumber: identification.extractedProcessNumber,
                    existingProcess: identification.existingProcess,
                    temporaryFile: { path: tempPromptPath, textSha: hashResult.textSha, cleanText: extraction.cleaningResult.cleanedText.substring(0, 1000) },
                    promptMessage: `Identificamos que este documento pertence ao processo "${identification.existingProcess.title}". Deseja anexá-lo?`
                }
            });
        }

        const targetCaseId = identification.targetCaseId;
        if (!targetCaseId) return NextResponse.json({ error: 'Falha ao identificar processo' }, { status: 500 });

        // 8. AI Analysis (Phase 1)
        let aiResult = null;
        try {
            aiResult = await this.analysisService.performInitialAnalysis(
                hashResult.textSha,
                extraction.cleaningResult.cleanedText,
                workspaceId,
                file.size / (1024 * 1024)
            );
        } catch (e: unknown) {
            const err = e as Error;
            if (err.message?.startsWith('DOCUMENT_LOCKED')) {
                return NextResponse.json({ error: 'Documento sendo processado. Tente novamente.' }, { status: 429 });
            }
            // Proceed without analysis on error
        }

        // 9. Persistence (Supabase + DB)
        const finalPath = await uploadCaseDocument(workspaceId, targetCaseId, file.name, buffer, 'application/pdf');
        if (!finalPath) return NextResponse.json({ error: 'Falha no upload para Storage' }, { status: 500 });

        const document = await prisma.caseDocument.create({
            data: {
                caseId: targetCaseId,
                name: file.name,
                originalName: file.name,
                type: 'CONTRACT',
                mimeType: 'application/pdf',
                size: file.size,
                url: finalPath || '',
                path: finalPath || '',
                pages: normalizedExtraction.pageCount || 0,
                extractedText: extractedText,
                cleanText: extraction.cleaningResult.cleanedText,
                textSha: hashResult.textSha,
                textExtractedAt: new Date(),
                analysisVersion: aiResult?.modelVersion || 'unknown',
                analysisKey: aiResult?.analysisKey || undefined,
                workerId: process.env.WORKER_ID || 'main',
                costEstimate: (aiResult?.aiAnalysisResult?.cost as { estimatedCost?: number })?.estimatedCost || 0,
                processed: true,
                ocrStatus: 'COMPLETED'
            }
        });

        // 10. Save Analysis Version
        if (aiResult && aiResult.aiAnalysisResult) {
            await this.saveAnalysisVersion(targetCaseId, workspaceId, aiResult, document.id);
        }

        // 11. Timeline Merge (Async / Non-blocking)
        this.triggerTimelineMerge(targetCaseId, document.id);

        // 12. Return Success
        return NextResponse.json({
            success: true,
            message: 'Documento processado com sucesso',
            data: {
                documentId: document.id,
                caseId: targetCaseId,
                isNewCase: identification.isNew
            }
        });
    }

    private async resolveWorkspace(userId: string, requestedId: string | null): Promise<string | null> {
        // Same logic as route.ts
        let wsId = requestedId;
        if (!wsId) {
            const uw = await prisma.userWorkspace.findFirst({ where: { userId }, include: { workspace: true } });
            if (!uw) return null;
            wsId = uw.workspaceId;
        }
        const access = await prisma.userWorkspace.findUnique({
            where: { userId_workspaceId: { userId, workspaceId: wsId } }
        });
        return (access && access.status === 'ACTIVE') ? wsId : null;
    }

    private async saveTempFile(buffer: Buffer, filename: string): Promise<string> {
        if (!existsSync(CONFIG.TEMP_DIR)) {
            await mkdir(CONFIG.TEMP_DIR, { recursive: true });
        }
        const path = join(CONFIG.TEMP_DIR, `${Date.now()}-${filename}`);
        await writeFile(path, buffer);
        return path;
    }

    private async handleDuplicate(
        dedup: { isDuplicate: boolean; originalDocumentId?: string; originalDocument?: unknown },
        file: File,
        hash: { textSha: string },
        userId: string,
        wsId: string
    ) {
        // Audit Event
        const timelineService = getTimelineMergeService();
        await timelineService.logAuditEvent('duplicate_upload', {
            originalDocumentId: dedup.originalDocumentId,
            originalDocument: dedup.originalDocument,
            attemptedUpload: { fileName: file.name, size: file.size, textSha: hash.textSha, userId, workspaceId: wsId }
        }, prisma);

        const dupDoc = await prisma.caseDocument.create({
            data: {
                caseId: dedup.originalDocument!.caseId,
                name: file.name,
                originalName: file.name,
                type: 'OTHER',
                mimeType: 'application/pdf',
                size: file.size,
                url: '', path: '', textSha: hash.textSha, isDuplicate: true,
                originalDocumentId: dedup.originalDocumentId,
                ocrStatus: 'COMPLETED'
            }
        });

        return NextResponse.json({
            success: true,
            isDuplicate: true,
            message: 'Arquivo duplicado',
            data: { duplicateDocumentId: dupDoc.id, originalDocument: dedup.originalDocument }
        });
    }

    private async saveAnalysisVersion(caseId: string, wsId: string, aiResult: { modelVersion: string; analysisKey: string; aiAnalysisResult: unknown }, docId: string) {
        try {
            // Logic to find last version and create new one
            const last = await prisma.caseAnalysisVersion.findFirst({ where: { caseId }, orderBy: { version: 'desc' }, select: { version: true } });
            const nextVer = (last?.version || 0) + 1;

            await prisma.caseAnalysisVersion.create({
                data: {
                    caseId, workspaceId: wsId, version: nextVer, status: 'COMPLETED',
                    analysisType: 'essential', modelUsed: aiResult.modelVersion,
                    analysisKey: aiResult.analysisKey,
                    aiAnalysis: JSON.parse(JSON.stringify(aiResult.aiAnalysisResult)),
                    confidence: 0.8, // Fallback
                    metadata: { source: 'upload_gemini', documentId: docId }
                }
            });
        } catch (e) {
            logError(e, 'Erro salvando analysis version', { component: 'Orchestrator' });
        }
    }

    private async triggerTimelineMerge(caseId: string, docId: string) {
        try {
            await mergeTimelines(caseId, [docId]);
        } catch (e) {
            logError(e, 'Erro timeline merge', { component: 'Orchestrator' });
        }
    }
}
