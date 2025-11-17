// ================================================================
// EXCEL UPLOAD DIALOG - COMPONENT
// ================================================================
// Componente de upload de Excel com validação pré-envio
//
// Fluxo:
// 1. Usuário seleciona/arrasta arquivo
// 2. Validação síncrona instantânea
// 3. Se erro: mostrar lista de erros + opção baixar CSV
// 4. Se sucesso: mostrar resumo + botão para processar
// 5. Processamento assíncrono no BullMQ

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
import {
  Upload,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  RotateCw,
} from 'lucide-react';
import { useExcelValidator, type ValidationErrorDetail } from '@/hooks/useExcelValidator';
import { ICONS } from '@/lib/icons';

// ===== TYPES =====

interface ExcelUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  onUploadSuccess?: (batchId: string) => void;
}

// ===== STATES =====

type DialogState = 'IDLE' | 'VALIDATING' | 'VALIDATION_FAILED' | 'UPLOADING' | 'UPLOAD_SUCCESS';

// ===== COMPONENT =====

export function ExcelUploadDialog({
  open,
  onOpenChange,
  workspaceId,
  onUploadSuccess,
}: ExcelUploadDialogProps) {
  // Hook de validação
  const validator = useExcelValidator();

  // Estado da dialog
  const [dialogState, setDialogState] = useState<DialogState>('IDLE');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // ===== DROPZONE =====

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      const file = acceptedFiles[0];

      // Validar tipo de arquivo
      if (!file.name.match(/\.(xlsx|xls)$/i)) {
        alert('Por favor, selecione um arquivo Excel (.xlsx ou .xls)');
        return;
      }

      // Validar tamanho
      if (file.size > 10 * 1024 * 1024) {
        alert('Arquivo muito grande (máximo 10MB)');
        return;
      }

      setSelectedFile(file);
      setDialogState('VALIDATING');

      // Iniciar validação
      const isValid = await validator.validate(file, workspaceId);

      if (isValid) {
        setDialogState('IDLE'); // Aguardando confirmação do usuário
      } else {
        setDialogState('VALIDATION_FAILED');
      }
    },
    [validator, workspaceId]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/vnd.ms-excel': ['.xls'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
    maxFiles: 1,
    disabled: validator.isValidating || validator.isUploading,
  });

  // ===== HANDLERS =====

  const handleUpload = async () => {
    setDialogState('UPLOADING');

    // Corrigir: passar workspaceId ao upload
    // TODO: Atualizar hook para aceitar workspaceId no upload()
    const success = await validator.upload();

    if (success && validator.uploadResult) {
      setDialogState('UPLOAD_SUCCESS');
      onUploadSuccess?.(validator.uploadResult.batchId);
    } else {
      setDialogState('VALIDATION_FAILED');
    }
  };

  const handleRetry = () => {
    validator.reset();
    setSelectedFile(null);
    setDialogState('IDLE');
  };

  const handleDownloadTemplate = () => {
    window.location.href = '/api/upload/excel/template';
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      validator.reset();
      setSelectedFile(null);
      setDialogState('IDLE');
    }
    onOpenChange(open);
  };

  // ===== RENDERIZAÇÃO =====

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>📊 Upload de Excel</DialogTitle>
          <DialogDescription>
            Suba um arquivo Excel com seus processos para enriquecer com dados do judiciário
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* ===== STAGE 1: IDLE (Select File) ===== */}
          {dialogState === 'IDLE' && !validator.isValid && (
            <>
              {/* Dropzone */}
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition ${
                  isDragActive
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p className="text-sm font-medium text-gray-700 mb-1">
                  Arraste seu arquivo Excel aqui ou clique para selecionar
                </p>
                <p className="text-xs text-gray-500">
                  Aceita: .xlsx, .xls | Máximo: 10MB
                </p>
              </div>

              {/* Botão para download de template */}
              <Card className="bg-blue-50 border-blue-200 p-4">
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-blue-900 text-sm mb-1">
                      Primeiro uso? Baixe nosso modelo de Excel
                    </p>
                    <p className="text-xs text-blue-700 mb-2">
                      O template contém todas as colunas necessárias com exemplos e instruções
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleDownloadTemplate}
                      className="border-blue-300 text-blue-700 hover:bg-blue-100"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Baixar Template
                    </Button>
                  </div>
                </div>
              </Card>
            </>
          )}

          {/* ===== STAGE 2: VALIDATING ===== */}
          {dialogState === 'VALIDATING' && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mr-3" />
              <p className="text-gray-700">Validando arquivo...</p>
            </div>
          )}

          {/* ===== STAGE 3: VALIDATION_FAILED ===== */}
          {dialogState === 'VALIDATION_FAILED' && validator.validationErrors && (
            <>
              {/* Mensagem de erro */}
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="ml-2">
                  {validator.validationMessage || 'Encontramos erros no seu arquivo'}
                </AlertDescription>
              </Alert>

              {/* Estatísticas */}
              {validator.validationStats && (
                <Card className="bg-red-50 border-red-200 p-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-red-600">
                        {validator.validationStats.totalRows}
                      </p>
                      <p className="text-xs text-red-700">Total de linhas</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-600">
                        {validator.validationStats.validRows}
                      </p>
                      <p className="text-xs text-green-700">Válidas</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-red-600">
                        {validator.validationStats.invalidRows}
                      </p>
                      <p className="text-xs text-red-700">Com erro</p>
                    </div>
                  </div>
                </Card>
              )}

              {/* Lista de erros */}
              <div className="max-h-96 overflow-y-auto">
                <h3 className="font-medium text-sm mb-2 text-gray-900">
                  Erros encontrados ({validator.validationErrors.length}):
                </h3>
                <div className="space-y-2">
                  {validator.validationErrors.slice(0, 20).map((error, idx) => (
                    <ErrorRow key={idx} error={error} />
                  ))}
                  {validator.validationErrors.length > 20 && (
                    <p className="text-xs text-gray-500 p-2">
                      ... e mais {validator.validationErrors.length - 20} erros
                    </p>
                  )}
                </div>
              </div>

              {/* Botões */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleRetry}
                  className="flex-1"
                >
                  <RotateCw className="w-4 h-4 mr-2" />
                  Tentar com Outro Arquivo
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => validator.downloadErrors()}
                  className="flex-1"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Baixar Erros (CSV)
                </Button>
              </div>
            </>
          )}

          {/* ===== STAGE 4: VALIDATION SUCCESS ===== */}
          {dialogState === 'IDLE' && validator.isValid && selectedFile && (
            <>
              {/* Confirmação de sucesso */}
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="ml-2 text-green-800">
                  {validator.validationMessage}
                </AlertDescription>
              </Alert>

              {/* Estatísticas */}
              {validator.validationStats && (
                <Card className="bg-green-50 border-green-200 p-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-blue-600">
                        {validator.validationStats.totalRows}
                      </p>
                      <p className="text-xs text-gray-700">Total de linhas</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-600">
                        {validator.validationStats.validRows}
                      </p>
                      <p className="text-xs text-green-700">Válidas ✓</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-600">
                        {selectedFile.size > 1024 * 1024
                          ? (selectedFile.size / 1024 / 1024).toFixed(1)
                          : (selectedFile.size / 1024).toFixed(1)}
                      </p>
                      <p className="text-xs text-gray-700">
                        {selectedFile.size > 1024 * 1024 ? 'MB' : 'KB'}
                      </p>
                    </div>
                  </div>
                </Card>
              )}

              {/* Info do arquivo */}
              <Card className="p-4 bg-gray-50">
                <p className="text-sm font-medium text-gray-900 mb-2">Arquivo selecionado:</p>
                <p className="text-sm text-gray-700">{selectedFile.name}</p>
              </Card>

              {/* Botões */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleRetry}
                  className="flex-1"
                  disabled={validator.isUploading}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleUpload}
                  disabled={validator.isUploading}
                  className="flex-1"
                >
                  {validator.isUploading && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  Continuar & Processar
                </Button>
              </div>
            </>
          )}

          {/* ===== STAGE 5: UPLOADING ===== */}
          {dialogState === 'UPLOADING' && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mr-3" />
              <p className="text-gray-700">Enviando arquivo para processamento...</p>
            </div>
          )}

          {/* ===== STAGE 6: UPLOAD SUCCESS ===== */}
          {dialogState === 'UPLOAD_SUCCESS' && validator.uploadResult && (
            <>
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="ml-2 text-green-800">
                  Arquivo enviado com sucesso! Processamento iniciado.
                </AlertDescription>
              </Alert>

              <Card className="bg-green-50 border-green-200 p-4">
                <h3 className="font-medium text-green-900 mb-3">📊 Resumo do Processamento</h3>
                <div className="space-y-2">
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Batch ID:</span> {validator.uploadResult.batchId}
                  </p>
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Processando:</span>{' '}
                    {validator.uploadResult.processing?.totalProcesses} processos
                  </p>
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Tempo estimado:</span>{' '}
                    {validator.uploadResult.processing?.estimatedTime}
                  </p>
                  <p className="text-sm text-gray-600 mt-3">
                    {validator.uploadResult.processing?.message}
                  </p>
                </div>
              </Card>

              <Button
                onClick={() => {
                  handleClose(false);
                }}
                className="w-full"
              >
                Fechar & Acompanhar Processamento
              </Button>
            </>
          )}

          {/* ===== ERROR ALERT ===== */}
          {validator.error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="ml-2">{validator.error}</AlertDescription>
            </Alert>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ===== SUB-COMPONENTS =====

interface ErrorRowProps {
  error: ValidationErrorDetail;
}

function ErrorRow({ error }: ErrorRowProps) {
  return (
    <div className="border border-red-200 rounded p-3 bg-red-50">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-mono text-xs text-red-600 mb-1">
            Linha {error.row} • {error.column}
          </p>
          <p className="text-sm text-red-800 font-medium">{error.error}</p>
          {error.value && (
            <p className="text-xs text-red-600 mt-1">
              Valor: <code className="bg-red-100 px-1 rounded">{String(error.value).substring(0, 50)}</code>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
