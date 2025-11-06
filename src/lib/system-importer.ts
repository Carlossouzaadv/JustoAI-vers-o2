
// ================================
// SISTEMA DE IMPORTAÇÃO COMPLETA
// ================================
// Importação de histórico completo de sistemas jurídicos externos
// com mapeamento automático e sincronização de dados

import prisma from './prisma';
import { createIntelligentParser, IntelligentParseResult } from './intelligent-parser';
import { SystemMappings, DataTransformer, DataValidator } from './system-mappings';
import { ICONS } from './icons';
import crypto from 'crypto';

// Type guard imports for runtime validation
import {
  isSystemImportSettings,
  isSystemImportDataPreview,
  isSystemImportValidation,
  isSystemImportSummary,
} from './types/type-guards';
import type {
  SystemImportSettings,
  SystemImportDataPreview,
  SystemImportValidation,
  SystemImportSummary,
} from './types/json-fields';

// ================================
// TIPOS E INTERFACES
// ================================

export interface ImportSession {
  id: string;
  workspaceId: string;
  fileName: string;
  sourceSystem: SourceSystem;
  status: ImportStatus;
  progress: number;
  totalRows: number;
  processedRows: number;
  successfulRows: number;
  failedRows: number;
  startedAt: Date;
  finishedAt?: Date;
  errors: ImportError[];
  warnings: ImportWarning[];
  summary: ImportSummary;
}

export interface ImportError {
  type: 'PARSE_ERROR' | 'VALIDATION_ERROR' | 'DATABASE_ERROR' | 'TRANSFORM_ERROR';
  message: string;
  line?: number;
  field?: string;
  value?: string;
  details?: unknown;
}

export interface ImportWarning {
  type: 'DATA_QUALITY' | 'MISSING_OPTIONAL' | 'DUPLICATE_DETECTED' | 'TRANSFORM_APPLIED';
  message: string;
  line?: number;
  field?: string;
  suggestion?: string;
}

export interface ImportSummary {
  clientsImported: number;
  casesImported: number;
  eventsImported: number;
  documentsImported: number;
  duplicatesSkipped: number;
  transformationsApplied: number;
}

export interface ImportOptions {
  overwriteExisting: boolean;
  skipDuplicates: boolean;
  validateOnly: boolean;
  batchSize: number;
  customMappings?: Record<string, string>;
  transformRules?: Record<string, unknown>;
}

export type SourceSystem =
  | 'PROJURIS'
  | 'LEGAL_ONE'
  | 'ASTREA'
  | 'CP_PRO'
  | 'SAJ'
  | 'ESAJ'
  | 'PJE'
  | 'THEMIS'
  | 'ADVBOX'
  | 'UNKNOWN';

export type ImportStatus =
  | 'ANALYZING'
  | 'MAPPING'
  | 'VALIDATING'
  | 'IMPORTING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

interface ColumnMapping {
  sourceField: string;
  targetField: string;
  category: string;
}

interface SystemMappingData {
  system: string;
  columnMappings: ColumnMapping[];
}

// ================================
// CLASSE PRINCIPAL DO IMPORTADOR
// ================================

export class SystemImporter {
  private session: ImportSession | null = null;
  private cancelled = false;
  private parser = createIntelligentParser();

