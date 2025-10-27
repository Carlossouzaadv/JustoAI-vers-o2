'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UsageAlert } from '@/components/ui/usage-alert';
import {
  SubscriptionPlan,
  UsageStats,
  canPerformAction,
  formatLimitMessage,
  getAnalysisRemaining,
  getPlanLimits
} from '@/lib/subscription-limits';
import { ICONS } from '@/lib/icons';

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
  data?: any; // Raw data para acesso direto
}

/**
 * Sanitiza dados de análise removendo valores null
 */
function sanitizeAnalysisData(data: any): any {
  if (!data) return null;
  if (data === null) return null;

  if (Array.isArray(data)) {
    return data.filter(item => item != null).map(sanitizeAnalysisData);
  }

  if (typeof data === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      // Skip null/undefined values
      if (value === null || value === undefined) continue;
      sanitized[key] = sanitizeAnalysisData(value);
    }
    return Object.keys(sanitized).length > 0 ? sanitized : null;
  }

  return data;
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

  useEffect(() => {
    loadAnalyses();
  }, [processId]);

  const loadCredits = async () => {
    try {
      const response = await fetch('/api/billing/credits');
      if (response.ok) {
        const data = await response.json();
        const balance = data.data?.balance?.fullCreditsBalance || 999;
        setCreditsBalance(balance);
        console.log(`${ICONS.CREDIT} Créditos carregados: ${balance}`);
      }
    } catch (error) {
      console.error('Erro ao carregar créditos:', error);
      setCreditsBalance(999); // Fallback
    }
  };

  const handleOpenAnalysisModal = () => {
    loadCredits(); // Carregar créditos antes de abrir
    setShowUpgradeModal(true);
  };

  const loadAnalyses = async () => {
    try {
      setLoading(true);

      // Chamar endpoint correto: /api/process/{id}/analysis (singular)
      const response = await fetch(`/api/process/${processId}/analysis`);
      if (response.ok) {
        const data = await response.json();
        const analysisVersions = data.analyses || [];
        const sanitizedAnalyses = analysisVersions.map((a: any) => {
          // Sanitizar dados para remover nulls que quebram React
          const sanitized = {
            id: a.id,
            version: a.version,
            createdAt: a.createdAt,
            status: a.status || 'completed',
            analysisType: a.analysisType || 'essential',
            model: a.model || 'gemini-flash',
            summary: a.summary || undefined,
            keyPoints: sanitizeAnalysisData(a.keyPoints) || undefined,
            legalAssessment: sanitizeAnalysisData(a.legalAssessment) || undefined,
            riskAssessment: sanitizeAnalysisData(a.riskAssessment) || undefined,
            timelineAnalysis: sanitizeAnalysisData(a.timelineAnalysis) || undefined,
            tokensUsed: (a.data as any)?.tokensUsed,
            processingTime: a.processingTime,
            confidence: a.confidence,
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
    } catch (error) {
      console.error('Erro ao buscar análises:', error);
      setAnalyses([]);
    } finally {
      setLoading(false);
    }
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
    } catch (error) {
      console.error('Erro na geração:', error);
      alert('Erro ao gerar nova análise');
    } finally {
      setGenerating(false);
    }
  };

  const getAnalysisTypeLabel = (type: AIAnalysisVersion['analysisType']) => {
    switch (type) {
      case 'essential': return 'Essencial';
      case 'strategic': return 'Estratégica';
      case 'complete': return 'Completa';
      default: return 'Desconhecida';
    }
  };

  const getAnalysisTypeColor = (type: AIAnalysisVersion['analysisType']) => {
    switch (type) {
      case 'essential': return 'secondary';
      case 'strategic': return 'default';
      case 'complete': return 'destructive';
      default: return 'outline';
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-green-600';
      case 'medium': return 'text-yellow-600';
      case 'high': return 'text-red-600';
      default: return 'text-gray-600';
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
      {/* Controles e versões */}
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
              {/* Análise atual + histórico com dropdown */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Badge
                    variant={getAnalysisTypeColor(selectedVersion.analysisType)}
                    className="text-sm"
                  >
                    {getAnalysisTypeLabel(selectedVersion.analysisType)}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Versão {selectedVersion.version} • {new Date(selectedVersion.createdAt).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                {analyses.length > 1 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-xs">
                        {ICONS.TIME} Ver Histórico ({analyses.length - 1} anterior{analyses.length > 2 ? 'es' : ''})
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-80">
                      <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground">
                        Histórico de Análises
                      </div>
                      {analyses.map((analysis, index) => (
                        <DropdownMenuItem
                          key={analysis.id}
                          onClick={() => setSelectedVersion(analysis)}
                          className={`cursor-pointer ${
                            selectedVersion.id === analysis.id ? 'bg-blue-50' : ''
                          }`}
                        >
                          <div className="w-full">
                            <div className="flex items-center gap-2 justify-between">
                              <div className="flex items-center gap-2">
                                <Badge variant={getAnalysisTypeColor(analysis.analysisType)} className="text-xs">
                                  {getAnalysisTypeLabel(analysis.analysisType)}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  v{analysis.version}
                                </span>
                              </div>
                              {selectedVersion.id === analysis.id && (
                                <span className="text-xs text-blue-600">{ICONS.SUCCESS}</span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(analysis.createdAt).toLocaleString('pt-BR')}
                            </p>
                            {analysis.status === 'generating' && (
                              <p className="text-xs text-yellow-600 mt-0.5">Gerando...</p>
                            )}
                            {analysis.status === 'error' && (
                              <p className="text-xs text-red-600 mt-0.5">Erro na geração</p>
                            )}
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              {/* Conteúdo da análise selecionada */}
              {selectedVersion && (
                <div className="space-y-6">
                  {/* Status e metadados */}
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-4">
                      <Badge variant={getAnalysisTypeColor(selectedVersion.analysisType)}>
                        {getAnalysisTypeLabel(selectedVersion.analysisType)}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {new Date(selectedVersion.createdAt).toLocaleString('pt-BR')}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {selectedVersion.model}
                      </Badge>
                    </div>

                    {selectedVersion.confidence && (
                      <span className="text-sm text-muted-foreground">
                        Confiança: {Math.round(selectedVersion.confidence * 100)}%
                      </span>
                    )}
                  </div>

                  {selectedVersion.status === 'generating' && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">Gerando análise...</span>
                        <span className="text-sm text-muted-foreground">
                          {selectedVersion.progress || 0}%
                        </span>
                      </div>
                      <Progress value={selectedVersion.progress || 0} className="w-full" />
                    </div>
                  )}

                  {selectedVersion.status === 'completed' && (
                    <>
                      {/* Resumo */}
                      {selectedVersion.summary && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">Resumo Geral</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm">{selectedVersion.summary}</p>
                          </CardContent>
                        </Card>
                      )}

                      {/* Pontos principais */}
                      {selectedVersion.keyPoints && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">Pontos Principais</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <ul className="space-y-2">
                              {selectedVersion.keyPoints.map((point, index) => (
                                <li key={index} className="flex items-start gap-2 text-sm">
                                  <span className="text-blue-600">{ICONS.CIRCLE_FILLED}</span>
                                  {point}
                                </li>
                              ))}
                            </ul>
                          </CardContent>
                        </Card>
                      )}

                      {/* Avaliação jurídica */}
                      {selectedVersion.legalAssessment && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-base text-green-600">
                                {ICONS.SUCCESS} Pontos Fortes
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <ul className="space-y-1">
                                {selectedVersion.legalAssessment.strengths.map((strength, index) => (
                                  <li key={index} className="text-sm">• {strength}</li>
                                ))}
                              </ul>
                            </CardContent>
                          </Card>

                          <Card>
                            <CardHeader>
                              <CardTitle className="text-base text-red-600">
                                {ICONS.WARNING} Pontos Fracos
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <ul className="space-y-1">
                                {selectedVersion.legalAssessment.weaknesses.map((weakness, index) => (
                                  <li key={index} className="text-sm">• {weakness}</li>
                                ))}
                              </ul>
                            </CardContent>
                          </Card>
                        </div>
                      )}

                      {/* Recomendações */}
                      {selectedVersion.legalAssessment?.recommendations && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">
                              {ICONS.INFO} Recomendações
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <ul className="space-y-2">
                              {selectedVersion.legalAssessment.recommendations.map((rec, index) => (
                                <li key={index} className="flex items-start gap-2 text-sm">
                                  <span className="text-blue-600">{ICONS.ARROW_RIGHT}</span>
                                  {rec}
                                </li>
                              ))}
                            </ul>
                          </CardContent>
                        </Card>
                      )}

                      {/* Ações urgentes */}
                      {selectedVersion.legalAssessment?.urgentActions &&
                       selectedVersion.legalAssessment.urgentActions.length > 0 && (
                        <Card className="border-red-200 bg-red-50">
                          <CardHeader>
                            <CardTitle className="text-base text-red-600">
                              {ICONS.ERROR} Ações Urgentes
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <ul className="space-y-2">
                              {selectedVersion.legalAssessment.urgentActions.map((action, index) => (
                                <li key={index} className="flex items-start gap-2 text-sm">
                                  <span className="text-red-600">{ICONS.WARNING}</span>
                                  {action}
                                </li>
                              ))}
                            </ul>
                          </CardContent>
                        </Card>
                      )}

                      {/* Análise de risco */}
                      {selectedVersion.riskAssessment && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">
                              Análise de Risco -
                              <span className={getRiskColor(selectedVersion.riskAssessment.level)}>
                                {selectedVersion.riskAssessment.level === 'low' ? ' Baixo' :
                                 selectedVersion.riskAssessment.level === 'medium' ? ' Médio' : ' Alto'}
                              </span>
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-4">
                              <div>
                                <h4 className="font-medium text-sm mb-2">Fatores de Risco:</h4>
                                <ul className="space-y-1">
                                  {selectedVersion.riskAssessment.factors.map((factor, index) => (
                                    <li key={index} className="text-sm">• {factor}</li>
                                  ))}
                                </ul>
                              </div>

                              <div>
                                <h4 className="font-medium text-sm mb-2">Mitigação:</h4>
                                <ul className="space-y-1">
                                  {selectedVersion.riskAssessment.mitigation.map((item, index) => (
                                    <li key={index} className="text-sm">• {item}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Próximos prazos */}
                      {selectedVersion.timelineAnalysis?.nextDeadlines && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">
                              {ICONS.CALENDAR} Próximos Prazos
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              {selectedVersion.timelineAnalysis.nextDeadlines.map((deadline, index) => (
                                <div key={index} className="flex items-center justify-between p-2 border rounded">
                                  <div>
                                    <p className="text-sm font-medium">{deadline.description}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {new Date(deadline.date).toLocaleString('pt-BR')}
                                    </p>
                                  </div>
                                  <Badge
                                    variant={deadline.priority === 'high' ? 'destructive' :
                                            deadline.priority === 'medium' ? 'secondary' : 'outline'}
                                  >
                                    {deadline.priority === 'high' ? 'Alta' :
                                     deadline.priority === 'medium' ? 'Média' : 'Baixa'}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Feedback */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Feedback sobre a Análise</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <Textarea
                              placeholder="Sua avaliação sobre esta análise (opcional)..."
                              value={feedback}
                              onChange={(e) => setFeedback(e.target.value)}
                              rows={3}
                            />
                            <Button variant="outline" size="sm">
                              Enviar Feedback
                            </Button>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Metadados técnicos */}
                      {(selectedVersion.tokensUsed || selectedVersion.processingTime) && (
                        <div className="text-xs text-muted-foreground p-3 bg-muted rounded">
                          <p>
                            {selectedVersion.tokensUsed && `Tokens: ${selectedVersion.tokensUsed.toLocaleString()}`}
                            {selectedVersion.processingTime && ` • Tempo: ${(selectedVersion.processingTime / 1000).toFixed(1)}s`}
                            {selectedVersion.confidence && ` • Confiança: ${Math.round(selectedVersion.confidence * 100)}%`}
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  {selectedVersion.status === 'error' && (
                    <div className="text-center py-8 text-muted-foreground">
                      <span className="text-4xl mb-4 block">{ICONS.ERROR}</span>
                      <h3 className="text-lg font-medium mb-2">Erro na Análise</h3>
                      <p className="text-sm mb-4">Não foi possível gerar a análise</p>
                      <Button onClick={() => generateNewAnalysis('strategic')}>
                        Tentar Novamente
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      {/* Modal de Aprofundar Análise - FAST vs FULL */}
      <Dialog open={showUpgradeModal} onOpenChange={setShowUpgradeModal}>
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
                onClick={() => {
                  generateNewAnalysis('FAST');
                  setShowUpgradeModal(false);
                }}
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
                disabled={creditsBalance <= 0}
                onClick={() => {
                  if (creditsBalance > 0) {
                    generateNewAnalysis('FULL');
                    setShowUpgradeModal(false);
                  }
                }}
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
    </div>
  );
}