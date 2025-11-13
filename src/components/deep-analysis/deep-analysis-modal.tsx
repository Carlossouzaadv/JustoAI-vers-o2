'use client';

import React, { useState, useCallback, useEffect } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { ICONS } from '@/lib/icons';

export interface DeepAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  processId: string;
  workspaceId: string;
  existingDocuments?: Array<{
    id: string;
    name: string;
    size: number;
    uploadedAt: string;
  }>;
  onAnalysisComplete?: () => void;
}

type AnalysisType = 'FAST' | 'FULL';

interface UploadedFile {
  file: File;
  id: string;
  progress: number;
  status: 'uploading' | 'uploaded' | 'error';
}

export function DeepAnalysisModal({
  isOpen,
  onClose,
  processId,
  workspaceId,
  existingDocuments = [],
  onAnalysisComplete
}: DeepAnalysisModalProps) {
  const [analysisType, setAnalysisType] = useState<AnalysisType>('FAST');
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [selectedExistingFiles, setSelectedExistingFiles] = useState<string[]>([]);
  const [useExistingFiles, setUseExistingFiles] = useState(true);
  const [processingStep, setProcessingStep] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [credits, setCredits] = useState<{
    available: number;
    needed: number;
    sufficient: boolean;
  } | null>(null);
  const [cacheStatus, setCacheStatus] = useState<{
    hasCachedAnalysis: boolean;
    lastAnalysisDate: string | null;
    cacheAge: string | null;
    documentsChanged: boolean;
  } | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: UploadedFile[] = acceptedFiles.map(file => ({
      file,
      id: `${Date.now()}-${Math.random()}`,
      progress: 0,
      status: 'uploading' as const
    }));

    setUploadedFiles(prev => [...prev, ...newFiles]);

    // Simulate upload progress
    newFiles.forEach(uploadFile => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 20;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          setUploadedFiles(prev =>
            prev.map(f => f.id === uploadFile.id
              ? { ...f, progress: 100, status: 'uploaded' }
              : f
            )
          );
        } else {
          setUploadedFiles(prev =>
            prev.map(f => f.id === uploadFile.id
              ? { ...f, progress }
              : f
            )
          );
        }
      }, 200);
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: true,
    disabled: isProcessing
  });

  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const toggleExistingFile = (fileId: string) => {
    setSelectedExistingFiles(prev =>
      prev.includes(fileId)
        ? prev.filter(id => id !== fileId)
        : [...prev, fileId]
    );
  };

  const estimateCredits = useCallback(async () => {
    if (analysisType === 'FAST') {
      setCredits({ available: 999, needed: 0, sufficient: true });
      return;
    }

    try {
      const totalFiles = useExistingFiles ? selectedExistingFiles.length : uploadedFiles.length;
      const creditsNeeded = Math.ceil(totalFiles / 10); // 10 docs per credit

      // Mock credit check - replace with real API call
      setCredits({
        available: 5, // Mock available credits
        needed: creditsNeeded,
        sufficient: creditsNeeded <= 5
      });
    } catch (error) {
      console.error('Error estimating credits:', error);
    }
  }, [analysisType, useExistingFiles, selectedExistingFiles.length, uploadedFiles.length]);

  const checkCacheStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/process/${processId}/analysis/cache-status?workspaceId=${workspaceId}`);
      const data = await response.json();

      if (data.success) {
        setCacheStatus(data.cacheStatus);
      }
    } catch (error) {
      console.error('Error checking cache status:', error);
    }
  }, [processId, workspaceId]);

  const startAnalysis = async () => {
    setIsProcessing(true);
    setError(null);
    setProgress(0);

    try {
      if (analysisType === 'FAST') {
        await runFastAnalysis();
      } else {
        await runFullAnalysis();
      }
    } catch (error) {
      console.error('Analysis failed:', error);
      setError(error instanceof Error ? error.message : 'Erro na análise');
    } finally {
      setIsProcessing(false);
    }
  };

  const runFastAnalysis = async () => {
    setProcessingStep('Verificando cache...');
    setProgress(20);

    const response = await fetch(`/api/process/${processId}/analysis/fast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId,
        forceReprocessing: false
      })
    });

    setProgress(50);
    const result = await response.json();

    if (result.fromCache) {
      setProcessingStep('Carregando análise do cache...');
      setProgress(80);
      await new Promise(resolve => setTimeout(resolve, 500)); // Short delay for UX
    } else {
      setProcessingStep('Processando nova análise...');
      setProgress(70);
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate processing
    }

    if (!result.success) {
      throw new Error(result.error || 'Erro na análise FAST');
    }

    setProgress(100);
    setProcessingStep(result.fromCache ? 'Análise carregada do cache!' : 'Análise concluída!');

    setTimeout(() => {
      onAnalysisComplete?.();
      onClose();
    }, 1000);
  };

  const runFullAnalysis = async () => {
    setProcessingStep('Preparando arquivos...');
    setProgress(10);

    const formData = new FormData();
    formData.append('workspaceId', workspaceId);

    if (useExistingFiles) {
      formData.append('useExistingFiles', 'true');
      selectedExistingFiles.forEach(fileId => {
        formData.append('existingFileIds', fileId);
      });
    } else {
      formData.append('useExistingFiles', 'false');
      uploadedFiles.forEach((uploadFile, index) => {
        formData.append(`file_${index}`, uploadFile.file);
      });
    }

    setProgress(30);
    setProcessingStep('Enviando para análise...');

    const response = await fetch(`/api/process/${processId}/analysis/full`, {
      method: 'POST',
      body: formData
    });

    setProgress(60);
    setProcessingStep('Processando com Gemini Pro...');

    const result = await response.json();

    if (!result.success) {
      if (response.status === 402) {
        throw new Error(`Créditos insuficientes. Necessário: ${result.required}, Disponível: ${result.available}`);
      }
      throw new Error(result.error || 'Erro na análise FULL');
    }

    setProgress(100);
    setProcessingStep('Análise FULL concluída!');

    setTimeout(() => {
      onAnalysisComplete?.();
      onClose();
    }, 1000);
  };

  const resetModal = () => {
    setAnalysisType('FAST');
    setUploadedFiles([]);
    setSelectedExistingFiles([]);
    setUseExistingFiles(true);
    setIsProcessing(false);
    setProgress(0);
    setProcessingStep('');
    setError(null);
    setCredits(null);
    setCacheStatus(null);
  };

  const handleClose = () => {
    if (!isProcessing) {
      resetModal();
      onClose();
    }
  };

  // Update credits and cache status when analysis type or files change
  useEffect(() => {
    if (isOpen) {
      estimateCredits();
      if (analysisType === 'FAST') {
        checkCacheStatus();
      }
    }
  }, [analysisType, uploadedFiles.length, selectedExistingFiles.length, useExistingFiles, isOpen, processId, estimateCredits, checkCacheStatus]);

  const canStartAnalysis = () => {
    if (isProcessing) return false;

    if (analysisType === 'FAST') {
      return existingDocuments.length > 0;
    }

    if (useExistingFiles) {
      return selectedExistingFiles.length > 0 && credits?.sufficient;
    }

    return uploadedFiles.filter(f => f.status === 'uploaded').length > 0 && credits?.sufficient;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {ICONS.PROCESS} Aprofundar Análise
          </DialogTitle>
          <DialogDescription>
            Escolha o tipo de análise para obter insights mais detalhados sobre o processo.
          </DialogDescription>
        </DialogHeader>

        {/* Processing State */}
        {isProcessing && (
          <Card className="p-6">
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-lg font-medium">{processingStep}</div>
                <div className="text-sm text-gray-500">Aguarde enquanto processamos sua análise...</div>
              </div>
              <Progress value={progress} className="w-full" />
              <div className="text-center text-sm text-gray-600">
                {progress}% concluído
              </div>
            </div>
          </Card>
        )}

        {/* Error State */}
        {error && !isProcessing && (
          <Card className="p-4 border-red-200 bg-red-50">
            <div className="flex items-center gap-2 text-red-700">
              <span>{ICONS.ERROR}</span>
              <span className="font-medium">Erro na análise</span>
            </div>
            <div className="text-red-600 text-sm mt-1">{error}</div>
          </Card>
        )}

        {/* Main Content */}
        {!isProcessing && (
          <div className="space-y-6">
            {/* Analysis Type Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card
                className={`p-4 cursor-pointer border-2 transition-colors ${
                  analysisType === 'FAST'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setAnalysisType('FAST')}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    <div className={`w-4 h-4 rounded-full border-2 ${
                      analysisType === 'FAST'
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-gray-300'
                    }`}>
                      {analysisType === 'FAST' && (
                        <div className="w-full h-full rounded-full bg-white scale-50" />
                      )}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Análise FAST</h3>
                    <p className="text-sm text-gray-600">
                      Análise rápida usando documentos já anexados
                    </p>
                    <div className="mt-2 space-y-1 text-xs text-gray-500">
                      <div>{ICONS.SUCCESS} Usa documentos existentes</div>
                      <div>{ICONS.SUCCESS} Sem custo de créditos</div>
                      <div>{ICONS.SUCCESS} Resultado em segundos</div>
                      <div>{ICONS.SUCCESS} Modelo: Gemini Flash</div>
                      {cacheStatus?.hasCachedAnalysis && (
                        <div className="text-blue-600 font-medium">
                          {ICONS.SUCCESS} Cache disponível - resultado instantâneo
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Card>

              <Card
                className={`p-4 cursor-pointer border-2 transition-colors ${
                  analysisType === 'FULL'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setAnalysisType('FULL')}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    <div className={`w-4 h-4 rounded-full border-2 ${
                      analysisType === 'FULL'
                        ? 'border-green-500 bg-green-500'
                        : 'border-gray-300'
                    }`}>
                      {analysisType === 'FULL' && (
                        <div className="w-full h-full rounded-full bg-white scale-50" />
                      )}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Análise FULL</h3>
                    <p className="text-sm text-gray-600">
                      Análise completa com upload de novos PDFs
                    </p>
                    <div className="mt-2 space-y-1 text-xs text-gray-500">
                      <div>{ICONS.SUCCESS} Upload de novos PDFs</div>
                      <div>{ICONS.SUCCESS} Análise mais profunda</div>
                      <div>{ICONS.SUCCESS} Modelo: Gemini Pro</div>
                      <div className="text-orange-600">
                        {ICONS.WARNING} Consome créditos FULL
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Credit Information */}
            {credits && analysisType === 'FULL' && (
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Créditos necessários</div>
                    <div className="text-sm text-gray-600">
                      {credits.needed} créditos FULL de {credits.available} disponíveis
                    </div>
                  </div>
                  <div className={`font-bold ${
                    credits.sufficient ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {credits.sufficient ? (
                      <span>{ICONS.SUCCESS} Suficiente</span>
                    ) : (
                      <span>{ICONS.ERROR} Insuficiente</span>
                    )}
                  </div>
                </div>
              </Card>
            )}

            {/* Cache Status and File Selection for FAST */}
            {analysisType === 'FAST' && (
              <div className="space-y-4">
                {/* Cache Status */}
                {cacheStatus && (
                  <Card className={`p-4 ${
                    cacheStatus.hasCachedAnalysis ? 'border-green-200 bg-green-50' : 'border-gray-200'
                  }`}>
                    <div className="flex items-start gap-3">
                      <div className={`mt-1 ${
                        cacheStatus.hasCachedAnalysis ? 'text-green-600' : 'text-gray-500'
                      }`}>
                        {cacheStatus.hasCachedAnalysis ? ICONS.SUCCESS : ICONS.INFO}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-sm mb-1">Status do Cache</h4>
                        {cacheStatus.hasCachedAnalysis ? (
                          <div className="space-y-1">
                            <p className="text-sm text-green-700">
                              ✅ Análise em cache disponível - resultado instantâneo
                            </p>
                            {cacheStatus.lastAnalysisDate && (
                              <p className="text-xs text-green-600">
                                Última análise: {new Date(cacheStatus.lastAnalysisDate).toLocaleDateString('pt-BR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                                {cacheStatus.cacheAge && ` (${cacheStatus.cacheAge})`}
                              </p>
                            )}
                            {cacheStatus.documentsChanged && (
                              <p className="text-xs text-orange-600">
                                ⚠️ Documentos foram alterados desde a última análise
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <p className="text-sm text-gray-600">
                              Nenhuma análise em cache - será processada nova análise
                            </p>
                            <p className="text-xs text-gray-500">
                              Primeira análise deste processo levará alguns segundos
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                )}

                {/* Documents List */}
                <Card className="p-4">
                  <h3 className="font-medium mb-3">Documentos existentes ({existingDocuments.length})</h3>
                  {existingDocuments.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <div>{ICONS.DOCUMENT}</div>
                      <div className="mt-2">Nenhum documento anexado a este processo</div>
                      <div className="text-sm">Faça upload de documentos primeiro ou use análise FULL</div>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {existingDocuments.map(doc => (
                        <div key={doc.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                          <span>{ICONS.DOCUMENT}</span>
                          <div className="flex-1">
                            <div className="font-medium text-sm">{doc.name}</div>
                            <div className="text-xs text-gray-500">
                              {(doc.size / 1024).toFixed(1)} KB • {new Date(doc.uploadedAt).toLocaleDateString('pt-BR')}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            )}

            {analysisType === 'FULL' && (
              <Card className="p-4">
                <div className="space-y-4">
                  {/* Toggle between existing and new files */}
                  <div className="flex items-center gap-4">
                    <Button
                      variant={useExistingFiles ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setUseExistingFiles(true)}
                    >
                      Usar documentos existentes
                    </Button>
                    <Button
                      variant={!useExistingFiles ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setUseExistingFiles(false)}
                    >
                      Upload novos PDFs
                    </Button>
                  </div>

                  {useExistingFiles ? (
                    <div>
                      <h3 className="font-medium mb-3">
                        Selecionar documentos ({selectedExistingFiles.length} selecionados)
                      </h3>
                      {existingDocuments.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <div>{ICONS.DOCUMENT}</div>
                          <div className="mt-2">Nenhum documento anexado</div>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {existingDocuments.map(doc => (
                            <div
                              key={doc.id}
                              className="flex items-center gap-3 p-2 bg-gray-50 rounded cursor-pointer hover:bg-gray-100"
                              onClick={() => toggleExistingFile(doc.id)}
                            >
                              <Checkbox
                                checked={selectedExistingFiles.includes(doc.id)}
                                onCheckedChange={() => toggleExistingFile(doc.id)}
                              />
                              <span>{ICONS.DOCUMENT}</span>
                              <div className="flex-1">
                                <div className="font-medium text-sm">{doc.name}</div>
                                <div className="text-xs text-gray-500">
                                  {(doc.size / 1024).toFixed(1)} KB
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <h3 className="font-medium mb-3">Upload de PDFs</h3>

                      {/* Dropzone */}
                      <div
                        {...getRootProps()}
                        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                          isDragActive
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        <input {...getInputProps()} />
                        <div className="space-y-2">
                          <div className="text-4xl">{ICONS.DOCUMENT}</div>
                          {isDragActive ? (
                            <p className="text-blue-600">Solte os arquivos aqui...</p>
                          ) : (
                            <div>
                              <p className="text-gray-600">
                                Arraste PDFs aqui ou clique para selecionar
                              </p>
                              <p className="text-sm text-gray-500">
                                Apenas arquivos PDF são aceitos
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Uploaded files */}
                      {uploadedFiles.length > 0 && (
                        <div className="mt-4 space-y-2">
                          <h4 className="font-medium text-sm">Arquivos carregados ({uploadedFiles.length})</h4>
                          {uploadedFiles.map(uploadFile => (
                            <div key={uploadFile.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                              <span>{ICONS.DOCUMENT}</span>
                              <div className="flex-1">
                                <div className="font-medium text-sm">{uploadFile.file.name}</div>
                                <div className="text-xs text-gray-500">
                                  {(uploadFile.file.size / 1024).toFixed(1)} KB
                                </div>
                                {uploadFile.status === 'uploading' && (
                                  <Progress value={uploadFile.progress} className="w-full mt-1" />
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeFile(uploadFile.id)}
                                disabled={uploadFile.status === 'uploading'}
                              >
                                {ICONS.DELETE}
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Action Buttons */}
            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
                Cancelar
              </Button>
              <Button
                onClick={startAnalysis}
                disabled={!canStartAnalysis()}
                className="min-w-32"
              >
                {analysisType === 'FAST' ? (
                  <span>{ICONS.SUCCESS} Análise FAST</span>
                ) : (
                  <span>{ICONS.PROCESS} Análise FULL</span>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}