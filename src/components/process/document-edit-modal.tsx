'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ICONS } from '@/lib/icons';

type DocumentCategory = 'petition' | 'decision' | 'evidence' | 'correspondence' | 'other';

interface DocumentFile {
  id: string;
  name: string;
  type: string;
  mimeType?: string;
  size: number;
  uploadedAt: string;
  status: 'processing' | 'completed' | 'error';
  category: DocumentCategory;
  analysisStatus?: 'pending' | 'analyzing' | 'completed' | 'failed';
  analysisProgress?: number;
  extractedText?: string;
  aiSummary?: string;
  url?: string;
  thumbnailUrl?: string;
}

interface DocumentEditModalProps {
  document: DocumentFile | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, category: DocumentCategory, notes: string) => Promise<void>;
  onDelete: () => Promise<void>;
}

function isValidCategory(value: unknown): value is DocumentCategory {
  return (
    value === 'petition' ||
    value === 'decision' ||
    value === 'evidence' ||
    value === 'correspondence' ||
    value === 'other'
  );
}

export function DocumentEditModal({
  document,
  isOpen,
  onClose,
  onSave,
  onDelete,
}: DocumentEditModalProps) {
  const [editName, setEditName] = useState(document?.name ?? '');
  const [editCategory, setEditCategory] = useState<DocumentCategory>(document?.category ?? 'other');
  const [editNotes, setEditNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(editName, editCategory, editNotes);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Deseja realmente deletar este documento?')) return;

    setIsDeleting(true);
    try {
      await onDelete();
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  if (!document) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Documento</DialogTitle>
          <DialogDescription>
            Altere as informações do documento
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Document Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Nome do Documento</label>
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Nome do documento"
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Categoria</label>
            <Select
              value={editCategory}
              onValueChange={(value) => {
                if (isValidCategory(value)) {
                  setEditCategory(value);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="petition">Petição</SelectItem>
                <SelectItem value="decision">Decisão</SelectItem>
                <SelectItem value="evidence">Prova</SelectItem>
                <SelectItem value="correspondence">Correspondência</SelectItem>
                <SelectItem value="other">Outros</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Observações</label>
            <Input
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="Adicione observações sobre o documento..."
            />
            <p className="text-xs text-muted-foreground">Notas associadas a este documento</p>
          </div>
        </div>

        <DialogFooter className="flex gap-2 justify-between">
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting || isSaving}
            className="mr-auto"
          >
            {isDeleting ? `${ICONS.LOADING} Deletando...` : `${ICONS.DELETE} Deletar`}
          </Button>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isSaving || isDeleting}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || isDeleting}
            >
              {isSaving ? `${ICONS.LOADING} Salvando...` : `${ICONS.SUCCESS} Salvar`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
