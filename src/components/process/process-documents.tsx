'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ICONS } from '@/lib/icons';
import { DocumentViewerModal } from './document-viewer-modal';
import { DocumentUploadSection } from './document-upload-section';
import { DocumentListGrid } from './document-list-grid';
import { DocumentEditModal } from './document-edit-modal';

// ================================================================
// TYPES
// ================================================================

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

interface CaseDocument {
  id: string;
  name: string;
  mimeType?: string;
  size: number;
  createdAt: string;
}

interface ProcessDocumentsProps {
  processId: string;
}

// ================================================================
// TYPE GUARDS
// ================================================================

/**
 * Type Guard para validar se um objeto é um CaseDocument válido.
 * Valida a estrutura mínima esperada da API.
 */
function isCaseDocument(data: unknown): data is CaseDocument {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const doc = data as Record<string, unknown>;

  return (
    typeof doc.id === 'string' &&
    typeof doc.name === 'string' &&
    typeof doc.size === 'number' &&
    typeof doc.createdAt === 'string' &&
    (doc.mimeType === undefined || typeof doc.mimeType === 'string')
  );
}

/**
 * Type Guard para validar se um valor é uma DocumentCategory válida.
 */
function isValidCategory(value: unknown): value is DocumentCategory {
  return (
    value === 'petition' ||
    value === 'decision' ||
    value === 'evidence' ||
    value === 'correspondence' ||
    value === 'other'
  );
}

export function ProcessDocuments({ processId }: ProcessDocumentsProps) {
  const [documents, setDocuments] = useState<DocumentFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [filter, setFilter] = useState<'all' | DocumentFile['category']>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // States para modal de visualização
  const [viewingDocument, setViewingDocument] = useState<DocumentFile | null>(null);

  // States para modal de edição
  const [editingDocument, setEditingDocument] = useState<DocumentFile | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState<DocumentFile['category']>('other');
  const [editNotes, setEditNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDocuments = useCallback(async () => {
    try {
      setLoading(true);

      const response = await fetch(`/api/cases/${processId}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        const caseDocuments = data.data?.documents || [];

        // Filtrar e validar documentos usando Type Guard
        // Apenas documentos válidos são mapeados
        const mappedDocuments: DocumentFile[] = caseDocuments
          .filter(isCaseDocument)
          .map((doc: CaseDocument) => ({
            id: doc.id,
            name: doc.name,
            type: doc.mimeType || 'application/pdf',
            mimeType: doc.mimeType || 'application/pdf',
            size: doc.size || 0,
            uploadedAt: doc.createdAt,
            status: 'completed' as const,
            category: 'other' as const,
            analysisStatus: 'completed' as const,
          }));

        setDocuments(mappedDocuments);
      } else {
        console.error('Erro ao carregar documentos:', response.status);
        setDocuments([]);
      }
    } catch (_error) {
      console.error('Erro ao carregar documentos:', error);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [processId]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

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
    } catch (_error) {
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
    if (!document.url && !document.id) {
      alert('Documento não disponível para visualização');
      return;
    }

    // Abrir modal de visualização ao invés de nova aba
    setViewingDocument(document);
  };

  const handleEditDocument = (document: DocumentFile) => {
    setEditingDocument(document);
    setEditName(document.name);
    setEditCategory(document.category);
    setEditNotes('');
  };

  const handleSaveDocument = async () => {
    if (!editingDocument) return;

    setIsSaving(true);
    try {
      // Save document metadata locally
      setDocuments(documents.map(doc =>
        doc.id === editingDocument.id
          ? { ...doc, name: editName, category: editCategory }
          : doc
      ));

      // Save notes to backend if notes were added
      if (editNotes.trim()) {
        const response = await fetch(`/api/documents/${editingDocument.id}/notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            title: `Observação do documento: ${editName}`,
            description: editNotes,
            priority: 'normal',
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Erro ao salvar notas');
        }

        console.log('Notas do documento salvas com sucesso');
      }

      setEditingDocument(null);
    } catch (_error) {
      console.error('Erro ao salvar documento:', error);
      alert('Erro ao salvar documento. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteDocument = async () => {
    if (!editingDocument || !window.confirm('Deseja realmente deletar este documento?')) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/documents/${editingDocument.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = typeof errorData === 'object' && errorData !== null && 'error' in errorData
          ? String(errorData.error)
          : 'Erro ao deletar documento';
        throw new Error(errorMessage);
      }

      setDocuments(documents.filter(doc => doc.id !== editingDocument.id));
      setEditingDocument(null);
      alert('Documento deletado com sucesso');
    } catch (_error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido ao deletar documento';
      console.error('Erro ao deletar documento:', message);
      alert(`Erro ao deletar documento: ${message}`);
    } finally {
      setIsDeleting(false);
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
        <DocumentUploadSection
          uploading={uploading}
          uploadProgress={uploadProgress}
          totalDocuments={documents.length}
          filter={filter}
          searchTerm={searchTerm}
          onFileSelect={handleFileUpload}
          onFilterChange={setFilter}
          onSearchChange={setSearchTerm}
        />
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
          </div>
        ) : (
          <>
            <DocumentListGrid
              documents={filteredDocuments}
              onViewDocument={handleViewDocument}
              onEditDocument={handleEditDocument}
            />

            <div className="mt-6 pt-4 border-t">
              <p className="text-xs text-muted-foreground">
                {ICONS.INFO} Formatos aceitos: PDF, DOC, DOCX, JPG, PNG, TXT (máx. 10MB por arquivo)
              </p>
            </div>
          </>
        )}

        <DocumentEditModal
          document={editingDocument}
          isOpen={!!editingDocument}
          onClose={() => setEditingDocument(null)}
          onSave={handleSaveDocument}
          onDelete={handleDeleteDocument}
        />

        {viewingDocument && (
          <DocumentViewerModal
            documentId={viewingDocument.id}
            documentName={viewingDocument.name}
            mimeType={viewingDocument.mimeType || 'application/octet-stream'}
            isOpen={!!viewingDocument}
            onClose={() => setViewingDocument(null)}
          />
        )}
      </CardContent>
    </Card>
  );
}