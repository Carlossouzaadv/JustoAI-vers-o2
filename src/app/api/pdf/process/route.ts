// ================================================================
// PDF PROCESSING SERVICE - Railway Backend
// ================================================================
// Este endpoint roda no Railway (não no Vercel serverless)
// Usa pdf-extractor.js que contém lógica Node.js pura (não bundled)
// Recebe PDF via request, processa, retorna texto extraído

import { NextRequest, NextResponse } from 'next/server';
import { join } from 'path';

export async function POST(request: NextRequest) {
  try {
    // Dynamically require the PDF extractor at runtime
    // Try multiple possible paths for the file in standalone build
    const possiblePaths = [
      // Path 1: Standard standalone structure: /app/justoai-v2/src/lib/
      '/app/justoai-v2/src/lib/pdf-extractor.js',
      // Path 2: Relative to process.cwd() if in /app
      join(process.cwd(), 'justoai-v2', 'src', 'lib', 'pdf-extractor.js'),
      // Path 3: If process.cwd() is /app/justoai-v2
      join(process.cwd(), 'src', 'lib', 'pdf-extractor.js'),
      // Path 4: Direct path from app root
      '/app/src/lib/pdf-extractor.js',
      // Path 5: Try direct root path (fallback)
      '/src/lib/pdf-extractor.js',
    ];

    let extractorPath = null;
    let lastError = null;

    for (const path of possiblePaths) {
      try {
        require.resolve(path);
        extractorPath = path;
        break;
      } catch (err) {
        lastError = err;
      }
    }

    if (!extractorPath) {
      const errorMsg = `Could not find pdf-extractor.js in any of: ${possiblePaths.join(', ')}. Last error: ${(lastError as any)?.message}`;
      console.error(`[${new Date().toISOString()}] 🚂 ❌ PDF extractor not found:`, errorMsg);
      throw new Error(errorMsg);
    }

    const { handlePdfProcessing } = require(extractorPath);

    const result = await handlePdfProcessing(request);

    if (!result.success && result.status) {
      return NextResponse.json(
        { error: result.error, details: result.details },
        { status: result.status }
      );
    }

    if (result.success) {
      return NextResponse.json({
        success: true,
        data: result.data,
      });
    }

    return NextResponse.json(result, { status: result.status || 500 });
  } catch (error) {
    const timestamp = new Date().toISOString();
    const errorMsg = (error as any)?.message || 'Unknown error';

    console.error(`[${timestamp}] 🚂 ❌ Fatal error in PDF processor:`, errorMsg);

    return NextResponse.json(
      {
        error: 'Erro ao processar PDF',
        details: errorMsg,
      },
      { status: 500 }
    );
  }
}