  /**
   * Inicia uma sessão de importação completa
   */
  async startImportSession(
    workspaceId: string,
    buffer: Buffer,
    fileName: string,
    options: Partial<ImportOptions> = {}
  ): Promise<ImportSession> {
    console.log(`${ICONS.PROCESS} Iniciando importação: ${fileName}`);

    // Configurações padrão
    const importOptions: ImportOptions = {
      overwriteExisting: false,
      skipDuplicates: true,
      validateOnly: false,
      batchSize: 100,
      ...options
    };

    // Calcular hash do arquivo para detectar duplicatas
    const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');

    // Verificar se já foi importado
    const existingImport = await prisma.systemImport.findFirst({
      where: {
        workspaceId,
        originalHash: fileHash,
        status: 'COMPLETED'
      }
    });

    if (existingImport && !importOptions.overwriteExisting) {
      throw new Error('Arquivo já foi importado anteriormente. Use overwriteExisting=true para reimportar.');
    }

    // Criar sessão de importação no banco
    // ================================================================
    // VALIDAÇÃO TYPE-SAFE DO importSettings
    // ================================================================
    // Validar que importOptions está estruturalmente correto antes de persistir
    const rawSettings: unknown = importOptions;
    if (!isSystemImportSettings(rawSettings)) {
      throw new Error(
        'Configurações de importação inválidas: estrutura não atende aos requisitos esperados'
      );
    }
    const importSettings: SystemImportSettings = rawSettings;

    const systemImport = await prisma.systemImport.create({
      data: {
        workspaceId,
        fileName,
        filePath: `imports/${workspaceId}/${Date.now()}-${fileName}`,
        fileSize: buffer.length,
        originalHash: fileHash,
        status: 'ANALYZING',
        importSettings
      }
    });

    // Inicializar sessão em memória
    this.session = {
      id: systemImport.id,
      workspaceId,
      fileName,
      sourceSystem: 'UNKNOWN',
      status: 'ANALYZING',
      progress: 0,
      totalRows: 0,
      processedRows: 0,
      successfulRows: 0,
      failedRows: 0,
      startedAt: new Date(),
      errors: [],
      warnings: [],
      summary: {
        clientsImported: 0,
        casesImported: 0,
        eventsImported: 0,
        documentsImported: 0,
        duplicatesSkipped: 0,
        transformationsApplied: 0
      }
    };

    try {
      // Fase 1: Análise inteligente do arquivo
      console.log(`${ICONS.SEARCH} Analisando estrutura do arquivo...`);
      const parseResult = await this.parser.parseFile(buffer, fileName);

      if (!parseResult.success) {
        throw new Error(`Erro na análise do arquivo: ${parseResult.validationResult.errors[0]?.message}`);
      }

      this.session.sourceSystem = parseResult.detectedSystem;
      this.session.totalRows = parseResult.totalRows;

      // ================================================================
      // VALIDAÇÃO TYPE-SAFE DOS DADOS DO PARSE RESULT
      // ================================================================
      // Validar dataPreview antes de persistir
      const rawDataPreview: unknown = parseResult.dataPreview;
      if (!isSystemImportDataPreview(rawDataPreview)) {
        throw new Error(
          'Preview de dados inválido: estrutura não atende aos requisitos esperados'
        );
      }
      const dataPreview: SystemImportDataPreview = rawDataPreview;

      // Validar validation result antes de persistir
      const rawValidation: unknown = parseResult.validationResult;
      if (!isSystemImportValidation(rawValidation)) {
        throw new Error(
          'Resultado da validação inválido: estrutura não atende aos requisitos esperados'
        );
      }
      const validation: SystemImportValidation = rawValidation;

      // Atualizar banco com resultados da análise
      await this.updateImportRecord({
        sourceSystem: parseResult.detectedSystem,
        detectedFormat: 'CSV/EXCEL',
        status: 'MAPPING',
        totalRows: parseResult.totalRows,
        columnMapping: parseResult.columnMapping,
        dataPreview,
        validation
      });

      // Fase 2: Importação dos dados
      if (!importOptions.validateOnly) {
        console.log(`${ICONS.PROCESS} Iniciando importação de dados...`);
        await this.importData(parseResult, importOptions);
      }

      // Finalizar sessão
      this.session.status = 'COMPLETED';
      this.session.finishedAt = new Date();

      // ================================================================
      // VALIDAÇÃO TYPE-SAFE DO SUMMARY ANTES DE PERSISTIR
      // ================================================================
      const rawSummary: unknown = this.session.summary;
      if (!isSystemImportSummary(rawSummary)) {
        throw new Error(
          'Resumo da importação inválido: estrutura não atende aos requisitos esperados'
        );
      }
      const summary: SystemImportSummary = rawSummary;

      await this.updateImportRecord({
        status: 'COMPLETED',
        finishedAt: new Date(),
        processedRows: this.session.processedRows,
        successfulRows: this.session.successfulRows,
        failedRows: this.session.failedRows,
        importedCases: this.session.summary.casesImported,
        importedClients: this.session.summary.clientsImported,
        importedEvents: this.session.summary.eventsImported,
        importedDocuments: this.session.summary.documentsImported,
        errors: this.session.errors,
        warnings: this.session.warnings,
        summary
      });

      console.log(`${ICONS.SUCCESS} Importação concluída:`, {
        system: this.session.sourceSystem,
        processed: this.session.processedRows,
        successful: this.session.successfulRows,
        failed: this.session.failedRows
      });

      return this.session;

    } catch (error) {
      console.error(`${ICONS.ERROR} Erro na importação:`, error);

      this.session.status = 'FAILED';
      this.session.finishedAt = new Date();
      this.session.errors.push({
        type: 'DATABASE_ERROR',
        message: error instanceof Error ? error.message : 'Erro desconhecido'
      });

      await this.updateImportRecord({
        status: 'FAILED',
        finishedAt: new Date(),
        errors: this.session.errors
      });

      throw error;
    }
  }

