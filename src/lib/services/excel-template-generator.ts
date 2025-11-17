// ================================================================
// EXCEL TEMPLATE GENERATOR
// ================================================================
// Gera um modelo de Excel com campos, validações e exemplos
// O usuário baixa este template e preenche corretamente

import { Workbook, Worksheet, Font, PatternFill, Border, Alignment } from 'exceljs';
import { EXCEL_SCHEMA_INFO } from '@/lib/validators/excel';

/**
 * Cores para formatação
 */
const COLORS = {
  headerRequired: { r: 31, g: 78, b: 121 }, // Azul escuro (obrigatório)
  headerOptional: { r: 79, g: 129, b: 189 }, // Azul claro (opcional)
  exampleRow: { r: 242, g: 242, b: 242 }, // Cinza claro
  warning: { r: 255, g: 192, b: 0 }, // Amarelo
};

/**
 * EXCEL TEMPLATE GENERATOR
 * Gera um workbook Excel pronto para preenchimento
 */
export class ExcelTemplateGenerator {
  /**
   * Gera um template Excel com instruções e exemplos
   * Retorna Buffer pronto para download
   */
  static async generateTemplate(): Promise<Buffer> {
    const workbook = new Workbook();

    // ===== SHEET 1: Dados =====
    const dataSheet = workbook.addWorksheet('Dados', {
      pageSetup: { paperSize: 9, orientation: 'landscape' },
    });

    this.setupDataSheet(dataSheet);

    // ===== SHEET 2: Instruções =====
    const instructionsSheet = workbook.addWorksheet('Instruções');
    this.setupInstructionsSheet(instructionsSheet);

    // ===== SHEET 3: Exemplos =====
    const examplesSheet = workbook.addWorksheet('Exemplos');
    this.setupExamplesSheet(examplesSheet);

    // Converter para buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as Buffer;
  }

  /**
   * Setup da sheet de dados
   */
  private static setupDataSheet(sheet: Worksheet): void {
    // Headers
    const headers = [
      ...EXCEL_SCHEMA_INFO.requiredColumns,
      ...EXCEL_SCHEMA_INFO.optionalColumns,
    ];

    // Adicionar headers
    headers.forEach((header, index) => {
      const cell = sheet.getCell(1, index + 1);
      const isRequired = EXCEL_SCHEMA_INFO.requiredColumns.includes(header);

      // Valor
      cell.value = header;

      // Formatação de header
      cell.font = {
        bold: true,
        color: { argb: 'FFFFFFFF' },
        size: 11,
      } as Font;

      cell.fill = {
        type: 'solid',
        fgColor: {
          argb: isRequired
            ? this.rgbToArgb(COLORS.headerRequired)
            : this.rgbToArgb(COLORS.headerOptional),
        },
      } as PatternFill;

      cell.alignment = { horizontal: 'center', vertical: 'center', wrapText: true } as Alignment;

      // Border
      cell.border = this.createBorder();

      // Width
      sheet.getColumn(index + 1).width = 20;
    });

    // Altura do header
    sheet.getRow(1).height = 40;

    // Adicionar exemplo de linha preenchida
    const exampleData = this.getExampleRow();
    exampleData.forEach((value, index) => {
      const cell = sheet.getCell(2, index + 1);
      cell.value = value;
      cell.fill = {
        type: 'solid',
        fgColor: { argb: this.rgbToArgb(COLORS.exampleRow) },
      } as PatternFill;
      cell.alignment = { horizontal: 'left', vertical: 'center' } as Alignment;
      cell.border = this.createBorder();
    });

    sheet.getRow(2).height = 25;

    // Instruções nas células comentadas (Excel comments)
    this.addValidationComments(sheet);

    // Freeze panes (primeira linha congelada)
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
  }

