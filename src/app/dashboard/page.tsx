'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ICONS } from '@/lib/icons';
import { useDashboard } from './layout';
import { WelcomeOnboarding } from '@/components/dashboard/welcome-onboarding';
import { useOnboarding } from '@/hooks/use-onboarding';
import { UsageAlert } from '@/components/ui/usage-alert';
import CreditsCard from '@/components/dashboard/credits-card';
import UsageBanner from '@/components/dashboard/usage-banner';
import {
  SubscriptionPlan,
  UsageStats,
} from '@/lib/subscription-limits';

interface DashboardData {
  summary: {
    totalProcesses: number;
    completedAnalysis: number;
    partialAnalysis: number;
    attentionRequired: number;
    recentUpdates: number;
    pendingActions: number;
  };
  analytics: {
    successRate: number;
    avgProcessingTime: number;
    documentsProcessed: number;
    monthlyGrowth: number;
  };
  recentActivity: Array<{
    id: string;
    type: 'upload' | 'analysis' | 'client' | 'error';
    message: string;
    timestamp: string;
  }>;
  ongoingProcesses: Array<{
    id: string;
    name: string;
    status: 'processing' | 'waiting';
    client: string;
    progress: number;
    uploadDate: string;
    priority: 'high' | 'medium' | 'low';
    analysisType: 'essential' | 'strategic';
    submittedBy: string;
    deadline: string;
  }>;
}

