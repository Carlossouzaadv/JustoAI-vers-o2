'use client';

import { useState, useEffect } from 'react';
import { CreditCard, TrendingUp, TrendingDown, DollarSign, Calendar, ArrowRight, Settings } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/contexts/auth-context';
import { getApiUrl } from '@/lib/api-client';

interface CreditData {
  balance: number;
  includedCredits: number;
  purchasedCredits: number;
  consumedCredits: number;
  renewalDate?: string;
  monthlyLimit?: number;
  monthlyUsed?: number;
  monthlyPercentage?: number;
}

interface UsageHistory {
  id: string;
  date: string;
  type: 'analysis' | 'report' | 'consultation';
  description: string;
  creditsUsed: number;
  costBRL: number;
}

export default function BillingPage() {
  const [credits, setCredits] = useState<CreditData | null>(null);
  const [history, setHistory] = useState<UsageHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const { workspaceId } = useAuth();

  useEffect(() => {
    const loadBillingData = async () => {
      if (!workspaceId) {
        setLoading(false);
        return;
      }

      try {
        // Carregar dados de créditos usando novo endpoint (Padrão-Ouro: sem query params)
        const creditsRes = await fetch(
          getApiUrl('/api/user/balance'),
          { credentials: 'include' }
        );

        if (creditsRes.ok) {
          const creditsData = await creditsRes.json();
          // Extract the balance data from the response
          if (creditsData.success && creditsData.data?.balance) {
            const balance = creditsData.data.balance;
            setCredits({
              balance: balance.reportCreditsBalance + balance.fullCreditsBalance,
              includedCredits: balance.reportCreditsBalance,
              purchasedCredits: balance.fullCreditsBalance,
              consumedCredits: 0,
            });
          }
        }

        // Carregar histórico de uso real do novo endpoint /api/user/activity (Padrão-Ouro)
        const activityRes = await fetch(
          getApiUrl('/api/user/activity?limit=50'),
          { credentials: 'include' }
        );

        if (activityRes.ok) {
          const activityData = await activityRes.json();

          if (activityData.success && Array.isArray(activityData.data)) {
            // Transform activity items to UsageHistory format
            const transformedHistory: UsageHistory[] = activityData.data
              .filter((item: Record<string, unknown>) => {
                // Only include credit debit transactions (not credits received)
                return (
                  typeof item === 'object' &&
                  item !== null &&
                  'type' in item &&
                  item.type === 'credit_debit'
                );
              })
              .map((item: Record<string, unknown>) => ({
                id: typeof item.id === 'string' ? item.id : '',
                date: typeof item.timestamp === 'string' ? item.timestamp : new Date().toISOString(),
                type: typeof item.creditCategory === 'string' && item.creditCategory === 'FULL'
                  ? 'report'
                  : 'analysis' as const,
                description: typeof item.title === 'string' ? item.title : 'Crédito Utilizado',
                creditsUsed: typeof item.creditAmount === 'number' ? Math.abs(item.creditAmount) : 0,
                costBRL: 0 // Can be calculated from metadata if available
              }));
            setHistory(transformedHistory);
          } else {
            setHistory([]);
          }
        } else {
          setHistory([]);
        }
      } catch (error) {
        console.error('Erro ao carregar dados de billing:', error);
        // Set default empty credits to avoid undefined errors
        setCredits({
          balance: 0,
          includedCredits: 0,
          purchasedCredits: 0,
          consumedCredits: 0,
        });
      } finally {
        setLoading(false);
      }
    };

    loadBillingData();
  }, [workspaceId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-neutral-600">Carregando informações de billing...</p>
        </div>
      </div>
    );
  }

  const creditStatus = credits ? credits.balance <= 0 ? 'critical' : credits.balance <= 100 ? 'warning' : 'healthy' : 'unknown';

  const handleManageSubscription = async () => {
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (res.ok) {
        const data = await res.json();
        window.location.href = data.url;
      } else {
        console.error('Failed to init portal session');
        alert('Erro ao redirecionar para o portal (verifique se você tem um Customer ID no Stripe).');
      }
    } catch (error) {
      console.error('Error redirecting to portal:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Créditos e Faturamento</h1>
          <p className="text-neutral-600">Gerencie seus créditos, visualize uso e faça compras</p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={handleManageSubscription} className="gap-2">
            <Settings className="w-4 h-4" />
            Gerenciar Assinatura
          </Button>
          <Link href="/pricing?tab=credits">
            <Button className="gap-2">
              <CreditCard className="w-4 h-4" />
              Comprar Créditos
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Credits Card */}
      <Card className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-sm font-medium text-blue-600 mb-2">Saldo Disponível</p>
            <h2 className="text-4xl font-bold text-blue-900">{(credits?.balance || 0).toLocaleString('pt-BR')}</h2>
            <p className="text-blue-700 mt-2">Créditos disponíveis para uso</p>
          </div>

          <div className={`h-14 w-14 rounded-lg flex items-center justify-center ${creditStatus === 'critical' ? 'bg-red-100' :
            creditStatus === 'warning' ? 'bg-yellow-100' :
              'bg-green-100'
            }`}>
            <DollarSign className={`w-8 h-8 ${creditStatus === 'critical' ? 'text-red-600' :
              creditStatus === 'warning' ? 'text-yellow-600' :
                'text-green-600'
              }`} />
          </div>
        </div>

        {/* Status indicators */}
        {creditStatus === 'critical' && (
          <div className="bg-red-100 border border-red-200 rounded-lg p-4 text-sm text-red-800">
            ⚠️ Seus créditos estão acabando. Compre mais para continuar usando o sistema.
          </div>
        )}

        {creditStatus === 'warning' && (
          <div className="bg-yellow-100 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
            📌 Você tem poucos créditos disponíveis. Considere comprar mais em breve.
          </div>
        )}

        {creditStatus === 'healthy' && (
          <div className="bg-green-100 border border-green-200 rounded-lg p-4 text-sm text-green-800">
            ✅ Sua conta está com créditos suficientes para uso contínuo.
          </div>
        )}
      </Card>

      {/* Credit Breakdown Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-600 mb-1">Créditos Inclusos</p>
              <p className="text-2xl font-bold text-green-600">
                {(credits?.includedCredits || 0).toLocaleString('pt-BR')}
              </p>
              <p className="text-xs text-neutral-500 mt-2">Vêm com seu plano</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-600 mb-1">Créditos Comprados</p>
              <p className="text-2xl font-bold text-blue-600">
                {(credits?.purchasedCredits || 0).toLocaleString('pt-BR')}
              </p>
              <p className="text-xs text-neutral-500 mt-2">Extras adicionados</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-600 mb-1">Créditos Usados</p>
              <p className="text-2xl font-bold text-orange-600">
                {(credits?.consumedCredits || 0).toLocaleString('pt-BR')}
              </p>
              <p className="text-xs text-neutral-500 mt-2">Neste ciclo</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <TrendingDown className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Monthly Usage */}
      {credits?.monthlyLimit && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-neutral-900">Uso Mensal de Relatórios</h3>
            <Calendar className="w-5 h-5 text-neutral-400" />
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-neutral-700">
                  {credits.monthlyUsed}/{credits.monthlyLimit} relatórios usados
                </span>
                <Badge variant="outline">
                  {Math.round((credits.monthlyUsed || 0) / (credits.monthlyLimit || 1) * 100)}%
                </Badge>
              </div>
              <div className="w-full bg-neutral-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{
                    width: `${Math.min((credits.monthlyPercentage || 0), 100)}%`
                  }}
                ></div>
              </div>
            </div>

            {credits.renewalDate && (
              <p className="text-sm text-neutral-500">
                Renova em {new Date(credits.renewalDate).toLocaleDateString('pt-BR')}
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Usage History */}
      <Card>
        <div className="p-6 border-b border-neutral-200">
          <h3 className="text-lg font-semibold text-neutral-900">Histórico de Uso</h3>
        </div>

        {history.length > 0 ? (
          <div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Créditos</TableHead>
                  <TableHead className="text-right">Valor (R$)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-sm text-neutral-600">
                      {new Date(item.date).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {item.description}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {item.type === 'analysis' ? '📊 Análise' :
                          item.type === 'report' ? '📄 Relatório' :
                            '💬 Consulta'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      -{item.creditsUsed}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      -R$ {item.costBRL.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="p-4 border-t border-neutral-200 flex justify-between items-center">
              <p className="text-sm text-neutral-600">
                Mostrando últimas {history.length} transações
              </p>
              <Button variant="ghost" className="gap-2 text-sm">
                Ver Mais <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-12 text-center">
            <DollarSign className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
            <p className="text-neutral-600 mb-4">Nenhuma transação registrada</p>
            <p className="text-sm text-neutral-500">
              Seu histórico de uso aparecerá aqui quando você começar a usar os serviços
            </p>
          </div>
        )}
      </Card>

      {/* FAQ / Info Section */}
      <Card className="p-6 bg-neutral-50">
        <h3 className="text-lg font-semibold text-neutral-900 mb-4">Precisa de Ajuda?</h3>
        <div className="space-y-3">
          <p className="text-sm text-neutral-700">
            📖 <strong>Como funcionam os créditos?</strong> Cada operação (análise, relatório, consulta) consome um número específico de créditos.
          </p>
          <p className="text-sm text-neutral-700">
            💳 <strong>Como comprar mais créditos?</strong> Clique no botão &quot;Comprar Créditos&quot; acima ou acesse nossa página de planos.
          </p>
          <p className="text-sm text-neutral-700">
            📊 <strong>Como são calculados os preços?</strong> Os preços variam conforme a complexidade da análise e o volume de dados processados.
          </p>
          <div className="pt-4 border-t border-neutral-200">
            <Link href="/pricing">
              <Button variant="outline" className="w-full gap-2">
                Ver Planos e Preços <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
