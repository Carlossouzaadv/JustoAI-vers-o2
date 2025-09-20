// ================================
// INTEGRAÇÃO COM APIS DE PROCESSOS
// ================================
// Sistema unificado para consulta de processos jurídicos
// via Judit API, Codilo API e outras fontes

import { ICONS } from './icons';

// ================================
// TIPOS E INTERFACES
// ================================

export interface ProcessApiConfig {
  judit?: {
    baseUrl: string;
    apiKey: string;
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
  source: 'JUDIT_API';
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

  // Partes do processo
  parties: {
    plaintiffs: ProcessParty[];
    defendants: ProcessParty[];
    lawyers: ProcessLawyer[];
  };

  // Movimentações
  movements: ProcessMovement[];

  // Metadados da consulta
  lastUpdate: Date;
  dataSource: string;
  consultationId: string;
}

export interface ProcessParty {
  name: string;
  document: string; // CPF/CNPJ
  type: 'PLAINTIFF' | 'DEFENDANT' | 'THIRD_PARTY';
  address?: string;
}

export interface ProcessLawyer {
  name: string;
  oabNumber: string;
  oabState: string;
  represents: string; // Nome da parte que representa
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

  /**
   * Busca dados de um processo usando as APIs disponíveis
   */
  async searchProcess(params: ProcessSearchParams): Promise<ProcessApiResponse> {
    const cacheKey = `${params.processNumber}_${params.court || 'all'}`;

    // Verificar cache primeiro
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return {
        success: true,
        source: 'JUDIT_API', // Assumindo Judit como padrão
        data: cached,
        cached: true
      };
    }

    // Tentar Judit API primeiro (mais confiável)
    if (this.config.judit?.enabled) {
      try {
        const result = await this.searchJuditApi(params);
        if (result.success && result.data) {
          this.setCache(cacheKey, result.data);
          return result;
        }
      } catch (error) {
        console.error(`${ICONS.ERROR} Erro na Judit API:`, error);
      }
    }

    // Sem APIs de fallback disponíveis

    return {
      success: false,
      source: 'JUDIT_API',
      error: 'Nenhuma API disponível ou processo não encontrado'
    };
  }

  /**
   * Busca apenas movimentações recentes de um processo
   */
  async getRecentMovements(
    processNumber: string,
    lastSync?: Date
  ): Promise<ProcessMovement[]> {
    const params: ProcessSearchParams = {
      processNumber,
      includeMovements: true,
      maxMovements: 50
    };

    const result = await this.searchProcess(params);
    if (!result.success || !result.data) {
      return [];
    }

    let movements = result.data.movements;

    // Filtrar apenas movimentações após a última sincronização
    if (lastSync) {
      movements = movements.filter(m => m.date > lastSync);
    }

    return movements;
  }

  // ================================
  // IMPLEMENTAÇÃO JUDIT API
  // ================================

