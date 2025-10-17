'use client';

// ================================================================
// CARD DE CRÉDITOS - Dashboard Principal
// ================================================================

import React, { useState, useEffect } from 'react';
import { getApiUrl } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  CreditCard,
  Plus,
  TrendingUp,
  FileText,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Info,
  RefreshCw,
  ShoppingCart
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ================================================================
// TIPOS E INTERFACES
// ================================================================

interface CreditsCardProps {
  workspaceId: string;
  className?: string;
  onBuyCredits?: () => void;
}

interface CreditBalance {
  balance: number;
  includedCredits: number;
  purchasedCredits: number;
  consumedCredits: number;
}

interface QuotaStatus {
  current: number;
  limit: number;
  percentage: number;
  status: 'ok' | 'soft_warning' | 'hard_blocked';
}

interface UsageSummary {
  reportsThisMonth: number;
  creditsThisMonth: number;
  estimatedCost: number;
  daysUntilReset: number;
}

// ================================================================
// COMPONENTE PRINCIPAL
// ================================================================

export default function CreditsCard({ workspaceId, className = '', onBuyCredits }: CreditsCardProps) {
  // Estados
  const [credits, setCredits] = useState<CreditBalance | null>(null);
  const [quota, setQuota] = useState<QuotaStatus | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Carregar dados iniciais
  useEffect(() => {
    loadDashboardData();
  }, [workspaceId]);

  // Carregar dados do dashboard
  const loadDashboardData = async () => {
    try {
      setLoading(true);

      const [creditsResponse, quotaResponse] = await Promise.all([
        fetch(getApiUrl(`/api/billing/credits?workspaceId=${workspaceId}`), { credentials: 'include' }),
        fetch(getApiUrl(`/api/reports/quota-status?workspaceId=${workspaceId}`), { credentials: 'include' })
      ]);

      const [creditsData, quotaData] = await Promise.all([
        creditsResponse.json(),
        quotaResponse.json()
      ]);

      if (creditsData.success && creditsData.data?.balance) {
        setCredits(creditsData.data.balance);
        setUsage({
          reportsThisMonth: creditsData.data.quotaStatus?.reports?.current || 0,
          creditsThisMonth: creditsData.data.balance.consumedCredits || 0,
          estimatedCost: creditsData.data.quotaStatus?.reports?.billingEstimate || 0,
          daysUntilReset: getDaysUntilMonthEnd()
        });
      } else {
        // Set default on error
        setCredits({
          balance: 0,
          includedCredits: 0,
          purchasedCredits: 0,
          consumedCredits: 0
        });
      }

      if (quotaData.success && quotaData.data?.quotaStatus?.reports) {
        setQuota(quotaData.data.quotaStatus.reports);
      } else {
        // Set default quota
        setQuota({
          current: 0,
          limit: 50,
          percentage: 0,
          status: 'ok'
        });
      }

    } catch (error) {
      console.error('Erro ao carregar dados do dashboard:', error);
      // Set defaults on error
      setCredits({
        balance: 0,
        includedCredits: 0,
        purchasedCredits: 0,
        consumedCredits: 0
      });
      setQuota({
        current: 0,
        limit: 50,
        percentage: 0,
        status: 'ok'
      });
    } finally {
      setLoading(false);
    }
  };

  // Refresh dados
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  // Calcular dias até fim do mês
  const getDaysUntilMonthEnd = () => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return Math.ceil((lastDay.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  // Determinar status geral
  const getOverallStatus = () => {
    if (!credits || !quota) return 'loading';

    if (quota.status === 'hard_blocked' || credits.balance <= 0) {
      return 'critical';
    } else if (quota.status === 'soft_warning' || credits.balance <= 5) {
      return 'warning';
    } else {
      return 'ok';
    }
  };

  // Configurações de status
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'critical':
        return {
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          icon: AlertTriangle,
          message: 'Ação necessária'
        };
      case 'warning':
        return {
          color: 'text-orange-600',
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200',
          icon: AlertTriangle,
          message: 'Atenção'
        };
      case 'ok':
        return {
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          icon: CheckCircle,
          message: 'Tudo certo'
        };
      default:
        return {
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          icon: Info,
          message: 'Carregando...'
        };
    }
  };

  // Renderizar skeleton de loading
  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Seus Créditos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 animate-pulse">
            <div className="h-8 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const overallStatus = getOverallStatus();
  const statusConfig = getStatusConfig(overallStatus);
  const StatusIcon = statusConfig.icon;

  return (
    <Card className={`${className} ${overallStatus === 'critical' ? 'ring-2 ring-red-200' : ''}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Seus Créditos
          </CardTitle>

          <div className="flex items-center gap-2">
            <Badge
              variant={overallStatus === 'critical' ? 'destructive' :
                     overallStatus === 'warning' ? 'secondary' : 'default'}
              className="flex items-center gap-1"
            >
              <StatusIcon className="w-3 h-3" />
              {statusConfig.message}
            </Badge>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Saldo de Créditos */}
        {credits && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Créditos Disponíveis</span>
              <span className="text-2xl font-bold text-blue-600">
                {credits.balance}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="text-center">
                <div className="text-xs text-gray-500">Inclusos</div>
                <div className="font-medium text-green-600">{credits.includedCredits}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500">Comprados</div>
                <div className="font-medium text-blue-600">{credits.purchasedCredits}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500">Usados</div>
                <div className="font-medium text-gray-600">{credits.consumedCredits}</div>
              </div>
            </div>
          </div>
        )}

        <Separator />

        {/* Quota de Relatórios */}
        {quota && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Relatórios Mensais</span>
              <span className="text-sm font-medium">
                {quota.current} de {quota.limit}
              </span>
            </div>

            <Progress
              value={Math.min(quota.percentage, 100)}
              className="h-2"
            />

            <div className="flex justify-between text-xs text-gray-500">
              <span>{quota.percentage.toFixed(1)}% usado</span>
              <span>{Math.max(0, quota.limit - quota.current)} restantes</span>
            </div>

            {quota.status !== 'ok' && (
              <div className={`p-2 rounded text-xs ${statusConfig.bgColor} ${statusConfig.borderColor} border`}>
                <div className={`font-medium ${statusConfig.color}`}>
                  {quota.status === 'soft_warning' && 'Atenção: Você já usou 80% da sua cota'}
                  {quota.status === 'hard_blocked' && 'Limite atingido - compre créditos para continuar'}
                </div>
              </div>
            )}
          </div>
        )}

        <Separator />

        {/* Resumo do Uso */}
        {usage && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Uso Este Mês
            </h4>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-400" />
                <div>
                  <div className="text-xs text-gray-500">Relatórios</div>
                  <div className="font-medium">{usage.reportsThisMonth}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-gray-400" />
                <div>
                  <div className="text-xs text-gray-500">Créditos</div>
                  <div className="font-medium">{usage.creditsThisMonth}</div>
                </div>
              </div>
            </div>

            {usage.daysUntilReset > 0 && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Calendar className="w-3 h-3" />
                <span>Renova em {usage.daysUntilReset} dia{usage.daysUntilReset !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
        )}

        {/* Ações */}
        <div className="space-y-2">
          <Button
            onClick={onBuyCredits}
            className="w-full"
            variant={overallStatus === 'critical' ? 'default' : 'outline'}
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            Comprar Créditos Extras
          </Button>

          {overallStatus === 'critical' && (
            <div className="text-xs text-center text-gray-500">
              Você precisa de mais créditos para continuar
            </div>
          )}
        </div>

        {/* Dicas contextuais */}
        {overallStatus === 'ok' && credits && credits.balance > 20 && (
          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 mt-0.5" />
              <div className="text-xs text-blue-700">
                <div className="font-medium">Dica:</div>
                <div>Use o agendamento noturno para relatórios com 50% de desconto nos créditos!</div>
              </div>
            </div>
          </div>
        )}

        {overallStatus === 'warning' && (
          <div className="bg-orange-50 p-3 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-600 mt-0.5" />
              <div className="text-xs text-orange-700">
                <div className="font-medium">Recomendação:</div>
                <div>Considere comprar créditos extras para evitar interrupções no serviço.</div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ================================================================
// COMPONENTE COMPACTO PARA SIDEBAR
// ================================================================

interface CreditsWidgetProps {
  workspaceId: string;
  onBuyCredits?: () => void;
}

export function CreditsWidget({ workspaceId, onBuyCredits }: CreditsWidgetProps) {
  const [credits, setCredits] = useState<CreditBalance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCredits = async () => {
      try {
        const response = await fetch(`/api/billing/credits?workspaceId=${workspaceId}&action=balance`, { credentials: 'include' });
        const data = await response.json();

        if (data.success && data.data?.balance) {
          setCredits(data.data.balance);
        } else {
          // Set default on error
          setCredits({
            balance: 0,
            includedCredits: 0,
            purchasedCredits: 0,
            consumedCredits: 0
          });
        }
      } catch (error) {
        console.error('Erro ao carregar créditos:', error);
        // Set default on error
        setCredits({
          balance: 0,
          includedCredits: 0,
          purchasedCredits: 0,
          consumedCredits: 0
        });
      } finally {
        setLoading(false);
      }
    };

    loadCredits();
  }, [workspaceId]);

  if (loading) {
    return (
      <div className="p-3 bg-gray-50 rounded-lg animate-pulse">
        <div className="h-4 bg-gray-200 rounded mb-2"></div>
        <div className="h-6 bg-gray-200 rounded"></div>
      </div>
    );
  }

  if (!credits) return null;

  const isLow = credits.balance <= 5;

  return (
    <div className={`p-3 rounded-lg border ${isLow ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-600">Créditos</span>
        {isLow && <AlertTriangle className="w-3 h-3 text-orange-600" />}
      </div>

      <div className="flex items-center justify-between">
        <span className={`text-lg font-bold ${isLow ? 'text-orange-600' : 'text-blue-600'}`}>
          {credits.balance}
        </span>

        <Button
          size="sm"
          variant="ghost"
          onClick={onBuyCredits}
          className="p-1"
        >
          <Plus className="w-3 h-3" />
        </Button>
      </div>

      {isLow && (
        <div className="text-xs text-orange-700 mt-1">
          Saldo baixo
        </div>
      )}
    </div>
  );
}