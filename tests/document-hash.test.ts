// ================================================================
// TESTES UNITÁRIOS - Document Hash Manager
// ================================================================

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { DocumentHashManager } from '../lib/document-hash';
import crypto from 'crypto';

describe('DocumentHashManager', () => {
  let hashManager: DocumentHashManager;

  beforeEach(() => {
    hashManager = new DocumentHashManager();
  });

  describe('calculateSHA256', () => {
    it('deve calcular SHA256 corretamente para buffer válido', () => {
      const testData = 'Teste de conteúdo PDF';
      const buffer = Buffer.from(testData, 'utf-8');

      const result = hashManager.calculateSHA256(buffer);

      // Verificar estrutura do resultado
      expect(result).toHaveProperty('textSha');
      expect(result).toHaveProperty('size');
      expect(result).toHaveProperty('calculatedAt');

      // Verificar hash
      const expectedHash = crypto.createHash('sha256').update(buffer).digest('hex');
      expect(result.textSha).toBe(expectedHash);
      expect(result.size).toBe(buffer.length);
    });

    it('deve gerar hashes diferentes para conteúdos diferentes', () => {
      const buffer1 = Buffer.from('Conteúdo 1', 'utf-8');
      const buffer2 = Buffer.from('Conteúdo 2', 'utf-8');

      const result1 = hashManager.calculateSHA256(buffer1);
      const result2 = hashManager.calculateSHA256(buffer2);

      expect(result1.textSha).not.toBe(result2.textSha);
    });

    it('deve gerar mesmo hash para mesmo conteúdo', () => {
      const testData = 'Mesmo conteúdo';
      const buffer1 = Buffer.from(testData, 'utf-8');
      const buffer2 = Buffer.from(testData, 'utf-8');

      const result1 = hashManager.calculateSHA256(buffer1);
      const result2 = hashManager.calculateSHA256(buffer2);

      expect(result1.textSha).toBe(result2.textSha);
    });
  });

  describe('generateAnalysisKey', () => {
    it('deve gerar chave única para análise', () => {
      const textSha = 'abc123';
      const modelVersion = 'gemini-1.5-flash';
      const promptSignature = 'legal-analysis-v1';

      const key = hashManager.generateAnalysisKey(textSha, modelVersion, promptSignature);

      expect(key).toBeDefined();
      expect(typeof key).toBe('string');
      expect(key.length).toBe(64); // SHA256 hex length
    });

    it('deve gerar chaves diferentes para parâmetros diferentes', () => {
      const key1 = hashManager.generateAnalysisKey('sha1', 'model1', 'prompt1');
      const key2 = hashManager.generateAnalysisKey('sha2', 'model1', 'prompt1');
      const key3 = hashManager.generateAnalysisKey('sha1', 'model2', 'prompt1');

      expect(key1).not.toBe(key2);
      expect(key1).not.toBe(key3);
      expect(key2).not.toBe(key3);
    });
  });

  describe('generateContentHash', () => {
    it('deve normalizar e gerar hash do conteúdo', () => {
      const content = 'Este é um andamento do processo';
      const hash = hashManager.generateContentHash(content);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64);
    });

    it('deve gerar mesmo hash para conteúdos equivalentes', () => {
      const content1 = '  DESPACHO: Intimem-se as partes  ';
      const content2 = 'despacho: intimem-se as partes';

      const hash1 = hashManager.generateContentHash(content1);
      const hash2 = hashManager.generateContentHash(content2);

      // Deve ser igual após normalização
      expect(hash1).toBe(hash2);
    });
  });

  describe('normalizeForTimeline', () => {
    it('deve normalizar texto corretamente', () => {
      const input = '  DESPACHO: Intimem-se as partes! @#$  ';
      const result = hashManager.normalizeForTimeline(input);

      expect(result).toBe('despachointimemseaspartes');
      expect(result).not.toContain('@');
      expect(result).not.toContain('#');
      expect(result).not.toContain(' ');
      expect(result.trim()).toBe(result);
    });

    it('deve limitar tamanho do texto normalizado', () => {
      const longText = 'a'.repeat(1000);
      const result = hashManager.normalizeForTimeline(longText);

      expect(result.length).toBeLessThanOrEqual(500);
    });

    it('deve tratar textos vazios', () => {
      const result = hashManager.normalizeForTimeline('');
      expect(result).toBe('');
    });
  });
});

// Mock para Prisma nos testes de deduplicação
const mockPrisma = {
  caseDocument: {
    findFirst: jest.fn()
  }
};

describe('DocumentHashManager - Deduplication', () => {
  let hashManager: DocumentHashManager;

  beforeEach(() => {
    hashManager = new DocumentHashManager();
    jest.clearAllMocks();
  });

  describe('checkDeduplication', () => {
    it('deve retornar não duplicado quando documento não existe', async () => {
      mockPrisma.caseDocument.findFirst.mockResolvedValue(null);

      const result = await hashManager.checkDeduplication('testhash', 'workspace1', mockPrisma);

      expect(result.isDuplicate).toBe(false);
      expect(result.originalDocumentId).toBeUndefined();
    });

    it('deve retornar duplicado quando documento existe', async () => {
      const existingDoc = {
        id: 'doc123',
        name: 'documento.pdf',
        caseId: 'case123',
        createdAt: new Date(),
        case: {
          id: 'case123',
          title: 'Processo Teste',
          number: '1234567-89.2023.1.23.4567'
        }
      };

      mockPrisma.caseDocument.findFirst.mockResolvedValue(existingDoc);

      const result = await hashManager.checkDeduplication('testhash', 'workspace1', mockPrisma);

      expect(result.isDuplicate).toBe(true);
      expect(result.originalDocumentId).toBe('doc123');
      expect(result.originalDocument).toBeDefined();
      expect(result.originalDocument!.name).toBe('documento.pdf');
    });

    it('deve tratar erros graciosamente', async () => {
      mockPrisma.caseDocument.findFirst.mockRejectedValue(new Error('Database error'));

      const result = await hashManager.checkDeduplication('testhash', 'workspace1', mockPrisma);

      // Em caso de erro, deve assumir que não é duplicata
      expect(result.isDuplicate).toBe(false);
    });
  });
});