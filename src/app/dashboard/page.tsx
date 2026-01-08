'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth-context';
import { Loader2, ArrowUp, CheckCircle, AlertTriangle } from 'lucide-react';
import { redirect } from 'next/navigation';
import { ErrorBoundary } from '@/components/error-boundary';

// Onboarding Components
import { WelcomeOnboarding } from '@/components/dashboard/welcome-onboarding';
import { WelcomeDashboard } from '@/components/dashboard/welcome-dashboard';
import { DashboardOnboarding } from '@/components/dashboard/onboarding-tour';

// Regular Dashboard UI Components (Command Center)
import { GreetingHeader } from '@/components/dashboard/command-center/greeting-header';
import { ActionGrid } from '@/components/dashboard/command-center/action-grid';
import { DeadlineRadar, Process } from '@/components/dashboard/command-center/deadline-radar';
import { PriorityInbox, PriorityItem } from '@/components/dashboard/command-center/priority-inbox';
import { UsageAlert } from '@/components/ui/usage-alert';
import UsageBanner from '@/components/dashboard/usage-banner';
import { CostMetricsCard } from '@/components/dashboard/cost-metrics-card';
import { ApiUsageCard } from '@/components/dashboard/api-usage-card';
import { TelemetryAlertsWidget } from '@/components/dashboard/telemetry-alerts-widget';
import { SubscriptionPlan, UsageStats } from '@/lib/subscription-limits';
import { getApiUrl } from '@/lib/api-client';
import { useDashboard } from '@/hooks/use-dashboard';
import { useTelemetry } from '@/hooks/use-telemetry';

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

