/**
 * Excel Template Generator
 * Generates a properly formatted Excel template for process upload
 */

import * as XLSX from 'xlsx';
import { ICONS } from '@/lib/icons';
import { log, logError } from '@/lib/services/logger';

// Template column definitions
const TEMPLATE_COLUMNS = [
  {
    header: 'numeroProcesso',
    description: 'Número do processo (ex: 0000001-00.2024.8.26.0100)',
    example: '0000001-00.2024.8.26.0100',
    required: true
  },
  {
    header: 'tribunal',
    description: 'Tribunal (ex: TJSP, STF, STJ)',
    example: 'TJSP',
    required: true
  },
  {
    header: 'nomeCliente',
    description: 'Nome do cliente ou parte interessada',
    example: 'João da Silva',
    required: true
  },
  {
    header: 'observacoes',
    description: 'Observações adicionais',
    example: 'Ação civil ordinária',
    required: false
  },
  {
    header: 'frequenciaSync',
    description: 'Frequência de sincronização (daily, weekly, monthly)',
    example: 'daily',
    required: false
  },
  {
    header: 'alertasAtivos',
    description: 'Ativar alertas? (true/false)',
    example: 'true',
    required: false
  },
  {
    header: 'emailsAlerta',
    description: 'Emails para receber alertas (separados por ;)',
    example: 'usuario@example.com;outro@example.com',
    required: false
  }
];

/**
 * Generate Excel template with sample data and formatting
 */
export function generateExcelTemplate(): Buffer {
  try {
    // Create a new workbook
    const workbook = XLSX.utils.book_new();

    // Create template sheet with headers and description
    const templateData: Record<string, unknown>[] = [];

    // Add header row with column descriptions
    const headerRow: Record<string, string> = {};
    TEMPLATE_COLUMNS.forEach(col => {
      headerRow[col.header] = col.description;
    });
    templateData.push(headerRow);

    // Add example row
    const exampleRow: Record<string, string> = {};
    TEMPLATE_COLUMNS.forEach(col => {
      exampleRow[col.header] = col.example;
    });
    templateData.push(exampleRow);

    // Add empty rows for user to fill
    for (let i = 0; i < 9; i++) {
      const emptyRow: Record<string, string> = {};
      TEMPLATE_COLUMNS.forEach(col => {
        emptyRow[col.header] = '';
      });
      templateData.push(emptyRow);
    }

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(templateData);

    // Set column widths
    const columnWidths = [
      { wch: 30 }, // numeroProcesso
      { wch: 12 }, // tribunal
      { wch: 25 }, // nomeCliente
      { wch: 30 }, // observacoes
      { wch: 18 }, // frequenciaSync
      { wch: 15 }, // alertasAtivos
      { wch: 35 }  // emailsAlerta
    ];
    worksheet['!cols'] = columnWidths;

    // Freeze header and description rows
    worksheet['!freeze'] = { xSplit: 0, ySplit: 2 };

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');

    // Create instructions sheet
    const instructions = [
      ['INSTRUÇÕES DE USO', ''],
      ['', ''],
      ['CAMPOS OBRIGATÓRIOS:', ''],
      ['• numeroProcesso', 'Número do processo (formato CNJ)'],
      ['• tribunal', 'Tribunal (TJSP, STF, STJ, etc)'],
      ['• nomeCliente', 'Nome do cliente ou parte'],
      ['', ''],
      ['CAMPOS OPCIONAIS:', ''],
      ['• observacoes', 'Informações adicionais sobre o processo'],
      ['• frequenciaSync', 'Com que frequência sincronizar (daily/weekly/monthly)'],
      ['• alertasAtivos', 'true ou false para ativar alertas'],
      ['• emailsAlerta', 'Emails separados por ponto-e-vírgula (;)'],
      ['', ''],
      ['LIMITAÇÕES:', ''],
      ['• Máximo de 5000 linhas por arquivo'],
      ['• Máximo de 10MB por arquivo'],
      ['• Formato obrigatório: .xlsx ou .xls'],
      ['', ''],
      ['EXEMPLO DE PREENCHIMENTO:', ''],
      ['numeroProcesso', 'tribunal', 'nomeCliente', 'observacoes', 'frequenciaSync', 'alertasAtivos', 'emailsAlerta'],
      ['0000001-00.2024.8.26.0100', 'TJSP', 'João Silva', 'Ação civil', 'daily', 'true', 'joao@example.com']
    ];

    const instructionsSheet = XLSX.utils.aoa_to_sheet(instructions);
    instructionsSheet['!cols'] = [{ wch: 30 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instruções');

    // Generate buffer
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    log.info({ msg: 'Excel template generated successfully' });
    return buffer as Buffer;
  } catch (_error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    logError(errorMsg, '${ICONS.ERROR} Failed to generate Excel template:', { component: 'refactored' });
    throw error;
  }
}

/**
 * Get template as base64 string for inline download
 */
export function getTemplateAsBase64(): string {
  const buffer = generateExcelTemplate();
  return buffer.toString('base64');
}

export default { generateExcelTemplate, getTemplateAsBase64 };
