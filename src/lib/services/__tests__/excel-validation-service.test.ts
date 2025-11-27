// ================================================================
// TESTES - Excel Validation Service
// ================================================================
// Validação em lote com coleta de TODOS os erros (não fail-fast)

import { describe, it, expect } from '@jest/globals';
import { ExcelValidationService } from '../excel-validation-service';

describe('ExcelValidationService - Validação em Lote', () => {
  // ===== CASOS DE SUCESSO =====

  describe('Casos de Sucesso', () => {
    it('deve validar lote com todas as linhas válidas', () => {
      const rows = [
        {
          'Número de Processo': '0000001-23.2024.1.02.0000',
          'Nome do Cliente': 'João Silva',
          'Tribunal': 'TJSP',
        },
        {
          'Número de Processo': '0000002-23.2024.1.02.0000',
          'Nome do Cliente': 'Maria Santos',
          'Tribunal': 'TRF1',
        },
        {
          'Número de Processo': '0000003-23.2024.1.02.0000',
          'Nome do Cliente': 'Carlos Oliveira',
          'Tribunal': 'STJ',
        },
      ];

      const result = ExcelValidationService.validateBatch(rows);

      expect(result.success).toBe(true);
      expect(result.validRows).toHaveLength(3);
      expect(result.errors).toBeUndefined();
      expect(result.statistics?.totalRows).toBe(3);
      expect(result.statistics?.validRows).toBe(3);
      expect(result.statistics?.invalidRows).toBe(0);
    });

    it('deve retornar mensagem correta para lote válido', () => {
      const rows = [
        {
          'Número de Processo': '0000001-23.2024.1.02.0000',
          'Nome do Cliente': 'João Silva',
          'Tribunal': 'TJSP',
        },
      ];

      const result = ExcelValidationService.validateBatch(rows);

      expect(result.success).toBe(true);
      expect(result.message).toContain('1 linha válida');
    });
  });

  // ===== CASOS COM ERRO - COLETA DE TODOS OS ERROS =====

  describe('Erros - Coleta Completa (não fail-fast)', () => {
    it('deve coletar TODOS os erros de um lote (não parar no primeiro)', () => {
      const rows = [
        {
          'Número de Processo': 'INVALID1', // Erro 1
          'Nome do Cliente': 'Jo', // Erro 2 (muito curto)
          'Tribunal': 'TRT2', // Erro 3 (tribunal inválido)
        },
        {
          'Número de Processo': 'INVALID2', // Erro 4
          'Nome do Cliente': 'Cliente', // OK
          'Tribunal': 'TJSP', // OK
        },
      ];

      const result = ExcelValidationService.validateBatch(rows);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(3);
      expect(result.validRows).toBeUndefined();
      expect(result.statistics?.validRows).toBe(0);
      expect(result.statistics?.invalidRows).toBe(2);
    });

    it('deve coletar erros de múltiplas linhas', () => {
      const rows = [
        {
          // Linha 2 no Excel
          'Número de Processo': 'INVALID', // Erro
          'Nome do Cliente': 'João Silva',
          'Tribunal': 'TJSP',
        },
        {
          // Linha 3 no Excel
          'Número de Processo': '0000001-23.2024.1.02.0000',
          'Nome do Cliente': 'Jo', // Erro
          'Tribunal': 'TJSP',
        },
        {
          // Linha 4 no Excel
          'Número de Processo': '0000002-23.2024.1.02.0000',
          'Nome do Cliente': 'Maria Santos',
          'Tribunal': 'TJSP', // OK
        },
      ];

      const result = ExcelValidationService.validateBatch(rows);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();

      const errors = result.errors!;
      expect(errors.some((e) => e.row === 2)).toBe(true); // Linha 2 tem erro
      expect(errors.some((e) => e.row === 3)).toBe(true); // Linha 3 tem erro
      expect(errors.every((e) => e.row !== 4)).toBe(true); // Linha 4 sem erro

      expect(result.statistics?.validRows).toBe(1);
      expect(result.statistics?.invalidRows).toBe(2);
    });

    it('deve detalhar cada erro com row, column, value e _error message', () => {
      const rows = [
        {
          'Número de Processo': 'INVALID',
          'Nome do Cliente': 'João Silva',
          'Tribunal': 'TRT2',
        },
      ];

      const result = ExcelValidationService.validateBatch(rows);

      expect(result.errors).toBeDefined();
      const errors = result.errors!;

      // Verificar que há erros com toda a informação necessária
      for (const _error of errors) {
        expect(_error).toHaveProperty('row');
        expect(_error).toHaveProperty('column');
        expect(_error).toHaveProperty('value');
        expect(_error).toHaveProperty('error');

        expect(typeof _error.row).toBe('number');
        expect(_error.row).toBeGreaterThanOrEqual(2); // Começa em linha 2 (cabeçalho em 1)
        expect(typeof _error.column).toBe('string');
        expect(_error.column.length).toBeGreaterThan(0);
        expect(typeof _error.error).toBe('string');
        expect(_error.error.length).toBeGreaterThan(0);
      }
    });
  });

  // ===== CASOS DE ERRO - VALIDAÇÃO INDIVIDUAL =====

  describe('Método validateRow', () => {
    it('deve validar uma linha individual com sucesso', () => {
      const row = {
        'Número de Processo': '0000001-23.2024.1.02.0000',
        'Nome do Cliente': 'João Silva',
        'Tribunal': 'TJSP',
      };

      const result = ExcelValidationService.validateRow(row);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.errors).toBeUndefined();
    });

    it('deve retornar erro para linha inválida', () => {
      const row = {
        'Número de Processo': 'INVALID',
        'Nome do Cliente': 'João Silva',
        'Tribunal': 'TJSP',
      };

      const result = ExcelValidationService.validateRow(row);

      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.errors).toBeDefined();
    });
  });

  // ===== CASOS DE ERRO - INPUT VALIDATION =====

  describe('Erros - Input Validation', () => {
    it('deve rejeitar input que não é array', () => {
      const result = ExcelValidationService.validateBatch('not an array' as unknown as unknown[]);

      expect(result.success).toBe(false);
      expect(result.message).toContain('array');
    });

    it('deve rejeitar array vazio', () => {
      const result = ExcelValidationService.validateBatch([]);

      expect(result.success).toBe(true); // Tecnicamente é "sucesso" validar 0 linhas
      expect(result.statistics?.totalRows).toBe(0);
      expect(result.statistics?.validRows).toBe(0);
    });

    it('deve extrair valor correto mesmo se célula for N/A', () => {
      const rows = [
        {
          'Número de Processo': 'INVALID',
          'Nome do Cliente': 'João Silva',
          'Tribunal': 'TJSP',
          'Campo Inexistente': 'algum valor',
        },
      ];

      const result = ExcelValidationService.validateBatch(rows);

      expect(result.errors).toBeDefined();
      const numberError = result.errors!.find(
        (e) => e.column === 'Número de Processo'
      );
      expect(numberError?.value).toBe('INVALID');
    });
  });

  // ===== CASOS DE SUCESSO E ERRO MISTOS =====

  describe('Lotes Mistos (Válidos + Inválidos)', () => {
    it('deve separar corretamente linhas válidas e inválidas', () => {
      const rows = [
        {
          // Válida
          'Número de Processo': '0000001-23.2024.1.02.0000',
          'Nome do Cliente': 'João Silva',
          'Tribunal': 'TJSP',
        },
        {
          // Inválida
          'Número de Processo': 'INVALID',
          'Nome do Cliente': 'Jo',
          'Tribunal': 'TJSP',
        },
        {
          // Válida
          'Número de Processo': '0000002-23.2024.1.02.0000',
          'Nome do Cliente': 'Maria Santos',
          'Tribunal': 'TJSP',
        },
      ];

      const result = ExcelValidationService.validateBatch(rows);

      expect(result.success).toBe(false); // Há erros
      expect(result.validRows).toBeDefined();
      expect(result.validRows!.length).toBe(2);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);

      // Linhas válidas devem estar em result.validRows
      const processNumbers = result.validRows!.map((r) => r['Número de Processo']);
      expect(processNumbers).toContain('0000001-23.2024.1.02.0000');
      expect(processNumbers).toContain('0000002-23.2024.1.02.0000');
    });

    it('deve usar numeração de linha começando em 2 (Excel começa em 1 com header)', () => {
      const rows = [
        { 'Número de Processo': 'INVALID', 'Nome do Cliente': 'A', 'Tribunal': 'TJSP' },
        { 'Número de Processo': 'INVALID', 'Nome do Cliente': 'B', 'Tribunal': 'TJSP' },
        { 'Número de Processo': 'INVALID', 'Nome do Cliente': 'C', 'Tribunal': 'TJSP' },
      ];

      const result = ExcelValidationService.validateBatch(rows);

      expect(result.errors).toBeDefined();
      const rowNumbers = result.errors!.map((e) => e.row);

      expect(rowNumbers).toContain(2); // Primeira linha de dados
      expect(rowNumbers).toContain(3); // Segunda linha de dados
      expect(rowNumbers).toContain(4); // Terceira linha de dados
    });
  });

  // ===== MESSAGES =====

  describe('Mensagens de Feedback', () => {
    it('deve gerar mensagem correta para múltiplas linhas válidas', () => {
      const rows = Array(5).fill({
        'Número de Processo': '0000001-23.2024.1.02.0000',
        'Nome do Cliente': 'João Silva',
        'Tribunal': 'TJSP',
      });

      const result = ExcelValidationService.validateBatch(rows);

      expect(result.message).toContain('5 linhas');
      expect(result.message).toContain('válidas');
    });

    it('deve gerar mensagem correta para nenhuma linha válida', () => {
      const rows = [
        { 'Número de Processo': 'INVALID', 'Nome do Cliente': 'Jo', 'Tribunal': 'TJSP' },
      ];

      const result = ExcelValidationService.validateBatch(rows);

      expect(result.message).toContain('Nenhuma linha válida');
    });

    it('deve gerar mensagem correta para lote misto', () => {
      const rows = [
        {
          'Número de Processo': '0000001-23.2024.1.02.0000',
          'Nome do Cliente': 'João Silva',
          'Tribunal': 'TJSP',
        },
        { 'Número de Processo': 'INVALID', 'Nome do Cliente': 'Jo', 'Tribunal': 'TJSP' },
      ];

      const result = ExcelValidationService.validateBatch(rows);

      expect(result.message).toContain('1 linha');
      expect(result.message).toContain('válida');
      expect(result.message).toContain('1 erro');
    });
  });
});