// --- Regular Dashboard Component (Command Center) ---
function RegularDashboard({ workspaceId }: { workspaceId: string | null }) {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [processes, setProcesses] = useState<Process[]>([]);

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

      // 1. Fetch Summary
      const summaryPromise = fetch(getApiUrl(`/api/workspaces/${workspaceId}/summary`), {
        credentials: 'include'
      }).then(res => res.ok ? res.json() : null);

      // 2. Fetch Active Cases for Radar (fetching 50 active cases)
      const casesPromise = fetch(getApiUrl(`/api/cases?workspaceId=${workspaceId}&status=ACTIVE&limit=50`), {
        credentials: 'include'
      }).then(res => res.ok ? res.json() : null);

      const [summaryData, casesData] = await Promise.all([summaryPromise, casesPromise]);

      // Process Summary
      if (summaryData) {
        const summary = summaryData.statistics || {};
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
            successRate: 0,
            avgProcessingTime: 0,
            documentsProcessed: summary.documents || 0,
            monthlyGrowth: 0,
          },
          recentActivity: [],
          ongoingProcesses: []
        });
      }

      // Process Cases for Radar
      // Process Cases for Radar
      if (casesData && casesData.success && Array.isArray(casesData.data)) {
        interface CaseData {
          id: string;
          title: string;
          client?: { name: string };
          expectedEndDate?: string;
          priority?: string;
        }
        const data = casesData.data as CaseData[];
        const mappedProcesses: Process[] = data.map((c) => ({
          id: c.id,
          name: c.title,
          client: c.client?.name || 'Cliente Desconhecido',
          deadline: c.expectedEndDate || new Date(Date.now() + 86400000 * 7).toISOString(), // Fallback to 7 days if no deadline
          priority: (c.priority?.toLowerCase() || 'medium') as 'high' | 'medium' | 'low'
        }));
        setProcesses(mappedProcesses);
      }

    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (workspaceId) {
      loadDashboardData();
    }
  }, [workspaceId, loadDashboardData]);

  // Generate Priority Items
  const priorityItems: PriorityItem[] = [];
  if (dashboardData?.summary.attentionRequired) {
    priorityItems.push({
      id: 'atten-1',
      type: 'error',
      title: 'Processos Requerendo Atenção',
      description: `${dashboardData.summary.attentionRequired} processos precisam de verificação manual ou corrigidos.`,
      actionLabel: 'Resolver',
      actionHref: '/dashboard/process?filter=attention_required'
    });
  }
  if (dashboardData?.summary.pendingActions) {
    priorityItems.push({
      id: 'pend-1',
      type: 'pending',
      title: 'Ações Pendentes',
      description: `${dashboardData.summary.pendingActions} ações aguardam sua aprovação.`,
      actionLabel: 'Ver Ações',
      actionHref: '/dashboard/process?status=PENDING'
    });
  }

  // Calculate Urgent Count from processes
  const urgentCount = processes.filter(p => {
    if (!p.deadline) return false;
    const days = Math.ceil((new Date(p.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days <= 3;
  }).length;

  if (loading) return <div className="p-8"><Loader2 className="animate-spin text-primary-600" /> <span className="ml-2 text-slate-500">Carregando seu centro de comando...</span></div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* 1. Header & Status */}
      <GreetingHeader
        userName={user?.name || 'Doutor(a)'}
        totalMonitored={dashboardData?.summary.totalProcesses || 0}
        urgentCount={urgentCount}
      />

      {/* 2. Priority Inbox (if items exist) */}
      <div className="max-w-5xl">
        <PriorityInbox items={priorityItems} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

        {/* 3. Main Action Column (Left) */}
        <div className="xl:col-span-2 space-y-8">
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-800">Ações Rápidas</h2>
            </div>
            <ActionGrid />
          </section>

          <section>
            {/* 4. Radar (Timeline) */}
            <DeadlineRadar processes={processes} />
          </section>
        </div>

        {/* 4. Metrics & Usage (Right Sidebar) */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-slate-800 mb-4">Saúde do Escritório</h2>
          {metrics && (
            <div className="space-y-4">
              <TelemetryAlertsWidget
                alerts={metrics.activeAlerts.alerts}
                totalCount={metrics.activeAlerts.total}
                criticalCount={metrics.activeAlerts.critical}
                highCount={metrics.activeAlerts.high}
                loading={telemetryLoading}
              />
              <CostMetricsCard
                totalCost={metrics.monthlyUsage.totalCost}
                dailyAverage={metrics.monthlyUsage.dailyAverage}
                trend={metrics.monthlyUsage.trend}
                loading={telemetryLoading}
              />
              <ApiUsageCard
                successRate={metrics.monthlyUsage.successRate}
                avgResponseTime={metrics.monthlyUsage.avgResponseTime}
                totalOperations={metrics.monthlyUsage.operations.reduce((sum, op) => sum + op.count, 0)}
                loading={telemetryLoading}
              />
            </div>
          )}
          <UsageAlert
            plan={userPlan}
            usage={userUsage}
            onUpgrade={() => window.open('/pricing', '_blank')}
          />
        </div>
      </div>

      <DashboardOnboarding />
    </div>
  );
}

// --- Main Page Component ---
export default function DashboardPage() {
  const { user, workspaceId, loading } = useAuth();

  const { data: userState, isLoading: isStateLoading } = useQuery({
    queryKey: ['user-onboarding-state'],
    queryFn: async () => {
      const res = await fetch('/api/users/me');
      if (!res.ok) throw new Error('Failed to fetch user state');
      return res.json();
    },
    enabled: !!user,
  });

  // Unified loading state
  if (loading || isStateLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          <p className="text-sm text-slate-600">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  // Workspace undefined protection
  if (user && !workspaceId) {
    const userData = userState?.data;

    // Check if onboarding is needed
    if (userData && !userData.onboardingCompleted) {
      redirect('/onboarding');
    } else {
      // Completed onboarding but workspace failed to load
      return (
        <div className="flex h-screen w-full items-center justify-center bg-slate-50">
          <div className="text-center space-y-4">
            <div className="text-red-600 text-lg font-semibold">
              ⚠️ Erro ao carregar workspace
            </div>
            <p className="text-slate-600 text-sm">
              Não foi possível carregar seus dados. Tente novamente.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Recarregar página
            </button>
          </div>
        </div>
      );
    }
  }

  const userData = userState?.data;

  // 1. Welcome Wizard (Redundant but safe double-check)
  if (userData && !userData.onboardingCompleted) {
    return <WelcomeOnboarding userId={user?.id} onComplete={() => window.location.reload()} />;
  }

  // 2. Welcome Dashboard (Empty State)
  if (userData && userData.onboardingCompleted &&
    (!userData.documentsCount || userData.documentsCount === 0)) {
    return (
      <div className="min-h-screen bg-slate-50 pb-20">
        <WelcomeDashboard
          userName={userData.name || user?.name || 'Doutor(a)'}
          hasUploadedDocuments={userData.hasUploadedDocuments}
          hasCreatedClient={userData.hasCreatedClient}
          hasGeneratedReport={userData.hasGeneratedReport}
          pendingCount={userData.pendingCount || 0}
        />
      </div>
    );
  }

  // 3. Regular Dashboard
  return (
    <ErrorBoundary>
      <RegularDashboard workspaceId={workspaceId!} />
    </ErrorBoundary>
  );
}