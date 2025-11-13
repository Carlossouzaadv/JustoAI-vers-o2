'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ICONS } from '@/lib/icons';

interface DocumentViewerModalProps {
  documentId: string;
  documentName: string;
  mimeType: string;
  isOpen: boolean;
  onClose: () => void;
}

export function DocumentViewerModal({
  documentId,
  documentName,
  mimeType,
  isOpen,
  onClose
}: DocumentViewerModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const downloadUrl = `/api/documents/${documentId}/download`;

  // Determinar se é PDF ou outro tipo de arquivo
  const isPDF = mimeType === 'application/pdf' || documentName.toLowerCase().endsWith('.pdf');
  const isImage = mimeType.startsWith('image/');
  const isText = mimeType === 'text/plain' || mimeType === 'text/html';

  const handleDownload = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(downloadUrl, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Erro ao baixar: ${response.statusText}`);
      }

      // Criar blob e download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = documentName || 'documento';
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error('Erro ao baixar documento:', err);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenInNewTab = () => {
    try {
      window.open(downloadUrl, '_blank');
    } catch (err) {
      console.error('Erro ao abrir em nova aba:', err);
      setError('Erro ao abrir documento');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            {ICONS.DOCUMENT} {documentName}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {mimeType} • Tipo: {isPDF ? 'PDF' : isImage ? 'Imagem' : 'Documento'}
          </DialogDescription>
        </DialogHeader>

        {/* Conteúdo do visualizador */}
        <div className="flex-1 overflow-auto bg-muted/30 rounded-lg p-4 min-h-[400px]">
          {error ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <span className="text-4xl">{ICONS.ERROR}</span>
              <p className="text-center text-sm text-destructive">{error}</p>
            </div>
          ) : isPDF ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <span className="text-4xl">{ICONS.DOCUMENT}</span>
              <p className="text-center text-sm text-muted-foreground">
                Documento PDF carregado. Clique em &quot;Abrir&quot; para visualizar no navegador ou &quot;Baixar&quot; para salvar.
              </p>
            </div>
          ) : isImage ? (
            <div className="flex items-center justify-center h-full relative">
              <Image
                src={downloadUrl}
                alt={documentName}
                fill
                className="object-contain"
                onError={() => setError('Erro ao carregar imagem')}
              />
            </div>
          ) : isText ? (
            <div className="flex items-center justify-center h-full">
              <iframe
                src={downloadUrl}
                className="w-full h-full border-none"
                title={documentName}
                onError={() => setError('Erro ao carregar arquivo')}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <span className="text-4xl">{ICONS.DOCUMENT}</span>
              <p className="text-center text-sm text-muted-foreground">
                Tipo de arquivo não suportado para visualização. Clique em &quot;Baixar&quot; para salvar o arquivo.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Formatos suportados: PDF, Imagens (PNG, JPG, GIF), Texto
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2 justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            Fechar
          </Button>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleOpenInNewTab}
              disabled={loading}
            >
              {ICONS.DOWNLOAD} Abrir em Nova Aba
            </Button>
            <Button
              onClick={handleDownload}
              disabled={loading}
            >
              {loading ? `${ICONS.LOADING} Baixando...` : `${ICONS.DOWNLOAD} Baixar`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
