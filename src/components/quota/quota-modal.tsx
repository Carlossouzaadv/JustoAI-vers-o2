'use client';

// ================================================================
// MODAL DE QUOTA - Mensagens Amigáveis para Advogados
// ================================================================

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  AlertTriangle,
  CreditCard,
  Clock,
  FileText,
  TrendingUp,
  Calendar,
  ArrowRight,
  Info,
  CheckCircle,
  XCircle
} from 'lucide-react';

// ================================================================
// TIPOS E INTERFACES
// ================================================================

interface QuotaModalProps {
  isOpen: boolean;
  onClose: () => void;
  quotaData: {
    quotaStatus: 'ok' | 'soft_warning' | 'hard_blocked';
    current: number;
    limit: number;
    percentage: number;
    message: string;
    actions?: QuotaAction[];
    planType?: string;
  };
  onActionSelect?: (action: QuotaAction) => void;
}

interface QuotaAction {
  type: 'upgrade_plan' | 'buy_credits' | 'schedule_night' | 'executive_fallback';
  label: string;
  url?: string;
  description: string;
}

// ================================================================
// CONFIGURAÇÕES DE DISPLAY
// ================================================================

const QUOTA_CONFIG = {
  soft_warning: {
    icon: AlertTriangle,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    title: 'Atenção: Limite Próximo',
    description: 'Você está próximo do seu limite mensal de relatórios'
  },
  hard_blocked: {
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    title: 'Limite Atingido',
    description: 'Você atingiu o limite de relatórios do seu plano'
  },
  ok: {
    icon: CheckCircle,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    title: 'Tudo Certo',
    description: 'Você ainda tem relatórios disponíveis'
  }
};

const ACTION_CONFIG = {
  upgrade_plan: {
    icon: TrendingUp,
    color: 'bg-blue-600 hover:bg-blue-700',
    priority: 1,
    urgency: 'high'
  },
  buy_credits: {
    icon: CreditCard,
    color: 'bg-green-600 hover:bg-green-700',
    priority: 2,
    urgency: 'medium'
  },
  schedule_night: {
    icon: Clock,
    color: 'bg-purple-600 hover:bg-purple-700',
    priority: 3,
    urgency: 'low'
  },
  executive_fallback: {
    icon: FileText,
    color: 'bg-gray-600 hover:bg-gray-700',
    priority: 4,
    urgency: 'low'
  }
};

// ================================================================
// COMPONENTE PRINCIPAL
// ================================================================

