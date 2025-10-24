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

interface CaseData {
  id: string;
  number: string;
  detectedCnj: string;
  title: string;
  description: string;
  type: 'CIVIL' | 'CRIMINAL' | 'LABOR' | 'FAMILY' | 'TAX' | 'ADMINISTRATIVE';
  status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED' | 'ARCHIVED' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  client?: {
    id: string;
    name: string;
    email?: string;
    type?: string;
  };
  documentCount: number;
  onboardingStatus: string;
  previewSnapshot: any;
  previewGeneratedAt: string;
  createdAt: string;
  updatedAt: string;
}

export default function ProcessPage() {
  const params = useParams();
  const router = useRouter();
  const caseId = params.id as string;

  const [caseInfo, setCaseInfo] = useState<CaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('summary');

  useEffect(() => {
    if (caseId) {
      loadCaseData();
    }
  }, [caseId]);

  const loadCaseData = async (retryCount = 0, maxRetries = 3) => {
    try {
      setLoading(true);
      if (retryCount === 0) setError(null);

      console.log(`${ICONS.SEARCH} Carregando caso: ${caseId}${retryCount > 0 ? ` (tentativa ${retryCount + 1})` : ''}`);

      const response = await fetch(`/api/cases/${caseId}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        // Retry on transient errors (5xx, network errors)
        if (retryCount < maxRetries && (response.status >= 500 || response.status === 0)) {
          const delayMs = 1000 * Math.pow(2, retryCount); // Exponential backoff: 1s, 2s, 4s
          console.log(`${ICONS.WARNING} Erro ${response.status}, retentando em ${delayMs}ms...`);
          setTimeout(() => loadCaseData(retryCount + 1, maxRetries), delayMs);
          return;
        }

        // Don't retry on 404 or 401
        if (response.status === 404) {
          setError('Caso não encontrado');
        } else if (response.status === 401) {
          setError('Não autenticado. Faça login novamente');
        } else {
          setError('Erro ao carregar caso');
        }
        console.error(`${ICONS.ERROR} Erro ao carregar caso:`, response.status);
        return;
      }

      const data = await response.json();
      console.log(`${ICONS.SUCCESS} Caso carregado:`, data.case);
      setCaseInfo(data.case);

    } catch (err) {
      console.error(`${ICONS.ERROR} Erro ao carregar caso:`, err);
      setError('Erro ao carregar caso. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'ACTIVE': return 'default';
      case 'SUSPENDED': return 'secondary';
      case 'CLOSED':
      case 'ARCHIVED':
      case 'CANCELLED':
        return 'outline';
      default: return 'outline';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toUpperCase()) {
      case 'URGENT': return 'destructive';
      case 'HIGH': return 'destructive';
      case 'MEDIUM': return 'secondary';
      case 'LOW': return 'outline';
      default: return 'outline';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status.toUpperCase()) {
      case 'ACTIVE': return 'Ativo';
      case 'SUSPENDED': return 'Suspenso';
      case 'CLOSED': return 'Fechado';
      case 'ARCHIVED': return 'Arquivado';
      case 'CANCELLED': return 'Cancelado';
      default: return status;
    }
  };

  const getTypeLabel = (type: string) => {
    const typeMap: Record<string, string> = {
      'CIVIL': 'Cível',
      'CRIMINAL': 'Criminal',
      'LABOR': 'Trabalhista',
      'FAMILY': 'Família',
      'TAX': 'Fiscal',
      'ADMINISTRATIVE': 'Administrativo',
    };
    return typeMap[type] || type;
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

  if (error || !caseInfo) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center text-muted-foreground">
            <span className="text-4xl mb-4 block">{ICONS.ERROR}</span>
            <h3 className="text-lg font-medium mb-2">{error || 'Caso não encontrado'}</h3>
            <p className="text-sm mb-4">
              {error ? error : 'O caso solicitado não foi encontrado ou você não tem acesso a ele.'}
            </p>
            <Button onClick={() => router.push('/dashboard/process')} variant="outline">
              {ICONS.ARROW_LEFT} Voltar à Lista
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
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push('/dashboard/process')}
                >
                  {ICONS.ARROW_LEFT} Voltar
                </Button>
                <h1 className="text-2xl font-bold">
                  {caseInfo.detectedCnj || caseInfo.number}
                </h1>
              </div>

              <div className="space-y-2">
                <p className="font-medium text-base">{caseInfo.title}</p>
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    {ICONS.CLIENT} {caseInfo.client?.name || 'Sem cliente associado'}
                  </span>
                  <span className="flex items-center gap-1">
                    {ICONS.DOCUMENT} {getTypeLabel(caseInfo.type)}
                  </span>
                  <span className="flex items-center gap-1">
                    {ICONS.FOLDER} {caseInfo.documentCount} documento(s)
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant={getStatusColor(caseInfo.status)}>
                {getStatusLabel(caseInfo.status)}
              </Badge>
              <Badge variant={getPriorityColor(caseInfo.priority)}>
                {caseInfo.priority}
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
                <ProcessSummary processId={caseId} />
              </TabsContent>

              <TabsContent value="timeline" className="mt-0">
                <ProcessTimeline processId={caseId} />
              </TabsContent>

              <TabsContent value="documents" className="mt-0">
                <ProcessDocuments processId={caseId} />
              </TabsContent>

              <TabsContent value="analysis" className="mt-0">
                <ProcessAIAnalysis processId={caseId} />
              </TabsContent>

              <TabsContent value="notes" className="mt-0">
                <ProcessNotes processId={caseId} />
              </TabsContent>
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}