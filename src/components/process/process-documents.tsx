'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { ICONS } from '@/lib/icons';

interface DocumentFile {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  status: 'processing' | 'completed' | 'error';
  category: 'petition' | 'decision' | 'evidence' | 'correspondence' | 'other';
  analysisStatus?: 'pending' | 'analyzing' | 'completed' | 'failed';
  analysisProgress?: number;
  extractedText?: string;
  aiSummary?: string;
  url?: string;
  thumbnailUrl?: string;
}

interface ProcessDocumentsProps {
  processId: string;
}

export function ProcessDocuments({ processId }: ProcessDocumentsProps) {
  const [documents, setDocuments] = useState<DocumentFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [filter, setFilter] = useState<'all' | DocumentFile['category']>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadDocuments();
  }, [processId]);

  const loadDocuments = async () => {
    try {
      setLoading(true);

      const response = await fetch(`/api/cases/${processId}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        const caseDocuments = data.data?.documents || [];

        // Map case documents to DocumentFile format
        const mappedDocuments: DocumentFile[] = caseDocuments.map((doc: any) => ({
          id: doc.id,
          name: doc.name,
          type: doc.mimeType || 'application/pdf',
          size: doc.size || 0,
          uploadedAt: doc.createdAt,
          status: 'completed',
          category: 'other' as const,
          analysisStatus: 'completed' as const,
        }));

        setDocuments(mappedDocuments);
      } else {
        console.error('Erro ao carregar documentos:', response.status);
        setDocuments([]);
      }
    } catch (error) {
      console.error('Erro ao carregar documentos:', error);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('processId', processId);
        formData.append('category', 'other'); // Default category

        // Simular progresso de upload
        const progressInterval = setInterval(() => {
          setUploadProgress((prev) => Math.min(prev + 10, 90));
        }, 200);

        const response = await fetch('/api/documents/upload', {
          method: 'POST',
          body: formData,
        });

        clearInterval(progressInterval);
        setUploadProgress(100);

        if (response.ok) {
          const result = await response.json();
          setDocuments(prev => [result.document, ...prev]);
        } else {
          throw new Error('Erro no upload');
        }
      }
    } catch (error) {
      console.error('Erro no upload:', error);
      alert('Erro ao fazer upload do arquivo');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleViewDocument = (document: DocumentFile) => {
    if (!document.url) {
      alert('URL do documento não disponível');
      return;
    }

    // Se é uma URL de arquivo, tentar abrir em nova aba
    try {
      window.open(document.url, '_blank');
    } catch (error) {
      console.error('Erro ao abrir documento:', error);
      alert('Erro ao abrir documento');
    }
  };

  const handleEditDocument = (document: DocumentFile) => {
    // TODO: Implementar modal de edição com opções:
    // - Renomear
    // - Alterar categoria
    // - Adicionar tags/observações
    // - Deletar
    console.log('Editar documento:', document.id);
  };

  const getCategoryIcon = (category: DocumentFile['category']) => {
    switch (category) {
      case 'petition': return ICONS.DOCUMENT;
      case 'decision': return ICONS.PROCESS;
      case 'evidence': return ICONS.STAR;
      case 'correspondence': return ICONS.EDIT;
      case 'other': return ICONS.DOCUMENT;
      default: return ICONS.DOCUMENT;
    }
  };

  const getCategoryLabel = (category: DocumentFile['category']) => {
    switch (category) {
      case 'petition': return 'Petição';
      case 'decision': return 'Decisão';
      case 'evidence': return 'Prova';
      case 'correspondence': return 'Correspondência';
      case 'other': return 'Outros';
      default: return 'Desconhecido';
    }
  };

  const getStatusColor = (status: DocumentFile['status']) => {
    switch (status) {
      case 'completed': return 'default';
      case 'processing': return 'secondary';
      case 'error': return 'destructive';
      default: return 'outline';
    }
  };

  const filteredDocuments = documents
    .filter(doc => {
      if (filter !== 'all' && doc.category !== filter) return false;
      if (searchTerm && !doc.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

  const categories = ['petition', 'decision', 'evidence', 'correspondence', 'other'] as const;
  const categoryCounts = categories.reduce((acc, cat) => {
    acc[cat] = documents.filter(doc => doc.category === cat).length;
    return acc;
  }, {} as Record<string, number>);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-1/4" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-3 w-1/2 mb-2" />
                  <Skeleton className="h-3 w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {ICONS.DOCUMENT} Documentos ({documents.length})
          </CardTitle>

          <div className="flex gap-2">
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? `${ICONS.LOADING} Enviando...` : `${ICONS.ADD} Upload`}
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => handleFileUpload(e.target.files)}
              multiple
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt"
              className="hidden"
            />
          </div>
        </div>

        {/* Filtros e busca */}
        <div className="flex flex-col sm:flex-row gap-4 mt-4">
          <Input
            placeholder="Buscar documentos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1"
          />

          <div className="flex gap-2 flex-wrap">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              Todos ({documents.length})
            </Button>
            {categories.map((category) => (
              <Button
                key={category}
                variant={filter === category ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter(category)}
              >
                {getCategoryLabel(category)} ({categoryCounts[category] || 0})
              </Button>
            ))}
          </div>
        </div>

        {/* Progresso de upload */}
        {uploading && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm">Enviando arquivo...</span>
              <span className="text-sm text-muted-foreground">{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} className="w-full" />
          </div>
        )}
      </CardHeader>

      <CardContent>
        {filteredDocuments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <span className="text-4xl mb-4 block">{ICONS.DOCUMENT}</span>
            <h3 className="text-lg font-medium mb-2">Nenhum documento encontrado</h3>
            <p className="text-sm mb-4">
              {searchTerm || filter !== 'all'
                ? 'Tente ajustar os filtros de busca'
                : 'Faça upload dos primeiros documentos deste processo'
              }
            </p>
            <Button onClick={() => fileInputRef.current?.click()}>
              {ICONS.ADD} Fazer Upload
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDocuments.map((document) => (
              <Card key={document.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getCategoryIcon(document.category)}</span>
                      <Badge variant="outline" className="text-xs">
                        {getCategoryLabel(document.category)}
                      </Badge>
                    </div>

                    <Badge variant={getStatusColor(document.status)} className="text-xs">
                      {document.status === 'completed' ? 'Concluído' :
                       document.status === 'processing' ? 'Processando' : 'Erro'}
                    </Badge>
                  </div>

                  <h3 className="font-medium text-sm mb-2 line-clamp-2">
                    {document.name}
                  </h3>

                  <div className="space-y-2 text-xs text-muted-foreground">
                    <p>
                      {(document.size / 1024 / 1024).toFixed(1)} MB • {' '}
                      {new Date(document.uploadedAt).toLocaleDateString('pt-BR')}
                    </p>

                    {/* Progresso da análise */}
                    {document.analysisStatus && document.analysisStatus !== 'completed' && (
                      <div className="space-y-1">
                        <p>Análise: {
                          document.analysisStatus === 'pending' ? 'Pendente' :
                          document.analysisStatus === 'analyzing' ? 'Analisando...' : 'Erro'
                        }</p>
                        {document.analysisProgress && (
                          <Progress value={document.analysisProgress} className="w-full h-1" />
                        )}
                      </div>
                    )}

                    {/* Resumo da IA */}
                    {document.aiSummary && (
                      <div className="bg-muted p-2 rounded text-xs">
                        <p className="font-medium mb-1">{ICONS.STAR} Resumo IA:</p>
                        <p>{document.aiSummary}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 mt-3">
                    {document.url && document.status === 'completed' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleViewDocument(document)}
                      >
                        Ver
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditDocument(document)}
                      title="Editar documento (renomear, categoria, deletar)"
                    >
                      {ICONS.EDIT}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-6 pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            {ICONS.INFO} Formatos aceitos: PDF, DOC, DOCX, JPG, PNG, TXT (máx. 10MB por arquivo)
          </p>
        </div>
      </CardContent>
    </Card>
  );
}