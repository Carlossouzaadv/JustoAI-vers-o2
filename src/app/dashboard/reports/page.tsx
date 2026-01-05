'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar, Download, Plus, Clock, FileText, Users, AlertCircle, Settings } from 'lucide-react';
import { ICONS } from '@/lib/icons';

interface ReportSchedule {
  id: string;
  name: string;
  type: 'CASE_SUMMARY' | 'WEEKLY_UPDATE' | 'MONTHLY_SUMMARY' | 'CUSTOM';
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  enabled: boolean;
  lastRun?: string;
  nextRun: string;
  recipients: string[];
  createdAt: string;
}

/**
 * Type guards: Valida valores desconhecidos como tipos literais específicos
 * Padrão-Ouro: Safe narrowing para dados de Select/Input components
 */
function isValidReportType(value: unknown): value is ReportSchedule['type'] {
  return typeof value === 'string' && ['CASE_SUMMARY', 'WEEKLY_UPDATE', 'MONTHLY_SUMMARY', 'CUSTOM'].includes(value);
}

function isValidReportFrequency(value: unknown): value is ReportSchedule['frequency'] {
  return typeof value === 'string' && ['DAILY', 'WEEKLY', 'MONTHLY'].includes(value);
}

interface ReportExecution {
  id: string;
  scheduleId?: string;
  reportType: 'CASE_SUMMARY' | 'WEEKLY_UPDATE' | 'MONTHLY_SUMMARY' | 'CUSTOM';
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  startedAt: string;
  completedAt?: string;
  filePath?: string;
  fileSize?: number;
  tokensUsed?: number;
  estimatedCost?: number;
}