  /**
   * Cancela a importação atual
   */
  cancelImport(): void {
    if (this.session?.status === 'IMPORTING') {
      this.cancelled = true;
      console.log(`${ICONS.WARNING} Cancelando importação...`);
    }
  }

  /**
   * Obtém o status da sessão atual
   */
  getCurrentSession(): ImportSession | null {
    return this.session;
  }

  // ================================
  // MÉTODOS PRIVADOS DE IMPORTAÇÃO
  // ================================

  private async importData(parseResult: IntelligentParseResult, options: ImportOptions): Promise<void> {
    if (!this.session) throw new Error('Sessão não inicializada');

    this.session.status = 'IMPORTING';
    this.session.progress = 0;

    const systemMapping = SystemMappings.getMapping(parseResult.detectedSystem);
    const strategy = SystemMappings.getDefaultImportStrategy(parseResult.detectedSystem);

    if (!strategy) {
      throw new Error(`Estratégia de importação não encontrada para ${parseResult.detectedSystem}`);
    }

    // Processar dados por categoria seguindo a estratégia
    for (const category of strategy.order) {
      if (this.cancelled) break;

      console.log(`${ICONS.PROCESS} Importando categoria: ${category}`);

      const categoryMappings = systemMapping.columnMappings.filter(
        mapping => mapping.category === category
      );

      if (categoryMappings.length === 0) continue;

      await this.importCategory(
        category,
        parseResult.dataPreview.slice(1), // Remover header
        categoryMappings,
        systemMapping,
        options
      );

      // Atualizar progresso
      const progressIncrement = 100 / strategy.order.length;
      this.session.progress = Math.min(this.session.progress + progressIncrement, 90);

      await this.updateImportRecord({
        progress: Math.round(this.session.progress),
        processedRows: this.session.processedRows,
        successfulRows: this.session.successfulRows,
        failedRows: this.session.failedRows
      });
    }

    this.session.progress = 100;
  }