  /**
   * Setup da sheet de instruções
   */
  private static setupInstructionsSheet(sheet: Worksheet): void {
    sheet.getColumn(1).width = 60;
    sheet.getColumn(2).width = 40;

    // Título
    const titleCell = sheet.getCell(1, 1);
    titleCell.value = '📋 INSTRUÇÕES DE PREENCHIMENTO';
    titleCell.font = { bold: true, size: 14 } as Font;
    sheet.getRow(1).height = 25;

    let row = 3;

    // ===== Campos Obrigatórios =====
    sheet.getCell(row, 1).value = 'CAMPOS OBRIGATÓRIOS';
    sheet.getCell(row, 1).font = { bold: true, size: 12 } as Font;
    row += 2;

    for (const field of EXCEL_SCHEMA_INFO.requiredColumns) {
      const description = this.getFieldDescription(field);
      sheet.getCell(row, 1).value = `• ${field}`;
      sheet.getCell(row, 2).value = description;
      sheet.getCell(row, 2).alignment = { wrapText: true } as Alignment;
      row++;
    }

    row += 2;

    // ===== Campos Opcionais =====
    sheet.getCell(row, 1).value = 'CAMPOS OPCIONAIS';
    sheet.getCell(row, 1).font = { bold: true, size: 12 } as Font;
    row += 2;

    for (const field of EXCEL_SCHEMA_INFO.optionalColumns) {
      const description = this.getFieldDescription(field);
      sheet.getCell(row, 1).value = `• ${field}`;
      sheet.getCell(row, 2).value = description;
      sheet.getCell(row, 2).alignment = { wrapText: true } as Alignment;
      row++;
    }

    row += 2;

    // ===== Dicas Importantes =====
    sheet.getCell(row, 1).value = '💡 DICAS IMPORTANTES';
    sheet.getCell(row, 1).font = { bold: true, size: 12, color: { argb: 'FFFF9800' } } as Font;
    row += 2;

    const tips = [
      'Use exatamente os nomes de colunas do template (não renomeie)',
      'Não deixe linhas em branco no meio dos dados',
      'Números de processo devem estar no formato: NNNNNNN-DD.AAAA.J.TT.OOOO',
      'Datas podem ser DD/MM/YYYY ou YYYY-MM-DD',
      'Valores monetários: use 1000,00 ou 1.000,00',
      'Tribunais válidos: TJSP, TRJ, TRF1, TRF2, TRF3, TRF4, TRF5, STJ, STF',
      'Frequência de sincronização: MANUAL, HOURLY, DAILY, WEEKLY',
      'Alertas Ativos: sim, não, true, false (case-insensitive)',
    ];

    for (const tip of tips) {
      sheet.getCell(row, 1).value = `○ ${tip}`;
      sheet.getCell(row, 1).alignment = { wrapText: true } as Alignment;
      row++;
    }
  }

  /**
   * Setup da sheet de exemplos
   */
  private static setupExamplesSheet(sheet: Worksheet): void {
    // Headers
    const headers = [
      ...EXCEL_SCHEMA_INFO.requiredColumns,
      ...EXCEL_SCHEMA_INFO.optionalColumns,
    ];

    headers.forEach((header, index) => {
      const cell = sheet.getCell(1, index + 1);
      const isRequired = EXCEL_SCHEMA_INFO.requiredColumns.includes(header);

      cell.value = header;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 } as Font;
      cell.fill = {
        type: 'solid',
        fgColor: {
          argb: isRequired
            ? this.rgbToArgb(COLORS.headerRequired)
            : this.rgbToArgb(COLORS.headerOptional),
        },
      } as PatternFill;
      cell.alignment = { horizontal: 'center', vertical: 'center', wrapText: true } as Alignment;
      cell.border = this.createBorder();
      sheet.getColumn(index + 1).width = 18;
    });

    sheet.getRow(1).height = 35;

    // Exemplos de linhas
    const examples = [
      this.getExampleRow(),
      this.getExampleRow2(),
      this.getExampleRow3(),
    ];

    examples.forEach((exampleData, rowIndex) => {
      exampleData.forEach((value, colIndex) => {
        const cell = sheet.getCell(rowIndex + 2, colIndex + 1);
        cell.value = value;
        cell.alignment = { horizontal: 'left', vertical: 'center' } as Alignment;
        cell.border = this.createBorder();
      });
    });

