// ================================================================
// JUDIT MONITORING SERVICE
// Serviço de monitoramento contínuo e de baixo custo
// ================================================================

import { getJuditApiClient } from '@/lib/judit-api-client';
import { prisma } from '@/lib/prisma';

// ================================================================
// TIPOS E INTERFACES
// ================================================================

export interface MonitoringSetupResult {
  success: boolean;
  trackingId?: string;
  processoId: string;
  numeroCnj: string;
  error?: string;
}

export interface TrackingPayload {
  recurrence: number; // Recorrência em dias
  search: {
    search_type: 'lawsuit_cnj';
    search_key: string;
  };
  with_attachments: boolean;
}

export interface TrackingResponse {
  tracking_id: string;
  status: string;
  [key: string]: any;
}

export interface TrackingUpdateResult {
  trackingId: string;
  hasNewMovements: boolean;
  movementsCount: number;
  movements?: any[];
  error?: string;
}

// ================================================================
// CONFIGURAÇÕES
// ================================================================

const MONITORING_CONFIG = {
  RECURRENCE_DAYS: 1, // Verificação diária
  WITH_ATTACHMENTS: false, // Sem anexos para baixo custo
  BATCH_SIZE: 50, // Processos por lote
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 5000,
} as const;

// ================================================================
// LOGS
// ================================================================

const log = {
  info: (message: string, data?: any) => {
    console.log(`[JUDIT MONITORING] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[JUDIT MONITORING ERROR] ${message}`, error || '');
  },
  warn: (message: string, data?: any) => {
    console.warn(`[JUDIT MONITORING WARN] ${message}`, data || '');
  },
};

const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

// ================================================================
// FUNÇÃO PRINCIPAL: SETUP DE MONITORAMENTO
// ================================================================

/**
 * Registra um processo para monitoramento contínuo na JUDIT
 *
 * @param cnj - Número CNJ do processo
 * @returns Resultado do setup de monitoramento
 */
