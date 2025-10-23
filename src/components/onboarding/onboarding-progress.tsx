'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Zap,
  Download,
  BarChart3,
  Loader2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { ICONS } from '@/lib/icons';

interface OnboardingProgressProps {
  caseId: string;
  juditJobId?: string;
  extractedProcessNumber?: string;
  previewData?: any;
  onPhaseComplete?: (phase: 'PREVIEW' | 'ENRICHMENT') => void;
  onAnalyzeClick?: () => void;
}

type Phase = 'PREVIEW' | 'ENRICHMENT' | 'ANALYSIS';
type PhaseStatus = 'completed' | 'in_progress' | 'pending' | 'failed';

interface PhaseData {
  name: string;
  description: string;
  status: PhaseStatus;
  progress: number;
  icon: React.ReactNode;
  details?: string;
  error?: string;
  expandable?: boolean;
}

export function OnboardingProgress({
  caseId,
  juditJobId,
  extractedProcessNumber,
  previewData,
  onPhaseComplete,
  onAnalyzeClick
}: OnboardingProgressProps) {
  const [phases, setPhases] = useState<Record<Phase, PhaseData>>({
    PREVIEW: {
      name: 'Preview Inteligente',
      description: 'Extração instantânea e análise rápida',
      status: 'completed',
      progress: 100,
      icon: <CheckCircle2 className="w-5 h-5 text-green-500" />,
      details: previewData ? `Análise com ${previewData.modelUsed || 'Gemini'}` : undefined,
      expandable: true  // Make preview expandable to show full analysis
    },
    ENRICHMENT: {
      name: 'Enriquecimento Oficial',
      description: 'Buscando dados do tribunal e anexos',
      status: juditJobId ? 'in_progress' : 'pending',
      progress: juditJobId ? 30 : 0,
      icon: <Clock className="w-5 h-5 text-blue-500" />,
      expandable: true
    },
    ANALYSIS: {
      name: 'Análise Estratégica',
      description: 'Insights detalhados com IA (sob demanda)',
      status: juditJobId ? 'pending' : 'pending',
      progress: 0,
      icon: <Zap className="w-5 h-5 text-amber-500" />,
      expandable: false
    }
  });

  // Start with PREVIEW expanded to show analysis immediately
  const [expandedPhase, setExpandedPhase] = useState<Phase | null>(previewData ? 'PREVIEW' : 'ENRICHMENT');
  const [jobStatus, setJobStatus] = useState<any>(null);
  const [pollingActive, setPollingActive] = useState(!!juditJobId);

  // Polling para atualizar status do JUDIT job
  useEffect(() => {
    if (!juditJobId || !pollingActive) return;

    let pollInterval: NodeJS.Timeout;
    let attempts = 0;
    const maxAttempts = 600; // 10 minutos com polling a cada 1s

    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/judit/onboarding/status/${juditJobId}`, {
          credentials: 'include'
        });

        if (!response.ok) {
          console.error('Erro ao buscar status:', response.status);
          return;
        }

        const data = await response.json();
        if (!data.success) {
          console.error('Status error:', data.error);
          return;
        }

        const jobData = data.data;
        setJobStatus(jobData);

        // Atualizar phases baseado no status do job
        setPhases(prev => {
          const updated = { ...prev };

          if (jobData.status === 'active' || jobData.status === 'waiting') {
            updated.ENRICHMENT.status = 'in_progress';
            updated.ENRICHMENT.progress = Math.min(jobData.progress || 30, 90);
            updated.ENRICHMENT.details = `${jobData.statusDescription || 'Processando'}...`;
          } else if (jobData.status === 'completed') {
            updated.ENRICHMENT.status = 'completed';
            updated.ENRICHMENT.progress = 100;
            updated.ENRICHMENT.details = 'Dados oficiais carregados!';
            updated.ANALYSIS.status = 'pending'; // Agora FASE 3 está disponível
            setPollingActive(false); // Parar polling
            onPhaseComplete?.('ENRICHMENT');
          } else if (jobData.status === 'failed') {
            updated.ENRICHMENT.status = 'failed';
            updated.ENRICHMENT.error = jobData.error || 'Falha ao buscar dados do tribunal';
            setPollingActive(false);
          }

          return updated;
        });

        attempts++;
        if (attempts >= maxAttempts) {
          console.warn('Max polling attempts reached');
          setPollingActive(false);
        }
      } catch (error) {
        console.error('Polling error:', error);
        attempts++;
        if (attempts >= maxAttempts) setPollingActive(false);
      }
    };

    // Primeira tentativa imediata
    pollStatus();

    // Depois a cada segundo
    pollInterval = setInterval(pollStatus, 1000);

    return () => clearInterval(pollInterval);
  }, [juditJobId, pollingActive, onPhaseComplete]);

  const getStatusColor = (status: PhaseStatus) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-gray-100 text-gray-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: PhaseStatus) => {
    switch (status) {
      case 'completed': return '✓ Concluído';
      case 'in_progress': return '⏳ Em progresso';
      case 'pending': return '⏱️ Aguardando';
      case 'failed': return '✗ Falhou';
      default: return 'Desconhecido';
    }
  };

  const togglePhaseExpand = (phase: Phase) => {
    setExpandedPhase(expandedPhase === phase ? null : phase);
  };

  return (
    <div className="space-y-4">
      {/* Cabeçalho com informações do processo */}
      {extractedProcessNumber && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Processo Identificado</p>
                <p className="text-lg font-bold text-blue-900">{extractedProcessNumber}</p>
              </div>
              <Badge variant="secondary" className="ml-2">
                Onboarding em Progresso
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fases do Onboarding */}
      <div className="space-y-3">
        {(Object.entries(phases) as [Phase, PhaseData][]).map(([phaseKey, phase]) => (
          <Card
            key={phaseKey}
            className={`transition-all ${expandedPhase === phaseKey ? 'ring-2 ring-blue-500' : ''}`}
          >
            <div
              onClick={() => phase.expandable && togglePhaseExpand(phaseKey)}
              className={`p-4 ${phase.expandable ? 'cursor-pointer hover:bg-gray-50' : ''}`}
            >
              {/* Header da Fase */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  {phase.status === 'in_progress' ? (
                    <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                  ) : (
                    phase.icon
                  )}

                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{phase.name}</h3>
                    <p className="text-sm text-gray-500">{phase.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge className={`${getStatusColor(phase.status)}`}>
                    {getStatusText(phase.status)}
                  </Badge>

                  {phase.expandable && (
                    expandedPhase === phaseKey ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              {phase.status === 'in_progress' && (
                <div className="mt-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-gray-600">Progresso</span>
                    <span className="text-xs font-medium text-gray-900">{phase.progress}%</span>
                  </div>
                  <Progress value={phase.progress} className="h-1.5" />
                </div>
              )}

              {/* Detalhes da Fase */}
              {phase.details && (
                <p className="text-sm text-gray-600 mt-2">{phase.details}</p>
              )}

              {/* Erro */}
              {phase.error && (
                <Alert className="mt-3 bg-red-50 border-red-200">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    {phase.error}
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Conteúdo Expandível */}
            {phase.expandable && expandedPhase === phaseKey && (
              <div className="px-4 pb-4 border-t pt-4 bg-gray-50">
                <ExpandedPhaseContent
                  phase={phaseKey}
                  jobStatus={jobStatus}
                  previewData={previewData}
                />
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* CTA para FASE 3 (Análise Estratégica) */}
      {phases.ENRICHMENT.status === 'completed' && (
        <Card className="bg-amber-50 border-amber-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-amber-600" />
              Pronto para Análise Estratégica?
            </CardTitle>
            <CardDescription>
              Use 1 crédito para obter insights detalhados com IA sobre este processo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={onAnalyzeClick}
              className="w-full bg-amber-600 hover:bg-amber-700"
            >
              <Zap className="w-4 h-4 mr-2" />
              Gerar Análise Estratégica Completa
            </Button>
            <p className="text-xs text-gray-600 mt-3">
              {ICONS.INFO} Esta análise consumirá 1 crédito de sua conta
            </p>
          </CardContent>
        </Card>
      )}

      {/* Status da JUDIT em tempo real */}
      {jobStatus && phases.ENRICHMENT.status === 'in_progress' && (
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-sm">Status Detalhado</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <div>
              <span className="font-medium">Job ID:</span>{' '}
              <span className="text-gray-600 font-mono text-xs">{juditJobId}</span>
            </div>
            <div>
              <span className="font-medium">Status:</span>{' '}
              <span className="text-gray-600">{jobStatus.statusDescription}</span>
            </div>
            <div>
              <span className="font-medium">Progresso:</span>{' '}
              <span className="text-gray-600">{jobStatus.progress || 0}%</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Componente para conteúdo expandido
function ExpandedPhaseContent({
  phase,
  jobStatus,
  previewData
}: {
  phase: Phase;
  jobStatus?: any;
  previewData?: any;
}) {
  if (phase === 'ENRICHMENT' && jobStatus) {
    return (
      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium text-gray-900 mb-1">O que está acontecendo</p>
          <ul className="text-sm text-gray-600 space-y-1 ml-4">
            <li>• Conectando ao tribunal (JUDIT)</li>
            <li>• Buscando dados oficiais do processo</li>
            <li>• Baixando anexos principais</li>
            <li>• Unificando timeline com PDF</li>
          </ul>
        </div>

        {jobStatus.result && (
          <div>
            <p className="text-sm font-medium text-gray-900 mb-1">Dados Carregados</p>
            <div className="text-sm text-gray-600 space-y-1">
              {jobStatus.result.timelineEntries && (
                <p>✓ {jobStatus.result.timelineEntries} andamentos carregados</p>
              )}
              {jobStatus.result.attachmentsCount && (
                <p>✓ {jobStatus.result.attachmentsCount} anexos baixados</p>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (phase === 'PREVIEW' && previewData) {
    return (
      <div className="space-y-4">
        {/* Resumo Executivo */}
        {previewData.resumo && (
          <div className="bg-white rounded p-3 border border-blue-100">
            <p className="text-sm font-semibold text-gray-900 mb-2">Resumo da Análise</p>
            <p className="text-sm text-gray-700 leading-relaxed">{previewData.resumo}</p>
          </div>
        )}

        {/* Grid com informações principais */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          {/* Partes Envolvidas */}
          {previewData.partes && (
            <div className="bg-white rounded p-2 border border-gray-200">
              <p className="text-gray-600 text-xs font-semibold mb-1">Partes</p>
              <p className="font-medium text-gray-900 line-clamp-2">{previewData.partes}</p>
            </div>
          )}

          {/* Objeto do Litígio */}
          {previewData.objeto && (
            <div className="bg-white rounded p-2 border border-gray-200">
              <p className="text-gray-600 text-xs font-semibold mb-1">Objeto</p>
              <p className="font-medium text-gray-900 line-clamp-2">{previewData.objeto}</p>
            </div>
          )}

          {/* Valores Envolvidos */}
          {previewData.valores && (
            <div className="bg-white rounded p-2 border border-gray-200">
              <p className="text-gray-600 text-xs font-semibold mb-1">Valores</p>
              <p className="font-medium text-gray-900">{previewData.valores}</p>
            </div>
          )}

          {/* Probabilidade de Sucesso */}
          {previewData.probabilidades && (
            <div className="bg-white rounded p-2 border border-gray-200">
              <p className="text-gray-600 text-xs font-semibold mb-1">Probabilidade</p>
              <p className="font-medium text-gray-900">{previewData.probabilidades}</p>
            </div>
          )}
        </div>

        {/* Próximos Passos */}
        {previewData.proximosPassos && (
          <div className="bg-amber-50 rounded p-3 border border-amber-200">
            <p className="text-sm font-semibold text-amber-900 mb-2">Próximos Passos Recomendados</p>
            <p className="text-sm text-amber-800">{previewData.proximosPassos}</p>
          </div>
        )}

        {/* Metadata da Análise */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t text-xs">
          <div>
            <p className="text-gray-600">Modelo</p>
            <p className="font-medium text-gray-900">{previewData.modelUsed}</p>
          </div>
          <div>
            <p className="text-gray-600">Confiança</p>
            <p className="font-medium text-gray-900">{(previewData.confidence * 100).toFixed(0)}%</p>
          </div>
          <div>
            <p className="text-gray-600">Custo Est.</p>
            <p className="font-medium text-gray-900">R$ {(previewData.costEstimate || 0).toFixed(2)}</p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
