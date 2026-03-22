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
    });    let dadosProcesso: unknown = null;
    let movimentacoes: unknown[] = [];
    let autos: unknown[] = [];
    let resumoIA: string | undefined;
    let processoExisteNaApi = false;

    if (!processo || forceUpdate) {
      // FASE 1: Busca Síncrona (Capa imediata)
      console.log(`[Onboarding] Tentando busca síncrona para CNJ...`);
      try {
        dadosProcesso = await escavadorClient.buscarProcesso(cnj);
        processoExisteNaApi = true;
        console.log(`[Onboarding] Processo encontrado na base síncrona.`);
      } catch (error) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const err = error as any;
        if (err.response?.status === 404 || err.status === 404) {
          console.log(`[Onboarding] Processo 404 (novo). Fallback para solicitar-atualizacao.`);
          processoExisteNaApi = false;
        } else {
          throw error;
        }
      }

      if (!processoExisteNaApi) {
        // FASE 3 (Fallback): Processo novo, requer scraping assíncrono
        console.log(`[Onboarding] Solicitando atualização no Escavador...`);
        // Aqui não aguardamos polling. Apenas solicitamos e dependemos do callback.
        await escavadorClient.solicitarAtualizacao(cnj, {
          buscarAutos: incluirDocumentos,
          usarCertificado,
          sendCallback: true
        });

        // Nós vamos criar o Processo e o Case, mas o Case ficará como ONBOARDING
        // e o resto da pipeline para por aqui (retorna rápido).
      } else {
        // FASE 2: Processo existe. Buscar complementos em paralelo
        console.log(`[Onboarding] Processo existe. Buscando complementos...`);
        const [movsResp, iaResp] = await Promise.allSettled([
          this.buscarTodasMovimentacoes(cnj).then(m => { movimentacoes = m; }),
          escavadorClient.buscarResumoIA(cnj).then(async (data) => {
            // Verificar qualidade. Se não atualizado, solicitar novo em background
            if (data.qualidade_resumo?.resumo_atualizado === false || !data.conteudo) {
              console.log(`[Onboarding] Resumo IA desatualizado ou vazio. Solicitando novo...`);
              await escavadorClient.solicitarResumoIA(cnj).catch(e => console.error('Erro solicitar novo resumo:', e));
            }
            resumoIA = data.resumo || data.conteudo;
          }).catch(async (e) => {
             // 404 na IA = não tem resumo
             // eslint-disable-next-line @typescript-eslint/no-explicit-any
             const err = e as any;
             if (err.response?.status === 404 || err.status === 404) {
                console.log(`[Onboarding] Resumo IA 404. Solicitando pela primeira vez...`);
                await escavadorClient.solicitarResumoIA(cnj).catch(err2 => console.error('Erro sol IA:', err2));
             }
          })
        ]);
        
        // As movimentações já vieram
        console.log(`[Onboarding] ${movimentacoes.length} movimentações encontradas`);

        // Solicitar autos (só se requerido) - em background
        // Aqui você pode decidir esperar ou não. Vamos esperar para manter a interface, mas pode ser background.
        if (incluirDocumentos) {
          console.log(`[Onboarding] Buscando autos...`);
          try {
             autos = await escavadorClient.buscarAutos(cnj, { usarCertificado });
             console.log(`[Onboarding] ${autos.length} autos encontrados`);
          } catch (e) {
             // eslint-disable-next-line @typescript-eslint/no-explicit-any
             const err = e as any;
             console.warn(`[Onboarding] Erro ao buscar autos: ${err.message || err}`);
             
             // Se der erro 422, significa que os autos não estão cacheados para nossa credencial
             // Solução: enviar uma solicitação assíncrona em background para que o webhook receba depois
             if (err.response?.status === 422 || err.status === 422) {
               console.log(`[Onboarding] Fallback: solicitando autos em background (Atualização Assíncrona)...`);
               
               // Não usamos await para não bloquear o retorno de Fase 1/2 ao usuário
               escavadorClient.solicitarAtualizacao(cnj, {
                 buscarAutos: true,
                 usarCertificado,
                 sendCallback: true
               }).catch(e2 => console.error('[Onboarding] Erro no fallback assíncrono de autos:', e2));
             }
          }
        }
      }

      // 8. Criar ou Atualizar registro do Processo
      const dadosCompletos = processoExisteNaApi ? {
        provider: 'ESCAVADOR',
        dados: dadosProcesso,
        movimentacoes,
        autos,
        resumoIA,
        fetchedAt: new Date().toISOString()
      } : {}; // Vazio, pois ainda não temos os dados

      if (processo) {
        processo = await prisma.processo.update({
          where: { id: processo.id },
          data: {
            // Só atualiza os dados completos se os pegamos
            ...(processoExisteNaApi ? { dadosCompletos: dadosCompletos as Prisma.JsonObject } : {})
          }
        });
        console.log(`[Onboarding] Processo atualizado: ${processo.id}`);
      } else {
        processo = await prisma.processo.create({
        data: {
          numeroCnj: cnj,
          dadosCompletos: dadosCompletos as Prisma.JsonObject,
          dataOnboarding: new Date()
        }
      });
      console.log(`[Onboarding] Processo criado: ${processo.id}`);
      }
    } else {
      console.log(`[Onboarding] Processo já existe: ${processo.id}`);
      processoExisteNaApi = true; // Assumimos que existe pois temos o registro
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
        status: processoExisteNaApi ? 'ACTIVE' : 'ONBOARDING',
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

  // Remover aguardarAtualizacao antigo se não for mais usado, 
  // mas vamos deixar pra caso algum outro serviço chame:
  private async aguardarAtualizacao(cnj: string, maxTentativas = 30): Promise<boolean> {
    for (let i = 0; i < maxTentativas; i++) {
      try {
        const status = await escavadorClient.consultarStatusAtualizacao(cnj);
        
        if (status.status === 'SUCESSO') return true;
        if (status.status === 'ERRO') return false;
      } catch (e) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const err = e as any;
        if (err.response?.status !== 404) {
          console.warn('[Onboarding] Erro ao consultar status', err.message);
        }
      }
      
      console.log(`[Onboarding] Aguardando... tentativa ${i + 1}/${maxTentativas}`);
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
