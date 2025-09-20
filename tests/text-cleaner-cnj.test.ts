// ================================================================
// TESTES UNITÁRIOS - Parser CNJ e Text Cleaner
// ================================================================

import { describe, it, expect, beforeEach } from '@jest/globals';
import { TextCleaner } from '../lib/text-cleaner';

describe('TextCleaner - CNJ Parser', () => {
  let textCleaner: TextCleaner;

  beforeEach(() => {
    textCleaner = new TextCleaner();
  });

  describe('extractProcessNumber', () => {
    it('deve extrair número CNJ no formato padrão', () => {
      const text = `
        Processo nº 1234567-89.2023.1.23.4567
        Autor: João da Silva
        Réu: Empresa XYZ
      `;

      const result = textCleaner.extractProcessNumber(text);
      expect(result).toBe('1234567-89.2023.1.23.4567');
    });

    it('deve extrair número CNJ em diferentes posições do texto', () => {
      const text = `
        TRIBUNAL DE JUSTIÇA DE SÃO PAULO

        No processo de número 5000123-45.2023.8.26.0001 foi proferida
        a seguinte decisão...
      `;

      const result = textCleaner.extractProcessNumber(text);
      expect(result).toBe('5000123-45.2023.8.26.0001');
    });

    it('deve extrair primeiro número CNJ quando há múltiplos', () => {
      const text = `
        Processo principal: 1111111-11.2023.1.11.1111
        Processo conexo: 2222222-22.2023.2.22.2222
      `;

      const result = textCleaner.extractProcessNumber(text);
      expect(result).toBe('1111111-11.2023.1.11.1111');
    });

    it('deve extrair número no formato antigo', () => {
      const text = `
        Processo nº 0001.23.456789-0
        Distribuído em 15/03/2020
      `;

      const result = textCleaner.extractProcessNumber(text);
      expect(result).toBe('0001.23.456789-0');
    });

    it('deve retornar null quando não encontrar número', () => {
      const text = `
        Este documento não contém número de processo válido.
        Apenas texto corrido sem formatação CNJ.
      `;

      const result = textCleaner.extractProcessNumber(text);
      expect(result).toBeNull();
    });

    it('deve ignorar números incompletos ou inválidos', () => {
      const text = `
        Número incompleto: 1234567-89.2023
        Número inválido: 123-45.2023.1.23.4567
        Texto com números: 123456789
      `;

      const result = textCleaner.extractProcessNumber(text);
      expect(result).toBeNull();
    });

    it('deve extrair número com espaçamentos diferentes', () => {
      const text = `
        Processo   nº   1234567 - 89 . 2023 . 1 . 23 . 4567
      `;

      // Assume que o regex trata espaços ou que há normalização
      const result = textCleaner.extractProcessNumber(text);
      expect(result).toContain('1234567');
    });

    it('deve ser case insensitive', () => {
      const text = `
        PROCESSO Nº 1234567-89.2023.1.23.4567
        processo nº 9876543-21.2023.4.56.7890
      `;

      const result = textCleaner.extractProcessNumber(text);
      expect(result).toBe('1234567-89.2023.1.23.4567');
    });
  });

  describe('cleanLegalDocument', () => {
    it('deve remover cabeçalhos repetidos', () => {
      const text = `
        TRIBUNAL DE JUSTIÇA DE SÃO PAULO
        Página 1 de 10

        Conteúdo importante do documento...

        TRIBUNAL DE JUSTIÇA DE SÃO PAULO
        Página 2 de 10

        Mais conteúdo importante...
      `;

      const result = textCleaner.cleanLegalDocument(text);

      expect(result.cleanedText).toContain('Conteúdo importante');
      expect(result.cleanedText).toContain('Mais conteúdo importante');
      // Deve remover ou reduzir repetições
      const headerCount = (result.cleanedText.match(/TRIBUNAL DE JUSTIÇA/g) || []).length;
      expect(headerCount).toBeLessThan(2);
    });

    it('deve remover numeração de página', () => {
      const text = `
        Conteúdo da página 1
        --- Página 1 de 5 ---
        Mais conteúdo
        --- Página 2 de 5 ---
        Conteúdo final
      `;

      const result = textCleaner.cleanLegalDocument(text);

      expect(result.cleanedText).toContain('Conteúdo da página');
      expect(result.cleanedText).toContain('Mais conteúdo');
      expect(result.cleanedText).not.toContain('Página 1 de 5');
      expect(result.cleanedText).not.toContain('Página 2 de 5');
    });

    it('deve normalizar espaçamentos', () => {
      const text = `
        Texto    com     espaços      irregulares



        E quebras    de linha    excessivas
      `;

      const result = textCleaner.cleanLegalDocument(text);

      expect(result.cleanedText).not.toContain('    ');
      expect(result.cleanedText).not.toContain('\n\n\n');
      expect(result.cleanedText.trim()).toBeTruthy();
    });

    it('deve preservar estrutura importante', () => {
      const text = `
        PETIÇÃO INICIAL

        1. DOS FATOS
        Narração dos fatos importantes...

        2. DO DIREITO
        Fundamentação jurídica...

        3. DOS PEDIDOS
        Pelos motivos expostos...
      `;

      const result = textCleaner.cleanLegalDocument(text);

      expect(result.cleanedText).toContain('PETIÇÃO INICIAL');
      expect(result.cleanedText).toContain('1. DOS FATOS');
      expect(result.cleanedText).toContain('2. DO DIREITO');
      expect(result.cleanedText).toContain('3. DOS PEDIDOS');
    });

    it('deve retornar estatísticas de limpeza', () => {
      const text = 'Texto de teste com 100 caracteres aproximadamente para verificar as estatísticas de limpeza';

      const result = textCleaner.cleanLegalDocument(text);

      expect(result).toHaveProperty('originalLength');
      expect(result).toHaveProperty('cleanedLength');
      expect(result).toHaveProperty('reductionPercentage');
      expect(result).toHaveProperty('patternsRemoved');
      expect(result).toHaveProperty('confidence');

      expect(result.originalLength).toBeGreaterThan(0);
      expect(result.cleanedLength).toBeGreaterThan(0);
      expect(result.reductionPercentage).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(result.patternsRemoved)).toBe(true);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });
});