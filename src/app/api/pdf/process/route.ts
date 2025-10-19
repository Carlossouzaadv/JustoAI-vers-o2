// ================================================================
// PDF PROCESSING SERVICE - Railway Backend
// ================================================================
// Este endpoint roda no Railway (não no Vercel serverless)
// Usa pdf-extractor.js que contém lógica Node.js pura (não bundled)
// Recebe PDF via request, processa, retorna texto extraído

import { NextRequest, NextResponse } from 'next/server';
import { join } from 'path';
import { existsSync, readdirSync } from 'fs';

export async function POST(request: NextRequest) {
  try {
    const timestamp = new Date().toISOString();

    // Debug: Log environment info
    console.log(`[${timestamp}] 🚂 DEBUG: process.cwd() = ${process.cwd()}`);
    console.log(`[${timestamp}] 🚂 DEBUG: __dirname (unavailable in standalone)`);

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

    // Debug: Try to list directories
    for (const checkPath of ['/app', '/app/justoai-v2', process.cwd()]) {
      try {
        if (existsSync(checkPath)) {
          console.log(`[${timestamp}] 🚂 DEBUG: Files in ${checkPath}:`, readdirSync(checkPath).slice(0, 10).join(', '));
        } else {
          console.log(`[${timestamp}] 🚂 DEBUG: Path does not exist: ${checkPath}`);
        }
      } catch (err) {
        console.log(`[${timestamp}] 🚂 DEBUG: Cannot list ${checkPath}:`, (err as any)?.message);
      }
    }

    let extractorPath = null;
    let lastError = null;
    const attemptedPaths: { path: string; exists: boolean; error?: string }[] = [];

    for (const path of possiblePaths) {
      const exists = existsSync(path);
      attemptedPaths.push({ path, exists });

      console.log(`[${timestamp}] 🚂 DEBUG: Checking path ${path}: exists=${exists}`);

      if (exists) {
        try {
          require.resolve(path);
          extractorPath = path;
          console.log(`[${timestamp}] 🚂 ✅ Found pdf-extractor at: ${path}`);
          break;
        } catch (err) {
          console.log(`[${timestamp}] 🚂 DEBUG: require.resolve failed for ${path}:`, (err as any)?.message);
        }
      }
    }

    if (!extractorPath) {
      const statusInfo = attemptedPaths.map(p => `${p.path} (exists=${p.exists})`).join(' | ');
      const errorMsg = `Could not find pdf-extractor.js. Attempted: ${statusInfo}`;
      console.error(`[${timestamp}] 🚂 ❌ PDF extractor not found:`, errorMsg);
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
