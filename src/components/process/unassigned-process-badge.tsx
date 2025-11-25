'use client';

import React from 'react';
import {
  AlertCircle,
  RefreshCw,
  ChevronDown,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export interface UnassignedInfo {
  stage?: string;
  reason?: string;
  errorMessage?: string;
  canRetry?: boolean;
  lastError?: {
    timestamp: string;
    stage: string;
    errorMessage: string;
    retryCount: number;
  };
}

interface UnassignedProcessBadgeProps {
  unassignedInfo?: UnassignedInfo | null;
  onRetry?: () => Promise<void>;
  isRetrying?: boolean;
}

/**
 * Componente que mostra o status UNASSIGNED com motivo e opção de retry
 * Integrado na tabela de processos para mostrar por que falhou o onboarding
 */
export function UnassignedProcessBadge({
  unassignedInfo,
  onRetry,
  isRetrying = false,
}: UnassignedProcessBadgeProps) {
  const [popoverOpen, setPopoverOpen] = React.useState(false);
  const [retrying, setRetrying] = React.useState(false);

  if (!unassignedInfo) return null;

  const handleRetry = async () => {
    if (!onRetry || retrying) return;

    setRetrying(true);
    try {
      await onRetry();
      setPopoverOpen(false);
    } catch (_error) {
      console.error('Erro ao fazer retry:', error);
    } finally {
      setRetrying(false);
    }
  };

  const retryCount = unassignedInfo.lastError?.retryCount || 0;
  const maxRetries = 3;
  const canRetryNow = unassignedInfo.canRetry && retryCount < maxRetries;

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <div className="flex items-center gap-2">
          <Badge
            variant="secondary"
            className="gap-1.5 bg-orange-100 text-orange-800 hover:bg-orange-100 cursor-pointer"
          >
            <AlertCircle className="h-3.5 w-3.5" />
            Processamento Pendente
            <ChevronDown className="h-3.5 w-3.5" />
          </Badge>
        </div>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-4" align="start">
        <div className="space-y-4">
          {/* Título */}
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-sm text-orange-900">
                Processamento não concluído
              </h3>
              <p className="text-xs text-orange-700 mt-1">
                {unassignedInfo.stage === 'ENRICHMENT'
                  ? 'Não conseguimos buscar o histórico oficial do tribunal.'
                  : 'Houve um problema durante o processamento.'}
              </p>
            </div>
          </div>

          {/* Detalhes do erro */}
          {unassignedInfo.lastError && (
            <div className="bg-orange-50 rounded-md p-3 space-y-2">
              <div className="text-xs">
                <p className="text-orange-900 font-medium mb-1">Motivo:</p>
                <p className="text-orange-800">
                  {unassignedInfo.errorMessage || 'Erro desconhecido'}
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs text-orange-700">
                <Clock className="h-3.5 w-3.5" />
                <span>
                  {new Date(unassignedInfo.lastError.timestamp).toLocaleString(
                    'pt-BR'
                  )}
                </span>
              </div>

              {retryCount > 0 && (
                <div className="text-xs text-orange-700">
                  Tentativa {retryCount} de {maxRetries}
                </div>
              )}
            </div>
          )}

          {/* Ações */}
          <div className="flex gap-2 pt-2">
            {canRetryNow && onRetry && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleRetry}
                disabled={retrying || isRetrying}
                className="flex-1 gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {retrying || isRetrying ? 'Tentando...' : 'Tentar Novamente'}
              </Button>
            )}

            {!canRetryNow && retryCount >= maxRetries && (
              <div className="text-xs text-orange-700 py-2 px-3 bg-orange-50 rounded flex-1">
                Limite de tentativas atingido. Entre em contato com o suporte.
              </div>
            )}
          </div>

          {/* Dica */}
          <div className="text-xs text-gray-500 pt-2 border-t border-orange-200">
            <p>💡 Possíveis motivos:</p>
            <ul className="list-disc list-inside mt-1 space-y-0.5">
              <li>Tribunal offline ou indisponível</li>
              <li>Número do processo inválido</li>
              <li>Timeout na consulta ao tribunal</li>
              <li>Serviço JUDIT temporariamente indisponível</li>
            </ul>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Versão simplificada do badge para uso em listas inline
 */
export function UnassignedProcessBadgeSmall({
  unassignedInfo,
}: Omit<UnassignedProcessBadgeProps, 'onRetry' | 'isRetrying'>) {
  if (!unassignedInfo) return null;

  return (
    <div className="inline-flex items-center gap-1.5">
      <AlertCircle className="h-3.5 w-3.5 text-orange-600" />
      <span className="text-xs font-medium text-orange-700">Pendente</span>
      {unassignedInfo.lastError?.retryCount && (
        <span className="text-xs text-orange-600">
          ({unassignedInfo.lastError.retryCount}/3)
        </span>
      )}
    </div>
  );
}
