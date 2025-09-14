'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ICONS } from '@/lib/icons';

interface ProcessOption {
  id: string;
  number: string;
  title: string;
  clientName: string;
  estimatedPages: number;
  lastUpdate: string;
}

interface ReportScheduleDialogProps {
  clientId: string;
  clientName: string;
  availableProcesses: ProcessOption[];
  onSchedule: (schedule: ReportSchedule) => Promise<void>;
  trigger?: React.ReactNode;
}

const scheduleFormSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  processIds: z.array(z.string()).min(1, 'Selecione pelo menos um processo'),
  frequency: z.enum(['weekly', 'biweekly', 'monthly']),
  reportType: z.enum(['complete', 'updates']),
  deliveryMethod: z.enum(['email', 'whatsapp']),
  deliveryTime: z.string().min(1, 'Horário é obrigatório'),
  recipientEmail: z.string().email('E-mail inválido').optional(),
  recipientPhone: z.string().optional(),
  isActive: z.boolean().default(true),
});

type ReportScheduleForm = z.infer<typeof scheduleFormSchema>;

export interface ReportSchedule extends ReportScheduleForm {
  clientId: string;
  clientName: string;
  estimatedCost: {
    monthly: number;
    perReport: number;
    tokensEstimate: number;
  };
}

export function ReportScheduleDialog({
  clientId,
  clientName,
  availableProcesses,
  onSchedule,
  trigger
}: ReportScheduleDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [costEstimate, setCostEstimate] = useState({
    monthly: 0,
    perReport: 0,
    tokensEstimate: 0,
  });

  const form = useForm<ReportScheduleForm>({
    resolver: zodResolver(scheduleFormSchema),
    defaultValues: {
      name: `Relatório Automático - ${clientName}`,
      processIds: [],
      frequency: 'weekly',
      reportType: 'updates',
      deliveryMethod: 'email',
      deliveryTime: '07:00',
      isActive: true,
    },
  });

  const watchedValues = form.watch();

  // Calcular custo estimado quando os valores mudam
  useEffect(() => {
    calculateCostEstimate();
  }, [
    watchedValues.processIds,
    watchedValues.frequency,
    watchedValues.reportType
  ]);

  const calculateCostEstimate = () => {
    const selectedProcesses = availableProcesses.filter(p =>
      watchedValues.processIds?.includes(p.id)
    );

    if (selectedProcesses.length === 0) {
      setCostEstimate({ monthly: 0, perReport: 0, tokensEstimate: 0 });
      return;
    }

    // Estimativas baseadas no tipo de relatório
    const baseTokensPerProcess = watchedValues.reportType === 'complete' ? 2000 : 800;
    const totalTokensPerReport = selectedProcesses.reduce((total, process) => {
      return total + (baseTokensPerProcess * (process.estimatedPages || 1));
    }, 0);

    // Custo por token (simulado - baseado em preços reais de APIs)
    const costPerToken = 0.00002; // $0.00002 por token
    const costPerReport = totalTokensPerReport * costPerToken;

    // Frequência para cálculo mensal
    const reportsPerMonth = {
      weekly: 4,
      biweekly: 2,
      monthly: 1,
    };

    const monthlyCost = costPerReport * reportsPerMonth[watchedValues.frequency || 'weekly'];

    setCostEstimate({
      monthly: monthlyCost,
      perReport: costPerReport,
      tokensEstimate: totalTokensPerReport,
    });
  };

  const handleSubmit = async (data: ReportScheduleForm) => {
    setLoading(true);
    try {
      const scheduleData: ReportSchedule = {
        ...data,
        clientId,
        clientName,
        estimatedCost: costEstimate,
      };

      await onSchedule(scheduleData);
      setOpen(false);
      form.reset();
    } catch (error) {
      console.error('Erro ao agendar relatório:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFrequencyLabel = (frequency: string) => {
    switch (frequency) {
      case 'weekly': return 'Semanal (toda segunda-feira)';
      case 'biweekly': return 'Quinzenal (a cada 2 semanas)';
      case 'monthly': return 'Mensal (1º de cada mês)';
      default: return frequency;
    }
  };

  const getReportTypeLabel = (type: string) => {
    switch (type) {
      case 'complete': return 'Completo (todos os dados)';
      case 'updates': return 'Novidades (apenas alterações)';
      default: return type;
    }
  };

  const selectedProcesses = availableProcesses.filter(p =>
    watchedValues.processIds?.includes(p.id)
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            {ICONS.CALENDAR} Agendar Relatório
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {ICONS.CALENDAR} Agendar Relatório Executivo
          </DialogTitle>
          <DialogDescription>
            Configure relatórios automáticos para <strong>{clientName}</strong>.
            Os relatórios serão gerados e enviados automaticamente conforme a frequência selecionada.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Coluna Esquerda - Configurações */}
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Agendamento</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Ex: Relatório Semanal - Cliente X" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="frequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Frequência</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a frequência" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="weekly">
                            {ICONS.TIME} Semanal - Toda segunda-feira
                          </SelectItem>
                          <SelectItem value="biweekly">
                            {ICONS.TIME} Quinzenal - A cada 2 semanas
                          </SelectItem>
                          <SelectItem value="monthly">
                            {ICONS.TIME} Mensal - 1º de cada mês
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="reportType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Relatório</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="updates">
                            {ICONS.TIME} Novidades - Apenas alterações recentes
                          </SelectItem>
                          <SelectItem value="complete">
                            {ICONS.DOCUMENT} Completo - Resumo total de cada processo
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        {watchedValues.reportType === 'updates'
                          ? 'Mais econômico - mostra apenas o que mudou desde o último relatório'
                          : 'Mais detalhado - resumo completo de todos os processos selecionados'
                        }
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="deliveryMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Entrega</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Como enviar?" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="email">
                              {ICONS.EDIT} E-mail
                            </SelectItem>
                            <SelectItem value="whatsapp">
                              {ICONS.CLIENT} WhatsApp
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="deliveryTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Horário</FormLabel>
                        <FormControl>
                          <Input {...field} type="time" />
                        </FormControl>
                        <FormDescription className="text-xs">
                          Horário de entrega
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {watchedValues.deliveryMethod === 'email' && (
                  <FormField
                    control={form.control}
                    name="recipientEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>E-mail do Destinatário</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" placeholder="cliente@exemplo.com" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {watchedValues.deliveryMethod === 'whatsapp' && (
                  <FormField
                    control={form.control}
                    name="recipientPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>WhatsApp do Destinatário</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="(11) 99999-9999" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              {/* Coluna Direita - Seleção de Processos */}
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="processIds"
                  render={() => (
                    <FormItem>
                      <div className="mb-4">
                        <FormLabel className="text-base">
                          Processos a Incluir ({selectedProcesses.length}/{availableProcesses.length})
                        </FormLabel>
                        <FormDescription>
                          Selecione os processos que devem aparecer no relatório
                        </FormDescription>
                      </div>

                      <div className="space-y-3 max-h-64 overflow-y-auto border rounded-md p-3">
                        {availableProcesses.map((process) => (
                          <FormField
                            key={process.id}
                            control={form.control}
                            name="processIds"
                            render={({ field }) => {
                              return (
                                <FormItem
                                  key={process.id}
                                  className="flex flex-row items-start space-x-3 space-y-0"
                                >
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(process.id)}
                                      onCheckedChange={(checked) => {
                                        return checked
                                          ? field.onChange([...field.value, process.id])
                                          : field.onChange(
                                              field.value?.filter(
                                                (value) => value !== process.id
                                              )
                                            )
                                      }}
                                    />
                                  </FormControl>
                                  <div className="space-y-1 leading-none">
                                    <FormLabel className="text-sm font-medium">
                                      {process.number}
                                    </FormLabel>
                                    <p className="text-xs text-muted-foreground line-clamp-2">
                                      {process.title}
                                    </p>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                      <Badge variant="outline" className="text-xs">
                                        ~{process.estimatedPages} pág.
                                      </Badge>
                                      <span>
                                        Últ. atualização: {new Date(process.lastUpdate).toLocaleDateString('pt-BR')}
                                      </span>
                                    </div>
                                  </div>
                                </FormItem>
                              )
                            }}
                          />
                        ))}
                      </div>

                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Preview do Custo */}
            {selectedProcesses.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    {ICONS.MONEY} Preview de Custo Estimado
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-blue-600">
                        {selectedProcesses.length}
                      </p>
                      <p className="text-sm text-muted-foreground">Processos</p>
                    </div>

                    <div>
                      <p className="text-2xl font-bold text-green-600">
                        ${costEstimate.perReport.toFixed(3)}
                      </p>
                      <p className="text-sm text-muted-foreground">Por relatório</p>
                    </div>

                    <div>
                      <p className="text-2xl font-bold text-purple-600">
                        ${costEstimate.monthly.toFixed(2)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Por mês ({getFrequencyLabel(watchedValues.frequency || 'weekly')})
                      </p>
                    </div>

                    <div>
                      <p className="text-2xl font-bold text-orange-600">
                        ~{costEstimate.tokensEstimate.toLocaleString()}
                      </p>
                      <p className="text-sm text-muted-foreground">Tokens/relatório</p>
                    </div>
                  </div>

                  <div className="mt-4 p-3 bg-muted rounded-md">
                    <p className="text-sm">
                      <strong>Configuração:</strong> {getReportTypeLabel(watchedValues.reportType || 'updates')} • {' '}
                      {getFrequencyLabel(watchedValues.frequency || 'weekly')} • {' '}
                      Entrega às {watchedValues.deliveryTime || '07:00'} via {watchedValues.deliveryMethod === 'email' ? 'E-mail' : 'WhatsApp'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading || selectedProcesses.length === 0}>
                {loading ? (
                  <>{ICONS.LOADING} Criando...</>
                ) : (
                  <>{ICONS.CALENDAR} Agendar Relatório</>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}