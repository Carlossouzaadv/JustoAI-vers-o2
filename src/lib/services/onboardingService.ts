import { escavadorClient } from '@/lib/escavador-client';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

// ============================================
// ONBOARDING SERVICE - ESCAVADOR
// Substitui completamente o antigo juditOnboardingService.ts
// ============================================

interface OnboardingOptions {
  cnj: string;
  workspaceId: string;
  clientId?: string;
  createdById: string;
  incluirDocumentos?: boolean;
  usarCertificado?: boolean;
  forceUpdate?: boolean;
  targetCaseId?: string;
}

interface OnboardingResult {
  processo: {
    id: string;
    numeroCnj: string;
  };
  case: {
    id: string;
    number: string;
    status: string;
  };
  resumoIA?: string;
  movimentacoesCount: number;
  autosCount: number;
}

export class OnboardingService {
  
  /**
   * Onboarding completo de processo via Escavador
   */
  async onboardProcesso(options: OnboardingOptions): Promise<OnboardingResult> {
    const { 
      cnj, 
      workspaceId, 
      clientId,
      createdById,
      incluirDocumentos = true, 
      usarCertificado = true,
      forceUpdate = false,
      targetCaseId
    } = options;

    console.log(`[Onboarding] Iniciando para CNJ: ${cnj}`);

    // Verificar se cliente Escavador está configurado
    if (!escavadorClient.isConfigured()) {
      throw new Error('Escavador API não está configurada. Verifique ESCAVADOR_API_KEY em .env');
    }

    // 1. Verificar se processo já existe
    let processo = await prisma.processo.findUnique({
      where: { numeroCnj: cnj }
    });

    let dadosProcesso: unknown = null;
    let movimentacoes: unknown[] = [];
    let autos: unknown[] = [];
    let resumoIA: string | undefined;

    if (!processo || forceUpdate) {
      // 2. Solicitar atualização no Escavador
      console.log(`[Onboarding] Solicitando atualização no Escavador...`);
      const atualizacao = await escavadorClient.solicitarAtualizacao(cnj, {
        buscarAutos: incluirDocumentos,
        usarCertificado
      });

      // 3. Aguardar conclusão (polling)
      console.log(`[Onboarding] Aguardando conclusão da atualização...`);
      // 3. Aguardar conclusão (polling)
      console.log(`[Onboarding] Aguardando conclusão da atualização...`);
      const concluido = await this.aguardarAtualizacao(cnj);
      if (!concluido) {
        throw new Error('Timeout ao aguardar atualização do processo');
      }

      // 4. Buscar dados completos
      console.log(`[Onboarding] Buscando dados completos...`);
      dadosProcesso = await escavadorClient.buscarProcesso(cnj);
      
      // 5. Buscar todas as movimentações (paginadas)
      console.log(`[Onboarding] Buscando movimentações...`);
      movimentacoes = await this.buscarTodasMovimentacoes(cnj);
      console.log(`[Onboarding] ${movimentacoes.length} movimentações encontradas`);
      
      // 6. Buscar autos se solicitado
      if (incluirDocumentos) {
        console.log(`[Onboarding] Buscando autos/documentos...`);
        autos = await escavadorClient.buscarAutos(cnj, { usarCertificado });
        console.log(`[Onboarding] ${autos.length} autos encontrados`);
      }

      // 7. Solicitar resumo IA (opcional, pode falhar)
      try {
        console.log(`[Onboarding] Solicitando resumo IA...`);
        await escavadorClient.solicitarResumoIA(cnj);
        // Aguardar um pouco para processamento
        await new Promise(resolve => setTimeout(resolve, 5000));
        const resumoData = await escavadorClient.buscarResumoIA(cnj);
        resumoIA = resumoData.resumo;
        console.log(`[Onboarding] Resumo IA obtido`);
      } catch (error) {
        console.warn(`[Onboarding] Resumo IA não disponível: ${error}`);
      }

      // 8. Criar ou Atualizar registro do Processo
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
            } as Prisma.JsonObject,
            // updatedAt handled automatically or different name
            // updatedAt: new Date()
          }
        });
        console.log(`[Onboarding] Processo atualizado: ${processo.id}`);
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
      console.log(`[Onboarding] Processo criado: ${processo.id}`);
      }

      console.log(`[Onboarding] Processo criado: ${processo.id}`);
    } else {
      console.log(`[Onboarding] Processo já existe: ${processo.id}`);
      // Extrair dados existentes
      const dados = processo.dadosCompletos as { movimentacoes?: unknown[], autos?: unknown[], resumoIA?: string } | null;
      movimentacoes = dados?.movimentacoes || [];
      autos = dados?.autos || [];
      resumoIA = dados?.resumoIA;
    }

    // 9. Verificar se já existe um case para este processo neste workspace (se não for targetCaseId)
    let existingCase = null;
    
    if (targetCaseId) {
      existingCase = await prisma.case.findUnique({ where: { id: targetCaseId } });
      
      // Se fornecido targetCaseId, atualizamos ele para apontar para este processo
      if (existingCase) {
        await prisma.case.update({
          where: { id: targetCaseId },
          data: { 
            processoId: processo.id,
            status: 'ACTIVE',
            // Atualizar título/número se necessário
            number: cnj,
            // lastUpdate invalid
            // lastUpdate: new Date()
          }
        });
        console.log(`[Onboarding] Target case atualizado: ${targetCaseId}`);
      }
    } else {
      existingCase = await prisma.case.findFirst({
        where: {
          workspaceId,
          processoId: processo.id
        }
      });
    }

    if (existingCase) {
      console.log(`[Onboarding] Case já existe/atualizado: ${existingCase.id}`);
      return {
        processo: {
          id: processo.id,
          numeroCnj: processo.numeroCnj
        },
        case: {
          id: existingCase.id,
          number: existingCase.number,
          status: existingCase.status
        },
        resumoIA,
        movimentacoesCount: movimentacoes.length,
        autosCount: autos.length
      };
    }

    // 10. Obter ou criar cliente padrão se não fornecido
    let finalClientId = clientId;
    if (!finalClientId) {
      const defaultClient = await this.getOrCreateDefaultClient(workspaceId, createdById);
      finalClientId = defaultClient.id;
    }

    // 11. Criar Case no workspace
    const caseData = await prisma.case.create({
      data: {
        workspaceId,
        processoId: processo.id,
        clientId: finalClientId,
        createdById,
        number: cnj,
        title: `Processo ${cnj}`,
        status: 'ACTIVE',
        type: 'CIVIL', // Default, pode ser alterado depois
        priority: 'MEDIUM',
        // Campos de monitoramento com valores padrão da IA
        monitoringFrequency: 'DIARIA', // Default
        frequencySuggestedBy: 'AI',
        frequencyReason: 'Processo recém-adicionado - monitoramento diário inicial'
      }
    });

    console.log(`[Onboarding] Case criado: ${caseData.id}`);

    // 12. Configurar monitoramento no Escavador
    try {
      await escavadorClient.configurarMonitoramento(cnj, 'DIARIA');
      console.log(`[Onboarding] Monitoramento configurado`);
    } catch (error) {
      console.warn(`[Onboarding] Erro ao configurar monitoramento: ${error}`);
    }

    // 13. Atualizar contador de processos do workspace
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { processCount: { increment: 1 } }
    });

    return {
      processo: {
        id: processo.id,
        numeroCnj: processo.numeroCnj
      },
      case: {
        id: caseData.id,
        number: caseData.number,
        status: caseData.status
      },
      resumoIA,
      movimentacoesCount: movimentacoes.length,
      autosCount: autos.length
    };
  }

  private async aguardarAtualizacao(cnj: string, maxTentativas = 30): Promise<boolean> {
    for (let i = 0; i < maxTentativas; i++) {
      const status = await escavadorClient.consultarStatusAtualizacao(cnj);
      
      if (status.status === 'SUCESSO') return true;
      if (status.status === 'ERRO') throw new Error('Erro ao processar atualização no Escavador');
      
      console.log(`[Onboarding] Aguardando... tentativa ${i + 1}/${maxTentativas}`);
      // Aguardar 10 segundos antes de tentar novamente
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
    
    return false; // Timeout
  }

  private async buscarTodasMovimentacoes(cnj: string): Promise<unknown[]> {
    const todas: unknown[] = [];
    let cursor: string | undefined;

    do {
      const pagina = await escavadorClient.buscarMovimentacoes(cnj, cursor);
      todas.push(...pagina.movimentacoes);
      cursor = pagina.nextCursor;
    } while (cursor);

    return todas;
  }

  private async getOrCreateDefaultClient(workspaceId: string, _createdById: string) {
    // Buscar cliente padrão ou criar um
    let defaultClient = await prisma.client.findFirst({
      where: {
        workspaceId,
        name: 'Cliente Padrão'
      }
    });

    if (!defaultClient) {
      defaultClient = await prisma.client.create({
        data: {
          workspaceId,
          name: 'Cliente Padrão',
          email: 'cliente@padrao.local',
          type: 'INDIVIDUAL',
          status: 'ACTIVE'
        }
      });
    }

    return defaultClient;
  }
}

export const onboardingService = new OnboardingService();
