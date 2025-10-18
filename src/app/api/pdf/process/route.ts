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
    // Dynamically require the PDF extractor at runtime using absolute path
    // This prevents webpack from bundling it statically
    // Use require() to load CommonJS module at runtime
    const extractorPath = join(process.cwd(), 'src', 'lib', 'pdf-extractor.js');
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
