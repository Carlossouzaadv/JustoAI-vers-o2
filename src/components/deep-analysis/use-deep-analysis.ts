import { useState, useCallback } from 'react';

interface UseDeepAnalysisProps {
  processId: string;
  workspaceId: string;
  onAnalysisComplete?: () => void;
}

export function useDeepAnalysis({
  processId,
  workspaceId,
  onAnalysisComplete
}: UseDeepAnalysisProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openAnalysisModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const closeAnalysisModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const handleAnalysisComplete = useCallback(() => {
    onAnalysisComplete?.();
    setIsModalOpen(false);
  }, [onAnalysisComplete]);

  return {
    isModalOpen,
    openAnalysisModal,
    closeAnalysisModal,
    handleAnalysisComplete,
    modalProps: {
      isOpen: isModalOpen,
      onClose: closeAnalysisModal,
      processId,
      workspaceId,
      onAnalysisComplete: handleAnalysisComplete
    }
  };
}