// Hook para animação de contagem
function useCountAnimation(endValue: number, duration: number = 2000) {
  const [count, setCount] = useState(0);
  const countRef = useRef(0);

  useEffect(() => {
    let startTime: number;
    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);

      countRef.current = Math.floor(progress * endValue);
      setCount(countRef.current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [endValue, duration]);

  return count;
}

// Componente para números animados
function AnimatedNumber({ value, suffix = '', className = '' }: { value: number; suffix?: string; className?: string }) {
  const animatedValue = useCountAnimation(value);
  return <span className={className}>{animatedValue.toLocaleString()}{suffix}</span>;
}

export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadNotifications, setUnreadNotifications] = useState(3);
  const { selectedClientId, selectedClientName, setSelectedClient } = useDashboard();
  const { showOnboarding, isLoading: onboardingLoading, completeOnboarding } = useOnboarding();
  const [workspaceId] = useState('ws-current'); // Mock workspace ID - in real app, get from context

  // Mock user plan and usage - in real app, this would come from user context
  const [userPlan] = useState<SubscriptionPlan>('professional');
  const [userUsage] = useState<UsageStats>({
    currentUsers: 3,
    currentProcesses: 45,
    completeAnalysisUsed: 12,
    completeAnalysisRemaining: 3,
    isFirstMonth: false,
    resetDate: '2025-02-01T00:00:00Z'
  });

  useEffect(() => {
    loadDashboardData();
  }, [selectedClientId]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Carregar dados gerais do dashboard
      const dashboardResponse = await fetch('/api/workspaces/current/summary');
      let summaryData = {
        totalProcesses: 0,
        completedAnalysis: 0,
        partialAnalysis: 0,
        attentionRequired: 0,
        recentUpdates: 0,
        pendingActions: 0,
      };

      if (dashboardResponse.ok) {
        const data = await dashboardResponse.json();
        summaryData = data.summary || summaryData;
      }

      // Se um cliente está selecionado, buscar nome do cliente
      if (selectedClientId && !selectedClientName) {
        const clientResponse = await fetch(`/api/clients/${selectedClientId}`);
        if (clientResponse.ok) {
          const clientData = await clientResponse.json();
          const clientName = clientData.client?.name || '';
          setSelectedClient(selectedClientId, clientName);
        }
      }

      // Dados de fallback para desenvolvimento
      setDashboardData({
        summary: summaryData.totalProcesses > 0 ? summaryData : {
          totalProcesses: 1247,
          completedAnalysis: 956,
          partialAnalysis: 234,
          attentionRequired: 57,
          recentUpdates: 23,
          pendingActions: 12,
        },
        analytics: {
          successRate: 94.5,
          avgProcessingTime: 2.3,
          documentsProcessed: 8429,
          monthlyGrowth: 12.8,
        },
        recentActivity: [
          { id: '1', type: 'upload', message: 'Novo documento enviado - Contrato XYZ.pdf', timestamp: '2025-01-18T10:30:00Z' },
          { id: '2', type: 'analysis', message: 'Análise completa - Processo ABC123', timestamp: '2025-01-18T10:15:00Z' },
          { id: '3', type: 'client', message: 'Novo cliente cadastrado: Maria Silva', timestamp: '2025-01-18T09:45:00Z' },
          { id: '4', type: 'error', message: 'Erro na análise - Documento corrompido', timestamp: '2025-01-18T09:30:00Z' },
          { id: '5', type: 'analysis', message: 'Análise iniciada - Documento DEF456.pdf', timestamp: '2025-01-18T09:00:00Z' },
        ],
        ongoingProcesses: [
          {
            id: '1',
            name: 'Processo_Trabalhista_XYZ.pdf',
            status: 'processing',
            client: 'Maria Santos',
            progress: 65,
            uploadDate: '2025-01-18T09:15:00Z',
            priority: 'high',
            analysisType: 'strategic',
            submittedBy: 'Dr. Carlos Silva',
            deadline: '2025-02-15T23:59:59Z'
          },
          {
            id: '2',
            name: 'Documento_Fiscal_2024.pdf',
            status: 'waiting',
            client: 'Carlos Lima',
            progress: 0,
            uploadDate: '2025-01-18T10:00:00Z',
            priority: 'medium',
            analysisType: 'essential',
            submittedBy: 'Dra. Ana Costa',
            deadline: '2025-02-15T23:59:59Z'
          },
          {
            id: '3',
            name: 'Estatuto_Social_v2.pdf',
            status: 'processing',
            client: 'Pedro Oliveira',
            progress: 30,
            uploadDate: '2025-01-18T11:00:00Z',
            priority: 'low',
            analysisType: 'strategic',
            submittedBy: 'Dr. João Santos',
            deadline: '2025-02-15T23:59:59Z'
          },
          {
            id: '4',
            name: 'Contrato_Prestacao_Servicos.pdf',
            status: 'waiting',
            client: 'Ana Costa',
            progress: 0,
            uploadDate: '2025-01-18T11:30:00Z',
            priority: 'high',
            analysisType: 'essential',
            submittedBy: 'Dr. Pedro Lima',
            deadline: '2025-01-19T23:59:59Z' // Prazo vencido para demonstração
          },
        ]
      });

    } catch (error) {
      console.error('Erro ao carregar dados do dashboard:', error);

      // Dados de fallback para desenvolvimento
      setDashboardData({
        summary: {
          totalProcesses: 1247,
          completedAnalysis: 956,
          partialAnalysis: 234,
          attentionRequired: 57,
          recentUpdates: 23,
          pendingActions: 12,
        },
        analytics: {
          successRate: 94.5,
          avgProcessingTime: 2.3,
          documentsProcessed: 8429,
          monthlyGrowth: 12.8,
        },
        recentActivity: [
          { id: '1', type: 'upload', message: 'Novo documento enviado - Contrato XYZ.pdf', timestamp: '2025-01-18T10:30:00Z' },
          { id: '2', type: 'analysis', message: 'Análise completa - Processo ABC123', timestamp: '2025-01-18T10:15:00Z' },
          { id: '3', type: 'client', message: 'Novo cliente cadastrado: Maria Silva', timestamp: '2025-01-18T09:45:00Z' },
          { id: '4', type: 'error', message: 'Erro na análise - Documento corrompido', timestamp: '2025-01-18T09:30:00Z' },
          { id: '5', type: 'analysis', message: 'Análise iniciada - Documento DEF456.pdf', timestamp: '2025-01-18T09:00:00Z' },
        ],
        ongoingProcesses: [
          {
            id: '1',
            name: 'Processo_Trabalhista_XYZ.pdf',
            status: 'processing',
            client: 'Maria Santos',
            progress: 65,
            uploadDate: '2025-01-18T09:15:00Z',
            priority: 'high',
            analysisType: 'strategic',
            submittedBy: 'Dr. Carlos Silva',
            deadline: '2025-02-15T23:59:59Z'
          },
          {
            id: '2',
            name: 'Documento_Fiscal_2024.pdf',
            status: 'waiting',
            client: 'Carlos Lima',
            progress: 0,
            uploadDate: '2025-01-18T10:00:00Z',
            priority: 'medium',
            analysisType: 'essential',
            submittedBy: 'Dra. Ana Costa',
            deadline: '2025-02-15T23:59:59Z'
          },
          {
            id: '3',
            name: 'Estatuto_Social_v2.pdf',
            status: 'processing',
            client: 'Pedro Oliveira',
            progress: 30,
            uploadDate: '2025-01-18T11:00:00Z',
            priority: 'low',
            analysisType: 'strategic',
            submittedBy: 'Dr. João Santos',
            deadline: '2025-02-15T23:59:59Z'
          },
          {
            id: '4',
            name: 'Contrato_Prestacao_Servicos.pdf',
            status: 'waiting',
            client: 'Ana Costa',
            progress: 0,
            uploadDate: '2025-01-18T11:30:00Z',
            priority: 'high',
            analysisType: 'essential',
            submittedBy: 'Dr. Pedro Lima',
            deadline: '2025-01-19T23:59:59Z' // Prazo vencido para demonstração
          },
        ]
      });
    } finally {
      setLoading(false);
    }
  };

  // Smart Sorting: Ordenação inteligente por urgência
  const smartSort = (processes: DashboardData['ongoingProcesses']) => {
    return [...processes].sort((a, b) => {
      const today = new Date();
      const aDeadline = new Date(a.deadline);
      const bDeadline = new Date(b.deadline);

      // 1. Primeiro: Prazos vencidos
      const aOverdue = aDeadline < today;
      const bOverdue = bDeadline < today;

      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;

      // 2. Se ambos vencidos, ordenar por prioridade
      if (aOverdue && bOverdue) {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }

      // 3. Depois: Prioridade (alta primeiro)
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }

      // 4. Por último: Data de upload (mais recente primeiro)
      return new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime();
    });
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'upload': return ICONS.UPLOAD;
      case 'analysis': return ICONS.PROCESS;
      case 'client': return ICONS.CLIENT;
      case 'error': return ICONS.ERROR;
      default: return ICONS.INFO;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'upload': return 'text-blue-500';
      case 'analysis': return 'text-green-500';
      case 'client': return 'text-purple-500';
      case 'error': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'processing':
        return <Badge className="bg-blue-100 text-blue-800">{ICONS.PROCESS} Processando</Badge>;
      case 'waiting':
        return <Badge className="bg-yellow-100 text-yellow-800">{ICONS.TIME} Aguardando</Badge>;
      default:
        return <Badge variant="secondary">Desconhecido</Badge>;
    }
  };

  const getPriorityBadge = (priority: string, isOverdue: boolean = false) => {
    if (isOverdue) {
      return <Badge className="bg-red-600 text-white animate-pulse">🚨 VENCIDO</Badge>;
    }

    switch (priority) {
      case 'high':
        return <Badge className="bg-red-100 text-red-800">Alta</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-100 text-yellow-800">Média</Badge>;
      case 'low':
        return <Badge className="bg-green-100 text-green-800">Baixa</Badge>;
      default:
        return <Badge variant="secondary">Normal</Badge>;
    }
  };

  const getAnalysisTypeLabel = (type: string) => {
    switch (type) {
      case 'essential': return 'Análise Essencial';
      case 'strategic': return 'Análise Estratégica';
      default: return 'Análise Padrão';
    }
  };

  const getDaysUntilDeadline = (deadline: string) => {
    const today = new Date();
    const deadlineDate = new Date(deadline);
    const diffTime = deadlineDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Loading skeleton com animações suaves */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-20 bg-gradient-to-r from-gray-200 to-gray-300 rounded animate-shimmer"></div>
            </CardContent>
          </Card>
          <div className="grid grid-cols-2 gap-4">
            <Card className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-20 bg-gradient-to-r from-gray-200 to-gray-300 rounded animate-shimmer"></div>
              </CardContent>
            </Card>
            <Card className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-20 bg-gradient-to-r from-gray-200 to-gray-300 rounded animate-shimmer"></div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  const sortedProcesses = dashboardData ? smartSort(dashboardData.ongoingProcesses) : [];

  return (
    <div className="space-y-6">
      {/* Usage Banner - Telemetria e Alertas */}
      <UsageBanner
        workspaceId={workspaceId}
        onUpgrade={() => window.open('/pricing', '_blank')}
        onBuyCredits={() => window.open('/pricing?tab=credits', '_blank')}
      />

      {/* Usage Alert - Limites de Plano */}
      <UsageAlert
        plan={userPlan}
        usage={userUsage}
        onUpgrade={() => window.open('/pricing', '_blank')}
      />

      {/* Seção 1: Créditos e Ações Imediatas */}
      <section>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Card de Créditos */}
          <CreditsCard
            workspaceId={workspaceId}
            onBuyCredits={() => window.open('/pricing?tab=credits', '_blank')}
            className="lg:col-span-1"
          />

          {/* Card de Alerta - Centro */}
          <Card
            className="border-red-200 bg-red-50 cursor-pointer hover:bg-red-100 hover:shadow-lg transform hover:scale-[1.02] transition-all duration-300"
            onClick={() => {
              // Navegar para lista filtrada de itens que requerem atenção
              window.location.href = '/dashboard/process?filter=attention_required';
            }}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-700 flex items-center gap-2">
                <span className="text-lg animate-pulse">{ICONS.WARNING}</span> Requer Atenção
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600 mb-1">
                {dashboardData && <AnimatedNumber value={dashboardData.summary.attentionRequired} />}
              </div>
              <p className="text-sm text-red-600">Ações necessárias ou processos com erro</p>
            </CardContent>
          </Card>

          {/* Botões de Ação Rápida - Direita */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="hover:shadow-lg transform hover:scale-[1.02] transition-all duration-300 cursor-pointer group"
                  onClick={() => window.location.href = '/dashboard/upload'}>
              <CardContent className="p-6">
                <div className="text-center space-y-2">
                  <div className="text-3xl group-hover:scale-110 transition-transform duration-300">{ICONS.UPLOAD}</div>
                  <h3 className="font-medium">Upload Documento</h3>
                  <p className="text-sm text-muted-foreground">Enviar novo arquivo para análise</p>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transform hover:scale-[1.02] transition-all duration-300 cursor-pointer group"
                  onClick={() => window.location.href = '/dashboard/clients'}>
              <CardContent className="p-6">
                <div className="text-center space-y-2">
                  <div className="text-3xl group-hover:scale-110 transition-transform duration-300">{ICONS.CLIENT}</div>
                  <h3 className="font-medium">Novo Cliente</h3>
                  <p className="text-sm text-muted-foreground">Cadastrar novo cliente</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Seção 2: Visão Geral de Desempenho */}
      <section>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card
            className="cursor-pointer hover:shadow-lg transform hover:scale-[1.02] transition-all duration-300 group"
            onClick={() => window.location.href = '/dashboard/process?period=month'}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <span className="text-lg group-hover:scale-110 transition-transform duration-300">{ICONS.PROCESS}</span>
                Documentos Analisados no Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboardData && <AnimatedNumber value={dashboardData.summary.totalProcesses} />}
              </div>
              <Badge variant="secondary" className="mt-1">
                {ICONS.ARROW_UP} +{dashboardData?.analytics.monthlyGrowth}% este mês
              </Badge>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-lg transform hover:scale-[1.02] transition-all duration-300 group"
            onClick={() => window.location.href = '/dashboard/process?filter=success'}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <span className="text-lg group-hover:scale-110 transition-transform duration-300">{ICONS.SUCCESS}</span>
                Análises Bem-Sucedidas
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-muted-foreground cursor-help ml-1">{ICONS.INFO}</span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Porcentagem de documentos que foram analisados com sucesso pela JustoAI, sem erros ou falhas durante o processamento.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {dashboardData && <AnimatedNumber value={dashboardData.analytics.successRate} suffix="%" />}
              </div>
              <Progress value={dashboardData?.analytics.successRate} className="mt-2" />
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-lg transform hover:scale-[1.02] transition-all duration-300 group"
            onClick={() => window.location.href = '/dashboard/reports'}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <span className="text-lg group-hover:scale-110 transition-transform duration-300">{ICONS.TIME}</span>
                Velocidade de Processamento
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-muted-foreground cursor-help ml-1">{ICONS.INFO}</span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Tempo médio que a JustoAI leva para completar a análise de um documento, do momento do envio até a finalização do relatório.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboardData && <AnimatedNumber value={dashboardData.analytics.avgProcessingTime} suffix="h" />}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Tempo médio por análise</p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-lg transform hover:scale-[1.02] transition-all duration-300 group"
            onClick={() => window.location.href = '/dashboard/process?view=all'}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <span className="text-lg group-hover:scale-110 transition-transform duration-300">{ICONS.DOCUMENT}</span>
                Volume Total Processado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboardData && <AnimatedNumber value={dashboardData.analytics.documentsProcessed} />}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Documentos analisados desde o início</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Seção 3: Próximos Prazos e Alertas */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {ICONS.WARNING} Próximos Prazos e Alertas
              </div>
              <Button
                variant="outline"
                size="sm"
                className="hover:scale-105 transition-transform duration-200"
                onClick={() => window.location.href = '/dashboard/process?filter=urgent'}
              >
                Ver Urgentes
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(() => {
                const urgentProcesses = sortedProcesses.filter(process => {
                  const daysUntilDeadline = getDaysUntilDeadline(process.deadline);
                  return daysUntilDeadline <= 3 || process.priority === 'high';
                }).slice(0, 4);

                if (urgentProcesses.length === 0) {
                  return (
                    <div className="text-center py-8 text-muted-foreground">
                      <div className="text-4xl mb-2 text-green-500">{ICONS.SUCCESS}</div>
                      <p className="font-medium text-green-600">Todos os prazos estão em dia!</p>
                      <p className="text-sm">Não há tarefas urgentes no momento</p>
                    </div>
                  );
                }

                return urgentProcesses.map((process) => {
                  const daysUntilDeadline = getDaysUntilDeadline(process.deadline);
                  const isOverdue = daysUntilDeadline < 0;
                  const isToday = daysUntilDeadline === 0;
                  const isTomorrow = daysUntilDeadline === 1;

                  let urgencyColor = 'border-yellow-300 bg-yellow-50';
                  let urgencyText = `${daysUntilDeadline} dias restantes`;

                  if (isOverdue) {
                    urgencyColor = 'border-red-400 bg-red-50';
                    urgencyText = `Vencido há ${Math.abs(daysUntilDeadline)} dias`;
                  } else if (isToday) {
                    urgencyColor = 'border-orange-400 bg-orange-50';
                    urgencyText = 'Vence hoje';
                  } else if (isTomorrow) {
                    urgencyColor = 'border-orange-300 bg-orange-50';
                    urgencyText = 'Vence amanhã';
                  }

                  return (
                    <div
                      key={process.id}
                      className={`border rounded-lg p-3 hover:shadow-md transition-all duration-300 cursor-pointer ${urgencyColor}`}
                      onClick={() => window.location.href = `/dashboard/process/${process.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg">{isOverdue ? '🚨' : isToday ? '⚡' : isTomorrow ? '⏰' : '📅'}</span>
                            <h4 className="font-medium text-sm truncate max-w-[200px]">{process.name}</h4>
                            {getPriorityBadge(process.priority, isOverdue)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            <p><strong>Cliente:</strong> {process.client}</p>
                            <p className={`font-medium mt-1 ${isOverdue ? 'text-red-600' : isToday ? 'text-orange-600' : 'text-yellow-600'}`}>
                              {urgencyText}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="hover:scale-105 transition-transform duration-200"
                        >
                          {ICONS.ARROW_RIGHT}
                        </Button>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </CardContent>
        </Card>
      </section>



      {/* Welcome Onboarding */}
      {showOnboarding && !onboardingLoading && (
        <WelcomeOnboarding onComplete={completeOnboarding} />
      )}
    </div>
  );
}