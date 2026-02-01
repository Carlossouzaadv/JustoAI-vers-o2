import { NextResponse } from 'next/server';
import { workspaceLimitService } from '@/lib/services/WorkspaceLimitService';

// ============================================
// MIDDLEWARE: Check Workspace Process Limit
// Uso: Antes de adicionar novos processos
// ============================================

export async function checkProcessLimit(workspaceId: string): Promise<{
  allowed: boolean;
  response?: NextResponse;
}> {
  const check = await workspaceLimitService.checkProcessLimit(workspaceId);
  
  // Se pode continuar (abaixo do limite ou em grace period), tudo OK
  if (check.canContinue) {
    return { allowed: true };
  }
  
  // Bloqueado - retornar erro com detalhes
  return {
    allowed: false,
    response: NextResponse.json({
      error: 'PROCESS_LIMIT_REACHED',
      message: check.message,
      details: {
        current: check.currentValue,
        limit: check.limitValue,
        percentage: Math.round(check.percentage),
        gracePeriodActive: check.gracePeriodActive,
        gracePeriodEndsAt: check.gracePeriodEndsAt
      },
      actions: [
        {
          type: 'UPGRADE',
          label: 'Fazer upgrade de plano',
          url: '/settings/billing'
        },
        {
          type: 'REMOVE',
          label: 'Remover processos inativos',
          url: '/processes?filter=inactive'
        },
        {
          type: 'CONTACT',
          label: 'Falar com suporte',
          url: '/support'
        }
      ]
    }, { status: 403 })
  };
}
