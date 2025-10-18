// ================================================================
// PDF PROCESSING SERVICE - Railway Backend
// ================================================================
// Este endpoint roda no Railway (não no Vercel serverless)
// Usa pdf-extractor.js que contém lógica Node.js pura (não bundled)
// Recebe PDF via request, processa, retorna texto extraído

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Dynamically require the PDF extractor at runtime
    // This prevents webpack from bundling it statically
    const { handlePdfProcessing } = await import('../../../lib/pdf-extractor.js');

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
