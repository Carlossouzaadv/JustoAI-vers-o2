import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { escavadorClient } from '@/lib/escavador-client';
import { Prisma } from '@prisma/client';

// ============================================
// WEBHOOK: RECEBE CALLBACKS DO ESCAVADOR V2
// POST /api/webhook/escavador
// ============================================

interface EscavadorCallback {
  event: string;
  uuid: string;
  numero_cnj?: string;
  status?: string;
  concluido_em?: string;
  // Campos para diferentes tipos de callback
  ultima_verificacao?: {
    id: number;
    status: 'PENDENTE' | 'SUCESSO' | 'ERRO' | 'NAO_ENCONTRADO';
    criado_em: string;
    concluido_em: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    // 1. Validar token de segurança
    const authHeader = request.headers.get('Authorization');
    const expectedToken = process.env.ESCAVADOR_WEBHOOK_SECRET;
    
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      console.warn('[Webhook Escavador] Token inválido');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const callback: EscavadorCallback = await request.json();
    console.log('[Webhook Escavador] Callback recebido:', JSON.stringify(callback, null, 2));

    // 2. Extrair CNJ do callback
    const cnj = callback.numero_cnj;
    if (!cnj) {
      console.warn('[Webhook Escavador] CNJ não encontrado no callback');
      return NextResponse.json({ error: 'CNJ não encontrado' }, { status: 400 });
    }

    // 3. Verificar status da atualização
    const status = callback.ultima_verificacao?.status || callback.status;
    
    if (status === 'SUCESSO') {
      // 4. Buscar Case em estado de ONBOARDING para este CNJ
      const pendingCase = await prisma.case.findFirst({
        where: {
          number: cnj,
          status: 'ONBOARDING'
        },
        include: {
          processo: true
        }
      });

      if (!pendingCase) {
        console.log(`[Webhook Escavador] Nenhum case em ONBOARDING para CNJ ${cnj}`);
        return NextResponse.json({ message: 'No pending case found' });
      }

      console.log(`[Webhook Escavador] Finalizando onboarding do case ${pendingCase.id}`);

      // 5. Buscar dados completos do processo
      const dadosProcesso = await escavadorClient.buscarProcesso(cnj);
      
      // 6. Buscar movimentações
      const movimentacoes = await buscarTodasMovimentacoes(cnj);
      console.log(`[Webhook Escavador] ${movimentacoes.length} movimentações encontradas`);

      // 7. Buscar autos (se aplicável)
      let autos: unknown[] = [];
      try {
        autos = await escavadorClient.buscarAutos(cnj, { usarCertificado: true });
        console.log(`[Webhook Escavador] ${autos.length} autos encontrados`);
      } catch (error) {
        console.warn(`[Webhook Escavador] Erro ao buscar autos: ${error}`);
      }

      // 8. Buscar resumo IA (opcional)
      let resumoIA: string | undefined;
      try {
        await escavadorClient.solicitarResumoIA(cnj);
        await new Promise(resolve => setTimeout(resolve, 3000));
        const resumoData = await escavadorClient.buscarResumoIA(cnj);
        resumoIA = resumoData.resumo;
      } catch (error) {
        console.warn(`[Webhook Escavador] Resumo IA não disponível: ${error}`);
      }

      // 9. Atualizar ou criar Processo
      let processo = await prisma.processo.findUnique({
        where: { numeroCnj: cnj }
      });

      if (processo) {
        processo = await prisma.processo.update({
          where: { id: processo.id },
          data: {
            dadosCompletos: {
              provider: 'ESCAVADOR',
              dados: dadosProcesso,
              movimentacoes,
              autos,
              resumoIA,
              fetchedAt: new Date().toISOString()
            } as Prisma.JsonObject
          }
        });
      } else {
        processo = await prisma.processo.create({
          data: {
            numeroCnj: cnj,
            dadosCompletos: {
              provider: 'ESCAVADOR',
              dados: dadosProcesso,
              movimentacoes,
              autos,
              resumoIA,
              fetchedAt: new Date().toISOString()
            } as Prisma.JsonObject,
            dataOnboarding: new Date()
          }
        });
      }

      // 10. Atualizar Case para ACTIVE
      await prisma.case.update({
        where: { id: pendingCase.id },
        data: {
          status: 'ACTIVE',
          processoId: processo.id
        }
      });

      // 11. Configurar monitoramento
      try {
        await escavadorClient.configurarMonitoramento(cnj, 'DIARIA');
        console.log(`[Webhook Escavador] Monitoramento configurado`);
      } catch (error) {
        console.warn(`[Webhook Escavador] Erro ao configurar monitoramento: ${error}`);
      }

      // 12. Incrementar contador do workspace
      await prisma.workspace.update({
        where: { id: pendingCase.workspaceId },
        data: { processCount: { increment: 1 } }
      });

      console.log(`[Webhook Escavador] Onboarding concluído para case ${pendingCase.id}`);
      
      return NextResponse.json({ 
        success: true, 
        caseId: pendingCase.id,
        status: 'ACTIVE'
      });

    } else if (status === 'ERRO' || status === 'NAO_ENCONTRADO') {
      // Atualizar case para erro
      const pendingCase = await prisma.case.findFirst({
        where: {
          number: cnj,
          status: 'ONBOARDING'
        }
      });

      if (pendingCase) {
        await prisma.case.update({
          where: { id: pendingCase.id },
          data: { 
            status: 'ERROR',
            // Salvar motivo do erro se disponível
          }
        });
        console.log(`[Webhook Escavador] Case ${pendingCase.id} marcado como ERROR`);
      }

      return NextResponse.json({ 
        success: false, 
        error: status === 'NAO_ENCONTRADO' ? 'Processo não encontrado' : 'Erro ao processar'
      });
    }

    // Status ainda pendente
    return NextResponse.json({ message: 'Callback processado', status });

  } catch (error) {
    console.error('[Webhook Escavador] Erro:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 }
    );
  }
}

// Helper para buscar todas movimentações paginadas
async function buscarTodasMovimentacoes(cnj: string): Promise<unknown[]> {
  const todas: unknown[] = [];
  let cursor: string | undefined;

  do {
    const pagina = await escavadorClient.buscarMovimentacoes(cnj, cursor);
    todas.push(...pagina.movimentacoes);
    cursor = pagina.nextCursor;
  } while (cursor);

  return todas;
}
