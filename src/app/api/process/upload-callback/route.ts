/**
 * ================================================================
 * UPLOAD CALLBACK API
 * ================================================================
 * Called by client after successful direct upload to Supabase
 *
 * Flow:
 * 1. Client uploads file to Supabase Storage
 * 2. Client calls this endpoint with file metadata
 * 3. We add processing job to queue
 * 4. Worker processes asynchronously
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-utils';
import { downloadFile, STORAGE_BUCKETS } from '@/lib/services/supabaseStorageService';
import { UploadOrchestrator } from '@/lib/services/upload/UploadOrchestrator';
import { ICONS } from '@/lib/icons';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    // ============================================================
    // STEP 1: AUTHENTICATE
    // ============================================================
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;

    console.log(`${ICONS.UPLOAD} Upload callback from user: ${user?.id}`);

    // ============================================================
    // STEP 2: PARSE CALLBACK DATA
    // ============================================================
    const { filePath, bucket = 'case-documents', workspaceId } = await request.json();

    if (!filePath || !workspaceId) {
      return NextResponse.json(
        {
          error: 'Missing required fields: filePath, workspaceId',
        },
        { status: 400 }
      );
    }

    if (!Object.values(STORAGE_BUCKETS).includes(bucket)) {
      return NextResponse.json(
        {
          error: `Invalid bucket: ${bucket}`,
        },
        { status: 400 }
      );
    }

    console.log(`${ICONS.STREAM} Processing upload: ${filePath} from bucket: ${bucket}`);

    // ============================================================
    // STEP 3: DOWNLOAD FILE FROM SUPABASE
    // ============================================================
    console.log(`${ICONS.DOWNLOAD} Downloading file from Supabase`);

    let fileBuffer: Buffer;
    try {
      const downloaded = await downloadFile(bucket, filePath);
      if (!downloaded) {
        throw new Error('File not found or failed to download');
      }
      fileBuffer = downloaded;
    } catch (downloadError) {
      console.error(`${ICONS.ERROR} Download failed:`, downloadError);
      return NextResponse.json(
        {
          error: 'Failed to download file from storage',
          details: downloadError instanceof Error ? downloadError.message : 'Unknown error',
        },
        { status: 500 }
      );
    }

    const fileSizeMB = (fileBuffer.length / 1024 / 1024).toFixed(2);
    console.log(`${ICONS.SUCCESS} File downloaded: ${fileSizeMB}MB`);

    // ============================================================
    // STEP 4: EXTRACT CASE ID FROM PATH
    // ============================================================
    const pathParts = filePath.split('/');
    let caseId: string | undefined = undefined;
    let fileName = 'uploaded-file.pdf';

    if (pathParts.length >= 2) {
      const potentialCaseId = pathParts[1];
      // If it's a temporary path, we'll create a new case during processing
      if (potentialCaseId.startsWith('temp-')) {
        console.log(`${ICONS.INFO} Temporary path detected, will create new case`);
      } else {
        caseId = potentialCaseId;
      }

      // Extract filename from last part of path
      if (pathParts.length >= 3) {
        const lastPart = pathParts[pathParts.length - 1];
        if (lastPart.includes('.')) {
          fileName = lastPart;
        }
      }
    }

    // ============================================================
    // STEP 5: PROCESS WITH UPLOAD ORCHESTRATOR
    // ============================================================
    console.log(`${ICONS.STREAM} Processing file with UploadOrchestrator`);

    const orchestrator = new UploadOrchestrator();

    try {
      // Process the file using UploadOrchestrator
      // The orchestrator will handle:
      // - PDF extraction
      // - Gemini AI analysis
      // - Case creation or update
      // - Timeline event creation

      console.log(`${ICONS.STREAM} Calling UploadOrchestrator.processUploadedFile with:`, {
        filePath,
        workspaceId,
        userId: user.id,
        caseId: caseId || 'auto-generate',
      });

      const result = await orchestrator.processUploadedFile({
        filePath,
        bucket,
        workspaceId,
        userId: user.id,
        fileName,
        fileSize: fileBuffer.length,
        caseId,
      });

      console.log(`${ICONS.SUCCESS} Processing complete, result:`, {
        caseId: result.caseId,
        hasAnalysis: typeof result === 'object' && 'analysis' in result,
      });

      const finalCaseId = typeof result === 'object' && result !== null && 'caseId' in result
        ? (result as Record<string, unknown>).caseId
        : caseId;

      return NextResponse.json({
        success: true,
        caseId: finalCaseId || caseId,
        filePath,
        message: 'File processed successfully',
      });
    } catch (orchestratorError) {
      const errorMsg = orchestratorError instanceof Error ? orchestratorError.message : String(orchestratorError);
      console.error(`${ICONS.ERROR} Orchestrator error:`, errorMsg);
      console.error(`${ICONS.ERROR} Stack:`, orchestratorError instanceof Error ? orchestratorError.stack : 'no stack');

      return NextResponse.json(
        {
          error: 'File processing failed',
          details: errorMsg,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error(`${ICONS.ERROR} Upload callback error:`, error);

    return NextResponse.json(
      {
        error: 'Upload callback failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
