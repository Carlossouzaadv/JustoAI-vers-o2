// ================================================================
// PDF UPLOAD API - Smart Proxy with Auth + Streaming
// ================================================================
// For SMALL files (< 4.5MB):
//   Vercel processes directly (full processing)
//
// For LARGE files (>= 4.5MB):
//   Vercel validates auth + streams to Railway for processing
//   This avoids Vercel size limit while keeping auth working
//
// Author: Claude for JustoAI production deployment

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAuthOrForwarded } from '@/lib/api-utils';
import { UploadOrchestrator } from '@/lib/services/upload/UploadOrchestrator';
import { ICONS } from '@/lib/icons';

const RAILWAY_API_URL = process.env.NEXT_PUBLIC_API_URL || 'justoai-vers-o2-production.up.railway.app';
const RAILWAY_FULL_URL = `https://${RAILWAY_API_URL}`;
const SIZE_THRESHOLD = 4.5 * 1024 * 1024; // 4.5MB

export async function POST(request: NextRequest) {
  try {
    // ============================================================
    // STEP 1: AUTHENTICATE (Vercel validates OR accept x-user-id header)
    // ============================================================
    const { user, error: authError } = await requireAuthOrForwarded(request);
    if (authError) return authError;

    console.log(`${ICONS.UPLOAD} Auth passed for user: ${user?.id}`);

    // ============================================================
    // STEP 2: GET Content-Length to determine routing
    // ============================================================
    const contentLength = request.headers.get('content-length');
    const fileSize = contentLength ? parseInt(contentLength, 10) : 0;

    console.log(`${ICONS.UPLOAD} Content-Length: ${(fileSize / 1024 / 1024).toFixed(2)}MB`);

    // ============================================================
    // STEP 3: ROUTING DECISION
    // ============================================================
    if (fileSize >= SIZE_THRESHOLD) {
      console.log(`${ICONS.STREAM} File >= 4.5MB: Streaming to Railway`);

      // Clone request and forward to Railway with auth from Vercel
      try {
        const response = await fetch(`${RAILWAY_FULL_URL}/api/documents/upload`, {
          method: 'POST',
          // Stream the body directly (NO buffering)
          body: request.body,
          headers: {
            // Pass auth context: Vercel already validated, include user info
            'x-user-id': user?.id || '',
            'content-type': request.headers.get('content-type') || 'application/octet-stream',
            'content-length': String(fileSize),
          },
        });

        console.log(`${ICONS.SUCCESS} Railway response: ${response.status}`);

        // Stream response back to client
        return new NextResponse(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: new Headers(response.headers),
        });
      } catch (proxyError) {
        console.error(`${ICONS.ERROR} Failed to proxy to Railway:`, proxyError);

        return NextResponse.json(
          {
            error: 'Large file processing failed',
            details: proxyError instanceof Error ? proxyError.message : 'Unknown error',
          },
          { status: 503 }
        );
      }
    } else {
      console.log(`${ICONS.SUCCESS} File < 4.5MB: Processing on Vercel`);

      // For small files, process directly on Vercel
      const orchestrator = new UploadOrchestrator();
      return await orchestrator.handleRequest(request);
    }
  } catch (error) {
    console.error(`${ICONS.ERROR} Upload error:`, error);

    return NextResponse.json(
      {
        error: 'Upload failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
