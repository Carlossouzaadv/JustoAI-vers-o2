// ================================================================
// EXCEL VALIDATION LIBRARY
// Row-level validation with specific error messages
// ================================================================

import { z } from 'zod';

// ================================================================
// ZODS SCHEMAS FOR FIELD VALIDATION
// ================================================================

const excelRowSchema = z.object({
  'Nome do Cliente': z
    .string()
    .min(3, 'Nome deve ter pelo menos 3 caracteres')
    .max(255, 'Nome não pode ter mais de 255 caracteres'),

  'Email': z
    .string()
    .email('Email inválido'),

  'Número de Processo': z
    .string()
    .regex(
      /^\d{7}-\d{2}\.\d{4}\.\d{1}\.\d{2}\.\d{4}$/,
      'Formato de processo inválido. Use: NNNNNNN-DD.AAAA.J.TT.OOOO'
    ),

  'Status': z
    .enum(['ATIVO', 'ENCERRADO', 'SUSPENSO', 'PARADO'], {
      message: 'Status deve ser ATIVO, ENCERRADO, SUSPENSO ou PARADO'
    }),

  'Valor Causa': z
    .string()
    .regex(
      /^(\d{1,3}(?:\.\d{3})*|\d+)(?:,\d{2})?$/,
      'Valor inválido. Use formato: 1000,00 ou 1.000,00'
    ),

  'Tribunal': z
    .string()
    .min(2, 'Tribunal obrigatório')
    .max(100, 'Tribunal não pode ter mais de 100 caracteres'),

  'Juiz': z
    .string()
    .min(3, 'Nome do Juiz deve ter pelo menos 3 caracteres')
    .max(100, 'Nome do Juiz não pode ter mais de 100 caracteres')
    .optional(),

  'Descrição': z
    .string()
    .max(1000, 'Descrição não pode ter mais de 1000 caracteres')
    .optional(),

  'Partes': z
    .string()
    .min(5, 'Partes deve ter pelo menos 5 caracteres')
    .max(500, 'Partes não pode ter mais de 500 caracteres')
    .optional(),

  'Data de Distribuição': z
    .string()
    .regex(
      /^(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})$/,
      'Data inválida. Use DD/MM/YYYY ou YYYY-MM-DD'
    )
    .optional(),
});

type ExcelRowInput = z.infer<typeof excelRowSchema>;

// ================================================================
// VALIDATION FUNCTIONS
// ================================================================

export interface ValidationResult {
  success: boolean;
  error?: string;
  field?: string;
  validatedData?: ExcelRowInput;
}

/**
 * Validate a single Excel row
 * Returns specific field and error message
 */
export function validateExcelRow(
  rowNumber: number,
  rowData: Record<string, unknown>
): ValidationResult {
  try {
    const validated = excelRowSchema.parse(rowData);
    return { success: true, validatedData: validated };
  } catch (_error) {
    if (error instanceof z.ZodError) {
      const firstError = error.issues[0];
      const field = String(firstError.path[0]);
      const message = firstError.message;

      return {
        success: false,
        error: message,
        field,
      };
    }

    return {
      success: false,
      error: 'Erro desconhecido ao validar linha',
    };
  }
}

export interface BatchValidationResult {
  valid: Array<{
    rowNumber: number;
    data: ExcelRowInput;
  }>;
  invalid: Array<{
    rowNumber: number;
    data: Record<string, unknown>;
    error: string;
    field: string;
  }>;
  errorSummary: Record<string, number>;
  totalRows: number;
  validRows: number;
  invalidRows: number;
}

/**
 * Validate all rows in a batch
 * Returns separated valid and invalid rows with error summary
 */
export async function validateBatchRows(
  rows: Array<Record<string, unknown>>
): Promise<BatchValidationResult> {
  const valid = [];
  const invalid = [];
  const errorSummary: Record<string, number> = {};

  for (let i = 0; i < rows.length; i++) {
    const rowNumber = i + 2; // Row 2 (skip header which is row 1)
    const result = validateExcelRow(rowNumber, rows[i]);

    if (result.success) {
      valid.push({
        rowNumber,
        data: result.validatedData!,
      });
    } else {
      invalid.push({
        rowNumber,
        data: rows[i],
        error: result.error!,
        field: result.field!,
      });

      // Aggregate errors for summary
      const errorKey = `${result.field}: ${result.error}`;
      errorSummary[errorKey] = (errorSummary[errorKey] || 0) + 1;
    }
  }

  return {
    valid,
    invalid,
    errorSummary,
    totalRows: rows.length,
    validRows: valid.length,
    invalidRows: invalid.length,
  };
}

