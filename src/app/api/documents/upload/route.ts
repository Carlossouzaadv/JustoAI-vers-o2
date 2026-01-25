// ================================================================
// PDF UPLOAD API - Accepts large files from client direct upload
// ================================================================
// When file >= 4.5MB, client uploads directly here (bypassing Vercel)
// This route runs in Railway which has NO size/timeout limits
//
// CORS is enabled for cross-origin requests from v2.justoai.com.br

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { UploadOrchestrator } from '@/lib/services/upload/UploadOrchestrator';

// ================================================================
// CORS Headers - Allow large uploads from frontend
// ================================================================
function getCORSHeaders(request: NextRequest) {
  const origin = request.headers.get('origin') || '';

  // Allow requests from these origins
  const allowedOrigins = [
    'https://v2.justoai.com.br',
    'https://www.justoai.com.br',
    'https://app.justoai.com.br',
    'http://localhost:3000', // Development
  ];

  const isAllowed = allowedOrigins.includes(origin);

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : 'https://v2.justoai.com.br',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400', // 24 hours
  };
}

/**
 * Handle CORS preflight requests
 */
export async function OPTIONS(request: NextRequest) {
  const corsHeaders = getCORSHeaders(request);
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

/**
 * Handle file upload (main handler)
 * Receives files >= 4.5MB from client direct upload
 */
export async function POST(request: NextRequest) {
  try {
    const corsHeaders = getCORSHeaders(request);
    const orchestrator = new UploadOrchestrator();
    const response = await orchestrator.handleRequest(request);

    // Add CORS headers to response
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  } catch (error) {
    console.error('Upload error:', error);

    const corsHeaders = getCORSHeaders(request);

    return NextResponse.json(
      {
        error: 'Upload failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}
