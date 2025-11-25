'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  SubscriptionPlan,
  UsageStats,
} from '@/lib/subscription-limits';
import { ICONS } from '@/lib/icons';
import { AnalysisVersionHistory } from './analysis-version-history';
import { AnalysisContentDisplay } from './analysis-content-display';
import { GenerateAnalysisModal } from './generate-analysis-modal';

interface AIAnalysisVersion {
  id: string;
  version: number;
  createdAt: string;
  status: 'generating' | 'completed' | 'error';
  progress?: number;
  analysisType: 'essential' | 'strategic' | 'complete';
  model: 'gemini-flash-8b' | 'gemini-flash' | 'gemini-pro';

  // Conteúdo da análise
  summary?: string;
  keyPoints?: string[];
  legalAssessment?: {
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
    urgentActions?: string[];
  };
  riskAssessment?: {
    level: 'low' | 'medium' | 'high';
    factors: string[];
    mitigation: string[];
  };
  timelineAnalysis?: {
    nextDeadlines: Array<{
      date: string;
      description: string;
      priority: 'low' | 'medium' | 'high';
    }>;
    criticalPhases: string[];
  };

  // Metadados
  tokensUsed?: number;
  processingTime?: number;
  confidence?: number;
  data?: unknown; // Raw data para acesso direto
}

type SanitizedData = string | number | boolean | SanitizedData[] | { [key: string]: SanitizedData } | null;

/**
 * Sanitizes analysis data by removing null values
 * Helper function for internal data processing
 */
function sanitizeAnalysisData(data: unknown): SanitizedData {
  if (!data) return null;
  if (data === null) return null;

  if (Array.isArray(data)) {
    return data.filter(item => item != null).map(sanitizeAnalysisData);
  }

  if (typeof data === 'object') {
    const sanitized: { [key: string]: SanitizedData } = {};
    for (const [key, value] of Object.entries(data)) {
      if (value === null || value === undefined) continue;
      sanitized[key] = sanitizeAnalysisData(value);
    }
    return Object.keys(sanitized).length > 0 ? sanitized : null;
  }

  if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') {
    return data;
  }

  return null;
}

interface ProcessAIAnalysisProps {
  processId: string;
}

