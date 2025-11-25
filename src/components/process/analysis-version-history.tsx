'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

interface AnalysisVersionHistoryProps {
  analyses: AIAnalysisVersion[];
  selectedVersion: AIAnalysisVersion | null;
  onVersionSelect: (version: AIAnalysisVersion) => void;
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

export function AnalysisVersionHistory({
  analyses,
  selectedVersion,
  onVersionSelect,
}: AnalysisVersionHistoryProps) {
  if (!selectedVersion) return null;

  return (
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
            {analyses.map((analysis) => (
              <DropdownMenuItem
                key={analysis.id}
                onClick={() => onVersionSelect(analysis)}
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
  );
}
