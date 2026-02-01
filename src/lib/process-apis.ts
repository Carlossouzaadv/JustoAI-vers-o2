// ================================
// INTEGRAÇÃO COM APIS DE PROCESSOS
// ================================
// Sistema unificado para consulta de processos jurídicos
// (Refatorado para usar Escavador como provedor principal)

import { escavadorClient } from '@/lib/escavador-client';
import { log, logError } from '@/lib/services/logger';
import { ICONS } from '@/lib/icons';

// ================================
// TIPOS E INTERFACES
// ================================

export interface ProcessApiConfig {
  escavador?: {
    enabled: boolean;
  };
}

export interface ProcessSearchParams {
  processNumber: string;
  court?: string;
  clientName?: string;
  includeMovements?: boolean;
  includeParties?: boolean;
  maxMovements?: number;
}

export interface ProcessApiResponse {
  success: boolean;
  source: 'ESCAVADOR_API' | 'MOCK_API' | 'NONE';
  data?: ProcessData;
  error?: string;
  cached?: boolean;
}

export interface ProcessData {
  processNumber: string;
  court: string;
  subject: string;
  value?: number;
  distributionDate?: Date;
  status: string;
  parties: {
    plaintiffs: ProcessParty[];
    defendants: ProcessParty[];
    lawyers: ProcessLawyer[];
  };
  movements: ProcessMovement[];
  lastUpdate: Date;
  dataSource: string;
  consultationId: string;
}

export interface ProcessParty {
  name: string;
  document: string;
  type: 'PLAINTIFF' | 'DEFENDANT' | 'THIRD_PARTY';
  address?: string;
}

export interface ProcessLawyer {
  name: string;
  oabNumber: string;
  oabState: string;
  represents: string;
}

export interface ProcessMovement {
  date: Date;
  type: string;
  description: string;
  category: MovementCategory;
  importance: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  requiresAction: boolean;
  deadline?: Date;
}

export type MovementCategory =
  | 'HEARING'
  | 'DECISION'
  | 'PETITION'
  | 'DOCUMENT_REQUEST'
  | 'DEADLINE'
  | 'NOTIFICATION'
  | 'APPEAL'
  | 'SETTLEMENT'
  | 'OTHER';

// ================================
// CLASSE PRINCIPAL
// ================================

export class ProcessApiClient {
  private config: ProcessApiConfig;
  private cache = new Map<string, { data: ProcessData; timestamp: number }>();
  private readonly CACHE_TTL = 1000 * 60 * 60; // 1 hora

  constructor(config: ProcessApiConfig) {
    this.config = config;
  }

  async searchProcess(params: ProcessSearchParams): Promise<ProcessApiResponse> {
    const cacheKey = `${params.processNumber}_${params.court || 'all'}`;

    // 1. Check cache
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return {
        success: true,
        source: 'ESCAVADOR_API',
        data: cached,
        cached: true
      };
    }

    // 2. Try Escavador
    if (this.config.escavador?.enabled) {
      try {
        const result = await this.searchEscavador(params);
        if (result.success && result.data) {
          this.setCache(cacheKey, result.data);
          return result;
        }
      } catch (error) {
        logError(error, `Erro na Escavador API:`, { component: 'refactored' });
      }
    }

