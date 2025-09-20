'use client';

import { useState, useEffect } from 'react';
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
import { Calendar, Download, Plus, Clock, FileText, Users, AlertCircle, Eye, Settings } from 'lucide-react';
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
  const [selectedTab, setSelectedTab] = useState('generate');
  const [reportSchedules, setReportSchedules] = useState<ReportSchedule[]>([]);
  const [reportExecutions, setReportExecutions] = useState<ReportExecution[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Simulação de dados
  useEffect(() => {
    const mockSchedules: ReportSchedule[] = [
      {
        id: '1',
        name: 'Relatório Semanal - João Silva',
        type: 'WEEKLY_UPDATE',
        frequency: 'WEEKLY',
        enabled: true,
        lastRun: '2024-01-15T10:00:00Z',
        nextRun: '2024-01-22T10:00:00Z',
        recipients: ['joao@email.com'],
        createdAt: '2024-01-01T00:00:00Z'
      },
      {
        id: '2',
        name: 'Resumo Mensal - Todos os Casos',
        type: 'MONTHLY_SUMMARY',
        frequency: 'MONTHLY',
        enabled: true,
        nextRun: '2024-02-01T09:00:00Z',
        recipients: ['admin@escritorio.com', 'coordenador@escritorio.com'],
        createdAt: '2024-01-01T00:00:00Z'
      }
    ];

    const mockExecutions: ReportExecution[] = [
      {
        id: '1',
        scheduleId: '1',
        reportType: 'WEEKLY_UPDATE',
        status: 'COMPLETED',
        startedAt: '2024-01-15T10:00:00Z',
        completedAt: '2024-01-15T10:05:00Z',
        filePath: '/reports/weekly_update_20240115.pdf',
        fileSize: 2048576,
        tokensUsed: 1500,
        estimatedCost: 0.15
      },
      {
        id: '2',
        reportType: 'CASE_SUMMARY',
        status: 'RUNNING',
        startedAt: '2024-01-20T14:30:00Z',
        tokensUsed: 800,
        estimatedCost: 0.08
      },
      {
        id: '3',
        reportType: 'MONTHLY_SUMMARY',
        status: 'FAILED',
        startedAt: '2024-01-10T09:00:00Z',
        completedAt: '2024-01-10T09:03:00Z'
      }
    ];

    setReportSchedules(mockSchedules);
    setReportExecutions(mockExecutions);
  }, []);

  const generateInstantReport = async (type: string) => {
    setIsGenerating(true);

    // Simular geração de relatório
    setTimeout(() => {
      const newExecution: ReportExecution = {
        id: Date.now().toString(),
        reportType: type as any,
        status: 'RUNNING',
        startedAt: new Date().toISOString(),
        tokensUsed: 0,
        estimatedCost: 0
      };

      setReportExecutions(prev => [newExecution, ...prev]);

      // Simular conclusão
      setTimeout(() => {
        setReportExecutions(prev => prev.map(exec =>
          exec.id === newExecution.id
            ? {
                ...exec,
                status: 'COMPLETED',
                completedAt: new Date().toISOString(),
                filePath: `/reports/${type}_${Date.now()}.pdf`,
                fileSize: Math.floor(Math.random() * 5000000) + 1000000,
                tokensUsed: Math.floor(Math.random() * 2000) + 500,
                estimatedCost: Math.round((Math.random() * 0.5 + 0.1) * 100) / 100
              }
            : exec
        ));
        setIsGenerating(false);
      }, 3000);
    }, 500);
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
            <CreateScheduleForm onClose={() => setShowCreateDialog(false)} />
          </DialogContent>
        </Dialog>
      </div>

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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Component for creating new report schedules
function CreateScheduleForm({ onClose }: { onClose: () => void }) {
  const [formData, setFormData] = useState({
    name: '',
    type: 'WEEKLY_UPDATE' as const,
    frequency: 'WEEKLY' as const,
    recipients: [''],
    enabled: true
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement schedule creation API call
    console.log('Creating schedule:', formData);
    onClose();
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
          <Select value={formData.type} onValueChange={(value: any) => setFormData({ ...formData, type: value })}>
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
          <Select value={formData.frequency} onValueChange={(value: any) => setFormData({ ...formData, frequency: value })}>
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