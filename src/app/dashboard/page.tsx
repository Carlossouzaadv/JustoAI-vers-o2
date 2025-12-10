'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth-context';
import { Loader2 } from 'lucide-react';

// Onboarding Components
import { WelcomeOnboarding } from '@/components/dashboard/welcome-onboarding';
import { WelcomeDashboard } from '@/components/dashboard/welcome-dashboard';
import { DashboardTour } from '@/components/dashboard/onboarding-tour';

// Regular Dashboard UI Components
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ICONS } from '@/lib/icons';
import { getApiUrl } from '@/lib/api-client';
import { useDashboard } from '@/hooks/use-dashboard';
import { useTelemetry } from '@/hooks/use-telemetry';
import { UsageAlert } from '@/components/ui/usage-alert';
import UsageBanner from '@/components/dashboard/usage-banner';
import { CostMetricsCard } from '@/components/dashboard/cost-metrics-card';
import { ApiUsageCard } from '@/components/dashboard/api-usage-card';
import { TelemetryAlertsWidget } from '@/components/dashboard/telemetry-alerts-widget';
import { SubscriptionPlan, UsageStats } from '@/lib/subscription-limits';

// Helper types
interface Activity {
  id: string;
  description?: string;
  createdAt?: string;
}

function isActivity(data: unknown): data is Activity {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  return 'id' in data && typeof (data as Activity).id === 'string';
}

function isValidWorkspaceId(id: string | null): id is string {
  return typeof id === 'string' && id.length > 0;
}

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

function AnimatedNumber({ value, suffix = '', className = '' }: { value: number; suffix?: string; className?: string }) {
  const animatedValue = useCountAnimation(value);
  return <span className={className}>{animatedValue.toLocaleString()}{suffix}</span>;
}

const PRIORITY_ORDER = { high: 3, medium: 2, low: 1 } as const;

