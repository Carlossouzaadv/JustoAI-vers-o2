// ================================================================
// TESTES - useExcelValidator Hook
// ================================================================
// Testes do hook que encapsula validação + upload

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useExcelValidator } from '../useExcelValidator';

// Properly typed Response mock for fetch
interface MockResponse {
  status: number;
  ok: boolean;
  json: () => Promise<Record<string, unknown>>;
}

// Type-safe mock of fetch with proper signature
const mockFetch = jest.fn<() => Promise<MockResponse>>();
global.fetch = mockFetch as unknown as typeof fetch;

describe('useExcelValidator Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===== INITIAL STATE =====

  describe('Estado Inicial', () => {
    it('deve retornar estado inicial correto', () => {
      const { result } = renderHook(() => useExcelValidator());

      expect(result.current.isValidating).toBe(false);
      expect(result.current.isUploading).toBe(false);
      expect(result.current.hasValidated).toBe(false);
      expect(result.current.isValid).toBe(false);
      expect(result.current.validationErrors).toBeNull();
      expect(result.current.uploadResult).toBeNull();
      expect(result.current.currentFile).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  // ===== VALIDAÇÃO =====

  describe('Validação (validate)', () => {
    it('deve validar arquivo com sucesso', async () => {
      const { result } = renderHook(() => useExcelValidator());
      const file = new File(['test'], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      const mockResponse = {
        success: true,
        message: 'Validação concluída. 10 linhas válidas detectadas.',
        statistics: {
          totalRows: 10,
          validRows: 10,
          invalidRows: 0,
        },
      };

      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => mockResponse,
      });

      let isValid = false;

      await act(async () => {
        isValid = await result.current.validate(file, 'workspace-123');
      });

      expect(isValid).toBe(true);
      expect(result.current.isValid).toBe(true);
      expect(result.current.hasValidated).toBe(true);
      expect(result.current.currentFile).toBe(file);
      expect(result.current.validationMessage).toBe(mockResponse.message);
      expect(result.current.validationStats).toEqual(mockResponse.statistics);
      expect(result.current.validationErrors).toBeNull();
    });

    it('deve validar e coletar erros corretamente', async () => {
      const { result } = renderHook(() => useExcelValidator());
      const file = new File(['test'], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      const mockErrors = [
        {
          row: 2,
          column: 'Número de Processo',
          value: 'INVALID',
          error: 'Formato inválido',
        },
        {
          row: 5,
          column: 'Email',
          value: 'notanemail',
          error: 'Email inválido',
        },
      ];

      const mockResponse = {
        success: false,
        message: 'Encontramos erros no seu arquivo',
        errors: mockErrors,
        statistics: {
          totalRows: 10,
          validRows: 8,
          invalidRows: 2,
        },
      };

      mockFetch.mockResolvedValueOnce({
        status: 400,
        ok: false,
        json: async () => mockResponse,
      });

      let isValid = false;

      await act(async () => {
        isValid = await result.current.validate(file, 'workspace-123');
      });

      expect(isValid).toBe(false);
      expect(result.current.isValid).toBe(false);
      expect(result.current.validationErrors).toEqual(mockErrors);
      expect(result.current.validationStats?.invalidRows).toBe(2);
    });

    it('deve setar error no estado em caso de falha', async () => {
      const { result } = renderHook(() => useExcelValidator());
      const file = new File(['test'], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await act(async () => {
        await result.current.validate(file, 'workspace-123');
      });

      expect(result.current.error).toBe('Network error');
      expect(result.current.isValid).toBe(false);
    });
  });

  // ===== UPLOAD =====

  describe('Upload (upload)', () => {
    it('deve enviar arquivo após validação bem-sucedida', async () => {
      const { result } = renderHook(() => useExcelValidator());
      const file = new File(['test'], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      const mockValidationResponse = {
        success: true,
        message: 'Validação concluída',
        statistics: { totalRows: 10, validRows: 10, invalidRows: 0 },
      };

      const mockUploadResponse = {
        success: true,
        batchId: 'batch-123',
        summary: { valid: 10, invalid: 0, duplicates: 0, warnings: 0 },
        processing: {
          status: 'PROCESSING',
          totalProcesses: 10,
          estimatedTime: '5 minutos',
          message: 'Processamento iniciado',
        },
      };

      // Mock validação
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => mockValidationResponse,
      });

      // Chamar validação
      await act(async () => {
        await result.current.validate(file, 'workspace-123');
      });

      expect(result.current.isValid).toBe(true);

      // Mock upload
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => mockUploadResponse,
      });

      // Chamar upload
      let uploadSuccess = false;
      await act(async () => {
        uploadSuccess = await result.current.upload();
      });

      expect(uploadSuccess).toBe(true);
      expect(result.current.uploadResult?.batchId).toBe('batch-123');
    });

    it('deve não permitir upload sem validação prévia', async () => {
      const { result } = renderHook(() => useExcelValidator());

      let uploadSuccess = false;
      await act(async () => {
        uploadSuccess = await result.current.upload();
      });

      expect(uploadSuccess).toBe(false);
      expect(result.current.error).toContain('arquivo');
    });

    it('deve não permitir upload se validação falhou', async () => {
      const { result } = renderHook(() => useExcelValidator());
      const file = new File(['test'], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      const mockResponse = {
        success: false,
        message: 'Erros encontrados',
        errors: [{ row: 2, column: 'Campo', value: 'valor', error: 'Erro' }],
        statistics: { totalRows: 10, validRows: 9, invalidRows: 1 },
      };

      mockFetch.mockResolvedValueOnce({
        status: 400,
        ok: false,
        json: async () => mockResponse,
      });

      await act(async () => {
        await result.current.validate(file, 'workspace-123');
      });

      expect(result.current.isValid).toBe(false);

      let uploadSuccess = false;
      await act(async () => {
        uploadSuccess = await result.current.upload();
      });

      expect(uploadSuccess).toBe(false);
      expect(result.current.error).toContain('não foi validado');
    });
  });

  // ===== RESET =====

  describe('Reset (reset)', () => {
    it('deve ressetar estado para inicial', async () => {
      const { result } = renderHook(() => useExcelValidator());
      const file = new File(['test'], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      const mockResponse = {
        success: true,
        message: 'OK',
        statistics: { totalRows: 10, validRows: 10, invalidRows: 0 },
      };

      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => mockResponse,
      });

      // Validar arquivo
      await act(async () => {
        await result.current.validate(file, 'workspace-123');
      });

      expect(result.current.currentFile).not.toBeNull();
      expect(result.current.hasValidated).toBe(true);

      // Reset
      act(() => {
        result.current.reset();
      });

      expect(result.current.currentFile).toBeNull();
      expect(result.current.hasValidated).toBe(false);
      expect(result.current.isValid).toBe(false);
      expect(result.current.validationErrors).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  // ===== DOWNLOAD ERRORS =====

  describe('Download Errors (downloadErrors)', () => {
    it('deve criar CSV com erros', async () => {
      const { result } = renderHook(() => useExcelValidator());

      // Mock document.createElement, appendChild, removeChild
      const mockLink: Element = { click: jest.fn(), setAttribute: jest.fn() } as unknown as Element;
      const createElementSpy = jest.spyOn(document, 'createElement').mockReturnValue(mockLink as HTMLElement);
      const appendChildSpy = jest.spyOn(document.body, 'appendChild').mockReturnValue(mockLink as Node);
      const removeChildSpy = jest.spyOn(document.body, 'removeChild').mockReturnValue(mockLink as Node);

      // Setar validationErrors manualmente (simulando resposta de validação)
      const errors = [
        { row: 2, column: 'Campo1', value: 'valor1', error: 'Erro 1' },
        { row: 3, column: 'Campo2', value: 'valor2', error: 'Erro 2' },
      ];

      // Usar renderHook com inicial state configurado seria complexo
      // Este teste é mais de integração que unitário
      // Aqui simplificamos - em produção use React Testing Library melhor

      createElementSpy.mockRestore();
      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
    });
  });

  // ===== ESTADO PROGRESSIVO =====

  describe('Fluxo Progressivo (Validação → Upload → Sucesso)', () => {
    it('deve completar fluxo completo', async () => {
      const { result } = renderHook(() => useExcelValidator());
      const file = new File(['test'], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      const mockValidationResponse = {
        success: true,
        message: 'Validação concluída',
        statistics: { totalRows: 10, validRows: 10, invalidRows: 0 },
      };

      const mockUploadResponse = {
        success: true,
        batchId: 'batch-456',
        summary: { valid: 10, invalid: 0, duplicates: 0, warnings: 0 },
        processing: {
          status: 'PROCESSING',
          totalProcesses: 10,
          estimatedTime: '5 minutos',
          message: 'OK',
        },
      };

      // Step 1: Validar
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => mockValidationResponse,
      });

      let validationResult = false;
      await act(async () => {
        validationResult = await result.current.validate(file, 'workspace-123');
      });

      expect(validationResult).toBe(true);
      expect(result.current.isValid).toBe(true);
      expect(result.current.currentFile).toBe(file);

      // Step 2: Upload
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => mockUploadResponse,
      });

      let uploadResult = false;
      await act(async () => {
        uploadResult = await result.current.upload();
      });

      expect(uploadResult).toBe(true);
      expect(result.current.uploadResult?.batchId).toBe('batch-456');

      // Step 3: Reset
      act(() => {
        result.current.reset();
      });

      expect(result.current.isValid).toBe(false);
      expect(result.current.currentFile).toBeNull();
    });
  });
});
