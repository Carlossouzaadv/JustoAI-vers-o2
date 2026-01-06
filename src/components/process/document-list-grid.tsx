'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ICONS } from '@/lib/icons';

type DocumentCategory = 'petition' | 'decision' | 'evidence' | 'correspondence' | 'other';
type DocumentStatus = 'processing' | 'completed' | 'error';
type AnalysisStatus = 'pending' | 'analyzing' | 'completed' | 'failed';

interface DocumentFile {
  id: string;
  name: string;
  type: string;
  mimeType?: string;
  size: number;
  uploadedAt: string;
  status: DocumentStatus;
  category: DocumentCategory;
  analysisStatus?: AnalysisStatus;
  analysisProgress?: number;
  extractedText?: string;
  aiSummary?: string;
  url?: string;
  thumbnailUrl?: string;
}

interface DocumentListGridProps {
  documents: DocumentFile[];
  onViewDocument: (doc: DocumentFile) => void;
  onEditDocument: (doc: DocumentFile) => void;
}

const getCategoryIcon = (category: DocumentCategory) => {
  switch (category) {
    case 'petition': return ICONS.DOCUMENT;
    case 'decision': return ICONS.PROCESS;
    case 'evidence': return ICONS.STAR;
    case 'correspondence': return ICONS.EDIT;
    case 'other': return ICONS.DOCUMENT;
    default: return ICONS.DOCUMENT;
  }
};

const getCategoryLabel = (category: DocumentCategory) => {
  switch (category) {
    case 'petition': return 'Petição';
    case 'decision': return 'Decisão';
    case 'evidence': return 'Prova';
    case 'correspondence': return 'Correspondência';
    case 'other': return 'Outros';
    default: return 'Desconhecido';
  }
};

const getStatusColor = (status: DocumentStatus) => {
  switch (status) {
    case 'completed': return 'default';
    case 'processing': return 'secondary';
    case 'error': return 'destructive';
    default: return 'outline';
  }
};

export function DocumentListGrid({
  documents,
  onViewDocument,
  onEditDocument,
}: DocumentListGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {documents.map((document) => (
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
                  variant="ghost"
                  size="sm"
                  className="flex-1"
                  onClick={() => onViewDocument(document)}
                >
                  {ICONS.EYE} Ver
                </Button>
              )}
              {document.url && (
                <Button
                  variant="ghost"
                  size="sm"
                  title="Baixar documento"
                  onClick={() => {
                    const link = window.document.createElement('a');
                    link.href = document.url || '';
                    link.download = document.name;
                    link.click();
                  }}
                >
                  {ICONS.DOWNLOAD}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEditDocument(document)}
                title="Editar documento (renomear, categoria, deletar)"
              >
                {ICONS.EDIT}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