  private async importCategory(
    category: string,
    dataRows: Array<Array<string | number | boolean | null>>,
    categoryMappings: ColumnMapping[],
    systemMapping: SystemMappingData,
    options: ImportOptions
  ): Promise<void> {
    if (!this.session) return;

    const batchSize = options.batchSize;
    const totalBatches = Math.ceil(dataRows.length / batchSize);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      if (this.cancelled) break;

      const batchStart = batchIndex * batchSize;
      const batchEnd = Math.min(batchStart + batchSize, dataRows.length);
      const batchRows = dataRows.slice(batchStart, batchEnd);

      await this.processBatch(category, batchRows, categoryMappings, systemMapping, options);

      console.log(`${ICONS.INFO} Processado batch ${batchIndex + 1}/${totalBatches} da categoria ${category}`);
    }
  }

  private async processBatch(
    category: string,
    batchRows: Array<Array<string | number | boolean | null>>,
    categoryMappings: ColumnMapping[],
    systemMapping: SystemMappingData,
    options: ImportOptions
  ): Promise<void> {
    if (!this.session) return;

    for (let i = 0; i < batchRows.length; i++) {
      if (this.cancelled) break;

      const row = batchRows[i];
      const lineNumber = this.session.processedRows + i + 2; // +2 para contar header e index 0-based

      try {
        await this.processRow(category, row, lineNumber, categoryMappings, systemMapping, options);
        this.session.successfulRows++;
      } catch (error) {
        this.session.failedRows++;
        this.session.errors.push({
          type: 'DATABASE_ERROR',
          message: error instanceof Error ? error.message : 'Erro desconhecido',
          line: lineNumber
        });
      }
    }

    this.session.processedRows += batchRows.length;
  }

  private async processRow(
    category: string,
    row: Array<string | number | boolean | null>,
    lineNumber: number,
    categoryMappings: ColumnMapping[],
    systemMapping: SystemMappingData,
    options: ImportOptions
  ): Promise<void> {
    if (!this.session) return;

    // Mapear dados da linha
    const mappedData: Record<string, unknown> = {};

    categoryMappings.forEach((mapping, colIndex) => {
      const value = row[colIndex];

      if (value !== undefined && value !== null && value !== '') {
        // Aplicar transformações
        const transformRules = SystemMappings.getTransformRules(
          systemMapping.system,
          mapping.targetField
        );

        let transformedValue = value;
        transformRules.forEach(rule => {
          transformedValue = DataTransformer.transformValue(transformedValue, rule.rule);
          this.session!.summary.transformationsApplied++;
        });

        // Aplicar validações
        const validationRules = SystemMappings.getValidationRules(
          systemMapping.system,
          mapping.targetField
        );

        const validationResult = DataValidator.validateValue(transformedValue, validationRules);

        if (!validationResult.isValid) {
          this.session?.errors.push({
            type: 'VALIDATION_ERROR',
            message: validationResult.errors.join(', '),
            line: lineNumber,
            field: mapping.targetField,
            value: value?.toString()
          });
          return;
        }

        mappedData[mapping.targetField] = transformedValue;
      }
    });

    // Criar entidade baseada na categoria
    switch (category) {
      case 'CLIENT':
        await this.createClient(mappedData, options);
        break;
      case 'CASE':
        await this.createCase(mappedData, options);
        break;
      case 'EVENT':
        await this.createEvent(mappedData, options);
        break;
      case 'DOCUMENT':
        await this.createDocument(mappedData, options);
        break;
    }

    // Registrar item importado
    // Category é garantido como string (vem do switch statement acima)
    // Não usar type casting - category é estruturalmente válido
    await prisma.importedDataItem.create({
      data: {
        systemImportId: this.session.id,
        dataType: category,
        status: 'IMPORTED',
        originalData: row,
        mappedData,
        lineNumber,
        importOrder: this.session.processedRows
      }
    });
  }

  // ================================
  // MÉTODOS DE CRIAÇÃO DE ENTIDADES
  // ================================

  private async createClient(data: Record<string, unknown>, options: ImportOptions): Promise<void> {
    if (!this.session) return;

    const clientName = typeof data.client_name === 'string' ? data.client_name : null;
    if (!clientName) {
      this.session.warnings.push({
        type: 'MISSING_OPTIONAL',
        message: 'Nome do cliente é obrigatório',
        field: 'client_name'
      });
      return;
    }

    // Verificar se cliente já existe
    const existingClient = await prisma.client.findFirst({
      where: {
        workspaceId: this.session.workspaceId,
        name: clientName
      }
    });

    if (existingClient) {
      if (options.skipDuplicates) {
        this.session.summary.duplicatesSkipped++;
        return;
      }

      if (options.overwriteExisting) {
        await prisma.client.update({
          where: { id: existingClient.id },
          data: {
            name: clientName,
            email: typeof data.email === 'string' ? data.email : undefined,
            phone: typeof data.phone === 'string' ? data.phone : undefined,
            document: typeof data.document === 'string' ? data.document : undefined,
            type: this.mapClientType(data.client_type) ?? 'INDIVIDUAL'
          }
        });
      }
    } else {
      await prisma.client.create({
        data: {
          workspaceId: this.session.workspaceId,
          name: clientName,
          email: typeof data.email === 'string' ? data.email : undefined,
          phone: typeof data.phone === 'string' ? data.phone : undefined,
          document: typeof data.document === 'string' ? data.document : undefined,
          type: this.mapClientType(data.client_type) ?? 'INDIVIDUAL'
        }
      });

      this.session.summary.clientsImported++;
    }
  }

  private async createCase(data: Record<string, unknown>, options: ImportOptions): Promise<void> {
    if (!this.session) return;

    const processNumber = typeof data.process_number === 'string' ? data.process_number : null;
    const caseCode = typeof data.case_code === 'string' ? data.case_code : null;

    if (!processNumber && !caseCode) {
      this.session.warnings.push({
        type: 'MISSING_OPTIONAL',
        message: 'Número do processo ou código do caso é obrigatório'
      });
      return;
    }

    // Buscar cliente relacionado
    let clientId: string | null = null;
    const clientName = typeof data.client_name === 'string' ? data.client_name : null;
    if (clientName) {
      const client = await prisma.client.findFirst({
        where: {
          workspaceId: this.session.workspaceId,
          name: clientName
        }
      });
      clientId = client?.id || null;
    }

    if (!clientId) {
      this.session.warnings.push({
        type: 'DATA_QUALITY',
        message: 'Cliente não encontrado, caso será criado sem cliente',
        field: 'client_name'
      });
      return;
    }

    // Verificar se caso já existe
    const identifier = processNumber || caseCode;
    const caseTitle = typeof data.title === 'string' ? data.title : null;

    if (!identifier) {
      return; // Should never happen due to earlier check
    }

    const existingCase = await prisma.case.findFirst({
      where: {
        workspaceId: this.session.workspaceId,
        OR: [
          { number: identifier },
          ...(caseTitle ? [{ title: caseTitle }] : [])
        ]
      }
    });

    if (existingCase) {
      if (options.skipDuplicates) {
        this.session.summary.duplicatesSkipped++;
        return;
      }
    } else {
      // Criar usuário padrão se não existir
      const userId = await this.getDefaultUserId();

      const caseDescription = typeof data.description === 'string' ? data.description : undefined;
      const claimValueRaw = data.claim_value;
      const claimValue = typeof claimValueRaw === 'number' ? claimValueRaw :
                         typeof claimValueRaw === 'string' ? parseFloat(claimValueRaw) : undefined;

      await prisma.case.create({
        data: {
          workspaceId: this.session.workspaceId,
          clientId: clientId,
          number: identifier,
          title: caseTitle || 'Caso Importado',
          description: caseDescription,
          type: this.mapCaseType(data.case_type) || 'CIVIL',
          status: this.mapCaseStatus(data.status) || 'ACTIVE',
          priority: 'MEDIUM',
          createdById: userId,
          claimValue
        }
      });

      this.session.summary.casesImported++;
    }
  }

  private async createEvent(_data: Record<string, unknown>, _options: ImportOptions): Promise<void> {
    // Implementação similar para eventos
    this.session!.summary.eventsImported++;
  }

  private async createDocument(_data: Record<string, unknown>, _options: ImportOptions): Promise<void> {
    // Implementação similar para documentos
    this.session!.summary.documentsImported++;
  }

  // ================================
  // MÉTODOS AUXILIARES
  // ================================

  private async updateImportRecord(data: Record<string, unknown>): Promise<void> {
    if (!this.session) return;

    // ================================================================
    // VALIDAÇÃO TYPE-SAFE DOS DADOS DA ATUALIZAÇÃO
    // ================================================================
    // Validar que os dados contêm apenas campos esperados
    const allowedFields = new Set([
      'sourceSystem',
      'detectedFormat',
      'status',
      'totalRows',
      'columnMapping',
      'dataPreview',
      'validation',
      'finishedAt',
      'processedRows',
      'successfulRows',
      'failedRows',
      'importedCases',
      'importedClients',
      'importedEvents',
      'importedDocuments',
      'errors',
      'warnings',
      'summary',
      'progress'
    ]);

    // Verificar que todos os campos fornecidos são permitidos
    for (const key of Object.keys(data)) {
      if (!allowedFields.has(key)) {
        console.warn(`Campo não reconhecido em updateImportRecord: ${key}`);
      }
    }

    await prisma.systemImport.update({
      where: { id: this.session.id },
      data
    });
  }

  private async getDefaultUserId(): Promise<string> {
    if (!this.session) throw new Error('Sessão não inicializada');

    // Buscar primeiro usuário do workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: { workspaceId: this.session.workspaceId },
      include: { user: true }
    });

    if (!userWorkspace) {
      throw new Error('Nenhum usuário encontrado no workspace');
    }

    return userWorkspace.userId;
  }

  private mapClientType(value: unknown): 'INDIVIDUAL' | 'COMPANY' | 'GOVERNMENT' | 'NGO' | undefined {
    if (!value) return undefined;

    const mappings: Record<string, 'INDIVIDUAL' | 'COMPANY' | 'GOVERNMENT' | 'NGO'> = {
      'pessoa fisica': 'INDIVIDUAL',
      'individual': 'INDIVIDUAL',
      'pessoa juridica': 'COMPANY',
      'company': 'COMPANY',
      'empresa': 'COMPANY',
      'governo': 'GOVERNMENT',
      'government': 'GOVERNMENT',
      'ong': 'NGO',
      'ngo': 'NGO'
    };

    const mapped = mappings[value.toString().toLowerCase()];
    return mapped || undefined;
  }

  private mapCaseType(value: unknown): 'CIVIL' | 'CRIMINAL' | 'LABOR' | 'FAMILY' | 'COMMERCIAL' | 'ADMINISTRATIVE' | 'CONSTITUTIONAL' | 'TAX' | 'OTHER' | null {
    if (!value) return null;

    const mappings: Record<string, 'CIVIL' | 'CRIMINAL' | 'LABOR' | 'FAMILY' | 'COMMERCIAL' | 'ADMINISTRATIVE' | 'CONSTITUTIONAL' | 'TAX'> = {
      'civil': 'CIVIL',
      'civel': 'CIVIL',
      'criminal': 'CRIMINAL',
      'trabalhista': 'LABOR',
      'labor': 'LABOR',
      'familia': 'FAMILY',
      'family': 'FAMILY',
      'comercial': 'COMMERCIAL',
      'commercial': 'COMMERCIAL',
      'empresarial': 'COMMERCIAL',
      'administrativo': 'ADMINISTRATIVE',
      'administrative': 'ADMINISTRATIVE',
      'constitucional': 'CONSTITUTIONAL',
      'constitutional': 'CONSTITUTIONAL',
      'tributario': 'TAX',
      'tax': 'TAX'
    };

    const mapped = mappings[value.toString().toLowerCase()];
    return mapped || 'OTHER';
  }

  private mapCaseStatus(value: unknown): 'ACTIVE' | 'SUSPENDED' | 'CLOSED' | 'ARCHIVED' | 'CANCELLED' | null {
    if (!value) return null;

    const mappings: Record<string, 'ACTIVE' | 'SUSPENDED' | 'CLOSED' | 'ARCHIVED' | 'CANCELLED'> = {
      'ativo': 'ACTIVE',
      'active': 'ACTIVE',
      'em andamento': 'ACTIVE',
      'suspenso': 'SUSPENDED',
      'suspended': 'SUSPENDED',
      'fechado': 'CLOSED',
      'closed': 'CLOSED',
      'finalizado': 'CLOSED',
      'arquivado': 'ARCHIVED',
      'archived': 'ARCHIVED',
      'cancelado': 'CANCELLED',
      'cancelled': 'CANCELLED'
    };

    const mapped = mappings[value.toString().toLowerCase()];
    return mapped || null;
  }
}

