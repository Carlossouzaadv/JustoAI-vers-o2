'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, Loader2, AlertTriangle } from 'lucide-react';
import { OnboardingProgress } from './onboarding-progress';
import { ICONS } from '@/lib/icons';

// Type Guards and Type Definitions
interface UploadResultFile {
  name?: string;
  size?: number;
  textLength?: number;
}

interface UploadResultProcessing {
  totalTime?: number;
}

interface UploadResult {
  caseId: string;
  juditJobId?: string;
  extractedProcessNumber?: string;
  analysis?: unknown;
  file?: UploadResultFile;
  processing?: UploadResultProcessing;
}

// Type Guard for UploadResult
function isUploadResult(data: unknown): data is UploadResult {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const obj = data as Record<string, unknown>;
  return typeof obj.caseId === 'string';
}

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (_open: boolean) => void;
  workspaceId: string;
  onUploadSuccess?: (_data: UploadResult) => void;
}

export function UploadDialog({ open, onOpenChange, workspaceId, onUploadSuccess }: UploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setError(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    disabled: uploading
  });

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('workspaceId', workspaceId);

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        // NARROWING SEGURO para errorData - SEM casting
        const errorData: unknown = await response.json();
        let errorMessage = `Upload failed: ${response.statusText}`;

        // Validar estrutura de errorData com narrowing seguro
        if (typeof errorData === 'object' && errorData !== null && 'error' in errorData) {
          const err = (errorData as Record<string, unknown>).error;
          if (typeof err === 'string') {
            errorMessage = err;
          }
        }

        throw new Error(errorMessage);
      }

      // NARROWING SEGURO para result - SEM casting
      const result: unknown = await response.json();

      // Validar que result é um objeto
      if (typeof result !== 'object' || result === null) {
        throw new Error('Invalid API response: expected object');
      }

      // Validar que result tem a propriedade 'data'
      if (!('data' in result)) {
        throw new Error('Invalid API response: missing "data" field');
      }

      // Extrair data com segurança
      const data = (result as Record<string, unknown>).data;

      // Aplicar type guard para validação final
      if (!isUploadResult(data)) {
        throw new Error('Invalid upload response format');
      }

      setUploadProgress(100);
      setUploadResult(data);
      onUploadSuccess?.(data);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (!uploading) {
      setFile(null);
      setUploadResult(null);
      setError(null);
      setUploadProgress(0);
      onOpenChange(false);
    }
  };

  const handleAnalyze = async () => {
    // Type guard check with narrowing
    if (!uploadResult || !isUploadResult(uploadResult)) {
      return;
    }

    try {
      // Navigate to process page with analysis tab open
      window.location.href = `/dashboard/process/${uploadResult.caseId}?tab=analysis`;
    } catch (err) {
      console.error('Error navigating to analysis:', err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload de Documento PDF</DialogTitle>
          <DialogDescription>
            Faça upload de um documento PDF para iniciar o fluxo de onboarding completo
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Seção 1: Selecionar Arquivo */}
          {!uploadResult && (
            <>
              <div
                {...getRootProps()}
                className={`
                  border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                  transition-colors duration-200
                  ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
                  ${uploading ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-400'}
                `}
              >
                <input {...getInputProps()} />

                <Upload className="w-10 h-10 mx-auto text-gray-400 mb-2" />
                <p className="text-sm font-medium text-gray-900 mb-1">
                  {isDragActive
                    ? 'Solte o arquivo aqui'
                    : 'Arraste um arquivo PDF aqui ou clique para selecionar'}
                </p>
                <p className="text-xs text-gray-500">Máximo 100MB</p>

                {file && (
                  <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
                    <p className="text-sm text-blue-900 font-medium">
                      {ICONS.DOCUMENT} {file.name}
                    </p>
                    <p className="text-xs text-blue-700">
                      {(file.size / 1024 / 1024).toFixed(2)}MB
                    </p>
                  </div>
                )}
              </div>

              {error && (
                <Alert className="bg-red-50 border-red-200">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              <Button
                onClick={handleUpload}
                disabled={!file || uploading}
                className="w-full bg-blue-600 hover:bg-blue-700"
                size="lg"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enviando... ({uploadProgress}%)
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Enviar PDF
                  </>
                )}
              </Button>
            </>
          )}

          {/* Seção 2: Progresso das Fases */}
          {(uploading || uploadResult) && (
            <div className="space-y-4">
              {uploadResult && isUploadResult(uploadResult) && (
                <>
                  <OnboardingProgress
                    caseId={uploadResult.caseId}
                    juditJobId={uploadResult.juditJobId}
                    extractedProcessNumber={uploadResult.extractedProcessNumber}
                    previewData={uploadResult.analysis}
                    onPhaseComplete={(phase) => {
                      if (phase === 'ENRICHMENT') {
                        console.log('FASE 2 concluída, FASE 3 disponível');
                      }
                    }}
                    onAnalyzeClick={handleAnalyze}
                  />

                  {/* Informações Extras */}
                  <Card className="p-4 bg-gray-50">
                    <h4 className="font-semibold text-sm mb-3">Resumo do Upload</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Arquivo</p>
                        <p className="font-medium">{file?.name}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Tamanho</p>
                        <p className="font-medium">
                          {uploadResult.file?.size
                            ? `${(uploadResult.file.size / 1024 / 1024).toFixed(2)}MB`
                            : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Texto Extraído</p>
                        <p className="font-medium">
                          {uploadResult.file?.textLength?.toLocaleString() || '0'} caracteres
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Tempo Total</p>
                        <p className="font-medium">
                          {uploadResult.processing?.totalTime
                            ? `${(uploadResult.processing.totalTime / 1000).toFixed(1)}s`
                            : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </Card>
                </>
              )}
            </div>
          )}

          {/* Botões de Ação */}
          <div className="flex gap-3 justify-end pt-4 border-t">
            {uploadResult && isUploadResult(uploadResult) ? (
              <>
                <Button
                  variant="outline"
                  onClick={handleClose}
                  disabled={uploading}
                >
                  Fechar
                </Button>
                <Button
                  onClick={handleAnalyze}
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={uploading}
                >
                  Ver Detalhes do Processo
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={handleClose}
                  disabled={uploading}
                >
                  Cancelar
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
