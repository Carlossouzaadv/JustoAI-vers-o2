// ================================
// INTEGRAÇÃO COM APIS DE PROCESSOS
// ================================
// Sistema unificado para consulta de processos jurídicos
// via Judit API, Codilo API e outras fontes

import { ICONS } from './icons';
import { log, logError } from '@/lib/services/logger';

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
  _error?: string;
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
// TYPE GUARDS E HELPERS
// ================================

/**
 * Interface para dados de movimentação da API (antes de validação)
 */
interface MovementRawData {
  data?: unknown;
  tipo?: unknown;
  descricao?: unknown;
  prazo?: unknown;
}

/**
 * Type guard para validar dados de movimentação
 * Garante que propriedades críticas existem e são do tipo correto
 */
function isMovementData(data: unknown): data is MovementRawData {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const obj = data as Record<string, unknown>;

  // Validar que pelo menos 'data' e 'tipo' existem
  // Outras propriedades podem ser undefined, será tratado pelos helpers
  if (obj.data === undefined || obj.tipo === undefined) {
    return false;
  }

  return true;
}

/**
 * Helper para extrair string com segurança
 * Retorna string vazia se valor for unknown ou não-string
 */
function getMovementString(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  return '';
}

/**
 * Helper para extrair Date com segurança
 * Retorna undefined se valor não puder ser convertido
 */
function getMovementDate(value: unknown): Date | undefined {
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    // Validar que Date é válido
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  return undefined;
}

/**
 * Helper para extrair string segura da consulta ID
 */
function getConsultationId(value: unknown, fallback: string): string {
  if (typeof value === 'string') {
    return value;
  }
  return fallback;
}

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
        logError(_error, '${ICONS.ERROR} Erro na Judit API:', { component: 'refactored' });
      }
    }

    // Sem APIs de fallback disponíveis

    return {
      success: false,
      source: 'JUDIT_API',
      _error: 'Nenhuma API disponível ou processo não encontrado'
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

  private parseJuditResponse(apiData: Record<string, unknown>): ProcessData {
    const apiRecord = apiData as Record<string, unknown>;

    // NARROWING SEGURO: Validar array de movimentações com Array.isArray()
    const movimentacoes = apiRecord.movimentacoes; // movimentacoes é unknown
    let safeMovimentacoes: unknown[] = []; // Default seguro

    if (Array.isArray(movimentacoes)) {
      safeMovimentacoes = movimentacoes; // 100% SEGURO após validação
    }

    return {
      processNumber: (apiRecord.numero_processo as string) || '',
      court: (apiRecord.tribunal as string) || '',
      subject: (apiRecord.assunto as string) || '',
      value: apiRecord.valor_causa ? parseFloat(apiRecord.valor_causa as string) : undefined,
      distributionDate: apiRecord.data_distribuicao ? new Date(apiRecord.data_distribuicao as string) : undefined,
      status: (apiRecord.situacao as string) || 'ATIVO',

      parties: {
        plaintiffs: ((apiRecord.partes as Record<string, unknown>)?.requerentes as Record<string, unknown>[] || []).map((p) => ({
          name: (p.nome as string) || '',
          document: (p.documento as string) || '',
          type: 'PLAINTIFF' as const,
          address: p.endereco as string
        })),
        defendants: ((apiRecord.partes as Record<string, unknown>)?.requeridos as Record<string, unknown>[] || []).map((p) => ({
          name: (p.nome as string) || '',
          document: (p.documento as string) || '',
          type: 'DEFENDANT' as const,
          address: p.endereco as string
        })),
        lawyers: ((apiRecord.advogados as Record<string, unknown>[]) || []).map((a) => ({
          name: (a.nome as string) || '',
          oabNumber: (a.oab_numero as string) || '',
          oabState: (a.oab_uf as string) || '',
          represents: (a.representa as string) || ''
        }))
      },

      // NARROWING SEGURO: safeMovimentacoes é validado como array antes
      movements: safeMovimentacoes
        .filter(isMovementData)
        .map((m) => {
          // TypeScript infere que m é MovementRawData após o filter
          const tipo = getMovementString(m.tipo);
          const descricao = getMovementString(m.descricao);
          const data = getMovementDate(m.data);

          return {
            date: data || new Date(), // Fallback para agora se data inválida
            type: tipo,
            description: descricao,
            category: this.categorizeMovement(tipo, descricao),
            importance: this.assessMovementImportance(tipo, descricao),
            requiresAction: this.requiresAction(tipo, descricao),
            deadline: getMovementDate(m.prazo)
          };
        }),

      lastUpdate: new Date(),
      dataSource: 'JUDIT_API',
      // Usar helper seguro para extrair consultationId
      consultationId: getConsultationId(apiData.consulta_id, `judit_${Date.now()}`)
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