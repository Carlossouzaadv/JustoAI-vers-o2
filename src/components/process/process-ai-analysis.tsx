'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
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

  useEffect(() => {
    loadAnalyses();
  }, [processId]);

  const loadAnalyses = async () => {
    try {
      setLoading(true);

      const response = await fetch(`/api/processes/${processId}/ai-analysis`);
      if (response.ok) {
        const data = await response.json();
        const analysisVersions = data.analyses || [];
        setAnalyses(analysisVersions);

        // Selecionar a versão mais recente por padrão
        if (analysisVersions.length > 0) {
          setSelectedVersion(analysisVersions[0]);
        }
      } else {
        // Dados simulados para desenvolvimento
        const mockAnalyses: AIAnalysisVersion[] = [
          {
            id: '1',
            version: 3,
            createdAt: '2024-01-20T14:30:00',
            status: 'completed',
            analysisType: 'complete',
            model: 'gemini-pro',
            summary: 'Ação indenizatória por danos morais com boa fundamentação legal. Cliente possui documentação sólida e jurisprudência favorável.',
            keyPoints: [
              'Dano moral comprovado por documentos médicos',
              'Nexo causal claro entre conduta e dano',
              'Jurisprudência favorável no TJ-SP',
              'Valor da indenização dentro da média regional'
            ],
            legalAssessment: {
              strengths: [
                'Documentação médica completa',
                'Testemunhas identificadas',
                'Precedentes favoráveis'
              ],
              weaknesses: [
                'Réu possui defesas técnicas válidas',
                'Período entre fato e ação é longo'
              ],
              recommendations: [
                'Agilizar oitiva das testemunhas',
                'Solicitar perícia complementar',
                'Avaliar possibilidade de acordo'
              ],
              urgentActions: [
                'Responder contestação em 10 dias',
                'Agendar perícia médica'
              ]
            },
            riskAssessment: {
              level: 'medium',
              factors: [
                'Complexidade probatória média',
                'Réu possui bons advogados',
                'Valor elevado pode gerar resistência'
              ],
              mitigation: [
                'Fortalecer conjunto probatório',
                'Considerar acordo estratégico',
                'Preparar jurisprudência atualizada'
              ]
            },
            timelineAnalysis: {
              nextDeadlines: [
                {
                  date: '2024-02-01T15:00:00',
                  description: 'Audiência de conciliação',
                  priority: 'high'
                },
                {
                  date: '2024-01-28T18:00:00',
                  description: 'Prazo para tréplica',
                  priority: 'medium'
                }
              ],
              criticalPhases: [
                'Fase probatória',
                'Possível recurso'
              ]
            },
            tokensUsed: 3420,
            processingTime: 4500,
            confidence: 0.87
          },
          {
            id: '2',
            version: 2,
            createdAt: '2024-01-18T09:15:00',
            status: 'completed',
            analysisType: 'strategic',
            model: 'gemini-flash',
            summary: 'Análise estratégica focada em riscos e oportunidades processuais.',
            keyPoints: [
              'Estratégia defensiva do réu é previsível',
              'Oportunidade de acordo na primeira audiência',
              'Jurisprudência recente favorável'
            ],
            tokensUsed: 1850,
            processingTime: 2100,
            confidence: 0.82
          },
          {
            id: '3',
            version: 1,
            createdAt: '2024-01-15T10:00:00',
            status: 'completed',
            analysisType: 'essential',
            model: 'gemini-flash-8b',
            summary: 'Análise essencial dos pontos principais do processo.',
            keyPoints: [
              'Processo bem fundamentado',
              'Documentação adequada',
              'Prazo para resposta: 15 dias'
            ],
            tokensUsed: 950,
            processingTime: 800,
            confidence: 0.91
          }
        ];

        setAnalyses(mockAnalyses);
        setSelectedVersion(mockAnalyses[0]);
      }
    } catch (error) {
      console.error('Erro ao carregar análises:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateNewAnalysis = async (type: AIAnalysisVersion['analysisType']) => {
    try {
      setGenerating(true);

      const response = await fetch(`/api/ai/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processId,
          analysisType: type,
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
          analysisType: type,
          model: result.model || 'gemini-flash',
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

        // Simular conclusão após algum tempo
        setTimeout(() => {
          clearInterval(progressInterval);
          loadAnalyses(); // Recarregar para pegar análise completa
        }, 8000);

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
                variant="outline"
                size="sm"
                onClick={() => generateNewAnalysis('essential')}
                disabled={generating}
              >
                Essencial
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => generateNewAnalysis('strategic')}
                disabled={generating}
              >
                Estratégica
              </Button>
              <Button
                size="sm"
                onClick={() => generateNewAnalysis('complete')}
                disabled={generating}
              >
                {generating ? `${ICONS.LOADING} Gerando...` : 'Análise Completa'}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {analyses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <span className="text-4xl mb-4 block">{ICONS.STAR}</span>
              <h3 className="text-lg font-medium mb-2">Nenhuma análise encontrada</h3>
              <p className="text-sm mb-4">Gere sua primeira análise por IA</p>
              <Button onClick={() => generateNewAnalysis('essential')}>
                {ICONS.STAR} Análise Essencial
              </Button>
            </div>
          ) : (
            <>
              {/* Seletor de versões */}
              <div className="flex gap-2 mb-4 flex-wrap">
                {analyses.map((analysis) => (
                  <Button
                    key={analysis.id}
                    variant={selectedVersion?.id === analysis.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedVersion(analysis)}
                  >
                    <Badge
                      variant={getAnalysisTypeColor(analysis.analysisType)}
                      className="mr-2 text-xs"
                    >
                      {getAnalysisTypeLabel(analysis.analysisType)}
                    </Badge>
                    v{analysis.version}
                  </Button>
                ))}
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
                      <Button onClick={() => generateNewAnalysis(selectedVersion.analysisType)}>
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
    </div>
  );
}