// --- Regular Dashboard Component ---
function RegularDashboard({ workspaceId }: { workspaceId: string | null }) {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const { selectedClientId, selectedClientName, setSelectedClient } = useDashboard();
  const { metrics, loading: telemetryLoading } = useTelemetry(workspaceId, 300000);

  const [userPlan] = useState<SubscriptionPlan>('professional');
  const [userUsage] = useState<UsageStats>({
    currentUsers: 0,
    currentProcesses: 0,
    completeAnalysisUsed: 0,
    completeAnalysisRemaining: 0,
    isFirstMonth: false,
    resetDate: new Date().toISOString()
  });

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      if (!workspaceId) {
        setLoading(false);
        return;
      }

      const dashboardResponse = await fetch(getApiUrl(`/api/workspaces/${workspaceId}/summary`), {
        credentials: 'include'
      });

      if (dashboardResponse.ok) {
        const data = await dashboardResponse.json();
        const summary = data.statistics || {
          totalProcesses: 0,
          completedAnalysis: 0,
          partialAnalysis: 0,
          attentionRequired: 0,
          recentUpdates: 0,
          pendingActions: 0,
        };

        if (selectedClientId && !selectedClientName) {
          // Fetch client name logic
          try {
            const clientResponse = await fetch(getApiUrl(`/api/clients/${selectedClientId}`), {
              credentials: 'include'
            });
            if (clientResponse.ok) {
              const clientData = await clientResponse.json();
              const clientName = clientData.client?.name || '';
              setSelectedClient(selectedClientId, clientName);
            }
          } catch (clientError) {
            console.error('Erro ao carregar nome do cliente:', clientError);
          }
        }

        setDashboardData({
          summary: {
            totalProcesses: summary.totalCases || 0,
            completedAnalysis: summary.completedCases || 0,
            partialAnalysis: summary.partialAnalysis || 0,
            attentionRequired: summary.attentionRequired || 0,
            recentUpdates: summary.recentUpdates || 0,
            pendingActions: summary.pendingActions || 0,
          },
          analytics: {
            successRate: 0, // Placeholder
            avgProcessingTime: 0, // Placeholder
            documentsProcessed: summary.documents || 0,
            monthlyGrowth: 0, // Placeholder
          },
          recentActivity: (data.recentActivity || [])
            .filter(isActivity)
            .map((activity: Activity) => ({
              id: activity.id,
              type: 'upload' as const,
              message: activity.description || '',
              timestamp: activity.createdAt || new Date().toISOString()
            })),
          ongoingProcesses: [] // Would be populated from API if available
        });
      } else {
        // Fallback or empty state
        setDashboardData({
          summary: { totalProcesses: 0, completedAnalysis: 0, partialAnalysis: 0, attentionRequired: 0, recentUpdates: 0, pendingActions: 0 },
          analytics: { successRate: 0, avgProcessingTime: 0, documentsProcessed: 0, monthlyGrowth: 0 },
          recentActivity: [],
          ongoingProcesses: []
        });
      }
    } catch (error) {
      console.error(error);
      setDashboardData({
        summary: { totalProcesses: 0, completedAnalysis: 0, partialAnalysis: 0, attentionRequired: 0, recentUpdates: 0, pendingActions: 0 },
        analytics: { successRate: 0, avgProcessingTime: 0, documentsProcessed: 0, monthlyGrowth: 0 },
        recentActivity: [],
        ongoingProcesses: []
      });
    } finally {
      setLoading(false);
    }
  }, [workspaceId, selectedClientId, selectedClientName, setSelectedClient]);

  useEffect(() => {
    if (workspaceId) {
      loadDashboardData();
    }
  }, [workspaceId, loadDashboardData]);

  const smartSort = (processes: DashboardData['ongoingProcesses']) => {
    return [...processes].sort((a, b) => {
      const today = new Date();
      const aDeadline = new Date(a.deadline);
      const bDeadline = new Date(b.deadline);
      const aOverdue = aDeadline < today;
      const bOverdue = bDeadline < today;

      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;
      if (aOverdue && bOverdue) {
        return PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority];
      }
      if (PRIORITY_ORDER[a.priority] !== PRIORITY_ORDER[b.priority]) {
        return PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority];
      }
      return new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime();
    });
  };

  const getPriorityBadge = (priority: string, isOverdue: boolean = false) => {
    if (isOverdue) {
      return <Badge className="bg-red-600 text-white animate-pulse">🚨 VENCIDO</Badge>;
    }
    switch (priority) {
      case 'high': return <Badge className="bg-red-100 text-red-800">Alta</Badge>;
      case 'medium': return <Badge className="bg-yellow-100 text-yellow-800">Média</Badge>;
      case 'low': return <Badge className="bg-green-100 text-green-800">Baixa</Badge>;
      default: return <Badge variant="secondary">Normal</Badge>;
    }
  };

  const getDaysUntilDeadline = (deadline: string) => {
    const today = new Date();
    const deadlineDate = new Date(deadline);
    const diffTime = deadlineDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const sortedProcesses = dashboardData ? smartSort(dashboardData.ongoingProcesses) : [];
  const validWorkspaceId = isValidWorkspaceId(workspaceId) ? workspaceId : null;

  if (loading) return <div className="p-8"><Loader2 className="animate-spin" /> Carregando dashboard...</div>;

  return (
    <div className="space-y-6">
      {validWorkspaceId && (
        <UsageBanner
          workspaceId={validWorkspaceId}
          onUpgrade={() => window.open('/pricing', '_blank')}
          onBuyCredits={() => window.open('/pricing?tab=credits', '_blank')}
        />
      )}
      <UsageAlert
        plan={userPlan}
        usage={userUsage}
        onUpgrade={() => window.open('/pricing', '_blank')}
      />

      {/* Metrics Section */}
      <section>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {metrics && (
            <CostMetricsCard
              totalCost={metrics.monthlyUsage.totalCost}
              dailyAverage={metrics.monthlyUsage.dailyAverage}
              trend={metrics.monthlyUsage.trend}
              loading={telemetryLoading}
            />
          )}
          {metrics && (
            <ApiUsageCard
              successRate={metrics.monthlyUsage.successRate}
              avgResponseTime={metrics.monthlyUsage.avgResponseTime}
              totalOperations={metrics.monthlyUsage.operations.reduce((sum, op) => sum + op.count, 0)}
              loading={telemetryLoading}
            />
          )}
          {metrics && (
            <TelemetryAlertsWidget
              alerts={metrics.activeAlerts.alerts}
              totalCount={metrics.activeAlerts.total}
              criticalCount={metrics.activeAlerts.critical}
              highCount={metrics.activeAlerts.high}
              loading={telemetryLoading}
            />
          )}
        </div>
      </section>

      {/* Action Cards */}
      <section>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="border-red-200 bg-red-50 cursor-pointer hover:bg-red-100 hover:shadow-lg transform hover:scale-[1.02] transition-all duration-300"
            onClick={() => window.location.href = '/dashboard/process?filter=attention_required'}>
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

          <div className="grid grid-cols-2 gap-4">
            <Card className="hover:shadow-lg transform hover:scale-[1.02] transition-all duration-300 cursor-pointer group"
              onClick={() => window.location.href = '/dashboard/documents-upload'}>
              <CardContent className="p-6">
                <div className="text-center space-y-2">
                  <div className="text-3xl group-hover:scale-110 transition-transform duration-300">{ICONS.UPLOAD}</div>
                  <h3 className="font-medium">Upload Documento</h3>
                  <p className="text-sm text-muted-foreground">Enviar novo arquivo</p>
                </div>
              </CardContent>
            </Card>
            <Card className="hover:shadow-lg transform hover:scale-[1.02] transition-all duration-300 cursor-pointer group"
              onClick={() => window.location.href = '/dashboard/clients'}>
              <CardContent className="p-6">
                <div className="text-center space-y-2">
                  <div className="text-3xl group-hover:scale-110 transition-transform duration-300">{ICONS.CLIENT}</div>
                  <h3 className="font-medium">Novo Cliente</h3>
                  <p className="text-sm text-muted-foreground">Cadastrar cliente</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Overview Section */}
      <section>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="cursor-pointer hover:shadow-lg transform hover:scale-[1.02] transition-all duration-300 group" onClick={() => window.location.href = '/dashboard/process?period=month'}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <span className="text-lg group-hover:scale-110">{ICONS.PROCESS}</span> Total Analisado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboardData && <AnimatedNumber value={dashboardData.summary.totalProcesses} />}
              </div>
              <Badge variant="secondary" className="mt-1">{ICONS.ARROW_UP} +{dashboardData?.analytics.monthlyGrowth}%</Badge>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transform hover:scale-[1.02] transition-all duration-300 group" onClick={() => window.location.href = '/dashboard/process?filter=success'}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <span className="text-lg group-hover:scale-110">{ICONS.SUCCESS}</span> Sucesso
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {dashboardData && <AnimatedNumber value={dashboardData.analytics.successRate} suffix="%" />}
              </div>
              <Progress value={dashboardData?.analytics.successRate} className="mt-2" />
            </CardContent>
          </Card>

          {/* More stats cards... */}
        </div>
      </section>

      {/* Deadlines Section */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">{ICONS.WARNING} Próximos Prazos e Alertas</div>
              <Button variant="outline" size="sm" onClick={() => window.location.href = '/dashboard/process?filter=urgent'}>Ver Urgentes</Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(() => {
                const urgentProcesses = sortedProcesses.filter(p => {
                  const days = getDaysUntilDeadline(p.deadline);
                  return days <= 3 || p.priority === 'high';
                }).slice(0, 4);

                if (urgentProcesses.length === 0) {
                  return <div className="text-center py-8 text-muted-foreground"><p>Nenhum prazo urgente.</p></div>;
                }

                return urgentProcesses.map(process => {
                  const days = getDaysUntilDeadline(process.deadline);
                  const isOverdue = days < 0;
                  return (
                    <div key={process.id} className="border rounded-lg p-3 flex justify-between items-center cursor-pointer hover:bg-slate-50" onClick={() => window.location.href = `/dashboard/process/${process.id}`}>
                      <div>
                        <h4 className="font-medium">{process.name}</h4>
                        <p className="text-xs text-muted-foreground">{process.client} • {isOverdue ? `Vencido há ${Math.abs(days)} dias` : `${days} dias restantes`}</p>
                      </div>
                      {getPriorityBadge(process.priority, isOverdue)}
                    </div>
                  );
                });
              })()}
            </div>
          </CardContent>
        </Card>
      </section>

      <DashboardTour />
    </div>
  );
}

