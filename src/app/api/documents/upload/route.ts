// ================================================================
// PDF UPLOAD API - PROXY to Railway Backend
// ================================================================
// Vercel has 4.5MB request size limit and 300s timeout for Hobby plan
// Railway backend (production) has NO size/timeout limits
// This route proxies large uploads to Railway for processing

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

const RAILWAY_API_URL = process.env.NEXT_PUBLIC_API_URL || 'justoai-vers-o2-production.up.railway.app';
const RAILWAY_FULL_URL = `https://${RAILWAY_API_URL}`;

export async function POST(request: NextRequest) {
  try {
    console.log('📤 [Vercel Proxy] Proxying upload to Railway:', `${RAILWAY_FULL_URL}/api/documents/upload`);

    // Clone the request to avoid consuming it twice
    const clonedRequest = request.clone();

    // Forward the entire request (including FormData/multipart) to Railway
    const response = await fetch(`${RAILWAY_FULL_URL}/api/documents/upload`, {
      method: 'POST',
      headers: {
        // Copy auth headers from original request
        'authorization': clonedRequest.headers.get('authorization') || '',
        'cookie': clonedRequest.headers.get('cookie') || '',
      },
      body: clonedRequest.body,
      // Don't set Content-Type - let the browser/fetch handle multipart boundaries
    });

    console.log('✅ [Vercel Proxy] Response from Railway:', response.status);

    // Return response with streaming for large responses
    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: new Headers(response.headers),
    });
  } catch (error) {
    console.error('❌ [Vercel Proxy] Error proxying to Railway:', error);

    return NextResponse.json(
      {
        error: 'Upload service unavailable',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}
