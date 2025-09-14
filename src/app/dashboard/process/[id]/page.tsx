'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

import { ProcessSummary } from '@/components/process/process-summary';
import { ProcessTimeline } from '@/components/process/process-timeline';
import { ProcessDocuments } from '@/components/process/process-documents';
import { ProcessAIAnalysis } from '@/components/process/process-ai-analysis';
import { ProcessNotes } from '@/components/process/process-notes';

import { ICONS } from '@/lib/icons';

interface ProcessBasicInfo {
  id: string;
  number: string;
  title: string;
  clientName: string;
  court: string;
  phase: string;
  status: 'active' | 'suspended' | 'finished';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  createdAt: string;
  updatedAt: string;
}

export default function ProcessPage() {
  const params = useParams();
  const router = useRouter();
  const processId = params.id as string;

  const [processInfo, setProcessInfo] = useState<ProcessBasicInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('summary');

  useEffect(() => {
    if (processId) {
      loadProcessBasicInfo();
    }
  }, [processId]);

  const loadProcessBasicInfo = async () => {
    try {
      setLoading(true);

      const response = await fetch(`/api/processes/${processId}`);
      if (response.ok) {
        const data = await response.json();
        setProcessInfo(data.process);
      } else if (response.status === 404) {
        // Processo não encontrado
        router.push('/dashboard');
        return;
      } else {
        // Dados simulados para desenvolvimento
        setProcessInfo({
          id: processId,
          number: '0001234-56.2024.8.26.0100',
          title: 'Ação de Indenização por Danos Morais e Materiais',
          clientName: 'Maria da Silva Santos',
          court: '1ª Vara Cível Central - Foro Central João Mendes Jr.',
          phase: 'Conhecimento',
          status: 'active',
          priority: 'HIGH',
          createdAt: '2024-01-15T08:30:00',
          updatedAt: '2024-01-25T16:45:00'
        });
      }
    } catch (error) {
      console.error('Erro ao carregar processo:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'suspended': return 'secondary';
      case 'finished': return 'outline';
      default: return 'outline';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT': return 'destructive';
      case 'HIGH': return 'destructive';
      case 'MEDIUM': return 'secondary';
      case 'LOW': return 'outline';
      default: return 'outline';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-6 w-64" />
                <Skeleton className="h-4 w-48" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-16" />
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <Skeleton className="h-10 w-full max-w-md" />
              <Skeleton className="h-96 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!processInfo) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center text-muted-foreground">
            <span className="text-4xl mb-4 block">{ICONS.ERROR}</span>
            <h3 className="text-lg font-medium mb-2">Processo não encontrado</h3>
            <p className="text-sm mb-4">
              O processo solicitado não foi encontrado ou você não tem acesso a ele.
            </p>
            <Button onClick={() => router.push('/dashboard')} variant="outline">
              {ICONS.ARROW_LEFT} Voltar ao Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com informações básicas */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push('/dashboard')}
                >
                  {ICONS.ARROW_LEFT} Voltar
                </Button>
                <h1 className="text-xl font-semibold">
                  {processInfo.number}
                </h1>
              </div>

              <div className="space-y-1">
                <h2 className="font-medium text-muted-foreground">
                  {processInfo.title}
                </h2>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{ICONS.CLIENT} {processInfo.clientName}</span>
                  <span>{ICONS.PROCESS} {processInfo.court}</span>
                  <span>Fase: {processInfo.phase}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant={getStatusColor(processInfo.status)}>
                {processInfo.status === 'active' ? 'Ativo' :
                 processInfo.status === 'suspended' ? 'Suspenso' : 'Finalizado'}
              </Badge>
              <Badge variant={getPriorityColor(processInfo.priority)}>
                {processInfo.priority}
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Tabs com conteúdo do processo */}
      <Card>
        <CardContent className="p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="summary" className="flex items-center gap-2">
                {ICONS.EDIT} Resumo
              </TabsTrigger>
              <TabsTrigger value="timeline" className="flex items-center gap-2">
                {ICONS.TIME} Timeline
              </TabsTrigger>
              <TabsTrigger value="documents" className="flex items-center gap-2">
                {ICONS.DOCUMENT} Documentos
              </TabsTrigger>
              <TabsTrigger value="analysis" className="flex items-center gap-2">
                {ICONS.STAR} Análise IA
              </TabsTrigger>
              <TabsTrigger value="notes" className="flex items-center gap-2">
                {ICONS.EDIT} Anotações
              </TabsTrigger>
            </TabsList>

            <div className="mt-6">
              <TabsContent value="summary" className="mt-0">
                <ProcessSummary processId={processId} />
              </TabsContent>

              <TabsContent value="timeline" className="mt-0">
                <ProcessTimeline processId={processId} />
              </TabsContent>

              <TabsContent value="documents" className="mt-0">
                <ProcessDocuments processId={processId} />
              </TabsContent>

              <TabsContent value="analysis" className="mt-0">
                <ProcessAIAnalysis processId={processId} />
              </TabsContent>

              <TabsContent value="notes" className="mt-0">
                <ProcessNotes processId={processId} />
              </TabsContent>
            </div>
          </Tabs>
        </CardContent>
      </Card>

      {/* Informações de desenvolvimento */}
      <Card className="border-dashed border-muted-foreground/30">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            {ICONS.INFO} <strong>Modo desenvolvimento:</strong> Alguns dados podem ser simulados.
            Process ID: {processId} • Última atualização: {new Date(processInfo.updatedAt).toLocaleString('pt-BR')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}