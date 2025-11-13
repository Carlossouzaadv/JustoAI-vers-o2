// ================================
// PARSER DE EXCEL PARA PROCESSOS
// ================================
// Sistema para upload em lote de processos via arquivo Excel
// com validação rigorosa e relatórios de erro

import { ICONS } from './icons';
import { validateProcessNumber, normalizeProcessNumber } from './process-apis';

// ================================
// TYPE GUARDS E VALIDATORS (Mandato Inegociável)
// ================================

function isFrequencyType(value: unknown): value is 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MANUAL' {
  return value === 'HOURLY' || value === 'DAILY' || value === 'WEEKLY' || value === 'MANUAL';
}

function isValidColumnMapping(key: string): key is keyof typeof EXCEL_TEMPLATE_CONFIG.COLUMN_MAPPING {
  return key in EXCEL_TEMPLATE_CONFIG.COLUMN_MAPPING;
}

// ================================
// TIPOS E INTERFACES
// ================================

export interface ExcelProcessRow {
  linha: number;
  numeroProcesso: string;
  tribunal: string;
  nomeCliente: string;
  observacoes?: string;
  frequenciaSync?: 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MANUAL';
  alertasAtivos?: boolean;
  emailsAlerta?: string[];
}

export interface ExcelParseResult {
  success: boolean;
  totalRows: number;
  validRows: ExcelProcessRow[];
  errors: ExcelRowError[];
  summary: {
    valid: number;
    invalid: number;
    duplicates: number;
    warnings: number;
  };
}

export interface ExcelRowError {
  linha: number;
  campo: string;
  valor: string;
  erro: string;
  tipo: 'ERROR' | 'WARNING';
}

export interface ExcelValidationConfig {
  requiredColumns: string[];
  maxRows: number;
  allowDuplicates: boolean;
  strictProcessNumberValidation: boolean;
}

// ================================
// CONFIGURAÇÕES DO TEMPLATE EXCEL
// ================================

export const EXCEL_TEMPLATE_CONFIG = {
  // Colunas obrigatórias (ordem importa para template)
  REQUIRED_COLUMNS: [
    'numeroProcesso',
    'tribunal',
    'nomeCliente'
  ],

  // Colunas opcionais
  OPTIONAL_COLUMNS: [
    'observacoes',
    'frequenciaSync',
    'alertasAtivos',
    'emailsAlerta'
  ],

  // Mapeamento de nomes de colunas (Excel -> Sistema)
  COLUMN_MAPPING: {
    'numero_processo': 'numeroProcesso',
    'numero do processo': 'numeroProcesso',
    'processo': 'numeroProcesso',
    'nº processo': 'numeroProcesso',

    'tribunal': 'tribunal',
    'vara': 'tribunal',
    'juízo': 'tribunal',
    'órgão': 'tribunal',

    'nome_cliente': 'nomeCliente',
    'cliente': 'nomeCliente',
    'nome do cliente': 'nomeCliente',
    'requerente': 'nomeCliente',

    'observacoes': 'observacoes',
    'observações': 'observacoes',
    'notas': 'observacoes',
    'comentarios': 'observacoes',

    'frequencia': 'frequenciaSync',
    'frequência': 'frequenciaSync',
    'sync': 'frequenciaSync',

    'alertas': 'alertasAtivos',
    'alertas_ativos': 'alertasAtivos',
    'enviar_alertas': 'alertasAtivos',

    'emails': 'emailsAlerta',
    'email_alertas': 'emailsAlerta',
    'destinatarios': 'emailsAlerta'
  },

  // Valores válidos para enums
  VALID_FREQUENCIES: ['HOURLY', 'DAILY', 'WEEKLY', 'MANUAL'],
  VALID_BOOLEAN_VALUES: {
    true: ['sim', 'yes', 'true', '1', 'ativo', 'ativado'],
    false: ['não', 'nao', 'no', 'false', '0', 'inativo', 'desativado']
  }
};

// ================================
// CLASSE PRINCIPAL DO PARSER
// ================================

export class ExcelProcessParser {
  private config: ExcelValidationConfig;

  constructor(config?: Partial<ExcelValidationConfig>) {
    this.config = {
      requiredColumns: EXCEL_TEMPLATE_CONFIG.REQUIRED_COLUMNS,
      maxRows: 1000,
      allowDuplicates: false,
      strictProcessNumberValidation: true,
      ...config
    };
  }

