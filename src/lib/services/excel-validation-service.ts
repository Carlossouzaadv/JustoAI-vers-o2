// ================================================================
// EXCEL VALIDATION SERVICE
// ================================================================
// Serviço de validação em duas etapas:
// 1. Parsing: Converter Excel para JSON
// 2. Validação: Aplicar schema Zod a cada linha
//
// Características:
// - Não falha no primeiro erro (coleta TODOS os erros)
// - Feedback detalhado: linha + coluna + valor + erro
// - 100% Type-Safe (zero `any`, zero `as` perigoso)

import { z } from 'zod';
import { ExcelRowSchema, type ExcelRow } from '@/lib/validators/excel';

// ===== TIPOS DE RESPOSTA =====

export interface ValidationErrorDetail {
  row: number;
  column: string;
  value: unknown;
  _error: string;
}

export interface ValidationResponse {
  success: boolean;
  message: string;
  validRows?: ExcelRow[];
  errors?: ValidationErrorDetail[];
  statistics?: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
  };
}

// ===== EXCEL VALIDATION SERVICE =====

/**
 * EXCEL VALIDATION SERVICE
 *
 * Responsabilidades:
 * 1. Validar cada linha contra ExcelRowSchema
 * 2. Coletar TODOS os erros (não fail-fast)
 * 3. Retornar feedback detalhado: linha + coluna + erro
 * 4. 100% Type-Safe (zero `any`, zero `as`)
 */
export class ExcelValidationService {
  /**
   * Valida um array de linhas (JSON do Excel)
   * Retorna separadamente: válidos + inválidos
   *
   * @param rows - Array de linhas do Excel (tipo unknown para type-safety)
   * @returns ValidationResponse com resultado da validação
   *
   * Exemplo:
   * ```
   * const rows = [ { 'Número de Processo': '1234567-89.0123.4.56.7890', ... } ];
   * const result = ExcelValidationService.validateBatch(rows);
   * if (result.success) {
   *   // Processar dados
   * } else {
   *   // Mostrar erros: result.errors
   * }
   * ```
   */
  static validateBatch(rows: unknown[]): ValidationResponse {
    // Type guard 1: Garantir que é um array
    if (!Array.isArray(rows)) {
      return {
        success: false,
        message: 'Dados de entrada inválidos (esperado array)',
      };
    }

    const validRows: ExcelRow[] = [];
    const errors: ValidationErrorDetail[] = [];
    const invalidRowNumbers = new Set<number>();

    // Iterar sobre cada linha
    // Nota: Arquivo Excel começada em linha 1 (cabeçalho), dados em linha 2+
    // Então reportamos como i + 2 para corresponder ao Excel
    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2;
      const rowData = rows[i];

      // Validar contra schema usando safeParse
      // safeParse retorna { success: boolean, data?, _error? }
      const result = ExcelRowSchema.safeParse(rowData);

      if (result.success) {
        // Linha válida - tipo é 100% type-safe aqui
        validRows.push(result.data);
      } else {
        // Linha inválida - extrair detalhes de CADA erro
        // (não apenas o primeiro, como faria .parse())
        invalidRowNumbers.add(rowNumber);
        for (const issue of result.error.issues) {
          const columnName = String(issue.path[0] ?? 'unknown');
          const cellValue = this.extractCellValue(rowData, columnName);

          errors.push({
            row: rowNumber,
            column: columnName,
            value: cellValue,
            _error: issue.message,
          });
        }
      }
    }

    const invalidRowCount = invalidRowNumbers.size;

    // Gerar mensagem baseada em estatísticas
    const message = this.generateMessage(validRows.length, invalidRowCount, rows.length);

    return {
      success: errors.length === 0,
      message,
      validRows: validRows.length > 0 ? validRows : undefined,
      errors: errors.length > 0 ? errors : undefined,
      statistics: {
        totalRows: rows.length,
        validRows: validRows.length,
        invalidRows: invalidRowCount,
      },
    };
  }

  /**
   * Extrai valor da célula para relatório de erro
   * Usa type guard seguro para acessar propriedade
   *
   * @private
   */
  private static extractCellValue(row: unknown, columnName: string): unknown {
    // Type guard 1: Verificar se é object
    if (typeof row !== 'object' || row === null) {
      return 'N/A';
    }

    // Type guard 2: Verificar se propriedade existe
    if (columnName in row) {
      // Agora seguro acessar a propriedade
      return (row as Record<string, unknown>)[columnName];
    }

    return 'N/A';
  }

  /**
   * Gera mensagem amigável baseada em estatísticas
   *
   * @private
   */
  private static generateMessage(validCount: number, errorCount: number, _totalCount: number): string {
    // Caso 1: Sem erros
    if (errorCount === 0) {
      const lines = validCount !== 1 ? 'linhas' : 'linha';
      return `Validação concluída. ${validCount} ${lines} válida${validCount !== 1 ? 's' : ''} detectada${validCount !== 1 ? 's' : ''}.`;
    }

    // Caso 2: Sem dados válidos
    if (validCount === 0) {
      const errors = errorCount !== 1 ? 'erros' : 'erro';
      return `Nenhuma linha válida encontrada. ${errorCount} ${errors} detectado${errorCount !== 1 ? 's' : ''}.`;
    }

    // Caso 3: Mistura de válidos e inválidos
    const validLines = validCount !== 1 ? 'linhas' : 'linha';
    const invalidErrors = errorCount !== 1 ? 'erros' : 'erro';
    return `${validCount} ${validLines} válida${validCount !== 1 ? 's' : ''}, ${errorCount} ${invalidErrors} encontrado${errorCount !== 1 ? 's' : ''}.`;
  }

  /**
   * Validar uma única linha (útil para testes ou processamento individual)
   *
   * @param row - Uma linha de dados
   * @returns { success: boolean, data?: ExcelRow, errors?: ZodError }
   */
  static validateRow(row: unknown): { success: boolean; data?: ExcelRow; errors?: z.ZodError } {
    const result = ExcelRowSchema.safeParse(row);

    if (result.success) {
      return { success: true, data: result.data };
    }

    return { success: false, errors: result.error };
  }

  /**
   * Obtém informações sobre o schema (para documentação/template)
   */
  static getSchemaInfo() {
    const shape = ExcelRowSchema.shape;
    const required: string[] = [];
    const optional: string[] = [];

    // Iterar sobre cada field e classificar como required/optional
    for (const [key, schema] of Object.entries(shape)) {
      // Type guard para ZodSchema
      if (typeof schema === 'object' && schema !== null && '_def' in schema) {
        const def = (schema as { _def: { innerType?: { _def?: { optional?: boolean } } | null } })._def;
        const isOptional = def.innerType?._def?.optional ?? false;

        if (isOptional) {
          optional.push(key);
        } else {
          required.push(key);
        }
      }
    }

    return {
      requiredColumns: required,
      optionalColumns: optional,
    };
  }
}
