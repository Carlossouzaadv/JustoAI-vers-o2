// ================================================================
// HOOK: useExcelValidator
// ================================================================
// Encapsula toda a lógica de validação + upload de Excel
//
// Responsabilidades:
// 1. Validação síncrona (POST /api/upload/excel/validate)
// 2. Coleta de erros em formato amigável
// 3. Upload real (POST /api/upload/excel) se validação passou
// 4. Gestão de estado (validando, enviando, sucesso, erro)
// 5. Type-safe com tipos do backend

'use client';

import { useState, useCallback } from 'react';

// ===== TYPES =====

export interface ValidationErrorDetail {
  row: number;
  column: string;
  value: unknown;
  error: string;
}

export interface ValidationStatistics {
  totalRows: number;
  validRows: number;
  invalidRows: number;
}

export interface UploadResult {
  batchId: string;
  summary: {
    valid: number;
    invalid: number;
    duplicates: number;
    warnings: number;
  };
  processing: {
    status: string;
    totalProcesses: number;
    estimatedTime: string;
    message: string;
  };
}

export interface ExcelValidatorState {
  // Validação
  isValidating: boolean;
  validationErrors: ValidationErrorDetail[] | null;
  validationStats: ValidationStatistics | null;
  validationMessage: string | null;

  // Upload
  isUploading: boolean;
  uploadProgress: number;
  uploadResult: UploadResult | null;

  // Estado geral
  currentFile: File | null;
  error: string | null;

  // Flags de estado
  hasValidated: boolean;
  isValid: boolean;
}

export interface UseExcelValidatorReturn extends ExcelValidatorState {
  // Ações
  validate: (file: File, workspaceId: string) => Promise<boolean>;
  upload: () => Promise<boolean>;
  reset: () => void;
  downloadErrors: () => void; // Baixar CSV com erros
}

// ===== HOOK =====

export function useExcelValidator(): UseExcelValidatorReturn {
  // ===== STATE =====
  const [state, setState] = useState<ExcelValidatorState>({
    // Validação
    isValidating: false,
    validationErrors: null,
    validationStats: null,
    validationMessage: null,

    // Upload
    isUploading: false,
    uploadProgress: 0,
    uploadResult: null,

    // Estado geral
    currentFile: null,
    error: null,

    // Flags
    hasValidated: false,
    isValid: false,
  });

  // ===== MÉTODOS =====

  /**
   * Valida arquivo contra schema backend
   * Retorna true se válido, false se houver erros
   */
  const validate = useCallback(
    async (file: File, workspaceId: string): Promise<boolean> => {
      // Limpar estado anterior
      setState((prev) => ({
        ...prev,
        isValidating: true,
        error: null,
        validationErrors: null,
        validationStats: null,
        validationMessage: null,
      }));

      try {
        // Criar FormData
        const formData = new FormData();
        formData.append('file', file);
        formData.append('workspaceId', workspaceId);

        // POST /api/upload/excel/validate (síncrono)
        const response = await fetch('/api/upload/excel/validate', {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });

        // Parse resposta
        const data: unknown = await response.json();

        // Type guard para resposta
        if (!isValidationResponse(data)) {
          throw new Error('Resposta inválida do servidor');
        }

        // Atualizar estado baseado na resposta
        const isValid = response.status === 200 && data.success;

        setState((prev) => ({
          ...prev,
          isValidating: false,
          currentFile: file,
          hasValidated: true,
          isValid,
          validationMessage: data.message,
          validationErrors: data.errors || null,
          validationStats: data.statistics || null,
          error: isValid ? null : data.message,
        }));

        return isValid;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro ao validar arquivo';

        setState((prev) => ({
          ...prev,
          isValidating: false,
          error: message,
          hasValidated: true,
          isValid: false,
        }));

        return false;
      }
    },
    []
  );

  /**
   * Envia arquivo validado para processamento
   * Deve ser chamado DEPOIS de validate() com sucesso
   */
  const upload = useCallback(async (): Promise<boolean> => {
    if (!state.currentFile) {
      setState((prev) => ({
        ...prev,
        error: 'Nenhum arquivo selecionado',
      }));
      return false;
    }

    if (!state.isValid) {
      setState((prev) => ({
        ...prev,
        error: 'Arquivo não foi validado com sucesso',
      }));
      return false;
    }

    setState((prev) => ({
      ...prev,
      isUploading: true,
      error: null,
      uploadProgress: 0,
    }));

    try {
      const formData = new FormData();
      formData.append('file', state.currentFile);
      // workspaceId foi usado na validação, mas não temos acesso aqui
      // TODO: Passar workspaceId como parâmetro para upload()

      const response = await fetch('/api/upload/excel', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      const data: unknown = await response.json();

      if (!isUploadResponse(data)) {
        throw new Error('Resposta inválida do servidor');
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro ao enviar arquivo');
      }

      setState((prev) => ({
        ...prev,
        isUploading: false,
        uploadProgress: 100,
        uploadResult: data,
      }));

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao enviar arquivo';

      setState((prev) => ({
        ...prev,
        isUploading: false,
        error: message,
      }));

      return false;
    }
  }, [state.currentFile, state.isValid]);

  /**
   * Reset completo do estado
   */
  const reset = useCallback(() => {
    setState({
      // Validação
      isValidating: false,
      validationErrors: null,
      validationStats: null,
      validationMessage: null,

      // Upload
      isUploading: false,
      uploadProgress: 0,
      uploadResult: null,

      // Estado geral
      currentFile: null,
      error: null,

      // Flags
      hasValidated: false,
      isValid: false,
    });
  }, []);

  /**
   * Baixa CSV com erros para o usuário corrigir
   */
  const downloadErrors = useCallback(() => {
    if (!state.validationErrors || state.validationErrors.length === 0) {
      alert('Nenhum erro para baixar');
      return;
    }

    // Criar CSV com headers
    const headers = ['Linha', 'Campo', 'Valor', 'Erro'];
    const rows = state.validationErrors.map((e) => [
      e.row.toString(),
      e.column,
      String(e.value),
      e.error,
    ]);

    // Formatear CSV com escape de aspas
    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        row
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(',')
      ),
    ].join('\n');

    // Criar blob e download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `erros_validacao_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [state.validationErrors]);

  // ===== RETORNO =====
  return {
    // Estado
    ...state,

    // Métodos
    validate,
    upload,
    reset,
    downloadErrors,
  };
}

// ===== TYPE GUARDS =====

function isValidationResponse(
  data: unknown
): data is {
  success: boolean;
  message: string;
  errors?: ValidationErrorDetail[];
  statistics?: ValidationStatistics;
} {
  return (
    typeof data === 'object' &&
    data !== null &&
    'success' in data &&
    typeof (data as Record<string, unknown>).success === 'boolean' &&
    'message' in data &&
    typeof (data as Record<string, unknown>).message === 'string' &&
    'statistics' in data
  );
}

function isUploadResponse(
  data: unknown
): data is {
  success: boolean;
  error?: string;
  batchId?: string;
  summary?: { valid: number; invalid: number; duplicates: number; warnings: number };
  processing?: { status: string; totalProcesses: number; estimatedTime: string; message: string };
} {
  return (
    typeof data === 'object' &&
    data !== null &&
    'success' in data &&
    typeof (data as Record<string, unknown>).success === 'boolean'
  );
}
