/**
 * ================================================================
 * SIGNED UPLOAD URL API
 * ================================================================
 * Generates signed URLs for direct browser uploads to Supabase
 *
 * Usage:
 * 1. Client calls this endpoint to get signed URL
 * 2. If no caseId provided, creates placeholder case
 * 3. Client uploads file directly to Supabase using the URL
 * 4. Supabase webhook triggers Railway worker for processing
 * 5. Worker uses UploadOrchestrator to process and update DB
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-utils';
import { getSignedUploadUrl, STORAGE_BUCKETS } from '@/lib/services/supabaseStorageService';
import { ICONS } from '@/lib/icons';

export async function POST(request: NextRequest) {
  try {
    // ============================================================
    // STEP 1: AUTHENTICATE
    // ============================================================
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;

    console.log(`${ICONS.UPLOAD} Signed URL requested by user: ${user?.id}`);

    // ============================================================
    // STEP 2: VALIDATE REQUEST
    // ============================================================
    const { fileName, bucket = 'case-documents', workspaceId, caseId: providedCaseId } = await request.json();

    if (!fileName || !workspaceId) {
      return NextResponse.json(
        {
          error: 'Missing required fields: fileName, workspaceId',
        },
        { status: 400 }
      );
    }

    // Validate bucket
    if (!Object.values(STORAGE_BUCKETS).includes(bucket)) {
      return NextResponse.json(
        {
          error: `Invalid bucket. Must be one of: ${Object.values(STORAGE_BUCKETS).join(', ')}`,
        },
        { status: 400 }
      );
    }

    // ============================================================
    // STEP 3: DETERMINE STORAGE PATH
    // ============================================================
    // If caseId is provided, use it; otherwise generate a temp ID
    // The actual case will be created by the webhook handler during processing
    let caseId = providedCaseId;

    if (!caseId) {
      // Generate a temporary path ID - will be mapped to actual caseId by webhook
      // Format: temp-{timestamp}-{random} to avoid collisions
      const timestamp = Date.now();
      const random = Math.random().toString(36).substr(2, 9);
      caseId = `temp-${timestamp}-${random}`;
      console.log(`${ICONS.STREAM} Generated temporary storage path: ${caseId}`);
    }

    // ============================================================
    // STEP 4: GENERATE SIGNED URL
    // ============================================================
    const timestamp = Date.now();
    const safeFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${workspaceId}/${caseId}/${timestamp}-${safeFileName}`;

    console.log(`${ICONS.STREAM} Generating signed URL for: ${filePath}`);

    const signedUrl = await getSignedUploadUrl(bucket, filePath);

    console.log(`${ICONS.SUCCESS} Signed URL generated: ${filePath}`);

    return NextResponse.json({
      signedUrl,
      filePath,
      bucket,
      caseId,
      expiresIn: 3600, // 1 hour
    });
  } catch (error) {
    console.error(`${ICONS.ERROR} Signed URL error:`, error);

    return NextResponse.json(
      {
        error: 'Failed to generate signed URL',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