export async function setupProcessMonitoring(
  cnj: string
): Promise<MonitoringSetupResult> {
  const juditClient = getJuditApiClient();

  log.info(`Iniciando setup de monitoramento`, { cnj });

  try {
    // Verificar/criar Processo no banco
    let processo = await prisma.processo.findUnique({
      where: { numeroCnj: cnj },
      include: { monitoramento: true },
    });

    if (!processo) {
      log.info(`Criando novo Processo no banco`, { cnj });
      processo = await prisma.processo.create({
        data: {
          numeroCnj: cnj,
        },
        include: { monitoramento: true },
      });
    }

    // Verificar se já existe monitoramento ativo
    if (processo.monitoramento?.ativo) {
      log.warn(`Processo já possui monitoramento ativo`, {
        cnj,
        trackingId: processo.monitoramento.trackingId,
      });

      return {
        success: true,
        trackingId: processo.monitoramento.trackingId,
        processoId: processo.id,
        numeroCnj: cnj,
      };
    }

    // Montar payload da requisição de tracking
    const payload: TrackingPayload = {
      recurrence: MONITORING_CONFIG.RECURRENCE_DAYS,
      search: {
        search_type: 'lawsuit_cnj',
        search_key: cnj,
      },
      with_attachments: MONITORING_CONFIG.WITH_ATTACHMENTS,
    };

    log.info(`Enviando requisição de tracking para JUDIT`, { cnj, payload });

    // Fazer requisição POST para /tracking
    const response = await juditClient.post<TrackingResponse>(
      'tracking',
      '/tracking',
      payload
    );

    const trackingId = response.tracking_id;

    if (!trackingId) {
      throw new Error('JUDIT não retornou tracking_id');
    }

    log.info(`Tracking criado com sucesso`, { cnj, trackingId });

    // Salvar ou atualizar registro de monitoramento no banco
    if (processo.monitoramento) {
      // Atualizar existente
      await prisma.juditMonitoring.update({
        where: { id: processo.monitoramento.id },
        data: {
          trackingId,
          ativo: true,
          tipo: 'UNIVERSAL',
        },
      });
    } else {
      // Criar novo
      await prisma.juditMonitoring.create({
        data: {
          trackingId,
          tipo: 'UNIVERSAL',
          ativo: true,
          processoId: processo.id,
        },
      });
    }

    log.info(`Monitoramento registrado no banco`, { cnj, trackingId });

    return {
      success: true,
      trackingId,
      processoId: processo.id,
      numeroCnj: cnj,
    };

  } catch (error) {
    log.error(`Falha ao setup de monitoramento`, { cnj, error });

    return {
      success: false,
      processoId: '',
      numeroCnj: cnj,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

// ================================================================
// FUNÇÕES DE VERIFICAÇÃO DE UPDATES
// ================================================================

/**
 * Verifica se há novos andamentos para um tracking específico
 *
 * @param trackingId - ID do tracking
 * @param sinceTimestamp - Timestamp ISO para filtrar (created_at_gte)
 * @returns Resultado com novos andamentos
 */
export async function checkTrackingUpdates(
  trackingId: string,
  sinceTimestamp: string
): Promise<TrackingUpdateResult> {
  const juditClient = getJuditApiClient();

  try {
    log.info(`Verificando updates para tracking`, { trackingId, sinceTimestamp });

    // Fazer requisição GET para /tracking/{trackingId}/responses
    const response = await juditClient.get<any>(
      'tracking',
      `/tracking/${trackingId}/responses?created_at_gte=${encodeURIComponent(sinceTimestamp)}`
    );

    const pageData = response.page_data || [];
    const hasNewMovements = pageData.length > 0;

    log.info(`Updates verificados`, {
      trackingId,
      hasNewMovements,
      movementsCount: pageData.length,
    });

    return {
      trackingId,
      hasNewMovements,
      movementsCount: pageData.length,
      movements: pageData,
    };

  } catch (error) {
    log.error(`Erro ao verificar updates`, { trackingId, error });

    return {
      trackingId,
      hasNewMovements: false,
      movementsCount: 0,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

// ================================================================
// FUNÇÕES DE GERENCIAMENTO DE MONITORAMENTO
// ================================================================

/**
 * Desativa monitoramento de um processo
 */
export async function stopProcessMonitoring(cnj: string): Promise<boolean> {
  const juditClient = getJuditApiClient();

  try {
    const processo = await prisma.processo.findUnique({
      where: { numeroCnj: cnj },
      include: { monitoramento: true },
    });

    if (!processo?.monitoramento) {
      log.warn(`Processo não possui monitoramento`, { cnj });
      return false;
    }

    const { trackingId } = processo.monitoramento;

    log.info(`Desativando monitoramento`, { cnj, trackingId });

    // Deletar tracking na JUDIT
    await juditClient.delete('tracking', `/tracking/${trackingId}`);

    // Desativar no banco
    await prisma.juditMonitoring.update({
      where: { id: processo.monitoramento.id },
      data: { ativo: false },
    });

    log.info(`Monitoramento desativado`, { cnj, trackingId });

    return true;

  } catch (error) {
    log.error(`Erro ao desativar monitoramento`, { cnj, error });
    return false;
  }
}

/**
 * Reativa monitoramento de um processo
 */
export async function restartProcessMonitoring(cnj: string): Promise<MonitoringSetupResult> {
  log.info(`Reiniciando monitoramento`, { cnj });

  // Desativar existente (se houver)
  await stopProcessMonitoring(cnj);

  // Criar novo
  return await setupProcessMonitoring(cnj);
}

/**
 * Lista todos os monitoramentos ativos
 */
export async function listActiveMonitorings(): Promise<any[]> {
  const monitorings = await prisma.juditMonitoring.findMany({
    where: { ativo: true },
    include: {
      processo: {
        select: {
          id: true,
          numeroCnj: true,
          ultimaAtualizacao: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return monitorings;
}

/**
 * Busca monitoramento por CNJ
 */
export async function getMonitoringByCnj(cnj: string): Promise<any | null> {
  const processo = await prisma.processo.findUnique({
    where: { numeroCnj: cnj },
    include: {
      monitoramento: true,
    },
  });

  return processo?.monitoramento || null;
}

// ================================================================
// FUNÇÕES DE ESTATÍSTICAS
// ================================================================

/**
 * Retorna estatísticas dos monitoramentos
 */
export async function getMonitoringStats() {
  const [total, ativos, inativos] = await Promise.all([
    prisma.juditMonitoring.count(),
    prisma.juditMonitoring.count({ where: { ativo: true } }),
    prisma.juditMonitoring.count({ where: { ativo: false } }),
  ]);

  return {
    total,
    ativos,
    inativos,
  };
}

// ================================================================
// EXTRAÇÃO DE MOVIMENTAÇÕES
// ================================================================

/**
 * Extrai texto das movimentações de uma resposta JUDIT
 */
export function extractMovementsText(movements: any[]): string[] {
  if (!movements || !Array.isArray(movements)) {
    return [];
  }

  const texts: string[] = [];

  for (const movement of movements) {
    // Tentar extrair texto de diferentes formatos
    const text =
      movement.text ||
      movement.description ||
      movement.descricao ||
      movement.movimento ||
      JSON.stringify(movement);

    if (text && typeof text === 'string' && text.trim().length > 0) {
      texts.push(text.trim());
    }
  }

  return texts;
}

/**
 * Atualiza processo com novos andamentos
 */
export async function updateProcessWithMovements(
  processoId: string,
  movements: any[]
): Promise<void> {
  try {
    // Buscar dados atuais
    const processo = await prisma.processo.findUnique({
      where: { id: processoId },
      select: { dadosCompletos: true },
    });

    const dadosAtuais = (processo?.dadosCompletos as any) || {};

    // Adicionar novos movimentos
    const movimentosExistentes = dadosAtuais.movimentos || [];
    const todosMovimentos = [...movimentosExistentes, ...movements];

    // Atualizar no banco
    await prisma.processo.update({
      where: { id: processoId },
      data: {
        dadosCompletos: {
          ...dadosAtuais,
          movimentos: todosMovimentos,
          ultimaVerificacao: new Date().toISOString(),
        },
        ultimaAtualizacao: new Date(),
      },
    });

    log.info(`Processo atualizado com novos movimentos`, {
      processoId,
      novosMovimentos: movements.length,
      totalMovimentos: todosMovimentos.length,
    });

  } catch (error) {
    log.error(`Erro ao atualizar processo com movimentos`, { processoId, error });
    throw error;
  }
}

// ================================================================
// ANÁLISE INTELIGENTE DE ANEXOS
// ================================================================

/**
 * Palavras-chave que indicam alta probabilidade de anexos importantes
 */
const ATTACHMENT_KEYWORDS = [
  // Documentos Principais
  'juntada',
  'juntado',
  'juntou',
  'anexado',
  'anexou',
  'protocolado',
  'protocolo',

  // Peças Processuais
  'petição',
  'petição inicial',
  'contestação',
  'réplica',
  'manifestação',
  'impugnação',
  'recurso',
  'apelação',
  'agravo',
  'embargos',

  // Decisões Judiciais
  'sentença',
  'decisão',
  'despacho',
  'acórdão',
  'decisão interlocutória',
  'decisão monocrática',
  'voto',

  // Documentos Técnicos
  'laudo',
  'perícia',
  'parecer',
  'relatório',
  'certidão',
  'atestado',

  // Documentos Comprobatórios
  'documento',
  'comprovante',
  'nota fiscal',
  'contrato',
  'procuração',

  // Intimações e Citações
  'intimação',
  'citação',
  'notificação',
  'edital',

  // Audiências e Sessões
  'ata de audiência',
  'termo de audiência',
  'ata de sessão',
  'gravação',

  // Outros
  'alvará',
  'mandado',
  'ofício',
  'carta precatória',
  'carta rogatória',
] as const;

/**
 * Interface para o resultado da análise
 */
export interface AttachmentAnalysisResult {
  shouldFetchAttachments: boolean;
  matchedKeywords: string[];
  matchedMovements: Array<{
    text: string;
    keywords: string[];
  }>;
  requestId?: string;
  error?: string;
}

/**
 * Analisa novos andamentos e busca anexos se necessário
 *
 * Esta é a função inteligente que conecta a detecção de baixo custo
 * com as buscas de alto custo apenas quando realmente necessário.
 *
 * @param processo - Processo completo do banco
 * @param novosAndamentos - Novos andamentos detectados
 * @returns Resultado da análise e busca (se executada)
 */
export async function analyzeMovementsAndFetchAttachmentsIfNeeded(
  processo: any,
  novosAndamentos: any[]
): Promise<AttachmentAnalysisResult> {

  log.info(`Analisando ${novosAndamentos.length} novos andamentos`, {
    cnj: processo.numeroCnj,
  });

  try {
    const matchedKeywords: string[] = [];
    const matchedMovements: Array<{ text: string; keywords: string[] }> = [];

    // ============================================================
    // ETAPA 1: VERIFICAR PALAVRAS-CHAVE
    // ============================================================

    for (const andamento of novosAndamentos) {
      // Extrair texto do andamento
      const text = extractMovementText(andamento);

      if (!text) continue;

      const textLower = text.toLowerCase();
      const foundKeywords: string[] = [];

      // Verificar cada keyword
      for (const keyword of ATTACHMENT_KEYWORDS) {
        if (textLower.includes(keyword.toLowerCase())) {
          foundKeywords.push(keyword);

          if (!matchedKeywords.includes(keyword)) {
            matchedKeywords.push(keyword);
          }
        }
      }

      // Se encontrou keywords neste andamento, registrar
      if (foundKeywords.length > 0) {
        matchedMovements.push({
          text: text.substring(0, 200), // Primeiros 200 chars para log
          keywords: foundKeywords,
        });
      }
    }

    // ============================================================
    // ETAPA 2: DECISÃO DE BUSCA DE ANEXOS
    // ============================================================

    if (matchedKeywords.length === 0) {
      log.info(`Nenhuma keyword encontrada - mantendo apenas textos`, {
        cnj: processo.numeroCnj,
      });

      return {
        shouldFetchAttachments: false,
        matchedKeywords: [],
        matchedMovements: [],
      };
    }

    // ============================================================
    // ETAPA 3: BUSCAR ANEXOS (ALTO CUSTO)
    // ============================================================

    log.warn(`Keywords detectadas - iniciando busca de anexos (ALTO CUSTO)`, {
      cnj: processo.numeroCnj,
      keywords: matchedKeywords,
      matchedCount: matchedMovements.length,
    });

    // Importar função de busca completa
    const { performFullProcessRequest } = await import('./juditOnboardingService');

    // Executar busca completa com anexos
    const searchResult = await performFullProcessRequest(
      processo.numeroCnj,
      'BUSCA_ANEXOS'
    );

    if (searchResult.success) {
      log.success(`Anexos buscados com sucesso`, {
        cnj: processo.numeroCnj,
        requestId: searchResult.requestId,
        keywords: matchedKeywords,
      });

      return {
        shouldFetchAttachments: true,
        matchedKeywords,
        matchedMovements,
        requestId: searchResult.requestId,
      };

    } else {
      log.error(`Falha ao buscar anexos`, {
        cnj: processo.numeroCnj,
        error: searchResult.error,
      });

      return {
        shouldFetchAttachments: true,
        matchedKeywords,
        matchedMovements,
        error: searchResult.error,
      };
    }

  } catch (error) {
    log.error(`Erro na análise de anexos`, {
      cnj: processo.numeroCnj,
      error,
    });

    return {
      shouldFetchAttachments: false,
      matchedKeywords: [],
      matchedMovements: [],
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

/**
 * Extrai texto de um andamento (suporta diferentes formatos)
 */
function extractMovementText(andamento: any): string | null {
  if (!andamento) return null;

  // Tentar diferentes campos comuns
  return (
    andamento.text ||
    andamento.description ||
    andamento.descricao ||
    andamento.movimento ||
    andamento.texto ||
    andamento.content ||
    andamento.conteudo ||
    null
  );
}

/**
 * Verifica se um texto contém alguma keyword de anexos
 * (função auxiliar para uso externo)
 */
export function containsAttachmentKeywords(text: string): {
  hasKeywords: boolean;
  keywords: string[];
} {
  const textLower = text.toLowerCase();
  const foundKeywords: string[] = [];

  for (const keyword of ATTACHMENT_KEYWORDS) {
    if (textLower.includes(keyword.toLowerCase())) {
      foundKeywords.push(keyword);
    }
  }

  return {
    hasKeywords: foundKeywords.length > 0,
    keywords: foundKeywords,
  };
}
