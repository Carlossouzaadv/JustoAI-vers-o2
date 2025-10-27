'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { X, AlertTriangle, Zap } from 'lucide-react';
import {
  SubscriptionPlan,
  UsageStats,
  shouldShowLimitWarning,
  formatLimitMessage,
  getAnalysisRemaining,
  getPlanLimits
} from '../../../lib/subscription-limits';
import { ICONS } from '../../../lib/icons';

interface UsageAlertProps {
  plan: SubscriptionPlan;
  usage: UsageStats;
  onUpgrade?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function UsageAlert({ plan, usage, onUpgrade, onDismiss, className = '' }: UsageAlertProps) {
  const [dismissed, setDismissed] = useState(false);

  const shouldShow = shouldShowLimitWarning(plan, usage);
  const remaining = getAnalysisRemaining(plan, usage);
  const planLimits = getPlanLimits(plan);

  if (!shouldShow || dismissed || remaining === -1) {
    return null;
  }

  const maxAllowed = usage.isFirstMonth
    ? planLimits.completeAnalysisFirst
    : planLimits.completeAnalysisMonthly;

  const usagePercentage = ((usage.completeAnalysisUsed / maxAllowed) * 100);
  const isAlmostDepleted = remaining <= 1;
  const isDepleted = remaining === 0;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  const getAlertColor = () => {
    if (isDepleted) return 'border-red-200 bg-red-50';
    if (isAlmostDepleted) return 'border-orange-200 bg-orange-50';
    return 'border-yellow-200 bg-yellow-50';
  };

  const getIcon = () => {
    if (isDepleted) return <X className="w-5 h-5 text-red-600" />;
    if (isAlmostDepleted) return <AlertTriangle className="w-5 h-5 text-orange-600" />;
    return <Zap className="w-5 h-5 text-yellow-600" />;
  };

  const getTitle = () => {
    if (isDepleted) return 'Limite de análises atingido';
    if (isAlmostDepleted) return `Última análise disponível`;
    return `Poucas análises restantes`;
  };

  return (
    <Card className={`${getAlertColor()} border-2 ${className}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {getIcon()}

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-neutral-900">
                {getTitle()}
              </h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
                className="h-6 w-6 p-0 hover:bg-white/50"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <p className="text-sm text-neutral-700 mb-3">
              {formatLimitMessage(plan, usage)}
              {!isDepleted && ` • Renova em ${new Date(usage.resetDate).toLocaleDateString('pt-BR')}`}
            </p>

            {/* Progress bar */}
            <div className="space-y-2 mb-3">
              <div className="flex justify-between text-xs text-neutral-600">
                <span>Análises Completas Utilizadas</span>
                <span>{usage.completeAnalysisUsed}/{maxAllowed}</span>
              </div>
              <Progress
                value={usagePercentage}
                className={`h-2 ${
                  isDepleted ? 'bg-red-100' :
                  isAlmostDepleted ? 'bg-orange-100' : 'bg-yellow-100'
                }`}
              />
            </div>

            {/* Plan info */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {planLimits.name}
                </Badge>
                {usage.isFirstMonth && (
                  <Badge variant="secondary" className="text-xs">
                    1º Mês
                  </Badge>
                )}
              </div>

              {onUpgrade && (
                <Button
                  size="sm"
                  onClick={onUpgrade}
                  className={`text-xs ${
                    isDepleted
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-primary-600 hover:bg-primary-700'
                  }`}
                >
                  {isDepleted ? 'Fazer Upgrade' : 'Upgrade'}
                  <span className="ml-1">{ICONS.ARROW_RIGHT}</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Floating notification variant
interface UsageNotificationProps extends UsageAlertProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

export function UsageNotification({
  position = 'top-right',
  ...props
}: UsageNotificationProps) {
  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4'
  };

  return (
    <div className={`fixed ${positionClasses[position]} z-50 max-w-sm`}>
      <UsageAlert {...props} />
    </div>
  );
}