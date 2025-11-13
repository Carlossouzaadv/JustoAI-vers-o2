'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Zap,
  BarChart3,
  Loader2,
  ChevronDown,
  ChevronUp,
  Bell,
  TrendingUp,
  X
} from 'lucide-react';
import { ICONS } from '@/lib/icons';

interface OnboardingProgressProps {
  caseId: string;
  juditJobId?: string;
  extractedProcessNumber?: string;
  previewData?: unknown;
  onPhaseComplete?: (_phase: 'PREVIEW' | 'ENRICHMENT') => void;
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

interface Toast {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'info' | 'error';
}

// Preview Data structures
interface PreviewData {
  modelUsed?: string;
  resumo?: string;
  partes?: string;
  objeto?: string;
  valores?: string;
  proximosPassos?: string;
  [key: string]: unknown;
}

// Job Status structures
interface JobStatusResult {
  timelineEntries?: number;
  attachmentsCount?: number;
  [key: string]: unknown;
}

interface JobStatus {
  status: string;
  statusDescription?: string;
  progress?: number;
  error?: string;
  result?: JobStatusResult;
  [key: string]: unknown;
}

// ===== TYPE GUARDS =====

function isPreviewData(data: unknown): data is PreviewData {
  if (typeof data !== 'object' || data === null) return false;
  // PreviewData is flexible - any object can be PreviewData
  return true;
}

function isJobStatus(data: unknown): data is JobStatus {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return typeof obj.status === 'string';
}

function isJobStatusResult(data: unknown): data is JobStatusResult {
  if (typeof data !== 'object' || data === null) return false;
  // JobStatusResult is flexible - any object can be JobStatusResult
  return true;
}

const CACHE_KEY = 'onboarding-progress-state';

export function OnboardingProgress({
  caseId,
  juditJobId,
  extractedProcessNumber,
  previewData,
  onPhaseComplete,
  onAnalyzeClick
}: OnboardingProgressProps) {
  // ====== STATE ======
  const [phases, setPhases] = useState<Record<Phase, PhaseData>>({
    PREVIEW: {
      name: 'Preview Inteligente',
      description: 'Extração instantânea e análise rápida',
      status: 'completed',
      progress: 100,
      icon: <CheckCircle2 className="w-5 h-5 text-green-500" />,
      details: previewData && isPreviewData(previewData) ? `Análise com ${(previewData as PreviewData).modelUsed || 'Gemini'}` : undefined,
      expandable: true
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

  const [expandedPhase, setExpandedPhase] = useState<Phase | null>(previewData ? 'PREVIEW' : 'ENRICHMENT');
  const [jobStatus, setJobStatus] = useState<unknown>(null);
  const [pollingActive, setPollingActive] = useState(!!juditJobId);
  const [toast, setToast] = useState<Toast | null>(null);
  const [enrichmentCompleted, setEnrichmentCompleted] = useState(false);

  // ====== EFFECT: Load state from localStorage ======
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const cached = localStorage.getItem(`${CACHE_KEY}-${caseId}`);
      if (cached) {
        const { expandedPhase: cachedExpanded } = JSON.parse(cached);
        if (cachedExpanded) {
          setExpandedPhase(cachedExpanded);
        }
      }
    } catch (err) {
      console.warn('Failed to load cached onboarding state:', err);
    }
  }, [caseId]);

  // ====== EFFECT: Save state to localStorage ======
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(
        `${CACHE_KEY}-${caseId}`,
        JSON.stringify({
          expandedPhase,
          timestamp: new Date().toISOString()
        })
      );
    } catch (err) {
      console.warn('Failed to save onboarding state to cache:', err);
    }
  }, [expandedPhase, caseId]);

  // ====== EFFECT: Polling para status do JUDIT ======
  useEffect(() => {
    if (!juditJobId || !pollingActive) return;

    let pollInterval: NodeJS.Timeout | null = null;
    let attempts = 0;
    const maxAttempts = 600; // 10 minutos

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
        if (isJobStatus(jobData)) {
          setJobStatus(jobData);

        // Atualizar phases baseado no status
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
            updated.ANALYSIS.status = 'pending';
            setPollingActive(false);

            // Disparar notificação
            if (!enrichmentCompleted) {
              setEnrichmentCompleted(true);
              showToast(
                'Enriquecimento Completo!',
                'Histórico oficial carregado. Clique em "Gerar Análise Estratégica" para continuar.',
                'success'
              );
              onPhaseComplete?.('ENRICHMENT');
            }
          } else if (jobData.status === 'failed') {
            updated.ENRICHMENT.status = 'failed';
            updated.ENRICHMENT.error = jobData.error || 'Falha ao buscar dados do tribunal';
            setPollingActive(false);

            showToast(
              'Erro no Enriquecimento',
              'Não foi possível buscar os dados do tribunal. Você pode continuar com os dados do PDF.',
              'error'
            );
          }

          return updated;
        });
        }

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

    return () => {
      if (pollInterval !== null) {
        clearInterval(pollInterval);
      }
    };
  }, [juditJobId, pollingActive, onPhaseComplete, enrichmentCompleted]);

  // ====== HELPERS ======
  const showToast = (title: string, message: string, type: 'success' | 'info' | 'error') => {
    const id = Date.now().toString();
    setToast({ id, title, message, type });

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setToast(null);
    }, 5000);
  };

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

  // ====== RENDER ======
  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: 20 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: -20, x: 20 }}
            className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg max-w-md z-50 ${
              toast.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-900'
                : toast.type === 'error'
                ? 'bg-red-50 border border-red-200 text-red-900'
                : 'bg-blue-50 border border-blue-200 text-blue-900'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                {toast.type === 'success' && (
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
                )}
                {toast.type === 'error' && (
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                )}
                {toast.type === 'info' && (
                  <Bell className="w-5 h-5 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-semibold">{toast.title}</p>
                  <p className="text-sm mt-1 opacity-90">{toast.message}</p>
                </div>
              </div>
              <button
                onClick={() => setToast(null)}
                className="ml-2 text-gray-500 hover:text-gray-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cabeçalho com informações do processo */}
      {extractedProcessNumber && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
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
        </motion.div>
      )}

      {/* Fases do Onboarding */}
      <div className="space-y-3">
        {(Object.entries(phases) as [Phase, PhaseData][]).map(([phaseKey, phase], index) => (
          <motion.div
            key={phaseKey}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.3 }}
          >
            <Card
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

                {/* Enhanced Progress Bar */}
                {phase.status === 'in_progress' && (
                  <motion.div
                    className="mt-3"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-gray-600 font-medium">Progresso</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-blue-600">{phase.progress}%</span>
                        <TrendingUp className="w-4 h-4 text-blue-500 animate-pulse" />
                      </div>
                    </div>
                    {/* Animated progress bar */}
                    <div className="relative h-2.5 bg-gray-200 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${phase.progress}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                      />
                      {/* Shimmer effect */}
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30"
                        animate={{ x: ['0%', '100%'] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                    </div>
                    {/* Micro-text com status */}
                    {phase.details && (
                      <p className="text-xs text-gray-500 mt-2 italic">{phase.details}</p>
                    )}
                  </motion.div>
                )}

                {/* Detalhes da Fase (sem progress) */}
                {phase.details && phase.status !== 'in_progress' && (
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

              {/* Conteúdo Expandível com Animação */}
              <AnimatePresence>
                {phase.expandable && expandedPhase === phaseKey && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="border-t"
                  >
                    <div className="px-4 py-4 bg-gray-50">
                      <ExpandedPhaseContent
                        phase={phaseKey}
                        jobStatus={jobStatus}
                        previewData={previewData}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* CTA para FASE 3 (Análise Estratégica) */}
      <AnimatePresence>
        {phases.ENRICHMENT.status === 'completed' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <motion.div animate={{ rotate: [0, 20, -20, 0] }} transition={{ duration: 2, repeat: Infinity }}>
                    <BarChart3 className="w-5 h-5 text-amber-600" />
                  </motion.div>
                  Pronto para Análise Estratégica?
                </CardTitle>
                <CardDescription>
                  Use 1 crédito para obter insights detalhados com IA sobre este processo
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={onAnalyzeClick}
                  className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-semibold"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Gerar Análise Estratégica Completa
                </Button>
                <p className="text-xs text-gray-600 mt-3">
                  {ICONS.INFO} Esta análise consumirá 1 crédito de sua conta
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status da JUDIT em tempo real */}
      <AnimatePresence>
        {phases.ENRICHMENT.status === 'in_progress' && jobStatus && isJobStatus(jobStatus) ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  Status Detalhado
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="font-medium">Job ID:</span>
                  <span className="text-gray-600 font-mono text-xs">{juditJobId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Status:</span>
                  <span className="text-gray-600">{jobStatus.statusDescription || 'Processando'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Progresso:</span>
                  <span className="text-gray-600 font-semibold">{jobStatus.progress || 0}%</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : null}
      </AnimatePresence>
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
  jobStatus?: unknown;
  previewData?: unknown;
}) {
  if (phase === 'ENRICHMENT' && jobStatus && isJobStatus(jobStatus)) {
    return (
      <motion.div
        className="space-y-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div>
          <p className="text-sm font-medium text-gray-900 mb-2">O que está acontecendo</p>
          <ul className="text-sm text-gray-600 space-y-1.5 ml-4">
            {['Conectando ao tribunal (JUDIT)', 'Buscando dados oficiais do processo', 'Baixando anexos principais', 'Unificando timeline com PDF'].map((step, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                ✓ {step}
              </motion.li>
            ))}
          </ul>
        </div>

        {jobStatus.result && isJobStatusResult(jobStatus.result) && (
          <div className="bg-blue-100 rounded-lg p-3 border border-blue-200">
            <p className="text-sm font-medium text-blue-900 mb-2">Dados Carregados</p>
            <div className="text-sm text-blue-800 space-y-1">
              {jobStatus.result.timelineEntries && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  ✓ {jobStatus.result.timelineEntries} andamentos carregados
                </motion.p>
              )}
              {jobStatus.result.attachmentsCount && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  ✓ {jobStatus.result.attachmentsCount} anexos baixados
                </motion.p>
              )}
            </div>
          </div>
        )}
      </motion.div>
    );
  }

  if (phase === 'PREVIEW') {
    // Se não há dados de preview, mostrar mensagem útil
    if (!previewData) {
      return (
        <motion.div
          className="space-y-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Alert className="bg-blue-50 border-blue-200">
            <Clock className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              Análise rápida do PDF ainda não disponível. Aguardando processamento...
            </AlertDescription>
          </Alert>
          <p className="text-sm text-gray-600">
            O preview inteligente será exibido aqui assim que estiver pronto.
          </p>
        </motion.div>
      );
    }

    // Type-narrow previewData
    if (!isPreviewData(previewData)) {
      return null;
    }

    return (
      <motion.div
        className="space-y-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {/* Resumo Executivo */}
        {previewData.resumo && (
          <motion.div
            className="bg-white rounded p-3 border border-blue-100 shadow-sm"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <p className="text-sm font-semibold text-gray-900 mb-2">Resumo da Análise</p>
            <p className="text-sm text-gray-700 leading-relaxed">{previewData.resumo}</p>
          </motion.div>
        )}

        {/* Grid com informações principais */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          {/* Partes Envolvidas */}
          {previewData.partes && (
            <motion.div
              className="bg-white rounded p-3 border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15 }}
            >
              <p className="text-gray-600 text-xs font-semibold mb-1.5 uppercase tracking-wide">Partes</p>
              <p className="font-medium text-gray-900 line-clamp-2">{previewData.partes}</p>
            </motion.div>
          )}

          {/* Objeto do Litígio */}
          {previewData.objeto && (
            <motion.div
              className="bg-white rounded p-3 border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              <p className="text-gray-600 text-xs font-semibold mb-1.5 uppercase tracking-wide">Objeto</p>
              <p className="font-medium text-gray-900 line-clamp-2">{previewData.objeto}</p>
            </motion.div>
          )}

          {/* Valores Envolvidos */}
          {previewData.valores && (
            <motion.div
              className="bg-white rounded p-3 border border-green-200 shadow-sm hover:shadow-md transition-shadow bg-green-50"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.25 }}
            >
              <p className="text-green-700 text-xs font-semibold mb-1.5 uppercase tracking-wide">Valores</p>
              <p className="font-bold text-green-900">{previewData.valores}</p>
            </motion.div>
          )}

        </div>

        {/* Último Andamento (conforme documento) */}
        {previewData.proximosPassos && (
          <motion.div
            className="bg-amber-50 rounded p-3 border border-amber-200 shadow-sm"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <p className="text-sm font-semibold text-amber-900 mb-2">Último Andamento (conforme documento)</p>
            <p className="text-sm text-amber-800 leading-relaxed">{previewData.proximosPassos}</p>
          </motion.div>
        )}

      </motion.div>
    );
  }

  return null;
}