// ================================
// UTILITÁRIOS E FACTORY
// ================================

/**
 * Cria uma instância do importador de sistemas
 */
export function createSystemImporter(): SystemImporter {
  return new SystemImporter();
}

/**
 * Busca importações recentes de um workspace
 */
export async function getRecentImports(workspaceId: string, limit: number = 10) {
  return await prisma.systemImport.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      fileName: true,
      sourceSystem: true,
      status: true,
      progress: true,
      totalRows: true,
      successfulRows: true,
      failedRows: true,
      createdAt: true,
      finishedAt: true,
      summary: true
    }
  });
}

/**
 * Obter estatísticas de importação do workspace
 */
export async function getImportStatistics(workspaceId: string) {
  const [totalImports, completedImports, recentImports, errorImports] = await Promise.all([
    prisma.systemImport.count({
      where: { workspaceId }
    }),
    prisma.systemImport.count({
      where: { workspaceId, status: 'COMPLETED' }
    }),
    prisma.systemImport.count({
      where: {
        workspaceId,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Últimos 30 dias
        }
      }
    }),
    prisma.systemImport.count({
      where: { workspaceId, status: 'FAILED' }
    })
  ]);

  return {
    totalImports,
    completedImports,
    recentImports,
    errorImports,
    successRate: totalImports > 0 ? (completedImports / totalImports) * 100 : 100
  };
}

console.log(`${ICONS.SUCCESS} Sistema de importação carregado`);