// ================================================================
// ERROR FORMATTING FUNCTIONS
// ================================================================

export interface ErrorRowForExport {
  rowNumber: number;
  field: string;
  error: string;
  originalValue: unknown;
}

/**
 * Format invalid rows for CSV export
 */
export function formatInvalidRowsForCsv(
  invalidRows: Array<{
    rowNumber: number;
    data: Record<string, unknown>;
    error: string;
    field: string;
  }>
): ErrorRowForExport[] {
  return invalidRows.map((row) => ({
    rowNumber: row.rowNumber,
    field: row.field,
    error: row.error,
    originalValue: row.data[row.field] || 'N/A',
  }));
}

/**
 * Generate CSV content from error rows
 */
export function generateErrorCsv(errorRows: ErrorRowForExport[]): string {
  if (errorRows.length === 0) {
    return 'Nenhum erro encontrado';
  }

  // CSV headers
  const headers = ['Linha', 'Campo', 'Erro', 'Valor Original'];
  const csvLines = [headers.join(',')];

  // CSV rows
  for (const error of errorRows) {
    const fields = [
      error.rowNumber.toString(),
      `"${error.field}"`,
      `"${error.error.replace(/"/g, '""')}"`,
      `"${String(error.originalValue).replace(/"/g, '""')}"`,
    ];
    csvLines.push(fields.join(','));
  }

  return csvLines.join('\n');
}

// ================================================================
// RETRY LOGIC FUNCTIONS
// ================================================================

export interface RetryableRow {
  rowNumber: number;
  data: Record<string, unknown>;
  error: string;
  field: string;
  retryCount: number;
  maxRetries: number;
}

/**
 * Check if a row can be retried
 */
export function canRetry(row: RetryableRow): boolean {
  return row.retryCount < row.maxRetries;
}

/**
 * Filter rows that are eligible for retry
 */
export function filterRetryableRows(
  invalidRows: RetryableRow[]
): { retryable: RetryableRow[]; permanent: RetryableRow[] } {
  const retryable = invalidRows.filter(canRetry);
  const permanent = invalidRows.filter((row) => !canRetry(row));

  return { retryable, permanent };
}

/**
 * Re-validate rows after retry
 * Typically for cases where external validation (API calls, etc) might have changed
 */
export async function retryValidation(
  rows: RetryableRow[]
): Promise<{
  nowValid: Array<{ rowNumber: number; data: ExcelRowInput }>;
  stillInvalid: RetryableRow[];
}> {
  const nowValid = [];
  const stillInvalid = [];

  for (const row of rows) {
    const result = validateExcelRow(row.rowNumber, row.data);

    if (result.success) {
      nowValid.push({
        rowNumber: row.rowNumber,
        data: result.validatedData!,
      });
    } else {
      stillInvalid.push({
        ...row,
        retryCount: row.retryCount + 1,
        error: result.error!,
        field: result.field!,
      });
    }
  }

  return { nowValid, stillInvalid };
}

// ================================================================
// ERROR STATISTICS
// ================================================================

export interface ErrorStatistics {
  totalErrors: number;
  byField: Record<string, number>;
  byErrorMessage: Record<string, number>;
  topErrors: Array<{ error: string; count: number; field: string }>;
}

/**
 * Calculate error statistics for batch
 */
export function calculateErrorStats(
  invalidRows: Array<{ field: string; error: string }>
): ErrorStatistics {
  const byField: Record<string, number> = {};
  const byErrorMessage: Record<string, number> = {};

  for (const row of invalidRows) {
    byField[row.field] = (byField[row.field] || 0) + 1;
    byErrorMessage[row.error] = (byErrorMessage[row.error] || 0) + 1;
  }

  // Top 5 errors
  const topErrors = Object.entries(byErrorMessage)
    .map(([error, count]) => {
      const field = invalidRows.find((r) => r.error === error)?.field || 'unknown';
      return { error, count, field };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalErrors: invalidRows.length,
    byField,
    byErrorMessage,
    topErrors,
  };
}
