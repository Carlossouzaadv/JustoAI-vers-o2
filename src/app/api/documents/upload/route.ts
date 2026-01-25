
// ================================================================
// PDF UPLOAD API - Refatorada com Serviços Modulares
// ================================================================
// Implementação delegada para UploadOrchestrator para Clean Code
// Mantém apenas a rota e configuração de runtime

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { UploadOrchestrator } from '@/lib/services/upload/UploadOrchestrator';

// Use Node.js runtime for larger file uploads
// Hobby plan: maxDuration max 300s, Pro: max 900s
// TODO: Migrate this to Railway for unlimited timeout
export const runtime = 'nodejs';

// Configuração de runtime para suportar uploads de arquivos grandes
export const maxDuration = 300; // 5 minutos máximo (Vercel Hobby plan limit)

export async function POST(request: NextRequest) {
  const orchestrator = new UploadOrchestrator();
  return await orchestrator.handleRequest(request);
}