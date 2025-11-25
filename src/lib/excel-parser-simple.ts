// ================================================================
// EXCEL PARSER - Simple JSON Conversion
// ================================================================
// Converte arquivo Excel em array de objetos JSON
// Uso: Simples parsing sem lógica de negócio

/**
 * Converte Excel buffer para array de objetos JSON
 * Primeira linha é tratada como header (cabeçalho)
 *
 * @param buffer - Buffer do arquivo Excel
 * @returns Array de objetos com nomes de colunas como chaves
 *
 * Exemplo:
 * ```
 * const rows = await ExcelParserSimple.parseToJson(buffer);
 * // Retorna: [
 * //   { 'Número de Processo': '...', 'Nome do Cliente': '...' },
 * //   { 'Número de Processo': '...', 'Nome do Cliente': '...' }
 * // ]
 * ```
 */
export class ExcelParserSimple {
  static async parseToJson(buffer: Buffer): Promise<Array<Record<string, unknown>>> {
    try {
      // Importar xlsx dinamicamente (evitar erro SSR)
      const XLSX = await import('xlsx');

      // Ler workbook
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];

      if (!sheetName) {
        throw new Error('Arquivo Excel não contém planilhas');
      }

      const worksheet = workbook.Sheets[sheetName];

      // Converter para JSON mantendo headers em primeira linha
      const rows = XLSX.utils.sheet_to_json(worksheet, {
        defval: '', // Valor padrão para células vazias
        blankrows: false, // Não incluir linhas em branco
      });

      // Type guard: Garantir que retorna array
      if (!Array.isArray(rows)) {
        throw new Error('Erro ao converter Excel para JSON');
      }

      // Retornar como array de unknown para validação posterior
      return rows as Array<Record<string, unknown>>;
    } catch (_error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      throw new Error(`Erro ao parsear arquivo Excel: ${message}`);
    }
  }
}
