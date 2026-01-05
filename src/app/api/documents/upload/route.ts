
// ================================================================
// PDF UPLOAD API - Refatorada com Serviços Modulares
// ================================================================
// Implementação delegada para UploadOrchestrator para Clean Code
// Mantém apenas a rota e configuração de runtime

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { UploadOrchestrator } from '@/lib/services/upload/UploadOrchestrator';

// Configuração de runtime para suportar uploads de arquivos grandes
export const maxDuration = 300; // 5 minutos máximo para processamento

export async function POST(request: NextRequest) {
  const orchestrator = new UploadOrchestrator();
  return await orchestrator.handleRequest(request);
}