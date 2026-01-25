
// ================================================================
// PDF UPLOAD API - Refatorada com Serviços Modulares
// ================================================================
// Implementação delegada para UploadOrchestrator para Clean Code
// Mantém apenas a rota e configuração de runtime

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { UploadOrchestrator } from '@/lib/services/upload/UploadOrchestrator';

// Use Vercel Edge Runtime for larger file uploads
// Edge functions support up to 25MB request size (vs 4.5MB for serverless)
export const runtime = 'nodejs';

// Configuração de runtime para suportar uploads de arquivos grandes
export const maxDuration = 900; // 15 minutos máximo para processamento (Vercel Pro permite até 900s)

export async function POST(request: NextRequest) {
  const orchestrator = new UploadOrchestrator();
  return await orchestrator.handleRequest(request);
}