  private async searchJuditApi(params: ProcessSearchParams): Promise<ProcessApiResponse> {
    if (!this.config.judit?.enabled || !this.config.judit.apiKey) {
      throw new Error('Judit API não configurada');
    }

    const url = `${this.config.judit.baseUrl}/consulta/processo`;
    const headers = {
      'Authorization': `Bearer ${this.config.judit.apiKey}`,
      'Content-Type': 'application/json'
    };

    const body = {
      numero_processo: params.processNumber,
      tribunal: params.court,
      incluir_movimentacoes: params.includeMovements ?? true,
      incluir_partes: params.includeParties ?? true,
      max_movimentacoes: params.maxMovements ?? 100
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Judit API Error: ${response.status} ${response.statusText}`);
    }

    const apiData = await response.json();

    return {
      success: true,
      source: 'JUDIT_API',
      data: this.parseJuditResponse(apiData)
    };
  }

  private parseJuditResponse(apiData: any): ProcessData {
    return {
      processNumber: apiData.numero_processo || '',
      court: apiData.tribunal || '',
      subject: apiData.assunto || '',
      value: apiData.valor_causa ? parseFloat(apiData.valor_causa) : undefined,
      distributionDate: apiData.data_distribuicao ? new Date(apiData.data_distribuicao) : undefined,
      status: apiData.situacao || 'ATIVO',

      parties: {
        plaintiffs: (apiData.partes?.requerentes || []).map((p: any) => ({
          name: p.nome || '',
          document: p.documento || '',
          type: 'PLAINTIFF' as const,
          address: p.endereco
        })),
        defendants: (apiData.partes?.requeridos || []).map((p: any) => ({
          name: p.nome || '',
          document: p.documento || '',
          type: 'DEFENDANT' as const,
          address: p.endereco
        })),
        lawyers: (apiData.advogados || []).map((a: any) => ({
          name: a.nome || '',
          oabNumber: a.oab_numero || '',
          oabState: a.oab_uf || '',
          represents: a.representa || ''
        }))
      },

      movements: (apiData.movimentacoes || []).map((m: any) => ({
        date: new Date(m.data),
        type: m.tipo || '',
        description: m.descricao || '',
        category: this.categorizeMovement(m.tipo, m.descricao),
        importance: this.assessMovementImportance(m.tipo, m.descricao),
        requiresAction: this.requiresAction(m.tipo, m.descricao),
        deadline: m.prazo ? new Date(m.prazo) : undefined
      })),

      lastUpdate: new Date(),
      dataSource: 'JUDIT_API',
      consultationId: apiData.consulta_id || `judit_${Date.now()}`
    };
  }


  // ================================
  // UTILITÁRIOS DE ANÁLISE
  // ================================

  private categorizeMovement(type: string, description: string): MovementCategory {
    const typeUpper = type.toUpperCase();
    const descUpper = description.toUpperCase();

    if (typeUpper.includes('AUDIÊNCIA') || descUpper.includes('AUDIÊNCIA')) return 'HEARING';
    if (typeUpper.includes('SENTENÇA') || descUpper.includes('SENTENÇA')) return 'DECISION';
    if (typeUpper.includes('PETIÇÃO') || descUpper.includes('PETIÇÃO')) return 'PETITION';
    if (typeUpper.includes('PRAZO') || descUpper.includes('PRAZO')) return 'DEADLINE';
    if (typeUpper.includes('CITAÇÃO') || descUpper.includes('CITAÇÃO')) return 'NOTIFICATION';
    if (typeUpper.includes('RECURSO') || descUpper.includes('RECURSO')) return 'APPEAL';
    if (typeUpper.includes('ACORDO') || descUpper.includes('ACORDO')) return 'SETTLEMENT';

    return 'OTHER';
  }

  private assessMovementImportance(type: string, description: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' {
    const urgent = ['SENTENÇA', 'DECISÃO', 'PRAZO FATAL', 'CITAÇÃO URGENTE'];
    const high = ['AUDIÊNCIA', 'PRAZO', 'RECURSO', 'EXECUÇÃO'];
    const medium = ['PETIÇÃO', 'JUNTADA', 'VISTA'];

    const text = `${type} ${description}`.toUpperCase();

    if (urgent.some(keyword => text.includes(keyword))) return 'URGENT';
    if (high.some(keyword => text.includes(keyword))) return 'HIGH';
    if (medium.some(keyword => text.includes(keyword))) return 'MEDIUM';

    return 'LOW';
  }

  private requiresAction(type: string, description: string): boolean {
    const actionKeywords = [
      'PRAZO PARA',
      'INTIMAÇÃO',
      'CITAÇÃO',
      'AUDIÊNCIA',
      'MANIFESTAÇÃO',
      'CONTRARRAZÕES',
      'RECURSO',
      'IMPUGNAÇÃO'
    ];

    const text = `${type} ${description}`.toUpperCase();
    return actionKeywords.some(keyword => text.includes(keyword));
  }

  // ================================
  // CACHE MANAGEMENT
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
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Limpa o cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Retorna estatísticas do cache
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// ================================
// FACTORY E CONFIGURAÇÃO
// ================================

/**
 * Cria uma instância do cliente configurada com as variáveis de ambiente
 */
export function createProcessApiClient(): ProcessApiClient {
  const config: ProcessApiConfig = {
    judit: {
      baseUrl: process.env.JUDIT_API_URL || 'https://api.judit.com.br',
      apiKey: process.env.JUDIT_API_KEY || '',
      enabled: !!process.env.JUDIT_API_KEY
    }
  };

  return new ProcessApiClient(config);
}

// ================================
// UTILITÁRIOS AUXILIARES
// ================================

/**
 * Normaliza número de processo para formato CNJ
 */
export function normalizeProcessNumber(processNumber: string): string {
  // Remove todos os caracteres não numéricos
  const digits = processNumber.replace(/\D/g, '');

  // Formato CNJ: NNNNNNN-DD.AAAA.J.TR.OOOO
  if (digits.length === 20) {
    return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16, 20)}`;
  }

  // Retorna como estava se não conseguir formatar
  return processNumber;
}

/**
 * Valida se o número de processo está no formato correto
 */
export function validateProcessNumber(processNumber: string): boolean {
  const normalized = normalizeProcessNumber(processNumber);
  // Regex para formato CNJ
  const cnjRegex = /^\d{7}-\d{2}\.\d{4}\.\d{1}\.\d{2}\.\d{4}$/;
  return cnjRegex.test(normalized);
}

/**
 * Extrai o tribunal do número do processo
 */
export function extractCourtFromProcessNumber(processNumber: string): string {
  const normalized = normalizeProcessNumber(processNumber);
  const match = normalized.match(/^\d{7}-\d{2}\.\d{4}\.\d{1}\.(\d{2})\.\d{4}$/);

  if (!match) return '';

  const tribunalCode = match[1];

  // Mapeamento básico de códigos de tribunal
  const tribunals: Record<string, string> = {
    '01': 'STF',
    '02': 'CNJ',
    '03': 'STJ',
    '04': 'CSM',
    '05': 'STM',
    '06': 'TST',
    '07': 'TSE',
    '08': 'TRF1',
    '09': 'TRF2',
    '10': 'TRF3',
    '11': 'TRF4',
    '12': 'TRF5',
    '13': 'TJAC',
    '14': 'TJAL',
    '15': 'TJAP',
    '16': 'TJAM',
    '17': 'TJBA',
    '18': 'TJCE',
    '19': 'TJDFT',
    '20': 'TJES',
    '21': 'TJGO',
    '22': 'TJMA',
    '23': 'TJMT',
    '24': 'TJMS',
    '25': 'TJMG',
    '26': 'TJPA',
    '27': 'TJPB',
    '28': 'TJPR',
    '29': 'TJPE',
    '30': 'TJPI',
    '31': 'TJRJ',
    '32': 'TJRN',
    '33': 'TJRS',
    '34': 'TJRO',
    '35': 'TJRR',
    '36': 'TJSC',
    '37': 'TJSP',
    '38': 'TJSE',
    '39': 'TJTO'
  };

  return tribunals[tribunalCode] || `Tribunal ${tribunalCode}`;
}