'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  SubscriptionPlan,
  UsageStats,
  formatLimitMessage,
  getPlanLimits,
} from '@/lib/subscription-limits';
import { ICONS } from '@/lib/icons';

interface GenerateAnalysisModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerateAnalysis: (level: 'FAST' | 'FULL') => void;
  creditsBalance: number;
  userPlan: SubscriptionPlan;
  userUsage: UsageStats;
  isGenerating: boolean;
}

export function GenerateAnalysisModal({
  open,
  onOpenChange,
  onGenerateAnalysis,
  creditsBalance,
  userPlan,
  userUsage,
  isGenerating,
}: GenerateAnalysisModalProps) {
  const handleFastAnalysis = () => {
    onGenerateAnalysis('FAST');
    onOpenChange(false);
  };

  const handleFullAnalysis = () => {
    if (creditsBalance > 0) {
      onGenerateAnalysis('FULL');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Aprofundar Análise</DialogTitle>
          <DialogDescription>
            Escolha o tipo de análise que melhor atende às suas necessidades
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-3">
            {/* OPÇÃO A: FAST - Documentos existentes */}
            <Button
              className="w-full justify-start h-auto p-4 text-left"
              variant="outline"
              onClick={handleFastAnalysis}
              disabled={isGenerating}
            >
              <div className="w-full">
                <div className="font-medium flex items-center gap-2 mb-2">
                  <Badge variant="default" className="text-xs">FAST</Badge>
                  <span className="text-sm">Usar documentos já existentes</span>
                  <Badge variant="secondary" className="text-xs ml-auto">DEFAULT</Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Análise baseada nos documentos já anexados ao processo. Resultado rápido usando Flash 8B/Flash.
                </p>
                <div className="bg-yellow-50 p-2 rounded border border-yellow-200">
                  <p className="text-xs text-yellow-700">
                    ⚠️ Para um melhor resultado, o ideal é subir o PDF completo do processo (opção FULL)
                  </p>
                </div>
              </div>
            </Button>

            {/* OPÇÃO B: FULL - Análise Completa com Gemini Pro */}
            <Button
              className="w-full justify-start h-auto p-4 text-left"
              variant="outline"
              disabled={creditsBalance <= 0 || isGenerating}
              onClick={handleFullAnalysis}
            >
              <div className="w-full">
                <div className="font-medium flex items-center gap-2 mb-2">
                  <Badge variant="destructive" className="text-xs">FULL</Badge>
                  <span className="text-sm">Análise Completa com Gemini Pro</span>
                  <Badge variant="secondary" className="text-xs ml-auto">
                    {creditsBalance} créditos
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Análise estratégica completa e detalhada com nosso modelo mais avançado. Resultado mais profundo e preciso.
                </p>
                <div className="bg-green-50 p-2 rounded border border-green-200">
                  <p className="text-xs text-green-700">
                    ✓ Análise detalhada • ✓ Modelo Pro • ✓ Maior precisão • ✓ Custa 1 crédito
                  </p>
                </div>
                {creditsBalance <= 0 && (
                  <div className="bg-red-50 p-2 rounded border border-red-200 mt-2">
                    <p className="text-xs text-red-700">
                      Créditos insuficientes. Compre mais créditos para continuar.
                    </p>
                  </div>
                )}
              </div>
            </Button>
          </div>

          <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
            <div className="flex items-start gap-2">
              <span className="text-blue-600">{ICONS.INFO}</span>
              <div className="text-xs text-blue-700">
                <p className="font-medium">Plano Atual: {getPlanLimits(userPlan).name}</p>
                <p>{formatLimitMessage(userPlan, userUsage)}</p>
                {userUsage.isFirstMonth && (
                  <p className="text-green-700 mt-1">✨ Primeiro mês com créditos extras!</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
