'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { ICONS } from '@/lib/icons';

interface AIAnalysisVersion {
  id: string;
  version: number;
  createdAt: string;
  status: 'generating' | 'completed' | 'error';
  progress?: number;
  analysisType: 'essential' | 'strategic' | 'complete';
  model: 'gemini-flash-8b' | 'gemini-flash' | 'gemini-pro';
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
  tokensUsed?: number;
  processingTime?: number;
  confidence?: number;
  data?: unknown;
}

interface AnalysisContentDisplayProps {
  selectedVersion: AIAnalysisVersion;
  onRetry?: () => void;
}

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

export function AnalysisContentDisplay({
  selectedVersion,
  onRetry,
}: AnalysisContentDisplayProps) {
  const [feedback, setFeedback] = useState('');

  return (
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
          {onRetry && (
            <Button onClick={onRetry}>
              Tentar Novamente
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