export default function ReportsPage() {
  const { workspaceId, loading: authLoading } = useAuth();
  const [selectedTab, setSelectedTab] = useState('generate');
  const [reportSchedules, setReportSchedules] = useState<ReportSchedule[]>([]);
  const [reportExecutions, setReportExecutions] = useState<ReportExecution[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Função para buscar dados reais dos relatórios
  const fetchReports = useCallback(async () => {
    if (!workspaceId) return;

    try {
      setIsLoading(true);
      setError(null);

      // Buscar agendamentos e histórico em paralelo
      const [schedulesRes, historyRes] = await Promise.all([
        fetch(`/api/reports/schedule?workspaceId=${workspaceId}`, {
          credentials: 'include',
        }),
        fetch(`/api/reports/history?workspaceId=${workspaceId}&limit=50`, {
          credentials: 'include',
        }),
      ]);

      if (!schedulesRes.ok) {
        throw new Error('Erro ao carregar agendamentos');
      }

      if (!historyRes.ok) {
        throw new Error('Erro ao carregar histórico');
      }

      const schedulesData = await schedulesRes.json();
      const historyData = await historyRes.json();

      // Mapear dados da API para o formato do frontend
      if (schedulesData.success && schedulesData.data?.schedules) {
        const mappedSchedules = schedulesData.data.schedules.map((s: Record<string, unknown>) => ({
          id: s.id as string,
          name: s.name as string,
          type: mapApiTypeToFrontend(s.type as string),
          frequency: mapApiFrequencyToFrontend(s.frequency as string),
          enabled: s.enabled as boolean,
          lastRun: s.lastRun ? String(s.lastRun) : undefined,
          nextRun: String(s.nextRun),
          recipients: (s.recipients as string[]) || [],
          createdAt: String(s.createdAt),
        }));
        setReportSchedules(mappedSchedules);
      }

      if (historyData.success && historyData.data?.executions) {
        const mappedExecutions = historyData.data.executions.map((e: Record<string, unknown>) => ({
          id: e.id as string,
          scheduleId: e.scheduleId as string | undefined,
          reportType: mapApiTypeToFrontend(e.reportType as string),
          status: mapApiStatusToFrontend(e.status as string),
          startedAt: String(e.startedAt),
          completedAt: e.completedAt ? String(e.completedAt) : undefined,
          filePath: undefined,
          fileSize: undefined,
          tokensUsed: e.tokensUsed as number | undefined,
          estimatedCost: e.quotaConsumed as number | undefined,
        }));
        setReportExecutions(mappedExecutions);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      console.error('Erro ao carregar relatórios:', err);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  // Mapear tipos da API para tipos do frontend
  function mapApiTypeToFrontend(type: string): ReportSchedule['type'] {
    const mapping: Record<string, ReportSchedule['type']> = {
      'COMPLETO': 'CASE_SUMMARY',
      'NOVIDADES': 'WEEKLY_UPDATE',
      'complete': 'CASE_SUMMARY',
      'updates': 'WEEKLY_UPDATE',
      'executive': 'MONTHLY_SUMMARY',
      'financial': 'CUSTOM',
    };
    return mapping[type] || 'CUSTOM';
  }

  function mapApiFrequencyToFrontend(freq: string): ReportSchedule['frequency'] {
    const mapping: Record<string, ReportSchedule['frequency']> = {
      'WEEKLY': 'WEEKLY',
      'BIWEEKLY': 'WEEKLY',
      'MONTHLY': 'MONTHLY',
      'DAILY': 'DAILY',
    };
    return mapping[freq] || 'WEEKLY';
  }

  function mapApiStatusToFrontend(status: string): ReportExecution['status'] {
    const mapping: Record<string, ReportExecution['status']> = {
      'COMPLETED': 'COMPLETED',
      'FAILED': 'FAILED',
      'RUNNING': 'RUNNING',
      'AGENDADO': 'RUNNING',
      'CANCELLED': 'FAILED',
    };
    return mapping[status] || 'RUNNING';
  }

  // Carregar dados quando workspaceId estiver disponível
  useEffect(() => {
    if (!authLoading && workspaceId) {
      fetchReports();
    }
  }, [authLoading, workspaceId, fetchReports]);

  const generateInstantReport = async (type: string) => {
    if (!workspaceId) {
      setError('Workspace não identificado');
      return;
    }

    try {
      setIsGenerating(true);
      setError(null);

      // Mapear tipo do frontend para API
      const apiType = type === 'CASE_SUMMARY' ? 'complete'
        : type === 'WEEKLY_UPDATE' ? 'updates'
          : type === 'MONTHLY_SUMMARY' ? 'executive'
            : 'complete';

      const response = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          report_type: apiType,
          filters: {
            workspace_id: workspaceId,
          },
          options: {
            include_charts: true,
            include_ai_insights: true,
            include_financial_data: false,
            days_for_updates: 7,
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error((errorData as { error?: string }).error || 'Erro ao gerar relatório');
      }

      const result = await response.json();

      // Adicionar nova execução à lista
      if (result.success) {
        const newExecution: ReportExecution = {
          id: result.data?.id || Date.now().toString(),
          reportType: mapApiTypeToFrontend(apiType),
          status: 'RUNNING',
          startedAt: new Date().toISOString(),
        };
        setReportExecutions(prev => [newExecution, ...prev]);

        // Atualizar lista após alguns segundos
        setTimeout(() => fetchReports(), 5000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      console.error('Erro ao gerar relatório:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      RUNNING: 'bg-blue-100 text-blue-800 border-blue-200',
      COMPLETED: 'bg-green-100 text-green-800 border-green-200',
      FAILED: 'bg-red-100 text-red-800 border-red-200'
    };

    const labels = {
      RUNNING: 'Executando',
      COMPLETED: 'Concluído',
      FAILED: 'Falhou'
    };

    return (
      <Badge className={variants[status as keyof typeof variants]}>
        {labels[status as keyof typeof labels]}
      </Badge>
    );
  };

  const getTypeBadge = (type: string) => {
    const variants = {
      CASE_SUMMARY: 'bg-blue-100 text-blue-800 border-blue-200',
      WEEKLY_UPDATE: 'bg-green-100 text-green-800 border-green-200',
      MONTHLY_SUMMARY: 'bg-purple-100 text-purple-800 border-purple-200',
      CUSTOM: 'bg-orange-100 text-orange-800 border-orange-200'
    };

    const labels = {
      CASE_SUMMARY: 'Resumo de Caso',
      WEEKLY_UPDATE: 'Atualização Semanal',
      MONTHLY_SUMMARY: 'Resumo Mensal',
      CUSTOM: 'Personalizado'
    };

    return (
      <Badge className={variants[type as keyof typeof variants]}>
        {labels[type as keyof typeof labels]}
      </Badge>
    );
  };

  const formatFileSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Relatórios</h1>
          <p className="text-neutral-600">Gere e gerencie relatórios automáticos dos seus casos</p>
        </div>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Novo Agendamento
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Agendar Relatório Automático</DialogTitle>
              <DialogDescription>
                Configure um relatório para ser gerado automaticamente
              </DialogDescription>
            </DialogHeader>
            <CreateScheduleForm
              onClose={() => setShowCreateDialog(false)}
              workspaceId={workspaceId}
              onSuccess={fetchReports}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Loading State */}
      {isLoading && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center gap-3">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-neutral-600">Carregando relatórios...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <div>
                <p className="text-red-800 font-medium">Erro</p>
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-600">Agendamentos Ativos</p>
                <p className="text-2xl font-bold text-neutral-900">
                  {reportSchedules.filter(s => s.enabled).length}
                </p>
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-600">Relatórios este Mês</p>
                <p className="text-2xl font-bold text-neutral-900">
                  {reportExecutions.filter(e => e.status === 'COMPLETED').length}
                </p>
              </div>
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-600">Em Execução</p>
                <p className="text-2xl font-bold text-orange-600">
                  {reportExecutions.filter(e => e.status === 'RUNNING').length}
                </p>
              </div>
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-600">Custo Estimado</p>
                <p className="text-2xl font-bold text-purple-600">
                  R$ {reportExecutions
                    .filter(e => e.estimatedCost)
                    .reduce((sum, e) => sum + (e.estimatedCost || 0), 0)
                    .toFixed(2)}
                </p>
              </div>
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <span className="text-purple-600 text-lg">{ICONS.MONEY}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="generate">Gerar Relatório</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
          <TabsTrigger value="scheduled">Agendamentos</TabsTrigger>
        </TabsList>

        {/* Generate Report Tab */}
        <TabsContent value="generate" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Gerar Relatório Instantâneo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => !isGenerating && generateInstantReport('CASE_SUMMARY')}>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <FileText className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-medium">Resumo de Caso</h3>
                      <p className="text-sm text-neutral-600">Status atual de casos específicos</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => !isGenerating && generateInstantReport('WEEKLY_UPDATE')}>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                      <Calendar className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-medium">Atualização Semanal</h3>
                      <p className="text-sm text-neutral-600">Progresso dos últimos 7 dias</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => !isGenerating && generateInstantReport('MONTHLY_SUMMARY')}>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Users className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-medium">Resumo Mensal</h3>
                      <p className="text-sm text-neutral-600">Consolidado do mês completo</p>
                    </div>
                  </div>
                </Card>
              </div>

              {isGenerating && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-blue-800">Gerando relatório... Isso pode levar alguns minutos.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Execuções</CardTitle>
            </CardHeader>
            <CardContent>
              {reportExecutions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="w-12 h-12 text-neutral-300 mb-4" />
                  <p className="text-neutral-600 font-medium">Nenhum relatório executado ainda</p>
                  <p className="text-neutral-500 text-sm">Os relatórios gerados aparecerão aqui</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Iniciado em</TableHead>
                      <TableHead>Duração</TableHead>
                      <TableHead>Tamanho</TableHead>
                      <TableHead>Custo</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportExecutions.map((execution) => (
                      <TableRow key={execution.id}>
                        <TableCell>
                          {getTypeBadge(execution.reportType)}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(execution.status)}
                        </TableCell>
                        <TableCell>
                          {new Date(execution.startedAt).toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell>
                          {execution.completedAt ? (
                            `${Math.round((new Date(execution.completedAt).getTime() - new Date(execution.startedAt).getTime()) / 1000)}s`
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          {execution.fileSize ? formatFileSize(execution.fileSize) : '-'}
                        </TableCell>
                        <TableCell>
                          {execution.estimatedCost ? `R$ ${execution.estimatedCost.toFixed(2)}` : '-'}
                        </TableCell>
                        <TableCell>
                          {execution.status === 'COMPLETED' && (
                            <Button variant="ghost" size="sm">
                              <Download className="w-4 h-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scheduled Reports Tab */}
        <TabsContent value="scheduled" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Relatórios Agendados</CardTitle>
            </CardHeader>
            <CardContent>
              {reportSchedules.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Clock className="w-12 h-12 text-neutral-300 mb-4" />
                  <p className="text-neutral-600 font-medium">Nenhum relatório agendado</p>
                  <p className="text-neutral-500 text-sm">Crie um novo agendamento para começar</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Frequência</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Próxima Execução</TableHead>
                      <TableHead>Destinatários</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportSchedules.map((schedule) => (
                      <TableRow key={schedule.id}>
                        <TableCell className="font-medium">{schedule.name}</TableCell>
                        <TableCell>
                          {getTypeBadge(schedule.type)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {schedule.frequency === 'DAILY' ? 'Diário' :
                              schedule.frequency === 'WEEKLY' ? 'Semanal' : 'Mensal'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={schedule.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                            {schedule.enabled ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(schedule.nextRun).toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-neutral-600">
                            {schedule.recipients.length} destinatário(s)
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm">
                            <Settings className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Component for creating new report schedules
function CreateScheduleForm({ onClose, workspaceId, onSuccess }: {
  onClose: () => void;
  workspaceId: string | null;
  onSuccess?: () => void;
}) {
  const [formData, setFormData] = useState<{
    name: string;
    type: ReportSchedule['type'];
    frequency: ReportSchedule['frequency'];
    recipients: string[];
    enabled: boolean;
  }>({
    name: '',
    type: 'WEEKLY_UPDATE',
    frequency: 'WEEKLY',
    recipients: [''],
    enabled: true
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!workspaceId) {
      setSubmitError('Workspace não identificado');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Mapear tipos do frontend para API
      const apiType = formData.type === 'CASE_SUMMARY' ? 'COMPLETO' : 'NOVIDADES';
      const apiFrequency = formData.frequency === 'DAILY' ? 'WEEKLY'
        : formData.frequency === 'MONTHLY' ? 'MONTHLY'
          : 'WEEKLY';

      const response = await fetch('/api/reports/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          workspaceId,
          name: formData.name,
          type: apiType,
          frequency: apiFrequency,
          processIds: [], // TODO: Add process selector UI
          audienceType: 'USO_INTERNO',
          outputFormats: ['PDF'],
          recipients: formData.recipients.filter(r => r.trim()),
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error((errorData as { error?: string }).error || 'Erro ao criar agendamento');
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Erro desconhecido');
      console.error('Erro ao criar agendamento:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1">
          Nome do Agendamento *
        </label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Ex: Relatório Semanal - Cliente X"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            Tipo de Relatório *
          </label>
          <Select
            value={formData.type}
            onValueChange={(value: unknown) => {
              // Padrão-Ouro: Type guard para validar tipo de relatório
              if (isValidReportType(value)) {
                // Narrowing seguro: value é agora ReportSchedule['type'] (ZERO 'as')
                setFormData({ ...formData, type: value });
              }
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CASE_SUMMARY">Resumo de Caso</SelectItem>
              <SelectItem value="WEEKLY_UPDATE">Atualização Semanal</SelectItem>
              <SelectItem value="MONTHLY_SUMMARY">Resumo Mensal</SelectItem>
              <SelectItem value="CUSTOM">Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            Frequência *
          </label>
          <Select
            value={formData.frequency}
            onValueChange={(value: unknown) => {
              // Padrão-Ouro: Type guard para validar frequência de relatório
              if (isValidReportFrequency(value)) {
                // Narrowing seguro: value é agora ReportSchedule['frequency'] (ZERO 'as')
                setFormData({ ...formData, frequency: value });
              }
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DAILY">Diário</SelectItem>
              <SelectItem value="WEEKLY">Semanal</SelectItem>
              <SelectItem value="MONTHLY">Mensal</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1">
          Destinatários *
        </label>
        <Input
          value={formData.recipients[0]}
          onChange={(e) => setFormData({ ...formData, recipients: [e.target.value] })}
          type="email"
          placeholder="email@exemplo.com"
          required
        />
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="enabled"
          checked={formData.enabled}
          onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked as boolean })}
        />
        <label htmlFor="enabled" className="text-sm text-neutral-700">
          Ativar agendamento imediatamente
        </label>
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onClose} className="flex-1">
          Cancelar
        </Button>
        <Button type="submit" className="flex-1">
          Criar Agendamento
        </Button>
      </div>
    </form>
  );
}