    return {
      success: false,
      source: 'NONE',
      error: 'Processo não encontrado nos provedores disponíveis'
    };
  }

  // ================================
  // IMPLEMENTAÇÃO ESCAVADOR
  // ================================

  private async searchEscavador(params: ProcessSearchParams): Promise<ProcessApiResponse> {
    try {
      // Usar a normalização de CNJ
      const cnj = normalizeProcessNumber(params.processNumber);
      
      // 1. Buscar dados do processo
      const processData = await escavadorClient.buscarProcesso(cnj) as Record<string, unknown>;
      
      if (!processData) {
        return { success: false, source: 'ESCAVADOR_API', error: 'Processo não encontrado' };
      }

      // 2. Buscar movimentações (opcional)
      let movementsRaw: Record<string, unknown>[] = [];
      if (params.includeMovements) {
        try {
          const updates = await escavadorClient.buscarMovimentacoes(cnj);
          movementsRaw = (updates.movimentacoes || []) as Record<string, unknown>[];
        } catch (e) {
          console.warn('Erro ao buscar movimentações Escavador:', e);
        }
      }

      // 3. Mapear resposta
      const data = this.mapEscavadorResponse(processData, movementsRaw);
      
      return {
        success: true,
        source: 'ESCAVADOR_API',
        data
      };

    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        source: 'ESCAVADOR_API',
        error: msg
      };
    }
  }

  private mapEscavadorResponse(apiData: Record<string, unknown>, movements: Record<string, unknown>[]): ProcessData {
    // Mapeamento básico baseado na estrutura comum do Escavador
    // Ajustar campos conforme a resposta real da API v2 
    const assuntoPrincipal = apiData.assunto_principal as Record<string, unknown> | undefined;
    const partesPoloAtivo = (apiData.partes_polo_ativo || []) as Record<string, unknown>[];
    const partesPoloPassivo = (apiData.partes_polo_passivo || []) as Record<string, unknown>[];
    const advogados = (apiData.advogados || []) as Record<string, unknown>[];
    
    return {
      processNumber: String(apiData.numero_cnj || apiData.numero || ''),
      court: String(apiData.sigla_tribunal || apiData.tribunal || ''),
      subject: String(assuntoPrincipal?.nome || ''),
      value: apiData.valor_causa ? parseFloat(String(apiData.valor_causa)) : undefined,
      distributionDate: apiData.data_distribuicao ? new Date(String(apiData.data_distribuicao)) : undefined,
      status: String(apiData.situacao || 'ATIVO'),
      
      parties: {
        plaintiffs: partesPoloAtivo.map((p) => ({
          name: String(p.nome || ''),
          document: String(p.cpf_cnpj || ''),
          type: 'PLAINTIFF' as const,
          address: undefined
        })),
        defendants: partesPoloPassivo.map((p) => ({
          name: String(p.nome || ''),
          document: String(p.cpf_cnpj || ''),
          type: 'DEFENDANT' as const,
          address: undefined
        })),
        lawyers: advogados.map((a) => ({
          name: String(a.nome || ''),
          oabNumber: String(a.oab || ''),
          oabState: String(a.uf || ''),
          represents: ''
        }))
      },

      movements: movements.map(m => {
        const type = String(m.tipo || 'MOVIMENTACAO');
        const desc = String(m.conteudo || m.descricao || '');
        return {
          date: m.data ? new Date(String(m.data)) : new Date(),
          type: type,
          description: desc,
          category: this.categorizeMovement(type, desc),
          importance: this.assessMovementImportance(type, desc),
          requiresAction: this.requiresAction(type, desc),
          deadline: undefined // Escavador nem sempre retorna prazo explícito
        };
      }),

      lastUpdate: new Date(),
      dataSource: 'ESCAVADOR',
      consultationId: `escavador_${Date.now()}`
    };
  }

  // ================================
  // UTILITÁRIOS (Reutilizados)
  // ================================

  private categorizeMovement(type: string, description: string): MovementCategory {
    const text = (type + ' ' + description).toUpperCase();
    if (text.includes('AUDIÊNCIA')) return 'HEARING';
    if (text.includes('SENTENÇA') || text.includes('DECISÃO')) return 'DECISION';
    if (text.includes('PETIÇÃO')) return 'PETITION';
    if (text.includes('CITAÇÃO') || text.includes('INTIMAÇÃO')) return 'NOTIFICATION';
    if (text.includes('RECURSO')) return 'APPEAL';
    if (text.includes('ACORDO')) return 'SETTLEMENT';
    return 'OTHER';
  }

  private assessMovementImportance(type: string, description: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' {
    const text = (type + ' ' + description).toUpperCase();
    if (text.includes('URGENTE') || text.includes('LIMINAR')) return 'URGENT';
    if (text.includes('SENTENÇA') || text.includes('AUDIÊNCIA')) return 'HIGH';
    if (text.includes('DECISÃO') || text.includes('VISTA')) return 'MEDIUM';
    return 'LOW';
  }

  private requiresAction(type: string, description: string): boolean {
    const text = (type + ' ' + description).toUpperCase();
    return text.includes('INTIMAÇÃO') || text.includes('CITAÇÃO') || text.includes('VISTA');
  }

  // ================================
  // CACHE
  // ================================

  private getFromCache(key: string): ProcessData | null {
    const cached = this.cache.get(key);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache(key: string, data: ProcessData): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }
}

// ================================
// FACTORY
// ================================

export function createProcessApiClient(): ProcessApiClient {
  return new ProcessApiClient({
    escavador: {
      enabled: escavadorClient.isConfigured()
    }
  });
}

// ================================
// EXPORTS & HELPERS
// ================================

export function normalizeProcessNumber(processNumber: string): string {
  const digits = processNumber.replace(/\D/g, '');
  if (digits.length === 20) {
    return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16, 20)}`;
  }
  return processNumber;
}

export function validateProcessNumber(processNumber: string): boolean {
  const normalized = normalizeProcessNumber(processNumber);
  const cnjRegex = /^\d{7}-\d{2}\.\d{4}\.\d{1}\.\d{2}\.\d{4}$/;
  return cnjRegex.test(normalized);
}

export function extractCourtFromProcessNumber(processNumber: string): string {
  // Mantendo lógica original, simplificada
  const normalized = normalizeProcessNumber(processNumber);
  const match = normalized.match(/^\d{7}-\d{2}\.\d{4}\.\d{1}\.(\d{2})\.\d{4}$/);
  if (!match) return '';
  return `Tribunal ${match[1]}`;
}