export function ProcessAIAnalysis({ processId }: ProcessAIAnalysisProps) {
  const [analyses, setAnalyses] = useState<AIAnalysisVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVersion, setSelectedVersion] = useState<AIAnalysisVersion | null>(null);
  const [generating, setGenerating] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [creditsBalance, setCreditsBalance] = useState(999); // Mock: sempre 999 por enquanto

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

  const loadAnalyses = useCallback(async () => {
    try {
      setLoading(true);

      // Chamar endpoint correto: /api/process/{id}/analysis (singular)
      const response = await fetch(`/api/process/${processId}/analysis`);
      if (response.ok) {
        const data = await response.json();
        const analysisVersions = Array.isArray(data.analyses) ? data.analyses : [];

        const sanitizedAnalyses: AIAnalysisVersion[] = analysisVersions.map((a: Record<string, unknown>) => {
          // Sanitizar dados para remover nulls que quebram React
          const sanitized: AIAnalysisVersion = {
            id: typeof a.id === 'string' ? a.id : '',
            version: typeof a.version === 'number' ? a.version : 0,
            createdAt: typeof a.createdAt === 'string' ? a.createdAt : new Date().toISOString(),
            status: (a.status === 'generating' || a.status === 'completed' || a.status === 'error') ? a.status : 'completed',
            analysisType: (a.analysisType === 'essential' || a.analysisType === 'strategic' || a.analysisType === 'complete') ? a.analysisType : 'essential',
            model: (a.model === 'gemini-flash-8b' || a.model === 'gemini-flash' || a.model === 'gemini-pro') ? a.model : 'gemini-flash',
            summary: typeof a.summary === 'string' ? a.summary : undefined,
            keyPoints: Array.isArray(a.keyPoints) ? a.keyPoints.filter((k): k is string => typeof k === 'string') : undefined,
            legalAssessment: typeof a.legalAssessment === 'object' && a.legalAssessment !== null ? a.legalAssessment as AIAnalysisVersion['legalAssessment'] : undefined,
            riskAssessment: typeof a.riskAssessment === 'object' && a.riskAssessment !== null ? a.riskAssessment as AIAnalysisVersion['riskAssessment'] : undefined,
            timelineAnalysis: typeof a.timelineAnalysis === 'object' && a.timelineAnalysis !== null ? a.timelineAnalysis as AIAnalysisVersion['timelineAnalysis'] : undefined,
            tokensUsed: typeof a.tokensUsed === 'number' ? a.tokensUsed : undefined,
            processingTime: typeof a.processingTime === 'number' ? a.processingTime : undefined,
            confidence: typeof a.confidence === 'number' ? a.confidence : undefined,
            data: a.data
          };
          return sanitized;
        });

        setAnalyses(sanitizedAnalyses);

        // Selecionar a versão mais recente por padrão
        if (sanitizedAnalyses.length > 0) {
          setSelectedVersion(sanitizedAnalyses[0]);
        }
      } else {
        console.warn('Nenhuma análise encontrada via API, carregando dados vazios');
        setAnalyses([]);
      }
    } catch (_error) {
      console.error('Erro ao buscar análises:', error);
      setAnalyses([]);
    } finally {
      setLoading(false);
    }
  }, [processId]);

  useEffect(() => {
    loadAnalyses();
  }, [processId, loadAnalyses]);

  const loadCredits = async () => {
    try {
      const response = await fetch('/api/billing/credits');
      if (response.ok) {
        const data = await response.json();
        const balance = data.data?.balance?.fullCreditsBalance || 999;
        setCreditsBalance(balance);
        console.log(`${ICONS.CREDIT} Créditos carregados: ${balance}`);
      }
    } catch (_error) {
      console.error('Erro ao carregar créditos:', error);
      setCreditsBalance(999); // Fallback
    }
  };

  const handleOpenAnalysisModal = () => {
    loadCredits(); // Carregar créditos antes de abrir
    setShowUpgradeModal(true);
  };

  const generateNewAnalysis = async (level: 'FAST' | 'FULL') => {
    try {
      setGenerating(true);

      const response = await fetch(`/api/process/${processId}/analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: level,
          includeDocuments: true,
          includeTimeline: true
        })
      });

      if (response.ok) {
        const result = await response.json();

        // Adicionar nova análise à lista
        const newAnalysis: AIAnalysisVersion = {
          id: result.analysisId,
          version: analyses.length + 1,
          createdAt: new Date().toISOString(),
          status: 'generating',
          analysisType: level === 'FULL' ? 'complete' : 'strategic',
          model: level === 'FULL' ? 'gemini-pro' : 'gemini-flash',
          progress: 0
        };

        setAnalyses(prev => [newAnalysis, ...prev]);
        setSelectedVersion(newAnalysis);

        // Simular progresso
        const progressInterval = setInterval(() => {
          setSelectedVersion(current => {
            if (current?.id === newAnalysis.id) {
              const newProgress = Math.min((current.progress || 0) + 15, 100);
              return { ...current, progress: newProgress };
            }
            return current;
          });
        }, 500);

        // Simular conclusão após algum tempo (FULL demora mais)
        const processingTime = level === 'FULL' ? 12000 : 6000;
        setTimeout(() => {
          clearInterval(progressInterval);
          loadAnalyses(); // Recarregar para pegar análise completa
        }, processingTime);

      } else {
        throw new Error('Erro ao gerar análise');
      }
    } catch (_error) {
      console.error('Erro na geração:', error);
      alert('Erro ao gerar nova análise');
    } finally {
      setGenerating(false);
    }
  };


  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-1/4" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {ICONS.STAR} Análise por IA
            </CardTitle>

            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleOpenAnalysisModal}
                disabled={generating}
                variant="default"
              >
                {generating ? `${ICONS.LOADING} Gerando...` : `${ICONS.STAR} Aprofundar Análise`}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {analyses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <span className="text-4xl mb-4 block">{ICONS.STAR}</span>
              <h3 className="text-lg font-medium mb-2">Nenhuma análise encontrada</h3>
              <p className="text-sm mb-4">Gere sua primeira análise estratégica por IA</p>
              <Button onClick={handleOpenAnalysisModal} variant="default">
                {ICONS.STAR} Gerar Análise Estratégica
              </Button>
            </div>
          ) : (
            <>
              {selectedVersion && (
                <>
                  <AnalysisVersionHistory
                    analyses={analyses}
                    selectedVersion={selectedVersion}
                    onVersionSelect={setSelectedVersion}
                  />
                  <AnalysisContentDisplay
                    selectedVersion={selectedVersion}
                    onRetry={() => generateNewAnalysis('FAST')}
                  />
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <GenerateAnalysisModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        onGenerateAnalysis={generateNewAnalysis}
        creditsBalance={creditsBalance}
        userPlan={userPlan}
        userUsage={userUsage}
        isGenerating={generating}
      />
    </div>
  );
}