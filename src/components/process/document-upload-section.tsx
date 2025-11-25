'use client';

import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { ICONS } from '@/lib/icons';

type DocumentCategory = 'petition' | 'decision' | 'evidence' | 'correspondence' | 'other';

interface DocumentUploadSectionProps {
  uploading: boolean;
  uploadProgress: number;
  totalDocuments: number;
  filter: 'all' | DocumentCategory;
  searchTerm: string;
  onFileSelect: (files: FileList | null) => void;
  onFilterChange: (filter: 'all' | DocumentCategory) => void;
  onSearchChange: (term: string) => void;
}

const categories = ['petition', 'decision', 'evidence', 'correspondence', 'other'] as const;

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

export function DocumentUploadSection({
  uploading,
  uploadProgress,
  totalDocuments,
  filter,
  searchTerm,
  onFileSelect,
  onFilterChange,
  onSearchChange,
}: DocumentUploadSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-4">
      {/* Header with Upload Button */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          {ICONS.DOCUMENT} Documentos ({totalDocuments})
        </h2>

        <Button
          onClick={handleUploadClick}
          disabled={uploading}
        >
          {uploading ? `${ICONS.LOADING} Enviando...` : `${ICONS.ADD} Upload`}
        </Button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => onFileSelect(e.target.files)}
          multiple
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt"
          className="hidden"
        />
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Input
          placeholder="Buscar documentos..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="flex-1"
        />

        <div className="flex gap-2 flex-wrap">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onFilterChange('all')}
          >
            Todos ({totalDocuments})
          </Button>
          {categories.map((category) => (
            <Button
              key={category}
              variant={filter === category ? 'default' : 'outline'}
              size="sm"
              onClick={() => onFilterChange(category as DocumentCategory)}
            >
              {getCategoryLabel(category as DocumentCategory)} (0)
            </Button>
          ))}
        </div>
      </div>

      {/* Upload Progress */}
      {uploading && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm">Enviando arquivo...</span>
            <span className="text-sm text-muted-foreground">{uploadProgress}%</span>
          </div>
          <Progress value={uploadProgress} className="w-full" />
        </div>
      )}
    </div>
  );
}
