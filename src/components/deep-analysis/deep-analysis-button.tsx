'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { DeepAnalysisModal, useDeepAnalysis } from './index';
import { ICONS } from '@/lib/icons';

interface DeepAnalysisButtonProps {
  processId: string;
  workspaceId: string;
  existingDocuments?: Array<{
    id: string;
    name: string;
    size: number;
    uploadedAt: string;
  }>;
  onAnalysisComplete?: (result: any) => void;
  variant?: 'default' | 'outline' | 'secondary';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
}

export function DeepAnalysisButton({
  processId,
  workspaceId,
  existingDocuments,
  onAnalysisComplete,
  variant = 'default',
  size = 'default',
  className
}: DeepAnalysisButtonProps) {
  const {
    isModalOpen,
    openAnalysisModal,
    closeAnalysisModal,
    handleAnalysisComplete
  } = useDeepAnalysis({
    processId,
    workspaceId,
    onAnalysisComplete
  });

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={openAnalysisModal}
        className={className}
      >
        <span className="mr-2">{ICONS.PROCESS}</span>
        Aprofundar Análise
      </Button>

      <DeepAnalysisModal
        isOpen={isModalOpen}
        onClose={closeAnalysisModal}
        processId={processId}
        workspaceId={workspaceId}
        existingDocuments={existingDocuments}
        onAnalysisComplete={handleAnalysisComplete}
      />
    </>
  );
}