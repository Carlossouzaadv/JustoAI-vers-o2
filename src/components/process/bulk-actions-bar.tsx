'use client';

import React, { useState } from 'react';
import { X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useBulkCaseUpdate } from '@/hooks/useBulkCaseUpdate';
import { ClientAssociationModal } from './client-association-modal';
import { cn } from '@/lib/utils';

interface BulkActionsBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  selectedCaseIds: Set<string>;
  onSuccess?: (message: string) => void;
  onError?: (error: string) => void;
}

/**
 * Barra de ações em bulk para operações com múltiplos casos selecionados
 * Permite: atribuir cliente, mudar status, etc
 */
export function BulkActionsBar({
  selectedCount,
  onClearSelection,
  selectedCaseIds,
  onSuccess,
  onError,
}: BulkActionsBarProps) {
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedClient, setSelectedClient] = useState<unknown>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { updateClientsInBulk, loading, error } = useBulkCaseUpdate();

  const handleClientSelect = (client: unknown) => {
    setSelectedClient(client);
    setIsClientModalOpen(false);
    setShowConfirm(true);
  };

  const handleConfirmUpdate = async () => {
    if (!selectedClient) return;

    setIsSubmitting(true);
    try {
      const result = await updateClientsInBulk(
        Array.from(selectedCaseIds),
        selectedClient.id
      );

      onSuccess?.(
        `${result.updated} caso(s) atualizado(s) com sucesso`
      );
      onClearSelection();
      setSelectedClient(null);
      setShowConfirm(false);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido';
      onError?.(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Barra flutuante */}
      <div className="fixed bottom-6 left-6 right-6 z-50 animate-in slide-in-from-bottom-5">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 shadow-lg">
          <div className="flex items-center justify-between gap-4">
            {/* Info */}
            <div className="flex-1 flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-sm font-semibold text-blue-700">
                  {selectedCount}
                </div>
                <span className="text-sm font-medium text-blue-900">
                  {selectedCount === 1 ? 'caso selecionado' : 'casos selecionados'}
                </span>
              </div>
            </div>

            {/* Ações */}
            <div className="flex gap-2 items-center">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsClientModalOpen(true)}
                className="gap-2"
              >
                Atribuir Cliente
              </Button>

              <Button
                size="sm"
                variant="ghost"
                onClick={onClearSelection}
                className="h-8 w-8 p-0"
                title="Limpar seleção"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Mensagem de erro ou sucesso */}
          {error && (
            <div className="mt-3 flex items-start gap-2 text-sm text-red-700 bg-red-50 p-2 rounded">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>

      {/* Modal para seleção de cliente */}
      <ClientAssociationModal
        caseId="" // Não usado em modo bulk
        currentClient={null}
        onClientAssociated={handleClientSelect}
        trigger={
          <div className="hidden" /> // Trigger escondido, abrimos manualmente
        }
        bulkMode={true}
        bulkSelectedCount={selectedCount}
        isOpen={isClientModalOpen}
        onOpenChange={setIsClientModalOpen}
      />

      {/* Dialog de confirmação */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar atribuição de cliente</DialogTitle>
            <DialogDescription>
              Você está prestes a atribuir o cliente{' '}
              <strong>{selectedClient?.name}</strong> a{' '}
              <strong>{selectedCount}</strong>{' '}
              {selectedCount === 1 ? 'caso' : 'casos'}.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 my-4">
            <p className="text-sm text-blue-900">
              ✓ Você poderá desfazer esta ação individualmente se necessário.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirm(false)}
              disabled={isSubmitting || loading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmUpdate}
              disabled={isSubmitting || loading}
              className="gap-2"
            >
              {isSubmitting || loading ? (
                <>
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent" />
                  Atualizando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Confirmar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