export default function QuotaModal({ isOpen, onClose, quotaData, onActionSelect }: QuotaModalProps) {
  const [selectedAction, setSelectedAction] = useState<QuotaAction | null>(null);
  const [loading, setLoading] = useState(false);

  const config = QUOTA_CONFIG[quotaData.quotaStatus];
  const Icon = config.icon;

  // Calcular informações de progresso
  const remaining = Math.max(0, quotaData.limit - quotaData.current);
  const progressColor = quotaData.percentage >= 100 ? 'bg-red-500' :
                       quotaData.percentage >= 80 ? 'bg-orange-500' : 'bg-blue-500';

  // Ordenar ações por prioridade
  const sortedActions = quotaData.actions?.sort((a, b) => {
    const priorityA = ACTION_CONFIG[a.type]?.priority || 999;
    const priorityB = ACTION_CONFIG[b.type]?.priority || 999;
    return priorityA - priorityB;
  }) || [];

  const handleActionClick = async (action: QuotaAction) => {
    if (action.url) {
      window.open(action.url, '_blank');
    } else {
      setSelectedAction(action);
      if (onActionSelect) {
        setLoading(true);
        try {
          await onActionSelect(action);
          onClose();
        } catch (error) {
          console.error('Erro ao executar ação:', error);
        } finally {
          setLoading(false);
        }
      }
    }
  };

  const renderQuotaProgress = () => (
    <div className="space-y-3">
      {/* Barra de progresso */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Relatórios utilizados</span>
          <span className="font-medium">
            {quotaData.current} de {quotaData.limit}
          </span>
        </div>
        <Progress
          value={Math.min(quotaData.percentage, 100)}
          className="h-2"
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>{quotaData.percentage.toFixed(1)}% usado</span>
          <span>{remaining} restantes</span>
        </div>
      </div>

      {/* Status atual */}
      <div className={`p-3 rounded-lg ${config.bgColor} ${config.borderColor} border`}>
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${config.color}`} />
          <span className={`text-sm font-medium ${config.color}`}>
            {config.title}
          </span>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          {quotaData.message}
        </p>
      </div>
    </div>
  );

  const renderActionCard = (action: QuotaAction) => {
    const actionConfig = ACTION_CONFIG[action.type];
    const ActionIcon = actionConfig?.icon || ArrowRight;

    return (
      <div
        key={action.type}
        className="border rounded-lg p-4 hover:border-blue-300 transition-colors cursor-pointer"
        onClick={() => handleActionClick(action)}
      >
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${actionConfig?.color || 'bg-gray-600'} text-white`}>
            <ActionIcon className="w-4 h-4" />
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-gray-900">{action.label}</h4>
              {actionConfig?.urgency === 'high' && (
                <Badge variant="destructive" className="text-xs">Recomendado</Badge>
              )}
            </div>
            <p className="text-sm text-gray-600 mt-1">{action.description}</p>

            {action.url && (
              <div className="flex items-center gap-1 mt-2 text-xs text-blue-600">
                <ArrowRight className="w-3 h-3" />
                <span>Abre em nova aba</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (quotaData.quotaStatus === 'ok') {
      return (
        <div className="space-y-4">
          {renderQuotaProgress()}

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Você ainda tem {remaining} relatórios disponíveis este mês.
              Continue aproveitando nossa plataforma!
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {renderQuotaProgress()}

        {quotaData.quotaStatus === 'hard_blocked' && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Ação necessária:</strong> Para continuar gerando relatórios,
              escolha uma das opções abaixo.
            </AlertDescription>
          </Alert>
        )}

        {/* Ações disponíveis */}
        {sortedActions.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-medium text-gray-900">
              {quotaData.quotaStatus === 'hard_blocked' ? 'Como continuar:' : 'Opções disponíveis:'}
            </h3>

            <div className="space-y-3">
              {sortedActions.map(renderActionCard)}
            </div>
          </div>
        )}

        {/* Informações do plano */}
        {quotaData.planType && (
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Calendar className="w-4 h-4" />
              <span>Plano atual: <strong>{quotaData.planType.toUpperCase()}</strong></span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Sua cota será renovada no início do próximo mês
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${config.bgColor}`}>
              <Icon className={`w-5 h-5 ${config.color}`} />
            </div>
            <div>
              <DialogTitle>{config.title}</DialogTitle>
              <p className="text-sm text-gray-600">{config.description}</p>
            </div>
          </div>
        </DialogHeader>

        <div className="py-4">
          {renderContent()}
        </div>

        <DialogFooter className="flex gap-2">
          {quotaData.quotaStatus === 'soft_warning' && (
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Continuar Mesmo Assim
            </Button>
          )}

          {quotaData.quotaStatus === 'hard_blocked' ? (
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Entendi
            </Button>
          ) : (
            <Button
              onClick={onClose}
              className="flex-1"
            >
              {quotaData.quotaStatus === 'ok' ? 'Continuar' : 'Entendi'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ================================================================
// COMPONENTE DE QUOTA STATUS INLINE
// ================================================================

interface QuotaStatusProps {
  current: number;
  limit: number;
  percentage: number;
  className?: string;
}

export function QuotaStatus({ current, limit, percentage, className = '' }: QuotaStatusProps) {
  const getStatusColor = (pct: number) => {
    if (pct >= 100) return 'text-red-600';
    if (pct >= 80) return 'text-orange-600';
    return 'text-green-600';
  };

  const getProgressColor = (pct: number) => {
    if (pct >= 100) return 'bg-red-500';
    if (pct >= 80) return 'bg-orange-500';
    return 'bg-blue-500';
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex justify-between text-sm">
        <span className="text-gray-600">Quota de Relatórios</span>
        <span className={`font-medium ${getStatusColor(percentage)}`}>
          {current} / {limit}
        </span>
      </div>

      <Progress
        value={Math.min(percentage, 100)}
        className="h-1.5"
      />

      <div className="flex justify-between text-xs">
        <span className={getStatusColor(percentage)}>
          {percentage.toFixed(1)}% usado
        </span>
        <span className="text-gray-500">
          {Math.max(0, limit - current)} restantes
        </span>
      </div>
    </div>
  );
}

// ================================================================
// HOOK PARA USAR QUOTA MODAL
// ================================================================

export function useQuotaModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [quotaData, setQuotaData] = useState<QuotaModalProps['quotaData'] | null>(null);

  const showQuotaModal = (data: QuotaModalProps['quotaData']) => {
    setQuotaData(data);
    setIsOpen(true);
  };

  const hideQuotaModal = () => {
    setIsOpen(false);
    setQuotaData(null);
  };

  const QuotaModalComponent = ({ onActionSelect }: { onActionSelect?: (action: QuotaAction) => void }) => {
    if (!quotaData) return null;

    return (
      <QuotaModal
        isOpen={isOpen}
        onClose={hideQuotaModal}
        quotaData={quotaData}
        onActionSelect={onActionSelect}
      />
    );
  };

  return {
    showQuotaModal,
    hideQuotaModal,
    QuotaModalComponent,
    isOpen
  };
}