  /**
   * Parse do arquivo Excel para array de processos
   */
  async parseExcelBuffer(buffer: Buffer, fileName: string): Promise<ExcelParseResult> {
    try {
      // Importar xlsx dinamicamente (evitar erro SSR)
      const XLSX = await import('xlsx');

      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];

      if (!sheetName) {
        return {
          success: false,
          totalRows: 0,
          validRows: [],
          errors: [{
            linha: 0,
            campo: 'arquivo',
            valor: fileName,
            erro: 'Arquivo Excel não contém planilhas',
            tipo: 'ERROR'
          }],
          summary: { valid: 0, invalid: 1, duplicates: 0, warnings: 0 }
        };
      }

      const worksheet = workbook.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: '',
        blankrows: false
      }) as string[][];

      return this.parseRawData(rawData, fileName);

    } catch (error) {
      console.error(`${ICONS.ERROR} Erro ao processar Excel:`, error);

      return {
        success: false,
        totalRows: 0,
        validRows: [],
        errors: [{
          linha: 0,
          campo: 'arquivo',
          valor: fileName,
          erro: `Erro ao processar arquivo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
          tipo: 'ERROR'
        }],
        summary: { valid: 0, invalid: 1, duplicates: 0, warnings: 0 }
      };
    }
  }

  /**
   * Parse dos dados brutos do Excel
   */
  private parseRawData(rawData: string[][], fileName: string): ExcelParseResult {
    const errors: ExcelRowError[] = [];
    const validRows: ExcelProcessRow[] = [];
    const processedNumbers = new Set<string>();

    // Verificar se há dados
    if (rawData.length < 2) {
      errors.push({
        linha: 0,
        campo: 'arquivo',
        valor: fileName,
        erro: 'Arquivo deve conter pelo menos uma linha de cabeçalho e uma linha de dados',
        tipo: 'ERROR'
      });
      return this.buildResult(0, validRows, errors);
    }

    // Verificar limite de linhas
    if (rawData.length - 1 > this.config.maxRows) {
      errors.push({
        linha: 0,
        campo: 'arquivo',
        valor: fileName,
        erro: `Arquivo excede o limite de ${this.config.maxRows} linhas de dados`,
        tipo: 'ERROR'
      });
      return this.buildResult(rawData.length - 1, validRows, errors);
    }

    // Extrair cabeçalhos
    const headers = rawData[0].map(h => this.normalizeColumnName(h.toString().trim()));

    // Validar colunas obrigatórias
    const missingColumns = this.config.requiredColumns.filter(col => !headers.includes(col));
    if (missingColumns.length > 0) {
      errors.push({
        linha: 1,
        campo: 'cabeçalho',
        valor: headers.join(', '),
        erro: `Colunas obrigatórias faltando: ${missingColumns.join(', ')}`,
        tipo: 'ERROR'
      });
      return this.buildResult(rawData.length - 1, validRows, errors);
    }

    // Processar cada linha de dados
    for (let i = 1; i < rawData.length; i++) {
      const rowData = rawData[i];
      const lineNumber = i + 1;

      // Pular linhas completamente vazias
      if (rowData.every(cell => !cell || cell.toString().trim() === '')) {
        continue;
      }

      try {
        const processRow = this.parseRow(rowData, headers, lineNumber);

        if (processRow) {
          // Verificar duplicatas
          if (!this.config.allowDuplicates && processedNumbers.has(processRow.numeroProcesso)) {
            errors.push({
              linha: lineNumber,
              campo: 'numeroProcesso',
              valor: processRow.numeroProcesso,
              erro: 'Número de processo duplicado no arquivo',
              tipo: 'WARNING'
            });
          } else {
            validRows.push(processRow);
            processedNumbers.add(processRow.numeroProcesso);
          }
        }

      } catch (rowError) {
        if (Array.isArray(rowError)) {
          errors.push(...rowError);
        } else {
          errors.push({
            linha: lineNumber,
            campo: 'linha',
            valor: rowData.join(', '),
            erro: rowError instanceof Error ? rowError.message : 'Erro desconhecido',
            tipo: 'ERROR'
          });
        }
      }
    }

    return this.buildResult(rawData.length - 1, validRows, errors);
  }

  /**
   * Parse de uma linha individual
   */
  private parseRow(rowData: string[], headers: string[], lineNumber: number): ExcelProcessRow | null {
    const errors: ExcelRowError[] = [];
    const row: Partial<ExcelProcessRow> = { linha: lineNumber };

    // Extrair dados de cada coluna
    headers.forEach((header, index) => {
      const value = rowData[index]?.toString()?.trim() || '';

      try {
        switch (header) {
          case 'numeroProcesso':
            this.parseProcessNumber(value, lineNumber, errors, row);
            break;
          case 'tribunal':
            this.parseTribunal(value, lineNumber, errors, row);
            break;
          case 'nomeCliente':
            this.parseClientName(value, lineNumber, errors, row);
            break;
          case 'observacoes':
            row.observacoes = value || undefined;
            break;
          case 'frequenciaSync':
            this.parseFrequency(value, lineNumber, errors, row);
            break;
          case 'alertasAtivos':
            this.parseBoolean(value, 'alertasAtivos', lineNumber, errors, row);
            break;
          case 'emailsAlerta':
            this.parseEmailList(value, lineNumber, errors, row);
            break;
        }
      } catch (fieldError) {
        errors.push({
          linha: lineNumber,
          campo: header,
          valor: value,
          erro: fieldError instanceof Error ? fieldError.message : 'Erro de validação',
          tipo: 'ERROR'
        });
      }
    });

    // Se há erros críticos, jogar para cima
    if (errors.length > 0) {
      throw errors;
    }

    // Verificar se tem os campos obrigatórios
    if (!row.numeroProcesso || !row.tribunal || !row.nomeCliente) {
      return null;
    }

    return row as ExcelProcessRow;
  }

  // ================================
  // MÉTODOS DE VALIDAÇÃO ESPECÍFICOS
  // ================================

  private parseProcessNumber(value: string, line: number, errors: ExcelRowError[], row: Partial<ExcelProcessRow>): void {
    if (!value) {
      errors.push({
        linha: line,
        campo: 'numeroProcesso',
        valor: '',
        erro: 'Número do processo é obrigatório',
        tipo: 'ERROR'
      });
      return;
    }

    const normalized = normalizeProcessNumber(value);

    if (this.config.strictProcessNumberValidation && !validateProcessNumber(normalized)) {
      errors.push({
        linha: line,
        campo: 'numeroProcesso',
        valor: value,
        erro: 'Número do processo não está em formato válido (CNJ)',
        tipo: 'ERROR'
      });
      return;
    }

    row.numeroProcesso = normalized;
  }

  private parseTribunal(value: string, line: number, errors: ExcelRowError[], row: Partial<ExcelProcessRow>): void {
    if (!value) {
      errors.push({
        linha: line,
        campo: 'tribunal',
        valor: '',
        erro: 'Tribunal/Vara é obrigatório',
        tipo: 'ERROR'
      });
      return;
    }

    if (value.length < 3) {
      errors.push({
        linha: line,
        campo: 'tribunal',
        valor: value,
        erro: 'Nome do tribunal deve ter pelo menos 3 caracteres',
        tipo: 'WARNING'
      });
    }

    row.tribunal = value;
  }

  private parseClientName(value: string, line: number, errors: ExcelRowError[], row: Partial<ExcelProcessRow>): void {
    if (!value) {
      errors.push({
        linha: line,
        campo: 'nomeCliente',
        valor: '',
        erro: 'Nome do cliente é obrigatório',
        tipo: 'ERROR'
      });
      return;
    }

    if (value.length < 2) {
      errors.push({
        linha: line,
        campo: 'nomeCliente',
        valor: value,
        erro: 'Nome do cliente deve ter pelo menos 2 caracteres',
        tipo: 'WARNING'
      });
    }

    row.nomeCliente = value;
  }

  private parseFrequency(value: string, line: number, errors: ExcelRowError[], row: Partial<ExcelProcessRow>): void {
    if (!value) {
      row.frequenciaSync = 'DAILY'; // Padrão
      return;
    }

    const normalized = value.toUpperCase();

    // Type guard com narrowing seguro (Mandato Inegociável)
    if (isFrequencyType(normalized)) {
      row.frequenciaSync = normalized;
    } else {
      // Valor inválido - registrar aviso e usar padrão
      errors.push({
        linha: line,
        campo: 'frequenciaSync',
        valor: value,
        erro: `Frequência deve ser uma das opções: ${EXCEL_TEMPLATE_CONFIG.VALID_FREQUENCIES.join(', ')}`,
        tipo: 'WARNING'
      });
      row.frequenciaSync = 'DAILY';
    }
  }

  private parseBoolean(value: string, field: string, line: number, errors: ExcelRowError[], row: Partial<ExcelProcessRow>): void {
    // Type-safe narrowing (Mandato Inegociável)
    // Campo só pode ser 'alertasAtivos'
    if (field !== 'alertasAtivos') {
      return;
    }

    if (!value) {
      row.alertasAtivos = true; // Padrão
      return;
    }

    const normalized = value.toLowerCase();
    const validValues = EXCEL_TEMPLATE_CONFIG.VALID_BOOLEAN_VALUES;

    // Narrowing seguro para boolean
    if (validValues.true.includes(normalized)) {
      row.alertasAtivos = true;
    } else if (validValues.false.includes(normalized)) {
      row.alertasAtivos = false;
    } else {
      // Valor inválido - registrar aviso e usar padrão
      errors.push({
        linha: line,
        campo: field,
        valor: value,
        erro: `Valor deve ser: ${[...validValues.true, ...validValues.false].join(', ')}`,
        tipo: 'WARNING'
      });
      row.alertasAtivos = true;
    }
  }

  private parseEmailList(value: string, line: number, errors: ExcelRowError[], row: Partial<ExcelProcessRow>): void {
    if (!value) {
      row.emailsAlerta = [];
      return;
    }

    const emails = value.split(/[,;]/).map(email => email.trim()).filter(Boolean);
    const invalidEmails: string[] = [];

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const validEmails = emails.filter(email => {
      if (emailRegex.test(email)) {
        return true;
      } else {
        invalidEmails.push(email);
        return false;
      }
    });

    if (invalidEmails.length > 0) {
      errors.push({
        linha: line,
        campo: 'emailsAlerta',
        valor: invalidEmails.join(', '),
        erro: `Emails inválidos encontrados: ${invalidEmails.join(', ')}`,
        tipo: 'WARNING'
      });
    }

    row.emailsAlerta = validEmails;
  }

  // ================================
  // MÉTODOS AUXILIARES
  // ================================

  private normalizeColumnName(columnName: string): string {
    const normalized = columnName.toLowerCase().trim();

    // Type-safe narrowing para COLUMN_MAPPING (Mandato Inegociável)
    // Verificar se a chave existe no mapeamento
    if (isValidColumnMapping(normalized)) {
      return EXCEL_TEMPLATE_CONFIG.COLUMN_MAPPING[normalized];
    }

    // Se não estiver no mapeamento, retornar a versão normalizada
    return normalized;
  }

  private buildResult(totalRows: number, validRows: ExcelProcessRow[], errors: ExcelRowError[]): ExcelParseResult {
    const errorCount = errors.filter(e => e.tipo === 'ERROR').length;
    const warningCount = errors.filter(e => e.tipo === 'WARNING').length;
    const duplicateCount = errors.filter(e => e.erro.includes('duplicado')).length;

    return {
      success: errorCount === 0,
      totalRows,
      validRows,
      errors,
      summary: {
        valid: validRows.length,
        invalid: errorCount,
        duplicates: duplicateCount,
        warnings: warningCount
      }
    };
  }

  /**
   * Gera relatório detalhado dos resultados
   */
  generateReport(result: ExcelParseResult): string {
    const lines = [
      `${ICONS.DOCUMENT} RELATÓRIO DE PROCESSAMENTO DO EXCEL`,
      '='  .repeat(50),
      '',
      `${ICONS.SUCCESS} Linhas válidas: ${result.summary.valid}`,
      `${ICONS.ERROR} Linhas com erro: ${result.summary.invalid}`,
      `${ICONS.WARNING} Avisos: ${result.summary.warnings}`,
      `${ICONS.INFO} Duplicatas: ${result.summary.duplicates}`,
      `${ICONS.INFO} Total de linhas: ${result.totalRows}`,
      ''
    ];

    if (result.errors.length > 0) {
      lines.push(`${ICONS.ERROR} ERROS E AVISOS ENCONTRADOS:`);
      lines.push('-'.repeat(30));

      result.errors.forEach(error => {
        const icon = error.tipo === 'ERROR' ? ICONS.ERROR : ICONS.WARNING;
        lines.push(`${icon} Linha ${error.linha} - ${error.campo}: ${error.erro}`);
        if (error.valor) {
          lines.push(`    Valor: "${error.valor}"`);
        }
        lines.push('');
      });
    }

    return lines.join('\n');
  }
}

// ================================
// GERADOR DE TEMPLATE EXCEL
// ================================

export class ExcelTemplateGenerator {
  /**
   * Gera um template Excel para download
   */
  async generateTemplate(): Promise<Buffer> {
    const XLSX = await import('xlsx');

    const headers = [
      'numeroProcesso',
      'tribunal',
      'nomeCliente',
      'observacoes',
      'frequenciaSync',
      'alertasAtivos',
      'emailsAlerta'
    ];

    const exampleData = [
      [
        '1234567-89.2024.1.23.4567',
        'TJSP - 1ª Vara Cível',
        'João da Silva',
        'Cliente VIP - prioridade alta',
        'DAILY',
        'sim',
        'advogado@escritorio.com, assistente@escritorio.com'
      ],
      [
        '7654321-98.2024.2.34.5678',
        'TJRJ - 5ª Vara Empresarial',
        'Empresa ABC Ltda',
        'Processo complexo',
        'WEEKLY',
        'não',
        'contato@empresa.com'
      ]
    ];

    const wsData = [headers, ...exampleData];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Configurar larguras das colunas
    const colWidths = [
      { wch: 25 }, // numeroProcesso
      { wch: 30 }, // tribunal
      { wch: 25 }, // nomeCliente
      { wch: 30 }, // observacoes
      { wch: 15 }, // frequenciaSync
      { wch: 12 }, // alertasAtivos
      { wch: 40 }  // emailsAlerta
    ];
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Processos');

    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  }

  /**
   * Gera documentação do template
   */
  generateDocumentation(): string {
    return `
${ICONS.DOCUMENT} TEMPLATE DE UPLOAD DE PROCESSOS

COLUNAS OBRIGATÓRIAS:
- numeroProcesso: Número completo do processo (formato CNJ recomendado)
- tribunal: Nome do tribunal/vara (ex: "TJSP - 1ª Vara Cível")
- nomeCliente: Nome completo do cliente

COLUNAS OPCIONAIS:
- observacoes: Notas adicionais sobre o processo
- frequenciaSync: Frequência de sincronização (HOURLY, DAILY, WEEKLY, MANUAL)
- alertasAtivos: Se deve enviar alertas (sim/não, true/false, 1/0)
- emailsAlerta: Emails para alertas, separados por vírgula ou ponto e vírgula

EXEMPLOS:
- Número processo: 1234567-89.2024.1.23.4567
- Tribunal: TJSP - 1ª Vara Cível
- Cliente: João da Silva Santos
- Frequência: DAILY
- Alertas: sim
- Emails: advogado@escritorio.com, assistente@escritorio.com

LIMITES:
- Máximo de ${1000} processos por arquivo
- Arquivo deve estar em formato Excel (.xlsx)
- Encoding UTF-8 recomendado
`.trim();
  }
}

// ================================
// FACTORY FUNCTIONS
// ================================

/**
 * Cria um parser configurado para produção
 */
export function createProductionParser(): ExcelProcessParser {
  return new ExcelProcessParser({
    requiredColumns: EXCEL_TEMPLATE_CONFIG.REQUIRED_COLUMNS,
    maxRows: 1000,
    allowDuplicates: false,
    strictProcessNumberValidation: true
  });
}

/**
 * Cria um parser mais permissivo para desenvolvimento/testes
 */
export function createDevelopmentParser(): ExcelProcessParser {
  return new ExcelProcessParser({
    requiredColumns: EXCEL_TEMPLATE_CONFIG.REQUIRED_COLUMNS,
    maxRows: 100,
    allowDuplicates: true,
    strictProcessNumberValidation: false
  });
}