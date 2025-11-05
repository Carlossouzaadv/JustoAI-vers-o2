// ================================
// PARSER INTELIGENTE DE SISTEMAS JURÍDICOS
// ================================
// Sistema avançado de detecção automática de colunas e mapeamento de campos
// para importação de dados de sistemas como Projuris, Legal One, Astrea, CP-Pro

import { ICONS } from './icons';

// ================================
// TIPOS E INTERFACES
// ================================

export interface IntelligentParseResult {
  success: boolean;
  detectedSystem: SourceSystem;
  confidence: number; // 0-1

  // Análise do arquivo
  totalRows: number;
  headerRow: number;
  dataPreview: unknown[][];

  // Mapeamento automático
  columnMapping: ColumnMapping[];
  fieldMapping: FieldMapping;

  // Validação
  validationResult: ValidationResult;

  // Recomendações
  recommendations: Recommendation[];

  // Metadados
  fileAnalysis: FileAnalysis;
}

export interface ColumnMapping {
  sourceColumn: string;
  targetField: string;
  confidence: number;
  dataType: DataType;
  sampleValues: string[];
  transformRule?: TransformRule;
}

export interface FieldMapping {
  cases: FieldMap[];
  clients: FieldMap[];
  events: FieldMap[];
  documents: FieldMap[];
  other: FieldMap[];
}

export interface FieldMap {
  field: string;
  sourceColumns: string[];
  required: boolean;
  dataType: DataType;
  transformRule?: TransformRule;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  completeness: number; // Porcentagem de dados válidos
  requiredFieldsCoverage: number;
}

export interface ValidationError {
  type: 'MISSING_REQUIRED' | 'INVALID_FORMAT' | 'DUPLICATE' | 'CONSTRAINT_VIOLATION';
  field: string;
  message: string;
  affectedRows: number[];
  samples?: string[];
}

export interface ValidationWarning {
  type: 'LOW_QUALITY' | 'SUSPICIOUS_DATA' | 'INCONSISTENT_FORMAT' | 'PARTIAL_MATCH';
  field: string;
  message: string;
  affectedRows: number[];
  suggestion?: string;
}

export interface Recommendation {
  type: 'COLUMN_MAPPING' | 'DATA_TRANSFORMATION' | 'VALIDATION_FIX' | 'IMPORT_STRATEGY';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  action?: string;
  autoApplicable?: boolean;
}

export interface FileAnalysis {
  encoding: string;
  delimiter: string;
  hasHeader: boolean;
  estimatedRowCount: number;
  estimatedColumns: number;
  fileFormat: 'CSV' | 'EXCEL' | 'TSV';
  duplicateRows: number;
  emptyRows: number;
}

export interface TransformRule {
  type: 'DATE_FORMAT' | 'CURRENCY' | 'BOOLEAN' | 'SPLIT' | 'CONCAT' | 'REGEX' | 'LOOKUP';
  parameters: Record<string, unknown>;
  description: string;
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

export type DataType =
  | 'STRING'
  | 'NUMBER'
  | 'DATE'
  | 'BOOLEAN'
  | 'EMAIL'
  | 'PHONE'
  | 'CURRENCY'
  | 'DOCUMENT'
  | 'ENUM';

// ================================
// SISTEMA DE DETECÇÃO DE COLUNAS
// ================================

export class IntelligentParser {
  private systemPatterns: SystemPatterns;
  private columnPatterns: ColumnPatterns;

  constructor() {
    this.systemPatterns = new SystemPatterns();
    this.columnPatterns = new ColumnPatterns();
  }