    sheet.views = [{ state: 'frozen', ySplit: 1 }];
  }

  /**
   * Retorna um exemplo de linha válida
   */
  private static getExampleRow(): (string | number | boolean)[] {
    return [
      '0000001-23.2024.1.02.0000', // Número de Processo
      'João Silva Santos', // Nome do Cliente
      'TJSP', // Tribunal
      'joao.silva@example.com', // Email (optional)
      'ATIVO', // Status (optional)
      '50.000,00', // Valor da Causa (optional)
      'Dr. Carlos Mendes', // Nome do Juiz (optional)
      'Ação civil ordinária de cobrança', // Descrição (optional)
      '15/01/2024', // Data de Distribuição (optional)
      'DAILY', // Frequência de Sincronização (optional)
      true, // Alertas Ativos (optional)
      'alertas@example.com', // Emails para Alerta (optional)
    ];
  }

  /**
   * Segundo exemplo
   */
  private static getExampleRow2(): (string | number | boolean)[] {
    return [
      '0000002-45.2024.2.01.0000',
      'Maria oliveira Andrade',
      'TRF1',
      'maria@example.com',
      'SUSPENSO',
      '100.000,00',
      'Dra. Ana Paula Costa',
      'Recurso especial',
      '20/02/2024',
      'WEEKLY',
      false,
      '',
    ];
  }

  /**
   * Terceiro exemplo
   */
  private static getExampleRow3(): (string | number | boolean)[] {
    return [
      '0000003-78.2024.3.15.0000',
      'Empresa Comércio LTDA',
      'STJ',
      '',
      'ENCERRADO',
      '250.000,00',
      '',
      '',
      '01/03/2024',
      'MANUAL',
      '',
      '',
    ];
  }

  /**
   * Descrição de cada campo
   */
  private static getFieldDescription(field: string): string {
    const descriptions: Record<string, string> = {
      'Número de Processo': 'Formato CNJ: NNNNNNN-DD.AAAA.J.TT.OOOO. Ex: 0000001-23.2024.1.02.0000',
      'Nome do Cliente': 'Nome completo (mínimo 3 caracteres, máximo 255). Deve começar com letra.',
      'Tribunal': 'TJSP, TRJ, TRF1, TRF2, TRF3, TRF4, TRF5, STJ ou STF',
      'Email': 'Email válido do cliente (opcional)',
      'Status': 'ATIVO, ENCERRADO, SUSPENSO ou PARADO (opcional)',
      'Valor da Causa': 'Valor em reais. Formato: 1000,00 ou 1.000,00 (opcional)',
      'Nome do Juiz': 'Nome do magistrado responsável (3-100 caracteres, opcional)',
      'Descrição': 'Breve descrição do caso (máximo 1000 caracteres, opcional)',
      'Data de Distribuição': 'DD/MM/YYYY ou YYYY-MM-DD (opcional)',
      'Frequência de Sincronização': 'MANUAL, HOURLY, DAILY ou WEEKLY (opcional)',
      'Alertas Ativos': 'sim, não, true, false (opcional)',
      'Emails para Alerta': 'Email(s) separados por vírgula (opcional)',
    };

    return descriptions[field] || 'Campo não documentado';
  }

  /**
   * Adiciona comentários com validações em cada coluna header
   */
  private static addValidationComments(sheet: Worksheet): void {
    const headers = [
      ...EXCEL_SCHEMA_INFO.requiredColumns,
      ...EXCEL_SCHEMA_INFO.optionalColumns,
    ];

    headers.forEach((header, index) => {
      const cell = sheet.getCell(1, index + 1);
      const description = this.getFieldDescription(header);

      cell.note = {
        texts: [description],
        margins: { insetmode: 'custom', l: 100, t: 100, r: 100, b: 100 },
      };
    });
  }

  /**
   * Converte RGB para ARGB (Excel format)
   */
  private static rgbToArgb(rgb: { r: number; g: number; b: number }): string {
    return `FF${((rgb.r << 16) | (rgb.g << 8) | rgb.b).toString(16).toUpperCase().padStart(6, '0')}`;
  }

  /**
   * Cria border padrão
   */
  private static createBorder(): Border {
    return {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  }
}