// --- Main Page Component ---
export default function DashboardPage() {
  const { user, isLoaded } = useUser();
  const { workspaceId, loading: authLoading } = useAuth();

  const { data: userState, isLoading: isStateLoading } = useQuery({
    queryKey: ['user-onboarding-state'],
    queryFn: async () => {
      const res = await fetch('/api/users/me');
      if (!res.ok) throw new Error('Failed to fetch user state');
      return res.json();
    },
    enabled: !!user,
  });

  if (!isLoaded || authLoading || isStateLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  const userData = userState?.data;

  // 1. Welcome Wizard
  if (userData && !userData.onboardingCompleted) {
    return <WelcomeOnboarding userId={user?.id} onComplete={() => window.location.reload()} />;
  }

  // 2. Welcome Dashboard (Empty State)
  if (userData && userData.onboardingCompleted && !userData.hasUploadedDocuments && !userData.hasPendingCases) {
    return (
      <div className="min-h-screen bg-slate-50 pb-20">
        <WelcomeDashboard
          userName={userData.name || user?.firstName || 'Doutor(a)'}
          hasUploadedDocuments={userData.hasUploadedDocuments}
          hasCreatedClient={userData.hasCreatedClient}
          hasGeneratedReport={userData.hasGeneratedReport}
          pendingCount={userData.pendingCount || 0}
        />
      </div>
    );
  }

  // 3. Regular Dashboard
  return <RegularDashboard workspaceId={workspaceId} />;
}