  /**
   * Análise completa de arquivo CSV/Excel
   */
  async parseFile(buffer: Buffer, fileName: string): Promise<IntelligentParseResult> {
    console.log(`${ICONS.PROCESS} Iniciando análise inteligente: ${fileName}`);

    try {
      // 1. Análise básica do arquivo
      const fileAnalysis = await this.analyzeFile(buffer, fileName);

      // 2. Extrair dados estruturados
      const rawData = await this.extractRawData(buffer, fileAnalysis);

      // 3. Detectar sistema de origem
      const systemDetection = this.detectSourceSystem(rawData, fileName);

      // 4. Mapear colunas automaticamente
      const columnMapping = this.mapColumns(rawData, systemDetection.system);

      // 5. Mapear campos para estrutura interna
      const fieldMapping = this.mapFields(columnMapping, systemDetection.system);

      // 6. Validar dados
      const validationResult = this.validateData(rawData, fieldMapping);

      // 7. Gerar recomendações
      const recommendations = this.generateRecommendations(
        systemDetection,
        columnMapping,
        validationResult
      );

      const result: IntelligentParseResult = {
        success: true,
        detectedSystem: systemDetection.system,
        confidence: systemDetection.confidence,
        totalRows: rawData.length - 1, // Excluir header
        headerRow: this.findHeaderRow(rawData),
        dataPreview: rawData.slice(0, 10), // Primeiras 10 linhas
        columnMapping,
        fieldMapping,
        validationResult,
        recommendations,
        fileAnalysis
      };

      console.log(`${ICONS.SUCCESS} Análise concluída: ${result.detectedSystem} (${Math.round(result.confidence * 100)}%)`);
      return result;

    } catch (error) {
      console.error(`${ICONS.ERROR} Erro na análise:`, error);

      return {
        success: false,
        detectedSystem: 'UNKNOWN',
        confidence: 0,
        totalRows: 0,
        headerRow: 0,
        dataPreview: [],
        columnMapping: [],
        fieldMapping: { cases: [], clients: [], events: [], documents: [], other: [] },
        validationResult: {
          isValid: false,
          errors: [{
            type: 'INVALID_FORMAT',
            field: 'file',
            message: `Erro ao processar arquivo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
            affectedRows: []
          }],
          warnings: [],
          completeness: 0,
          requiredFieldsCoverage: 0
        },
        recommendations: [],
        fileAnalysis: {
          encoding: 'unknown',
          delimiter: ',',
          hasHeader: false,
          estimatedRowCount: 0,
          estimatedColumns: 0,
          fileFormat: fileName.toLowerCase().endsWith('.xlsx') ? 'EXCEL' : 'CSV',
          duplicateRows: 0,
          emptyRows: 0
        }
      };
    }
  }

  // ================================
  // MÉTODOS PRIVADOS DE ANÁLISE
  // ================================

  private async analyzeFile(buffer: Buffer, fileName: string): Promise<FileAnalysis> {
    const isExcel = fileName.toLowerCase().endsWith('.xlsx') || fileName.toLowerCase().endsWith('.xls');

    if (isExcel) {
      return this.analyzeExcelFile(buffer);
    } else {
      return this.analyzeCsvFile(buffer);
    }
  }

  private async analyzeExcelFile(buffer: Buffer): Promise<FileAnalysis> {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const data = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
      blankrows: false
    }) as string[][];

    return {
      encoding: 'UTF-8',
      delimiter: ',',
      hasHeader: this.detectHeader(data),
      estimatedRowCount: data.length,
      estimatedColumns: data[0]?.length || 0,
      fileFormat: 'EXCEL',
      duplicateRows: this.countDuplicateRows(data),
      emptyRows: this.countEmptyRows(data)
    };
  }

  private analyzeCsvFile(buffer: Buffer): FileAnalysis {
    const content = buffer.toString('utf-8');
    const lines = content.split('\n').filter(line => line.trim());

    const delimiter = this.detectDelimiter(content);
    const data = lines.map(line => line.split(delimiter));

    return {
      encoding: 'UTF-8',
      delimiter,
      hasHeader: this.detectHeader(data),
      estimatedRowCount: lines.length,
      estimatedColumns: data[0]?.length || 0,
      fileFormat: 'CSV',
      duplicateRows: this.countDuplicateRows(data),
      emptyRows: this.countEmptyRows(data)
    };
  }

  private async extractRawData(buffer: Buffer, fileAnalysis: FileAnalysis): Promise<string[][]> {
    if (fileAnalysis.fileFormat === 'EXCEL') {
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      return XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: '',
        blankrows: false
      }) as string[][];
    } else {
      const content = buffer.toString('utf-8');
      return content.split('\n')
        .filter(line => line.trim())
        .map(line => line.split(fileAnalysis.delimiter));
    }
  }

  private detectSourceSystem(data: string[][], fileName: string): { system: SourceSystem; confidence: number } {
    const headerRow = data[0] || [];
    const fileName_lower = fileName.toLowerCase();

    // Análise por nome do arquivo
    if (fileName_lower.includes('projuris')) {
      return { system: 'PROJURIS', confidence: 0.8 };
    }
    if (fileName_lower.includes('legal') && fileName_lower.includes('one')) {
      return { system: 'LEGAL_ONE', confidence: 0.8 };
    }
    if (fileName_lower.includes('astrea')) {
      return { system: 'ASTREA', confidence: 0.8 };
    }
    if (fileName_lower.includes('cpro') || fileName_lower.includes('cp-pro')) {
      return { system: 'CP_PRO', confidence: 0.8 };
    }

    // Análise por padrões de colunas
    const systemScores = this.systemPatterns.calculateScores(headerRow);

    const bestMatch = Object.entries(systemScores)
      .reduce((best, [system, score]) =>
        score > best.score ? { system: system as SourceSystem, score } : best,
        { system: 'UNKNOWN' as SourceSystem, score: 0 }
      );

    return {
      system: bestMatch.system,
      confidence: Math.min(bestMatch.score, 0.95) // Máximo 95% por padrões
    };
  }

  private mapColumns(data: string[][], sourceSystem: SourceSystem): ColumnMapping[] {
    const headerRow = data[0] || [];
    const sampleRows = data.slice(1, 6); // Primeiras 5 linhas de dados

    return headerRow.map((columnName, index) => {
      const sampleValues = sampleRows.map(row => row[index] || '').filter(Boolean);

      const bestMatch = this.columnPatterns.findBestMatch(
        columnName,
        sampleValues,
        sourceSystem
      );

      return {
        sourceColumn: columnName,
        targetField: bestMatch.field,
        confidence: bestMatch.confidence,
        dataType: bestMatch.dataType,
        sampleValues: sampleValues.slice(0, 3),
        transformRule: bestMatch.transformRule
      };
    });
  }

  private mapFields(columnMapping: ColumnMapping[], sourceSystem: SourceSystem): FieldMapping {
    const result: FieldMapping = {
      cases: [],
      clients: [],
      events: [],
      documents: [],
      other: []
    };

    // Agrupar mapeamentos por categoria
    const fieldGroups = this.systemPatterns.getFieldGroups(sourceSystem);

    Object.entries(fieldGroups).forEach(([category, fields]) => {
      fields.forEach(field => {
        const mappedColumns = columnMapping.filter(
          col => col.targetField === field.name && col.confidence > 0.5
        );

        if (mappedColumns.length > 0) {
          const fieldMap: FieldMap = {
            field: field.name,
            sourceColumns: mappedColumns.map(col => col.sourceColumn),
            required: field.required,
            dataType: field.dataType,
            transformRule: mappedColumns[0]?.transformRule
          };

          (result as unknown)[category].push(fieldMap);
        }
      });
    });

    return result;
  }

  private validateData(data: string[][], fieldMapping: FieldMapping): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    const dataRows = data.slice(1);
    let validRows = 0;

    // Validar dados linha por linha
    dataRows.forEach((row, index) => {
      const lineNumber = index + 2; // +2 para contar header e index 0-based
      let isValidRow = true;

      // Verificar campos obrigatórios
      const allFields = [
        ...fieldMapping.cases,
        ...fieldMapping.clients,
        ...fieldMapping.events,
        ...fieldMapping.documents
      ];

      allFields.forEach(field => {
        if (field.required) {
          const hasValue = field.sourceColumns.some(colName => {
            const colIndex = data[0].indexOf(colName);
            return colIndex >= 0 && row[colIndex] && row[colIndex].trim();
          });

          if (!hasValue) {
            errors.push({
              type: 'MISSING_REQUIRED',
              field: field.field,
              message: `Campo obrigatório '${field.field}' está vazio`,
              affectedRows: [lineNumber]
            });
            isValidRow = false;
          }
        }
      });

      if (isValidRow) {
        validRows++;
      }
    });

    // Verificar cobertura de campos obrigatórios
    const requiredFields = [
      ...fieldMapping.cases,
      ...fieldMapping.clients,
      ...fieldMapping.events,
      ...fieldMapping.documents
    ].filter(f => f.required);

    const coveredFields = requiredFields.filter(field =>
      field.sourceColumns.length > 0
    );

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      completeness: dataRows.length > 0 ? validRows / dataRows.length : 0,
      requiredFieldsCoverage: requiredFields.length > 0 ? coveredFields.length / requiredFields.length : 1
    };
  }

  private generateRecommendations(
    systemDetection: { system: SourceSystem; confidence: number },
    columnMapping: ColumnMapping[],
    validationResult: ValidationResult
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Recomendações baseadas na confiança do sistema
    if (systemDetection.confidence < 0.7) {
      recommendations.push({
        type: 'IMPORT_STRATEGY',
        priority: 'HIGH',
        title: 'Sistema não identificado com certeza',
        description: `Confiança de apenas ${Math.round(systemDetection.confidence * 100)}% na identificação do sistema ${systemDetection.system}`,
        action: 'Revisar mapeamento manual ou verificar se é o formato correto'
      });
    }

    // Recomendações baseadas no mapeamento
    const lowConfidenceColumns = columnMapping.filter(col => col.confidence < 0.5);
    if (lowConfidenceColumns.length > 0) {
      recommendations.push({
        type: 'COLUMN_MAPPING',
        priority: 'MEDIUM',
        title: 'Colunas com mapeamento incerto',
        description: `${lowConfidenceColumns.length} colunas não foram mapeadas com certeza`,
        action: 'Revisar mapeamento das colunas: ' + lowConfidenceColumns.map(c => c.sourceColumn).join(', ')
      });
    }

    // Recomendações baseadas na validação
    if (validationResult.requiredFieldsCoverage < 1) {
      recommendations.push({
        type: 'VALIDATION_FIX',
        priority: 'HIGH',
        title: 'Campos obrigatórios em falta',
        description: `Apenas ${Math.round(validationResult.requiredFieldsCoverage * 100)}% dos campos obrigatórios foram identificados`,
        action: 'Verificar se todas as colunas necessárias estão presentes no arquivo'
      });
    }

    if (validationResult.completeness < 0.8) {
      recommendations.push({
        type: 'DATA_TRANSFORMATION',
        priority: 'MEDIUM',
        title: 'Qualidade dos dados pode ser melhorada',
        description: `Apenas ${Math.round(validationResult.completeness * 100)}% dos dados são válidos`,
        action: 'Considerar limpeza dos dados antes da importação'
      });
    }

    return recommendations;
  }

  // ================================
  // MÉTODOS AUXILIARES
  // ================================

  private detectDelimiter(content: string): string {
    const delimiters = [',', ';', '\t', '|'];
    const sample = content.split('\n').slice(0, 5).join('\n');

    const counts = delimiters.map(delimiter => ({
      delimiter,
      count: (sample.match(new RegExp(`\\${delimiter}`, 'g')) || []).length
    }));

    return counts.reduce((best, current) =>
      current.count > best.count ? current : best
    ).delimiter;
  }

  private detectHeader(data: string[][]): boolean {
    if (data.length < 2) return false;

    const firstRow = data[0];
    const secondRow = data[1];

    // Se a primeira linha tem texto e a segunda tem números, provavelmente é header
    const firstRowHasText = firstRow.some(cell => isNaN(Number(cell)) && cell.trim());
    const secondRowHasNumbers = secondRow.some(cell => !isNaN(Number(cell)) && cell.trim());

    return firstRowHasText && secondRowHasNumbers;
  }

  private findHeaderRow(data: string[][]): number {
    // Por enquanto, assumir que header é sempre linha 0
    // Pode ser melhorado para detectar headers em outras posições
    return 0;
  }

  private countDuplicateRows(data: string[][]): number {
    const seen = new Set();
    let duplicates = 0;

    data.forEach(row => {
      const rowString = row.join('|');
      if (seen.has(rowString)) {
        duplicates++;
      } else {
        seen.add(rowString);
      }
    });

    return duplicates;
  }

  private countEmptyRows(data: string[][]): number {
    return data.filter(row =>
      row.every(cell => !cell || !cell.toString().trim())
    ).length;
  }
}

// ================================
// SISTEMA DE PADRÕES DOS SISTEMAS
// ================================

class SystemPatterns {
  private patterns = {
    PROJURIS: {
      columnPatterns: [
        /numero.*processo/i,
        /codigo.*pasta/i,
        /cliente.*nome/i,
        /codigo.*cliente/i,
        /responsavel/i,
        /comarca/i,
        /vara/i,
        /instancia/i
      ],
      requiredFields: ['numero_processo', 'cliente', 'responsavel']
    },
    LEGAL_ONE: {
      columnPatterns: [
        /processo.*numero/i,
        /client.*name/i,
        /matter.*number/i,
        /responsible.*lawyer/i,
        /court.*name/i,
        /case.*type/i
      ],
      requiredFields: ['process_number', 'client_name', 'lawyer']
    },
    ASTREA: {
      columnPatterns: [
        /cod.*processo/i,
        /numero.*judicial/i,
        /parte.*contraria/i,
        /advogado.*responsavel/i,
        /tribunal/i,
        /status.*processo/i
      ],
      requiredFields: ['codigo_processo', 'numero_judicial', 'advogado']
    },
    CP_PRO: {
      columnPatterns: [
        /id.*caso/i,
        /num.*processo/i,
        /cliente.*razao/i,
        /escritorio/i,
        /prazo/i,
        /situacao/i
      ],
      requiredFields: ['id_caso', 'numero_processo', 'cliente']
    }
  };

  calculateScores(headerRow: string[]): Record<string, number> {
    const scores: Record<string, number> = {};

    Object.entries(this.patterns).forEach(([system, config]) => {
      let score = 0;
      let matches = 0;

      config.columnPatterns.forEach(pattern => {
        const found = headerRow.some(col => pattern.test(col));
        if (found) {
          matches++;
          score += 1 / config.columnPatterns.length;
        }
      });

      // Bonus por ter campos obrigatórios
      const requiredMatches = config.requiredFields.filter(required =>
        headerRow.some(col => col.toLowerCase().includes(required.split('_')[0]))
      ).length;

      score += (requiredMatches / config.requiredFields.length) * 0.3;

      scores[system] = Math.min(score, 1.0);
    });

    return scores;
  }

  getFieldGroups(system: SourceSystem) {
    // Retorna grupos de campos por categoria para cada sistema
    const baseFields = {
      cases: [
        { name: 'process_number', required: true, dataType: 'STRING' as DataType },
        { name: 'title', required: true, dataType: 'STRING' as DataType },
        { name: 'court', required: false, dataType: 'STRING' as DataType },
        { name: 'case_type', required: false, dataType: 'ENUM' as DataType },
        { name: 'status', required: false, dataType: 'ENUM' as DataType }
      ],
      clients: [
        { name: 'name', required: true, dataType: 'STRING' as DataType },
        { name: 'document', required: false, dataType: 'DOCUMENT' as DataType },
        { name: 'email', required: false, dataType: 'EMAIL' as DataType },
        { name: 'phone', required: false, dataType: 'PHONE' as DataType }
      ],
      events: [
        { name: 'date', required: true, dataType: 'DATE' as DataType },
        { name: 'type', required: true, dataType: 'ENUM' as DataType },
        { name: 'description', required: true, dataType: 'STRING' as DataType }
      ],
      documents: [
        { name: 'name', required: true, dataType: 'STRING' as DataType },
        { name: 'type', required: false, dataType: 'ENUM' as DataType },
        { name: 'date', required: false, dataType: 'DATE' as DataType }
      ]
    };

    return baseFields;
  }
}

// ================================
// SISTEMA DE PADRÕES DE COLUNAS
// ================================

class ColumnPatterns {
  private patterns = [
    // Padrões para processos
    {
      patterns: [/numero.*processo/i, /process.*number/i, /cod.*processo/i],
      field: 'process_number',
      dataType: 'STRING' as DataType
    },

    // Padrões para clientes
    {
      patterns: [/cliente.*nome/i, /client.*name/i, /nome.*cliente/i],
      field: 'client_name',
      dataType: 'STRING' as DataType
    },

    // Padrões para datas
    {
      patterns: [/data/i, /date/i, /criado/i, /created/i],
      field: 'date',
      dataType: 'DATE' as DataType,
      transformRule: {
        type: 'DATE_FORMAT' as const,
        parameters: { inputFormat: 'auto' },
        description: 'Converter formato de data'
      }
    },

    // Padrões para valores monetários
    {
      patterns: [/valor/i, /value/i, /amount/i, /preco/i],
      field: 'amount',
      dataType: 'CURRENCY' as DataType,
      transformRule: {
        type: 'CURRENCY' as const,
        parameters: { currency: 'BRL' },
        description: 'Converter formato monetário'
      }
    }
  ];

  findBestMatch(columnName: string, sampleValues: string[], sourceSystem: SourceSystem) {
    let bestMatch = {
      field: 'other',
      confidence: 0,
      dataType: 'STRING' as DataType,
      transformRule: undefined as TransformRule | undefined
    };

    this.patterns.forEach(pattern => {
      const nameMatch = pattern.patterns.some(p => p.test(columnName));

      if (nameMatch) {
        let confidence = 0.8;

        // Aumentar confiança baseado nos dados de exemplo
        if (pattern.dataType === 'DATE' && this.looksLikeDate(sampleValues)) {
          confidence = 0.9;
        } else if (pattern.dataType === 'CURRENCY' && this.looksLikeCurrency(sampleValues)) {
          confidence = 0.9;
        } else if (pattern.dataType === 'STRING' && sampleValues.length > 0) {
          confidence = 0.8;
        }

        if (confidence > bestMatch.confidence) {
          bestMatch = {
            field: pattern.field,
            confidence,
            dataType: pattern.dataType,
            transformRule: pattern.transformRule
          };
        }
      }
    });

    return bestMatch;
  }

  private looksLikeDate(values: string[]): boolean {
    return values.some(value => {
      const dateFormats = [
        /^\d{1,2}\/\d{1,2}\/\d{4}$/,
        /^\d{4}-\d{2}-\d{2}$/,
        /^\d{1,2}-\d{1,2}-\d{4}$/
      ];
      return dateFormats.some(format => format.test(value));
    });
  }

  private looksLikeCurrency(values: string[]): boolean {
    return values.some(value => {
      return /^[R$€$]?\s?\d+[.,]\d{2}$/.test(value.replace(/\s/g, ''));
    });
  }
}

// ================================
// FACTORY E UTILITÁRIOS
// ================================

/**
 * Cria uma instância do parser inteligente
 */
export function createIntelligentParser(): IntelligentParser {
  return new IntelligentParser();
}

/**
 * Utilitário para normalizar nomes de colunas
 */
export function normalizeColumnName(columnName: string): string {
  return columnName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Utilitário para detectar tipo de dado baseado em amostras
 */
export function detectDataType(samples: string[]): DataType {
  if (samples.length === 0) return 'STRING';

  const nonEmpty = samples.filter(s => s && s.trim());
  if (nonEmpty.length === 0) return 'STRING';

  // Testar se é data
  if (nonEmpty.every(value => {
    const dateFormats = [
      /^\d{1,2}\/\d{1,2}\/\d{4}$/,
      /^\d{4}-\d{2}-\d{2}$/,
      /^\d{1,2}-\d{1,2}-\d{4}$/
    ];
    return dateFormats.some(format => format.test(value));
  })) {
    return 'DATE';
  }

  // Testar se é número
  if (nonEmpty.every(value => !isNaN(Number(value.replace(/[,.]/, '.'))))) {
    return 'NUMBER';
  }

  // Testar se é moeda
  if (nonEmpty.every(value => /^[R$€$]?\s?\d+[.,]\d{2}$/.test(value.replace(/\s/g, '')))) {
    return 'CURRENCY';
  }

  // Testar se é email
  if (nonEmpty.every(value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) {
    return 'EMAIL';
  }

  // Testar se é boolean
  const booleanValues = ['sim', 'não', 'yes', 'no', 'true', 'false', '1', '0'];
  if (nonEmpty.every(value => booleanValues.includes(value.toLowerCase()))) {
    return 'BOOLEAN';
  }

  return 'STRING';
}