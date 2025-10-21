'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { OnboardingProgress } from '@/components/onboarding/onboarding-progress';
import { PreviewResults, PreviewResultsCompact } from '@/components/onboarding/preview-results';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { ICONS } from '@/lib/icons';

interface ProcessOnboardingStatusProps {
  caseId: string;
  processNumber?: string;
  juditJobId?: string;
  previewData?: any;
  onAnalyzeClick?: () => void;
}

export function ProcessOnboardingStatus({
  caseId,
  processNumber,
  juditJobId,
  previewData,
  onAnalyzeClick
}: ProcessOnboardingStatusProps) {
  const [expandedSections, setExpandedSections] = useState<string[]>([
    'progress',
    'preview'
  ]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev =>
      prev.includes(section)
        ? prev.filter(s => s !== section)
        : [...prev, section]
      );
  };

  const isExpanded = (section: string) => expandedSections.includes(section);

  return (
    <div className="space-y-6">
      {/* FASE de Progresso - Sempre Visível */}
      <div>
        <div
          onClick={() => toggleSection('progress')}
          className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <span className="text-lg">{ICONS.PROCESS}</span>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Progresso do Onboarding</h3>
              <p className="text-sm text-gray-600">Acompanhe as 3 fases do processamento</p>
            </div>
          </div>
          {isExpanded('progress') ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>

        {isExpanded('progress') && (
          <div className="mt-4 pl-4">
            <OnboardingProgress
              caseId={caseId}
              juditJobId={juditJobId}
              extractedProcessNumber={processNumber}
              previewData={previewData}
              onAnalyzeClick={onAnalyzeClick}
            />
          </div>
        )}
      </div>

      {/* Preview Results - Expansível */}
      {previewData && (
        <div>
          <div
            onClick={() => toggleSection('preview')}
            className="flex items-center justify-between p-4 bg-blue-50 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors border border-blue-200"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-200 rounded-lg flex items-center justify-center">
                <span className="text-lg">{ICONS.DOCUMENT}</span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Dados Extraídos (FASE 1)</h3>
                <p className="text-sm text-gray-600">Informações da análise de preview</p>
              </div>
              <Badge variant="secondary" className="ml-2">
                {((previewData.confidence || 0) * 100).toFixed(0)}% confiança
              </Badge>
            </div>
            {isExpanded('preview') ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </div>

          {isExpanded('preview') && (
            <div className="mt-4 pl-4">
              <PreviewResults data={previewData} />
            </div>
          )}
        </div>
      )}

      {/* Status Timeline - Informação Rápida */}
      {juditJobId && (
        <div>
          <div
            onClick={() => toggleSection('timeline')}
            className="flex items-center justify-between p-4 bg-amber-50 rounded-lg cursor-pointer hover:bg-amber-100 transition-colors border border-amber-200"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-200 rounded-lg flex items-center justify-center">
                <span className="text-lg">{ICONS.PROCESS}</span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Enriquecimento em Progresso</h3>
                <p className="text-sm text-gray-600">JUDIT buscando dados oficiais do tribunal</p>
              </div>
              <Badge className="ml-2 bg-amber-600">Em Progresso</Badge>
            </div>
            {isExpanded('timeline') ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </div>

          {isExpanded('timeline') && (
            <div className="mt-4 pl-4">
              <Card className="bg-gray-50">
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">FASE 1 Completa:</span> Preview e dados básicos
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">FASE 2 Em Progresso:</span> Buscando dados do tribunal
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">FASE 3 Aguardando:</span> Análise estratégica sob demanda
                      </p>
                    </div>

                    <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
                      <p className="text-xs text-gray-600">
                        <span className="font-medium">Job ID:</span>{' '}
                        <span className="font-mono text-blue-700">{juditJobId}</span>
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Info Card - Como Funcionam as 3 Fases */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-0">
        <CardHeader>
          <CardTitle className="text-base">Como Funciona o Onboarding?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs defaultValue="fase1" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-white border">
              <TabsTrigger value="fase1">FASE 1</TabsTrigger>
              <TabsTrigger value="fase2">FASE 2</TabsTrigger>
              <TabsTrigger value="fase3">FASE 3</TabsTrigger>
            </TabsList>

            <TabsContent value="fase1" className="mt-4 space-y-2">
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚡</span>
                <div>
                  <p className="font-semibold text-gray-900">Preview Inteligente</p>
                  <p className="text-sm text-gray-700 mt-1">
                    Extração automática de texto do PDF, detecção do número do CNJ e análise rápida com IA.
                    Você recebe os dados básicos instantaneamente, sem custo.
                  </p>
                  <p className="text-xs text-green-700 mt-2 font-medium">✓ Completo e Gratuito</p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="fase2" className="mt-4 space-y-2">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🔗</span>
                <div>
                  <p className="font-semibold text-gray-900">Enriquecimento Oficial</p>
                  <p className="text-sm text-gray-700 mt-1">
                    Integração automática com JUDIT para buscar os dados oficiais do tribunal,
                    download de anexos e unificação da timeline. Roda em background enquanto você trabalha.
                  </p>
                  <p className="text-xs text-blue-700 mt-2 font-medium">✓ Automático e Gratuito</p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="fase3" className="mt-4 space-y-2">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🧠</span>
                <div>
                  <p className="font-semibold text-gray-900">Análise Estratégica</p>
                  <p className="text-sm text-gray-700 mt-1">
                    Insights profundos com IA avançada (Gemini Pro). Análise de riscos, recomendações
                    estratégicas e relatório completo. Disponível após FASE 2, sob demanda.
                  </p>
                  <p className="text-xs text-amber-700 mt-2 font-medium">💰 Sob Demanda (1 Crédito)</p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Versão compacta para sidebars ou cards menores
 */
export function ProcessOnboardingStatusCompact({
  processNumber,
  juditJobId,
  previewData
}: Omit<ProcessOnboardingStatusProps, 'caseId' | 'onAnalyzeClick'>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Status do Onboarding</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* FASE 1 */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-600">FASE 1 - Preview</span>
          <Badge className="bg-green-100 text-green-800 text-xs">✓ Completo</Badge>
        </div>

        {/* FASE 2 */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-600">FASE 2 - Enriquecimento</span>
          {juditJobId ? (
            <Badge className="bg-blue-100 text-blue-800 text-xs">⏳ Em Progresso</Badge>
          ) : (
            <Badge variant="secondary" className="text-xs">Aguardando</Badge>
          )}
        </div>

        {/* FASE 3 */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-600">FASE 3 - Análise</span>
          {juditJobId ? (
            <Badge variant="secondary" className="text-xs">📋 Disponível</Badge>
          ) : (
            <Badge className="bg-gray-100 text-gray-800 text-xs">Bloqueado</Badge>
          )}
        </div>

        {/* Preview Data Compact */}
        {previewData && (
          <div className="mt-4 pt-4 border-t">
            <PreviewResultsCompact data={previewData} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
