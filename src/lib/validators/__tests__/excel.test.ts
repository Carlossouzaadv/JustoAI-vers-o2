// ================================================================
// TESTES - Excel Row Schema
// ================================================================
// Validação rigorosa do ExcelRowSchema com cases críticos

import { describe, it, expect } from '@jest/globals';
import { ExcelRowSchema } from '../excel';

describe('ExcelRowSchema - Validação de Linhas Excel', () => {
  // ===== CASOS DE SUCESSO =====

  describe('Casos de Sucesso', () => {
    it('deve validar uma linha mínima (apenas campos obrigatórios)', () => {
      const validRow = {
        'Número de Processo': '0000001-23.2024.1.02.0000',
        'Nome do Cliente': 'João Silva',
        'Tribunal': 'TJSP',
      };

      const result = ExcelRowSchema.safeParse(validRow);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data['Número de Processo']).toBe('0000001-23.2024.1.02.0000');
        expect(result.data['Nome do Cliente']).toBe('João Silva');
        expect(result.data['Tribunal']).toBe('TJSP');
      }
    });

    it('deve validar uma linha completa com todos os campos', () => {
      const validRow = {
        'Número de Processo': '0000001-23.2024.1.02.0000',
        'Nome do Cliente': 'João Silva',
        'Tribunal': 'TJSP',
        'Email': 'joao@example.com',
        'Status': 'ATIVO',
        'Valor da Causa': '10.000,00',
        'Nome do Juiz': 'Dr. Carlos Santos',
        'Descrição': 'Caso de ação civil',
        'Data de Distribuição': '01/01/2024',
        'Frequência de Sincronização': 'DAILY',
        'Alertas Ativos': true,
        'Emails para Alerta': 'alerta@example.com, outros@example.com',
      };

      const result = ExcelRowSchema.safeParse(validRow);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data['Tribunal']).toBe('TJSP');
        expect(result.data['Email']).toBe('joao@example.com'); // Email transformado para lowercase
      }
    });

    it('deve aceitar diferentes formatos de valores monetários', () => {
      const testCases = [
        '100,00',
        '1.000,00',
        '1.000.000,00',
        '1000',
        '1000,99',
      ];

      for (const valor of testCases) {
        const row = {
          'Número de Processo': '0000001-23.2024.1.02.0000',
          'Nome do Cliente': 'Cliente',
          'Tribunal': 'TJSP',
          'Valor da Causa': valor,
        };

        const result = ExcelRowSchema.safeParse(row);
        expect(result.success).toBe(true);
      }
    });

    it('deve aceitar diferentes formatos de data', () => {
      const testCases = ['01/01/2024', '2024-01-01'];

      for (const data of testCases) {
        const row = {
          'Número de Processo': '0000001-23.2024.1.02.0000',
          'Nome do Cliente': 'Cliente',
          'Tribunal': 'TJSP',
          'Data de Distribuição': data,
        };

        const result = ExcelRowSchema.safeParse(row);
        expect(result.success).toBe(true);
      }
    });

    it('deve transformar email para lowercase', () => {
      const row = {
        'Número de Processo': '0000001-23.2024.1.02.0000',
        'Nome do Cliente': 'Cliente',
        'Tribunal': 'TJSP',
        'Email': 'JOAO@EXAMPLE.COM',
      };

      const result = ExcelRowSchema.safeParse(row);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data['Email']).toBe('joao@example.com');
      }
    });

    it('deve aceitar booleanos em múltiplos formatos', () => {
      const trueValues = [true, 'sim', 'true', 'Sim', 'True'];
      const falseValues = [false, 'não', 'false', 'Não', 'False', 'nao'];

      for (const val of trueValues) {
        const row = {
          'Número de Processo': '0000001-23.2024.1.02.0000',
          'Nome do Cliente': 'Cliente',
          'Tribunal': 'TJSP',
          'Alertas Ativos': val,
        };

        const result = ExcelRowSchema.safeParse(row);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data['Alertas Ativos']).toBe(true);
        }
      }

      for (const val of falseValues) {
        const row = {
          'Número de Processo': '0000001-23.2024.1.02.0000',
          'Nome do Cliente': 'Cliente',
          'Tribunal': 'TJSP',
          'Alertas Ativos': val,
        };

        const result = ExcelRowSchema.safeParse(row);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data['Alertas Ativos']).toBe(false);
        }
      }
    });
  });

  // ===== CASOS DE ERRO - CAMPOS OBRIGATÓRIOS =====

  describe('Erros - Campos Obrigatórios', () => {
    it('deve rejeitar linha sem Número de Processo', () => {
      const invalidRow = {
        'Nome do Cliente': 'João Silva',
        'Tribunal': 'TJSP',
      };

      const result = ExcelRowSchema.safeParse(invalidRow);
      expect(result.success).toBe(false);
    });

    it('deve rejeitar linha sem Nome do Cliente', () => {
      const invalidRow = {
        'Número de Processo': '0000001-23.2024.1.02.0000',
        'Tribunal': 'TJSP',
      };

      const result = ExcelRowSchema.safeParse(invalidRow);
      expect(result.success).toBe(false);
    });

    it('deve rejeitar linha sem Tribunal', () => {
      const invalidRow = {
        'Número de Processo': '0000001-23.2024.1.02.0000',
        'Nome do Cliente': 'João Silva',
      };

      const result = ExcelRowSchema.safeParse(invalidRow);
      expect(result.success).toBe(false);
    });
  });

  // ===== CASOS DE ERRO - FORMATO INVÁLIDO =====

  describe('Erros - Formato Inválido', () => {
    it('deve rejeitar número de processo com formato inválido', () => {
      const invalidRow = {
        'Número de Processo': 'ABC123', // Formato inválido
        'Nome do Cliente': 'João Silva',
        'Tribunal': 'TJSP',
      };

      const result = ExcelRowSchema.safeParse(invalidRow);
      expect(result.success).toBe(false);
      if (!result.success) {
        const processError = result.error.issues.find((i) =>
          i.path.includes('Número de Processo')
        );
        expect(processError).toBeDefined();
        expect(processError?.message).toContain('Formato de processo inválido');
      }
    });

    it('deve rejeitar email inválido', () => {
      const invalidRow = {
        'Número de Processo': '0000001-23.2024.1.02.0000',
        'Nome do Cliente': 'João Silva',
        'Tribunal': 'TJSP',
        'Email': 'not-an-email', // Email inválido
      };

      const result = ExcelRowSchema.safeParse(invalidRow);
      expect(result.success).toBe(false);
      if (!result.success) {
        const emailError = result.error.issues.find((i) =>
          i.path.includes('Email')
        );
        expect(emailError).toBeDefined();
      }
    });

    it('deve rejeitar tribunal inválido', () => {
      const invalidRow = {
        'Número de Processo': '0000001-23.2024.1.02.0000',
        'Nome do Cliente': 'João Silva',
        'Tribunal': 'TRT2', // Tribunal não aceito
      };

      const result = ExcelRowSchema.safeParse(invalidRow);
      expect(result.success).toBe(false);
      if (!result.success) {
        const tribunalError = result.error.issues.find((i) =>
          i.path.includes('Tribunal')
        );
        expect(tribunalError).toBeDefined();
        expect(tribunalError?.message).toContain('Tribunal inválido');
      }
    });

    it('deve rejeitar status inválido', () => {
      const invalidRow = {
        'Número de Processo': '0000001-23.2024.1.02.0000',
        'Nome do Cliente': 'João Silva',
        'Tribunal': 'TJSP',
        'Status': 'INVALIDO', // Status não aceito
      };

      const result = ExcelRowSchema.safeParse(invalidRow);
      expect(result.success).toBe(false);
    });

    it('deve rejeitar valor com formato monetário inválido', () => {
      const invalidRow = {
        'Número de Processo': '0000001-23.2024.1.02.0000',
        'Nome do Cliente': 'João Silva',
        'Tribunal': 'TJSP',
        'Valor da Causa': 'abc', // Valor inválido
      };

      const result = ExcelRowSchema.safeParse(invalidRow);
      expect(result.success).toBe(false);
    });

    it('deve rejeitar data com formato inválido', () => {
      const invalidRow = {
        'Número de Processo': '0000001-23.2024.1.02.0000',
        'Nome do Cliente': 'João Silva',
        'Tribunal': 'TJSP',
        'Data de Distribuição': '01-01-2024', // Formato errado
      };

      const result = ExcelRowSchema.safeParse(invalidRow);
      expect(result.success).toBe(false);
    });
  });

  // ===== CASOS DE ERRO - LENGTH VALIDATION =====

  describe('Erros - Validação de Comprimento', () => {
    it('deve rejeitar nome com menos de 3 caracteres', () => {
      const invalidRow = {
        'Número de Processo': '0000001-23.2024.1.02.0000',
        'Nome do Cliente': 'Jo', // Muito curto
        'Tribunal': 'TJSP',
      };

      const result = ExcelRowSchema.safeParse(invalidRow);
      expect(result.success).toBe(false);
    });

    it('deve rejeitar nome com mais de 255 caracteres', () => {
      const longName = 'a'.repeat(256);
      const invalidRow = {
        'Número de Processo': '0000001-23.2024.1.02.0000',
        'Nome do Cliente': longName,
        'Tribunal': 'TJSP',
      };

      const result = ExcelRowSchema.safeParse(invalidRow);
      expect(result.success).toBe(false);
    });

    it('deve rejeitar descrição com mais de 1000 caracteres', () => {
      const longDescription = 'a'.repeat(1001);
      const invalidRow = {
        'Número de Processo': '0000001-23.2024.1.02.0000',
        'Nome do Cliente': 'João Silva',
        'Tribunal': 'TJSP',
        'Descrição': longDescription,
      };

      const result = ExcelRowSchema.safeParse(invalidRow);
      expect(result.success).toBe(false);
    });
  });

  // ===== EDGE CASES =====

  describe('Edge Cases', () => {
    it('deve trimmar espaços em branco', () => {
      const row = {
        'Número de Processo': '  0000001-23.2024.1.02.0000  ',
        'Nome do Cliente': '  João Silva  ',
        'Tribunal': 'TJSP',
      };

      const result = ExcelRowSchema.safeParse(row);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data['Número de Processo']).toBe('0000001-23.2024.1.02.0000');
        expect(result.data['Nome do Cliente']).toBe('João Silva');
      }
    });

    it('deve aceitar nome começando com acento', () => {
      const row = {
        'Número de Processo': '0000001-23.2024.1.02.0000',
        'Nome do Cliente': 'Ângelo Silva',
        'Tribunal': 'TJSP',
      };

      const result = ExcelRowSchema.safeParse(row);
      expect(result.success).toBe(true);
    });

    it('deve rejeitar nome começando com número', () => {
      const row = {
        'Número de Processo': '0000001-23.2024.1.02.0000',
        'Nome do Cliente': '123 Silva',
        'Tribunal': 'TJSP',
      };

      const result = ExcelRowSchema.safeParse(row);
      expect(result.success).toBe(false);
    });
  });
});
