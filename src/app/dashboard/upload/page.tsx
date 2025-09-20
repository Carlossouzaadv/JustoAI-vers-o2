'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ICONS } from '@/lib/icons';

interface UploadedFile {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'analyzing' | 'completed' | 'error';
  progress: number;
  result?: any;
  error?: string;
}

interface AnalysisResult {
  documentType: string;
  confidence: number;
  extractedFields: Record<string, any>;
  summary: string;
  risks: string[];
  recommendations: string[];
}

export default function UploadPage() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [selectedCase, setSelectedCase] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [documentType, setDocumentType] = useState<'single-pdf' | 'full-analysis' | 'excel-batch' | ''>('');
  const [showDuplicateConfirmation, setShowDuplicateConfirmation] = useState(false);
  const [detectedProcess, setDetectedProcess] = useState<any>(null);

  // Simulação de casos disponíveis
  const availableCases = [
    { id: '1', title: 'Ação de Cobrança - João Silva', client: 'João Silva' },
    { id: '2', title: 'Divórcio Consensual - Maria Santos', client: 'Maria Santos' },
    { id: '3', title: 'Ação Trabalhista - Empresa ABC', client: 'Empresa ABC Ltda' }
  ];

  // Campos disponíveis para extração
  const availableFields = [
    'process_number',
    'parties',
    'dates',
    'values',
    'deadlines',
    'court',
    'judge',
    'lawyers',
    'summary',
    'key_points'
  ];

  const fieldLabels: Record<string, string> = {
    process_number: 'Número do Processo',
    parties: 'Partes Envolvidas',
    dates: 'Datas Importantes',
    values: 'Valores',
    deadlines: 'Prazos',
    court: 'Tribunal',
    judge: 'Juiz',
    lawyers: 'Advogados',
    summary: 'Resumo',
    key_points: 'Pontos Chave'
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: UploadedFile[] = acceptedFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      status: 'pending',
      progress: 0
    }));

    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: documentType === 'excel-batch' ? {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    } : {
      'application/pdf': ['.pdf']
    },
    multiple: documentType === 'excel-batch' || documentType === 'full-analysis'
  });

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  // AI-based process detection
  const analyzeDocumentForProcess = async (file: File): Promise<any> => {
    // Simulate AI analysis delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Mock AI process detection - in real implementation this would analyze the PDF
    const mockProcessNumbers = ['1234567-89.2024.8.26.0001', '9876543-21.2024.8.26.0002'];
    const randomProcessNumber = mockProcessNumbers[Math.floor(Math.random() * mockProcessNumbers.length)];

    // Check if this process number matches an existing case
    const existingCase = availableCases.find(case_ =>
      case_.title.includes(randomProcessNumber.split('-')[0])
    );

    if (existingCase && Math.random() > 0.3) { // 70% chance of detecting existing process
      return {
        processNumber: randomProcessNumber,
        existingProcess: existingCase,
        confidence: 0.95
      };
    }

    return {
      processNumber: randomProcessNumber,
      existingProcess: null,
      confidence: 0.85
    };
  };

  const uploadFiles = async () => {
    if (files.length === 0) {
      alert('Adicione pelo menos um arquivo');
      return;
    }

    setIsUploading(true);

    for (const fileItem of files) {
      if (fileItem.status !== 'pending') continue;

      try {
        // Atualizar status para uploading
        setFiles(prev => prev.map(f =>
          f.id === fileItem.id
            ? { ...f, status: 'uploading', progress: 0 }
            : f
        ));

        // Simular upload
        for (let progress = 0; progress <= 100; progress += 10) {
          await new Promise(resolve => setTimeout(resolve, 100));
          setFiles(prev => prev.map(f =>
            f.id === fileItem.id
              ? { ...f, progress }
              : f
          ));
        }

        // Atualizar para analyzing
        setFiles(prev => prev.map(f =>
          f.id === fileItem.id
            ? { ...f, status: 'analyzing', progress: 0 }
            : f
        ));

        // AI Analysis with Process Detection
        const analysisResult = await analyzeDocumentForProcess(fileItem.file);

        // Check if existing process detected
        if (analysisResult.existingProcess && !selectedCase) {
          setDetectedProcess(analysisResult.existingProcess);
          setShowDuplicateConfirmation(true);
          setFiles(prev => prev.map(f =>
            f.id === fileItem.id
              ? { ...f, status: 'pending', progress: 0 }
              : f
          ));
          setIsUploading(false);
          return;
        }

        // Continue with analysis progress
        for (let progress = 0; progress <= 100; progress += 20) {
          await new Promise(resolve => setTimeout(resolve, 300));
          setFiles(prev => prev.map(f =>
            f.id === fileItem.id
              ? { ...f, progress }
              : f
          ));
        }

        // Resultado simulado
        const mockResult: AnalysisResult = {
          documentType: 'Petição Inicial',
          confidence: 0.92,
          extractedFields: {
            process_number: '1234567-89.2024.8.26.0001',
            parties: ['João Silva (Autor)', 'Maria Santos (Réu)'],
            dates: ['2024-01-15 (Distribuição)', '2024-02-01 (Prazo)'],
            values: ['R$ 50.000,00 (Valor da causa)'],
            court: 'TJSP - 1ª Vara Cível'
          },
          summary: 'Ação de cobrança referente a contrato de prestação de serviços não cumprido.',
          risks: ['Prazo de resposta em 15 dias', 'Necessária comprovação documental'],
          recommendations: ['Agendar audiência de conciliação', 'Preparar documentos comprobatórios']
        };

        setFiles(prev => prev.map(f =>
          f.id === fileItem.id
            ? { ...f, status: 'completed', progress: 100, result: mockResult }
            : f
        ));

      } catch (error) {
        setFiles(prev => prev.map(f =>
          f.id === fileItem.id
            ? { ...f, status: 'error', error: 'Erro no processamento' }
            : f
        ));
      }
    }

    setIsUploading(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <File className="w-5 h-5 text-neutral-500" />;
      case 'uploading':
      case 'analyzing':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <File className="w-5 h-5 text-neutral-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: 'bg-gray-100 text-gray-800',
      uploading: 'bg-blue-100 text-blue-800',
      analyzing: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      error: 'bg-red-100 text-red-800'
    };

    const labels = {
      pending: 'Pendente',
      uploading: 'Enviando',
      analyzing: 'Analisando',
      completed: 'Concluído',
      error: 'Erro'
    };

    return (
      <Badge className={variants[status as keyof typeof variants]}>
        {labels[status as keyof typeof labels]}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Envio de Documentos</h1>
        <p className="text-neutral-600">Envie seus documentos jurídicos para análise automática com IA</p>
      </div>

      {/* AI Banner */}
      <Card className="p-4 bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
            <span className="text-white text-lg">{ICONS.STAR}</span>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-blue-900 mb-1">Análise Inteligente pronta para começar!</h3>
            <p className="text-sm text-blue-800">
              Nossa IA identificará todos os campos relevantes e fará a extração completa para você.
              Não precisa configurar nada, é só enviar os arquivos.
            </p>
          </div>
        </div>
      </Card>

      {/* Step 1: Document Type Selection */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Que tipo de arquivo você está enviando?</h2>
        <p className="text-sm text-neutral-600 mb-6">
          Selecione o tipo de documento para que possamos processar da melhor forma.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card
            className={`p-4 cursor-pointer border-2 transition-colors ${
              documentType === 'single-pdf'
                ? 'border-primary-500 bg-primary-50'
                : 'border-neutral-200 hover:border-primary-300'
            }`}
            onClick={() => setDocumentType('single-pdf')}
          >
            <div className="text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                📄
              </div>
              <h3 className="font-medium mb-2">PDF Individual</h3>
              <p className="text-sm text-neutral-600">
                Um único documento PDF para análise
              </p>
            </div>
          </Card>

          <Card
            className={`p-4 cursor-pointer border-2 transition-colors ${
              documentType === 'full-analysis'
                ? 'border-primary-500 bg-primary-50'
                : 'border-neutral-200 hover:border-primary-300'
            }`}
            onClick={() => setDocumentType('full-analysis')}
          >
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                📁
              </div>
              <h3 className="font-medium mb-2">Processo Completo</h3>
              <p className="text-sm text-neutral-600">
                Múltiplos documentos de um processo
              </p>
            </div>
          </Card>

          <Card
            className={`p-4 cursor-pointer border-2 transition-colors ${
              documentType === 'excel-batch'
                ? 'border-primary-500 bg-primary-50'
                : 'border-neutral-200 hover:border-primary-300'
            }`}
            onClick={() => setDocumentType('excel-batch')}
          >
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                📊
              </div>
              <h3 className="font-medium mb-2">Lote via Excel</h3>
              <p className="text-sm text-neutral-600">
                Planilha com múltiplos processos
              </p>
            </div>
          </Card>
        </div>
      </Card>

      {/* Upload Area - Shows when document type is selected */}
      {documentType && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">
            {documentType === 'single-pdf' && 'Envie seu PDF Individual'}
            {documentType === 'full-analysis' && 'Envie os Documentos do Processo'}
            {documentType === 'excel-batch' && 'Envie sua Planilha Excel'}
          </h2>

          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
              isDragActive
                ? 'border-primary-500 bg-primary-50'
                : 'border-neutral-300 hover:border-primary-400'
            }`}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center space-y-4">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
                <Upload className="w-8 h-8 text-primary-600" />
              </div>
              <div>
                <p className="text-lg font-medium text-neutral-900">
                  {isDragActive ? 'Solte os arquivos aqui' :
                   documentType === 'excel-batch' ? 'Arraste planilhas Excel aqui ou clique para selecionar' :
                   'Arraste PDFs aqui ou clique para selecionar'}
                </p>
                <p className="text-sm text-neutral-500">
                  {documentType === 'excel-batch' ?
                   'Apenas arquivos Excel (.xlsx, .xls) são aceitos' :
                   'Apenas arquivos PDF são aceitos'}
                  {documentType === 'single-pdf' && ' - máximo 1 arquivo'}
                </p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Duplicate Process Detection Modal */}
      {showDuplicateConfirmation && detectedProcess && (
        <Card className="p-6 bg-yellow-50 border-yellow-200">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
              <span className="text-white text-sm">{ICONS.WARNING}</span>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-yellow-900 mb-2">Processo Existente Identificado!</h3>
              <p className="text-sm text-yellow-800 mb-4">
                Identificamos que este documento pertence ao processo{' '}
                <strong>{detectedProcess.title}</strong>. Deseja anexá-lo a este processo existente?
              </p>
              <div className="flex gap-3">
                <Button
                  size="sm"
                  onClick={() => {
                    setSelectedCase(detectedProcess.id);
                    setShowDuplicateConfirmation(false);
                  }}
                >
                  Sim, anexar ao processo existente
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowDuplicateConfirmation(false);
                    setDetectedProcess(null);
                  }}
                >
                  Não, criar novo processo
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Files List */}
      {files.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Arquivos ({files.length})</h2>
            <Button
              onClick={() => {
                if (documentType === 'excel-batch' && !showExcelPreview) {
                  // For Excel, show preview first
                  if (files.length > 0 && !excelValidation) {
                    validateExcelFile(files[0].file);
                  }
                } else {
                  uploadFiles();
                }
              }}
              disabled={isUploading || !documentType || (documentType === 'excel-batch' && showExcelPreview)}
              className={`flex items-center gap-2 ${
                documentType === 'excel-batch' ? 'bg-green-600 hover:bg-green-700' : ''
              }`}
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {documentType === 'excel-batch' ? 'Processando planilha...' : 'Processando...'}
                </>
              ) : (
                <>
                  {documentType === 'excel-batch' ? '📊' : ICONS.AI}
                  {documentType === 'excel-batch' ? 'Pré-visualizar Planilha' : 'Analisar com IA'}
                </>
              )}
            </Button>
          </div>

          <div className="space-y-4">
            {files.map(fileItem => (
              <div key={fileItem.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(fileItem.status)}
                    <div>
                      <p className="font-medium text-neutral-900">{fileItem.file.name}</p>
                      <p className="text-sm text-neutral-500">
                        {(fileItem.file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(fileItem.status)}
                    {fileItem.status === 'pending' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(fileItem.id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {(fileItem.status === 'uploading' || fileItem.status === 'analyzing') && (
                  <div>
                    <div className="flex justify-between text-sm text-neutral-600 mb-1">
                      <span>
                        {fileItem.status === 'uploading' ? 'Enviando...' : 'Analisando com IA...'}
                      </span>
                      <span>{fileItem.progress}%</span>
                    </div>
                    <Progress value={fileItem.progress} />
                  </div>
                )}

                {fileItem.status === 'error' && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-2">
                    <p className="text-sm text-red-800">{fileItem.error}</p>
                  </div>
                )}

                {fileItem.status === 'completed' && fileItem.result && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-2 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-green-900">Análise Concluída</h4>
                      <Badge className="bg-green-100 text-green-800">
                        {Math.round(fileItem.result.confidence * 100)}% confiança
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="font-medium text-neutral-700">Tipo de Documento:</p>
                        <p className="text-neutral-600">{fileItem.result.documentType}</p>
                      </div>

                      <div>
                        <p className="font-medium text-neutral-700">Resumo:</p>
                        <p className="text-neutral-600">{fileItem.result.summary}</p>
                      </div>

                      {fileItem.result.risks.length > 0 && (
                        <div>
                          <p className="font-medium text-neutral-700">Riscos Identificados:</p>
                          <ul className="list-disc list-inside text-neutral-600">
                            {fileItem.result.risks.map((risk: string, index: number) => (
                              <li key={index}>{risk}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {fileItem.result.recommendations.length > 0 && (
                        <div>
                          <p className="font-medium text-neutral-700">Recomendações:</p>
                          <ul className="list-disc list-inside text-neutral-600">
                            {fileItem.result.recommendations.map((rec: string, index: number) => (
                              <li key={index}>{rec}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-green-200">
                      <Button variant="outline" size="sm">
                        Ver Análise Completa
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Help */}
      <Card className="p-6 bg-blue-50 border-blue-200">
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            {ICONS.INFO}
          </div>
          <div>
            <h3 className="font-medium text-blue-900 mb-1">Como funciona a análise</h3>
            <p className="text-sm text-blue-800 mb-2">
              Nossa IA analisa automaticamente seus documentos jurídicos e extrai informações relevantes:
            </p>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Identifica o tipo de documento (petição, sentença, contrato, etc.)</li>
              <li>• Extrai dados estruturados (partes, datas, valores, prazos)</li>
              <li>• Gera resumo executivo do conteúdo</li>
              <li>• Identifica riscos e recomendações</li>
              <li>• Organiza tudo no caso selecionado</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}